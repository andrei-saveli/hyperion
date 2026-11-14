"""Download six NASA datasets and turn them into monthly 1-degree grids for the ByteMe website.

Datasets (all named in the challenge):
  GPM IMERG   rainfall                                   GPM_3IMERGM v07, 0.1 deg, monthly
  GLDAS Noah  root-zone soil moisture, evaporation, runoff GLDAS_NOAH025_M 2.1, 0.25 deg, monthly
  MODIS       vegetation greenness (NDVI)                MOD13C2 v061, 0.05 deg, monthly
  MODIS       land surface temperature                   MOD11C3 v061, 0.05 deg, monthly
  OMI         nitrogen dioxide (NO2)                     OMNO2d v003, 0.25 deg, DAILY -> monthly means
  AIRS        surface air temperature                    AIRS3STM v7.0, 1 deg, monthly

How it works
1. NASA's public catalogue (CMR, no login) lists every monthly (or daily) file.
2. For each file we ask NASA's subsetting service (OPeNDAP) for just the one variable we need,
   so we never download whole files.
3. Each grid is averaged into 1 x 1 degree squares (a square needs at least half of its small
   cells to have data, so coasts and gaps don't give misleading averages).
4. Every finished month is saved in Website/.nasa_cache/ (not in git). Stopping and restarting is
   safe: finished months are skipped.

Then `python3 Website/build_nasa_grids.py build` runs the project's trend code (Task4/stats.py)
on every square and writes the files the website reads (Website/data/nasa/).

Login: an Earthdata token is needed. This script sends no token itself: in our cloud session the
network proxy adds it. To run it elsewhere, set the environment variable EARTHDATA_TOKEN.

Run (from the repository root):
    python3 Website/build_nasa_grids.py download            # all six datasets (a few hours)
    python3 Website/build_nasa_grids.py download GPM OMI    # only some
    python3 Website/build_nasa_grids.py build               # all downloaded datasets
    python3 Website/build_nasa_grids.py build GPM AIRS      # only some

Needs: numpy, h5py (reading the files), pandas + scipy (the trend code).
"""
import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".nasa_cache"
CMR = "https://cmr.earthdata.nasa.gov/search/granules.umm_json"

# Each dataset: catalogue id, the variables to fetch, and how to turn one file into 1-degree grids.
DATASETS = {
    "GPM": {"collection": "C2723754851-GES_DISC", "paths": ["/Grid/precipitation"]},
    "GLDAS": {"collection": "C1342986036-GES_DISC",
              "paths": ["/RootMoist_inst", "/Evap_tavg", "/Qs_acc", "/Qsb_acc"]},
    "NDVI": {"collection": "C2565788914-LPCLOUD",
             "paths": ["/MOD_Grid_monthly_CMG_VI/Data_Fields/CMG_0_05_Deg_Monthly_NDVI"]},
    "LST": {"collection": "C2565788897-LPCLOUD",
            "paths": ["/MODIS_MONTHLY_0_05DEG_CMG_LST/Data_Fields/LST_Day_CMG",
                      "/MODIS_MONTHLY_0_05DEG_CMG_LST/Data_Fields/LST_Night_CMG"]},
    "OMI": {"collection": "C1266136111-GES_DISC", "daily": True,
            "paths": ["/HDFEOS/GRIDS/ColumnAmountNO2/Data_Fields/ColumnAmountNO2TropCloudScreened"]},
    "AIRS": {"collection": "C1701805662-GES_DISC",
             "paths": ["/ascending/Data_Fields/SurfAirTemp_A", "/descending/Data_Fields/SurfAirTemp_D"]},
}
MIN_VALID_SHARE = 0.5     # a 1-degree square needs data in at least half of its small cells
MIN_OMI_DAYS = 5          # an OMI monthly value needs at least this many days with data


# ---------------------------------------------------------------- downloading

