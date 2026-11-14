# Data Guide (Person 1: Data Detective)

> Claude's earlier version, kept for comparison. The current guide is [DATA_GUIDE.md](DATA_GUIDE.md).

What files to produce, where to get the data, and exactly how to save it.

## Files you deliver

| # | File | What it is |
|---|---|---|
| 1 | `data/demo/*.csv` | **8 cleaned time series** (one per demo-case variable/region), format below |
| 2 | `data/raw/*` | The **original downloads**, untouched (proof the data is real; lets us re-clean) |
| 3 | `data/SOURCES.md` | One line per CSV: dataset, variable, region box, tool used, download date |
| 4 | `data/variables.yaml` | Catalogue of every variable we support (definitions written with Person 4) |

### Cleaned CSV format (strict)
```csv
date,value
2001-01,0.312
2001-02,0.298
2001-03,
```
- Exactly two columns: `date` (`YYYY-MM`) and `value` (number, in the units listed below).
- One row per month, oldest first. Missing month → keep the row, leave `value` empty.
- Daily data (OMI NO₂) → average to **monthly** first.
- Not sure how to clean it? Put the raw file in `data/raw/` and tell the team lead: a converter
  script can turn Giovanni/AppEEARS exports into this format automatically.

## The 8 demo files

Region boxes are `[West, South, East, North]` in degrees. Period: as long as available, at least
15 years.

| File | Variable | Dataset (instrument/model) | Region box | Period | Tool |
|---|---|---|---|---|---|
| `lake_mead_soil.csv` | Root-zone soil moisture (kg/m²) | GLDAS_NOAH025_M 2.1 → `RootMoist_inst` | [-116, 35, -113, 37.5] | 2000–now | Giovanni |
| `amazon_ndvi.csv` | Vegetation greenness NDVI (unitless) | MODIS MOD13C2 (monthly) | [-64, -12, -60, -8] (Rondônia) | 2000–now | Giovanni or AppEEARS |
| `amazon_lst.csv` | Daytime land surface temperature (K or °C, say which) | MODIS MOD11C3 (monthly) | [-64, -12, -60, -8] | 2000–now | Giovanni or AppEEARS |
| `arctic_t2m.csv` | 2 m air temperature (K) | MERRA-2 M2TMNXSLV → `T2M` | [-180, 66.5, 180, 90] | 1980–now | Giovanni |
| `antarctic_t2m.csv` | 2 m air temperature (K) | MERRA-2 M2TMNXSLV → `T2M` | [-180, -90, 180, -66.5] | 1980–now | Giovanni |
| `beijing_no2.csv` | Tropospheric NO₂ column (molecules/cm²) | OMI OMNO2d 003 → `ColumnAmountNO2TropCloudScreened` | [115.5, 39.5, 117.5, 41] | 2005–now | Giovanni |
| `delhi_no2.csv` | Tropospheric NO₂ column (molecules/cm²) | OMI OMNO2d 003 → same | [76.8, 28.4, 77.6, 28.9] | 2005–now | Giovanni |
| `sahel_precip.csv` | Precipitation (mm/month) | GPM IMERG monthly GPM_3IMERGM → `precipitation` | [-10, 12, 20, 18] | 2000–now | Giovanni |

Dataset names can shift between versions. If one isn't listed, pick the closest newer version and
write what you used in `SOURCES.md`.

## How to download in Giovanni (most files)
1. Log in at https://giovanni.gsfc.nasa.gov with your **Earthdata account**.
2. Select plot: **Time Series, Area-Averaged**.
3. Set the date range and type the region box (W, S, E, N).
4. Search for the variable (use the dataset name above), tick it, then **Plot Data**.
5. When the plot appears: **Downloads → CSV**. Save it into `data/raw/` with the same name as
   the target file (e.g. `data/raw/lake_mead_soil_giovanni.csv`).
6. Clean it into `data/demo/<name>.csv` (or hand the raw file to the team lead).

**AppEEARS** (for MODIS if Giovanni doesn't list it): Area Sample → draw/upload the box →
choose the product/layer → output the statistics CSV (it contains the mean per date).

**No login fallback:** **NASA POWER** (https://power.larc.nasa.gov/data-access-viewer/) gives
monthly temperature, precipitation and soil wetness from MERRA-2 for a point or region.

## SOURCES.md line example
```
lake_mead_soil.csv | GLDAS_NOAH025_M 2.1 RootMoist_inst | [-116,35,-113,37.5] | 2000-01..2025-09 | Giovanni | downloaded 2026-11-15
```

## Order of work
1. Earthdata account (needed for Giovanni and AppEEARS).
2. `lake_mead_soil.csv` first: it's the easiest and tests the whole pipeline. Push it right away.
3. The rest of the 8 files, pushing each one as it's done.
4. `variables.yaml` (see the contract in `docs/TEAM_PLAN_CLAUDE.md`) with Person 4's definitions.
5. Stretch: extra variables for the catalogue (evapotranspiration, runoff, aerosol optical depth,
   snow water equivalent, ozone).
