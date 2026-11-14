# Hyperion: Earth System Trend Detective

**NASA Space Apps Challenge**, *Be An Earth System Trend Detective!*

> 🚀 **Team members: start with [docs/PLAN.md](docs/PLAN.md).** It's the short, simple plan
> we follow (Python + Streamlit + NASA POWER, with starter AI prompts for each person).
>
> Background reading only: the two detailed plans compared below
> ([Plan A](docs/TEAM_PLAN_CLAUDE.md) · [Plan B](docs/TEAM_PLAN.md)).

---|---|---|
> | Team plan | [docs/TEAM_PLAN_CLAUDE.md](docs/TEAM_PLAN_CLAUDE.md) | [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md) |
> | Data guide | [docs/DATA_GUIDE_CLAUDE.md](docs/DATA_GUIDE_CLAUDE.md) | [docs/DATA_GUIDE.md](docs/DATA_GUIDE.md) |
> | Written by | Claude | Codex |

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
| **Is it real or just noise?** | Significant decrease: the 95% interval excludes zero (p = 0.003) |

The last question is the key one. Data goes up and down naturally: wet years, dry years, seasons.
A **trend** is a steady drift underneath all that wobble. A **significance test** and a
**confidence interval** tell us whether the drift is strong enough that it's very unlikely to be
random chance.

### Two tricky points the challenge highlights
1. **Too many variables.** Users don't know what to look at, so the tool guides them to variables
   that fit their question and place.
2. **The same variable can trend in opposite directions in different places.** So the tool lets
   users **compare regions side by side**.

---

## Two recommended plans

Both plans build the same core tool and both are valid. They differ in **how much we promise**
versus **how much we verify first**.

### Plan A: "Detective Casebook" (Claude) → [TEAM_PLAN_CLAUDE.md](docs/TEAM_PLAN_CLAUDE.md)
**Idea:** a feature-rich, engaging tool that covers every objective *and* every optional extra in
the challenge brief.

1. **Pick a place** on a world map, or a region type ("rain forest", "desert", "city").
2. **Get suggestions**: the tool proposes variables likely to be trending there, each with a
   one-line plain definition.
3. **See the data**: monthly values 2000→today, with a toggle that removes the seasons.
4. **Get the verdict**: trend line + uncertainty band and a verdict card:
   🟢 significant · 🟡 suggestive · ⚪ no clear trend, with rate per decade, total change and p-value.
5. **Years to significance**: for weak trends, *"about 8 more years of data would be needed."*
6. **Compare** two regions side by side.
7. **Demo walkthroughs**: 5 pre-loaded cases (Lake Mead, Amazon, Arctic vs. Antarctic,
   Beijing vs. Delhi, Sahel), 8 data files from GLDAS, MODIS, MERRA-2, OMI and GPM.

| ✅ Strengths | ⚠️ Risks |
|---|---|
| Matches the brief's wording: t-test, Mann-Kendall, "significant" | More data to download and check (8 files, 5 sources) |
| Many demos, variable selection, AI suggestions = high "wow" | Demo stories chosen before the data is verified |
| Original twist: "years to significance" | Bigger scope for 48 hours |

### Plan B: "Validated Evidence MVP" (Codex) → [TEAM_PLAN.md](docs/TEAM_PLAN.md)
**Idea:** a smaller tool where every number is verified, traceable and honestly worded.

1. **Choose a question**, e.g. *"Is this region getting hotter?"*
2. **Choose a variable**: a card explains the quantity, source, units, resolution and coverage.
3. **Choose a verified region**: its exact shape is shown on the map.
4. **Inspect the evidence**: raw monthly values and seasons-removed anomalies.
5. **Read the result**: rate per decade, 95% interval (corrected for month-to-month correlation),
   record length, missing-data count, and a cautious conclusion
   (*clear increase / clear decrease / direction uncertain / insufficient data*).
6. **Compare** the same variable in a second region.
7. **Evidence drawer**: source, product version, processing steps and limitations.

| ✅ Strengths | ⚠️ Risks |
|---|---|
| Hour-4 "data gate": cases picked only after data is verified | Only 1 variable and 2 regions → weak on "select variables" |
| Full provenance, quality flags, strict tests | Drops "significant" wording the brief asks for |
| Never claims causes; very defensible with scientist judges | Fewer demos and less "wow"; AI suggestions cut |

### How the simple plan combines them
[docs/PLAN.md](docs/PLAN.md) takes Plan B's caution (real data first, no causal claims) and
Plan A's features (significance verdict, compare, demo stories), with a much simpler stack.
The original combined recommendation:
- **Hours 0–24:** follow **Plan B**: data gate, provenance, tests, one solid end-to-end case.
- **Hours 24–36:** add **Plan A** features in this order, if the MVP is stable:
  1. More variables from NASA POWER (cheap once the pipeline works) + a second demo case.
  2. Plain "significant / not yet significant" label with p-value and Mann-Kendall next to the interval.
  3. Rule-based variable suggestions per region type.
  4. "Years to significance", labelled as a planning estimate, not a forecast.
- **Always:** never claim a cause from a trend line; keep the offline demo backup.

---

## What runs under the hood (both plans)

```
NASA data (NASA POWER / MERRA-2, GLDAS, MODIS, GPM, OMI, AIRS)
        │  downloaded ahead of time, raw files + provenance kept
        ▼
Backend (Python)
  • regional monthly average → one number per month
  • removes the seasonal cycle (anomalies)
  • trend rate per decade + 95% interval corrected for autocorrelation
  • significance tests (t-test, Mann-Kendall)
        ▼
Frontend (website)
  • map • charts • verdict/evidence card • compare view • guided walkthrough • glossary
        ▲
Optional AI: suggestions/plain wording only. It never generates data, statistics or causes.
```

The data is **pre-downloaded** so the live demo never depends on NASA's servers being online.

### Statistics in one paragraph
For a region we average the data per month. We subtract each calendar month's average to remove the
seasons, leaving **anomalies**. A straight line fitted to the anomalies gives the **rate of
change**. A **95% interval** shows how sure we are; it's corrected for the fact that one month is
similar to the next (autocorrelation), which would otherwise make trends look more certain than
they are. The **Mann-Kendall test** checks for a steady rise or fall without assuming a bell curve.
A trend line shows *that* something changed, not *why*.

---

## Repository layout (planned)
```
backend/    Python: FastAPI app, stats module, data loaders, tests
app.py      Streamlit website (one Python file)
stats.py    trend + significance math
data/       variables.yaml, cases.yaml, SOURCES.md, raw/ downloads, demo/ cleaned CSVs
scripts/    data download / preprocessing scripts
docs/       team plans, data guides, pitch material
```

## Data sources
NASA POWER, Giovanni, GES DISC Hydrology Time Series, AppEEARS, NOAA Climate Data Online, KNMI
Climate Explorer. Full list with links in [CLAUDE.md](CLAUDE.md#resources).
