# Hyperion implementation plan

## Earth System Trend Detective - four people, 48 hours

This is the authoritative build plan. It replaces the earlier five-case plan.

## 1. Product decision

Build a guided educational tool that turns a plain-language Earth question into a transparent
NASA-data investigation. A user selects a curated variable and region, sees the raw monthly
series and deseasonalized anomalies, receives an estimated rate of change with uncertainty, and
compares the same variable in a second region.

> **Pitch:** Hyperion helps students investigate change on Earth by turning NASA data into a
> reproducible trend, uncertainty interval, and plain-language evidence statement.

### Audience

- High-school and college students.
- Educators.
- Scientifically curious members of the public.

The MVP is an educational trend-analysis tool, not a professional causal-attribution system.

## 2. Scope

### Must work by Hour 30

- One primary NASA variable; add up to two more only after the first is complete.
- Two verified regions using the same product, units, dates, and processing method.
- Exact region geometry shown on a map.
- Raw monthly values and deseasonalized anomalies.
- Linear rate per decade with a 95% uncertainty interval.
- A method that accounts for dependence between neighboring months.
- Plain-language evidence statement and limitations.
- Side-by-side regional comparison.
- Visible provenance and processing details.
- One 45-60 second guided investigation.
- Stable public demo, repository, and offline backup.

### Stretch goals, in order

1. A third curated region or variable.
2. Rule-based variable recommendations.
3. Downloadable case report.
4. User-drawn region from a supported NASA API.
5. An exploratory detection-horizon range with assumptions.

### Out of scope for the hackathon build

- Global scans for opposite trends.
- EOF/REOF/CEOF analysis.
- Liang-Kleeman information-flow maps.
- PCMCI+, regime discovery, or causal graphs.
- Automated literature/news mining.
- Live CUAHSI/HydroShare integration.
- Claims that the tool proves what caused an observed trend.

These may appear in the roadmap, but never as implemented features unless actually built and
validated.

## 3. User journey

1. **Choose a question.** Example: "Is this region getting hotter?"
2. **Choose a variable.** A card explains the quantity, source, units, resolution, coverage, and
   what an increasing value means.
3. **Choose a verified region.** The map displays the exact polygon or grid cell.
4. **Inspect the evidence.** Toggle between raw monthly values and deseasonalized anomalies.
5. **Read the result.** See the rate per decade, uncertainty interval, record length, missing-data
   count, and a cautious conclusion.
6. **Compare regions.** View the same variable with the same units, scale, period, and method.
7. **Open the evidence drawer.** See provenance, transformations, method, and limitations.

## 4. Four-person ownership

The team works in parallel against contracts frozen in Hour 1. Person 2 is integration owner.

### Person 1 - NASA data and provenance

Owns product/variable audit, two region geometries, raw and cleaned demo data, processing
provenance, `data/variables.yaml`, `data/cases.yaml`, `data/SOURCES.md`, and quality checks.

- **Hour 4:** one variable, two regions, common period, exact product/version, units, sample
  files, and quality rules approved.
- **Hour 12:** final cleaned data, untouched raw downloads, provenance, and quality note.

Stop rule: if provenance, coverage, units, or missing-value handling is unclear at Hour 4,
replace the product or case immediately.

### Person 2 - statistics, backend, and integration lead

Owns the frozen API contract, mock JSON, preprocessing, trend inference, tests, API, integration,
deployment, and method documentation.

- **Hour 1:** `docs/mock_analyze.json` matching Contract C.
- **Hour 8:** synthetic tests pass for zero, positive, negative, seasonal, autocorrelated, and
  missing-value cases.
- **Hour 18:** both real regional series return validated analysis JSON.
- **Hour 24:** full application works end to end.

### Person 3 - frontend and interaction

Owns question/variable/region selection, map, raw/anomaly chart, trend and interval, evidence
card, comparison, provenance drawer, error states, responsive layout, and keyboard access.

Start against mock JSON immediately. Use React/Vite only if already comfortable with it;
otherwise choose Streamlit during kickoff and do not revisit the decision.

- **Hour 16:** complete journey works with mock data.
- **Hour 24:** journey works with real backend results.
- **Hour 30:** accessibility and error-state pass complete.

### Person 4 - science editor, user testing, story, and submission

Owns plain-language definitions, the guided investigation, claim-evidence ledger, scientific
wording, user tests, project page, citations, AI disclosure, slides/video, and pitch.

- **Hour 10:** glossary and first guided-case script.
- **Hour 26:** user-test findings and revised interface copy.
- **Hour 36:** submission and presentation material ready except final screenshots.

