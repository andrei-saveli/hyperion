"""Compare the two pretrained Searchlight modes on grouped draft questions."""

import argparse
import json
from pathlib import Path

from scripts.build_search_index import series_coverage
from scripts.evaluate_search import collect, metrics, rank_cases, validate_splits
from scripts.train_search_model import calibrate
from search_model import DATA, MODEL_DIR, ROOT, SearchEngine, sha256

QUESTIONS = DATA / "search_pretrained_questions.jsonl"
SOURCES = ROOT.parent / "Task2" / "SOURCES.md"
CLEANED = SOURCES.parent / "cleaned"
MODES = ("dense", "cross")


def check_coverage(engine):
    """Check the index against the complete Task2 inventory before scoring."""
    documented = SOURCES.read_text(encoding="utf-8")
    indexed = {
        f"{doc['place_id']}_{doc['code']}.csv": doc for doc in engine.documents
    }
    if set(indexed) != {path.name for path in CLEANED.glob("*.csv")}:
        raise ValueError("Searchlight index and Task2 inventory differ")
    for name, doc in indexed.items():
        if f"`{name}`" not in documented or series_coverage(CLEANED / name) != doc["coverage"]:
            raise ValueError(f"Task2 provenance or monthly coverage differs for {name}")
    return {f"{doc['place_id']}:{doc['code']}" for doc in indexed.values()}


def load_splits(questions, known, split_names=("calibration", "test")):
    splits = {split: [] for split in split_names}
    concepts = set()
    with questions.open(encoding="utf-8") as file:
        for line in file:
            if not line.strip():
                continue
            group = json.loads(line)
            concept, expected, queries = group["concept"], group["expected"], group["queries"]
            if concept in concepts or not set(expected) <= known or len(set(expected)) != len(expected):
                raise ValueError(f"Duplicate concept or invalid Task2 labels: {concept}")
            concepts.add(concept)
            missing = group.get("missing", [])
            if not queries or not (expected or missing):
                raise ValueError(f"Missing question or coverage rationale: {concept}")
            kind = "unsupported" if not expected else "partial" if missing else (
                "multiple_pairs" if len(expected) > 1 else "single_pair"
            )
            for number, query in enumerate(queries, 1):
                splits[group["split"]].append({
                    "query_id": f"{concept}_{number}",
                    "concept": concept,
                    "base_question": queries[0],
                    "query": query,
                    "answerability": "supported" if expected else "unsupported",
                    "relevance": dict.fromkeys(expected, 3),
                    "missing": missing,
                    "tags": [kind],
                    "reviewed": False,
                })
    validate_splits(splits)
    return splits


def summarize(rows, cases, results):
    supported = [i for i, row in enumerate(rows) if row["relevance"]]
    unsupported = [i for i, row in enumerate(rows) if not row["relevance"]]
    kinds = sorted({row["tags"][0] for row in rows})
    slices = {}
    for kind in kinds:
        indices = [i for i, row in enumerate(rows) if kind in row["tags"]]
        slices[kind] = {
            "questions": len(indices),
            **metrics([cases[i] for i in indices], [results[i] for i in indices]),
        }
    return {
        "metrics": metrics(cases, results),
        "slices": slices,
        "supported": len(supported),
        "supported_rejected": sum(not results[i] for i in supported),
        "unsupported": len(unsupported),
        "unsupported_answered": sum(bool(results[i]) for i in unsupported),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--questions", type=Path, default=QUESTIONS)
    args = parser.parse_args()

    engine = SearchEngine.load(uncalibrated=True)
    known = check_coverage(engine)
    rows = load_splits(args.questions, known)
    calibration = collect(engine, rows["calibration"], allow_draft=True)
    policies = {mode: calibrate(calibration, mode, head=None) for mode in MODES}
    test = collect(engine, rows["test"], allow_draft=True)
    output = {
        "draft": True,
        "questions_sha256": sha256(args.questions),
        "index_sha256": sha256(MODEL_DIR / "candidate_documents.json"),
        "models": engine.config["models"],
        "retrieval_limit": engine.config["retrieval_limit"],
        "available_pairs": sorted(known),
        "splits": {
            split: {
                "questions": len(items),
                "concepts": len({row["concept"] for row in items}),
            }
            for split, items in rows.items()
        },
        "modes": {},
        "test_questions": rows["test"],
    }
    for mode, policy in policies.items():
        validation_results = rank_cases(calibration, mode, None, policy)
        unfiltered = rank_cases(test, mode, None, None)
        calibrated = rank_cases(test, mode, None, policy)
        output["modes"][mode] = {
            "policy": policy,
            "calibration": summarize(rows["calibration"], calibration, validation_results),
            "test_unfiltered": summarize(rows["test"], test, unfiltered),
            "test_calibrated": summarize(rows["test"], test, calibrated),
            "test_predictions": {
                row["query_id"]: {"unfiltered": raw, "calibrated": selected}
                for row, raw, selected in zip(rows["test"], unfiltered, calibrated, strict=True)
            },
        }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
