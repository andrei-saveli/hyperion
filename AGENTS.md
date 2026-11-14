# AGENTS.md: Project Hyperion

Shared instructions for **any AI coding agent** (Claude Code, Codex, Gemini CLI, Copilot, Cursor…)
and for humans joining the project. Read this first, then `docs/PLAN.md` and `docs/HANDSHAKES.md`.

Hackathon project (NASA Space Apps). Goal: **win: make it very good, the best.** Keep this file up to
date when decisions change.

---

## Challenge: Be An Earth System Trend Detective!

### Summary
Change is always occurring in Earth's interconnected environmental system. When it runs in a
consistent direction (rising/falling, increasing/decreasing, thickening/thinning), measured
variables reflect it. But the same variable can trend one way in one region and the opposite
way in another, even when the same process drives both. The sheer number of Earth science
variables makes it hard to pick ones that could indicate change and then analyze them.

**Build a tool that can:**
1. **Select** variables measured by Earth science missions or produced by Earth science models.
2. **Visualize** how they change over time.
3. **Determine** *what* is changing, *where*, *how much*, and whether the change is
   statistically **significant**.

### Background
- Satellite instruments observe land, atmosphere, and ocean. Global models assimilate satellite
  and other data to analyze the Earth system.
- Trends indicate both the processes causing change and the processes that will respond to it.
- Two complications: (a) the huge variety of variables, (b) opposite-sign trends in different
  regions from the same process.
- Two parts to the problem:
  - **Finding variables that are trending** — from simple (temperature, rainfall) to complex
    (evaporation, streamflow).
  - **Analyzing trends in particular regions** — land, ocean, or levels of the atmosphere.
- Key instruments: **MODIS**, **OMI** (Ozone Monitoring Instrument), **AIRS** (Atmospheric
  Infrared Sounder), **GPM** (Global Precipitation Measurement).
- Key models: **MERRA-2** (Modern-Era Retrospective analysis for Research and Applications v2),
  **GLDAS** (Global Land Data Assimilation System).

### Objectives (all four = full scope)
1. **Identify variables** of interest that can be investigated for potential trends.
2. **Acquire data** for a particular region (most trends are regional, some are global).
3. **Generate and visualize a time series** for the variable + region over a period long enough
   for statistical analysis.
4. **Basic statistical analysis**: rate of change over time + significance test
   (t-test on regression slope, **Mann-Kendall**, confidence intervals).

> A response that does **both visualization and analysis** meets the full scope.

### Potential Considerations (optional, but judges will notice)

**Audience**
- High school & college students, plus science-literate members of the public.
- Provide **simple definitions of variables**.
- Concept: users become **data detectives** — find variables, determine whether they trend, and
  whether the trend is significant.

**Approach**
- A short **series of questions** (what / where to investigate) → search related variables.
- Provide **a couple of demonstration examples** users can watch to learn the tool.
- AI could help identify data likely to show trends in an area, drawing on news articles,
  research papers, or region characteristics (desert, rain forest, tidal estuary, atmosphere
  above a large city).

**Working with the data**
- Temporal resolutions: hourly, 3-hourly, daily, monthly. **Daily and monthly are easiest.**
- A non-significant trend is still interesting — sometimes it just needs a longer record.
- Consider public hydrology plotting tools, e.g. **CUAHSI**.
- Trends can be non-linear; some only appear after removing **seasonal cycles**.
  More complex analysis is out of scope — **linear trends are a great start**.

---

## Resources

> NASA does not endorse non-U.S. Government entities. Comply with each non-U.S. site's data-use terms.

