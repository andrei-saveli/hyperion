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
- **How good is the search?** Checked on Task3's search benchmark questions (agent-written drafts,
  not real students yet). Rules were tuned on the 144 draft questions and then tested once on the
  48 fresh questions, which were kept aside:

  | Question set | Right measurement | Right place and measurement (first suggestion) | "Not available" requests answered without a note |
  |---|---|---|---|
  | 144 draft (used for tuning) | 112/114 | 95/114 | 1/30 |
  | 48 fresh (held out) | 36/36 | 32/36 | 1/12 |

  Most misses are riddle-style places ("Niger's capital", "the Nevada reservoir"). Questions that
  ask for several measurements get one suggestion; the "What is changing here" list shows the rest.
- **World overview:** the coloured squares on the map show where the chosen measurement is rising
  or falling (every 5 degrees). They come from `data/world.json`.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure: hero + demo cases, explore (search, map, list of trends, evidence), compare, method, footer |
| `style.css` | The look: colours, fonts, outlines, phone layout |
| `app.js` | Live data download, search, map (MapLibre), charts (Plotly), compare |
| `stats.js` | Trend and significance math (copy of `Task4/stats.py`) |
| `globe.js` | Hero art: rotating globe of teal "satellite pixels", demo cases in coral (decoration only) |
| `data/variables.json` | The 18 measurements: NASA code, name, units, definition, search keywords |
| `data/world.json` | World overview: trend of every measurement on a 5 degree grid (made by `build_world.py`) |
| `build_world.py` | Rebuilds `data/world.json` with the Python trend code (about 25 minutes, can be stopped and restarted) |
| `tests/` | `make_reference.py` (answers from the Python code) and `test_stats.js` (checks `stats.js` against them) |
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
