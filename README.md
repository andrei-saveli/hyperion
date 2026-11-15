# ByteMe: Earth System Trend Detective

**NASA Space Apps Challenge**, *Be An Earth System Trend Detective!* · Team **Byte Me Analytics**

Ask a question in plain words ("Is the air in Delhi getting more polluted?", "Is sea level rising in
Venice?") or click any place on Earth. ByteMe reads NASA's monthly records for that place, removes the
seasons, fits a straight-line trend and tells you **what** is changing, **where**, **how much**, and
whether the change is **statistically significant**.

## Run it

```bash
python3 -m http.server 8000 --directory Website
```

Then open http://localhost:8000. Nothing to install: the site is plain HTML and JavaScript.
To put it online, upload the `Website/` folder to any static hosting.

## What it does

| Step | What the visitor sees |
|---|---|
| **Ask** | A search box that understands places (cities, countries, rivers, seas) and questions. Keyword rules first, then a small language model that runs in the browser for questions worded without keywords. |
| **Answer** | A direct answer (*Yes* / *No, the opposite* / *Maybe* / *No clear change yet*) with the change per decade, total change and p-value. |
| **Evidence** | The monthly record with seasons removed, the trend line and its 95% band; a second test (seasonal Mann-Kendall); a second data source where one exists. |
| **What is changing here** | Every one of the 62 measurements tested for the chosen place, strongest evidence first. |
| **Investigate** | How much of a trend possible drivers statistically account for, and what's left (never a claim about causes). |
| **Places changing like this one** | The five regions of the planet whose pattern of change is most similar. |

**62 measurements** from NASA POWER (MERRA-2 and CERES, asked live, no login) and prepared NASA
satellite and model grids: GPM rain, GLDAS soil water, MODIS greenness and land temperature, OMI NO₂,
SO₂ and formaldehyde, AIRS methane and carbon monoxide, sea level from satellite altimeters, MERRA-2
fine particles (PM2.5), dust, smoke and more. Countries and regions are averaged over their outline.

**Statistics:** each calendar month's average is estimated together with the trend line (removing the
seasons), the slope's 95% interval and t-test are corrected for month-to-month memory, and the seasonal
Mann-Kendall test with Sen's slope double-checks the result. As the challenge suggests, we stick to
linear trends and say plainly that a straight line is a simplification.

## Repository

```
Website/        the site (index.html, app.js, ...) and its Python build scripts. Start with Website/README.md
docs/           presentation deck and script, design reviews, data sources
archive/        earlier versions: Streamlit apps, Giovanni data, the team's first task folders
AGENTS.md       instructions for AI coding agents and the team's decisions
```

Tests: `node Website/tests/test_stats.js` (website math = Python math), `python3 -m pytest -q
Website/tests/test_stats_py.py`, and the other `Website/tests/test_*.js` files (some need Playwright).

## Data sources

[NASA POWER](https://power.larc.nasa.gov) and NASA Earthdata (GES DISC, PO.DAAC, LP DAAC) through
OPeNDAP. Details and dataset versions: [Website/README.md](Website/README.md). Other NASA and partner
resources from the challenge are listed in [AGENTS.md](AGENTS.md#resources).
