"""Provision pinned checkpoints and build the offline Searchlight index."""

import argparse
import csv
import math
import shutil
from datetime import datetime, timezone
from urllib.request import urlopen

import numpy as np

from search_model import (
    DATA, MODEL_DIR, catalog, encode, load_model, model_path, read_json, series_directory, sha256,
    write_json,
)

MONTHS = [f"{year}-{month:02d}-01" for year in range(2001, 2025) for month in range(1, 13)]
COMMON_FILES = ("config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json",
                "special_tokens_map.json", "vocab.txt")
BI_FILES = ("modules.json", "1_Pooling/config.json", "config_sentence_transformers.json",
            "sentence_bert_config.json")


def provision_models(config, model_dir):
    """Download only the files used by the two pinned models."""
    for kind, spec in config["models"].items():
        directory = model_path(model_dir, spec)
        base_url = f"https://huggingface.co/{spec['repository']}/resolve/{spec['revision']}"
        files = COMMON_FILES + (BI_FILES if kind == "bi" else ())
        for filename in files:
            target = directory / filename
            expected = spec["weights_sha256"] if filename == "model.safetensors" else None
            if target.is_file() and (expected is None or sha256(target) == expected):
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + ".download")
            try:
                with urlopen(f"{base_url}/{filename}", timeout=90) as remote, temporary.open("wb") as file:
                    shutil.copyfileobj(remote, file)
                if expected and sha256(temporary) != expected:
                    raise ValueError(f"Weight checksum mismatch for {spec['repository']}")
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)


def series_coverage(path):
    """Validate the H1 file and summarize observed months without computing trends."""
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != ["date", "value"]:
            raise ValueError(f"{path.name} must have H1 date,value columns")
        rows = list(reader)
    if [row["date"] for row in rows] != MONTHS:
        raise ValueError(f"{path.name} must contain the complete H1 calendar")
    observed = []
    for row in rows:
        value = row["value"]
        if value is None or None in row:
            raise ValueError(f"{path.name} has an invalid observation row at {row['date']}")
        if value == "":
            continue
        observation = float(value)
        if not math.isfinite(observation) or observation == -999:
            raise ValueError(f"{path.name} has an invalid observation at {row['date']}")
        observed.append(row["date"][:7])
    if observed:
        return {"start": observed[0], "end": observed[-1], "observed_months": len(observed)}
    return None


def candidate_documents(data_dir=DATA):
    """Combine H0 metadata with availability from real H1 files."""
    places, variables = catalog(data_dir)
    series_dir = series_directory(data_dir)
    documents = []
    for place_id, place in sorted(places.items()):
        for code, variable in sorted(variables.items()):
            path = series_dir / f"{place_id}_{code}.csv"
            if not path.is_file():
                continue
            coverage = series_coverage(path)
            if coverage is None:
                continue
            name = f"{variable['name']} in {place['name']}"
            keywords = variable.get("keywords") or ""
            story = place.get("story") or ""
            story_words = set(story.casefold().rstrip("?").split())
            example = story if story_words.intersection(keywords.split()) else ""
            sections = [
                f"Monthly observations of {name}. {example}".strip(),
                variable["definition"],
                f"Region type: {place['type']}.",
                f"Giovanni product {variable['source']}, measured in {variable['units']}.",
                f"Related search terms: {keywords}.",
            ]
            documents.append({
                "place_id": place_id,
                "code": code,
                "name": name,
                "sections": sections,
                "coverage": coverage,
                "series_sha256": sha256(path),
            })
    return documents


def build_index(config, model_dir=MODEL_DIR, data_dir=DATA):
    documents = candidate_documents(data_dir)
    if not documents:
        raise ValueError("No executable H1 series. Add the cleaned series before indexing.")
    bi = load_model("bi", config, model_dir)
    texts = [" ".join(doc["sections"]) for doc in documents]
    texts += [section for doc in documents for section in doc["sections"]]
    matrix = encode(bi, texts)
    model_dir.mkdir(parents=True, exist_ok=True)
    path = model_dir / "candidate_embeddings.npy"
    temporary = path.with_suffix(".npy.tmp")
    with temporary.open("wb") as file:
        np.save(file, matrix, allow_pickle=False)
    temporary.replace(path)
    write_json(model_dir / "candidate_documents.json", {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "models": config["models"],
        "catalog_sha256": {name: sha256(data_dir / name) for name in ("places.csv", "variables.csv")},
        "embeddings_sha256": sha256(path),
        "documents": documents,
    })
    return len(documents)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-models", action="store_true", help="Provision pinned checkpoints")
    parser.add_argument("--models-only", action="store_true", help="Skip the index build")
    args = parser.parse_args()
    config = read_json(MODEL_DIR / "config.json")
    if args.download_models:
        provision_models(config, MODEL_DIR)
    if not args.models_only:
        print(f"Indexed {build_index(config)} executable investigations.")


if __name__ == "__main__":
    main()
