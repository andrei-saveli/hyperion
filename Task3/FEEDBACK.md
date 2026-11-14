# Feedback on Task 3 (Search + explainability)

Review by the team lead, based on testing everything in this folder against the real data from
`Task2/` and the trend analysis from `Task4/`. Nothing in Task 3 was changed.

**Summary:** `explain.py` works and is safe. **Search doesn't work yet** (it returns nothing for every
question), and three deliverables are missing. Priorities are at the bottom.

You can check your progress any time with the automatic checker (from the repository root):
```bash
python Task4/scripts/check_handshakes.py
```
Task 3 is done when it prints **ALL GOOD** (right now it shows 4 ❌, all for search).

---

## ✅ `explain.py` (H3): works and is safe

Tested on all 12 real results plus edge cases (not enough data, missing numbers, empty input):
no crashes, and it follows our rules:
- never claims a cause ("Identifying the cause requires a separate investigation")
- never says "no change" (⚪ becomes "No clear trend… leaves the direction uncertain")
- says a straight line is a summary

Example (🟢 Lake Mead, air temperature):
> **Clear increase**: The best estimate for air temperature in Lake Mead (USA) points upward.
> The trend test shows clear evidence of this direction over the analysis period.

### What to improve
1. **The headline is vague on its own.** "Clear increase" doesn't say *what*, *where* or *how much*.
   Handshake H3's example is:
   > *"Svalbard's air got warmer: +0.65 °C per decade, a significant increase."*

   This matters most in the compare tab, where two cards sit side by side. Use `place["name"]`,
   `variable["name"]`, `variable["units"]` and `result["slope_per_decade"]` (round to 2–3 significant
   digits; it can be `None`).
2. **"Details" should teach.** H3 asks it to explain what the rate, the shaded band and the p-value
   mean *for this result*. Right now it has no numbers and uses jargon ("rate interval", "analysis
   period") that a 15-year-old won't follow. For example:
   > *"Over 2001–2024 the air warmed by about 0.38 °C every 10 years (0.9 °C in total). The true
   > rate is most likely between 0.08 and 0.68 °C per decade. A p-value of 0.014 means a trend this
   > strong would be very unlikely if nothing were really changing."*
3. **Use the helpful extra fields from `analyze()`** (all can be `None`; see H2 in
   `docs/HANDSHAKES.md`):
   - `years_to_significance` (🟡/⚪): *"If nothing changes, about 2 more years of data would make
     this trend significant."* This is the challenge's own point that "sometimes all a trend needs
     is a longer record". Say it's an estimate, not a forecast.
   - `percent_change`: *"−9.3% since 2001"* (only rainfall, soil moisture, evaporation)
   - `reliability` / `reliability_note`: when `"low"`, add the caution (affects both soil-moisture
     files outside Niamey)
   - `tests_agree` / `tests_note`: when `False`, add the caution
4. **All 7 ⚪ results get the same sentence**, so the text adds little beyond the emoji. Including the
   numbers (point 2) and the years estimate (point 3) fixes this.

---

## ❌ Search (H4): not working yet

**What happens now:** `search()` returns `[]` for every question, because the model is never built
or calibrated (that output isn't saved in Git). The checker shows:
```
❌ H4 search('is the desert drying out') → [] (expected lake_mead:SOILM)
❌ H4 search('Is Lake Mead getting hotter?') → [] (expected lake_mead:TEMP)
❌ H4 search('Is the Arctic getting warmer?') → [] (expected svalbard:TEMP)
❌ H4 search('does the Sahel get more rain') → [] (expected niamey:RAIN)
```

**What I found when I built the full model in a sandbox** (index, training, calibration):
- It **builds fine** on our 12 real files (18 s), but **training is blocked**:
  - all 20 example questions have `"reviewed": false`, and the pipeline refuses to run until they're reviewed
  - 2 questions still point to **NO₂, which was dropped** (`search_train.jsonl` line 5,
    `search_validation.jsonl` line 6), which stops training with "Invalid or unavailable relevance label"
  - after removing those labels, `air_pollution_01` is marked "supported" but has no answer left
- After working around those in the sandbox, the trained model **got some questions right**
  ("Is Lake Mead getting hotter?", "rain in Niamey", "evaporation in the Sahel") and correctly
  refused nonsense ("CO2", "hello"), **but missed our key demo questions**
  ("is the desert drying out", "Is the Arctic getting warmer?", "temperature").
- On its own test set it **failed 5 of its 6 quality targets** (found the right answer 54% of the
  time, target 90%; wrongly answered 50% of questions it should refuse, target ≤ 10%).
  The cause: far too few examples (8 training, 6 validation, 6 test).
- **It's very heavy for our app:** ~810 MB of AI libraries + 175 MB of models, ~660 MB of memory,
  5 s to start. That's a real risk for free hosting and for teammates installing it.
- **It's fragile:** it stores fingerprints of every data file, so if the Data person changes or adds
  a file, search silently returns nothing until someone rebuilds and recalibrates.

**Good parts to keep:** it never crashes (it falls back to `[]`), refuses unrelated questions, the
output format matches H4 exactly, the reasons are useful, and it's fast once loaded (~0.1 s).

### Recommended fix
Make **simple keyword matching** the main `search()`, as planned in `docs/PLAN.md`, and keep the AI
model as an optional upgrade:
- match words in the question against `variables.csv` `keywords`/`name` and `places.csv`
  `name`/`type`/`story` (e.g. "desert" → place type desert; "dry", "drying" → soil moisture)
- score, sort, return at most 5 with a short reason; nonsense → `[]`
- only if the AI model is built and calibrated, use it instead (or merge both)

This needs no extra libraries, always answers the demo questions, and keeps working when data files
change. The checker's 4 demo questions are a good minimum test.

---

## ❌ Missing deliverables

| Deliverable | Why it matters |
|---|---|
| `pages/1_Guided_demo.py`: step-by-step walkthrough (Next/Back) | The challenge asks for "demonstration examples users can watch". Judges will use it |
| `pages/2_How_it_works.py`: trend, seasons, p-value, "significant" for a 15-year-old | Our audience is students; this is the teaching part |
| `data/places.csv`, `data/variables.csv` (you own these, H0) | Right now the built-in starting list from `Task2/data_io.py` is used instead (it works). Add your own if you want better definitions/keywords or more places |

For the guided demo, use the suggested demo cases in [`Task4/RESULTS.md`](../Task4/RESULTS.md)
(Lake Mead temperature 🟢, Niamey evaporation 🟡 "≈2 more years", Lake Mead vs Niamey temperature).
Reuse the frontend's `trend_chart()` (H5) for the charts; don't copy chart code.

---

## Priorities

1. **Make search answer the demo questions** (keyword matching as the main version).
2. **Guided demo page**: the most visible part for the judges.
3. **Specific explanation headline + "≈ X more years"** in `explain.py`.
4. **"How it works" page.**
5. **Fix or remove the 2 NO₂ example questions** (only needed if you keep the AI model).

Done = `python Task4/scripts/check_handshakes.py` prints **ALL GOOD**, and both pages open in the app.
