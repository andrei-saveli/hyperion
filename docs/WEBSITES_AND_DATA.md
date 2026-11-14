# Websites and data (for the Data person)

Every website you need, **what to take from each one**, and in what order. Step-by-step
instructions and the scripts are in
[PERSON_2_DATA_GIOVANNI_HANDOVER.md](PERSON_2_DATA_GIOVANNI_HANDOVER.md).

---

## Step 1: accounts and setup (do this first)

| # | Website | What to do there | You take |
|---|---|---|---|
| 1 | **NASA Earthdata sign-up**: https://urs.earthdata.nasa.gov/users/new | Create a free account | A **username + password** (needed for Giovanni). Never share or commit them |
| 2 | **Earthdata login setup guide**: https://disc.gsfc.nasa.gov/information/howto?keywords=prerequisite | Read "How to Generate Earthdata Prerequisite Files" | Nothing to download. The script creates the `.netrc` login file for you, and this explains it if something fails |
| 3 | **Giovanni website**: https://giovanni.gsfc.nasa.gov/giovanni/ | Log in once with your Earthdata account and accept anything it asks | Nothing yet. This confirms your account works with Giovanni |

---

## Step 2: the data (the main job)

**Where you get it:** the **Giovanni Area-Averaged Time Series service**, through the script
`scripts/download_giovanni.py`. One request per **place × variable**.

**Same settings for every request:**
- **Dates:** 2001-01-01 → 2024-12-31
- **Region:** the place's box (`west, south, east, north`) from `data/places.csv`
- **Output:** CSV (monthly values, averaged over the box)

### The 4 variables to take

| Our code | What it is | Giovanni variable (copy exactly) | Dataset page (read: units, dates, description) | Units in the raw file → what we save |
|---|---|---|---|---|
| `TEMP` | Air temperature (2 m) | `M2IMNXASM_5_12_4_T2M` | MERRA-2 monthly: https://disc.gsfc.nasa.gov/datasets/M2IMNXASM_5.12.4/summary | K → **°C** (−273.15) |
| `RAIN` | Rainfall | `GPM_3IMERGM_07_precipitation` | GPM IMERG monthly: https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGM_07/summary | mm/hr → **mm/day** (×24) |
| `SOILM` | Soil moisture (root zone) | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | GLDAS monthly: https://disc.gsfc.nasa.gov/datasets/GLDAS_NOAH025_M_2.1/summary | kg/m² → **kg/m²** (no change) |
| `EVAP` | Evaporation | `GLDAS_NOAH025_M_2_1_Evap_tavg` | same GLDAS page as above | kg/m²/s → **mm/day** (×86400) |

**Always compare** the units written at the top of each downloaded CSV with this table. If they
differ, tell the team before converting.

### The places to take (starting set; Person 3 adds more in `data/places.csv`)

| Place id | Box: west, south, east, north |
|---|---|
| `lake_mead` | −116, 35, −113, 37.5 |
| `niamey` | 1.0, 12.5, 3.0, 14.5 |
| `svalbard` | 14.0, 77.5, 17.0, 79.0 |

**Total:** 3 places × 4 variables = **12 files** to start. Each new place adds 4 more.

**NO₂ (air pollution) was dropped**: it isn't available in Giovanni's web interface for our area-averaged time series. The project uses 4 variables.

### Helpful Giovanni pages

| Website | What to take |
|---|---|
| **List of all variables you can download in bulk**: https://api.giovanni.earthdata.nasa.gov/configured-variables/ | Check a variable name exists before adding it (search the page with Ctrl+F) |
| **Your monthly quota**: https://api.giovanni.earthdata.nasa.gov/quota | How much of your monthly allowance is used (0 = nothing, 1 = all). Needs login, so the script checks it for you |
| **NASA's official example** (the script is based on it): https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_To_Access_the_Giovanni_Averaging_Service_Using_Python.ipynb | Nothing to download. Read it if the script fails |

### Python tools the script uses (install, don't download data)

| Website | What to take |
|---|---|
| **harmony-py**: https://harmony-py.readthedocs.io/ | `pip install harmony-py`. It sends the requests to NASA |
| **earthaccess**: https://earthaccess.readthedocs.io/ | `pip install earthaccess`. It handles your Earthdata login |

---

## Step 3: by hand, if the script doesn't work

You can get **the same data on the Giovanni website** (slower, but no coding):

1. Go to https://giovanni.gsfc.nasa.gov/giovanni/ and log in.
2. **Select Plot:** "Time Series, Area-Averaged".
3. **Date range:** 2001-01-01 to 2024-12-31.
4. **Region:** type the box (west, south, east, north) from the table above.
5. **Variables:** search the Giovanni variable name (e.g. `RootMoist`), tick it.
6. **Plot Data** → when it's done: **Downloads → CSV**.
7. Save as `data/raw/giovanni/<place>_<CODE>.csv` (e.g. `lake_mead_SOILM.csv`).
8. Run `python scripts/convert_giovanni.py`: it cleans hand-downloaded files exactly the same way.

---

## Step 4: backup source, if Giovanni fails completely

| Website | What to take |
|---|---|
| **NASA POWER Data Access Viewer**: https://power.larc.nasa.gov/data-access-viewer/ | Monthly data for a **point** (the box centre `lat, lon`), no login. Parameters: `T2M` (temperature, °C), `PRECTOTCORR` (rain, mm/day), `GWETROOT` (soil wetness, 0–1). Years 2001–2024 |
| **NASA POWER API** (same data by web address): `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,GWETROOT&community=AG&latitude=<lat>&longitude=<lon>&start=2001&end=2024&format=JSON` | Ignore month "13" (yearly average); `-999` = missing |

POWER has **no evaporation**, and gives points, not boxes. If you use it, write that in
`data/SOURCES.md` and tell the team.

---

## Optional extra (only if everything else is done)

| Website | What to take |
|---|---|
| **AppEEARS**: https://appeears.earthdatacloud.nasa.gov/ | MODIS vegetation greenness (NDVI, product `MOD13A3`, monthly) for a box: "Area Sample" → statistics CSV. Same Earthdata login. Ask the team before adding a new variable |

---

## What you hand over (checklist)

- [ ] `data/raw/giovanni/<place>_<CODE>.csv`: the untouched downloads
- [ ] `data/<place>_<CODE>.csv`: cleaned, `date,value`, 288 rows each
- [ ] `data/SOURCES.md`: one line per file (Giovanni variable, box, dates, download date)
- [ ] `data_io.py`: the 3 load functions (handshake H1)
- [ ] A message to the team: *"Data for lake_mead is ready"*
