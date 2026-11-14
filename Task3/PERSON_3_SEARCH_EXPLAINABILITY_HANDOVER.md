# Person 3 handover: Searchlight

## Search + explainability for Hyperion

Person 3's working folder is `Task3/`. The shared plan and handshakes sit one level above it.
See the [Searchlight model card](models/search/MODEL_CARD.md) for the implemented search engine.

This is the personal brief for Person 3 and their coding agent. It translates the shared plan and
frozen handshakes into one isolated mission without taking work from the other three people.

> **Do not start implementation until the team lead says to start.** `AGENTS.md` currently says
> coding begins after kickoff.

## Read in this order

1. `AGENTS.md` - project rules, scope, role ownership, and current status.
2. `docs/PLAN.md` - authoritative tasks and timeline.
3. `docs/HANDSHAKES.md` - frozen interfaces; focus on H0, H2, H3, H4, and H5.
4. This file - Person 3 execution details and acceptance checks.

If this file conflicts with `PLAN.md` or `HANDSHAKES.md`, the shared documents win. Never change
a handshake without the team agreement required by `HANDSHAKES.md`.

## Mission

Build **Searchlight**, the part of Hyperion that helps a student:

1. find a relevant place and NASA variable from a simple question;
2. understand why that suggestion matched;
3. understand Person 4's computed result in plain language;
4. learn what trends, seasons, uncertainty, and significance mean;
5. follow a guided demo without being told an unsupported causal story.

Searchlight never computes the trend, invents NASA data, or builds the main app.

## Ownership boundaries

| Area | Owner | Person 3 boundary |
|---|---|---|
| Main website, chart, comparison UI | P1 Frontend | Do not edit `app.py`, `charts.py`, or `frontend-nasa`; provide H0/H3/H4 outputs only. |
| NASA download, cleaning, loaders | P2 Data | Do not edit `scripts/download.py`, `data_io.py`, series CSVs, or `data/SOURCES.md`. |
| Catalogue, search, explanations, learning/demo pages | **P3** | Own the files below and preserve H0/H3/H4/H5. |
| Trend math, tests, dependencies, integration, deploy | P4 | Do not edit `stats.py`, `tests/`, or `requirements.txt`; ask P4 for dependency changes. |

## Files you own

```text
data/places.csv
data/variables.csv
search.py
explain.py
pages/1_Guided_demo.py
pages/2_How_it_works.py
PERSON_3_SEARCH_EXPLAINABILITY_HANDOVER.md
```

Do not create a competing catalogue format, API, or package tree. The team already froze simple
CSV and Python-function handshakes.

## Frozen interfaces

### H0: catalogue

`data/places.csv`:

```text
id,name,lat,lon,west,south,east,north,type,story
```

- `id`: lowercase letters, digits, `_`; unique and never renamed after use.
- `west,south,east,north`: the box Giovanni averages over (about 1°–3°, on land); `lat,lon`: its centre.
- `type`: `desert`, `polar`, `savanna`, `city`, `forest`, `coast`, `mountain`, or `farmland`.
- `story`: one student-friendly question ending in `?`.

`data/variables.csv`:

```text
code,name,units,definition,keywords,source
```

- `code`: our short code (CAPITALS), e.g. `TEMP`.
- `source`: the exact Giovanni variable name (see the Data handover).
- `units`: exact display unit shared with P1 and P4.
- `definition`: one sentence understandable to a 15-year-old.
- `keywords`: lowercase, space-separated search words.

MVP variables are `TEMP` (°C), `RAIN` (mm/day), `SOILM` (kg/m²) and `EVAP` (mm/day)
(NO₂ was dropped). Exact rows: `docs/HANDSHAKES.md` H0.
Do not add a variable unless P2 confirms download support and P4 confirms compatibility.

### H3: explanation

Preserve exactly:

```python
def explain(result: dict, variable: dict, place: dict) -> dict:
    ...
```

