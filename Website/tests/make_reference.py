"""Make the reference answers for test_stats.js using the project's Python trend code.

1. Downloads a few real NASA POWER monthly series (first run only; saved in fixtures/).
2. Adds the project's 12 Giovanni series (Task2/cleaned) and a few awkward made-up cases
   (gaps, too short, constant).
3. Runs Task4/stats.py on every series and saves series + answers to reference.json.

Run:  python3 Website/tests/make_reference.py     then:  node Website/tests/test_stats.js
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "Task4"))
from stats import analyze  # noqa: E402

POINTS = {"bucharest": (44.25, 26.25), "svalbard": (78.25, 15.625), "niamey": (13.5, 1.875),
          "amazon": (-3.25, -60.0), "pacific": (0.25, -140.0)}
VARIABLES = [v for v in json.loads((HERE.parent / "data" / "variables.json").read_text())["variables"] if v.get("dataset") != "nasa"]
KEYS = ["slope_per_decade", "ci_low", "ci_high", "p_value", "mk_p_value", "total_change", "start", "end",
        "n_months", "n_missing", "direction", "verdict", "years_to_significance", "sen_slope_per_decade",
        "lag1_autocorrelation", "effective_n", "reliability", "percent_change", "tests_agree",
        "anomaly", "trend", "band_low", "band_high"]


def power_series(name, lat, lon):
    file = HERE / "fixtures" / f"power_{name}.json"
    if not file.exists():
        codes = ",".join(v["code"] for v in VARIABLES)
        url = (f"https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={codes}&community=AG"
               f"&longitude={lon}&latitude={lat}&start=1981&end=2025&format=JSON")
        data = json.load(urllib.request.urlopen(url, timeout=120))["properties"]["parameter"]
        file.write_text(json.dumps(data, separators=(",", ":")))
    return json.loads(file.read_text())


def trimmed(dates, values):
    """Drop missing months before the first and after the last real value (as the website does)."""
    real = [i for i, v in enumerate(values) if v is not None]
    if not real:
        return dates, values
    return dates[real[0]:real[-1] + 1], values[real[0]:real[-1] + 1]


cases = []


def add(name, dates, values, percent):
    df = pd.DataFrame({"date": pd.to_datetime([f"{d}-01" for d in dates]),
                       "value": [np.nan if v is None else v for v in values]})
    result = analyze(df, code="RAIN" if percent else None)
    expected = {k: result[k] for k in KEYS}
    if len(cases) % 8:   # keep the long month-by-month lists for every 8th series only (smaller file)
        for k in ("anomaly", "trend", "band_low", "band_high"):
            del expected[k]
    cases.append({"name": name, "dates": dates, "values": values, "percent": percent, "expected": expected})


# real NASA POWER series
for place, (lat, lon) in POINTS.items():
    data = power_series(place, lat, lon)
    for v in VARIABLES:
        keys = sorted(k for k in data[v["code"]] if int(k[4:]) <= 12)
        dates = [f"{k[:4]}-{k[4:]}" for k in keys]
        values = [None if data[v["code"]][k] == -999 else data[v["code"]][k] * v.get("scale", 1) for k in keys]
        dates, values = trimmed(dates, values)
        if any(x is not None for x in values):
            add(f"power {place} {v['code']}", dates, values, v["percent"])

# the project's Giovanni series
for file in sorted((ROOT / "Task2" / "cleaned").glob("*.csv")):
    df = pd.read_csv(file)
    code = file.stem.split("_")[-1]
    values = [None if pd.isna(x) else float(x) for x in df["value"]]
    add(f"giovanni {file.stem}", [str(d)[:7] for d in df["date"]], values, code in ("RAIN", "SOILM", "EVAP"))

# awkward made-up cases
rng = np.random.default_rng(7)
months = [f"{2001 + i // 12}-{i % 12 + 1:02d}" for i in range(288)]
wave = [10 + 5 * np.sin(i / 12 * 2 * np.pi) + 0.01 * i + rng.normal(0, 1) for i in range(288)]
gappy = [None if (i % 17 == 0 or 100 <= i < 130) else round(v, 3) for i, v in enumerate(wave)]
add("made-up gaps", months, gappy, True)
add("made-up too short", months[:20], [round(v, 3) for v in wave[:20]], True)
add("made-up 9 years", months[:108], [round(v, 3) for v in wave[:108]], True)
add("made-up constant", months, [3.0] * 288, True)
add("made-up many ties", months, [float(rng.integers(0, 3)) for _ in range(288)], True)
add("made-up negative values", months, [round(v - 12, 3) for v in wave], True)

(HERE / "reference.json").write_text(json.dumps(cases, separators=(",", ":")))
print(f"Wrote reference.json with {len(cases)} series")
