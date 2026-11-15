# Hyperion · Earth System Trend Detective

ByteMe is the team's [NASA Space Apps Challenge](https://www.spaceappschallenge.org/) website. It helps
students and curious readers see what changed in Earth's atmosphere, land, or water, where it changed,
and how certain the trend is.

## Run ByteMe

From the repository root, serve `Website/` with Python's static file server.

```bash
python -m http.server 8503 --bind 127.0.0.1 --directory Website
```

Open [http://127.0.0.1:8503](http://127.0.0.1:8503). The browser fetches 18 monthly measurements
directly from [NASA POWER](https://power.larc.nasa.gov/) and loads eight additional products from
the site's bundled NASA grids. The website needs internet for live records, map services, and chart
libraries.

Choose **Start an experiment** to test whether London’s 2019 emissions zone contributed to a drop
in roadside NO₂. Make a prediction, inspect the pre-policy comparison, and test whether the finding
changes under different assumptions. The case uses published roadside study data.

1. Search for a place, enter coordinates, or try `Is Svalbard getting warmer from 2001 to 2015?`.
   Search uses phrases, keywords, and place-name lookups.
2. Choose a measurement and use **Apply period** to update the trend, uncertainty interval, and chart.
   The **Raw monthly** option shows seasonal variation.
3. Open **Compare** to estimate the difference in trends over months observed at both locations.
   Try **Check the latest 15 years** to see how the finding depends on the period.
4. Choose **Test a lead** where ByteMe has a related measurement or a second source. The evidence
   can fit the prediction, weaken it, or leave the question open.

The app fits season-adjusted linear trends. Its results describe the recorded change and its uncertainty.
See the [website guide](Website/README.md) for the analysis, sources, and local checks.

## Repository

| Location | Purpose |
|---|---|
| [`Website/`](Website/) | ByteMe's HTML, CSS, and JavaScript, including live NASA data, period controls, and comparison. |
| [`Task2/`](Task2/) | Saved NASA Giovanni reference data for three regions, along with download and cleaning tools. |
| [`Task3/`](Task3/) | Python Searchlight, explanations, and guided lessons for the reference app. |
| [`Task4/`](Task4/) | Python trend analysis, tests, and the assembly script for the reference app. |
| [`FrontEnd_claude/`](FrontEnd_claude/) | Streamlit frontend for the Python reference workflow. |
| [`byte-me/`](byte-me/) | Separate splash-page prototype. |

Start with the [handover](docs/HANDOVER.md) for a maintainer's guide. The
[team plan](docs/PLAN.md), [shared interfaces](docs/HANDSHAKES.md), and [project instructions](AGENTS.md)
describe the team and the Python reference workflow. Giovanni download details are in the
[data handover](docs/PERSON_2_DATA_GIOVANNI_HANDOVER.md).
