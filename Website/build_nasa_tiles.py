"""Second half of build_nasa_grids.py: from downloaded 1-degree grids to the website's files.

Reads   Website/.nasa_cache/<dataset>/<YYYY-MM>.npz   (made by `build_nasa_grids.py download`)
Writes  Website/data/nasa/index.json                   what is available, dates, how to read tiles
        Website/data/nasa/<CODE>/<lat>_<lon>.bin        monthly series, one 10 x 10 degree tile per file
        Website/data/nasa/<CODE>_map.json               trend of every 2 x 2 degree square (map layer)

Most measurements are kept on 1-degree squares. Smooth fields (the upper air, dust, smoke, gases)
are kept on 2-degree squares (STEP below): a quarter of the file size, and nothing is lost that a
trend over a region would show.

Tile format (kept simple so the website can read it with a few lines of JavaScript):
  little-endian 16-bit integers; 100 squares (25 for 2-degree squares; south to north, then west
  to east inside the tile),
  each followed by all its months; value = number x scale + offset; -32768 = missing.

Run: python3 Website/build_nasa_grids.py build
"""
import json
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".nasa_cache"
OUT = HERE / "data" / "nasa"
sys.path.insert(0, str(HERE.parent / "Task4"))
from stats import analyze  # noqa: E402  (the project's real trend code)

TILE = 10                       # tile size in degrees
MISSING = -32768
# Which downloaded dataset holds which website measurement
SOURCES = {"GPM_RAIN": "GPM", "GLDAS_SOILM": "GLDAS", "GLDAS_EVAP": "GLDAS", "GLDAS_RUNOFF": "GLDAS",
           "MODIS_NDVI": "NDVI", "MODIS_LST": "LST", "OMI_NO2": "OMI", "AIRS_T2M": "AIRS",
           "SEA_LEVEL": "SSH", "GLDAS_TWS": "CLSM", "MERRA2_ICEMELT": "M2GLC",
           "MERRA2_DUST": "M2AER", "MERRA2_SMOKE": "M2AER", "MERRA2_SULFATE": "M2AER",
           "AIRS_CH4": "AIRSX", "AIRS_CO": "AIRSX", "AIRS_T50": "AIRSX",
           "MERRA2_PM25": "M2AERS", "MERRA2_BC": "M2AERS", "MERRA2_OC": "M2AERS", "MERRA2_SO4": "M2AERS",
           "MERRA2_DUST25": "M2AERS", "MERRA2_SO2": "M2AERS", "MERRA2_CO": "M2CHM",
           "OMI_SO2": "OMSO2", "OMI_HCHO": "OMHCHO", "OMI_UVAI": "OMAERUV"}
# Size of a square in degrees (1 unless listed here)
STEP = {"MERRA2_DUST": 2, "MERRA2_SMOKE": 2, "MERRA2_SULFATE": 2, "AIRS_CH4": 2, "AIRS_CO": 2, "AIRS_T50": 2,
        # pollution: fine particles (PM2.5) stay on 1-degree squares; their parts and the noisier gases on 2
        "MERRA2_BC": 2, "MERRA2_OC": 2, "MERRA2_SO4": 2, "MERRA2_DUST25": 2, "MERRA2_SO2": 2, "MERRA2_CO": 2,
        "OMI_SO2": 2, "OMI_HCHO": 2, "OMI_UVAI": 2}
# First month used (default: the first month downloaded). MERRA-2's dust, smoke and sulfate lean on
# satellite aerosol measurements that only exist since MODIS (Terra 2000, Aqua 2002): before that
# the model had far less to go on, and the 1982 and 1991 volcanic eruptions fill the early years
# with haze. Starting in 2003 keeps the trend from being a change in the observing system.
START = {"MERRA2_DUST": "2003-01", "MERRA2_SMOKE": "2003-01", "MERRA2_SULFATE": "2003-01"}
VERDICT_NUMBER = {"insufficient": 0, "none": 1, "possible": 2, "significant": 3}


