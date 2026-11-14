# Searchlight coverage experiment

Tested whether checking the requested place, measurement, date range, and
resolution against the Task2 catalog could improve the calibrated embedding
baseline. The experimental parser uses region and measurement phrases, checks
explicit years against the indexed series, and screens for some unsupported
measurements and resolutions. It examines parts of a question separately so
an unavailable measurement can coexist with a supported one. Embedding scores
order the surviving series.

The earlier [144-question draft](data/search_pretrained_questions.jsonl) was
development material. The [fresh draft test](data/search_coverage_test.jsonl)
contains 48 questions in 24 groups, with two phrasings per group. It includes
30 supported questions, including six that are partially supported, and 18
unsupported questions. Labels use [Task2's documentation](../Task2/SOURCES.md)
and the verified index of the 12 cleaned series. The questions and labels are
agent-authored. They do not estimate how real users phrase requests.

The baseline reused its original calibration policy. Development selected the
fallback by sweeping a fixed grid of minimum scores and gaps to the runner-up,
with the prior benchmark's 10% false-answer ceiling. It selected a minimum
score of 0.30 and a gap of 0, so it effectively tested a single suggestion
with a score cutoff. The fresh run loaded the frozen development policies and
checked the code, development corpus and index digests before scoring.

## Fresh draft results

| Mode | Recall@5 | Unsupported answered | Supported with no results | All requested pairs found | Irrelevant suggestions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Embeddings with original cutoffs | 20.0% | 2/18 | 24/30 | 4/12 | 63.3% |
| Embeddings with coverage check | 86.7% | 6/18 | 3/30 | 11/12 | 16.3% |
| Coverage check with one fallback suggestion | 90.0% | 10/18 | 1/30 | 11/12 | 23.6% |

Recall@5 averages per-question recall across supported requests. The
all-pairs column covers questions with multiple available series. Irrelevant
suggestions are the share of all returned suggestions outside the expected labels.

Coverage checks blocked out-of-range dates and out-of-catalog regions in this
test. They also returned the available series for all six partial requests.
However, the parser read wind chill and sea-surface temperature as near-surface
air temperature, and missed an indirect request for hourly rainfall. The
fallback recovered one additional relevant match and answered four additional
unsupported questions. Both candidates exceeded the false-answer ceiling on
this test, so the experiment remains separate from app search.

## Reproduce

From `Task3/`, with the pinned checkpoints and index prepared as described in
the [model card](models/search/MODEL_CARD.md):

```powershell
$env:OMP_NUM_THREADS = '4'
$env:MKL_NUM_THREADS = '4'
python -m scripts.benchmark_coverage > ../.venv/searchlight-coverage-development.json
python -m scripts.benchmark_coverage --test ../.venv/searchlight-coverage-development.json > ../.venv/searchlight-coverage-test.json
```

The report includes development and test metrics, per-question predictions,
the frozen policies and dataset digests.
