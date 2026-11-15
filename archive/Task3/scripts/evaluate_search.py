"""Score reviewed question splits and report ranking, abstention and CPU performance."""

import argparse
import json
import sys
from time import perf_counter

import numpy as np

from search_model import DATA, MODEL_DIR, SearchEngine, ranking_scores, select, sha256

SPLITS = ("train", "validation", "test")


def read_split(split, data_dir=DATA):
    path = data_dir / f"search_{split}.jsonl"
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def validate_splits(splits):
    owners = {}
    ids = set()
    for split, rows in splits.items():
        if not rows:
            raise ValueError(f"Searchlight {split} questions are empty")
        for row in rows:
            query_id = row["query_id"]
            if query_id in ids:
                raise ValueError(f"Duplicate query ID: {query_id}")
            ids.add(query_id)
            for name in ("concept", "base_question", "query"):
                value = " ".join(row[name].casefold().split()).rstrip("?.!")
                key = ("concept" if name == "concept" else "question", value)
                if not value or owners.setdefault(key, split) != split:
                    raise ValueError(f"Empty or cross-split {name}: {value!r}")


def collect(engine, rows, *, require_cross=True, allow_draft=False):
    candidates = [f"{doc['place_id']}:{doc['code']}" for doc in engine.documents]
    known = set(candidates)
    cases = []
    for row in rows:
        if row.get("reviewed") is not True and not allow_draft:
            raise ValueError(f"Human review is pending for {row['query_id']}")
        grades = row["relevance"]
        if not set(grades) <= known or any(type(grade) is not int or not 0 <= grade <= 3 for grade in grades.values()):
            raise ValueError(f"Invalid or unavailable relevance label for {row['query_id']}")
        supported = any(grade >= 2 for grade in grades.values())
        if row["answerability"] != ("supported" if supported else "unsupported"):
            raise ValueError(f"Answerability and relevance disagree for {row['query_id']}")
    for row in rows:
        indices, features, _ = engine.score(row["query"], dense_only=not require_cross)
        if require_cross and features.shape[1] != 2:
            raise ValueError("Full evaluation requires the cross-encoder")
        cases.append((row["relevance"], [candidates[i] for i in indices], features, row.get("tags", [])))
    return cases


def metrics(cases, results):
    values = {}

    def record(key, value):
        values.setdefault(key, []).append(value)

    for (grades, _, _, _), result in zip(cases, results, strict=True):
        direct = {key for key, grade in grades.items() if grade == 3}
        supporting = {key for key, grade in grades.items() if grade == 2}
        relevant = direct | supporting
        if relevant:
            for k in (3, 5):
                record(f"recall@{k}", len(relevant.intersection(result[:k])) / len(relevant))
            first = next((i for i, key in enumerate(result, 1) if key in relevant), None)
            record("mrr", 1 / first if first else 0)
            gains = [grades.get(key, 0) for key in result[:5]]
            ideal = sorted(grades.values(), reverse=True)[:5]
            discount = np.log2(np.arange(2, 7))
            dcg = np.sum((2 ** np.array(gains, dtype=int) - 1) / discount[:len(gains)])
            best = np.sum((2 ** np.array(ideal) - 1) / discount[:len(ideal)])
            record("ndcg@5", dcg / best)
            record("set_completeness", relevant.issubset(result))
            record("supported_rejection_rate", not result)
            if direct:
                record("direct_recall", len(direct.intersection(result)) / len(direct))
                if len(direct) > 1:
                    record("multi_direct_complete", direct.issubset(result))
            if supporting:
                record("supporting_recall", len(supporting.intersection(result)) / len(supporting))
        else:
            record("unsupported_recall", not result)
            record("false_answer_rate", bool(result))
        for key in result:
            record("irrelevant_result_rate", grades.get(key, 0) < 2)
    keys = (
        "recall@3", "recall@5", "mrr", "ndcg@5", "direct_recall", "supporting_recall",
        "multi_direct_complete", "set_completeness", "irrelevant_result_rate",
        "unsupported_recall", "supported_rejection_rate", "false_answer_rate",
    )
    return {key: float(np.mean(values[key])) if key in values else None for key in keys}


def rank_cases(cases, mode, head, policy):
    results = []
    for _, keys, features, _ in cases:
        scores = ranking_scores(features, mode, head)
        positions = select(scores, policy) if policy else np.argsort(-scores, kind="stable")[:5]
        results.append([keys[i] for i in positions])
    return results


