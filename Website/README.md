# Website: the Hyperion site (static)

The public website: a light, clean design (Geist + Geist Mono fonts, thin outlines), an interactive
map where regions are coloured by their trend, and every result explained in plain language.

**Static** means plain HTML + CSS + JavaScript: no server, nothing to crash in the demo, and it can
be uploaded to any web hosting (e.g. the free Space Apps domain hosting).

## How it works
```
Task2 data  ─┐
Task4 stats ─┼─► build_data.py ─► data/results.json ─► index.html + app.js (the website)
Task3 explain┘    (runs once, in Python)                (only displays results)
```
All numbers and wording come from the project's real Python code. The website computes no
statistics.

## Files
| File | What it is |
|---|---|
| `index.html` | Page structure: hero + demo cases, explore (map + result), compare, method, footer |
| `style.css` | The look: colours, fonts, outlines, phone layout |
| `app.js` | Map (MapLibre), charts (Plotly), keyword search, compare, region selection |
| `build_data.py` | Runs the real analysis for every region × measurement → `data/results.json` |
| `data/results.json` | The pre-computed results the site reads (rebuild after any data/stats change) |
| `design/` | Screenshots |

## Run it locally (from the repository root)
```bash
python Website/build_data.py
```
```bash
python -m http.server 8000 --directory Website
```
Then open http://localhost:8000 (opening `index.html` directly doesn't work: browsers block
reading `results.json` from a file).

## Put it online
Upload the whole `Website/` folder (index.html, style.css, app.js, data/) to any static hosting:
the free Space Apps domain hosting, GitHub Pages, Netlify, etc. Rebuild `results.json` first.

## Notes
- Needs internet for the fonts (Google Fonts), map tiles (CARTO) and libraries (jsDelivr).
- Shareable links: `#niamey/EVAP` opens that region and measurement directly.
- The tool name ("Hyperion") appears in `index.html` only (title, logo, footer): one place to rename.
