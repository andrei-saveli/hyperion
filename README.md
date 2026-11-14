# Hyperion: Earth System Trend Detective

**NASA Space Apps Challenge**, *Be An Earth System Trend Detective!*

> 👥 **Team members: start with [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md)** to see who does what.

---

## The challenge in plain words

NASA satellites and computer models have measured the Earth for more than 20 years: temperature,
rain, plant cover, air pollution, soil moisture and much more. The data is public but hard to use.
There are thousands of variables, and the files are large and technical.

We are building **a tool that lets an ordinary person (a student or a curious adult) investigate
whether something on Earth is changing.** The tool must answer four questions:

| Question | Example answer |
|---|---|
| **What** is changing? | Soil moisture |
| **Where**? | Around Lake Mead, USA |
| **How much**? | −4% per decade, −9% since 2003 |
| **Is it real or just noise?** | Yes, statistically significant (p = 0.003) |

The last question is the key one. Data goes up and down naturally: wet years, dry years, seasons.
A **trend** is a steady drift underneath all that wobble. A **significance test** tells us whether
the drift is strong enough that it's very unlikely to be random chance.

### Two tricky points the challenge highlights
1. **Too many variables.** Users don't know what to look at, so the tool *suggests* variables that
   fit the place they pick.
2. **The same cause can push in opposite directions in different places.** Climate change makes
   some regions wetter and others drier. So the tool lets users **compare regions side by side**.

---

## How the finished product works: a user's journey

1. **Pick a place.** Click the Amazon on a world map, or choose "rain forest" from a list.
2. **Get suggestions.** *"In rain forests, scientists often watch vegetation greenness (NDVI),
   surface temperature and rainfall. Deforestation makes greenness drop and temperature rise."*
   Every variable has a one-line plain definition.
3. **See the data.** Pick "vegetation greenness". A chart shows monthly values from 2000 to today.
   A toggle removes the seasonal up-and-down so the long-term drift is easier to see.
4. **Get the verdict.** A trend line with a shaded uncertainty band appears, plus a **verdict card**:
   > 🟢 **Significant decrease.** Greenness dropped 6% per decade (2000–2025). There's less than a
   > 1% chance this is random. Likely cause: forest cleared for farming.

   If the trend is weak: ⚪ *"No clear trend yet. At this rate, about 8 more years of data would be
   needed to be sure."*
5. **Compare.** Add a second region and see the same variable rising there while it falls here.
6. **Learn by watching.** First-time users can play **demo cases**, guided walkthroughs like
   *"Is Lake Mead drying up?"* or *"Beijing vs. Delhi air pollution"*, that show a detective
   investigation step by step.

Verdict badges: 🟢 significant (p < 0.05) · 🟡 suggestive (p < 0.10) · ⚪ no clear trend.

---

## What runs under the hood

```
NASA data (MERRA-2, GLDAS, MODIS, GPM, OMI, AIRS)
        │  downloaded ahead of time as monthly data
        ▼
Backend (Python)
  • cuts out the selected region and averages it → one number per month
  • removes the seasonal cycle
  • statistics: trend line + t-test, Mann-Kendall test, Sen's slope, confidence interval,
    "years until significant"
        ▼
Frontend (website)
  • map to pick a region • charts • verdict card • compare view • demos • glossary
        ▲
AI (Claude): only suggests variables and explains results in plain language.
             It never invents numbers; all statistics come from real computation.
```

The data is **pre-downloaded** so the live demo in front of the judges never depends on NASA's
servers being fast or online.

### Statistics in one paragraph
For a region we average the data per month (weighted by area). We subtract the average value for
each calendar month to remove the seasons, leaving **anomalies**. A straight line fitted to the
anomalies gives the **rate of change**; a **t-test** and **95% confidence interval** show how sure
we are. The **Mann-Kendall test** checks for a steady rise or fall without assuming a bell-curve,
and **Sen's slope** gives a robust rate. We correct for the fact that one month is similar to the
next (autocorrelation), which would otherwise make trends look more certain than they are.

---

## Why this design can win
- Covers **all four official objectives**: choose a variable, get regional data, plot it, test the trend.
- Covers every **optional extra** the judges listed: guided questions, simple definitions, demo
  walkthroughs, AI suggestions, opposite regional trends.
- **Original twist:** the "years until significant" estimate.
- Built for the stated audience: the "detective case file" style turns statistics into a mystery
  to solve.

---

## Repository layout (planned)
```
backend/    Python: FastAPI app, stats module, data loaders, tests
frontend/   React website
data/       variables.yaml (catalogue + glossary), demo-case CSVs
scripts/    data download / preprocessing scripts
docs/       team plan, data contract, pitch material
```

## Data sources
Giovanni, GES DISC Hydrology Time Series, AppEEARS, NASA POWER, NOAA Climate Data Online, KNMI
Climate Explorer. Full list with links in [CLAUDE.md](CLAUDE.md#resources).