def http_get(url, tries=6):
    """Download a URL, retrying on network errors and busy servers."""
    headers = {}
    if os.environ.get("EARTHDATA_TOKEN") and "opendap" in url:
        headers["Authorization"] = "Bearer " + os.environ["EARTHDATA_TOKEN"]
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as reply:
                return reply.read(), dict(reply.headers)
        except Exception as error:
            if attempt == tries - 1:
                raise
            if getattr(error, "code", None) in (401, 403):
                raise RuntimeError("NASA refused the login (401/403): check the Earthdata token") from error
            time.sleep(10 * (attempt + 1))


def list_files(collection):
    """Every file in a collection: [(start date 'YYYY-MM-DD', OPeNDAP address), ...], oldest first."""
    files, after = [], None
    while True:
        url = f"{CMR}?collection_concept_id={collection}&page_size=2000&sort_key=start_date"
        request = urllib.request.Request(url, headers={"CMR-Search-After": after} if after else {})
        with urllib.request.urlopen(request, timeout=120) as reply:
            items = json.load(reply)["items"]
            after = reply.headers.get("CMR-Search-After")
        for item in items:
            umm = item["umm"]
            start = umm["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:10]
            links = [u["URL"] for u in umm.get("RelatedUrls", []) if "opendap.earthdata.nasa.gov" in u["URL"]]
            if links:
                files.append((start, links[0]))
        if len(items) < 2000 or not after:
            return files


def fetch(address, paths):
    """Ask OPeNDAP for some variables of one file; returns {path: numpy array}."""
    import h5py
    url = address + ".dap.nc4?dap4.ce=" + urllib.parse.quote(";".join(paths), safe="/;")
    data, _ = http_get(url)
    if not data.startswith(b"\x89HDF"):
        raise RuntimeError(f"Not a data file: {data[:200]!r}")
    out = {}
    with h5py.File(io.BytesIO(data), "r") as f:
        for path in paths:
            out[path] = f[path.lstrip("/")][()]
    return out


# ---------------------------------------------------------------- turning a fine grid into 1-degree squares

def to_one_degree(grid, cells_per_degree):
    """Average a south-to-north, west-to-east global grid (NaN = missing) into 180 x 360 squares."""
    k = cells_per_degree
    blocks = grid.reshape(180, k, 360, k)
    valid = np.isfinite(blocks)
    count = valid.sum(axis=(1, 3))
    total = np.where(valid, blocks, 0).sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / count
    mean[count < MIN_VALID_SHARE * k * k] = np.nan
    return mean.astype(np.float32)


def convert(name, arrays):
    """One downloaded file -> {variable code: 1-degree grid}, in the website's units."""
    a = lambda path: arrays[path].astype(np.float64)
    if name == "GPM":                                  # (time, lon, lat), south first, mm per hour
        p = a("/Grid/precipitation")[0].T
        p[p < 0] = np.nan
        return {"GPM_RAIN": to_one_degree(p * 24, 10)}  # mm per day
    if name == "GLDAS":                                # (time, lat 60S..90N, lon), 0.25 degree
        def full(path):
            g = np.full((720, 1440), np.nan)
            part = a(path)[0]
            part[part <= -9999] = np.nan
            g[120:] = part                             # rows south of 60S have no data
            return g
        soil, evap = full("/RootMoist_inst"), full("/Evap_tavg")
        runoff = full("/Qs_acc") + full("/Qsb_acc")
        return {"GLDAS_SOILM": to_one_degree(soil, 4),             # kg/m2 = mm of water
                "GLDAS_EVAP": to_one_degree(evap * 86400, 4),      # kg/m2/s -> mm per day
                "GLDAS_RUNOFF": to_one_degree(runoff * 8, 4)}      # per 3 hours -> mm per day
    if name == "NDVI":                                 # north first, 0.05 degree, stored x 10000
        n = a("/MOD_Grid_monthly_CMG_VI/Data_Fields/CMG_0_05_Deg_Monthly_NDVI")
        n[n <= -3000] = np.nan
        return {"MODIS_NDVI": to_one_degree(n[::-1] / 10000, 20)}
    if name == "LST":                                  # north first, 0.05 degree, kelvin x 50
        out = []
        for path in ("/MODIS_MONTHLY_0_05DEG_CMG_LST/Data_Fields/LST_Day_CMG",
                     "/MODIS_MONTHLY_0_05DEG_CMG_LST/Data_Fields/LST_Night_CMG"):
            t = a(path)
            t[t == 0] = np.nan
            out.append(to_one_degree(t[::-1] * 0.02 - 273.15, 20))
        return {"MODIS_LST": ((out[0] + out[1]) / 2).astype(np.float32)}   # day-night average, degC
    if name == "AIRS":                                 # north first, 1 degree, kelvin
        both = []
        for path in ("/ascending/Data_Fields/SurfAirTemp_A", "/descending/Data_Fields/SurfAirTemp_D"):
            t = a(path)
            t[t <= -9999] = np.nan
            both.append(t[::-1] - 273.15)
        return {"AIRS_T2M": ((both[0] + both[1]) / 2).astype(np.float32)}  # day-night average, degC
    raise ValueError(name)


def omi_day(arrays):
    """One OMI day -> 1-degree NO2 grid in units of 10^15 molecules per cm2 (NaN = no data)."""
    n = arrays["/HDFEOS/GRIDS/ColumnAmountNO2/Data_Fields/ColumnAmountNO2TropCloudScreened"].astype(np.float64)
    n[n < -1e29] = np.nan                              # fill value
    return to_one_degree(n / 1e15, 4)


# ---------------------------------------------------------------- one month at a time

def month_file(name, month):
    return CACHE / name / f"{month}.npz"


def do_month(name, month, addresses):
    """Download and convert one month (for OMI: all its days). Saves the month to the cache."""
    spec = DATASETS[name]
    if spec.get("daily"):
        total = np.zeros((180, 360)); days = np.zeros((180, 360))
        for address in addresses:
            g = omi_day(fetch(address, spec["paths"]))
            ok = np.isfinite(g)
            total[ok] += g[ok]; days[ok] += 1
        with np.errstate(invalid="ignore", divide="ignore"):
            mean = total / days
        mean[days < MIN_OMI_DAYS] = np.nan
        grids = {"OMI_NO2": mean.astype(np.float32)}
    else:
        grids = convert(name, fetch(addresses[0], spec["paths"]))
    file = month_file(name, month)
    file.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(file.with_suffix(".tmp.npz"), **grids)
    file.with_suffix(".tmp.npz").rename(file)           # only complete months get the real name
    return name, month


def download(names, workers=8):
    jobs = []
    for name in names:
        files = list_files(DATASETS[name]["collection"])
        by_month = {}
        for start, address in files:
            by_month.setdefault(start[:7], []).append(address)
        todo = {m: a for m, a in by_month.items() if not month_file(name, m).exists()}
        if DATASETS[name].get("daily"):    # skip the current, unfinished month
            todo = {m: a for m, a in todo.items() if len(a) >= 20}
        print(f"{name}: {len(by_month)} months listed, {len(todo)} still to download", flush=True)
        jobs += [(name, m, a) for m, a in sorted(todo.items())]
    # Daily OMI months take longest: start them first so everything ends at about the same time.
    jobs.sort(key=lambda j: -len(j[2]))
    done = failed = 0
    with ThreadPoolExecutor(workers) as pool:
        futures = {pool.submit(do_month, *job): job for job in jobs}
        for future in as_completed(futures):
            name, month, _ = futures[future]
            try:
                future.result(); done += 1
            except Exception as error:
                failed += 1
                print(f"  FAILED {name} {month}: {error}", flush=True)
            if (done + failed) % 25 == 0 or done + failed == len(jobs):
                print(f"  {done + failed}/{len(jobs)} months ({failed} failed)", flush=True)
    if failed:
        print(f"{failed} months failed. Run the same command again to retry them.")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "download":
        download(sys.argv[2:] or list(DATASETS))
    elif command == "build":
        from build_nasa_tiles import build   # second half: trends + website files
        build(sys.argv[2:])
    else:
        print(__doc__)
