# ByteMe website

ByteMe runs in the browser using HTML, CSS, and JavaScript. Visitors can search for a place or
click the map and see trends for the available NASA records at that location.

## How it works
```
NASA POWER requests and bundled NASA tiles → monthly records → single-series analysis in stats.js
                                                             → matched comparison in investigation.js
build_world.py and build_nasa_tiles.py     → precomputed map layers
```
- **Data:** the browser requests 18 monthly measurements from
  [NASA POWER](https://power.larc.nasa.gov/) (MERRA-2 and CERES) for the selected location.
  Most start in 1981. Sunlight and clouds start in 1984, and haze starts in 2001. Coverage and grid
  resolution vary by product. The catalog with units and definitions lives in `data/variables.json`.
- **Trend math:** seasons removed (the 12 monthly averages are estimated together with the trend
  line), straight-line trend, significance corrected for month-to-month memory, seasonal
  Mann-Kendall as a second test. `stats.js` ports the shared trend method from `Task4/stats.py`.
  Keep their shared calculations aligned and run `tests/test_stats.js` after a change. It checks
  both implementations against 105 real series.
- **Search:** understands a place ("Bucharest"), a question ("is Romania getting warmer?"), a
  famous region ("Sahel") or coordinates ("44.4, 26.1"). Simple rules, no AI:
  1. *Measurement:* each measurement in `data/variables.json` has `phrases` (several words, strong)
     and `keywords` (single words). The best score wins.
  2. *Unavailable measurements* such as river discharge and crop yield are listed in
     `not_available`. The search can offer a related measurement from the catalog.
  3. *Place:* well-known regions first ("Sahel"), then names written with capital letters
     ("Hoover Dam"), then the leftover words. Each is looked up in Photon (OpenStreetMap, good for
     lakes, dams, islands) and Open-Meteo (GeoNames, good for towns).
  "Why" questions get the reminder that we show what changed, not why.
- **How good is the search?** Checked on Task3's search benchmark questions (agent-written drafts,
  not real students yet). Rules were tuned on the 144 draft questions and then tested once on the
  48 fresh questions, which were kept aside:

  | Question set | Right measurement | Right place and measurement (first suggestion) | "Not available" requests answered without a note |
  |---|---|---|---|
  | 144 draft (used for tuning) | 110/114 | 94/114 | 1/24 |
  | 48 fresh (held out) | 36/36 | 33/36 | 1/12 |

  (Re-run after adding the 8 satellite/model measurements; greenness, NO₂ and runoff questions now
  count as answerable.) Most misses are riddle-style places ("Niger's capital", "the Nevada reservoir"). Questions that
  ask for several measurements get one suggestion. **Browse measurement trends** shows the rest.
- **World overview:** NASA POWER trends come from the precomputed 5° map in `data/world.json`.
  The bundled products have their own 2° overview maps.

## Investigate a period

- **Explore:** change the From and To months and choose **Apply period**. The trend list and the
  evidence panel rerun from the cached records. Search also accepts dates such as
  “Manaus rainfall from 2001 to 2015” or “temperature in Bucharest since 2010.” The address
  includes the selected period. The world map shows its precomputed overview period.
- **Compare:** choose two places and one measurement. The default uses the full shared record.
  Both charts use exactly the months in which both places have values. The finding reports how
  the rates differ by fitting the series of paired monthly differences, with an approximate 95%
  Newey–West interval using 12 calendar-month lags when there is enough usable data.
- Short windows still show the observations against a seasonal baseline from the full record.
  A trend verdict requires at least 24 observations spanning 10 years.
  After a comparison, **Check the latest 15 years** lets you test how sensitive the finding is to
  the period. A narrower comparison shows the estimated difference for the full shared record
  as a reference. **Share comparison** opens a link containing both places, the measurement, and
  the selected dates.

## Guided experiments

**London NO₂.** The case tests whether central London’s Ultra Low Emission Zone, launched on
8 April 2019, contributed to lower roadside nitrogen dioxide. The user makes a prediction, checks
the comparison before launch, then tests the post-launch gap by changing the time window, allowing
the earlier gap to continue, or removing the largest donor monitor.

