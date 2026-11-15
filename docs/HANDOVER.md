# ByteMe handover

ByteMe is the NASA Space Apps **Earth System Trend Detective** web app. The working branch
`codex/trend-detective` is based on `claude/epic-hypatia-eq4vfd`. The maintained frontend for
this investigation work is `Website/`. See the [root README](../README.md) for the preview
command and the [website guide](../Website/README.md) for hosting and source details.

## Where the website gets its data

| Source | How the website uses it |
|---|---|
| NASA POWER | The browser requests 18 monthly measurements for the selected grid cell. Most records begin in 1981. |
| GPM, AIRS, MODIS, GLDAS, OMI | Eight products are distributed as monthly 1° tiles in `Website/data/nasa/`. An Earthdata account is needed when rebuilding the tiles. |
| World overview | Precomputed trends from `Website/data/world.json` and the product-specific map files. The overview shows its own period while Explore refits the selection. |

The website uses deterministic phrase and keyword matching plus place-name services. Explore
keeps the full record cached when dates change. Compare matches valid calendar months for the
selected measurement at two places. It fits the trend in A minus B and estimates uncertainty
with a Newey–West adjustment. The follow-up compares the latest 15 years with the full shared record.

## Where to make a change

- `Website/app.js` loads data and manages the search, map, controls, and rendering.
  Inside it, `renderCompare` selects the analysis window and hands off to the finding and chart renders.
- `Website/investigation.js` parses periods, slices records, matches observed months, and computes
  the paired comparison. It has no browser or network dependencies.
- `Website/stats.js` fits the basic trend. Keep its single-series results in sync with
  `Task4/stats.py`. Run the parity test after changing either implementation.
- `Website/nasa.js` decodes the bundled tiles. `Website/data/variables.json` owns labels, units,
  search terms, source metadata, and second-source pairs.
- `Website/experiments.js` holds related-measurement predictions and the calculations for the
  London NO₂ experiment. The experiment UI is in `Website/london-case.js`. The
  [website guide](../Website/README.md#guided-london-case) documents the study data and rebuild.
- `Website/workbench.js` keeps the investigation ledger in memory by location and measurement.
  Each lead holds its original selected records so edits to the period picker cannot change
  old results. The module also computes descriptive lagged associations and matched before
  and after intervention comparisons. `Website/workbench-view.js` renders Explore's workspace
  and exports the ledger. The workspace and Compare views publish into the
  same ledger when Compare was opened from an investigation.

Use these checks after a website change.

```bash
node Website/tests/test_stats.js
node Website/tests/test_nasa.js
node Website/tests/test_investigation.js
node Website/tests/test_experiments.js
```

In the browser, try Svalbard air temperature from 2001 to 2015. Open Compare, select a short
window, then recheck the full shared record. Reopen a shared URL to check that it restores the
places, measurement, and selected months. In Explore, add a custom explanation and reopen its
entry after changing the date selection. Open a dated comparison from that workspace and save
it to the notes.
In the London experiment, make a prediction, inspect the held-out weeks, then run the comparison
and toggle both sensitivity checks.

## Python reference workflow

The reference workflow uses the 12 saved NASA Giovanni series in `Task2/`. They cover air
temperature, rainfall, root-zone soil moisture, and evaporation for Lake Mead, Niamey, and
Svalbard from January 2001 through December 2024. Keep Svalbard soil moisture out of guided demos
because the grid includes glacier cover. The [reference results](../Task4/RESULTS.md) describe
those series.

To assemble the Streamlit reference app, use Python 3.11 or later. The assembly command recreates
its output directory.

```bash
python Task4/scripts/combine.py --frontend FrontEnd_claude --out final/reference --no-checks
cd final/reference
pip install -r requirements.txt
streamlit run app.py
```

See [Task3's guide](../Task3/README.md) for optional Searchlight setup and
[the handshakes](HANDSHAKES.md) for shared Python interfaces. Use
[the data handover](PERSON_2_DATA_GIOVANNI_HANDOVER.md) to regenerate the Giovanni CSVs.