Return exactly these public keys:

```python
{"headline": "...", "details": "...", "caveat": "..."}
```

Use the H2 result and H0 metadata. Do not recalculate slope, intervals, p-values, direction, or
verdict.

### H4: search

Preserve exactly:

```python
def search(text: str) -> list[dict]:
    ...
```

Each item is:

```python
{"place_id": "lake_mead", "code": "SOILM", "reason": "desert + dry -> soil moisture", "score": 2}
```

Best match first, at most five. Empty/unknown input returns `[]`. Return only H0 IDs and codes.

### H5: chart reuse

The guided page calls P1's function as-is:

```python
trend_chart(df, result, remove_seasons=True, title="")
```

Do not copy chart logic into the guided page.

## Workstream A: catalogue and search

### Hours 0.5-6

1. Check/improve the five `variables.csv` rows in H0 (definitions and keywords).
2. Preserve the three starting places in `PLAN.md`.
3. Research five additional locations of different allowed types.
4. Note two promising comparison pairs, but do not claim their trend direction before P4's
   results table exists.
5. Push H0 by Hour 6 so P2 can download every place-variable combination.

### Hours 8-20: deterministic search

Use simple word matching, not AI or live web search:

1. Lowercase and remove punctuation.
2. Match approved variants such as `dry/drying/drought`, `hot/warm/warming`,
   `rain/rainfall/wet`, and `evaporation/evaporate`.
3. Score place names, place types, variable names/codes, keywords, and story words.
4. Produce only valid place-variable combinations.
5. Include a short reason naming the match.
6. Sort by score, then stable `place_id`, then `code`.
7. Return at most five; no positive match means `[]`.

Suggested internal score: exact name/code +4, keyword +2, place type +2, story word +1. The score
is a ranking aid, never a probability or scientific confidence.

### Search checks

- `search("") == []`; nonsense also returns `[]`.
- `search("is the desert drying")` places a desert + `SOILM` suggestion near the top.
- Every result references H0 and has a non-empty reason.
- Results are deterministic and never exceed five.
- Search never claims the place actually has the expected trend.

## Workstream B: explanations

H2 fields are defined in `HANDSHAKES.md`. Handle every verdict:

- `significant`: clear evidence in the reported direction;
- `possible`: estimated direction, but not strong enough for the main threshold;
- `none`: no clear trend in this record, not "no change";
- `insufficient`: not enough usable data for a safe result.

Safe wording patterns:

- Significant: `{place}'s {variable} changed by {signed slope} {units} per decade, with clear
  statistical evidence in this record.`
- Possible: `The estimate points {direction}, but the evidence is not yet strong enough to call
  the trend clear.`
- None: `This record does not show a clear trend. That does not prove no change exists.`
- Insufficient: `There is not enough usable data to estimate the trend safely.`

`details` explains rate, interval, p-value/verdict, period, and missing observations without new
facts. `caveat` always says a straight line is a simplification and describes **what**, not **why**.

### Safety rules

Never:

- claim climate change, policy, deforestation, industry, or another process caused the trend;
- turn `possible` or `none` into a confirmed direction;
- say `none` means "no change";
- invent or alter a number, unit, date, place, variable, method, or source;
- call a p-value the probability that the trend is true or false;
- present `years_to_significance` as an exact forecast/date;
- omit units when stating change;
- crash when `insufficient` returns `None` numbers.

Malformed input still returns the three H3 keys with cautious text; never guess missing evidence.
Use two or three significant digits, keep rate signs, and keep interval precision consistent.

### Explanation checks

- All four verdicts return string values for all H3 keys.
- Positive/negative examples preserve direction, sign, and units.
- `insufficient` works with all numeric fields set to `None`.
- `none` never says no change occurred.
- Every caveat states linear simplification and no causal inference.
- Inputs are not mutated.

## Workstream C: educational pages

### `pages/2_How_it_works.py`

