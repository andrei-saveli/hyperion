# Website: the ByteMe site (static, works for any place on Earth)

The public website. A visitor searches for any place (or clicks the map), and the site reads the
NASA record for that spot and tests **every measurement** for a trend: what is changing, how fast,
and whether the change is statistically significant.

**Static** means plain HTML + CSS + JavaScript: no server of our own, no login, nothing to install,
and it can be uploaded to any web hosting (e.g. the free Space Apps domain hosting).

## How it works
```
visitor picks a place ─► NASA POWER (live, no login) ─► stats.js ─► list of trends + chart + verdict
                         monthly data since 1981        (same math as Task4/stats.py, tested)

build_world.py (run once, Python, Task4/stats.py) ─► data/world.json ─► coloured squares on the map
```
- **Data:** [NASA POWER](https://power.larc.nasa.gov/) monthly values (MERRA-2 and CERES) for the
  grid square, about 50 km wide, around the chosen point. 18 measurements, listed with
  plain-language definitions in `data/variables.json`. Most start in 1981, sunlight and clouds in
  1984, haze in 2001.
- **Trend math:** seasons removed (the 12 monthly averages are estimated together with the trend
  line), straight-line trend, significance corrected for month-to-month memory, seasonal
  Mann-Kendall as a second test. `stats.js` is a line-by-line copy of the project's Python code
  (`Task4/stats.py`). `tests/test_stats.js` checks that both give the same numbers on 105 real
  series. If you change one, change the other and re-run the test.
- **Search:** understands a place ("Bucharest"), a question ("is Romania getting warmer?"), a
  famous region ("Sahel") or coordinates ("44.4, 26.1"). Simple rules, no AI:
  1. *Measurement:* each measurement in `data/variables.json` has `phrases` (several words, strong)
     and `keywords` (single words). The best score wins.
  2. *Things we don't have* (NO₂, river flow, crop yield, forecasts, hourly data...) are listed in
     `not_available`: the search says so plainly and offers the closest measurement we do have.
     Years before 1981 or after the last complete year get the same kind of note.
  3. *Place:* well-known regions first ("Sahel"), then names written with capital letters
     ("Hoover Dam"), then the leftover words. Each is looked up in Photon (OpenStreetMap, good for
     lakes, dams, islands) and Open-Meteo (GeoNames, good for towns).
  "Why" questions get the reminder that we show what changed, not why.
- **Countries and regions are averaged over their whole area** (`area.js`). The outline comes from
  OpenStreetMap (Nominatim); well-known regions such as the Sahel or the Amazon use a box.
  - NASA POWER: up to 16 evenly spaced points inside the outline (one request each).
  - Satellite and model grids: every 1° square inside the outline. For the very largest countries
    (Russia, Canada...) only the 24 tiles that cover most of them, to keep downloads reasonable.
  - Each square counts in proportion to cos(latitude), because squares nearer the poles cover less
    ground. A month needs data from at least half of the squares. The trend test then runs on the
    averaged record, exactly as for one place.
  - The map shows the outline, the panel says what the average is made of, and a button switches
    to the single grid square at the centre. Links keep the area: `#area=R90689,T2M,Romania`.
  - It takes about 5–10 seconds (Russia about 25). Compare also averages countries and regions.
- **Time periods** (`investigation.js`, from the `codex/trend-detective` branch): a From/To form in
  Explore and in Compare cuts every record to the chosen months and runs the trend test again.
  Questions can name a period ("since 2005", "2001 to 2015"), and links keep it
  (`#78.25,15.625,T2M,Svalbard?from=2001-01&to=2015-12`). The evidence panel always shows the
  whole-record result next to a chosen window, and warns that short windows are uncertain and easy
  to cherry-pick.
- **Compare uses the same months at both places.** Each place gets its own trend, and the finding is
  about the difference A − B (its 95% range uses a Newey–West adjustment over 12 months, because
  neighbouring months are not independent). A button checks the latest 15 years.
- **Direct answer:** a question gets an answer card right under the search box, for example
  "**Yes.** Air temperature in Romania is rising: +0.57 °C per decade since 1981". It checks the
  direction asked ("warmer", "drier", "cleaner"...) and answers *Yes*, *No, the opposite*, *Maybe*
  (possible, not significant yet) or *No clear change yet*. It also:
  - uses only that season's months when the question names one ("hotter in summer": June–August
    north of the equator, December–February south of it);
  - says when the place is much larger than one grid square (a country or big region), so the
    numbers describe the square near its centre;
  - adds the second-source result and a few related measurements to check (`related` in
    `variables.json`). These are suggestions to look at, never claims about causes.
