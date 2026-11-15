# FrontEnd_claude: the Hyperion website (first version)

A working first version of the website (Person 1's part), built on the **real** parts of the
project: data from `Task2/`, the trend analysis from `Task4/`, explanations and search from `Task3/`.
Person 1 can take it from here and polish the look.

## Run it (from the repository root)
```bash
pip install -r FrontEnd_claude/requirements.txt
```
```bash
streamlit run FrontEnd_claude/app.py
```
```bash
python -m pytest -q FrontEnd_claude
```

## What's in it
| File | What it does |
|---|---|
| `app.py` | Front door: page setup and the menu (Investigate · Guided demo · How it works) |
| `investigate.py` | Main page: search + demo questions, place/measurement pickers, verdict card, chart, compare tab, map |
| `pages/` | Small links that open Person 3's pages from `Task3/pages/` (in the final project the real pages replace them) |
| `charts.py` | `trend_chart()` (handshake **H5**, reused by the guided demo page) and `place_map()` |
| `.streamlit/config.toml` | Theme: "mission control" dark blue + teal (users can switch to light in Settings) |
| `tests/test_app.py` | 6 tests: all 12 place × measurement combinations, demo buttons, warnings, toggle, search, compare |
| `design/` | Mock-ups (`mockup_*.png`, `mockup.html`) and screenshots of the real app (`app_*.png`) |

## Design
- **Answer first:** a big verdict card (🟢🟡⚪⚫ + headline from `explain()`), then 4 numbers: change per
  decade, total change (+ % for rain/soil moisture/evaporation), likely range (95%), p-value.
- **Honesty built in:** ⚠️ warnings for low reliability and when the two tests disagree; ⏳ "about X more
  years" for trends that aren't significant yet; "What does this mean?" and "Data & method" fold-outs.
- **Never a blank page:** a search box plus 4 demo questions chosen from the real results
  (`Task4/RESULTS.md`).
- **Compare tab:** same measurement, two places, **same scale**.
- **Phone-friendly:** everything stacks into one column.

## Rules it follows (from the brief)
- No statistics are computed here: numbers come from `analyze()`, wording about results from
  `explain()`. The app only formats and displays.
- Any missing number shows "–"; units everywhere; 2–3 significant digits.
- Never claims why something changed.

## Known limitations / next steps for Person 1
- The map needs internet (Plotly loads the world outline online).
- The Guided demo and How it works pages are Person 3's (`Task3/pages/`); the menu shows them
  automatically when they exist.

## In the final project
`python Task4/scripts/combine.py --frontend FrontEnd_claude` copies `app.py`, `investigate.py`,
`charts.py` and `.streamlit/` into `final/` next to the real data, stats, explain and search files.
