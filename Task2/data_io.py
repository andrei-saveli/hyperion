"""Load the project's data files (handshake H1). Owner: Data person.

Everyone reads data through these 3 functions instead of opening CSV files directly, so the file
layout can change in one place.

    load_places()                -> table of places   (id, name, lat, lon, west, south, east, north, type, story)
    load_variables()             -> table of variables (code, name, units, definition, keywords, source)
    load_series(place_id, code)  -> monthly data       (date, value), oldest first, NaN = missing

Where the files are looked for (first folder that exists):
- Final project: a `data/` folder next to this file (data/places.csv, data/lake_mead_TEMP.csv, ...).
- Task2 folder (now): the `cleaned/` folder next to this file.

places.csv and variables.csv are made by the Search + explainability person (H0). Until they
exist, the starting catalogue below (copied from docs/HANDSHAKES.md H0) is used instead.
"""
from io import StringIO
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = next((d for d in (HERE / "data", HERE / "cleaned") if d.is_dir()), HERE)

# Starting catalogue from docs/HANDSHAKES.md (H0). Only used if the real CSV file is missing.
STARTER_PLACES = """id,name,lat,lon,west,south,east,north,type,story
lake_mead,Lake Mead (USA),36.25,-114.5,-116,35,-113,37.5,desert,Is the desert around Lake Mead drying out?
niamey,"Niamey, Sahel (Niger)",13.5,2.0,1.0,12.5,3.0,14.5,savanna,Is the Sahel getting more or less rain?
svalbard,Svalbard (Arctic),78.25,15.5,14.0,77.5,17.0,79.0,polar,Is the Arctic warming?
"""
STARTER_VARIABLES = """code,name,units,definition,keywords,source
TEMP,Air temperature,°C,How warm the air is 2 metres above the ground.,temperature hot warm cold heat warming cooling climate,M2IMNXASM_5_12_4_T2M
RAIN,Rainfall,mm/day,Average amount of rain and snow that falls per day.,rain rainfall precipitation wet dry drought storm snow,GPM_3IMERGM_07_precipitation
SOILM,Soil moisture,kg/m²,How much water the soil holds where plant roots grow (1 kg/m² = 1 mm of water).,soil moisture drought dry drying wet farming plants roots desert,GLDAS_NOAH025_M_2_1_RootMoist_inst
EVAP,Evaporation,mm/day,How much water goes from the ground and plants into the air each day.,evaporation evapotranspiration water loss dry drying plants heat,GLDAS_NOAH025_M_2_1_Evap_tavg
"""


def _read_catalogue(filename: str, starter: str) -> pd.DataFrame:
    """Read data/<filename>; if it doesn't exist yet, use the starting catalogue."""
    path = DATA / filename
    if path.exists():
        return pd.read_csv(path)
    return pd.read_csv(StringIO(starter))


def load_places() -> pd.DataFrame:
    """All places. Columns: id, name, lat, lon, west, south, east, north, type, story."""
    return _read_catalogue("places.csv", STARTER_PLACES)


def load_variables() -> pd.DataFrame:
    """All variables. Columns: code, name, units, definition, keywords, source."""
    return _read_catalogue("variables.csv", STARTER_VARIABLES)


def load_series(place_id: str, code: str) -> pd.DataFrame:
    """Monthly data for one place and one variable.

    Returns columns `date` (datetime) and `value` (float, NaN = missing), sorted oldest first.
    Raises FileNotFoundError if that file doesn't exist (e.g. not downloaded yet).
    """
    path = DATA / f"{place_id}_{code}.csv"
    if not path.exists():
        raise FileNotFoundError(f"No data file for place '{place_id}' and variable '{code}': {path}")
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")  # empty cells become NaN
    return df[["date", "value"]].sort_values("date").reset_index(drop=True)
