# Data sources

Where every data file comes from and how it was processed. Judges and teammates should be able to
repeat every step from this page.

## How the data was made

1. **Source:** NASA **Giovanni**, service *"Time Series, Area-Averaged"*
   (https://giovanni.gsfc.nasa.gov/giovanni/), one download per place × variable.
2. **Period requested:** 2001-01-01 to 2024-12-31, monthly.
3. **Region:** the box of each place (below). Giovanni averages all grid cells inside the box.
4. **Raw files:** kept untouched in `raw/` as `<place>_<CODE>.csv` (✅ all 12 uploaded).
5. **Cleaning:** [`convert_giovanni.py`](convert_giovanni.py) (from
   [docs/PERSON_2_DATA_GIOVANNI_HANDOVER.md](../docs/PERSON_2_DATA_GIOVANNI_HANDOVER.md)).
   Re-run any time with `python Task2/convert_giovanni.py`:
   - skip Giovanni's header lines
   - fill values become empty cells (missing); never zero
   - one row per month, 2001-01 to 2024-12 (288 rows)
   - unit conversion (table below)
6. **Checks done (2026-11-14):**
   - all 12 files (in `cleaned/`): columns `date,value`, 288 months, sorted, no duplicates, no missing values
   - seasons fall in the right months (e.g. Niamey rain peaks in August)
   - **raw ↔ cleaned verified:** every raw file has the right Giovanni variable, box and
     dates (2001-01 to 2024-12, 288 months, no fill values), and re-cleaning the raw files
     reproduces `cleaned/` exactly (difference 0 on every value)
   - in the dry places, yearly evaporation ≈ yearly rain (Lake Mead 210 vs 226 mm, Niamey 512 vs 551 mm), which confirms the unit conversions

## Places (boxes: west, south, east, north, in degrees)

| Place | Box |
|---|---|
| `lake_mead`: Lake Mead (USA) | −116, 35, −113, 37.5 |
| `niamey`: Niamey, Sahel (Niger) | 1.0, 12.5, 3.0, 14.5 |
| `svalbard`: Svalbard (Arctic) | 14.0, 77.5, 17.0, 79.0 |

## Variables

| Code | Variable | Giovanni variable | Dataset (instrument / model) | Dataset page | Raw units → saved units |
|---|---|---|---|---|---|
| `TEMP` | Air temperature (2 m) | `M2IMNXASM_5_12_4_T2M` | MERRA-2 monthly, v5.12.4 (NASA GMAO model) | https://disc.gsfc.nasa.gov/datasets/M2IMNXASM_5.12.4/summary | K → °C (−273.15) |
| `RAIN` | Rainfall | `GPM_3IMERGM_07_precipitation` | GPM IMERG Final monthly, v07 (satellites) | https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary | mm/hr → mm/day (×24) |
| `SOILM` | Root-zone soil moisture | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | GLDAS Noah monthly 0.25°, v2.1 (land model) | https://disc.gsfc.nasa.gov/datasets/GLDAS_NOAH025_M_2.1/summary | kg/m² (unchanged) |
| `EVAP` | Evaporation | `GLDAS_NOAH025_M_2_1_Evap_tavg` | GLDAS Noah monthly 0.25°, v2.1 (land model) | same as above | kg/m²/s → mm/day (×86400) |

## Files (in `cleaned/`)

| File | Giovanni variable | Box | Period | Status |
|---|---|---|---|---|
| `lake_mead_TEMP.csv` | `M2IMNXASM_5_12_4_T2M` | −116, 35, −113, 37.5 | 2001-01..2024-12 | ✅ |
| `lake_mead_RAIN.csv` | `GPM_3IMERGM_07_precipitation` | −116, 35, −113, 37.5 | 2001-01..2024-12 | ✅ |
| `lake_mead_SOILM.csv` | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | −116, 35, −113, 37.5 | 2001-01..2024-12 | ✅ |
| `lake_mead_EVAP.csv` | `GLDAS_NOAH025_M_2_1_Evap_tavg` | −116, 35, −113, 37.5 | 2001-01..2024-12 | ✅ |
| `niamey_TEMP.csv` | `M2IMNXASM_5_12_4_T2M` | 1.0, 12.5, 3.0, 14.5 | 2001-01..2024-12 | ✅ |
| `niamey_RAIN.csv` | `GPM_3IMERGM_07_precipitation` | 1.0, 12.5, 3.0, 14.5 | 2001-01..2024-12 | ✅ |
| `niamey_SOILM.csv` | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | 1.0, 12.5, 3.0, 14.5 | 2001-01..2024-12 | ✅ |
| `niamey_EVAP.csv` | `GLDAS_NOAH025_M_2_1_Evap_tavg` | 1.0, 12.5, 3.0, 14.5 | 2001-01..2024-12 | ✅ |
| `svalbard_TEMP.csv` | `M2IMNXASM_5_12_4_T2M` | 14.0, 77.5, 17.0, 79.0 | 2001-01..2024-12 | ✅ |
| `svalbard_RAIN.csv` | `GPM_3IMERGM_07_precipitation` | 14.0, 77.5, 17.0, 79.0 | 2001-01..2024-12 | ✅ |
| `svalbard_SOILM.csv` | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | 14.0, 77.5, 17.0, 79.0 | 2001-01..2024-12 | ⚠️ don't use in demo (see notes) |
| `svalbard_EVAP.csv` | `GLDAS_NOAH025_M_2_1_Evap_tavg` | 14.0, 77.5, 17.0, 79.0 | 2001-01..2024-12 | ✅ |

Download date: 2026-11-14 (files uploaded to the repository). Update this if re-downloaded.

## Notes and limitations

- **Area averages:** each value is the average over the place's box, not a single weather station.
- **Models vs satellites:** MERRA-2 and GLDAS are computer models fed with observations; GPM and OMI
  are satellite measurements. All are NASA products.
- **`svalbard_SOILM`:** Svalbard is mostly glaciers and frozen ground, where a soil-moisture model
  isn't meaningful. Each month is almost the same as the previous one (month-to-month correlation 0.99),
  so the trend is very uncertain. Keep the file but don't use it in the demo.
- **Negative evaporation** (Svalbard, a few months): in GLDAS this means frost or condensation
  forming on snow. It's real model output, not an error.
- **Zeros in Niamey rainfall:** dry-season months with no rain. Real, not missing.
- **NO₂ (air pollution) was dropped**: it isn't available in Giovanni's web interface for our
  area-averaged time series.
