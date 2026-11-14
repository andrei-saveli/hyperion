"""Sync checklist (hours 8, 20, 30): checks that everyone's parts fit together.

Checks handshakes H0–H4 from docs/HANDSHAKES.md automatically. Parts that don't exist yet
(e.g. explain.py before Person 3 delivers it) are reported as "not delivered yet", not errors.

Run from the project folder:  python scripts/check_handshakes.py
Exit code 0 = all delivered parts OK.
"""
import importlib
import json
import os
import sys

import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

PLACE_COLS = {"id", "name", "lat", "lon", "type", "story"}
VARIABLE_COLS = {"code", "name", "units", "definition", "keywords"}
H2_KEYS = {"slope_per_decade", "ci_low", "ci_high", "p_value", "mk_p_value", "total_change",
           "start", "end", "n_months", "n_missing", "direction", "verdict", "emoji",
           "anomaly", "trend", "band_low", "band_high", "years_to_significance", "method"}
VERDICTS = {"significant", "possible", "none", "insufficient"}

problems, notes = [], []


def check(ok, message):
    (notes if ok else problems).append(("✅ " if ok else "❌ ") + message)


def try_import(name):
    try:
        module = importlib.import_module(name)
    except ModuleNotFoundError:
        notes.append(f"⏳ {name}.py not delivered yet")
        return None
    if "FAKE" in open(module.__file__, encoding="utf-8").read(300):
        notes.append(f"⚠️  {name}.py is still the FAKE version")
    return module


data_io = try_import("data_io")
stats = try_import("stats")
explain = try_import("explain")
search = try_import("search")

if data_io:
    places, variables = data_io.load_places(), data_io.load_variables()
    check(PLACE_COLS <= set(places.columns), f"H0 places columns {sorted(PLACE_COLS - set(places.columns)) or 'ok'}")
    check(VARIABLE_COLS <= set(variables.columns), f"H0 variables columns {sorted(VARIABLE_COLS - set(variables.columns)) or 'ok'}")
    check(places["id"].is_unique, "H0 place ids are unique")
    for _, p in places.iterrows():
        for _, v in variables.iterrows():
            name = f"{p['id']}_{v['code']}"
            try:
                df = data_io.load_series(p["id"], v["code"])
            except FileNotFoundError:
                problems.append(f"❌ H1 {name}: file missing")
                continue
            ok = (list(df.columns[:2]) == ["date", "value"] and len(df) == 288
                  and df["date"].is_monotonic_increasing and df["date"].is_unique
                  and pd.api.types.is_datetime64_any_dtype(df["date"]))
            check(ok, f"H1 {name}: {len(df)} rows, {int(df['value'].isna().sum())} missing")
            if stats:
                r = stats.analyze(df)
                ok = (H2_KEYS <= set(r) and r["verdict"] in VERDICTS
                      and all(len(r[k]) == len(df) for k in ("anomaly", "trend", "band_low", "band_high")))
                try:
                    json.dumps(r)
                except (TypeError, ValueError):
                    ok = False
                check(ok, f"H2 {name}: {r['emoji']} {r['verdict']}")
                if explain:
                    e = explain.explain(r, v.to_dict(), p.to_dict())
                    check(isinstance(e, dict) and {"headline", "details", "caveat"} <= set(e)
                          and bool(e["headline"]), f"H3 {name}: explanation has headline/details/caveat")

if search:
    for text in ["is the desert drying", "", "zzzz"]:
        res = search.search(text)
        ok = isinstance(res, list) and len(res) <= 5 and all(
            {"place_id", "code", "reason", "score"} <= set(x) for x in res)
        check(ok, f"H4 search({text!r}) → {len(res)} suggestions")

for line in notes + problems:
    print(line)
print(f"\n{'ALL GOOD' if not problems else f'{len(problems)} PROBLEM(S)'}")
sys.exit(1 if problems else 0)
