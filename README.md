# Hyperion: Earth System Trend Detective

**NASA Space Apps Challenge**, *Be An Earth System Trend Detective!*

> 👥 **Team members: start with [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md).** It is the
> authoritative 48-hour plan, including scope, contracts, scientific guardrails, ownership,
> and stop/go gates.

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
| **How strong is the evidence?** | Clear decrease; the 95% interval excludes zero |

The last question is the key one. Data goes up and down naturally: wet years, dry years, seasons.
A **trend** is a steady drift underneath all that wobble. Hyperion reports the estimated rate and
its uncertainty, while making the method, data source, and limitations visible.

### Two tricky points the challenge highlights
1. **Too many variables.** Users don't know what to look at, so the MVP guides them through a
   small, verified catalogue with plain-language explanations.
2. **The same variable can behave differently in different places.** The tool lets users compare
   two regions side by side without claiming that trend analysis alone establishes a cause.

---

## How the finished product works: a user's journey

1. **Pick a place.** Choose one of the verified regions and see its exact geometry on the map.
2. **Understand the variable.** Every curated variable has a plain definition, units, exact NASA
   source, resolution, coverage, and an explanation of what increasing values mean.
3. **See the data.** A chart shows the verified monthly record. A toggle removes the seasonal
   up-and-down so the long-term drift is easier to see.
4. **Read the evidence.** A trend line with a shaded uncertainty band appears, plus an evidence
   card stating the rate per decade, interval, record length, missing observations, and a cautious
   interpretation. The tool never turns a non-significant result into "no change exists" and never
   presents a cause as proven by a trend line.
5. **Compare.** Add a second region and see the same variable rising there while it falls here.
6. **Learn by watching.** First-time users can play one polished guided investigation that shows
   the complete evidence workflow step by step.

---

## What runs under the hood

```
NASA data (MERRA-2, GLDAS, MODIS, GPM, OMI, AIRS)
        │  downloaded ahead of time as monthly data
        ▼
Backend (Python)
  • cuts out the selected region and averages it → one number per month
  • removes the seasonal cycle
  • statistics: trend rate + dependence-aware uncertainty interval; optional robustness check
        ▼
Frontend (website)
  • map to pick a region • charts • verdict card • compare view • demos • glossary
        ▲
Optional AI: may help rephrase approved text after the MVP is stable.
             It never generates data, statistics, causes, or scientific conclusions.
```

The data is **pre-downloaded** so the live demo in front of the judges never depends on NASA's
servers being fast or online.

### Statistics in one paragraph
For a region we average the data per month using a documented spatial rule. We subtract each
calendar month's average to form **anomalies**. A fitted line estimates the rate of change. A
block bootstrap, autocorrelated-error model, or HAC method provides the 95% interval because
neighboring months are not independent. A seasonal/autocorrelation-aware Mann-Kendall test may
be shown as a secondary robustness check.

---

## Why this design can win
- Covers **all four official objectives**: choose a variable, get regional data, plot it, test the trend.
- Adds a guided, provenance-first workflow with plain definitions and a regional comparison.
- Makes uncertainty and scientific limitations visible instead of hiding them behind a badge.
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
