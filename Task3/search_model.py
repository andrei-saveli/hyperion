"""Local candidate retrieval, reranking and calibrated result selection."""

import csv
import hashlib
import json
import logging
import re
from pathlib import Path
from threading import Lock

import numpy as np

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
MODEL_DIR = ROOT / "models" / "search"
LOG = logging.getLogger(__name__)


def series_directory(data_dir):
    """Use the data team's cleaned series from Task3, or the assembled app's data."""
    staged = ROOT.parent / "Task2" / "cleaned"
    if ROOT.name == "Task3" and data_dir == DATA and staged.is_dir():
        return staged
    return data_dir


def model_config(model_dir=MODEL_DIR):
    calibrated = model_dir / "calibrated_config.json"
    return read_json(calibrated if calibrated.is_file() else model_dir / "config.json")


def sha256(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def catalog(data_dir=DATA):
    """Read the frozen H0 catalogs. IDs must also be safe as filenames."""
    tables = []
    for name, key, pattern, metadata in (
        ("places", "id", r"[a-z0-9_]+", ("name", "type")),
        ("variables", "code", r"[A-Z0-9]+", ("name", "definition", "source", "units")),
    ):
        rows = {}
        with (data_dir / f"{name}.csv").open(encoding="utf-8-sig", newline="") as file:
            for row in csv.DictReader(file):
                identifier = row.get(key, "")
                if not re.fullmatch(pattern, identifier) or identifier in rows:
                    raise ValueError(f"Invalid or repeated H0 identifier in {name}: {identifier!r}")
                if any(not (row.get(field) or "").strip() for field in metadata):
                    raise ValueError(f"Missing H0 metadata for {identifier} in {name}")
                rows[identifier] = row
        tables.append(rows)
    return tables


def model_path(model_dir, spec):
    return model_dir / "checkpoints" / spec["repository"].replace("/", "--") / spec["revision"]


def load_model(kind, config, model_dir):
    from sentence_transformers import CrossEncoder, SentenceTransformer

    spec = config["models"][kind]
    path = model_path(model_dir, spec)
    if sha256(path / "model.safetensors") != spec["weights_sha256"]:
        raise ValueError(f"Weight checksum mismatch for {spec['repository']}")
    options = {
        "device": "cpu",
        "local_files_only": True,
        "trust_remote_code": False,
        "model_kwargs": {"use_safetensors": True},
    }
    if kind == "cross":
        return CrossEncoder(str(path), max_length=256, **options)
    return SentenceTransformer(str(path), **options)


def encode(model, texts):
    return np.asarray(
        model.encode(texts, normalize_embeddings=True, show_progress_bar=False),
        dtype=np.float32,
    )


def select(scores, policy):
    """Apply the independent query-abstention and per-result cutoffs."""
    if not len(scores) or policy is None or np.max(scores) < policy["accept"]:
        return np.empty(0, dtype=int)
    ranked = np.argsort(-scores, kind="stable")
    return ranked[scores[ranked] >= policy["include"]][:min(5, policy["limit"])]


class SearchEngine:
    def __init__(self, documents, embeddings, section_embeddings, bi, cross, config, head=None):
        self.documents = documents
        self.embeddings = embeddings
        self.section_embeddings = section_embeddings
        self.bi = bi
        self.cross = cross
        self.config = config
        self.head = head
        self.lock = Lock()

    @classmethod
    def load(cls, model_dir=MODEL_DIR, data_dir=DATA, *, uncalibrated=False, dense_only=False):
        config = model_config(model_dir)
        policy = None if uncalibrated else config["calibration"]
        if not uncalibrated and policy is None:
            raise ValueError("Searchlight requires a validation calibration")
        documents_path = model_dir / "candidate_documents.json"
        embeddings_path = model_dir / "candidate_embeddings.npy"
        manifest = read_json(documents_path)
        if manifest["models"] != config["models"] or sha256(embeddings_path) != manifest["embeddings_sha256"]:
            raise ValueError("Searchlight index and model configuration do not match")
        index_sha = sha256(documents_path)
        if policy and (policy["index_sha256"] != index_sha
                       or policy["retrieval_limit"] != config["retrieval_limit"]):
            raise ValueError("Searchlight calibration belongs to a different retrieval configuration")
        for name, digest in manifest["catalog_sha256"].items():
            if sha256(data_dir / name) != digest:
                raise ValueError("H0 catalog changed. Rebuild and recalibrate Searchlight.")
        documents = manifest["documents"]
        for doc in documents:
            path = series_directory(data_dir) / f"{doc['place_id']}_{doc['code']}.csv"
            if sha256(path) != doc["series_sha256"]:
                raise ValueError(f"H1 series changed: {path.name}")
        with embeddings_path.open("rb") as file:
            matrix = np.load(file, allow_pickle=False)
        count = len(documents)
        if not count or matrix.ndim != 2 or len(matrix) != count + sum(len(d["sections"]) for d in documents):
            raise ValueError("Searchlight index has inconsistent dimensions")
        if not np.isfinite(matrix).all() or not np.allclose(np.linalg.norm(matrix, axis=1), 1, atol=1e-4):
            raise ValueError("Searchlight index must contain finite, normalized vectors")
        section_embeddings = np.split(matrix[count:], np.cumsum([len(d["sections"]) for d in documents])[:-1])
        bi = load_model("bi", config, model_dir)
        head = cross = None
        try:
            if not dense_only:
                cross = load_model("cross", config, model_dir)
            if cross is not None and policy and policy.get("head_sha256"):
                import torch

                head_path = model_dir / "ranking_head.pt"
                if sha256(head_path) != policy["head_sha256"]:
                    raise ValueError("Searchlight ranking head checksum mismatch")
                state = torch.load(head_path, map_location="cpu", weights_only=True)
                head = state["coefficients"].numpy()
                if head.shape != (3,) or not np.isfinite(head).all():
                    raise ValueError("Invalid Searchlight ranking weights")
        except Exception:
            LOG.warning("Searchlight using dense retrieval only", exc_info=True)
            cross = None
        return cls(documents, matrix[:count], section_embeddings, bi, cross, config, head)

    def score(self, text, *, dense_only=False):
        """Return document indices, score columns and the one query embedding."""
        with self.lock:
            query = encode(self.bi, [text])[0]
            dense = self.embeddings @ query
            if not np.isfinite(dense).all():
                raise ValueError("Non-finite dense retrieval scores")
            limit = min(20, self.config["retrieval_limit"])
            indices = np.argsort(-dense, kind="stable")[:limit]
            features = dense[indices, None]
            if self.cross is not None and not dense_only and len(indices):
                pairs = [(text, " ".join(self.documents[i]["sections"])) for i in indices]
                try:
                    scores = np.asarray(self.cross.predict(pairs, batch_size=len(pairs), show_progress_bar=False))
                    if scores.shape != (len(pairs),) or not np.isfinite(scores).all():
                        raise ValueError("Invalid cross-encoder scores")
                    features = np.column_stack((features[:, 0], scores))
                except Exception:
                    LOG.warning("Searchlight rerank failed. Using dense retrieval for this query.", exc_info=True)
            return indices, features, query

    def suggest(self, text, *, explore=False):
        if explore and not text.strip():
            return []
        indices, features, query = self.score(text)
        calibration = self.config["calibration"]
        mode = "dense" if features.shape[1] == 1 else "cross"
        if mode == "cross" and self.head is not None:
            mode = "head"
        scores = ranking_scores(features, mode, self.head)
        positions = select(scores, calibration.get(mode))
        if explore:
            positions, label = self.explore_positions(text, indices, features[:, 0], positions)
        results = []
        for position in positions:
            index = indices[position]
            doc = self.documents[index]
            # Use the variable definition or region type as supporting evidence.
            evidence = 1 + int(np.argmax(self.section_embeddings[index][1:3] @ query))
            results.append({
                "place_id": doc["place_id"],
                "code": doc["code"],
                "reason": f"{doc['name']}. {doc['sections'][evidence]}",
                "score": float(scores[position]),
            })
            if explore:
                results[-1]["match_label"] = label
                results[-1]["reason"] = doc["sections"][1]
        return results

    def explore_positions(self, text, indices, dense_scores, positions):
        if __package__:
            from .scripts.coverage_search import PLACES, YEAR, covered_candidates, mentions, unavailable
        else:
            from scripts.coverage_search import PLACES, YEAR, covered_candidates, mentions, unavailable

        docs = [self.documents[i] for i in indices]
        keys = [f"{doc['place_id']}:{doc['code']}" for doc in docs]
        coverage = {
            key: (int(doc["coverage"]["start"][:4]), int(doc["coverage"]["end"][:4]))
            for key, doc in zip(keys, docs, strict=True)
        }
        normalized = text.casefold().strip(" ?.")
        places = mentions(normalized, PLACES)
        covered, _ = covered_candidates(normalized, keys, coverage)
        # Treat recognized out-of-catalog requests as exploration, with an exception
        # for the available part of a multi-measurement question.
        if unavailable(normalized):
            positions = [i for i in positions if i in covered]
        years = [int(year) for year in YEAR.findall(normalized)]
        positions = [
            i for i in positions
            if all(coverage[keys[i]][0] <= year <= coverage[keys[i]][1] for year in years)
        ]
        if places:
            positions = [i for i in positions if docs[i]["place_id"] in places]
        if len(positions):
            return positions[:3], "Possible match"
        if not len(indices):
            return [], ""
        local = [i for i, doc in enumerate(docs) if doc["place_id"] in places]
        candidates = sorted(covered) or local or range(len(indices))
        best = max(candidates, key=lambda i: dense_scores[i])
        return [best], "Related dataset" if local else "Explore a dataset"


def ranking_scores(features, mode, head=None):
    features = features.astype(np.float64, copy=False)
    if mode == "dense":
        return features[:, 0]
    if mode == "cross":
        return features[:, 1]
    if mode == "head":
        return features @ head[:2] + head[2]
    raise ValueError(f"Unknown ranking mode: {mode}")
