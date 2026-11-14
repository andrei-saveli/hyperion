# Task4: Trend & significance + integration (Person 4)

The math at the heart of the challenge: **seasons removed → straight-line trend → significance
test**, plus the tools that check everyone's parts fit together. At the end, everything in this
folder moves into the final project (see "Combining into the final project").

## What's here

| File | What it does | Status |
|---|---|---|
| `stats.py` | `analyze(df)`: the trend analysis (handshake **H2**) | ✅ done, tested |
| `tests/test_stats.py` | 19 tests on fake data with known answers | ✅ all pass |
| `scripts/results_table.py` | Runs `analyze()` for every place × variable → `results.csv` (to pick demo cases) | ✅ |
| `scripts/check_handshakes.py` | Automatic checkpoint checklist: checks H0–H4 across everyone's parts | ✅ |
| `data_io.py` | **FAKE** stand-in for the Data person's file, so this folder runs alone | replace later |
| `requirements.txt` | numpy, pandas, scipy, pytest | ✅ |

## Run it
```bash
pip install -r requirements.txt
```
```bash
python -m pytest -q
```
```bash
python scripts/results_table.py
```
```bash
python scripts/check_handshakes.py
```

## How the analysis works (pitch-ready, plain words)

1. **Missing months are skipped**, never treated as zero.
2. **Remove the seasons.** Every January minus the average January, every February minus the
   average February, and so on. What's left (the *anomalies*) shows the long-term drift without
   the summer–winter swing.
3. **Straight line through the anomalies.** Its slope is the **change per decade**; slope × record
   length is the **total change**. As the challenge suggests, we stick to **linear** trends, and
   we tell users a straight line is a simplification.
4. **How sure are we?** A **95% interval** (the range where the true rate most likely lies) and a
   **t-test p-value** (the chance of seeing a trend this strong if there were really none).
5. **Honest correction for "memory".** A warm month is usually followed by another warm month,
   so 288 months contain fewer than 288 independent pieces of information. We measure this
   (*lag-1 autocorrelation*), compute the **effective number of months**, and widen the interval
   accordingly (Santer et al., 2000).
6. **Second opinions.** The **Mann-Kendall test** (does it keep going up or down, without
   assuming a bell curve?) with the same correction, and **Sen's slope** (a rate that ignores
   outliers).
7. **Verdict:** 🟢 significant (p < 0.05) · 🟡 possible (p < 0.10) · ⚪ no clear trend ·
   ⚫ not enough data (fewer than 24 months). A ⚪ result never means "no change"; it can mean
   the record is still too short.
8. **Years until significant** (for 🟡/⚪ only). The challenge notes that sometimes all a trend
   needs is a longer record. We estimate how many more years of data would likely be needed,
   using the standard formula of Weatherhead et al. (1998), which accounts for how noisy and how
   "sticky" the data is. It assumes the trend and noise stay the same, so it's a **planning
   estimate, not a forecast**. Hidden when it makes no sense (direction unclear, record shorter
   than 10 years, or more than 100 years needed).

### Proof it works (from the tests)
- A series built with **+0.5 per decade** comes back as ≈ +0.5, with the true value inside the 95% interval.
- On series with **no trend**, we call "significant" **≈ 5%** of the time, exactly as a 95% test should.
- On no-trend series **with month-to-month memory**, a naive method (no correction) cries
  "significant" **44%** of the time; ours stays at **≈ 6%**. This is why the correction matters.
- Seasons-only data gives a perfectly flat line after removing the seasons.
- Missing months, late starts (e.g. NO₂ from 2004), unsorted rows and too-short records are handled.
- "Years until significant" grows with noisier data and stronger month-to-month memory, and is
  hidden for already-significant or meaningless cases.

### First look at real NASA data (NASA POWER sample, 2001–2024)
| Place | Variable | Verdict | Change per decade | 95% interval |
|---|---|---|---|---|
| Lake Mead | Air temperature | 🟢 significant | +0.45 °C | +0.16 to +0.75 |
| Svalbard | Air temperature | 🟢 significant | +0.65 °C | +0.11 to +1.19 |
| Niamey (Sahel) | Rainfall | 🟢 significant | +0.18 mm/day | +0.03 to +0.34 |
| Niamey (Sahel) | Air temperature | ⚪ no clear trend (≈36 more years) | −0.11 °C | −0.36 to +0.15 |
| Svalbard | Humidity | ⚪ no clear trend (≈15 more years) | −0.29 % | −0.66 to +0.07 |
| Lake Mead | Soil wetness | ⚪ no clear trend | −0.002 | −0.014 to +0.009 |

The final demo data comes from the Data person (Giovanni); these numbers will change.

## The result dictionary (H2)
`years_to_significance` = additional years beyond the current record (float or None).
All keys from `docs/HANDSHAKES.md` H2, plus three extra keys (adding is allowed, renaming isn't):
- `sen_slope_per_decade`: Sen's robust slope
- `lag1_autocorrelation`: month-to-month memory (0 = none, 1 = total)
- `effective_n`: how many independent months the record is worth

## Combining into the final project
1. Copy `stats.py`, `tests/`, `scripts/results_table.py`, `scripts/check_handshakes.py` to the
   project root (same relative paths).
2. **Don't copy the fake `data_io.py`**: the Data person's real one replaces it.
3. Merge `requirements.txt` with the other parts (add streamlit, plotly).
4. Run `python -m pytest -q` and `python scripts/check_handshakes.py`; both must pass.

## Next (Person 4)
- [ ] At sync 1: swap real data in, run `check_handshakes.py`
- [ ] Results table on real data → team picks demo cases (sync 2)
- [ ] Deploy to Streamlit Community Cloud
- [x] *(extra)* "years until significant" estimate
