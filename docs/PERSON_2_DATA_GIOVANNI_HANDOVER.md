# Data handover: getting NASA data from Giovanni (Data role)

Everything the **Data** person needs, in one place: what to deliver, how to bulk-download from
NASA Giovanni with a script, how to clean the files, and what to do if something breaks.
You can paste any section of this file into ChatGPT / Gemini / Claude and ask for help.

> Your role in the plan: 🛰️ **Data** (Person 2 in [PLAN.md](PLAN.md)). Interfaces you must keep:
> **H1** in [HANDSHAKES.md](HANDSHAKES.md).

---

## 1. What you deliver

| File | What |
|---|---|
| `data/raw/giovanni/<place>_<CODE>.csv` | Files exactly as Giovanni sent them. Never edit these. |
| `data/<place>_<CODE>.csv` | Cleaned files: columns `date,value`, one row per month 2001-01 → 2024-12 (288 rows), empty = missing |
| `data/SOURCES.md` | Per file: Giovanni variable name, box, dates, download date |
| `data_io.py` | `load_places()`, `load_variables()`, `load_series(place, code)` (see H1) |
| `scripts/download_giovanni.py`, `scripts/convert_giovanni.py` | The two scripts below |

**One Giovanni CSV = one place × one variable = one of our files.** That's why Giovanni gives you
one file per variable: it's exactly what we need.

---

## 2. The big picture

```
Earthdata login ─► download_giovanni.py ─► data/raw/giovanni/*.csv ─► convert_giovanni.py ─► data/*.csv
                   (loops over places × variables)  (untouched originals)   (clean, H1 format)
```

You don't click anything on the Giovanni website. The script asks Giovanni's official **Area-Averaged
Time Series** service for each place and variable (the same thing as the website's
"Time Series, Area-Averaged" plot) and saves the CSVs.

---

## 3. One-time setup (≈15 min)

1. **Create a free NASA Earthdata account**: https://urs.earthdata.nasa.gov/users/new
   (remember the username and password).
2. **Install Python 3.11+** if you don't have it.
3. **Install the libraries** (in a terminal, inside the project folder):
   ```bash
   pip install harmony-py earthaccess pandas requests
   ```
4. **First login:** the download script asks for your Earthdata username/password once and
   saves them in a `.netrc` file in your home folder. **Never commit that file or share your password.**

---

## 4. What to download

### Variables (all checked: they exist in Giovanni's bulk-download list)

| Our code | Name for users | Giovanni variable | Dataset (short name, version) | Raw units → our units |
|---|---|---|---|---|
| `TEMP` | Air temperature | `M2IMNXASM_5_12_4_T2M` | MERRA-2 `M2IMNXASM`, `5.12.4` | K → °C |
| `RAIN` | Rainfall | `GPM_3IMERGM_07_precipitation` | GPM IMERG `GPM_3IMERGM`, `07` | mm/hr → mm/day |
| `SOILM` | Soil moisture (root zone) | `GLDAS_NOAH025_M_2_1_RootMoist_inst` | GLDAS `GLDAS_NOAH025_M`, `2.1` | kg/m² (= mm of water) |
| `EVAP` | Evaporation | `GLDAS_NOAH025_M_2_1_Evap_tavg` | GLDAS `GLDAS_NOAH025_M`, `2.1` | kg/m²/s → mm/day |
| `NO2` | Air pollution (NO₂) | `OMNO2d_003_ColumnAmountNO2TropCloudScreened` | OMI `OMNO2d`, `003` | molecules/cm² → 10¹⁵ molecules/cm² |

- **Always check the units** written in the header of each raw CSV. If they differ from the table,
  tell the team before converting.