## 5. Data plan

### Preferred first source

Start with NASA POWER because it can return analysis-ready monthly JSON or CSV without an
Earthdata login. Confirm the selected parameter's current temporal availability in the POWER
parameter dictionary before implementation.

If MODIS, GPM, GLDAS, MERRA-2, OMI, or AIRS is essential, download and freeze the exact
processed series before frontend integration. The judged demo must not depend on a NASA queue,
authentication flow, or remote service remaining responsive.

### Hour 4 data gate

Approve the primary variable and two regions only when all are true:

- Exact source, product ID, and version are known.
- Units, fill values, and quality flags are understood.
- Both regions use the same product and common period.
- At least 10 years of monthly observations are available; longer is preferred.
- Missingness is low and not concentrated in one season.
- Each series passes a visual quality check.
- The comparison is meaningful without a causal claim.

Do not select a case because the desired trend direction sounds compelling. Select it only after
the exact data and processing have been verified.

### Required provenance

Each series records source name/URL, product ID/version, variable ID/name/units, native spatial
and temporal resolution, region geometry, aggregation method, coverage, download timestamp,
fill values, quality filter, missing count, and every transformation.

## 6. Scientific method

### Preprocessing

1. Convert documented fill values and failed quality flags to missing.
2. Never convert missing observations to zero or silently interpolate long gaps.
3. Compare regions only over their common period.
4. For monthly data, subtract each calendar month's mean over the analysis period to form
   deseasonalized anomalies.
5. Preserve raw and anomaly series separately.
6. Plot and inspect data before fitting; flag visible discontinuities.

### Primary trend result

Report slope in physical units per decade, 95% interval, record length, missing count, primary
method, and assumptions.

Preferred methods, in order:

1. Block-bootstrap interval for a linear or Theil-Sen slope, with block length documented.
2. OLS/GLS with an explicitly fitted autocorrelated error model.
3. OLS slope with HAC/Newey-West uncertainty.

Mann-Kendall is a secondary robustness check unless a seasonal/autocorrelation-aware version is
implemented. Do not require two unrelated p-values to both cross 0.05 as an arbitrary verdict.

### Evidence states

- `clear_increase` / `clear_decrease`: the 95% interval excludes zero and diagnostics show no
  serious failure.
- `direction_uncertain`: the estimate has a direction, but the interval includes zero.
- `no_clear_direction`: the estimate is near zero or too uncertain to support a direction.
- `insufficient_data`: the method cannot be estimated safely.

Never translate `p >= 0.05` into "no change exists." Never say an observed association proves a
cause.

### Optional detection horizon

Only implement after the MVP is stable. Label it:

> Estimated record length for detection if the current linear slope, variability,
> autocorrelation, measurement system, and data quality remain unchanged. This is a planning
> estimate, not a forecast.

Hide it for near-zero slopes, short records, poor residual diagnostics, or discontinuities.

### Required tests

- Zero-trend series do not systematically produce significance.
- Known positive and negative slopes are recovered within tolerance.
- A seasonal cycle without trend is approximately flat after deseasonalization.
- Autocorrelated noise produces wider uncertainty than independent noise.
- Missing months neither crash analysis nor become zeroes.
- Reversing region order does not change either result.
- One real case matches an independently calculated reference.

## 7. Frozen contracts

Changing a contract requires notifying everyone and updating the mock fixture first.

### Contract A - cleaned series

`data/demo/<case_id>.csv`

```csv
date,value,quality
2001-01-01,0.312,good
2001-02-01,0.298,good
2001-03-01,,missing
```

One row per month, oldest first. Units live in metadata and never vary within a file.

### Contract B - metadata

`data/variables.yaml`

```yaml
- id: gwetroot
  name: Root-zone soil wetness
  definition: How wet the soil is through the depth used by most plant roots.
  units: fraction
  source_name: NASA POWER
  product_id: VERIFIED_AT_HOUR_4
  product_version: VERIFIED_AT_HOUR_4
  native_spatial_resolution: VERIFIED_AT_HOUR_4
  native_temporal_resolution: monthly
  source_url: VERIFIED_AT_HOUR_4
```

`data/cases.yaml`

```yaml
- id: primary_region
  title: Is this region becoming drier?
  variable: gwetroot
  region:
    name: Region A
    geometry: {}
  csv: demo/primary_region.csv
  compare_with: comparison_region
```

No `VERIFIED_AT_HOUR_4` placeholder may remain after the data gate.

### Contract C - analysis response

`POST /analyze`