### NASA data & tools
| Resource | What it offers |
|---|---|
| [Giovanni](https://giovanni.gsfc.nasa.gov/) | Menus of many variables; generates time series; downloads time-series data. |
| [Hydrology Time Series](https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series) | Time series of hydrological data (GLDAS, NLDAS, etc.). |
| [AppEEARS](https://appeears.earthdatacloud.nasa.gov/) | Access/transform geospatial data from federal archives; time-series generation. |
| [Climate Data Online (NOAA CDO)](https://www.ncei.noaa.gov/cdo-web/) | Global historical weather/climate station data + mapping tool. |
| [SeaWiFS chlorophyll time-series paper](https://ntrs.nasa.gov/api/citations/20090042747/downloads/20090042747.pdf) | Research example of time-series creation + significance testing. |

### Space agency partner resources
| Resource | What it offers |
|---|---|
| [KNMI Climate Explorer](https://climexp.knmi.nl/) | Web tool to explore, analyze, visualize climate data from many sources. |
| [Statistical test methods for trends (Medium)](https://medium.com/%40snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b) | Overview of trend tests. |
| [Guide to statistical significance (Statsig)](https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance) | Significance-testing primer. |

### CSA (Canadian Space Agency)
| Resource | What it offers |
|---|---|
| [RADARSAT Constellation Mission data](https://donnees-data.asc-csa.gc.ca/en/dataset/rcm) | SAR imagery: maritime (ice, wind, oil, ships), disasters, ecosystems (agriculture, wetlands, forestry, coastal change). |
| Geo.ca | Canada's open geospatial data. |
| [SWOT mission](https://www.asc-csa.gc.ca/eng/satellites/swot/) | Water surface elevation for lakes, rivers, reservoirs, oceans (NASA/CNES/CSA/UKSA). |
| [Monitoring ecosystems from space](https://www.asc-csa.gc.ca/eng/satellites/everyday-lives/monitoring-and-protecting-our-ecosystems-from-space.asp) | How satellite data supports land/resource monitoring. |
| [SAR Python tutorial](https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial) | Working with SAR imagery in Python and QGIS. |

---

## Statistics cheat sheet (reference for implementation)
- **Linear regression (OLS)** slope = rate of change; **t-test** on slope → p-value; 95% CI on slope.
- **Mann-Kendall**: non-parametric monotonic trend test (no normality assumption).
  **Seasonal Mann-Kendall** for monthly data with a seasonal cycle.
- **Sen's slope**: robust median-of-pairwise-slopes rate estimate (pairs well with Mann-Kendall).
- **Deseasonalize** monthly data: subtract each calendar month's climatological mean (anomalies).
- **Autocorrelation** inflates significance → consider pre-whitening / effective sample size.
- Report: slope per decade, total change over the record, % change, p-value, CI, plain-language verdict.

---

## Working agreement (for every agent and human)
- **Commit and push directly to `main`** without asking for confirmation. `git pull` before you
  start and before you push; push small changes often.
- Make sensible decisions on open choices, record them in this file, and keep going.
- **Team of 4, each owns their files** (see Roles). The team lead drives an AI coding agent and
  helps every role (code, reviews, fixes, Git); teammates use chat AIs with the starter prompts in
  `docs/PLAN.md`.
- `docs/PLAN.md` is the **authoritative plan** (roles, tasks, timeline). The team has minimal
  coding skills: keep code simple, commented, beginner-readable.
- `docs/HANDSHAKES.md` (H0–H6) freezes the interfaces between roles. **Respect them**; changing one
  needs the team's agreement first.
- Don't edit another role's files unless the lead asks. Don't add new dependencies without adding
  them to `requirements.txt` (owned by P4).
- Commit messages: short, imperative, describe the change. No AI tool or model names in code,
  comments or docs.

## Project decisions

> ⚠️ **Scope rule (from the challenge brief, keep in mind always):** Trend analysis with Earth
> science data can be complex. Trends can be non-linear, and some are not evident unless regular
> cycles, such as the seasonal cycle, are removed. More complex trend analyses are beyond the scope
> envisioned for this challenge; detecting and analyzing linear trends would be a great start.
>
> **So we:** always remove the seasonal cycle first, then fit a **linear** trend and test its
> significance. No forecasting models, no non-linear/complex methods in the core. We tell users
> plainly that a straight line is a simplification.


### Concept: "Trend Detective" (see `docs/PLAN.md`)
Search or pick a place + variable → monthly NASA data since 2001 → chart (seasons-removable) with
trend line and 95% band → verdict card (🟢 significant / 🟡 possible, not significant yet /
⚪ no clear trend / ⚫ not enough data; rate per decade, total change, p-value, plain explanation)
→ compare two places. Say *what* changed, never claim *why*. Demo cases are chosen from real results, not assumed.

### Stack (simplified for a beginner team)
- **Everything in Python.** Website: **Streamlit** (`app.py`), charts: Plotly.
- Stats: `stats.py`, our own code on **numpy + scipy only** (no statsmodels/pymannkendall;
  the seasonal Mann-Kendall was checked against pymannkendall and matches exactly).
- Data: **NASA Giovanni** area-averaged monthly time series over a box per place (harmony-py +
  earthaccess, free Earthdata account). Variables: `TEMP` (MERRA-2 `M2IMNXASM_5_12_4_T2M`, °C),
  `RAIN` (GPM `GPM_3IMERGM_07_precipitation`, mm/day), `SOILM` (GLDAS RootMoist, kg/m²), `EVAP`
  (GLDAS Evap, mm/day). NO₂ dropped (not in Giovanni's web interface). Raw files kept in
  `data/raw/giovanni/`, cleaned to `data/<place>_<CODE>.csv`. Fallback: NASA POWER (no login).
- Deploy: Streamlit Community Cloud. AI only for optional wording, never for numbers.

### Roles (details in `docs/PLAN.md`)
P1 Frontend (`app.py`, `charts.py`) · P2 Data (`scripts/download_giovanni.py`, `scripts/convert_giovanni.py`, `data_io.py`, `data/raw/`,
`data/<place>_<CODE>.csv`, `data/SOURCES.md`) ·

P3 Search + explainability (`search.py`, `explain.py`, `data/places.csv`, `data/variables.csv`,
`pages/`) ·
P4 Trend & significance + integration (`stats.py`, `tests/`, deploy). Pitch is a whole-team task
from hour 36. No forecasting in the core (see scope rule).

### Repo layout
```
AGENTS.md                      this file (instructions for all agents + humans)
README.md                      project overview for visitors and judges
docs/PLAN.md                   the plan: roles, tasks, timeline, starter prompts
docs/HANDSHAKES.md             frozen interfaces between roles (H0–H6) with fakes
app.py, charts.py              Streamlit app + shared chart (P1)
scripts/*_giovanni.py, data_io.py  download, cleaning, loading (P2)
search.py, explain.py, pages/  search, plain-language text, guided demo (P3)
stats.py, tests/, requirements.txt  trend + significance math, integration (P4)
data/                          places.csv, variables.csv, <place>_<code>.csv, SOURCES.md
```

### Statistics (stats.py)
Skip missing values (never zero). Deseasonalize (subtract each calendar month's mean). OLS slope
per decade; 95% CI and t-test p-value corrected for lag-1 autocorrelation (effective n,
Santer et al. 2000). Seasonal Mann-Kendall + seasonal Sen's slope (year-to-year memory
correction) as second checks. Verdict: 🟢 p<0.05 · 🟡 p<0.10 · ⚪ otherwise · ⚫ under 10 years
or 24 valid months. Flags: `reliability` (low if < 30 effective months), `tests_agree`,
`band_meaning`. `percent_change` only for RAIN/SOILM/EVAP and never-negative data.
"Years until significant" = record × (1.96/|t|)^(2/3) − record; labelled planning estimate.
Non-significant ≠ "no change". Never state causes.

## Current status / handover (update this when you finish something)
- ✅ Planning done: `docs/PLAN.md`, `docs/HANDSHAKES.md`.
- ✅ Handshake change applied: places are **boxes** (`west,south,east,north`), variables use **short
  codes** (`TEMP`, `RAIN`, `SOILM`, `EVAP`) with a `source` column (Giovanni name).
- ✅ Giovanni bulk-download variables verified in Giovanni's configured-variables list.
- 🖥️ The frontend (P1) is built in a separate repo, `andrei-saveli/frontend-nasa`, against the
  fakes in `docs/HANDSHAKES.md`; its brief is that repo's `AGENTS.md`. Keep its copies of
  `PLAN.md`/`HANDSHAKES.md` in sync when these change.
- ✅ **Person 4 (Trend & significance + integration)** in `Task4/`: `stats.py` (H2 + reliability,
  test-agreement, percent change, band meaning, years until significant), 34 passing tests,
  `scripts/results_table.py`, `scripts/check_handshakes.py` (use the real `Task2/data_io.py`),
  `RESULTS.md` (real-data results + demo suggestions). See `Task4/README.md`.
- 🧩 **Combine:** `python Task4/scripts/combine.py [--frontend ../frontend-nasa]` builds `final/`
  (git-ignored), runs tests + handshake checks, prints READY / NOT READY. Deploy steps:
  `Task4/README.md`.
- ✅ **Data (Task2/)**: `cleaned/` holds 12 validated Giovanni CSVs (3 places × TEMP/RAIN/SOILM/EVAP,
  288 months); `raw/` holds the 12 original Giovanni downloads (verified: re-cleaning
  reproduces `cleaned/` exactly, `convert_giovanni.py`); `data_io.py` (H1, reads
  `data/` in the final project, `cleaned/` now); `SOURCES.md`. NO₂ dropped. Don't use
  `svalbard_SOILM` in the demo (glacier; unreliable).
- 🧩 Each person builds in their own folder; at the end the team lead combines all folders into
  the final project layout below (each folder's README says how).
- 🖥️ **Website first version** in `FrontEnd_claude/` (built for P1 on the real Task2/3/4 parts):
  `app.py`, `charts.py` (H5), theme, 6 passing app tests, mock-ups + screenshots in `design/`.
  Run: `streamlit run FrontEnd_claude/app.py`. Combine with `--frontend FrontEnd_claude`.
- 🔎 **Search (P3)** uses Searchlight and the H0 catalogs in `Task3/data/` (three regions
  with available series). Build and calibrate the local assets using `Task3/README.md`.
- 💬 **Explanations and teaching pages (P3)** are in `Task3/explain.py` and `Task3/pages/`.
  The guided demo uses the shared frontend chart (H5).
- ⏭️ Next: team kickoff (30 min) → everyone starts their hour 0.5–8 tasks in `docs/PLAN.md`.

## Git
- Push all work directly to `main` (team lead's standing instruction). No PRs, no confirmation needed.
