# Task4: Trend & significance + integration (Person 4)

The math at the heart of the challenge: **seasons removed → straight-line trend → significance
test**, plus the tools that check everyone's parts fit together. At the end, everything in this
folder moves into the final project (see "Combining into the final project").

## What's here

| File | What it does |
|---|---|
| `stats.py` | `analyze(df, code=None)`: the trend analysis (handshake **H2**) |
| `tests/test_stats.py` | 34 tests on fake data with known answers (all pass) |
| `scripts/results_table.py` | Runs `analyze()` for every place × variable → `results.csv` |
| `scripts/check_handshakes.py` | Automatic sync checklist: checks H0–H4 across everyone's parts |
| `RESULTS.md` | **Results on the real Giovanni data + suggested demo cases** |
| `requirements.txt` | numpy, pandas, scipy, pytest |

The scripts read the real data through the Data person's `data_io.py` (in `../Task2/` now, in the
project root after combining).

## Run it (from the repository root)
```bash
pip install -r Task4/requirements.txt
```
```bash
python -m pytest -q Task4
```
```bash
python Task4/scripts/results_table.py
```
```bash
python Task4/scripts/check_handshakes.py
```

## How the analysis works (pitch-ready, plain words)

1. **Missing months are skipped**, never treated as zero.
2. **Remove the seasons.** Every January minus the average January, every February minus the
   average February, and so on. What's left (the *anomalies*) shows the long-term drift without
   the summer–winter swing.
3. **Straight line through the anomalies.** Its slope is the **change per decade**; slope × record
   length is the **total change**. For rainfall, soil moisture and evaporation we also give the
   **percent change** (not for °C, where 0 doesn't mean "none"). As the challenge suggests, we
   stick to **linear** trends, and we tell users a straight line is a simplification.
4. **How sure are we?** A **95% interval** (the range where the true rate most likely lies) and a
   **t-test p-value** (the chance of seeing a trend this strong if there were really none).
5. **Honest correction for "memory".** A warm month is usually followed by another warm month,
   so 288 months contain fewer than 288 independent pieces of information. We measure this
   (*lag-1 autocorrelation*), compute the **effective number of months**, and widen the interval
   accordingly (Santer et al., 2000).
6. **Second opinion: seasonal Mann-Kendall** (the test named in the challenge). It compares
   Januaries with Januaries, Februaries with Februaries, and so on, so the seasons can't fake a
   trend, and it doesn't assume a bell curve. Corrected for year-to-year memory. **Seasonal Sen's
   slope** gives a robust rate that ignores outliers. Checked against the reference library
   `pymannkendall`: identical results on all 12 real files.
7. **Verdict:** 🟢 significant (p < 0.05) · 🟡 possible (p < 0.10) · ⚪ no clear trend ·
   ⚫ not enough data (under 10 years or 24 months). A ⚪ result never means "no change"; it can
   mean the record is still too short.
8. **Honesty flags** shown on the card:
   - **Reliability "low"** when the record is worth fewer than 30 independent months (e.g. slow
     soil moisture).
   - **Tests disagree** when one test says significant and the other isn't even close, or they
     point in opposite directions.
   - **What the band means:** the 95% range of the trend line, *not* the range of monthly values.
9. **Years until significant** (🟡/⚪ only): if the trend and the noise stay as they are, about how
   many more years of data until the trend reaches significance:
   `total years = record years × (1.96 / |t|)^(2/3)`. Uses the same t-value as the p-value, so they
   never contradict each other. A **planning estimate, not a forecast**.

### Proof it works (from the tests)
- A series built with **+0.5 per decade** comes back as ≈ +0.5, with the true value inside the 95% interval.
- On series with **no trend**, we call "significant" **≈ 5%** of the time, exactly as a 95% test should.
- On no-trend series **with month-to-month memory**, a naive method (no correction) cries
  "significant" **44%** of the time; ours stays at **≈ 6%**. This is why the correction matters.
- Seasons-only data gives a perfectly flat line after removing the seasons; the seasonal
  Mann-Kendall ignores the seasons too.
- Missing months, late starts, unsorted rows, short records (< 10 years) and values below zero are handled.

### Results on the real data
See **[RESULTS.md](RESULTS.md)**: 4 🟢, 1 🟡, 7 ⚪; the two tests agree on all 12.

## The result dictionary (H2)
All keys from `docs/HANDSHAKES.md` H2, plus extra keys (adding is allowed, renaming isn't):

| Extra key | Meaning |
|---|---|
| `sen_slope_per_decade` | seasonal Sen's robust slope |
| `lag1_autocorrelation` | month-to-month memory (0 = none, 1 = total) |
| `effective_n` | how many independent months the record is worth |
| `reliability`, `reliability_note` | `"good"` / `"low"` + plain note when low |
| `tests_agree`, `tests_note` | `True` / `False` + plain note when they disagree |
| `percent_change` | change over the record in % (rain, soil moisture, evaporation only; needs `code=`) |
| `band_meaning` | one sentence explaining the shaded band |

`years_to_significance` = additional years beyond the current record (float or None).

## Combining into the final project
1. Copy `stats.py`, `tests/`, `scripts/results_table.py`, `scripts/check_handshakes.py` to the
   project root (same relative paths).
2. Take `data_io.py` and the data from `Task2/` (cleaned files go into `data/`).
3. Merge `requirements.txt` with the other parts (add streamlit, plotly).
4. Run `python -m pytest -q` and `python scripts/check_handshakes.py`; both must pass.