```json
{
  "case_id": "primary_region",
  "variable": {"id": "gwetroot", "name": "Root-zone soil wetness", "units": "fraction"},
  "region": {"name": "Region A", "geometry": {}},
  "period": {"start": "2001-01", "end": "2025-12", "months": 300, "missing": 0},
  "series": {"dates": [], "raw": [], "anomaly": [], "trend": [], "ci_low": [], "ci_high": []},
  "estimate": {
    "slope_per_decade": -0.012,
    "ci95": [-0.020, -0.004],
    "primary_method": "block_bootstrap_linear_slope",
    "secondary_check": {"method": "seasonal_mann_kendall", "p_value": 0.02}
  },
  "evidence": {
    "level": "clear_decrease",
    "plain_language": "This record shows clear evidence of a decrease over the selected period.",
    "limitations": ["This is a linear summary and does not establish cause."]
  },
  "provenance": {}
}
```

The frontend accepts `null` for every statistic that cannot be estimated safely.

Other MVP endpoints: `GET /variables`, `GET /cases`, and `POST /compare`. `POST /suggest` is
stretch only.

## 8. Schedule and gates

| Hours | Team outcome | Stop/go rule |
|---|---|---|
| 0-2 | Freeze audience, MVP, schema, and React/Streamlit choice | No advanced-method work after kickoff |
| 2-4 | Audit one source, variable, and two regions | Replace anything with unclear provenance or coverage |
| 4-8 | Build one end-to-end slice; tests; frontend on mocks | No second variable before one result works |
| 8-12 | Freeze data/metadata; implement primary method | Simplify method or replace case if diagnostics fail |
| 12-18 | Complete backend/tests and frontend journey on mocks | No AI, CUAHSI, or causal features |
| 18-24 | Connect real results; comparison and evidence drawer | Stable end-to-end demo required by Hour 24 |
| 24-30 | Guided case, accessibility, error states, user testing | MVP complete by Hour 30 |
| 30-36 | Fix findings; complete project page, video, and pitch | Feature freeze at Hour 36 |
| 36-42 | Deployment rehearsal, offline backup, final capture | Bug fixes only |
| 42-48 | Submit early, verify public links, rehearse | No science change without rerunning tests |

Ten-minute check-in at Hours 4, 8, 12, 18, 24, 30, and 36: finished, next, blocked, and whether
a stop rule has fired.

## 9. Judging strategy

- **Impact:** show that a student can reach a defensible result without knowing NASA product
  codes; use observed user-test results.
- **Creativity:** emphasize the guided evidence workflow, not AI.
- **Validity:** expose provenance, assumptions, uncertainty, tests, and limitations.
- **Relevance:** mirror the challenge on screen: select, acquire, visualize, analyze.
- **Presentation:** show one complete investigation, not a tour of roadmap features.

## 10. Three-minute demo

1. **0:00-0:20:** NASA has many Earth variables, but students do not know what to choose or how
   to judge a trend.
2. **0:20-0:40:** Hyperion turns a plain-language question into a transparent investigation.
3. **0:40-1:45:** choose the primary case; show map, raw series, anomalies, rate, interval, and
   evidence statement.
4. **1:45-2:15:** compare the second region without making a causal claim.
5. **2:15-2:40:** open provenance/method details and mention tests.
6. **2:40-3:00:** explain educational value; identify arbitrary regions or causal discovery only
   as future work.

## 11. Claim-evidence ledger

| Claim | Required evidence | Allowed wording |
|---|---|---|
| The record increased/decreased | Slope and 95% interval from frozen data | "The record shows..." |
| Regional estimates differ | Same product, period, units, and aggregation | "The estimated trends differ..." |
| A process caused the difference | Not established by this MVP | Do not claim |
| Students can use the tool | Observed user test | "In a small test, X/Y users completed..." |
| Data are NASA-derived | Exact product metadata and URL | Name the source and product |

## 12. Final ship checklist

- [ ] Primary case works from first click to conclusion.
- [ ] Comparison uses the same variable, units, period, and method.
- [ ] Source, product, version, units, geometry, period, and processing are visible.
- [ ] Missing values and quality flags are handled explicitly.
- [ ] Seasonality and serial dependence are addressed.
- [ ] The uncertainty interval is visible; the result is not reduced to a p-value.
- [ ] No observational association is labeled as proven causation.
- [ ] No detection-horizon value is presented as exact.
- [ ] Synthetic and reference tests pass.
- [ ] Public demo and repository work without requesting access.
- [ ] AI use and third-party resources are disclosed.
- [ ] Local/offline backup works.
- [ ] Submission is complete before the local deadline.
