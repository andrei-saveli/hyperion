# Searchlight model card

**Status** · Searchlight powers H4. A provisional build can be generated from the draft
question splits. Human review, release evaluation, and deployment benchmarking are pending.

Searchlight helps English-speaking students find runnable Hyperion investigations. A CPU bi-encoder compares a question with the precomputed investigation embeddings. A cross-encoder reranks one batch of up to 20 candidates. A small linear ranking head learns how to combine the two scores. Validation selects the query abstention threshold, the result cutoff, and the maximum result count for each mode. H4 returns up to five suggestions with a reason drawn from H0 metadata.

| Model | Pinned revision | License | SHA-256 of `model.safetensors` |
| --- | --- | --- | --- |
| [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/tree/1110a243fdf4706b3f48f1d95db1a4f5529b4d41) | `1110a243fdf4706b3f48f1d95db1a4f5529b4d41` | Apache-2.0 | `53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db` |
| [cross-encoder/ms-marco-MiniLM-L6-v2](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2/tree/233902d25c440f23af6f7d6e94d2946bac0bee0a) | `233902d25c440f23af6f7d6e94d2946bac0bee0a` | Apache-2.0 | `821d1aa69520101d6e0737f78a042ae25b19e5cb9160701909d10434f4aeb0ae` |

## Prepare the launch index

Person 4's requested dependency pin is `sentence-transformers==5.1.2`. The shared dependency list belongs to P4. Searchlight also uses Hyperion's existing NumPy and SciPy. Run the commands below from `Task3/` with Python 3.11 or later and the pinned dependency installed.

```sh
python -m scripts.build_search_index --download-models
```

The download flag provisions the two public checkpoints locally and verifies the weight hashes.
Omit it when the checkpoints are already present. In the Task folders, the index reads the H0
catalogs from `Task3/data/` and the H1 series from `Task2/cleaned/`. In the combined app, both are
in `data/`. Rebuild and recalibrate after changing the catalog or an indexed series, and restart
the app after replacing the artifacts. The combine script copies the local model directory.

To run the existing draft labels locally, use `python -m scripts.train_search_model --allow-draft`
after building the index. This produces a provisional calibration. Evaluation with
`--allow-draft` reports metrics without certifying release gates.

## Review, train, and evaluate

The three JSONL files in `data/` are draft v0 with 8 training, 6 validation, and 6 test examples. Each row records its scientific concept, base question, query, answerability, and graded relevance. Keep paraphrases and concepts within a split. Svalbard's direct labels are held out of training and validation. Grades 3 and 2 mean direct and useful supporting relevance. Grade 1 is context, and grade 0 is irrelevant. Unlisted runnable pairs are treated as grade 0. Review every label against the launch index, extend the set with questions from outside the team, then mark the reviewed rows and record the test file's SHA-256. Use the frozen test set for the final comparison.

```sh
python -m scripts.evaluate_search --baseline --dense-only
python -m scripts.evaluate_search --baseline
python -m scripts.train_search_model
python -m scripts.evaluate_search --split test --test-sha256 <reviewed-test-sha256>
```

Training reads the training and validation questions. The head learns pairwise ordering and relevance from the training split. Validation calibrates both pretrained modes and the trained head under the same 10% unsupported false-answer limit. The final comparison reports ranking, multi-result retrieval, abstention, and CPU performance for the frozen modes. Run it on the deployment CPU. The test release gates require Recall@5 of at least 90%, nDCG@5 of at least 0.80, full direct-measurement retrieval on at least 80% of multi-direct questions, at most 10% false answers on unsupported questions, warm p95 below one second, and improved nDCG@5 over both frozen pretrained modes.

Training writes the date, index and ranker checksums, question split hashes, and learned thresholds
to `calibrated_config.json`. Keep it with both index artifacts, the ranking head, and the provisioned
checkpoint directory when assembling the app. Git tracks the pinned source `config.json`.

## Runtime behavior and limitations

- H4 loads Searchlight on the first query after the artifacts are built. A reranker failure
  falls back to the same model pipeline's independently calibrated dense retrieval.
- Ranking scores express relevance and have no probability or scientific-confidence interpretation. A question may have several useful investigations. An omitted investigation may still be scientifically relevant.
- Search covers measured place-variable combinations in the executable index. Unsupported questions can still produce false matches or ambiguous abstentions. Partial answers contain only available measurements.
- The initial index uses H0 descriptions and H1 coverage. Observed trend direction, evidence-strength queries, and opposite-trend queries require existing H2 result metadata and additional reviewed examples. Searchlight makes no causal or statistical conclusions.
- Release quality and CPU latency have yet to be measured with the launch catalog and the reviewed questions.
