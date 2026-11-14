"""Convert raw Giovanni CSVs into our clean format (handshake H1).

Reads   raw/<place>_<CODE>.csv      (as downloaded from Giovanni)
Writes  cleaned/<place>_<CODE>.csv  with columns date,value
Run:  python Task2/convert_giovanni.py   (works from any folder)
"""
from pathlib import Path

import pandas as pd

RAW = Path(__file__).resolve().parent / "raw"
OUT = Path(__file__).resolve().parent / "cleaned"
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
