"""Build the world trend overview for the ByteMe website -> data/world.json

For every point of a coarse world grid (default: every 5 degrees), this script downloads the
monthly NASA POWER record for every measurement in data/variables.json and runs the project's
real trend code (Website/stats.py) on it. The website draws the result as coloured squares, so a
visitor sees at a glance WHERE each measurement is rising or falling.

Measurements that are already in data/world.json are kept as they are; only new ones are
downloaded and tested (use --all to redo everything).

Run (takes roughly 15-30 minutes, safe to stop and restart: finished points are kept):
    python3 Website/build_world.py            # 5 degree grid
    python3 Website/build_world.py --step 10  # quicker, coarser

No login is needed. Needs numpy, scipy and pandas (see Website/requirements.txt).
"""
import argparse
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
from stats import analyze  # noqa: E402  (the project's real trend code)

START_YEAR = 1981
END_YEAR = date.today().year - 1          # last complete year
API = ("https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={codes}&community=AG"
       "&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON")
VERDICT_NUMBER = {"insufficient": 0, "none": 1, "possible": 2, "significant": 3}


def download(lat, lon, codes):
    """Monthly values for one point, as {code: {"YYYYMM": value}}. Retries on network errors."""
    url = API.format(codes=",".join(codes), lon=lon, lat=lat, start=START_YEAR, end=END_YEAR)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=120) as reply:
                return json.load(reply)["properties"]["parameter"]
        except Exception as error:  # busy server or rate limit: wait and try again
            wait = 5 * (attempt + 1)
            print(f"  retry {lat},{lon} in {wait}s ({error})", flush=True)
            time.sleep(wait)
    return None


def to_frame(monthly, scale):
    """POWER's {"198101": 1.2, ..., "198113": yearly mean} -> date,value table (missing = NaN)."""
    rows = []
    for key, value in monthly.items():
        year, month = int(key[:4]), int(key[4:])
        if month > 12:
            continue  # "month 13" is POWER's yearly average, not a month
        rows.append((pd.Timestamp(year, month, 1), None if value == -999 else value * scale))
    return pd.DataFrame(rows, columns=["date", "value"])


def one_point(lat, lon, variables):
    data = download(lat, lon, [v["code"] for v in variables])
    if data is None:
        return None
    out = {}
    for v in variables:
        frame = to_frame(data[v["code"]], v.get("scale", 1))
        if v.get("absent_if_constant") and frame["value"].nunique() <= 1:
            out[v["code"]] = [None, 0]               # never changes (e.g. no sea ice here): not present
            continue
        r = analyze(frame, code="RAIN" if v["percent"] else None)
        slope = r["slope_per_decade"]
        out[v["code"]] = [None if slope is None else float(f"{slope:.3g}"), VERDICT_NUMBER[r["verdict"]]]
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", type=float, default=5.0, help="grid spacing in degrees")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--all", action="store_true", help="redo every measurement, not only new ones")
    args = parser.parse_args()

    everything = [v for v in json.loads((HERE / "data" / "variables.json").read_text())["variables"] if v.get("dataset") != "nasa"]
    step = args.step
    world_file = HERE / "data" / "world.json"
    old = json.loads(world_file.read_text()) if world_file.exists() and not args.all else None
    if old and old["step"] != step:
        old = None                                   # a different grid: start again
    variables = [v for v in everything if not (old and v["code"] in old["slope"])]
    if not variables:
        print("Nothing new to build.")
        return
    print("Building:", ", ".join(v["code"] for v in variables), flush=True)
    lats = [round(-90 + step / 2 + i * step, 3) for i in range(int(180 / step))]
    lons = [round(-180 + step / 2 + i * step, 3) for i in range(int(360 / step))]
    points = [(lat, lon) for lat in lats for lon in lons]

    partial_file = HERE / "data" / f"world_partial_{step:g}.json"     # lets you stop and restart
    done = json.loads(partial_file.read_text()) if partial_file.exists() else {}
    wanted = {v["code"] for v in variables}
    done = {k: r for k, r in done.items() if set(r) == wanted}        # left over from a different set: redo
    todo = [p for p in points if f"{p[0]},{p[1]}" not in done]
    print(f"{len(points)} grid points, {len(todo)} still to do", flush=True)

    with ThreadPoolExecutor(args.workers) as pool:
        for i, (point, result) in enumerate(zip(todo, pool.map(lambda p: one_point(*p, variables), todo)), 1):
            if result is not None:
                done[f"{point[0]},{point[1]}"] = result
            if i % 25 == 0 or i == len(todo):
                partial_file.write_text(json.dumps(done))
                print(f"  {i}/{len(todo)}", flush=True)

    missing = [p for p in points if f"{p[0]},{p[1]}" not in done]
    if missing:
        print(f"{len(missing)} points failed. Run the script again to retry them.")
        return
    world = {
        "built": date.today().isoformat(), "step": step, "start": START_YEAR, "end": END_YEAR,
        "note": "Per measurement: slope (units per decade) and verdict (0 not enough data, 1 no clear "
                "trend, 2 possible, 3 significant) for each grid point, in the order of 'points'.",
        "points": [[lat, lon] for lat, lon in points],
        "slope": {v["code"]: [done[f"{a},{b}"][v["code"]][0] for a, b in points] for v in variables},
        "verdict": {v["code"]: [done[f"{a},{b}"][v["code"]][1] for a, b in points] for v in variables},
    }
    if old:                                          # keep the measurements that were already there
        if old["points"] != world["points"] or old["start"] != START_YEAR or old["end"] != END_YEAR:
            print("data/world.json was built for other years or points. Run again with --all.")
            return
        for key in ("slope", "verdict"):
            world[key] = {**old[key], **world[key]}
    (HERE / "data" / "world.json").write_text(json.dumps(world, separators=(",", ":")))
    partial_file.unlink()
    print("Wrote data/world.json")


if __name__ == "__main__":
    main()
