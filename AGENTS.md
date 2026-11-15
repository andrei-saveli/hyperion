# AGENTS.md: Project Hyperion

Shared instructions for **any AI coding agent** (Claude Code, Codex, Gemini CLI, Copilot, Cursor…)
and for humans joining the project. Read this first, then `Website/README.md`.

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
- The team has minimal coding skills: keep code simple, commented, beginner-readable.
- Don't add new dependencies without adding them to `Website/requirements.txt` (Python) or loading
  them from the pinned files in `Website/vendor/` (browser).
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

### Concept: "Trend Detective"
Ask a question or pick any place on Earth → monthly NASA records → chart (seasons removable) with trend
line and 95% band → answer card and verdict (🟢 significant / 🟡 possible, not significant yet / ⚪ no
clear trend / ⚫ not enough data; rate per decade, total change, p-value, plain explanation) → what
accounts for it (Trend Decomposer) → places changing alike. Say *what* changed, never claim *why*. Demo
cases are chosen from real results, not assumed.

### Data
- **NASA POWER** monthly point data (MERRA-2 + CERES, 1981 onwards, any place, no login), asked live:
  35 measurements.
- **Prepared NASA grids** (Earthdata token, `Website/build_nasa_grids.py` download → build): 27
  measurements from GPM, GLDAS, MODIS, OMI, AIRS, NASA-SSH sea level and MERRA-2 (aerosols, chemistry,
  glaciers). Tiles in `Website/data/nasa/` (~440 MB): rebuild and commit them rarely, each rebuild
  adds that much to git history.
- Where a measurement exists twice the site tests both over shared years ("second source").
- Giovanni (3 regions, Streamlit version) is in `archive/`; it needed manual downloads, which made
  "any place" impossible.

### Stack
- **Website:** static HTML + JavaScript in `Website/` (MapLibre map, Plotly charts), no build step,
  any static hosting. Search by meaning: all-MiniLM-L6-v2 run in the browser (`Website/models/`,
  `Website/vendor/`), never for numbers.
- **Statistics:** `Website/stats.py` (Python, numpy + scipy only; the reference) and `Website/stats.js`
  (a tested line-by-line copy). The seasonal Mann-Kendall was checked against pymannkendall.
- **Build scripts** (Python): `build_world.py` (world overview), `build_nasa_grids.py` +
  `build_nasa_tiles.py` (NASA grids), `get_search_model.py` (search model files).

### Repo layout
```
AGENTS.md          this file
README.md          project overview for visitors and judges
Website/           the site, its build scripts and tests (details: Website/README.md)
docs/              presentation deck and script, reviews, data sources
archive/           earlier versions: Streamlit apps, Giovanni data, task folders, original plan (archive/README.md)
```

### Statistics (Website/stats.py)
Skip missing values (never zero). Deseasonalize (subtract each calendar month's mean; the 12 means
are estimated together with the trend line, so partial years and gaps can't bias the slope). OLS slope
per decade; 95% CI and t-test p-value corrected for lag-1 autocorrelation (effective n,
Santer et al. 2000). Seasonal Mann-Kendall + seasonal Sen's slope (year-to-year memory
correction) as second checks. Verdict: 🟢 p<0.05 · 🟡 p<0.10 · ⚪ otherwise · ⚫ under 10 years
or 24 valid months. Flags: `reliability` (low if < 30 effective months), `tests_agree`,
`band_meaning`. `percent_change` only for never-negative amounts (rain, soil water, pollution...).
"Years until significant" = record × (1.96/|t|)^(2/3) − record; labelled planning estimate.
Non-significant ≠ "no change". Never state causes (Investigate says how much a driver statistically
accounts for; it never says "cause").

## Current status (update this when you finish something)
- 🌐 **Site:** `Website/` ("ByteMe", logo `B/ ByteMe`). Run: `python3 -m http.server 8000 --directory Website`.
  62 measurements in `Website/data/variables.json`, grouped by terrain (ocean, ice and snow, land water,
  pollution, upper air...). `absent_if_constant` = "Not found here" instead of "no trend"; `nearest` =
  nearest sea square within 200 km for coastal towns; `where` = says where a measurement exists.
- 🔎 **Search:** keyword rules (phrases, keywords, families, `not_available` notes with the closest
  measurement), place names via Photon, Open-Meteo and Nominatim (countries, regions, rivers, seas),
  then a local sentence model for questions without keywords. Rebuild its index with
  `node Website/scripts/build_meaning_index.js` after editing catalogue text. Checks:
  `node Website/tests/test_search.js`, `node Website/tests/test_meaning.js` (Playwright).
- 🗺️ **Areas:** countries and regions are averaged over their outline (`Website/area.js`); rivers along
  their course.
- ⏱️ **Time periods:** From/To in Explore, periods in questions and links (`Website/investigation.js`).
- 🔍 **Investigate = Trend Decomposer** (`Website/decompose.js`): joint (optionally seasonal) regression
  on detrended wiggles → each driver's contribution + what's left; block-bootstrap ranges; alibi check;
  across-the-planet check; satellite-data swap. Never claims causes.
- 🧭 **Places changing like this one** (`Website/similar.js`): nearest neighbours over 5° trend
  fingerprints (18 core POWER trends vs the planet, weighted cosine), 5 matches ≥ 1,500 km apart.
- 🏭 **Pollution:** PM2.5 (MERRA-2, compared with the WHO guideline), soot, organic particles, sulfate
  particles, fine dust, SO₂ and CO at ground level (MERRA-2), OMI SO₂ (second source for MERRA-2 SO₂),
  formaldehyde and UV aerosol index, plus haze, NO₂, dust, smoke, sulfate haze, AIRS CO and methane.
- 🎤 **Presentation:** `docs/presentation/` (deck + Romanian speaker script). Branch reviews:
  `docs/CAUSALITY_REVIEW.md`, `docs/TREND_DETECTIVE_HANDOVER.md`.
- 🗄️ **Archive:** the Streamlit versions, Giovanni data (still used as test data by
  `Website/tests/make_reference.py`), the four task folders and the original plan and handshakes.
- ✅ Tests: `node Website/tests/test_{stats,nasa,area,decompose,investigation,similar}.js`,
  `python3 -m pytest -q Website/tests/test_stats_py.py`.

## Git
- Push all work directly to `main` (team lead's standing instruction). No PRs, no confirmation needed.