Explain for a 15-year-old: monthly values, seasons, anomalies, linear trend, rate per decade, 95%
interval, what a p-value can/cannot say, why non-significant is not no change, and why trends do
not prove causes. Keep it short and visual; introduce no new method.

### `pages/1_Guided_demo.py`

- Wait for P4's Hour 20 results table before selecting two real cases.
- Prefer one clear and one uncertain result to teach evidence strength.
- Use P2's `load_series()`, P4's `analyze()`, your `explain()`, and P1's `trend_chart()`.
- Use Next/Back steps; duplicate none of those components.
- Never hard-code a direction that differs from the computed result.

## Workstream D: user testing

Around Hour 28, ask two or three outsiders to:

1. search for `is the desert drying?`;
2. explain why a suggestion appeared;
3. read a result and say what changed;
4. say whether it proves a cause;
5. complete the guided demo unaided.

Record: `task | expected | observed | confusion | owner/fix`. Send UI findings to P1, data issues
to P2, and math/integration issues to P4. Fix only P3-owned issues yourself.

## Timeline

- **Kickoff:** confirm H0/H3/H4/H5, authorization to code, and frontend fixture-sharing method.
- **Hours 0.5-8:** variables by Hour 4, places by Hour 6, `explain.py` v1 by Hour 8.
- **Hours 8-20:** `search.py`, How-it-works page, real H2 compatibility, demo-case selection.
- **Hours 20-30:** guided demo, user testing, core fixes.
- **Hours 30-36:** wording/edge-case polish, feature freeze, prepare 30-45 second pitch section.
- **Hours 36-48:** team pitch, rehearsal, bug fixes only.

## Handoffs

### To P1

H0 by Hour 6, H3 by Hour 8, H4 by Hour 16, plus examples for empty search and all verdicts. Do
not edit P1's repo unless explicitly asked for a narrow change.

### To P2

Send new place rows early and never rename IDs after downloads. Provide exact codes/units. Follow
handshake approval for any H0 change.

### To P4

Provide H3/H4 and simple checks, request dependencies instead of editing requirements, route
trend/integration findings, and supply final wording for integration tests.

## Definition of done

- [ ] H0 has four verified variables, three starters, and five researched places.
- [ ] No place story asserts an unverified result or cause.
- [ ] H3 signature/output match the handshake and all verdicts work.
- [ ] H3 includes units, careful rounding, linear caveat, and no causal language.
- [ ] H4 signature/item shape match the handshake.
- [ ] H4 is deterministic, returns only H0 items, explains matches, and caps at five.
- [ ] How-it-works is clear to a 15-year-old and statistically cautious.
- [ ] Guided demo uses real Hour 20 cases and reuses H1/H2/H3/H5.
- [ ] Two or three user tests are completed and findings routed by owner.
- [ ] P1, P2, and P4 files were not modified.
- [ ] Work is committed/pushed in small, readable commits.

## Copy-paste brief for your agent

> You are Person 3's Searchlight agent for Hyperion. Do not implement until the team lead says to
> start. Read `AGENTS.md`, `docs/PLAN.md`, `docs/HANDSHAKES.md`, and this handover. Person 3 owns
> only `data/places.csv`, `data/variables.csv`, `search.py`, `explain.py`, and the Streamlit pages
> under `pages/`. Preserve H0, H3, H4, and H5 exactly. Do not edit the frontend, NASA downloader,
> loaders, statistics/tests, requirements, deployment, or the separate `frontend-nasa` repo.
> Implement deterministic word matching with a reason for every result; return only existing H0
> IDs/codes and at most five results. Build explanations only from H2 plus H0 metadata. Never
> recalculate statistics, invent values, call a non-significant result no change, or claim why a
> trend happened. Handle significant, possible, none, and insufficient safely. Reuse P1's chart
> in the guided demo and choose cases only after P4's Hour 20 results table. Keep code simple and
> beginner-readable; request new dependencies from P4; commit/push small changes as instructed.