def peak_process_bytes():
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [
                ("size", wintypes.DWORD), ("page_faults", wintypes.DWORD),
                *((name, ctypes.c_size_t) for name in (
                    "peak_working_set", "working_set", "peak_paged_pool", "paged_pool",
                    "peak_nonpaged_pool", "nonpaged_pool", "pagefile", "peak_pagefile",
                )),
            ]

        counters = Counters()
        counters.size = ctypes.sizeof(counters)
        process = ctypes.windll.kernel32.GetCurrentProcess
        process.restype = wintypes.HANDLE
        get_counters = ctypes.windll.psapi.GetProcessMemoryInfo
        get_counters.argtypes = (wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD)
        if get_counters(process(), ctypes.byref(counters), counters.size):
            return counters.peak_working_set
        return None
    import resource

    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform == "darwin" else peak * 1024


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=SPLITS, default="validation")
    parser.add_argument("--baseline", action="store_true", help="Run pretrained modes without thresholds")
    parser.add_argument("--dense-only", action="store_true", help="Benchmark the dense baseline alone")
    parser.add_argument("--test-sha256", help="Digest recorded when the reviewed test set was frozen")
    parser.add_argument("--allow-draft", action="store_true", help="Run a provisional evaluation with unreviewed labels")
    args = parser.parse_args()
    if args.split == "test" and (args.baseline or args.dense_only):
        parser.error("Use validation for baseline diagnostics. Test compares frozen calibrated modes.")
    if args.dense_only and not args.baseline:
        parser.error("--dense-only requires --baseline")
    if args.split == "test" and args.test_sha256 != sha256(DATA / "search_test.jsonl"):
        parser.error("Test evaluation requires the matching frozen --test-sha256")
    names = SPLITS if args.split == "test" else ("train", "validation")
    splits = {name: read_split(name) for name in names}
    validate_splits(splits)
    start = perf_counter()
    engine = SearchEngine.load(uncalibrated=args.baseline, dense_only=args.dense_only)
    cold_seconds = perf_counter() - start
    rows = splits[args.split]
    calibration = engine.config["calibration"]
    if args.split == "test":
        if engine.head is None:
            raise ValueError("Test comparison requires the frozen trained ranking head")
        for name, digest in calibration["split_sha256"].items():
            if sha256(DATA / f"search_{name}.jsonl") != digest:
                raise ValueError(f"Searchlight {name} changed after calibration")
    provisional = args.allow_draft or bool(calibration and calibration.get("draft"))
    if provisional and not args.allow_draft:
        parser.error("This model was calibrated on draft labels. Use --allow-draft for a provisional evaluation.")
    cases = collect(engine, rows, require_cross=not args.dense_only, allow_draft=args.allow_draft)
    modes = ["dense"] if args.dense_only else ["dense", "cross"]
    if not args.baseline and engine.head is not None:
        modes.append("head")
    report = {}
    for mode in modes:
        policy = None if args.baseline else calibration.get(mode)
        ranked = rank_cases(cases, mode, engine.head, policy)
        tags = sorted({tag for case in cases for tag in case[3]})
        slices = {}
        for tag in tags:
            indices = [i for i, case in enumerate(cases) if tag in case[3]]
            slices[tag] = {
                "questions": len(indices),
                "metrics": metrics([cases[i] for i in indices], [ranked[i] for i in indices]),
            }
        report[mode] = {"overall": metrics(cases, ranked), "slices": slices}
    warm_ms = []
    for row in rows:
        start = perf_counter()
        if args.baseline:
            engine.score(row["query"], dense_only=args.dense_only)
        else:
            engine.suggest(row["query"])
        warm_ms.append((perf_counter() - start) * 1000)
    output = {
        "split": args.split,
        "questions": len(rows),
        "provisional": provisional,
        "implementation": "baseline" if args.baseline else "calibrated",
        "metrics": report,
        "runtime": {
            "cold_load_seconds": cold_seconds,
            "warm_median_ms": float(np.median(warm_ms)),
            "warm_p95_ms": float(np.percentile(warm_ms, 95)),
            "peak_process_bytes": peak_process_bytes(),
            "index_bytes": sum((MODEL_DIR / name).stat().st_size for name in (
                "candidate_documents.json", "candidate_embeddings.npy",
            )),
        },
    }
    if args.split == "test" and not provisional:
        trained = report.get("head", {}).get("overall", {})
        cross = report["cross"]["overall"]
        dense = report["dense"]["overall"]
        ndcg = trained.get("ndcg@5")
        output["release_gates"] = {
            "recall@5": (trained.get("recall@5") or 0) >= 0.90,
            "ndcg@5": (ndcg or 0) >= 0.80,
            "multi_direct_complete": (trained.get("multi_direct_complete") or 0) >= 0.80,
            "false_answer_rate": (trained.get("false_answer_rate") if trained.get("false_answer_rate") is not None else 1) <= 0.10,
            "warm_p95": output["runtime"]["warm_p95_ms"] < 1000,
            "outperforms_pretrained": ndcg is not None and ndcg > max(
                cross["ndcg@5"] or 0, dense["ndcg@5"] or 0,
            ),
        }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
