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

## Who does what

| Person | Job | Delivers |
|---|---|---|
| **1. Data** | Download NASA POWER data for each demo place | `data/*.csv` + `data/places.csv` |
| **2. Stats (lead, Claude Code)** | Trend math + glue everything together | `stats.py`, final `app.py`, deploy |
| **3. App** | Build the Streamlit website | `app.py` (screens, chart, verdict card) |
| **4. Story** | Definitions, demo stories, testing, pitch | `data/variables.csv`, slides, 3-min video |

Everyone uses AI. Each person has a **starter prompt** below: paste it into ChatGPT / Gemini /
Claude, then follow its instructions.

## Shared formats (don't change without telling the team)

`data/<place>_<variable>.csv`, e.g. `data/lake_mead_T2M.csv`:
```csv
date,value
2001-01-01,6.49
2001-02-01,8.27
```

`data/places.csv`:
```csv
id,name,lat,lon,story
lake_mead,Lake Mead (USA),36.1,-114.7,Is the desert around Lake Mead drying out?
```

`data/variables.csv`:
```csv
code,name,units,definition
T2M,Air temperature,°C,How warm the air is 2 m above the ground.
PRECTOTCORR,Rainfall,mm/day,Average amount of rain and snow per day.
GWETROOT,Soil wetness,0-1,How wet the soil is where plant roots grow (0 = dry, 1 = soaked).
RH2M,Humidity,%,How much water vapour is in the air compared to the maximum it can hold.
```

## Starter prompts

**Person 1 (Data):**
> Write a Python script `scripts/download.py` that reads `data/places.csv` (columns id,name,lat,lon,story)
> and, for each place, downloads monthly data from the NASA POWER API
> (`https://power.larc.nasa.gov/api/temporal/monthly/point`, community=AG, start=2001, end=2024,
> parameters T2M,PRECTOTCORR,GWETROOT,RH2M, format=JSON). Skip month "13" (annual average).
> Treat -999 as missing (empty). Save one CSV per place and variable as `data/<id>_<code>.csv`
> with columns `date,value` and dates like 2001-01-01. Explain how to run it step by step for a
> beginner.

**Person 2 (Stats):** Claude Code builds `stats.py` with tests: remove seasons, trend per decade,
95% band corrected for month-to-month correlation, Mann-Kendall p-value, verdict + plain sentence.

**Person 3 (App):**
> I'm a beginner. Build a Streamlit app `app.py`. It reads `data/places.csv`, `data/variables.csv`
> and `data/<place>_<variable>.csv` (columns date,value). Sidebar: choose place and variable;
> show the variable's definition. Main area: a Plotly line chart of the monthly data with a
> checkbox "Remove seasons" (subtract each calendar month's average). For now, fake the trend
> result with a function `analyze(df)` that returns a dict with keys slope_per_decade, ci_low,
> ci_high, p_value, verdict, sentence (we'll replace it later). Show a verdict card with a big
> emoji (🟢🟡⚪). Add a "Compare" tab showing two places side by side. Explain how to install and
> run it step by step.

**Person 4 (Story):**
> We're building a student tool that tests if NASA climate data (temperature, rainfall, soil
> wetness, humidity from NASA POWER, 2001–2024) shows a trend in a place. Suggest 6 places where
> one of these variables is likely to show a clear trend, with lat/lon and one sentence on why,
> plus 2 pairs of places that are interesting to compare. Then write a plain one-sentence
> definition of each variable for a 15-year-old.

## Timeline (48 h)

| When | Goal | Check |
|---|---|---|
| **Hour 0–2** | Everyone reads this file, installs Python + Streamlit, runs "hello world" | All 4 laptops run `streamlit hello` |
| **Hour 2–8** | P4 picks places → P1 downloads data → P3 builds app on fake stats → P2 builds stats | First CSV in repo; app shows a chart |
| **Hour 8–20** | Connect real stats to the app | **Full app works on 1 place** |
| **Hour 20–30** | All places, compare tab, definitions, 2 demo stories | **Everything works.** Deploy online |
| **Hour 30–40** | Test with 2–3 people who aren't on the team; fix confusing parts | Feature freeze at hour 40 |
| **Hour 40–48** | Slides, 3-min video, submit early | Submitted 2+ hours before deadline |

Check-in every 6 hours (10 min): *done / next / stuck*.

## Pick demo places with real data, not guesses
After P1 downloads the data, P2 runs the stats on every place. **Keep the 2 most interesting
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