def coarsen(cube, step):
    """months x 180 x 360 -> months x (180/step) x (360/step): average of the 1-degree squares inside."""
    if step == 1:
        return cube
    blocks = cube.reshape(cube.shape[0], 180 // step, step, 360 // step, step)
    with np.errstate(invalid="ignore"), __import__("warnings").catch_warnings():
        __import__("warnings").simplefilter("ignore")              # "mean of empty slice" where all are missing
        return np.nanmean(blocks, axis=(2, 4)).astype(np.float32)


def load(code):
    """All months of one measurement: (list of 'YYYY-MM', array months x 180 x 360). Gaps = NaN."""
    files = sorted(f for f in (CACHE / SOURCES[code]).glob("*.npz") if "tmp" not in f.name and f.stem >= START.get(code, ""))
    found = {f.stem: f for f in files}
    first, last = pd.Period(files[0].stem, "M"), pd.Period(files[-1].stem, "M")
    months = [str(p) for p in pd.period_range(first, last, freq="M")]
    cube = np.full((len(months), 180, 360), np.nan, dtype=np.float32)
    for i, month in enumerate(months):
        if month in found:
            cube[i] = np.load(found[month])[code]
    return months, cube


def trend_of(args):
    """Trend of one series -> (slope per decade, verdict number). Used for the map layer."""
    months, values, percent = args
    if np.isfinite(values).sum() < 24:
        return None, 0
    df = pd.DataFrame({"date": pd.to_datetime([m + "-01" for m in months]), "value": values})
    r = analyze(df, code="RAIN" if percent else None)
    slope = r["slope_per_decade"]
    return (None if slope is None else float(f"{slope:.3g}")), VERDICT_NUMBER[r["verdict"]]


def write_tiles(code, months, cube, step=1):
    """Monthly series in 10 x 10 degree tiles. cube: months x rows x columns of squares `step`
    degrees wide. Returns (scale, offset, list of tiles with data)."""
    n = TILE // step                                                     # squares along a tile's side
    low, high = np.nanmin(cube), np.nanmax(cube)
    offset = float((low + high) / 2)
    scale = float(max(high - low, 1e-9) / 65000)          # fits in -32500 .. 32500
    folder = OUT / code
    folder.mkdir(parents=True, exist_ok=True)
    tiles = []
    for row in range(0, 180 // step, n):
        for col in range(0, 360 // step, n):
            block = cube[:, row:row + n, col:col + n]                    # months x n x n
            if not np.isfinite(block).any():
                continue
            series = block.reshape(len(months), n * n).T                 # squares x months
            ints = np.where(np.isfinite(series), np.round((series - offset) / scale), MISSING)
            name = f"{row * step - 90}_{col * step - 180}"               # south-west corner, degrees
            (folder / f"{name}.bin").write_bytes(ints.astype("<i2").tobytes())
            tiles.append(name)
    return scale, offset, tiles


def map_layer(code, months, cube, percent, pool, low_level=None):
    """Trend of every 2 x 2 degree square (average of its four 1-degree squares).
    low_level: squares whose average is below it are marked "not enough data" (e.g. NO2 over clean
    oceans, where the satellite is near its detection limit and trends aren't trustworthy)."""
    coarse = coarsen(cube, 2)                                            # months x 90 x 180
    series = coarse.reshape(len(months), -1).T
    results = pool.map(trend_of, [(months, s, percent) for s in series], chunksize=64)
    if low_level is not None:
        with np.errstate(invalid="ignore"):
            level = np.nanmean(series, axis=1)
        results = [(None, 0) if not (lv >= low_level) else r for r, lv in zip(results, level)]
    return {"step": 2, "start": months[0], "end": months[-1],
            "note": "Squares in order south to north, then west to east. Slope per decade; verdict "
                    "0 not enough data, 1 no clear trend, 2 possible, 3 significant.",
            "slope": [r[0] for r in results], "verdict": [r[1] for r in results]}


def build(only=None):
    """only: optional list of dataset names (e.g. ['GPM', 'AIRS']) to build just those."""
    catalogue = json.loads((HERE / "data" / "variables.json").read_text())
    percent = {v["code"]: v["percent"] for v in catalogue["variables"]}
    low_level = {v["code"]: v.get("low_level") for v in catalogue["variables"]}
    OUT.mkdir(parents=True, exist_ok=True)
    index = {"tile": TILE, "missing": MISSING, "variables": {}}
    if only and (OUT / "index.json").exists():      # building some datasets: keep the others
        index["variables"] = json.loads((OUT / "index.json").read_text())["variables"]
    with Pool() as pool:
        for code, dataset in SOURCES.items():
            if only and dataset not in only:
                continue
            if not (CACHE / dataset).exists():
                print(f"{code}: nothing downloaded yet, skipped")
                continue
            months, cube = load(code)
            gaps = int(sum(not np.isfinite(cube[i]).any() for i in range(len(months))))
            step = STEP.get(code, 1)
            scale, offset, tiles = write_tiles(code, months, coarsen(cube, step), step)
            layer = map_layer(code, months, cube, percent.get(code, False), pool, low_level.get(code))
            (OUT / f"{code}_map.json").write_text(json.dumps(layer, separators=(",", ":")))
            index["variables"][code] = {"start": months[0], "months": len(months), "scale": scale,
                                        "offset": offset, "tiles": tiles}
            if step != 1:
                index["variables"][code]["step"] = step
            print(f"{code}: {months[0]}..{months[-1]} ({len(months)} months, {gaps} missing), "
                  f"{len(tiles)} tiles, {sum(v == 3 for v in layer['verdict'])} significant map squares", flush=True)
    (OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))
    write_test_reference(index)
    print("Wrote", OUT)


def write_test_reference(index, places=((44.4, 26.1), (28.6, 77.2), (-3.1, -60.0), (78.2, 15.6), (0.5, -140.5), (-33.9, 151.2),
                                        (69.5, -49.5), (23.5, 10.5))):       # + Greenland's ice edge and the Sahara
    """Expected series for a few places, straight from the downloaded grids, so tests/test_nasa.js can
    check that the website reads the tiles back correctly."""
    cases = []
    for code in index["variables"]:
        if not (CACHE / SOURCES[code]).exists():
            continue
        step = STEP.get(code, 1)
        months, cube = load(code)
        cube = coarsen(cube, step)
        for lat, lon in places:
            row, col = min(180 // step - 1, int(np.floor((lat + 90) / step))), int(np.floor((lon + 180) / step)) % (360 // step)
            values = [None if not np.isfinite(x) else float(x) for x in cube[:, row, col]]
            cases.append({"code": code, "lat": lat, "lon": lon, "months": months, "values": values})
    (HERE / "tests" / "nasa_reference.json").write_text(json.dumps(cases, separators=(",", ":")))


if __name__ == "__main__":
    build(sys.argv[1:])
