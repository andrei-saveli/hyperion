# Hyperion: Earth System Trend Detective

**NASA Space Apps Challenge**, *Be An Earth System Trend Detective!*

> 🚀 **Team members:** read [docs/PLAN.md](docs/PLAN.md) (who does what, when) and
> [docs/HANDSHAKES.md](docs/HANDSHAKES.md) (how our parts fit together).
> 🤖 **AI coding agents:** read [AGENTS.md](AGENTS.md) first.
>
> 🔎 **Person 3:** use the dedicated
> [Searchlight handover](docs/PERSON_3_SEARCH_EXPLAINABILITY_HANDOVER.md).

---

## The challenge in plain words

NASA satellites and computer models have measured the Earth for more than 20 years: temperature,
rain, soil moisture, air pollution and much more. The data is public but hard to use: there are
thousands of variables, and the files are large and technical.

We're building **a website that lets a student or curious adult investigate whether something on
Earth is changing.** It answers four questions:

| Question | Example answer |
|---|---|
| **What** is changing? | Air temperature |
| **Where**? | Svalbard, in the Arctic |
| **How much**? | +0.65 °C per decade |
| **Is it real or just noise?** | Significant: the 95% interval doesn't include zero |

Data goes up and down naturally: seasons, wet years, dry years. A **trend** is the steady drift
underneath all that wobble. A **significance test** tells us whether the drift is strong enough
that it's very unlikely to be random chance.

## How it works for the user

1. **Search or pick**: type a question (*"is the desert drying out?"*) or choose a place and a
   variable. Every variable has a one-line plain definition.
2. **See the data**: monthly NASA data since 2001, with a "remove seasons" switch.
3. **Get the verdict**: a trend line with a shaded uncertainty band, and a card:
   🟢 significant · 🟡 possible, not significant yet · ⚪ no clear trend · ⚫ not enough data,
   with the change per decade, total change, p-value and a plain-language explanation.
4. **Compare** two places side by side.
5. **Learn**: a guided demo and a "How it works" page explain trends and significance.

We say **what** changed, never claim **why**: a trend line can't prove a cause.

## Under the hood

```
NASA POWER (NASA MERRA-2 model + satellite data, monthly, no login)
        │  downloaded ahead of time and saved as CSV files
        ▼
stats.py   remove the seasons → straight-line trend → 95% interval + t-test, Mann-Kendall
        ▼
app.py     Streamlit website: search, chart, verdict card, compare, guided demo
```

**Statistics in one paragraph.** For each month we subtract that calendar month's average, which
removes the seasons and leaves **anomalies**. A straight line fitted to the anomalies gives the
**rate of change**. The **95% interval** and **t-test** show how sure we are, corrected for the fact
that one month is similar to the next (which otherwise makes trends look more certain than they
are). The **Mann-Kendall test** double-checks for a steady rise or fall without assuming a bell
curve. As the challenge suggests, we stick to **linear trends**: a straight line is a
simplification, and we say so.

## Run it (once the code exists)

```bash
pip install -r requirements.txt
```

```bash
streamlit run app.py
```

## Repository

```
AGENTS.md            instructions for AI coding agents (and humans)
docs/PLAN.md         roles, tasks, timeline, starter prompts
docs/HANDSHAKES.md   interfaces between the 4 parts
app.py, charts.py    website (Frontend)
scripts/, data_io.py data download + loading (Data)
search.py, explain.py, pages/  search, explanations, guided demo (Search + explainability)
stats.py, tests/     trend + significance (Trend & integration)
data/                places, variables, monthly CSVs, sources
```

## Data sources
Main source: [NASA POWER](https://power.larc.nasa.gov). Other NASA and partner resources from the
challenge are listed in [AGENTS.md](AGENTS.md#resources).
