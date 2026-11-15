# Website: the ByteMe site (static, works for any place on Earth)

The public website. A visitor searches for any place (or clicks the map), and the site reads the
NASA record for that spot and tests **every measurement** for a trend: what is changing, how fast,
and whether the change is statistically significant.

**Static** means plain HTML + CSS + JavaScript: no server of our own, no login, nothing to install,
and it can be uploaded to any web hosting (e.g. the free Space Apps domain hosting).

## How it works
```
visitor picks a place ─► NASA POWER (live, no login) ─► stats.js ─► list of trends + chart + verdict
                         monthly data since 1981        (same math as stats.py, tested)  

build_world.py (run once, Python, stats.py) ─► data/world.json ─► coloured squares on the map
```
- **Data:** [NASA POWER](https://power.larc.nasa.gov/) monthly values (MERRA-2 and CERES) for the
  grid square, about 50 km wide, around the chosen point. 35 measurements, listed with
  plain-language definitions in `data/variables.json`. Most start in 1981, sunlight and clouds in
  1984, haze, surface brightness and UV in 2001. Another 21 come from prepared satellite and model
  grids (see below), 56 in all.
- **Measurements for particular kinds of places:** half of the 56 only make sense in some
  terrains, so a visitor can investigate the sea, the ice, the mountains, a desert, a city or the
  upper air:

  | Where | Measurements |
  |---|---|
  | Ocean and coasts | Sea level (satellite altimeters), sea ice cover, peak wind of the month |
  | Ice, snow and mountains | Snow cover, snowfall, frost days, snow depth, ice-sheet meltwater runoff, surface brightness (albedo) |
  | Land and its water | Soil temperature, deep soil temperature (permafrost), deep soil wetness, water stored on land (soil + snow + groundwater) |
  | Deserts, fires and industry | Desert dust, smoke and soot, sulfate haze, carbon monoxide, methane |
  | Pollution in the air we breathe | Fine particles (PM2.5, with the WHO guideline), organic smoke particles and fine dust at ground level, sulfur dioxide (OMI satellite), plus haze and NO₂ |
  | Cities and people | Cooling need and heating need (degree days), day–night temperature range, dew point, UV index |
  | Levels of the atmosphere | Tropopause temperature and pressure (top of the weather layer), stratosphere temperature at 50 hPa, heat radiation from the sky |

  Where a measurement doesn't occur (sea ice in the Sahara, snowfall in Singapore: the same value
  every month), it is shown as "Not found here" instead of "no trend" (`absent_if_constant`). A
  measurement of the sea asked for a coastal town uses the nearest sea square within 200 km and
  says so (`nearest`); further inland the answer explains where it is measured (`where`).
- **Trend math:** seasons removed (the 12 monthly averages are estimated together with the trend
  line), straight-line trend, significance corrected for month-to-month memory, seasonal
  Mann-Kendall as a second test. `stats.js` is a line-by-line copy of the project's Python code
  (`Website/stats.py`). `tests/test_stats.js` checks that both give the same numbers on 105 real
  series. If you change one, change the other and re-run the test.
