# Hyperion: The Simple Plan

**This is the plan we follow.** The other docs (`TEAM_PLAN*.md`, `DATA_GUIDE*.md`) are background
reading only.

## What we build (one sentence)
A website where a student picks a **place** and a **variable** (temperature, rain, soil wetness,
humidity), sees the monthly NASA data since 2001, and gets a plain answer: **is it going up or
down, by how much, and is that change significant?**

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
1. **Pick** a demo case or a place (dropdown or map click) + a variable. Each variable has a
   one-line plain definition.
2. **Chart**: monthly values 2001→now, a toggle "remove seasons", and the trend line with a
   shaded 95% band.
3. **Verdict card**:
   🟢 *Significant increase/decrease* · 🟡 *Possible trend, not significant yet* · ⚪ *No clear trend*
   + rate per decade, total change, p-value, and one sentence in plain words.
4. **Compare**: two places side by side, same variable.

**Rule:** we say *what* changed, never claim *why* it changed (a trend line can't prove a cause).

## How we work in parallel

All 4 people start at **hour 0** and never wait for each other. Three tricks make that possible:

1. **Agree on everything shared in the 30-minute kickoff**: file formats and function names
   (below). After that, nobody needs anyone else's work to start.
2. **The first 3 places are already chosen** (below). Person 1 can download immediately; more
   places get added later without blocking anyone.
3. **Use fake stand-ins until the real thing arrives.** E.g. Person 3 builds the app with a fake
   stats function; when Person 2's real one is ready, it's a one-line swap.

Each person owns **different files**, so Git conflicts are rare.

### Starting places (fixed now, Person 4 adds more later)
```csv
id,name,lat,lon,story
lake_mead,Lake Mead (USA),36.1,-114.7,Is the desert around Lake Mead drying out?
niamey,"Niamey, Sahel (Niger)",13.5,2.1,Is the Sahel getting more or less rain?
svalbard,Svalbard (Arctic),78.2,15.6,Is the Arctic warming?
```

### Shared building blocks (agree at kickoff, then don't change)

| File | Owner | Function | Gives back |
|---|---|---|---|
| `data_io.py` | P1 | `load_places()` · `load_variables()` · `load_series(place_id, code)` | tables (`load_series` → columns `date`, `value`) |
| `stats.py` | P2 | `analyze(df, units, name)` | dict: `slope_per_decade`, `ci_low`, `ci_high`, `p_value`, `total_change`, `verdict`, `emoji`, `sentence`, `trend`, `band_low`, `band_high` |
| `charts.py` | P3 | `trend_chart(df, result, remove_seasons)` | a Plotly chart |
| `pages/` | P4 | Streamlit pages that use the 3 above | — |

### Data files
- `data/<place>_<variable>.csv` with columns `date,value` (e.g. `2001-01-01,6.49`; empty = missing)
- `data/places.csv`: `id,name,lat,lon,story`
- `data/variables.csv`: `code,name,units,definition` for `T2M`, `PRECTOTCORR`, `GWETROOT`, `RH2M`

## Tasks per person

| Block | 👤 P1 Data | 👤 P2 Stats + glue (lead) | 👤 P3 App | 👤 P4 Guide & content |
|---|---|---|---|---|
| **0–0.5 h** | 🤝 Kickoff together: read this plan, agree on the building blocks, install Python + Streamlit | ← | ← | ← |
| **0.5–8 h** | Download script, data for the 3 starting places, `data_io.py` | `stats.py` v1 (trend, p-value, verdict), tests | `app.py` + `charts.py` with a **fake** `analyze()`: place/variable pickers, chart, verdict card | `variables.csv` definitions; research 5 more places + 2 compare pairs |
| **🔗 Hour 8** | **Sync 1:** push everything; P2 swaps the real stats + data into the app | | | |
| **8–20 h** | Download P4's new places; check every file; `SOURCES.md` | Correct the 95% band for month-to-month correlation, add Mann-Kendall; results table of all places | Compare tab, map of places, nicer layout, phone-friendly | Guided demo page, "How it works" page |
| **🔗 Hour 20** | **Sync 2:** full app works with all places; deploy online; team picks 2 demo cases from the results table | | | |
| **20–30 h** | `fetch_point()` for live data at any map click (extra) | "Years until significant" (extra); fix bugs; Git help | Live map click (with P1); polish | Write the 2 demo stories into the guided page; start user testing |
| **🔗 Hour 30** | **Sync 3:** everything works; P4 shares user-test findings | | | |
| **30–36 h** | Fix data issues from testing | Fix bugs, final deploy | Fix UI issues from testing | "What should I look at?" helper (extra); re-test |
| **36–48 h** | 🎤 **Pitch together** + bug fixes only | ← | ← | ← |

Extras are marked *(extra)*. Skip them if the block's main work isn't done.

### 👤 Person 1: Data
**Start with:** the starter prompt below. You need nothing from anyone.
- [ ] `scripts/download.py`: downloads NASA POWER monthly data for every place in `data/places.csv`
- [ ] Data for the 3 starting places → push by hour 4
- [ ] `data_io.py` with the 3 load functions → push by hour 6
- [ ] Download P4's extra places as soon as they're in `places.csv`
- [ ] Check every file (plot it, count empty months); `data/SOURCES.md` with exact web addresses
- [ ] *(extra)* `fetch_point(lat, lon, code)` for live downloads

### 👤 Person 2: Stats + glue (team lead, with Claude Code)
**Start with:** fake data with a known trend (made by code). You need nothing from anyone.
- [ ] `stats.py` `analyze()` v1: remove seasons, trend per decade, 95% interval, p-value, verdict + sentence → push by hour 6
- [ ] Tests on fake data with a known answer
- [ ] Hour 8: connect real data + stats into P3's app
- [ ] Correct for month-to-month correlation; Mann-Kendall
- [ ] Results table of every place × variable (used to pick demo cases)
- [ ] Deploy to Streamlit Cloud; Git help for everyone
- [ ] *(extra)* "Years until significant"

### 👤 Person 3: App
**Start with:** a fake `analyze()` and a fake CSV you make yourself (starter prompt below).
- [ ] `app.py`: sidebar place + variable with definition; chart; "remove seasons" toggle; verdict card
- [ ] `charts.py` `trend_chart()` (P4's pages reuse it) → push by hour 8
- [ ] Compare tab: two places side by side
- [ ] Map showing the places
- [ ] Clean look, works on a phone
- [ ] *(extra)* click on the map → live data (uses P1's `fetch_point`)

### 👤 Person 4: Guide & content
**Start with:** the starter prompt below. You need nothing from anyone until hour 8.
- [ ] `data/variables.csv`: plain definitions → push by hour 4
- [ ] 5 more places + 2 compare pairs added to `data/places.csv` → push by hour 6
- [ ] `pages/2_How_it_works.py`: trend, p-value, "significant", explained for a 15-year-old
- [ ] `pages/1_Guided_demo.py`: step-by-step walkthrough (Next/Back buttons); fill in the 2 demo cases after hour 20
- [ ] User testing with 2–3 people outside the team (hour ~28) → fix list for everyone
- [ ] *(extra)* "What should I look at?" helper: place type → suggested variables

## Starter prompts (paste into ChatGPT / Gemini / Claude)

**Person 1:**
> I'm a beginner. Write a Python script `scripts/download.py` that reads `data/places.csv`
> (columns id,name,lat,lon,story) and, for each place, downloads monthly data from the NASA POWER
> API (`https://power.larc.nasa.gov/api/temporal/monthly/point`, community=AG, start=2001,
> end=2024, parameters T2M,PRECTOTCORR,GWETROOT,RH2M, format=JSON). Skip month "13" (annual
> average). Treat -999 as missing (empty). Save one CSV per place and variable as
> `data/<id>_<code>.csv` with columns `date,value` and dates like 2001-01-01. Also write
> `data_io.py` with `load_places()`, `load_variables()` and `load_series(place_id, code)` that
> return pandas DataFrames (`date` parsed as dates). Explain step by step how to run it.

**Person 2:** works with Claude Code.

**Person 3:**
> I'm a beginner. Build a Streamlit app `app.py` plus `charts.py`. Data comes from
> `data_io.py` functions `load_places()`, `load_variables()`, `load_series(place_id, code)`
> (columns date, value). Until those exist, make a fake CSV and fake versions of them. Also fake
> `analyze(df, units, name)` that returns a dict with keys slope_per_decade, ci_low, ci_high,
> p_value, total_change, verdict, emoji, sentence, trend, band_low, band_high (trend and bands are
> lists, one value per month). In `charts.py` write `trend_chart(df, result, remove_seasons)`
> returning a Plotly figure: monthly data line, and if remove_seasons is true subtract each
> calendar month's average and draw the trend line with a shaded band. App: sidebar to choose
> place and variable (show its definition), the chart, a "Remove seasons" toggle, and a verdict
> card with a big emoji. Add a "Compare" tab with two places side by side. Explain step by step
> how to install and run it.

**Person 4:**
> We're building a student tool that tests whether NASA climate data (temperature, rainfall, soil
> wetness, humidity from NASA POWER, 2001–2024) shows a trend at a place. We already have Lake
> Mead (USA), Niamey (Sahel) and Svalbard (Arctic). Suggest 5 more places where one of these
> variables is likely to show a clear trend, with lat/lon and one sentence on why, plus 2 pairs
> of places that are interesting to compare. Write a plain one-sentence definition of each
> variable for a 15-year-old. Then explain what a trend, a p-value and "statistically
> significant" mean for a 15-year-old.

Later:
> I'm a beginner. In my Streamlit app, build a page `pages/1_Guided_demo.py` that walks a student
> step by step through one example with "Next"/"Back" buttons, text and a chart on each step.
> Explain how to build and run it.

## 🎤 Pitch (whole team, from hour 36)
- **Story (all together, 1 h):** problem → our tool → live demo of 1 case → compare → why it
  matters for students.
- **Slides:** max 7. Each person makes the slide about their own part.
- **3-minute video:** screen recording of the guided demo + voice-over. Record a backup of the
  live demo in case the internet fails.
- **Rehearse 3 times**, timed. Each person presents ~30–45 s about their part.
- **Submit early**, then check every link works from a phone.

## Pick demo places with real data, not guesses
At sync 2 (hour 20), P2's results table shows the stats for every place. **Keep the 2 most interesting
results for the demo stories** (one significant, one not yet significant is a great pair: it
teaches what "significant" means).

## If we have extra time (in this order)
1. "Years until significant": for weak trends, estimate how many more years of data are needed.
2. Click anywhere on a map → download that point live from NASA POWER.
3. Suggestions: pick a place type (desert, city, forest…) → recommended variables.
4. More variables (NASA POWER has many more: wind, sunshine, frost days…).

## Golden rules
1. **Push small, push often** (`git pull` → work → `git push`). Ask the lead if Git breaks.
2. **Never break what works.** Save/commit before trying something new.
3. **If stuck for 30 minutes, ask the team.** Don't suffer alone.
4. **Finish the basic app before any extra feature.**
