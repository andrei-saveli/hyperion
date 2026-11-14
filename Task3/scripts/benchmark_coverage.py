"""Calibrate on the earlier draft and score the frozen coverage experiment."""

import argparse
import json
from pathlib import Path

from scripts.benchmark_pretrained import QUESTIONS, check_coverage, load_splits, summarize
from scripts.coverage_search import covered_candidates, rank_covered
from scripts.evaluate_search import collect, metrics, rank_cases, validate_splits
from scripts.train_search_model import calibrate
from search_model import DATA, MODEL_DIR, SearchEngine, read_json, sha256

FRESH = DATA / "search_coverage_test.jsonl"


def matches(rows, cases, coverage):
    return [
        covered_candidates(row["query"], case[1], coverage)
        for row, case in zip(rows, cases, strict=True)
    ]


def covered_results(cases, found, policy):
    return [rank_covered(case, match, policy) for case, match in zip(cases, found, strict=True)]


def calibrate_margin(cases, found):
    """Try a fixed score and margin grid under the baseline false-answer ceiling."""
    policies = [None] + [
        {"accept": cutoff / 100, "margin": gap / 100}
        for cutoff in range(25, 76, 5)
        for gap in range(0, 21, 5)
    ]
    best = None
    policy = None
    for candidate in policies:
        results = covered_results(cases, found, candidate)
        summary = metrics(cases, results)
        key = (summary["ndcg@5"], summary["recall@5"], -(summary["irrelevant_result_rate"] or 0))
        if summary["false_answer_rate"] <= 0.10 and (best is None or key > best):
            best, policy = key, candidate
    return policy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", type=Path, metavar="DEVELOPMENT_REPORT",
                        help="Score fresh questions using policies from the saved development report")
    args = parser.parse_args()
    engine = SearchEngine.load(uncalibrated=True, dense_only=True)
    known = check_coverage(engine)
    coverage = {
        f"{doc['place_id']}:{doc['code']}": (
            int(doc["coverage"]["start"][:4]), int(doc["coverage"]["end"][:4]),
        )
        for doc in engine.documents
    }
    # A single calibration file and the held-out split from the first experiment
    # both count as development here because their results were already observed.
    previous = load_splits(QUESTIONS, known)
    development = previous["calibration"] + previous["test"]
    cases = collect(engine, development, require_cross=False, allow_draft=True)
    found = matches(development, cases, coverage)
    digests = {
        "index_sha256": sha256(MODEL_DIR / "candidate_documents.json"),
        "development_sha256": sha256(QUESTIONS),
        "coverage_code_sha256": sha256(Path(__file__).with_name("coverage_search.py")),
    }
    if args.test:
        frozen = read_json(args.test)
        if any(frozen[key] != digest for key, digest in digests.items()):
            parser.error("The index, development questions or coverage rules changed since calibration")
        baseline, fallback = frozen["baseline_policy"], frozen["fallback_policy"]
    else:
        # Restore the original embedding baseline policy from its own calibration split.
        baseline = calibrate(cases[:len(previous["calibration"])], "dense", None)
        fallback = calibrate_margin(cases, found)
    report = {
        "draft": True,
        **digests,
        "baseline_policy": baseline,
        "fallback_policy": fallback,
        "splits": {},
    }
    splits = {"development": (development, cases, found)}
    if args.test:
        rows = load_splits(FRESH, known, split_names=("test",))["test"]
        validate_splits({"development": development, "test": rows})
        test_cases = collect(engine, rows, require_cross=False, allow_draft=True)
        splits["test"] = (rows, test_cases, matches(rows, test_cases, coverage))
        report["test_sha256"] = sha256(FRESH)
    for name, (rows, split_cases, split_matches) in splits.items():
        results = {
            "baseline": rank_cases(split_cases, "dense", None, baseline),
            "coverage": covered_results(split_cases, split_matches, None),
            "coverage_with_margin": covered_results(split_cases, split_matches, fallback),
        }
        report["splits"][name] = {
            "questions": len(rows),
            "groups": len({row["concept"] for row in rows}),
            "results": {mode: summarize(rows, split_cases, ranked) for mode, ranked in results.items()},
            "predictions": [
                {**row, "predicted": {mode: ranked[i] for mode, ranked in results.items()}}
                for i, row in enumerate(rows)
            ],
        }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
