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

## Project decisions

### Concept: "Trend Detective"
Each investigation is a **case file**:
1. **Pick a lead**: click a map location / draw a box, or choose a region type (desert, rain
   forest, city, estuary, polar, ocean). AI suggests 3–5 variables likely to trend there, with why.
2. **Gather evidence**: monthly time series for the region (≈2000–present).
3. **Analyze**: raw + deseasonalized series, OLS line with 95% CI band, Mann-Kendall + Sen's slope,
   p-value, verdict badge: 🟢 significant (p<0.05) / 🟡 suggestive (p<0.10) / ⚪ no trend.
4. **Verdict card**: what / where / how much (per decade, total, %) / how sure, plus a plain-language
   explanation of the likely driving processes.
5. **Compare regions**: same variable, two regions side by side → shows opposite-sign trends
   from the same process.
6. **"Years to significance"**: for non-significant trends, estimate the record length needed.
7. **Demo walkthroughs**: guided, step-by-step playback of pre-loaded cases.
8. **Glossary**: simple definition, units, source instrument/model for every variable.

### Stack
- **Backend**: Python 3.11, FastAPI, xarray, numpy, scipy, statsmodels, pymannkendall.
- **Frontend**: React + Vite + TypeScript, MapLibre/Leaflet for the map, Plotly for charts.
- **AI**: Claude API for variable suggestions and plain-language explanations only.
  Statistics are always computed, never generated by the LLM.

### Data strategy (reliability first, live demo must not depend on NASA uptime)
- **Curated catalogue** of ~15–25 variables pre-downloaded as monthly, coarse (~0.5°–1°) global
  grids (NetCDF/Zarr) from Earthdata / GES DISC OPeNDAP / Giovanni. Any region → instant series.
- **Live path (optional)**: GES DISC Hydrology Time Series / data rods for point queries.
- **Fallback**: bundled demo-case CSVs so the demo always works offline.

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
- **US Southwest / Lake Mead**: soil moisture & runoff decline (GLDAS).
- **Amazon (Rondônia)**: NDVI down, LST up with deforestation (MODIS).
- **Arctic vs. Antarctic**: opposite-signed temperature trends (MERRA-2).
- **Beijing vs. Delhi**: NO₂ falling vs. rising (OMI) → policy visible from space.
- **Sahel**: rainfall recovery (GPM).

### Statistics pipeline
1. Area-weighted (cos latitude) regional mean per month.
2. Deseasonalize: subtract monthly climatology → anomalies.
3. OLS on anomalies → slope, 95% CI, t-test p-value; adjust for lag-1 autocorrelation
   (effective sample size).
4. Seasonal Mann-Kendall + Sen's slope on the monthly series.
5. Years-to-significance: estimate based on current slope and residual noise/autocorrelation.

### Repo layout (planned)
```
backend/    FastAPI app, stats module, data loaders, tests
frontend/   React app
data/       catalogue metadata (variables.yaml) + demo-case CSVs (large grids gitignored)
scripts/    data download / preprocessing scripts
```

### Build order
1. Stats module + tests (synthetic data with known trends).
2. Demo-case CSVs + variable glossary.
3. FastAPI endpoints: `/variables`, `/series`, `/analyze`, `/compare`, `/suggest`.
4. Frontend: map + region select → chart → verdict card → compare view → demo walkthroughs.
5. Data download scripts for the gridded catalogue.
6. AI suggestions/explanations, polish, pitch video.

## Git
- Push all work directly to `main` (user's standing instruction). No PRs, no confirmation needed.