- **How good is the search?** Checked on Task3's search benchmark questions (agent-written drafts,
  not real students yet). Rules were tuned on the 144 draft questions and then tested once on the
  48 fresh questions, which were kept aside:

  | Question set | Right measurement | Right place and measurement (first suggestion) | "Not available" requests answered without a note |
  |---|---|---|---|
  | 144 draft (used for tuning) | 110/114 | 94/114 | 1/24 |
  | 48 fresh (held out) | 36/36 | 33/36 | 1/12 |

  (Re-run after adding the 8 satellite/model measurements; greenness, NO₂ and runoff questions now
  count as answerable.) Most misses are riddle-style places ("Niger's capital", "the Nevada reservoir"). Questions that
  ask for several measurements get one suggestion; the "What is changing here" list shows the rest.
- **World overview:** the coloured squares on the map show where the chosen measurement is rising
  or falling (every 5 degrees). They come from `data/world.json`.

## NASA satellite and model data (GPM, GLDAS, MODIS, OMI, AIRS)
Eight more measurements come from the NASA datasets the challenge names. They need an Earthdata
login, so they are **prepared once** and saved with the site (`data/nasa/`), instead of being
asked for live like NASA POWER.

| Measurement | Dataset | Since | Pairs with (second source) |
|---|---|---|---|
| Rainfall (GPM satellites) | GPM IMERG monthly `GPM_3IMERGM` v07 | 1998 | Rain and snowfall (MERRA-2) |
| Air temperature (AIRS satellite) | AIRS monthly `AIRS3STM` v7.0, day/night average | 2002 | Air temperature (MERRA-2) |
| Land surface temperature (MODIS) | MODIS `MOD11C3` v061, day/night average | 2000 | Surface temperature (MERRA-2) |
| Vegetation greenness (MODIS) | MODIS NDVI `MOD13C2` v061 | 2000 | – |
| Root-zone soil moisture (GLDAS) | GLDAS Noah `GLDAS_NOAH025_M` 2.1 | 2000 | Root-zone soil wetness (MERRA-2) |
| Evaporation (GLDAS) | same | 2000 | Evaporation from land (MERRA-2) |
| Runoff (GLDAS) | same (surface + underground runoff) | 2000 | – |
| Nitrogen dioxide (OMI) | OMI `OMNO2d` v003, daily maps averaged by month (at least 5 days) | 2004 | – |

- **Grid:** every dataset is averaged into 1 x 1 degree squares (about 110 km). A square needs data
  in at least half of its small cells, so coasts and gaps don't give misleading averages.
- **Second source:** where a measurement exists twice, the evidence panel tests both over the
  years they share and says whether they agree. A significant trend that an independent
  satellite or model confirms gets "confirmed by ..." in the list.
- **Map:** the coloured squares for these measurements are 2 x 2 degrees (`data/nasa/<CODE>_map.json`).
- **NO₂ caution:** over clean areas (average below 1 × 10¹⁵ molecules/cm², e.g. oceans) OMI is near its
  detection limit and small trends can come from the instrument. Those squares are left blank on
  the map, and the evidence panel shows a caution note there (`low_level` in `variables.json`).

