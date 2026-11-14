# Handshakes: how our 4 parts fit together

A **handshake** is a promise between two people: *"I will give you exactly this, in exactly this
shape."* If everyone keeps their handshakes, the parts click together at each sync with no surprises.

**Rules**
1. These are **frozen after the kickoff**. To change one: say it in the team chat → the owner
   updates this file → everyone replies "ok" → then change the code.
2. **One owner per file.** Only the owner edits it. Others ask.
3. **"Done" means:** pushed to `main` + runs without errors + one line in the team chat
   (*"data_io.py is ready"*).
4. Until a real part arrives, use the **fake** given below (copy-paste it). Swapping fake → real
   must need no other changes. That's the test that a handshake works.

---

## Map of who gives what to whom

```
          ┌──────────────── H1: data files + data_io.py ────────────────┐
          │                                                             ▼
   🛰️ P2 Data ──H1──► 📈 P4 Trend (stats.py) ──H2: analyze() result──► 🖥️ P1 Frontend (app.py)
          ▲                                     │                       ▲      │
          │                                     ▼                       │      │ H5: trend_chart()
   H0: places.csv +                    🔎 P3 Search + explain ─H3, H4───┘      ▼
   variables.csv (from P3)              (explain(), search())          🔎 P3 guided demo page
```

| # | Handshake | Giver → Receivers | Ready by |
|---|---|---|---|
| H0 | `places.csv`, `variables.csv` | P3 → P2, P1, P4 | starters now; full by hour 6 |
| H1 | Series CSV files + `data_io.py` | P2 → P1, P3, P4 | hour 6 |
| H2 | `analyze(df)` result | P4 → P1, P3 | v1 by hour 6, final by hour 20 |
| H3 | `explain(result, variable, place)` | P3 → P1 | v1 by hour 8 |
| H4 | `search(text)` | P3 → P1 | hour 16 |
| H5 | `trend_chart(df, result, remove_seasons)` | P1 → P3 | hour 8 |
| H6 | The whole app runs | everyone → P4 | each sync |

---

## H0 · Places and variables lists (owner: P3)

