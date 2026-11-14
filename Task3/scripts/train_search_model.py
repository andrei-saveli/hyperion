"""Fit a score combiner on training data and choose cutoffs on validation data."""

import argparse
import numpy as np
from scipy.optimize import minimize

from scripts.evaluate_search import collect, metrics, rank_cases, read_split, validate_splits
from search_model import DATA, MODEL_DIR, SearchEngine, ranking_scores, sha256, write_json


def fit_head(cases):
    features = np.concatenate([case[2] for case in cases])
    mean = features.mean(axis=0)
    scale = np.maximum(features.std(axis=0), 1e-6)
    designs, targets, differences = [], [], []
    for grades, keys, raw, _ in cases:
        normalized = (raw - mean) / scale
        ranks = np.array([grades.get(key, 0) for key in keys])
        designs.append(np.column_stack((normalized, np.ones(len(keys)))))
        targets.append(ranks >= 2)
        higher, lower = np.where(ranks[:, None] > ranks[None, :])
        differences.extend(normalized[higher] - normalized[lower])
    design = np.concatenate(designs)
    target = np.concatenate(targets)
    pairwise = np.asarray(differences)
    if not target.any() or target.all() or not len(pairwise):
        raise ValueError("Training needs both relevant and irrelevant pairs in the retrieved candidates")

    def loss(weights):
        margins = pairwise @ weights[:2]
        signed = (design @ weights) * (2 * target.astype(int) - 1)
        return (np.logaddexp(0, -margins).mean() + np.logaddexp(0, -signed).mean()
                + 0.01 * np.dot(weights[:2], weights[:2]))

    result = minimize(loss, np.zeros(3), method="BFGS")
    if not result.success:
        raise ValueError(f"Could not train the ranking head: {result.message}")
    weights = result.x[:2] / scale
    return np.r_[weights, result.x[2] - weights @ mean]


def calibrate(cases, mode, head):
    """Maximize validation nDCG under the unsupported-query false-answer limit."""
    scores = [ranking_scores(case[2], mode, head) for case in cases]
    query_maxima = np.array([values.max() for values in scores])
    maxima = np.unique(query_maxima)
    all_scores = np.concatenate(scores)
    # Query maxima give every distinct abstention decision. Quantiles keep the
    # result-cutoff sweep bounded when many training questions are available.
    inclusion = np.unique(np.quantile(all_scores, np.linspace(0, 1, 21)))
    answerable = np.array([any(grade >= 2 for grade in case[0].values()) for case in cases])
    if not answerable.any() or answerable.all():
        raise ValueError("Calibration needs supported and unsupported validation questions")
    # Grade 1 is context and should earn no credit when selecting what to show.
    selection_cases = [
        ({key: grade for key, grade in grades.items() if grade >= 2}, keys, features, tags)
        for grades, keys, features, tags in cases
    ]
    best = None
    best_policy = None
    for accept in np.r_[maxima, np.nextafter(maxima[-1], np.inf)]:
        if np.mean(query_maxima[~answerable] >= accept) > 0.10:
            continue
        for include in inclusion[inclusion <= accept]:
            for limit in range(1, 6):
                policy = {"accept": float(accept), "include": float(include), "limit": limit}
                summary = metrics(selection_cases, rank_cases(cases, mode, head, policy))
                key = (summary["ndcg@5"], summary["recall@5"],
                       -(summary["irrelevant_result_rate"] or 0), -limit)
                if best is None or key > best:
                    best, best_policy = key, policy
    return best_policy


def main():
    from datetime import datetime, timezone

    import torch

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--allow-draft", action="store_true", help="Build a provisional model from unreviewed labels")
    args = parser.parse_args()

    splits = {name: read_split(name) for name in ("train", "validation")}
    validate_splits(splits)
    engine = SearchEngine.load(uncalibrated=True)
    train = collect(engine, splits["train"], allow_draft=args.allow_draft)
    validation = collect(engine, splits["validation"], allow_draft=args.allow_draft)
    head = fit_head(train)
    calibration = {mode: calibrate(validation, mode, head) for mode in ("dense", "cross", "head")}
    head_path = MODEL_DIR / "ranking_head.pt"
    temporary = head_path.with_suffix(".pt.tmp")
    torch.save({"coefficients": torch.from_numpy(head)}, temporary)
    temporary.replace(head_path)
    engine.config["calibration"] = {
        **calibration,
        "draft": args.allow_draft,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "index_sha256": sha256(MODEL_DIR / "candidate_documents.json"),
        "retrieval_limit": engine.config["retrieval_limit"],
        "head_sha256": sha256(head_path),
        "split_sha256": {name: sha256(DATA / f"search_{name}.jsonl") for name in splits},
    }
    write_json(MODEL_DIR / "calibrated_config.json", engine.config)
    print("Saved the fitted head and validation calibration.")


if __name__ == "__main__":
    main()
