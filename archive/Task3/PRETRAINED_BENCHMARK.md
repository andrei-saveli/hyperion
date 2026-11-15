# Searchlight pretrained comparison

The [draft question set](data/search_pretrained_questions.jsonl) has 144 phrasings of
48 distinct requests. Calibration and test each have 24 groups of three phrasings.
Each split contains 18 single-pair questions, 24 questions that ask for multiple
available pairs, 6 partially supported questions, and 24 unsupported questions.
The test contains distinct requests within the same three-region catalog.

Expected matches were checked against [Task2's source and coverage notes](../Task2/SOURCES.md)
and all 12 [cleaned series](../Task2/cleaned/). A label identifies a series that
can address a requested measurement in its documented area and period. For
partially supported requests, only the available measurements receive credit.
For example, the Sahel rainfall question points to the Niamey area, the historical
rain-plus-river-flow request points to Niamey rainfall alone, and the Lake Mead
surface-area question has an empty label. Svalbard soil moisture labels refer to
retrieval of the GLDAS series, which Task2 flags as unreliable for interpreting trends.

## Method

Both modes used the same local index and pinned checkpoints listed in the
[model card](models/search/MODEL_CARD.md). For each mode, the existing calibration
routine chose a query acceptance threshold, a result cutoff, and a result limit.
It maximized nDCG@5 on the calibration split under the existing 10% unsupported
false-answer ceiling. Both modes answered 2 of 24 unsupported calibration
questions. The selected policies were then applied to the test split without retuning.

From `Task3/`, using the environment with the models installed:

```powershell
python -m scripts.benchmark_pretrained > ../.venv/searchlight-pretrained.json
```

The JSON report includes the corpus and index digests, selected policies, metrics
by question type, and per-question test predictions. Prepare the checkpoints and
index using the model card. The benchmark needs only those artifacts.

## Held-out draft results

| Mode | Top-5 recall before filtering | Calibrated recall@5 | Unsupported answered | Supported with no results | All requested pairs found |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pretrained embeddings | 94.8% | 45.8% | 1/24 | 26/48 | 11/24 |
| Pretrained embeddings + reranker | 97.9% | 35.4% | 3/24 | 31/48 | 6/24 |

Recall@5 averages the share of requested series found per supported question.
The final column covers the 24 test questions that ask for multiple available
series. Before filtering, both modes always suggested five series, including for
all unsupported questions. After calibration, both modes confused Lake Mead
reservoir-only evaporation with evaporation for the surrounding region. The
reranker also offered combined precipitation for a snowfall-only request.

Embeddings are the stronger calibrated baseline on this draft. The reranker
placed relevant series higher before filtering, then its query cutoff rejected
more supported questions and admitted more unsupported ones. The benchmark uses
a fixed mix of question types, and the three phrasings of each request are
correlated. The measured rates describe this draft set.
An independently worded teammate or student check is pending. Use those fresh
questions to check the frozen policies before choosing a release configuration
or deciding whether a learned combiner improves on the pretrained baseline.