The case uses weather-normalized weekly input released by Tong et al. (2025). ByteMe fits a
weighted combination of 13 non-London roadside monitors to London before the policy, with a
constant level adjustment. It reserves the last eight pre-policy weeks to show how well the
comparison predicts London outside the fitting period. In those eight weeks London was already
5.7 µg/m³ below the comparison. The first 13 post-launch weeks averaged 11.9 µg/m³ below the
comparison. Carrying the earlier gap forward reduces the estimated difference. These checks
inform the causal interpretation and leave room for London-specific changes or early responses
to the policy. The authors’ augmented synthetic-control model has its own estimates.
[Study and method](https://pmc.ncbi.nlm.nih.gov/articles/PMC12545172/)

**Explore leads.** `experiments.js` holds prediction and rival-explanation text for a few linked
measurements. Compare the series on the same observed months. A lead is weakened when both trends
have reliable directions and the direction combination disagrees with the stated prediction.
The finding then shows the contrary observations, proposes a rival mechanism, and suggests
which evidence could separate the two. When the rival has a runnable check, it uses observations
shared with the original test and reports how many of those months it could use.
For a weakened root-zone wetness and precipitation prediction, **Test rival with evaporation**
compares soil wetness with the trend in monthly precipitation minus evaporation. The result
shows each rate on the three-way overlap. This check leaves questions about runoff, irrigation,
and water storage open.
The ordinary Explore results help screen hypotheses. The London case uses a control design
to estimate a policy effect.

### Rebuild the London comparison

Download the [pinned weekly study input](https://github.com/tu-xuu/London_ULEZ/blob/0ba2df44dec7a99b8d95e924cf1b1c59cc4ca623/data/ASCM_NO2.Rdata)
and save it as `ASCM_NO2.Rdata` outside the repository, or at the root temporarily. From a directory
containing the downloaded file, export it with R. Then run the builder from the repository root,
using the path to the exported CSV. The builder uses the existing Python NumPy, pandas, and SciPy
dependencies.

```bash
Rscript -e 'write.csv(readRDS("ASCM_NO2.Rdata"), "ASCM_NO2.csv", row.names = FALSE)'
python Website/build_london_case.py ASCM_NO2.csv
node Website/tests/test_experiments.js
```

`data/london-ulez.json` contains the derived weekly London and comparison series, the fitted
donor weights, and the comparison refitted without its largest donor.

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
- **Second source:** where two products track related measurements, the evidence panel fits both
  to their shared valid months and reports whether their trend directions agree.
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
| `app.js` | Page state, NASA requests, search, map and chart rendering. Compare renders its finding and charts separately. |
| `stats.js` | Trend and significance math (copy of `Task4/stats.py`) |
| `investigation.js` | Date selection, matched monthly records, and uncertainty for the difference in trends |
| `experiments.js` | Related-measurement predictions and London gap and sensitivity calculations |
| `london-case.js`, `build_london_case.py` | London experiment view and reproducible preprocessing of the fitted comparison |
| `nasa.js` | Reads one square's monthly series from a NASA tile file |
| `build_nasa_grids.py`, `build_nasa_tiles.py` | Download the NASA datasets to 1° grids; then trends, tiles and map layers (`data/nasa/`) |
| `globe.js` | Hero art: rotating globe of teal "satellite pixels", demo cases in coral (decoration only) |
| `data/variables.json` | The 26 measurements (18 NASA POWER + 8 satellite/model): code, name, units, definition, search words, second-source pairs |
| `data/world.json` | Precomputed NASA POWER trends on a 5° grid (made by `build_world.py`) |
| `build_world.py` | Rebuilds `data/world.json` with the Python trend code (about 25 minutes, can be stopped and restarted) |
| `tests/` | Single-series parity, NASA tile decoding, and period and matched-comparison checks |
| `data/land.geojson` | World land outline (Natural Earth, public domain): the fallback map |
| `vendor/maplibre-gl.css` | The map library's stylesheet (kept locally) |
| `build_data.py`, `data/results.json` | The earlier version (3 Giovanni regions). No longer read by the page; kept for reference |
| `design/` | Screenshots |

## Run it locally (from the repository root)

```bash
python -m http.server 8503 --bind 127.0.0.1 --directory Website
```
Open [http://127.0.0.1:8503](http://127.0.0.1:8503). Serving the directory over HTTP allows the
browser to load its JSON data and bundled grids.

## Check a change
```bash
node Website/tests/test_stats.js
node Website/tests/test_nasa.js
node Website/tests/test_investigation.js
node Website/tests/test_experiments.js
```
Refresh the single-series reference results after changing `Task4/stats.py`.
```bash
python3 Website/tests/make_reference.py
```

## Put it online
Upload the whole `Website/` folder to any static hosting: the free Space Apps domain hosting,
GitHub Pages, Netlify, etc.

## Notes
- Needs internet: NASA POWER (the data), Photon, Open-Meteo, BigDataCloud and Nominatim (place names), OpenFreeMap
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