### `data/places.csv`
```csv
id,name,lat,lon,west,south,east,north,type,story
lake_mead,Lake Mead (USA),36.25,-114.5,-116,35,-113,37.5,desert,Is the desert around Lake Mead drying out?
niamey,"Niamey, Sahel (Niger)",13.5,2.0,1.0,12.5,3.0,14.5,savanna,Is the Sahel getting more or less rain?
svalbard,Svalbard (Arctic),78.25,15.5,14.0,77.5,17.0,79.0,polar,Is the Arctic warming?
```
| Column | Rule |
|---|---|
| `id` | lowercase letters, digits, `_`; unique; never renamed once used (it's in file names) |
| `name` | what users see |
| `lat`, `lon` | **centre of the box**, decimal degrees (used for the map) |
| `west`, `south`, `east`, `north` | **the box** Giovanni averages over (degrees, west < east, south < north, about 1°–3° wide). Same box for every variable of a place |
| `type` | one of: `desert` `polar` `savanna` `city` `forest` `coast` `mountain` `farmland` |
| `story` | one question a student would ask, ending in `?` |

### `data/variables.csv`
```csv
code,name,units,definition,keywords,source
TEMP,Air temperature,°C,How warm the air is 2 metres above the ground.,temperature hot warm cold heat warming cooling climate,M2IMNXASM_5_12_4_T2M
RAIN,Rainfall,mm/day,Average amount of rain and snow that falls per day.,rain rainfall precipitation wet dry drought storm snow,GPM_3IMERGM_07_precipitation
SOILM,Soil moisture,kg/m²,How much water the soil holds where plant roots grow (1 kg/m² = 1 mm of water).,soil moisture drought dry drying wet farming plants roots desert,GLDAS_NOAH025_M_2_1_RootMoist_inst
EVAP,Evaporation,mm/day,How much water goes from the ground and plants into the air each day.,evaporation evapotranspiration water loss dry drying plants heat,GLDAS_NOAH025_M_2_1_Evap_tavg
```
| Column | Rule |
|---|---|
| `code` | **our short code**: CAPITALS/digits, e.g. `TEMP` (it's in file names) |
| `name` | what users see |
| `units` | exactly as shown in the app (the cleaned data is already in these units) |
| `definition` | one sentence a 15-year-old understands |
| `keywords` | lowercase words separated by spaces, used by `search()` |
| `source` | the exact **Giovanni variable name** the data comes from |

Data source: **NASA Giovanni** area-averaged monthly time series (see
[PERSON_2_DATA_GIOVANNI_HANDOVER.md](PERSON_2_DATA_GIOVANNI_HANDOVER.md)); NASA POWER is only a
fallback. **NO₂ (air pollution) was dropped**: it isn't available in Giovanni's web interface for our area-averaged time series. The project uses 4 variables.

---

## H1 · Data files + loading (owner: P2)

### Series files: `data/<place_id>_<code>.csv`
```csv
date,value
2001-01-01,6.49
2001-02-01,
2001-03-01,12.3
```
- One file for **every** place × variable.
- `date`: first day of the month, `YYYY-MM-DD`. One row per month, **2001-01 to 2024-12 (288 rows)**,
  oldest first, no duplicates, no skipped months.
- `value`: a number in the units from `variables.csv` (already converted, e.g. K → °C), or **empty if missing**. Never `0`, `-999`
  or `NaN` text for missing.

### `data_io.py`
```python
load_places()  -> DataFrame   # columns: id, name, lat, lon, west, south, east, north, type, story
load_variables() -> DataFrame # columns: code, name, units, definition, keywords, source
load_series(place_id: str, code: str) -> DataFrame
    # columns: date (datetime), value (float, NaN = missing); sorted oldest first
    # raises FileNotFoundError if that file doesn't exist
```

**Fake (for P1, P3, P4 until H1 is ready):**
```python
import numpy as np, pandas as pd

def load_places():
    return pd.DataFrame([
        {"id": "lake_mead", "name": "Lake Mead (USA)", "lat": 36.25, "lon": -114.5, "west": -116, "south": 35, "east": -113, "north": 37.5,
         "type": "desert", "story": "Is the desert around Lake Mead drying out?"},
        {"id": "svalbard", "name": "Svalbard (Arctic)", "lat": 78.25, "lon": 15.5, "west": 14.0, "south": 77.5, "east": 17.0, "north": 79.0,
         "type": "polar", "story": "Is the Arctic warming?"},
    ])

def load_variables():
    return pd.DataFrame([{"code": "TEMP", "name": "Air temperature", "units": "°C",
                          "definition": "How warm the air is 2 metres above the ground.", "keywords": "temperature hot warm",
                          "source": "M2IMNXASM_5_12_4_T2M"}])

def load_series(place_id, code):
    dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
    t = np.arange(len(dates)) / 120                      # time in decades
    seasons = 10 * np.sin(2 * np.pi * (dates.month - 4) / 12)
    noise = np.random.default_rng(0).normal(0, 1, len(dates))
    return pd.DataFrame({"date": dates, "value": 15 + 0.5 * t + seasons + noise})  # trend: +0.5 per decade
```

---

## H2 · Trend result (owner: P4)

```python
analyze(df: DataFrame) -> dict   # df from load_series()
```
Never crashes on a normal series. With fewer than **24** non-missing months it returns
`verdict = "insufficient"` and `None` for every number.

| Key | Type | Meaning |
|---|---|---|
| `slope_per_decade` | float | linear trend, in the variable's units per 10 years |
| `ci_low`, `ci_high` | float | 95% interval of `slope_per_decade` |
| `p_value` | float 0–1 | trend t-test, corrected for month-to-month correlation |
| `mk_p_value` | float or None | Mann-Kendall p-value (None until implemented) |
| `total_change` | float | `slope_per_decade × years in record / 10` |
| `start`, `end` | str `"YYYY-MM"` | first and last month used |
| `n_months`, `n_missing` | int | rows, and how many were empty |
| `direction` | str | `"increase"` · `"decrease"` · `"flat"` |
| `verdict` | str | `"significant"` (p < 0.05) · `"possible"` (p < 0.10) · `"none"` · `"insufficient"` |
| `emoji` | str | 🟢 · 🟡 · ⚪ · ⚫ (same order) |
| `anomaly` | list | seasons removed, one value per row of `df` (None where missing) |
| `trend`, `band_low`, `band_high` | list | trend line and 95% band, one value per row, same scale as `anomaly` |
| `years_to_significance` | float or None | extra years of data likely needed before a 🟡/⚪ trend becomes significant (planning estimate, Weatherhead et al. 1998); None if significant or not meaningful |
| `method` | str | one plain sentence describing the method (shown in the app) |
| `sen_slope_per_decade` | float or None | *extra:* Sen's robust slope per decade |
| `lag1_autocorrelation` | float or None | *extra:* month-to-month memory (0–1) |
| `effective_n` | float or None | *extra:* independent months the record is worth |

**Fake (for P1 and P3 until H2 is ready):**
```python
def analyze(df):
    n = len(df)
    anomaly = (df["value"] - df.groupby(df["date"].dt.month)["value"].transform("mean")).tolist()
    trend = [0.5 * (i / 120 - n / 240) for i in range(n)]
    return {"slope_per_decade": 0.5, "ci_low": 0.3, "ci_high": 0.7, "p_value": 0.01, "mk_p_value": None,
            "total_change": 1.2, "start": "2001-01", "end": "2024-12", "n_months": n, "n_missing": 0,
            "direction": "increase", "verdict": "significant", "emoji": "🟢",
            "anomaly": anomaly, "trend": trend,
            "band_low": [v - 0.2 for v in trend], "band_high": [v + 0.2 for v in trend],
            "years_to_significance": None, "method": "FAKE RESULT for testing"}
```

---

## H3 · Explanation (owner: P3)

```python
explain(result: dict, variable: dict, place: dict) -> dict
# result   = output of analyze()
# variable = one row of load_variables() as a dict (code, name, units, definition, keywords, source)
# place    = one row of load_places() as a dict (id, name, lat, lon, west, south, east, north, type, story)
```
Returns:
```python
{
  "headline": "Svalbard's air got warmer: +0.65 °C per decade, a significant increase.",
  "details":  "Markdown paragraph: what the rate, the band and the p-value mean here ...",
  "caveat":   "A straight line is a simplification, and a trend shows *what* changed, not *why*.",
}
```
**Wording rules** (must hold for every verdict, including `"insufficient"`):
- Never say what **caused** the change.
- Never call a ⚪ result "no change". Say "no clear trend *yet*" / "not enough evidence".
- Round numbers sensibly (2–3 significant digits) and always include units.

**Fake (for P1 until H3 is ready):**
```python
def explain(result, variable, place):
    return {"headline": f"{place['name']}: {variable['name']} {result['direction']} "
                        f"({result['slope_per_decade']:+.2f} {variable['units']} per decade)",
            "details": "FAKE explanation.", "caveat": "A trend shows what changed, not why."}
```

---

## H4 · Search (owner: P3)

```python
search(text: str) -> list[dict]
# each: {"place_id": "lake_mead", "code": "SOILM", "reason": "desert + 'dry' → soil moisture", "score": 2}
```
- Best match first, **at most 5** results. Empty or unknown text → `[]`. Never crashes.
- Only suggests places and variables that exist in `places.csv` / `variables.csv`.

**Fake (for P1 until H4 is ready):**
```python
def search(text):
    return [{"place_id": "lake_mead", "code": "TEMP", "reason": "FAKE suggestion", "score": 1}] if text else []
```

---

## H5 · Chart (owner: P1)

```python
trend_chart(df, result, remove_seasons: bool = True, title: str = "") -> plotly Figure
```
- `remove_seasons=True`: plot `result["anomaly"]` + `result["trend"]` + shaded band.
- `remove_seasons=False`: plot raw `df["value"]` only.
- Uses only `df` and `result`. P3's guided demo page calls it as-is.

---

## H6 · The app runs (owner: P4, checked at every sync)

- `pip install -r requirements.txt` then `streamlit run app.py` works on a fresh laptop.
- `requirements.txt` is owned by P4: ask P4 to add any package you need.

| File | Owner |
|---|---|
| `app.py`, `charts.py` | P1 |
| `scripts/download_giovanni.py`, `scripts/convert_giovanni.py`, `data_io.py`, `data/raw/`, `data/*_*.csv`, `data/SOURCES.md` | P2 |
| `data/places.csv`, `data/variables.csv`, `search.py`, `explain.py`, `pages/` | P3 |
| `stats.py`, `tests/`, `requirements.txt`, deployment | P4 |

### Sync checklist (P4 runs it at hours 8, 20, 30)
- [ ] Every place × variable has a file with 288 rows (H1)
- [ ] `analyze()` returns every key above for every file, with no crash (H2)
- [ ] `explain()` gives a headline for every result, including ⚫ and ⚪ (H3)
- [ ] `search("is the desert drying")` returns sensible suggestions (H4)
- [ ] Chart shows with seasons on and off (H5)
- [ ] App starts from a clean install; every fake has been swapped for the real part (H6)