- **Search:** understands a place ("Bucharest"), a question ("is Romania getting warmer?"), a
  famous region ("Sahel") or coordinates ("44.4, 26.1"). Clear matches use keyword rules:
  1. *Measurement:* each measurement in `data/variables.json` has `phrases` (several words, 6 points),
     `keywords` (3), optional `weak` words (2) and the words of its name (2). Words match by their
     stem (warmer = warming = warm, hazier = haze). Where phrases overlap, the longest wins ("land
     surface temperature" beats "surface temperature"). Related measurements form `families`
     (temperatures, rain, soil, evaporation, humidity, pollution): members also get the family's
     words at 2, so a specific word plus a family word ("nights" + "warmer") beats a lone generic
     word, while plain "warmer" still means air temperature. Words of "not available" topics ("sea
     ice", "floods") are set aside first.
  2. *Things we don't have* (NO₂, river flow, crop yield, forecasts, hourly data...) are listed in
     `not_available`: the search says so plainly and offers the closest measurement we do have.
     Years before 1981 or after the last complete year get the same kind of note.
  3. *Place:* extract geographic names before scoring them as measurement words. Coordinates use
     a direct path. Place spans can be lowercase ("black sea") or include a qualifier ("Paris,
     Texas"). Well-known regions, capitalized names and leftover words also provide candidates.
     Photon (OpenStreetMap) and Open-Meteo (GeoNames) resolve the candidates.
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
  - It takes about 5–10 seconds (Russia about 25).
- **Time periods** (`investigation.js`, from the `codex/trend-detective` branch): a From/To form in
  Explore cuts every record to the chosen months and runs the trend test again.
  Questions can name a period ("since 2005", "2001 to 2015"), and links keep it
  (`#78.25,15.625,T2M,Svalbard?from=2001-01&to=2015-12`). The evidence panel always shows the
  whole-record result next to a chosen window, and warns that short windows are uncertain and easy
  to cherry-pick.
- **Compare was removed** (the two-place section, the Method section and the big footer): the page
  ends after Investigate with a one-line copyright. `investigation.js` still holds the matched-month
  and A − B functions (`matchMonths`, `fitComparison`) with their tests, if Compare comes back.
- **Investigate: the Trend Decomposer** (`decompose.js`, below the evidence panel and from the
  answer card). The student picks possible drivers (suggested per measurement in `variables.json`
  → `drivers`, or any other); the page works out how much of the trend each one **statistically
  accounts for**, and what is left:
  1. Seasons and trends are removed from every record; one regression links the outcome's
     month-to-month wiggles to all drivers' wiggles **together** (no double counting), optionally
     with a separate link per season (Dec–Feb, Mar–May, Jun–Aug, Sep–Nov). Fitting on wiggles
     means two unrelated records that both trend can't fake a link (spurious regression; tested).
  2. Each link × the driver's own record is that driver's **contribution**; observed trend =
     contributions + left over, exactly. The left-over record gets the usual trend test.
  3. Ranges: a **block bootstrap** (history re-run 400 times, whole years drawn at random).
  4. **Alibi check**: each driver's record is slid out of sync by 3, 4, … years and refitted; a real
     link must beat its own out-of-sync copies (a simple permutation p-value).
  5. **Across the planet**: in places at similar latitudes (±20°), do faster driver trends go
     with faster outcome trends? A second, independent line of evidence, from the world grids.
  6. "Use satellite data" swaps MERRA-2 drivers for independent ones (GPM, AIRS, MODIS, GLDAS).
  The page shows a balance sheet (observed → each driver → left over, with ranges), a scoreboard
  (links by season, contribution, alibi, verdict), the left-over chart and the planet scatter. It
  never says "cause". Example: Svalbard snow −4.8 cm/decade: air temperature has a real link
  (alibi p = 0.02; warm summers −6 cm per °C) but accounts for only ~9%; most of the loss is left over.
  Replaces the earlier evidence ladder (`docs/CAUSALITY_REVIEW.md` explains why sign-matching fails).
- **Geographic features** (rivers, lakes, seas, mountains, deserts, glaciers, islands, reefs…): when a
  name comes with a feature word ("Volga River", "Lake Baikal", "Caspian Sea"), the search also asks
  OpenStreetMap's main search (Nominatim, ranked by importance; at most one request per second,
  answers remembered) and keeps only results of that kind, retrying with the bare name ("Volga")
  when needed. Order: features with a real outline, then our region boxes, then features that are
  only a point, then towns. Big features that cross borders show no country ("Danube").
  - **Rivers and other lines are averaged along their course** (`area.js`): up to 16 points along
    the line and the 1° squares it passes through. These describe the land and air along the river,
    not its water.
  - A feature without an outline uses the box around it (Caspian Sea) or one grid square (Rocky
    Mountains), and the page says so.
  - Questions about things we don't have ("water level", "sea level") get **"We can't measure
    that"**, never a Yes/No about a substitute. The closest measurement is shown and labelled as a
    different quantity: runoff for water levels, sea-surface temperature for sea level. A measurement
    only suggested by a word inside the place name ("sea" in "Black Sea") doesn't count as asked.
  - Names typed as one word are split: "BlackSea" → "Black Sea", and "blacksea" is retried as "black
    sea" when nothing else matches ("Chelsea" stays Chelsea). "Sea" also matches lakes called seas
    (the Dead Sea).
- **Spelling mistakes:** when a question as typed finds no measurement, words are corrected to the
  nearest word the search knows ("temprature" → temperature, "precipitaion" → precipitation,
  "windspeed" → wind speed). Only words of 6 letters or more, one typing slip (two for words of 9+
  letters), same first letter, and only when exactly one known word is that close; words written with
  a capital letter, country and capital names and our regions are never changed. The suggestion list
  says what was corrected.
- **Riddle places:** "the capital of Peru", "Niger's capital", "the capital city of the UK" go to the
  capital (`data/capitals.json`, 197 countries from Wikidata, rebuilt by `build_capitals.py`); a country
  with several capitals offers each one. "UK", "USA", "Holland"... are searched as the full country name.
  Coordinates are also found inside a question ("temperature at 44.4, 26.1"). A name ending in "City"
  ("Salt Lake City") is a city, not a lake.
- **Place services and their rules:** while typing, Photon and Open-Meteo suggest places; Nominatim
  (outlines; rivers, seas and mountains by name) is asked only after Enter or a pick, as its usage policy
  requires, at most once per second, with answers kept in the browser for 30 days. Every request gives
  up after a time limit, so a slow service can't freeze the search.
- **Whole-search benchmark** (`tests/test_search_e2e.js` + `tests/search_e2e_questions.json`, needs
  Playwright and internet): measurement *and* place, first suggestion, as after pressing Enter. 30
  tuning and 30 held-out everyday questions with typos, lowercase names and riddles (held-out written
  before the changes and never tuned on):

  | | Before | After |
  |---|---|---|
  | Tuning: right measurement and place | 17/30 | (being measured) |
  | Held out: right measurement and place | 25/30 | (being measured) |
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
- **How good is the search?** Checked on Task3's search benchmark questions (`archive/Task3/`, agent-written drafts,
  not real students yet). Rules were tuned on the 144 draft questions and then tested once on the
  48 fresh questions, which were kept aside:

  | Question set | Right measurement | Right place and measurement (first suggestion) | "Not available" requests answered without a note |
  |---|---|---|---|
  | 144 draft (used for tuning) | 110/114 | 94/114 | 1/24 |
  | 48 fresh (held out) | 36/36 | 33/36 | 1/12 |

  (Re-run after adding the 8 satellite/model measurements; greenness, NO₂ and runoff questions now
  count as answerable.) Most misses are riddle-style places ("Niger's capital", "the Nevada reservoir"). Questions that
  ask for several measurements get one suggestion; the "What is changing here" list shows the rest.
- **Search by meaning (local language model):** weak, close and missing keyword matches also use
  all-MiniLM-L6-v2, a sentence transformer that runs on the visitor’s computer. The model loads
  on demand. The browser embeds the question and compares it with precomputed catalog vectors.
  When the best semantic match scores at least 0.42 and leads the nearest unrelated topic by at
  least 0.03, the search combines semantic and keyword ranks, giving weak keyword hits less weight.
  The answer card names the matching description. If the index or model fails, the search can
  still use keyword rules and place lookup. Place lookup starts while semantic matching runs.
  The model selects a measurement or an unavailable topic. NASA records supply the numbers.
- **Rebuild the meaning index** after changing names, definitions, or examples. With Playwright
  and Chromium installed, run from the repository root:

  ~~~sh
  python3 Website/get_search_model.py
  node Website/scripts/build_meaning_index.js
  node Website/tests/test_meaning.js
  ~~~

  The benchmark uses the original search revision in Git history. It compares the original
  fallback, gated ranking, and ranking on every eligible query. Keep the generated
  models/meaning-index.json and pinned model together. For an installed Chrome browser,
  playwright-core also works when CHROME_PATH points to the Chrome executable.
  The browser benchmark combines the two existing held-out question sets. All three strategies
  abstained on all eight off-topic queries. The place checks use simulated geocoder responses.

  | Strategy | Correct (62 answerable) | Wrong | Abstained | Semantic attempts (70 total) |
  |---|---:|---:|---:|---:|
  | Original fallback | 52 | 5 | 5 | 21 |
  | Gated fusion | 52 | 5 | 5 | 33 |
  | Always-on fusion | 53 | 4 | 5 | 68 |
- **Places changing like this one:** below Investigate, the five parts of the planet whose trends
  follow the closest pattern to the chosen place (nearest-neighbour search, `similar.js`). Each 5°
  square of `data/world.json` has a "fingerprint": its 18 NASA POWER trends, each compared with the
  whole planet ((trend − planet average) / planet spread, capped at ±3). The four temperatures, the
  three humidities and the two soil layers share one vote each, so temperature doesn't count four
  times. Similarity is the weighted cosine of two fingerprints (+1 same pattern, 0 unrelated, −1
  opposite), shown next to what a typical square scores. Land is compared with land and sea with
  sea; squares within 1,500 km (or inside the chosen country) are skipped and the five matches are
  at least 1,500 km apart. Each match lists up to three trends it shares (significant at both, same
  direction), is outlined on the map and opens with a click. It finds places that changed alike; it
  says nothing about why.
- **World overview:** the coloured squares on the map show where the chosen measurement is rising
  or falling (every 5 degrees). They come from `data/world.json`.

## NASA satellite and model data (GPM, GLDAS, MODIS, OMI, AIRS)
Seventeen measurements come from NASA datasets (the first eight are the ones the challenge names). They need an Earthdata
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
| Sea level | NASA-SSH simple grid v1 (TOPEX/Poseidon, Jason, Sentinel-6 altimeters), 0.5°, weekly maps averaged by month (at least 2) | 1992 | – |
| Water stored on land (GLDAS) | GLDAS Catchment `GLDAS_CLSM10_M` 2.1 (`TWS_inst`: soil, snow, canopy and shallow groundwater) | 2000 | – |
| Ice-sheet meltwater runoff | MERRA-2 `M2TMNXGLC` (`RUNOFF` over glaciated land) | 1980 | – |
| Desert dust · Smoke and soot · Sulfate haze | MERRA-2 `M2TMNXAER` (`DUEXTTAU`, `BCEXTTAU` + `OCEXTTAU`, `SUEXTTAU`), 2° squares | 2003 (the model has MODIS aerosol measurements to lean on from then; earlier years would show the observing system changing) | – |
| Fine particles (PM2.5) · organic particles · fine dust, at ground level | MERRA-2 `M2TMNXAER` surface masses (PM2.5 = dust + sea salt + soot + 1.4 × organic carbon + 1.375 × sulfate, as in Buchard et al. 2016; no nitrate, so city values are on the low side). PM2.5 on 1° squares, the others on 2° | 2003 |
| Sulfur dioxide (OMI) | OMI `OMSO2e` v003, daily maps averaged by month, 2° squares; caution below 0.15 DU | 2004 |

**Downloaded but left out, because their trends can't be trusted:** MERRA-2 soot, sulfate, SO₂ and CO at
ground level. The model's factory and traffic emission estimates stop being updated around 2010, so
Beijing's SO₂ "rises" 29 → 46 µg/m³ while OMI sees it collapse (0.41 → 0.09 DU). OMI formaldehyde and
UV aerosol index drift with the instrument (the aerosol index rises in every significant square on
Earth). MERRA-2's PM2.5, organic particles, smoke and sulfate haze carry a caution in their definition:
the total amount of particles is kept close to satellite measurements, but the split by source isn't.
| Methane · Carbon monoxide · Stratosphere temperature (AIRS) | AIRS `AIRS3STM` v7.0 at 400, 500 and 50 hPa, day/night average, 2° squares | 2002 | – |

- **Grid:** every dataset is averaged into 1 x 1 degree squares (about 110 km). A square needs data
  in at least half of its small cells, so coasts and gaps don't give misleading averages. MERRA-2's
  0.5 x 0.625 degree grid is averaged by how much of each cell lies inside the square. Smooth
  fields (dust, smoke, sulfate, methane, carbon monoxide, stratosphere temperature) are saved on
  2 x 2 degree squares (`step` in `data/nasa/index.json`), a quarter of the size.
- **What these are, honestly:** sea level is a satellite measurement. Dust, smoke, sulfate and
  ice-sheet runoff come from the MERRA-2 model, which takes in satellite aerosol measurements;
  water storage is a land model driven by weather data (it is not the GRACE satellite gravity
  measurement, which our login could not reach). AIRS methane and carbon monoxide describe the
  air several kilometres up, not at the ground.
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
own computer. `build` runs `stats.py` for the map and writes the tiles; `test_nasa.js` checks
that the website reads them back correctly. Needs `numpy`, `h5py`, `pandas`, `scipy`.

The tiles add up to about 410 MB. Commit a rebuild only when it matters: every rebuild adds that
much to the repository's history.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure: hero + demo cases, explore (search, answer, map, scrollable list of trends, evidence, investigate), one-line footer |
| `style.css` | The look: colours, fonts, outlines, phone layout |
| `app.js` | Live data download, search, answer card, map (MapLibre), charts (Plotly), investigate |
| `stats.py` | Trend and significance math in Python: the reference, used by the build scripts (tests: `tests/test_stats_py.py`) |
| `stats.js` | The same math in JavaScript for the browser (a tested copy of `stats.py`) |
| `requirements.txt` | Python packages for the build scripts and tests (`h5py` too for `build_nasa_grids.py`) |
| `nasa.js` | Reads one square's monthly series from a NASA tile file |
| `investigation.js` | Time periods: read periods from questions, cut records, match months at two places, A − B trend with a Newey–West range |
| `decompose.js` | Investigate (Trend Decomposer): joint seasonal regression on wiggles, contributions, block bootstrap, alibi (shift) test, across-the-planet check |
| `similar.js` | Places changing like this one: trend fingerprints, weighted cosine similarity, nearest squares far apart |
| `meaning.js` | Search by meaning: loads the local sentence transformer and matches a question to the measurement descriptions |
| `get_search_model.py` | Downloads the pinned model (`models/`) and its browser runtime (`vendor/transformers/`) and checks their SHA-256 |
| `models/all-MiniLM-L6-v2/` | The sentence transformer (Apache-2.0, from huggingface.co/Xenova/all-MiniLM-L6-v2, revision `751bff3`) |
| `vendor/transformers/` | Transformers.js 3.7.5 (Apache-2.0) with ONNX Runtime Web (MIT): runs the model in the browser |
| `area.js` | Area averages: squares inside a country's or region's outline, weighted average of their records |
| `build_nasa_grids.py`, `build_nasa_tiles.py` | Download the NASA datasets to 1° grids; then trends, tiles and map layers (`data/nasa/`) |
| `globe.js` | Hero art: rotating globe of teal "satellite pixels", demo cases in coral (decoration only) |
| `data/variables.json` | The 56 measurements (35 NASA POWER + 21 satellite/model): code, name, units, definition, search words, second-source pairs |
| `data/world.json` | World overview: trend of every measurement on a 5 degree grid (made by `build_world.py`) |
| `build_world.py` | Rebuilds `data/world.json` with the Python trend code (about 25 minutes, can be stopped and restarted) |
| `tests/` | `make_reference.py` + `test_stats.js` (website math = Python math); `test_nasa.js` + `nasa_reference.json` (tiles read back correctly); `test_area.js` (outlines and area averages); `test_investigation.js` (periods and matched comparisons); `test_decompose.js` (Trend Decomposer: known contributions, spurious trends, seasons, real Svalbard data); `test_search.js` + `search_questions.json` (search picks the right measurement; needs Playwright); `test_meaning.js` + `meaning_questions.json` (search by meaning; Playwright + model files); `test_similar.js` (places changing like this one) |
| `data/land.geojson` | World land outline (Natural Earth, public domain): the fallback map |
| `vendor/maplibre-gl.css` | The map library's stylesheet (kept locally) |

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
To refresh the expected answers after changing `stats.py`:
```bash
python3 Website/tests/make_reference.py
```

## Put it online
Any static hosting works; the recommended free option is Cloudflare Pages connected to the GitHub
repository (output directory `Website`, no build command). Step by step, the outside services and
their rules: [docs/DEPLOY.md](../docs/DEPLOY.md).

## Notes
- Needs internet: NASA POWER (the data), Photon and Open-Meteo (place names while typing, the name of a
  clicked point), Nominatim (outlines; rivers, seas and mountains by name, only after Enter or a pick,
  as its rules require; switch it off in `data/services.json`), OpenFreeMap
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