### Rebuild (needs an Earthdata token)
```bash
python3 Website/build_nasa_grids.py download
```
```bash
python3 Website/build_nasa_grids.py build
```
```bash
node Website/tests/test_nasa.js
```
`download` asks NASA's public catalogue (CMR) for the file list and NASA's subsetting service
(OPeNDAP) for one variable per file, so whole files are never downloaded. Finished months are
kept in `Website/.nasa_cache/` (not in git): the command can be stopped and started again.
Set `EARTHDATA_TOKEN` to your token (Earthdata profile → Generate Token) when running it on your
own computer. `build` runs `Task4/stats.py` for the map and writes the tiles; `test_nasa.js` checks
that the website reads them back correctly. Needs `numpy`, `h5py`, `pandas`, `scipy`.

The tiles add up to about 200 MB. Commit a rebuild only when it matters: every rebuild adds that
much to the repository's history.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure: hero + demo cases, explore (search, map, list of trends, evidence), compare, method, footer |
| `style.css` | The look: colours, fonts, outlines, phone layout |
| `app.js` | Live data download, search, map (MapLibre), charts (Plotly), compare |
| `stats.js` | Trend and significance math (copy of `Task4/stats.py`) |
| `nasa.js` | Reads one square's monthly series from a NASA tile file |
| `investigation.js` | Time periods: read periods from questions, cut records, match months at two places, A − B trend with a Newey–West range |
| `area.js` | Area averages: squares inside a country's or region's outline, weighted average of their records |
| `build_nasa_grids.py`, `build_nasa_tiles.py` | Download the NASA datasets to 1° grids; then trends, tiles and map layers (`data/nasa/`) |
| `globe.js` | Hero art: rotating globe of teal "satellite pixels", demo cases in coral (decoration only) |
| `data/variables.json` | The 26 measurements (18 NASA POWER + 8 satellite/model): code, name, units, definition, search words, second-source pairs |
| `data/world.json` | World overview: trend of every measurement on a 5 degree grid (made by `build_world.py`) |
| `build_world.py` | Rebuilds `data/world.json` with the Python trend code (about 25 minutes, can be stopped and restarted) |
| `tests/` | `make_reference.py` + `test_stats.js` (website math = Python math); `test_nasa.js` + `nasa_reference.json` (tiles read back correctly); `test_area.js` (outlines and area averages); `test_investigation.js` (periods and matched comparisons) |
| `data/land.geojson` | World land outline (Natural Earth, public domain): the fallback map |
| `vendor/maplibre-gl.css` | The map library's stylesheet (kept locally) |
| `build_data.py`, `data/results.json` | The earlier version (3 Giovanni regions). No longer read by the page; kept for reference |
| `design/` | Screenshots |

## Run it locally (from the repository root)
```bash
python3 -m http.server 8000 --directory Website
```
Then open http://localhost:8000 (opening `index.html` directly doesn't work: browsers block
reading the data files from a file). Nothing to build first.

## Check the math
```bash
node Website/tests/test_stats.js
```
To refresh the expected answers after changing `Task4/stats.py`:
```bash
python3 Website/tests/make_reference.py
```

## Put it online
Upload the whole `Website/` folder to any static hosting: the free Space Apps domain hosting,
GitHub Pages, Netlify, etc.

## Notes
- Needs internet: NASA POWER (the data), Photon, Open-Meteo, BigDataCloud and Nominatim (place names and outlines), OpenFreeMap
  (the detailed map), Google Fonts and jsDelivr (fonts and the two libraries). If the detailed map
  can't load, the built-in land outline is used instead.
- Demo cases (chosen from real results): Svalbard air temperature (+0.69 °C per decade),
  Beijing haze (falling) against Delhi haze (rising), Manaus rainfall (falling), Lake Mead surface
  soil wetness (possible, not significant yet).
- Shareable links: `#44.5,26.25,T2M,Bucharest` (latitude, longitude, measurement code, name).
- MERRA-2 blends satellite and ground observations with a weather model. Values describe a grid
  square, not a weather station, and long-term trends can be affected by changes in the observing
  system. We say what changed, never why.
- The site name ("ByteMe") appears in `index.html` only (title, logo, footer): one place to rename.
