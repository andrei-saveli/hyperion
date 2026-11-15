"""Download NASA datasets and turn them into monthly 1-degree grids for the ByteMe website.

Datasets (all named in the challenge):
  GPM IMERG   rainfall                                   GPM_3IMERGM v07, 0.1 deg, monthly
  GLDAS Noah  root-zone soil moisture, evaporation, runoff GLDAS_NOAH025_M 2.1, 0.25 deg, monthly
  MODIS       vegetation greenness (NDVI)                MOD13C2 v061, 0.05 deg, monthly
  MODIS       land surface temperature                   MOD11C3 v061, 0.05 deg, monthly
  OMI         nitrogen dioxide (NO2)                     OMNO2d v003, 0.25 deg, DAILY -> monthly means
  AIRS        surface air temperature                    AIRS3STM v7.0, 1 deg, monthly

Datasets for particular kinds of places (oceans, ice, deserts, the upper air):
  SSH    sea level from satellite altimeters             NASA-SSH simple grid v1, 0.5 deg, WEEKLY -> monthly means
  CLSM   water stored on land (soil, snow, groundwater)  GLDAS_CLSM10_M 2.1, 1 deg, monthly
  M2AER  dust, smoke and sulfate haze in the air         MERRA-2 M2TMNXAER, 0.5 x 0.625 deg, monthly
  M2GLC  meltwater running off glaciers and ice sheets   MERRA-2 M2TMNXGLC, 0.5 x 0.625 deg, monthly
  AIRSX  methane, carbon monoxide, stratosphere temperature  AIRS3STM v7.0 (single pressure levels)

Pollution at the ground and from space:
  M2AERS  fine particles (PM2.5) and their parts, SO2 at the ground   MERRA-2 M2TMNXAER surface masses, from 2003
  M2CHM   carbon monoxide at the ground                         MERRA-2 M2TMNXCHM (COSC)
  OMSO2   sulfur dioxide column                                 OMSO2e v003, 0.25 deg, DAILY -> monthly means
  OMHCHO  formaldehyde column                                   OMHCHOd v003, 0.1 deg (every 5th pixel read), DAILY -> monthly
  OMAERUV UV aerosol index (smoke and dust)                     OMAERUVd v003, 1 deg, DAILY -> monthly means

How it works
1. NASA's public catalogue (CMR, no login) lists every monthly (or daily) file.
2. For each file we ask NASA's subsetting service (OPeNDAP) for just the one variable we need,
   so we never download whole files.
3. Each grid is averaged into 1 x 1 degree squares (a square needs at least half of its small
   cells to have data, so coasts and gaps don't give misleading averages).
4. Every finished month is saved in Website/.nasa_cache/ (not in git). Stopping and restarting is
   safe: finished months are skipped.

Then `python3 Website/build_nasa_grids.py build` runs the project's trend code (Website/stats.py)
on every square and writes the files the website reads (Website/data/nasa/).

Login: an Earthdata token is needed. This script sends no token itself: in our cloud session the
network proxy adds it. To run it elsewhere, set the environment variable EARTHDATA_TOKEN.

Run (from the repository root):
    python3 Website/build_nasa_grids.py download            # all datasets (a few hours)
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
from concurrent.futures import ProcessPoolExecutor, as_completed
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
    # "[6][][]" asks for one pressure level only. AIRS levels: 5 = 500 hPa, 6 = 400 hPa, 13 = 50 hPa.
    "AIRSX": {"collection": "C1701805662-GES_DISC",
              "paths": ["/ascending/Data_Fields/CH4_VMR_A[6][][]", "/descending/Data_Fields/CH4_VMR_D[6][][]",
                        "/ascending/Data_Fields/CO_VMR_A[5][][]", "/descending/Data_Fields/CO_VMR_D[5][][]",
                        "/ascending/Data_Fields/Temperature_A[13][][]", "/descending/Data_Fields/Temperature_D[13][][]"]},
    "SSH": {"collection": "C3309442935-POCLOUD", "weekly": True, "paths": ["/ssha"]},
    "CLSM": {"collection": "C1690022314-GES_DISC", "paths": ["/TWS_inst"]},
    "M2AER": {"collection": "C1276812866-GES_DISC", "paths": ["/DUEXTTAU", "/BCEXTTAU", "/OCEXTTAU", "/SUEXTTAU"]},
    "M2GLC": {"collection": "C1276812853-GES_DISC", "paths": ["/RUNOFF"]},
    # pollution
    "M2AERS": {"collection": "C1276812866-GES_DISC", "since": "2003-01",
               "paths": ["/DUSMASS25", "/SSSMASS25", "/BCSMASS", "/OCSMASS", "/SO4SMASS", "/SO2SMASS"]},
    "M2CHM": {"collection": "C1276812852-GES_DISC", "paths": ["/COSC"]},
    "OMSO2": {"collection": "C1266136112-GES_DISC", "daily": True,
              "paths": ["/HDFEOS/GRIDS/OMI_Total_Column_Amount_SO2/Data_Fields/ColumnAmountSO2"]},
    "OMHCHO": {"collection": "C1626121562-GES_DISC", "daily": True,
               "paths": ["/key_science_data/column_amount[0:5:1799][0:5:3599]"]},   # every 5th pixel: 0.5 degree
    "OMAERUV": {"collection": "C1266136096-GES_DISC", "daily": True,
                "paths": ["/HDFEOS/GRIDS/Aerosol_NearUV_Grid/Data_Fields/UVAerosolIndex"]},
}
MIN_VALID_SHARE = 0.5     # a 1-degree square needs data in at least half of its small cells
MIN_OMI_DAYS = 5          # an OMI monthly value needs at least this many days with data
MIN_SSH_WEEKS = 2         # a sea level monthly value needs at least this many weekly maps


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
            out[path] = f[path.split("[")[0].lstrip("/")][()]     # "[6][][]" (one level) is not part of the name
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


def overlap(source_edges, target_edges, wrap=None):
    """How much of each target cell is covered by each source cell along one axis (degrees).
    wrap = 360 for longitude, where the grid closes on itself."""
    w = np.zeros((len(target_edges) - 1, len(source_edges) - 1))
    for shift in ((0,) if wrap is None else (-wrap, 0, wrap)):
        lo = np.maximum(target_edges[:-1, None], source_edges[None, :-1] + shift)
        hi = np.minimum(target_edges[1:, None], source_edges[None, 1:] + shift)
        w += np.clip(hi - lo, 0, None)
    return w


# MERRA-2's own grid: 361 latitudes (-90..90, every 0.5) x 576 longitudes (-180..179.375, every 0.625)
_M2_LAT = overlap(np.clip(np.arange(-90.25, 90.5, 0.5), -90, 90), np.arange(-90.0, 91.0))
_M2_LON = overlap(np.arange(-180.3125, 179.8, 0.625), np.arange(-180.0, 181.0), wrap=360)


def merra_to_one_degree(grid):
    """Area-weighted average of a MERRA-2 grid (NaN = missing) into 180 x 360 one-degree squares."""
    valid = np.isfinite(grid)
    total = _M2_LAT @ np.where(valid, grid, 0) @ _M2_LON.T
    weight = _M2_LAT @ valid.astype(float) @ _M2_LON.T
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = total / weight
    mean[weight < MIN_VALID_SHARE] = np.nan           # a full square has weight 1 (1 degree x 1 degree)
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
    if name == "AIRSX":                                # north first, 1 degree, one pressure level each
        def level(asc, desc):
            both = []
            for path in (asc, desc):
                x = a(path)[0]
                x[x <= -9999] = np.nan
                both.append(x[::-1])
            with np.errstate(invalid="ignore"):
                return np.nanmean(both, axis=0)        # day-night average
        d = "/ascending/Data_Fields/", "/descending/Data_Fields/"
        return {"AIRS_CH4": (level(d[0] + "CH4_VMR_A[6][][]", d[1] + "CH4_VMR_D[6][][]") * 1e9).astype(np.float32),   # ppb
                "AIRS_CO": (level(d[0] + "CO_VMR_A[5][][]", d[1] + "CO_VMR_D[5][][]") * 1e9).astype(np.float32),      # ppb
                "AIRS_T50": (level(d[0] + "Temperature_A[13][][]", d[1] + "Temperature_D[13][][]") - 273.15).astype(np.float32)}
    if name == "CLSM":                                 # (time, lat 60S..90N, lon), 1 degree, mm of water
        g = np.full((180, 360), np.nan)
        part = a("/TWS_inst")[0]
        part[part <= -9999] = np.nan
        g[30:] = part                                  # rows south of 60S have no data
        return {"GLDAS_TWS": g.astype(np.float32)}
    if name == "M2AER":                                # MERRA-2 grid; how much each kind of particle dims light
        def field(path):
            x = a(path)[0]
            x[x > 1e14] = np.nan
            return x
        return {"MERRA2_DUST": merra_to_one_degree(field("/DUEXTTAU")),
                "MERRA2_SMOKE": merra_to_one_degree(field("/BCEXTTAU") + field("/OCEXTTAU")),   # soot + organic smoke
                "MERRA2_SULFATE": merra_to_one_degree(field("/SUEXTTAU"))}
    if name == "M2AERS":                               # MERRA-2 grid; kg/m3 at the ground -> micrograms per m3
        def mass(path):
            x = a(path)[0]
            x[x > 1e14] = np.nan
            return x * 1e9
        dust, salt, soot, organic, sulfate = (mass(p) for p in ("/DUSMASS25", "/SSSMASS25", "/BCSMASS", "/OCSMASS", "/SO4SMASS"))
        # PM2.5 the standard way for MERRA-2 (e.g. Buchard et al. 2016): organic carbon x 1.4 for the
        # rest of the organic molecule, sulfate x 1.375 for the ammonium that comes with it
        pm25 = dust + salt + soot + 1.4 * organic + 1.375 * sulfate
        return {"MERRA2_PM25": merra_to_one_degree(pm25), "MERRA2_BC": merra_to_one_degree(soot),
                "MERRA2_OC": merra_to_one_degree(1.4 * organic), "MERRA2_SO4": merra_to_one_degree(1.375 * sulfate),
                "MERRA2_DUST25": merra_to_one_degree(dust), "MERRA2_SO2": merra_to_one_degree(mass("/SO2SMASS"))}
    if name == "M2CHM":                                # MERRA-2 grid; carbon monoxide at the ground, ppb
        x = a("/COSC")[0]
        x[x > 1e14] = np.nan
        return {"MERRA2_CO": merra_to_one_degree(x)}
    if name == "M2GLC":                                # MERRA-2 grid; only where the land is covered by ice
        x = a("/RUNOFF")[0]
        x[x > 1e14] = np.nan
        return {"MERRA2_ICEMELT": merra_to_one_degree(x * 86400)}   # kg/m2/s -> mm per day
    raise ValueError(name)


def omi_so2_day(arrays):
    """One OMI SO2 day -> 1-degree grid in Dobson units (NaN = no data). Small negative values are
    normal retrieval noise and are kept, so the monthly average isn't pushed upwards."""
    x = arrays["/HDFEOS/GRIDS/OMI_Total_Column_Amount_SO2/Data_Fields/ColumnAmountSO2"].astype(np.float64)
    x[np.abs(x) > 1e20] = np.nan                       # fill value
    return to_one_degree(x, 4)


