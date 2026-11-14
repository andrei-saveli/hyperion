# Hyperion: The Simple Plan

**This is the plan we follow.** Interfaces between roles: [HANDSHAKES.md](HANDSHAKES.md).
Rules for AI coding agents: [AGENTS.md](../AGENTS.md).

## What we build (one sentence)
A website where a student picks a **place** and a **variable** (temperature, rain, soil wetness,
humidity), sees the monthly NASA data since 2001, and gets a plain answer: **is it going up or
down, by how much, and is that change significant?**

> ⚠️ **Scope rule (from the challenge brief, keep in mind always):** Trend analysis with Earth
> science data can be complex. Trends can be non-linear, and some are not evident unless regular
> cycles, such as the seasonal cycle, are removed. More complex trend analyses are beyond the scope
> envisioned for this challenge; detecting and analyzing linear trends would be a great start.
>
> **So we:** always remove the seasonal cycle first, then fit a **linear** trend and test its
> significance. No forecasting models, no non-linear/complex methods in the core. We tell users
> plainly that a straight line is a simplification.

## Why it's simple
- **One language: Python.** No JavaScript. AI writes Python very well.
- **One tool for the website: [Streamlit](https://streamlit.io).** A full web app in one Python
  file. Free hosting on Streamlit Community Cloud.
- **One data source: [NASA POWER](https://power.larc.nasa.gov).** NASA data (from the MERRA-2
  model and satellites), **no login**, simple web address returns monthly numbers.
  ✅ Tested: temperature `T2M` (°C), rain `PRECTOTCORR` (mm/day), soil wetness `GWETROOT`
  (0–1), humidity `RH2M` (%) all work.
- **Data saved as CSV files** in the repo, so the demo works even if NASA's site is down.

## The finished app (4 screens in one page)
1. **Search & pick**: type a question or place type (*"is the desert drying?"*, *"Arctic"*) →
   the app suggests places and variables. Or pick a demo case. Each variable has a one-line
   plain definition.
2. **Chart**: monthly values 2001→now, a toggle "remove seasons", and the trend line with a
   shaded 95% band.
3. **Verdict card**:
   🟢 *Significant increase/decrease* · 🟡 *Possible trend, not significant yet* · ⚪ *No clear trend*
   + rate per decade, total change, p-value, one sentence in plain words, and a "what does this
   mean?" explanation.
4. **Compare**: two places side by side, same variable.

**Rule:** we say *what* changed, never claim *why* it changed (a trend line can't prove a cause).

## The 4 roles

| # | Role | In one line |
|---|---|---|
| **1** | 🖥️ **Frontend** | The website: screens, chart, verdict card, compare, map |
| **2** | 🛰️ **Data** | Get NASA data, clean it, keep track of sources |
| **3** | 🔎 **Search + explainability** | Help users find what to look at, and explain every result in plain words |
| **4** | 📈 **Trend & significance + integration** | The math (seasons removed → linear trend → significance test) and connecting all parts |

The team lead uses an AI coding agent to help anyone who's stuck and to handle Git.

## How we work in parallel

All 4 people start at **hour 0** and never wait for each other. Three tricks make that possible:

1. **Agree on everything shared in the 30-minute kickoff**: file formats and function names
   (below). After that, nobody needs anyone else's work to start.
2. **The first 3 places are already chosen** (below). Person 2 can download immediately; more
   places get added later without blocking anyone.
3. **Use fake stand-ins until the real thing arrives.** E.g. Person 1 builds the website with a
   fake stats function; when Person 4's real one is ready, it's a one-line swap.

Each person owns **different files**, so Git conflicts are rare.

### Starting places (fixed now, Person 3 adds more later; full format in HANDSHAKES.md H0)
```csv
id,name,lat,lon,type,story
lake_mead,Lake Mead (USA),36.1,-114.7,desert,Is the desert around Lake Mead drying out?
niamey,"Niamey, Sahel (Niger)",13.5,2.1,savanna,Is the Sahel getting more or less rain?
svalbard,Svalbard (Arctic),78.2,15.6,polar,Is the Arctic warming?
```

### Shared building blocks: see [HANDSHAKES.md](HANDSHAKES.md)
The exact shapes of everything passed between people, with **copy-paste fakes** so you can start
before the real part exists. Read your section at the kickoff.

| # | Handshake | Giver → Receivers |
|---|---|---|
| H0 | `data/places.csv`, `data/variables.csv` | P3 → everyone |
| H1 | Series CSVs + `data_io.py` (`load_places`, `load_variables`, `load_series`) | P2 → everyone |
| H2 | `stats.py` `analyze(df)` → result dict | P4 → P1, P3 |
| H3 | `explain.py` `explain(result, variable, place)` → headline, details, caveat | P3 → P1 |
| H4 | `search.py` `search(text)` → up to 5 suggestions | P3 → P1 |
| H5 | `charts.py` `trend_chart(df, result, remove_seasons)` → chart | P1 → P3 |
| H6 | The whole app runs from a clean install | everyone → P4 |

## Tasks per person

| Block | 🖥️ P1 Frontend | 🛰️ P2 Data | 🔎 P3 Search + explain | 📈 P4 Trend + integration |
|---|---|---|---|---|
| **0–0.5 h** | 🤝 Kickoff together: read this plan, agree on the building blocks, install Python + Streamlit | ← | ← | ← |
| **0.5–8 h** | `app.py` + `charts.py` on **fake** data and fake `analyze()`: pickers, chart, seasons toggle, verdict card | Download script, data for the 3 starting places, `data_io.py` | `variables.csv` (definitions + keywords); `explain.py` v1 (sentence templates); research 5 more places | `stats.py` v1: remove seasons, linear trend, 95% interval, t-test, verdict; tests on fake data |
| **🔗 Hour 8** | **Sync 1:** everyone pushes; P4 swaps real data + stats + explanations into the app | | | |
| **8–20 h** | Search box, compare tab, map of places, clean phone-friendly layout | Download P3's new places; check every file; `SOURCES.md` | `search.py` (keywords + place types → suggestions); "How it works" page | Correct the interval for month-to-month correlation; Mann-Kendall; results table of all places |
| **🔗 Hour 20** | **Sync 2:** full app works with all places; deploy online; team picks 2 demo cases from the results table | | | |
| **20–30 h** | Polish; live map click with P2 *(extra)* | `fetch_point()` for live data anywhere *(extra)* | Guided demo page with the 2 demo stories; start user testing | "Years until significant" *(extra)*; fix bugs; deploy |
| **🔗 Hour 30** | **Sync 3:** everything works; P3 shares user-test findings | | | |
| **30–36 h** | Fix UI issues from testing | Fix data issues | Improve wording from testing; smarter search *(extra)* | Final bug fixes and deploy |
| **36–48 h** | 🎤 **Pitch together** + bug fixes only | ← | ← | ← |

Extras are marked *(extra)*. Skip them if the block's main work isn't done.

### 🖥️ Person 1: Frontend
**Start with:** a fake data file, fake `analyze()` and fake `explain()` you make yourself (starter
prompt below). You need nothing from anyone.
- [ ] `app.py`: choose place + variable (with definition), chart, "remove seasons" toggle
- [ ] Verdict card: big emoji, rate per decade, total change, p-value, explanation text
- [ ] `charts.py` `trend_chart()` (the guided demo page reuses it) → push by hour 8
- [ ] Search box at the top (calls P3's `search()`), results as clickable suggestions
- [ ] Compare tab: two places side by side; map showing the places
- [ ] Clean look, works on a phone
- [ ] *(extra)* click on the map → live data (uses P2's `fetch_point`)

### 🛰️ Person 2: Data (retrieval + cleaning)
📄 **Full guide (Giovanni bulk download + cleaning): [PERSON_2_DATA_GIOVANNI_HANDOVER.md](PERSON_2_DATA_GIOVANNI_HANDOVER.md).**
**Start with:** the starter prompt below. You need nothing from anyone.
- [ ] `scripts/download.py`: NASA POWER monthly data for every place in `data/places.csv`
- [ ] Cleaning: skip month "13" (yearly average), turn -999 into empty (missing), one row per
      month, oldest first, never fill gaps with 0
- [ ] Data for the 3 starting places → push by hour 4
- [ ] `data_io.py` with the 3 load functions → push by hour 6
- [ ] Download P3's extra places as soon as they're in `places.csv`
- [ ] Check every file (plot it, count empty months); `data/SOURCES.md` with exact web addresses
- [ ] *(extra)* `fetch_point(lat, lon, code)` for live downloads

### 🔎 Person 3: Search + explainability
**Start with:** the starter prompt below. You need nothing from anyone.
- [ ] `data/variables.csv`: plain definition + search keywords for each variable → push by hour 4
- [ ] 5 more places (with a `type`: desert, polar, city, forest, coast…) + 2 compare pairs in
      `data/places.csv` → push by hour 6
- [ ] `explain.py` `explain(result, variable, place)`: headline (*"Svalbard's air got warmer by
      0.65 °C per decade, a significant increase"*) + "what does this mean?" (what the p-value
      and the band say, that a straight line is a simplification, and that it doesn't show *why*)
- [ ] `search.py` `search(text)`: match words in the question to variable keywords and place
      names/types → suggestions with a reason (simple word matching is enough; no AI needed)
- [ ] `pages/2_How_it_works.py`: trend, seasons, p-value, "significant", for a 15-year-old
- [ ] `pages/1_Guided_demo.py`: step-by-step walkthrough (Next/Back) of the 2 demo cases
- [ ] User testing with 2–3 people outside the team (hour ~28) → fix list for everyone

### 📈 Person 4: Trend & significance + integration
**Start with:** fake data with a known trend, made by code. You need nothing from anyone.
- [ ] `stats.py` `analyze(df)` v1 → push by hour 6:
  1. remove seasons (subtract each calendar month's average)
  2. **linear** trend → change per decade and total change
  3. 95% interval + t-test p-value
  4. verdict: 🟢 p < 0.05 · 🟡 p < 0.10 · ⚪ otherwise
- [ ] Tests: fake data with a known slope gives that slope back; no trend → mostly ⚪; missing
      months don't crash
- [ ] Correct the interval/p-value for month-to-month correlation (neighbouring months are
      similar, which otherwise makes trends look too certain); add Mann-Kendall as a second test
- [ ] Results table: every place × variable → the team picks demo cases from it
- [ ] Integration: connect everyone's parts at each sync, deploy to Streamlit Cloud
- [ ] *(extra)* "Years until significant", labelled as an estimate, not a forecast

## Starter prompts (paste into any chat AI: ChatGPT, Gemini, Claude…)

**Person 1 (Frontend):**
> I'm a beginner. Build a Streamlit app `app.py` plus `charts.py`. Data comes from `data_io.py`
> functions `load_places()`, `load_variables()`, `load_series(place_id, code)` (columns date,
> value). Until those exist, make a fake CSV and fake versions of them. Also fake
> `analyze(df)` that returns a dict with keys slope_per_decade, ci_low, ci_high, p_value,
> total_change, verdict, emoji, trend, band_low, band_high (trend and bands are lists, one value
> per month), and fake `explain(result, variable, place)` returning a short text. In `charts.py`
> write `trend_chart(df, result, remove_seasons)` returning a Plotly figure: the monthly data
> line, and if remove_seasons is true subtract each calendar month's average and draw the trend
> line with a shaded band. App: sidebar to choose place and variable (show its definition), the
> chart, a "Remove seasons" toggle, and a verdict card with a big emoji and the explanation.
> Add a "Compare" tab with two places side by side. Explain step by step how to install and run it.

**Person 2 (Data):**
> I'm a beginner. Write a Python script `scripts/download.py` that reads `data/places.csv`
> (columns id,name,lat,lon,type,story) and, for each place, downloads monthly data from the NASA
> POWER API (`https://power.larc.nasa.gov/api/temporal/monthly/point`, community=AG, start=2001,
> end=2024, parameters T2M,PRECTOTCORR,GWETROOT,RH2M, format=JSON). Skip month "13" (annual
> average). Treat -999 as missing (empty). Save one CSV per place and variable as
> `data/<id>_<code>.csv` with columns `date,value` and dates like 2001-01-01. Also write
> `data_io.py` with `load_places()`, `load_variables()` and `load_series(place_id, code)` that
> return pandas DataFrames (`date` parsed as dates). Explain step by step how to run it.

**Person 3 (Search + explainability):**
> We're building a student tool that tests whether NASA climate data (temperature, rainfall, soil
> wetness, humidity from NASA POWER, 2001–2024) shows a linear trend at a place. We have Lake Mead
> (USA, desert), Niamey (Sahel) and Svalbard (Arctic). Suggest 5 more places of different types
> (city, forest, coast, mountain…) where one of these variables may show a trend, with lat/lon
> and one sentence on why, plus 2 interesting pairs to compare. For each variable write a plain
> one-sentence definition for a 15-year-old and 8 search keywords. Then write a Python function
> `explain(result, variable, place)` that turns a dict (slope_per_decade, ci_low, ci_high,
> p_value, verdict = significant/possible/none) into a plain headline plus a short "what does
> this mean?" paragraph. It must never say what *caused* the trend, must not call a non-significant
> result "no change", and should mention that a straight line is a simplification.

Later:
> I'm a beginner. Write `search.py` with `search(text)` that reads `data/places.csv` (with a
> `type` column) and `data/variables.csv` (with a `keywords` column) and returns a list of
> (place_id, variable_code, reason) suggestions by matching words. Then build a Streamlit page
> `pages/1_Guided_demo.py` that walks a student through one example with "Next"/"Back" buttons.

**Person 4 (Trend & significance):** use the lead's AI coding agent, or paste this prompt:
> Write `stats.py` with `analyze(df)` for a monthly series (columns date, value; empty = missing).
> Steps: remove seasons by subtracting each calendar month's mean; fit a linear trend; report
> slope per decade, 95% interval and t-test p-value, corrected for lag-1 autocorrelation using
> the effective sample size; add a Mann-Kendall p-value; verdict significant/possible/none at
> p<0.05/p<0.10. Return trend line and 95% band as lists. Include pytest tests with fake data.

## 🎤 Pitch (whole team, from hour 36)
- **Story (all together, 1 h):** problem → our tool → live demo of 1 case → compare → why it
  matters for students.
- **Slides:** max 7. Each person makes the slide about their own part (website, data,
  search/explanations, trend math).
- **3-minute video:** screen recording of the guided demo + voice-over. Record a backup of the
  live demo in case the internet fails.
- **Rehearse 3 times**, timed. Each person presents ~30–45 s about their part.
- **Submit early**, then check every link works from a phone.

## Pick demo places with real data, not guesses
At sync 2 (hour 20), P4's results table shows the stats for every place. **Keep the 2 most interesting
results for the demo stories** (one significant, one not yet significant is a great pair: it
teaches what "significant" means).

## If we have extra time (in this order)
1. "Years until significant": for weak trends, estimate how many more years of data are needed.
2. Click anywhere on a map → download that point live from NASA POWER.
3. Smarter search (e.g. AI that understands free-text questions, still only suggesting from our list).
4. More variables (NASA POWER has many more: wind, sunshine, frost days…).

## Golden rules
1. **Push small, push often** (`git pull` → work → `git push`). Ask the lead if Git breaks.
2. **Never break what works.** Save/commit before trying something new.
3. **If stuck for 30 minutes, ask the team.** Don't suffer alone.
4. **Finish the basic app before any extra feature.**
