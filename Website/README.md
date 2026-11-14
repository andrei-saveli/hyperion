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
- **Trend math:** `stats.js` is a line-by-line copy of the project's Python code
  (`Task4/stats.py`). `tests/test_stats.js` checks that both give the same numbers on 105 real
  series. If you change one, change the other and re-run the test.
- **Search:** Open-Meteo resolves place names. Searchlight ranks the 18 NASA POWER measurement
  descriptions when you ask a question such as "Has the air become warmer in Bucharest?"
  A place name ("Bucharest"), known region ("Sahel"), or coordinates ("44.4, 26.1") opens the
  place directly. For an exact measurement try "WS10M in Bucharest".
- **World overview:** the coloured squares on the map show where the chosen measurement is rising
  or falling (every 5 degrees). They come from `data/world.json`.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure: hero + demo cases, explore (search, map, list of trends, evidence), compare, method, footer |
| `style.css` | The look: colours, fonts, outlines, phone layout |
| `app.js` | Live data download, place lookup, map (MapLibre), charts (Plotly), compare |
| `searchlight.mjs` | POWER measurement ranking in the browser, exact catalog matches, and scope checks |
| `stats.js` | Trend and significance math (copy of `Task4/stats.py`) |
| `globe.js` | Hero art: rotating globe of teal "satellite pixels", demo cases in coral (decoration only) |
| `data/variables.json` | The 18 measurements: NASA code, name, units, definition, search keywords |
| `data/world.json` | World overview: trend of every measurement on a 5 degree grid (made by `build_world.py`) |
| `build_world.py` | Rebuilds `data/world.json` with the Python trend code (about 25 minutes, can be stopped and restarted) |
| `tests/` | Python reference results, trend parity tests, and the Searchlight comparison |
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

## Searchlight benchmark

The website lazily loads the pinned quantized MiniLM model (about 23 MB of weights) from
[Hugging Face](https://huggingface.co/Xenova/all-MiniLM-L6-v2/tree/b93c588d2682bc2c3ced0fae8a50f3f48004185a).
The model runs in the browser. Exact catalog names and parameter codes can match before the model
loads. Place lookup and manual measurement selection remain available if the model download fails.

The 0.40 cosine-similarity cutoff was selected on 50 development questions, with a 10% cap on
matches to unsupported requests. The embedding weights were frozen. The benchmark then compared
the fixed policy with the original keyword engine on 42 new draft questions. Both engines received
the measurement part of each question, with the location already resolved.

| Outcome | Keyword search | Searchlight |
|---|---:|---:|
| Correct measurement on a supported question | 21/28 | 25/28 |
| Wrong measurement on a supported question | 7/28 | 0/28 |
| Measurement suggested for an unsupported question | 6/14 | 1/14 |

Searchlight withheld three supported measurements and suggested monthly wind speed for one request
about an hourly reading. These questions are project-authored. The benchmark measures catalog
ranking and rejection with location supplied. The explorer displays the 95% confidence interval
for the slope computed from the selected monthly series, in the measurement's units per decade.
The relevance cutoff governs whether the search suggests a measurement.

To rerun the comparison, install the pinned test runtime with
`npm install --no-save --no-package-lock @huggingface/transformers@3.8.1` and run
`node Website/tests/benchmark_searchlight.mjs --predictions` from the repository root. Pass
`--calibrate` to reproduce cutoff selection using only the development questions.

## Put it online
Upload the whole `Website/` folder to any static hosting: the free Space Apps domain hosting,
GitHub Pages, Netlify, etc.

## Notes
- Needs internet: NASA POWER (the data), Open-Meteo and BigDataCloud (place names), OpenFreeMap
  (the detailed map), Google Fonts and jsDelivr (fonts and libraries), and Hugging Face (the
  Searchlight model). The map can use the built-in land outline if the detailed style is
  unavailable. Search, demos, and trend statistics also work in browsers without WebGL.
- Demo cases (chosen from real results): Svalbard air temperature (+0.69 °C per decade),
  Beijing haze (falling) against Delhi haze (rising), Manaus rainfall (falling), Lake Mead surface
  soil wetness (possible, not significant yet).
- Shareable links: `#44.5,26.25,T2M,Bucharest` (latitude, longitude, measurement code, name).
- MERRA-2 blends satellite and ground observations with a weather model. Values describe a grid
  square, not a weather station, and long-term trends can be affected by changes in the observing
  system. We say what changed, never why.
- The site name ("ByteMe") appears in `index.html` only (title, logo, footer): one place to rename.
