# Team Plan (4 people)

> Claude's earlier version, kept for comparison. The current plan is [TEAM_PLAN.md](TEAM_PLAN.md).

The team lead (Person 2) uses Claude Code; the other three don't need it.

How we split the work so four people can build in parallel without waiting on each other.

## The idea: split by layer, agree on the "handshakes" first

The app has four natural parts. Each person **owns one part**, and we agree up front on the exact
format of what passes between parts (the **contracts** below). Then nobody is blocked: the
frontend can be built against fake data while the real data and statistics are still being made.

```
 ┌──────────────┐  CSV files   ┌──────────────┐  JSON API   ┌──────────────┐
 │ 1. DATA      │ ───────────► │ 2. STATS +   │ ──────────► │ 3. FRONTEND  │
 │ get NASA data│              │    BACKEND   │             │ map, charts  │
 └──────────────┘              └──────────────┘             └──────────────┘
         ▲                                                          ▲
         └────────────── 4. STORY, SCIENCE & PITCH ─────────────────┘
          (picks demo cases, writes definitions, AI prompts, tests, presents)
```

## Roles

### 👤 Person 1: Data Detective (data acquisition)
*Good fit for: someone comfortable with websites/spreadsheets, some Python helps but isn't required.*

- Create a free **NASA Earthdata account** (https://urs.earthdata.nasa.gov) on day one.
- For each **demo case**, download real monthly time series (2000→present) using
  **Giovanni** ("Time Series, Area-Averaged") or **NASA POWER** (no login needed) and save them as
  CSV in the contract format below.
- Fill in `data/variables.yaml`: every variable we support, with source and dataset ID.
- Stretch: a `scripts/` downloader so *any* region can be fetched (NASA POWER API is the
  easiest; it is MERRA-2 based and has temperature, precipitation, soil wetness, humidity).
- **Done when:** all 5 demo cases (8 CSVs: Amazon has two variables, two cases are comparisons)
  are in `data/demo/` and load correctly.
- 📄 **Step-by-step instructions: [DATA_GUIDE_CLAUDE.md](DATA_GUIDE_CLAUDE.md).**

### 👤 Person 2: Team Lead + Statistics/Backend (works with Claude Code)
*This is the team lead, the only one with Claude Code. Claude writes most of the code; the lead
directs it, checks the results and keeps everyone's parts fitting together.*

- `backend/stats.py`: deseasonalize, linear trend + t-test + 95% CI, autocorrelation correction,
  Mann-Kendall + Sen's slope, "years until significant", verdict (🟢/🟡/⚪).
- Tests with **fake data where we know the answer** (e.g. a series rising exactly 1 unit/decade
  plus noise must give ~1/decade and 🟢).
- `backend/app.py` (FastAPI): endpoints in the API contract below.
- **Integration owner:** merges everyone's work, runs the full app, unblocks teammates.
- **Help desk for the team:** teammates send requests ("write me a chart component",
  "why does this CSV fail?") and the lead runs them through Claude Code.
- **Done when:** `/analyze` returns correct JSON for every demo CSV, tests pass, and the full
  app runs end to end.

### 👤 Person 3: Frontend Builder (website)
*Good fit for: whoever knows JavaScript/React best.*

- React + Vite site with: world map (Leaflet), variable picker, Plotly chart (raw / seasons
  removed toggle, trend line, confidence band), **verdict card**, **compare view**, glossary.
- Start immediately with the **mock JSON** in the API contract; switch to the real API later
  by changing one URL.
- **Done when:** a user can click a demo case and see chart + verdict, and compare two regions.
- If nobody on the team knows React well: build it in **Streamlit** (pure Python) instead. Less
  flashy, much faster. Decide in the kickoff, not later.

### 👤 Person 4: Science Storyteller & Pitch Lead
*Good fit for: best communicator; science background helps.*

- Write the **plain-language definition** for each variable (one sentence a 15-year-old understands).
- Research and script the **5 demo cases**: why should this trend exist, what's the cause, one
  news article or paper per case. These become the guided walkthrough text.
- Write the **AI prompts** (variable suggestions per region type, verdict explanations).
- Be the **tester**: try the app as a student would; report confusing bits.
- Own the **submission**: project page, slides, demo video, final presentation.
- **Done when:** walkthrough texts are in `data/cases.yaml`, pitch is rehearsed.

---

## Contracts (agree on these in the kickoff, then don't change them without telling everyone)

### A. Demo CSV: `data/demo/<case_id>.csv`
```csv
date,value
2001-01,0.312
2001-02,0.298
```
- `date` = `YYYY-MM`, one row per month, no gaps if possible (leave `value` empty if missing).
- `value` = regional (area-averaged) monthly value in the units listed in `variables.yaml`.

### B. Variable catalogue: `data/variables.yaml`
```yaml
- id: soil_moisture_root
  name: Root-zone soil moisture
  definition: How wet the soil is where plant roots grow (top ~1 m).
  units: "fraction (0 = dry, 1 = saturated)"
  source: GLDAS Noah (model)
  dataset: GLDAS_NOAH025_M_2.1
  category: water          # water | temperature | vegetation | air quality | atmosphere
  good_for: [desert, farmland, river basin]
```

### C. Demo cases: `data/cases.yaml`
```yaml
- id: lake_mead_soil
  title: Is Lake Mead drying up?
  variable: soil_moisture_root
  region: { name: Lake Mead basin, bbox: [-116, 35, -113, 37.5] }   # [W, S, E, N]
  csv: demo/lake_mead_soil.csv
  steps:                    # guided walkthrough text, one screen each
    - "Lake Mead supplies water to 25 million people..."
    - "Let's look at soil moisture around it since 2001..."
  compare_with: null        # or another case id
```

### D. API: `POST /analyze` → JSON
```json
{
  "variable": "soil_moisture_root",
  "region": "Lake Mead basin",
  "units": "fraction",
  "series":    { "dates": ["2001-01", "..."], "values": [0.31, "..."], "anomalies": [0.01, "..."] },
  "trend_line":{ "values": ["..."], "ci_low": ["..."], "ci_high": ["..."] },
  "stats": {
    "slope_per_decade": -0.012, "slope_ci95": [-0.018, -0.006],
    "total_change": -0.027, "percent_change": -8.7,
    "p_value_ttest": 0.003, "p_value_mk": 0.004, "sens_slope_per_decade": -0.011,
    "years_to_significance": null
  },
  "verdict": { "level": "significant", "emoji": "🟢", "text": "Significant decrease..." }
}
```
Other endpoints: `GET /variables`, `GET /cases`, `POST /compare` (two regions → two results),
`POST /suggest` (region type → suggested variables).
Person 2 commits a `docs/mock_analyze.json` in this exact shape in hour 1 so Person 3 can start.

---

## Timeline (Space Apps is a 48-hour hackathon; adjust if ours differs)

| When | Everyone | P1 Data | P2 Lead + Stats/API | P3 Frontend | P4 Story/Pitch |
|---|---|---|---|---|---|
| **0–2 h** Kickoff | Read README, agree contracts, React vs Streamlit, set up Git | Earthdata account | Mock JSON | Project skeleton | Pick final 5 demo cases |
| **2–16 h** Build | | Demo CSVs | Stats module + tests | Map, chart, verdict card on mock data | Definitions, case research |
| **16–28 h** Connect | Integration check-in | variables.yaml complete, start downloader | FastAPI endpoints | Connect to real API, compare view | Walkthrough texts, AI prompts |
| **28–40 h** Features | | Downloader for any region (stretch) | AI suggest/explain, years-to-significance | Demo walkthrough player, glossary, polish | Test as a student, slides |
| **40–48 h** Ship | **Feature freeze at 40 h.** Fix bugs only | Help test | Deploy | Final UI polish | Video, submission, rehearse |

**Check-ins:** 10-minute stand-up every ~6 hours: what I finished, what I'm doing next, what blocks me.

## Rules that keep a 4-person team fast
1. **Work in your own folder** (`data/`, `backend/`, `frontend/`, `docs/`) → almost no Git conflicts.
2. **Pull before you start, push small and often** (`git pull` then `git push` to `main`).
3. **Never break the demo.** If something works, commit it before trying the next thing.
4. **Contracts are sacred.** Changing a JSON field or CSV column? Tell the team first.
5. **Cut scope, not quality.** If short on time, drop in this order: any-region downloader →
   AI suggestions → glossary page. **Never drop:** demo cases, chart, verdict card, compare view.

## Minimum winning product (must work by hour 40)
- [ ] 5 demo cases with real NASA data
- [ ] Chart with trend line + confidence band + seasons-removed toggle
- [ ] Verdict card: rate per decade, total change, p-value, plain-language verdict
- [ ] Compare two regions side by side
- [ ] Guided walkthrough for at least one case
- [ ] Plain definitions for every variable
