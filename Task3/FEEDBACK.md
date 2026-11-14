# Feedback on Task 3 (Search + explainability)

Reviews by the team lead. Everything was tested against the real data (`Task2/`) and the trend
analysis (`Task4/`). Nothing in Task 3 was changed; tests ran on a separate copy.

Check your progress any time from the repository root:
```bash
python Task4/scripts/check_handshakes.py
```

---

## Round 2 (after commits 928dd8b → fe53114)

**Summary:** big step forward. The explanations and both teaching pages are now very good. The
one serious problem left: **search returns nothing unless the AI model is built by hand first.**

### ✅ Explanations (`explain.py`): excellent
Every point from round 1 is fixed. Tested on all 12 real results plus a too-short record:
- Headlines say what, where and how much:
  > *Evaporation in Niamey, Sahel (Niger) · Possible increase (+0.0477 mm/day per decade)*
- The details teach in plain words: what the 95% range and the p-value mean, and when the range
  includes zero.
- They use the extra fields: "about 2 more years of data could be enough… This is a planning
  estimate", the low-reliability caution, and the percent change.
- No cause claims and never "no change": checked across all 12 texts.

### ✅ Pages: both work
- `pages/1_Guided_demo.py`: 3 steps (Lake Mead temperature 🟢 → Niamey evaporation 🟡 →
  temperature in both places) with working Back/Next buttons.
- `pages/2_How_it_works.py`: clear explanation of the method.
- Both open without errors inside the combined project (`Task4/scripts/combine.py`).

### ✅ Also fixed
- `data/places.csv` and `data/variables.csv` now exist (good definitions and keywords).
- The NO₂ example questions are gone, so training runs again.
- Honest, careful benchmark reports (`PRETRAINED_BENCHMARK.md`, `COVERAGE_BENCHMARK.md`).
- The new `explore()` mode always offers a clearly labelled "Possible match".
- Your own tests pass (6 passed, 1 skipped).

### ❌ Search only works after a manual ~1 GB setup
Commit 1bcdd7a ("Restore model-only Searchlight") removed the keyword search, so:

| | Result |
|---|---|
| **As committed** (fresh checkout, deployed app) | `search()` returns `[]` for every question; the checker shows **4 ❌** |
| **After building the model** (`build_search_index --download-models`, then `train_search_model --allow-draft`; ~810 MB of libraries + 175 MB of models) | checker **ALL GOOD**: all 4 demo questions find the right place and measurement; "CO2" and "hello" correctly get nothing |

So the model works well **once built**, but anyone who runs the project fresh, including the
judges' demo, gets an empty search unless they repeat that setup. Your own benchmark also
shows the calibrated model finding the right answer only 45.8% of the time on held-out
questions.

**Note:** the public website (`Website/`, "ByteMe") is a static site and can't run a Python
model. Its search is simple keyword matching that uses **your keyword lists** from
`data/variables.csv` and `data/places.csv`, so your catalogue work reaches the site directly.

### What to do next (in order)
1. **Bring back the keyword search as a fallback.** Use the model when it's built and
   calibrated; otherwise fall back to keyword matching, so `search()` never returns `[]` just
   because the model files are missing. The checker's 4 demo questions are the minimum test.
2. **Say why a record is too short.** For ⚫ results, change *"This record has too little usable
   data"* to something like *"A trend needs at least 10 years of monthly data; this record is
   shorter."* (Users who pick a short period otherwise don't know what went wrong.)
3. **Round numbers to 2–3 significant digits**, to match the website:
   "+0.38 °C per decade" instead of "+0.376", "+0.08 to +0.68" instead of "+0.0771 to +0.675",
   "+8.1%" instead of "+8.13%".
4. **For the pitch:** present the model as research ("we trained and benchmarked a semantic
   search; here's what we learned"). Use the keyword search for the live demo.

---

## Round 1 status (original review)

| Round 1 item | Status |
|---|---|
| Specific explanation headline (place, variable, rate, units) | ✅ done |
| Teach the numbers in plain words | ✅ done |
| Use years-until-significant, percent change, reliability and test warnings | ✅ done |
| Guided demo page | ✅ done |
| "How it works" page | ✅ done |
| Own `places.csv` / `variables.csv` | ✅ done |
| Fix or remove the NO₂ example questions | ✅ done |
| Search answers the demo questions out of the box | ❌ only after building the model (see round 2, point 1) |
