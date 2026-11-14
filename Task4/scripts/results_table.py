"""Run the trend analysis for every place × variable and print/save a results table.

The team uses this table at sync 2 (hour 20) to pick the demo cases
(ideally one 🟢 significant and one ⚪/🟡 "not significant yet").

Run from the project folder:  python scripts/results_table.py
Saves results.csv next to this project.
"""
import os
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Final project: data_io.py sits in the project root. While we work in Task folders, use the
# Data person's real data_io.py from the sibling Task2 folder.
sys.path[:0] = [ROOT, os.path.join(os.path.dirname(ROOT), "Task2")]
from data_io import load_places, load_series, load_variables  # noqa: E402
from stats import analyze  # noqa: E402


def build_table():
    rows = []
    variables = load_variables()
    for _, place in load_places().iterrows():
        for _, var in variables.iterrows():
            try:
                r = analyze(load_series(place["id"], var["code"]), code=var["code"])
            except FileNotFoundError:
                continue  # that file doesn't exist (yet)
            rows.append({
                "place": place["id"], "variable": var["code"], "units": var["units"],
                "verdict": f"{r['emoji']} {r['verdict']}",
                "per_decade": r["slope_per_decade"], "ci_low": r["ci_low"], "ci_high": r["ci_high"],
                "p_value": r["p_value"], "mk_p_value": r["mk_p_value"],
                "period": f"{r['start']}..{r['end']}", "missing": r["n_missing"],
                "years_more": r["years_to_significance"],
                "percent": r.get("percent_change"),
                "reliability": r.get("reliability"),
                "tests_agree": r.get("tests_agree"),
            })
    return pd.DataFrame(rows).sort_values("p_value", na_position="last")


if __name__ == "__main__":
    table = build_table()
    pd.set_option("display.width", 200)
    print(table.to_string(index=False, float_format=lambda v: f"{v:.3g}"))
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results.csv")
    table.to_csv(out, index=False)
    print(f"\nSaved {out}")
