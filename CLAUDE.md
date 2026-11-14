# CLAUDE.md — Project Hyperion

Hackathon project. Goal: **win**. This file holds the challenge brief, resources, and the
decisions we make as the project evolves. Keep it up to date when decisions change.

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

## Working agreement
- **Always commit and push directly to `main`** without asking for confirmation.
- Make sensible decisions on open choices, record them here, and keep going.
- 4-person team including the user (team lead = Person 2, Stats/Backend + integration, works
  with Claude Code); the other 3 do **not** use Claude Code. Roles, contracts (CSV / YAML / API JSON)
  and timeline live in `docs/TEAM_PLAN.md`. Respect those contracts; Claude does the bulk of
  Person 2's coding and helps the others via the lead (skeleton, stats, API, reviews, fixes).

## Project decisions

### Concept: "Trend Detective"

`docs/TEAM_PLAN.md` is authoritative. The MVP uses one primary NASA variable and two verified
regions. Each investigation shows the exact region, raw monthly series, deseasonalized anomalies,
rate per decade, dependence-aware 95% interval, record quality, provenance, and limitations. A
comparison uses the same product, units, period, and method. Trend analysis does not establish
cause.

### Stack
- **Backend**: Python 3.11, FastAPI, xarray, numpy, scipy, statsmodels, pymannkendall.
- **Frontend**: React + Vite + TypeScript, MapLibre/Leaflet for the map, Plotly for charts.
- **AI**: optional after the MVP is stable, limited to rephrasing approved text. It never
  generates data, statistics, causes, or scientific conclusions.

### Data strategy (reliability first, live demo must not depend on NASA uptime)
- Start with one variable and two pre-downloaded regional monthly series.
- Preserve raw downloads, product/version metadata, geometry, units, quality filtering, and every
  transformation.
- Use NASA POWER for the first vertical slice when its current catalogue supports the chosen
  variable. Use other services only after the exact demo series is frozen.
- Live arbitrary-region access is stretch only. The judged demo always has an offline fallback.

### Initial variable catalogue
| Variable | Source |
|---|---|
| 2 m air temperature, surface skin temperature | MERRA-2 |
| Precipitation | GPM IMERG (monthly) |
| Soil moisture, evapotranspiration, runoff, snow water equivalent | GLDAS Noah |
| NDVI / EVI (vegetation greenness), land surface temperature | MODIS |
| Aerosol optical depth | MODIS / MERRA-2 |
| Tropospheric NO₂, total column ozone | OMI |
| Surface air temperature / relative humidity profiles | AIRS |
| Sea surface temperature | MERRA-2 |

### Demo cases

Choose the primary variable and two regions at the Hour 4 data gate. Do not promise a trend sign
or causal story before the product, common period, geometry, quality filtering, and analysis have
been verified.

### Statistics pipeline
1. Apply documented quality/fill-value rules and preserve missing observations.
2. Use the common period for compared regions.
3. Deseasonalize by subtracting each calendar month's climatological mean.
4. Estimate a linear rate per decade and dependence-aware 95% interval using a documented block
   bootstrap, autocorrelated-error model, or HAC method.
5. Use seasonal/autocorrelation-aware Mann-Kendall only as a secondary check.
6. Report clear evidence, uncertain direction, no clear direction, or insufficient data. A
   non-significant result never means "no change exists."
7. Detection horizon is late stretch work and must be labeled as a conditional planning estimate,
   not a forecast.

### Repo layout (planned)
```
backend/    FastAPI app, stats module, data loaders, tests
frontend/   React app
data/       catalogue metadata (variables.yaml) + demo-case CSVs (large grids gitignored)
scripts/    data download / preprocessing scripts
```

### Build order
1. Freeze the API contract and mock response.
2. Approve one variable, two regions, provenance, and quality rules by Hour 4.
3. Build and test the trend module on synthetic and reference data.
4. Build the frontend journey against mock data.
5. Connect the two real cases; add comparison and provenance/method details.
6. Complete the guided investigation, user test, deployment, and pitch.
7. Consider stretch features only after the stable MVP passes the Hour 30 gate.

## Git
- Push all work directly to `main` (user's standing instruction). No PRs, no confirmation needed.