def omi_hcho_day(arrays):
    """One OMI formaldehyde day (every 5th 0.1-degree pixel = 0.5 degree) -> 1-degree grid, 10^15 molecules/cm2."""
    x = arrays["/key_science_data/column_amount[0:5:1799][0:5:3599]"].astype(np.float64)
    x[np.abs(x) > 1e20] = np.nan
    return to_one_degree(x / 1e15, 2)


def omi_aerosol_day(arrays):
    """One OMI day -> 1-degree UV aerosol index (above about 1 = smoke or dust that absorbs sunlight)."""
    x = arrays["/HDFEOS/GRIDS/Aerosol_NearUV_Grid/Data_Fields/UVAerosolIndex"].astype(np.float64)
    x[np.abs(x) > 1e20] = np.nan
    return x.astype(np.float32)


def ssh_week(arrays):
    """One weekly sea level map -> 1-degree grid in cm (NaN = land, ice or no data)."""
    h = arrays["/ssha"].astype(np.float64)             # (lat south first, lon 0..360), 0.5 degree, metres
    h[np.abs(h) > 100] = np.nan                        # fill value
    h = np.roll(h, 360, axis=1)                        # -> lon -180..180
    return to_one_degree(h * 100, 2)


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
    if spec.get("daily") or spec.get("weekly"):        # many maps per month: average them
        one, code, least = {"OMI": (omi_day, "OMI_NO2", MIN_OMI_DAYS), "SSH": (ssh_week, "SEA_LEVEL", MIN_SSH_WEEKS),
                            "OMSO2": (omi_so2_day, "OMI_SO2", MIN_OMI_DAYS), "OMHCHO": (omi_hcho_day, "OMI_HCHO", MIN_OMI_DAYS),
                            "OMAERUV": (omi_aerosol_day, "OMI_UVAI", MIN_OMI_DAYS)}[name]
        total = np.zeros((180, 360)); days = np.zeros((180, 360))
        for address in addresses:
            g = one(fetch(address, spec["paths"]))
            ok = np.isfinite(g)
            total[ok] += g[ok]; days[ok] += 1
        with np.errstate(invalid="ignore", divide="ignore"):
            mean = total / days
        mean[days < least] = np.nan
        grids = {code: mean.astype(np.float32)}
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
            if DATASETS[name].get("weekly"):           # weekly maps are named after their middle day: ..._YYYYMMDD
                day = address.rsplit("_", 1)[-1][:8]
                start = f"{day[:4]}-{day[4:6]}-{day[6:8]}"
            by_month.setdefault(start[:7], []).append(address)
        todo = {m: a for m, a in by_month.items() if not month_file(name, m).exists() and m >= DATASETS[name].get("since", "")}
        if DATASETS[name].get("daily"):    # skip the current, unfinished month
            todo = {m: a for m, a in todo.items() if len(a) >= 20}
        if DATASETS[name].get("weekly"):   # a month needs at least three weekly maps
            todo = {m: a for m, a in todo.items() if len(a) >= 3}
        print(f"{name}: {len(by_month)} months listed, {len(todo)} still to download", flush=True)
        jobs += [(name, m, a) for m, a in sorted(todo.items())]
    # Daily OMI months take longest: start them first so everything ends at about the same time.
    jobs.sort(key=lambda j: -len(j[2]))
    done = failed = 0
    # Separate processes, not threads: reading the files keeps the processor busy, and Python threads
    # can only use one processor core at a time.
    with ProcessPoolExecutor(workers) as pool:
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
        download(sys.argv[2:] or list(DATASETS), int(os.environ.get("WORKERS", 8)))   # WORKERS=12 for more parallel requests
    elif command == "build":
        from build_nasa_tiles import build   # second half: trends + website files
        build(sys.argv[2:])
    else:
        print(__doc__)
