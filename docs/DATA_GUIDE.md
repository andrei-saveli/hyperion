# Data guide - Person 1

Follow the Hour 4 data gate in [TEAM_PLAN.md](TEAM_PLAN.md). Do not download the previous list of
eight demo files. The MVP uses one primary variable and two verified regions.

## Deliverables

| Path | Contents |
|---|---|
| `data/raw/` | Untouched source downloads for both regions |
| `data/demo/<case_id>.csv` | Two cleaned monthly series |
| `data/variables.yaml` | Exact variable/product metadata and plain definition |
| `data/cases.yaml` | Region geometries, filenames, and comparison link |
| `data/SOURCES.md` | Download URLs/times, product version, quality rules, and processing steps |

## First-source recommendation

Try NASA POWER first because it offers analysis-ready monthly JSON/CSV without an Earthdata
login. Confirm the exact parameter, source product, temporal coverage, units, and spatial
resolution in the current parameter dictionary. If it cannot support the selected investigation,
use Giovanni/AppEEARS/GES DISC and freeze the resulting series before frontend integration.

Useful links:

- [POWER monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/)
- [POWER parameter guide](https://power.larc.nasa.gov/docs/tutorials/parameters/)
- [Giovanni](https://giovanni.gsfc.nasa.gov/)
- [AppEEARS](https://appeears.earthdatacloud.nasa.gov/)

## Hour 4 approval checklist

- [ ] One variable and two regions are selected.
- [ ] Both regions use the same product, units, period, and aggregation rule.
- [ ] Source, product ID, version, and source URL are known.
- [ ] Fill values and quality flags are understood.
- [ ] Native resolution and the selected region geometry are recorded.
- [ ] At least 10 years of monthly data are available; longer is preferred.
- [ ] Missingness is low and not concentrated in one season.
- [ ] The raw series pass visual inspection.
- [ ] No trend sign or causal story was assumed before checking the data.

If any required item fails, replace the product or case immediately.

## Cleaned CSV contract

```csv
date,value,quality
2001-01-01,0.312,good
2001-02-01,0.298,good
2001-03-01,,missing
```

Rules:

- Exactly one row per calendar month, oldest first.
- Use the first day of the month in ISO format.
- Preserve missing months with an empty value; never substitute zero.
- Keep values in one documented unit.
- Do not silently interpolate long gaps.
- Store untouched downloads under `data/raw/`.

## Provenance record

For each cleaned series, record:

- source name and URL;
- product ID and version;
- variable ID, long name, and units;
- native spatial/temporal resolution;
- exact region geometry;
- spatial aggregation method;
- analysis coverage and download timestamp;
- fill values, quality filter, and missing count;
- every cleaning or conversion step.

Example `data/SOURCES.md` entry:

```text
primary_region.csv
Source: NASA POWER
Product/version: <verified value>
Variable/units: <verified value>
Region geometry: <GeoJSON or W,S,E,N>
Period: 2001-01 through 2025-12
Aggregation: <point or documented regional mean>
Downloaded: 2026-11-14T00:00:00Z
Quality/missing rules: <details>
Processing: raw response -> monthly contract; no interpolation
URL: <exact request or landing page>
```

## Handoff to Person 2

Before marking the data task complete:

1. Open both cleaned CSVs and confirm chronological order and units.
2. Count rows, missing months, duplicate dates, and non-numeric values.
3. Plot both raw series for visual review.
4. Confirm both use the same common period.
5. Push raw data, cleaned data, metadata, and provenance together.