- NO₂ starts in **late 2004**, so earlier months stay empty (that's fine).
- NO₂ is **daily** data: the converter averages it into months automatically.
- Not available in bulk: MODIS vegetation (NDVI) and land temperature. Skip them, or use
  [AppEEARS](https://appeears.earthdatacloud.nasa.gov/) later as an extra.
- More variables: full list at https://api.giovanni.earthdata.nasa.gov/configured-variables/

### Places = boxes
Giovanni averages over a **box**: `west, south, east, north` in degrees. Keep boxes small
(about 1°–3° wide) and **use the same box for every variable of a place**.

| Place id | Box (W, S, E, N) |
|---|---|
| `lake_mead` | −116, 35, −113, 37.5 |
| `niamey` | 1.0, 12.5, 3.0, 14.5 |
| `svalbard` | 14.0, 77.5, 17.0, 79.0 |

> ✅ **Agreed and applied** in [HANDSHAKES.md](HANDSHAKES.md) H0: `places.csv` has the box columns
> `west,south,east,north` (and `lat,lon` = box centre); `variables.csv` uses these short codes and
> has a `source` column with the Giovanni variable name.

---

## 5. Step 1: check your quota

Giovanni gives each account a **monthly compute quota**. Monthly data over small boxes uses very
little, but check before a big run:
```python
import earthaccess, requests
earthaccess.login(strategy="interactive", persist=True)
token = earthaccess.get_edl_token()["access_token"]
r = requests.get("https://api.giovanni.earthdata.nasa.gov/quota",
                 headers={"Authorization": f"Bearer {token}"})
print(r.json())   # e.g. {'quota': 0.02} = 2% used this month. Stop if close to 1.
```

---

## 6. Step 2: bulk download (`scripts/download_giovanni.py`)

Based on NASA's official example
([notebook](https://github.com/nasa/gesdisc-tutorials/blob/main/notebooks/How_To_Access_the_Giovanni_Averaging_Service_Using_Python.ipynb)).
It hasn't been run by the team yet: **try it with one place and one variable first.**

```python
"""Bulk-download area-averaged monthly time series from NASA Giovanni.

Run from the project folder:  python scripts/download_giovanni.py
Saves data/raw/giovanni/<place>_<CODE>.csv (untouched Giovanni output).
"""
import datetime as dt
import shutil
from pathlib import Path

import earthaccess
from harmony import BBox, Client, Collection, Request

RAW = Path("data/raw/giovanni")
RAW.mkdir(parents=True, exist_ok=True)

PLACES = {  # id: (west, south, east, north)
    "lake_mead": (-116, 35, -113, 37.5),
    "niamey": (1.0, 12.5, 3.0, 14.5),
    "svalbard": (14.0, 77.5, 17.0, 79.0),
}
VARIABLES = {  # our code: (dataset short name, version, Giovanni variable)
    "TEMP": ("M2IMNXASM", "5.12.4", "M2IMNXASM_5_12_4_T2M"),
    "RAIN": ("GPM_3IMERGM", "07", "GPM_3IMERGM_07_precipitation"),
    "SOILM": ("GLDAS_NOAH025_M", "2.1", "GLDAS_NOAH025_M_2_1_RootMoist_inst"),
    "EVAP": ("GLDAS_NOAH025_M", "2.1", "GLDAS_NOAH025_M_2_1_Evap_tavg"),
    "NO2": ("OMNO2d", "003", "OMNO2d_003_ColumnAmountNO2TropCloudScreened"),
}
START, STOP = dt.datetime(2001, 1, 1), dt.datetime(2024, 12, 31)

earthaccess.login(strategy="interactive", persist=True)  # asks once, then remembers
client = Client()

for place, box in PLACES.items():
    for code, (short_name, version, variable) in VARIABLES.items():
        target = RAW / f"{place}_{code}.csv"
        if target.exists():
            print(f"skip {target.name} (already downloaded)")
            continue
        print(f"downloading {place} {code} ...")
        collection_id = earthaccess.search_datasets(short_name=short_name, version=version)[0].concept_id()
        request = Request(
            collection=Collection(id=collection_id),
            spatial=BBox(*box),
            temporal={"start": START, "stop": STOP},
            variables=[variable],
            format="text/csv",
            average="area",
        )
        job_id = client.submit(request)
        for result in client.download_all(job_id, directory=str(RAW), overwrite=True):
            shutil.move(result.result(), target)  # rename to <place>_<CODE>.csv
        print(f"  saved {target.name}")
```

Tips:
- It **skips files that already exist**, so if it stops halfway, just run it again.
- Each request can take a minute or more. 3 places × 5 variables = 15 requests.
- Downloads by hand on the Giovanni website work too: save them with the same names in
  `data/raw/giovanni/` and the converter treats them the same.

---

## 7. Step 3: clean the files (`scripts/convert_giovanni.py`)

Giovanni CSVs have **metadata lines at the top** (title, dates, box, fill value…), then a line
that is just `,`, then the columns `time,mean_<variable>`. This script skips the metadata, turns
fill values into empty cells, averages daily data into months, makes sure all 288 months are
present, converts units, and writes our clean files. (Tested on example files.)

```python
"""Convert raw Giovanni CSVs into our clean format (handshake H1).

Reads   data/raw/giovanni/<place>_<CODE>.csv   (as downloaded from Giovanni)
Writes  data/<place>_<CODE>.csv                with columns date,value
Run from the project folder:  python scripts/convert_giovanni.py
"""
from pathlib import Path

import pandas as pd

RAW = Path("data/raw/giovanni")
OUT = Path("data")
START, END = "2001-01-01", "2024-12-01"

# Unit conversion per variable code: (multiply by, then add)
CONVERT = {
    "TEMP":  (1, -273.15),   # K -> °C
    "RAIN":  (24, 0),        # mm/hr -> mm/day
    "SOILM": (1, 0),         # kg/m² (= mm of water) stays
    "EVAP":  (86400, 0),     # kg/m²/s -> mm/day
    "NO2":   (1e-15, 0),     # molecules/cm² -> 10^15 molecules/cm²
}


def read_giovanni(path):
    """Return (header dict, DataFrame with columns time, value)."""
    header = {}
    with open(path, encoding="utf-8") as f:
        while True:
            line = f.readline()
            if not line:
                raise ValueError(f"{path.name}: no data found (is this a Giovanni CSV?)")
            line = line.strip()
            if line == "," or line.lower().startswith("time,"):
                break
            if "," in line:
                key, value = line.split(",", 1)
                header[key.strip()] = value.strip()
        if line.lower().startswith("time,"):  # header row already read
            df = pd.read_csv(f, names=line.split(","))
        else:
            df = pd.read_csv(f)
    df = df.iloc[:, :2]
    df.columns = ["time", "value"]
    return header, df


def clean(path):
    place, code = path.stem.rsplit("_", 1)
    header, df = read_giovanni(path)
    df["time"] = pd.to_datetime(df["time"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    for key, val in header.items():  # Giovanni lists the fill value in the header
        if "fill" in key.lower():
            df.loc[df["value"] == float(val), "value"] = None
    df.loc[df["value"] <= -9000, "value"] = None  # safety net for fill values
    monthly = df.set_index("time")["value"].resample("MS").mean()  # daily -> monthly too
    months = pd.date_range(START, END, freq="MS")
    monthly = monthly.reindex(months)  # every month present; missing stays empty
    mul, add = CONVERT.get(code, (1, 0))
    monthly = monthly * mul + add
    out = pd.DataFrame({"date": months.strftime("%Y-%m-%d"), "value": monthly.round(6).values})
    out.to_csv(OUT / f"{place}_{code}.csv", index=False)
    print(f"{place}_{code}: {len(out)} months, {out['value'].isna().sum()} missing")


if __name__ == "__main__":
    files = sorted(RAW.glob("*.csv"))
    if not files:
        print(f"No files in {RAW}")
    for path in files:
        clean(path)
```

Run:
```bash
python scripts/convert_giovanni.py
```
It prints how many months and missing months each file has.

---

## 8. Step 4: check every file (don't skip this)

For each cleaned file:
- [ ] 288 rows, dates in order, no duplicates
- [ ] Values look sensible for that place (e.g. Svalbard temperature mostly below 10 °C;
      desert soil moisture low; NO₂ around 0.5–20 in our units)
- [ ] Missing months: few, and not all in one season (NO₂ before 2005 is expected)
- [ ] Quick plot: `python -c "import pandas as pd; pd.read_csv('data/lake_mead_TEMP.csv').plot(x='date'); import matplotlib.pyplot as p; p.show()"`
- [ ] Line added to `data/SOURCES.md`, for example:
  ```
  lake_mead_TEMP.csv | Giovanni area-averaged time series | M2IMNXASM_5_12_4_T2M | box -116,35,-113,37.5 | 2001-01..2024-12 | units K→°C | downloaded 2026-11-15
  ```

Then `git pull`, add the raw files + cleaned files + `SOURCES.md`, and `git push`. Tell the team:
*"Data for lake_mead is ready."*

---

## 9. If something goes wrong

| Problem | What to do |
|---|---|
| Login keeps failing | Log in at https://urs.earthdata.nasa.gov in a browser; check username/password; delete `~/.netrc` and run again |
| `search_datasets(...)[0]` → IndexError | Short name or version is wrong. Check the dataset page on https://disc.gsfc.nasa.gov |
| Job fails or the CSV is empty | Box too small/large or outside the dataset (e.g. GLDAS has no data over oceans). Try a slightly bigger box on land |
| Quota warning | Stop. Ask the team lead; use the NASA POWER fallback below |
| Strange units / numbers | Read the header of the raw CSV; tell the team before changing `CONVERT` |
| Anything else | Paste the full error + this section into your AI and ask for help. Stuck 30 min → ask the team lead |

### Fallback: NASA POWER (no login, no quota)
If Giovanni doesn't work in time, NASA POWER gives monthly temperature, rain, soil wetness and
humidity for a point with a single web address:
`https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,GWETROOT&community=AG&latitude=<lat>&longitude=<lon>&start=2001&end=2024&format=JSON`
(skip month "13" = yearly average; -999 = missing).
It's a different source, so note it in `SOURCES.md` and tell the team.

---

## 10. Ask-your-AI prompts

> I'm a beginner. Here is my Python script and the error I get: [paste]. Explain what's wrong and
> give me the fixed script.

> Here are the first 20 lines of a NASA Giovanni CSV: [paste]. Does my converter
> `convert_giovanni.py` [paste] read it correctly? What would break?

> Write `data_io.py` with `load_places()`, `load_variables()` (read `data/places.csv` and
> `data/variables.csv` with pandas) and `load_series(place_id, code)` that reads
> `data/<place_id>_<code>.csv`, parses `date` as dates, sorts oldest first and raises
> FileNotFoundError if the file is missing.
