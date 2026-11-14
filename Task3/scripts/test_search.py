"""Searchlight-specific integration and evaluation checks."""

import csv
from unittest.mock import Mock

import numpy as np
import pytest

import search
from scripts import build_search_index as builder
from scripts.evaluate_search import collect, metrics, rank_cases, validate_splits
from scripts.train_search_model import calibrate, fit_head
from search_model import MODEL_DIR, SearchEngine, read_json, sha256, write_json


@pytest.fixture
def setup_index(tmp_path):
    data = tmp_path / "data"
    model = tmp_path / "model"
    data.mkdir()
    model.mkdir()
    (data / "places.csv").write_text("id,name,type\nlake_mead,Lake Mead,desert\n", encoding="utf-8")
    (data / "variables.csv").write_text(
        "code,name,definition,source,units\n"
        "SOILM,Soil moisture,Water held in the soil where roots grow,RootMoist,kg/m²\n"
        "RAIN,Rainfall,Rain and snow falling each day,precipitation,mm/day\n"
        "TEMP,Temperature,Warmth of the air,T2M,°C\n",
        encoding="utf-8",
    )
    for code in ("SOILM", "RAIN"):
        with (data / f"lake_mead_{code}.csv").open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(["date", "value"])
            writer.writerows((month, "" if i == 0 else 3) for i, month in enumerate(builder.MONTHS))
    config = read_json(MODEL_DIR / "config.json")
    config["calibration"] = None
    write_json(model / "config.json", config)
    return data, model, config


def test_offline_artifact_roundtrip(setup_index, monkeypatch):
    data, model, config = setup_index
    bi = Mock()
    bi.encode.side_effect = lambda texts, **_: np.tile([1.0, 0.0], (len(texts), 1))
    cross = Mock()
    cross.predict.return_value = np.array([0.6, 0.9])
    load = Mock(side_effect=lambda kind, *_: bi if kind == "bi" else cross)
    monkeypatch.setattr(builder, "load_model", load)
    monkeypatch.setattr("search_model.load_model", load)
    assert builder.build_index(config, model, data) == 2
    with pytest.raises(ValueError, match="calibration"):
        SearchEngine.load(model, data)
    config["calibration"] = {
        "index_sha256": sha256(model / "candidate_documents.json"),
        "retrieval_limit": config["retrieval_limit"],
        "dense": {"accept": 0.5, "include": 0.5, "limit": 1},
        "cross": {"accept": 0.8, "include": 0.5, "limit": 5},
    }
    write_json(model / "config.json", config)
    engine = SearchEngine.load(model, data)
    bi.encode.reset_mock()
    monkeypatch.setattr(search, "_engine", engine)
    monkeypatch.setattr(search, "_load_attempted", True)
    assert search.search(" ") == []
    results = search.search(" Soil and rain? ")
    assert [row["code"] for row in results] == ["SOILM", "RAIN"]
    assert set(results[0]) == {"place_id", "code", "score", "reason"}
    assert "Soil moisture in Lake Mead" in results[0]["reason"]
    bi.encode.assert_called_once_with(
        ["Soil and rain?"], normalize_embeddings=True, show_progress_bar=False,
    )
    cross.predict.assert_called_once()
    cross.predict.return_value = np.array([0.2, 0.4])
    assert search.search("Lake Mead tree cover?") == []
    cross.predict.side_effect = RuntimeError("reranker unavailable")
    assert [row["code"] for row in search.search("Lake Mead rain?")] == ["RAIN"]
    (data / "lake_mead_RAIN.csv").unlink()
    with pytest.raises(FileNotFoundError):
        SearchEngine.load(model, data)


def test_h1_validation_and_coverage(setup_index):
    data, _, _ = setup_index
    docs = builder.candidate_documents(data)
    assert [doc["code"] for doc in docs] == ["RAIN", "SOILM"]
    assert docs[0]["coverage"] == {"start": "2001-02", "end": "2024-12", "observed_months": 287}
    path = data / "lake_mead_TEMP.csv"
    path.write_text("date,value\n2001-01-01,NaN\n", encoding="utf-8")
    with pytest.raises(ValueError, match="complete H1 calendar"):
        builder.candidate_documents(data)


def test_calibration_learns_abstention_and_complete_result_sets():
    keys = ["a", "b", "c"]
    cases = [
        ({"a": 3, "b": 3, "c": 0}, keys, np.array([[0.9, 4], [0.8, 3], [0.2, -1]]), []),
        ({"a": 3, "c": 2, "b": 1}, keys, np.array([[0.8, 4], [0.2, 1], [0.7, 2]]), []),
        ({}, keys, np.array([[0.3, 1], [0.2, 0], [0.1, -1]]), []),
    ]
    head = fit_head(cases)
    for mode in ("dense", "cross", "head"):
        policy = calibrate(cases, mode, head)
        ranked = rank_cases(cases, mode, head, policy)
        assert set(ranked[0]) == {"a", "b"}
        assert ranked[1] == ["a", "c"]
        assert ranked[2] == []
        summary = metrics(cases, ranked)
        assert summary["false_answer_rate"] == 0
        assert summary["multi_direct_complete"] == 1


def test_review_and_split_checks():
    validation = {"query_id": "1", "concept": "arctic", "base_question": "Is it warmer?", "query": "warming?"}
    test = {**validation, "query_id": "2", "query": "Is warmth increasing?"}
    with pytest.raises(ValueError, match="cross-split concept"):
        validate_splits({"validation": [validation], "test": [test]})
    with pytest.raises(ValueError, match="Human review"):
        collect(Mock(documents=[]), [test])


def test_reranks_at_most_twenty_and_returns_at_most_five():
    documents = [
        {"place_id": str(i), "code": "TEMP", "name": f"Air temperature at Site {i}",
         "sections": ["Monthly record.", "Air warmth.", "Region type: coast."]}
        for i in range(25)
    ]
    bi = Mock()
    bi.encode.return_value = np.array([[1.0, 0.0]])
    cross = Mock()
    cross.predict.return_value = np.arange(20, dtype=float)
    config = {"retrieval_limit": 25, "calibration": {"cross": {"accept": 0, "include": 0, "limit": 10}}}
    engine = SearchEngine(
        documents, np.tile([1, 0], (25, 1)), [np.eye(2, k=0) for _ in documents],
        bi, cross, config,
    )
    assert [row["score"] for row in engine.suggest("air temperature")] == [19, 18, 17, 16, 15]
    pairs = cross.predict.call_args.args[0]
    assert len(pairs) == cross.predict.call_args.kwargs["batch_size"] == 20


def test_pinned_models_offline(setup_index, monkeypatch):
    data, model, config = setup_index
    checkpoints = MODEL_DIR / "checkpoints"
    if not checkpoints.is_dir():
        pytest.skip("Provision pinned checkpoints to run the offline model smoke test")
    import shutil
    import socket

    shutil.copytree(checkpoints, model / "checkpoints")
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
    monkeypatch.setattr(socket.socket, "connect", Mock(side_effect=AssertionError("Network access")))
    builder.build_index(config, model, data)
    engine = SearchEngine.load(model, data, uncalibrated=True)
    indices, scores, _ = engine.score("Does soil around Lake Mead hold water where roots grow?")
    assert len(indices) == 2 and scores.shape == (2, 2)
    assert np.isfinite(scores).all()
