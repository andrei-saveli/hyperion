"""Build the website's data file: runs the real analysis once and saves everything as JSON.

Run from the repository root:  python Website/build_data.py
Writes:                         Website/data/results.json

The website is static (HTML + JavaScript), so it can't run Python. Our data is fixed and the
analysis always gives the same answer, so we compute every result here, in advance, with the
real project code:
  data_io.py (Task2)  -> places, variables, monthly series      (H0, H1)
  stats.py   (Task4)  -> trend, interval, p-values, verdict     (H2)
  explain.py (Task3)  -> plain-language headline and details    (H3)
Re-run this whenever the data, the stats or the explanations change.
"""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
# Final project: everything in the root. Task folders: look in Task2/3/4.
sys.path[:0] = [str(REPO)] + [str(REPO / t) for t in ("Task2", "Task3", "Task4")]

from data_io import load_series  # noqa: E402
from explain import explain  # noqa: E402
from stats import analyze  # noqa: E402

# Keys from analyze() the website uses (lists are rounded to keep the file small)
NUMBERS = ["slope_per_decade", "ci_low", "ci_high", "p_value", "mk_p_value", "total_change",
           "percent_change", "sen_slope_per_decade", "years_to_significance", "effective_n"]
TEXTS = ["start", "end", "n_months", "n_missing", "direction", "verdict", "reliability",
         "reliability_note", "tests_agree", "tests_note", "band_meaning", "method"]
SERIES = ["anomaly", "trend", "band_low", "band_high"]


def catalogue(name):
    """Person 3's catalogue (Task3/data) if present, else the project's data/ folder, else Task2's starter."""
    for path in (REPO / "Task3" / "data" / name, REPO / "data" / name):
        if path.exists():
            return pd.read_csv(path)
    import data_io
    return data_io.load_places() if name == "places.csv" else data_io.load_variables()


def clean(value, digits=5):
    """Round floats, turn NaN into None (JSON null), leave everything else alone."""
    if isinstance(value, float):
        return None if math.isnan(value) or math.isinf(value) else round(value, digits)
    return value


def main():
    places, variables = catalogue("places.csv"), catalogue("variables.csv")
    results, dates = {}, None
    for _, place in places.iterrows():
        for _, variable in variables.iterrows():
            try:
                df = load_series(place["id"], variable["code"])
            except FileNotFoundError:
                print(f"  skip {place['id']}_{variable['code']} (no data file)")
                continue
            r = analyze(df, code=variable["code"])
            text = explain(r, variable.to_dict(), place.to_dict())
            dates = df["date"].dt.strftime("%Y-%m").tolist()
            results[f"{place['id']}_{variable['code']}"] = {
                **{k: clean(r.get(k)) for k in NUMBERS},
                **{k: r.get(k) for k in TEXTS},
                **{k: [clean(v, 4) for v in r[k]] for k in SERIES},
                "value": [clean(v, 4) for v in df["value"].tolist()],
                "explain": text,
            }
            print(f"  {place['id']:10s} {variable['code']:5s} {r['verdict']}")

    out = {
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "dates": dates,
        "places": places.to_dict(orient="records"),
        "variables": variables.to_dict(orient="records"),
        "results": results,
    }
    (HERE / "data").mkdir(exist_ok=True)
    path = HERE / "data" / "results.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {path.relative_to(REPO)} ({path.stat().st_size // 1024} KB, {len(results)} results)")


if __name__ == "__main__":
    main()
