# Review: the "investigation workspace" on `codex/trend-detective`

Written 2026-11-15 for the team. It covers what the branch does, what works, what doesn't, and
a proposal. The time period feature from the same branch is already merged into
`claude/epic-hypatia-eq4vfd` (see the end).

## What the branch adds

| Part | Files | What it does |
|---|---|---|
| Time periods | `investigation.js` | From/To months, periods in questions, matched months for Compare, A − B trend with a Newey–West range. **Good; merged.** |
| Investigation workspace ("evidence map") | `experiments.js`, `workbench.js`, `workbench-view.js` | Suggests explanations ("Check air temperature" for snow depth). Each one predicts that two trends point the same or opposite way. The verdict is *Fits prediction*, *Weakened*, or *Insufficient*. Arrows show "proposed cause and effect". Users can add their own explanations, with a lag. |
| Rival explanations | `experiments.js` | When a lead is weakened, it offers a rival (e.g. precipitation minus evaporation for soil wetness). |
| Dated event | `workbench.js` | Gap between place A and place B in three equal windows (earlier, before, after), with the earlier shift as a placebo. |
| Design your experiment | `study.js`, `study-view.js` | A form: question, expected direction, CSV upload or NASA places, dated or randomised design (Welch interval). Now the first section of the page. |
| London ULEZ case | `london-case.js`, `build_london_case.py`, `data/london-ulez.json` | A guided synthetic-control lesson on weekly roadside NO₂, using the published data of Tong et al. (2025): prediction, pre-policy hold-out check, effect, two sensitivity checks. |

## What is good

- **The teaching idea is right.** "Make a prediction, look at the evidence, try a rival
  explanation" is how detectives and scientists work. The challenge says trends indicate the
  processes causing change. Guiding students from *what changed* to *what might explain it* is a
  natural next step.
- **Careful engineering.** The ledger keeps each check's original period and records, so changing
  the date picker can't rewrite old results. The code has no network dependencies and has tests,
  and the rivals are checked on the same months as the original pair.
- **The London case is the strongest part.** It is a real causal design: synthetic control, a
  hold-out check before the policy, and sensitivity checks. It uses published data with a pinned
  source revision and says plainly that a causal reading needs assumptions.
- **The Compare statistics are an improvement.** Matched months, A − B, and a Newey–West range
  are now in our branch.

## Problems

### 1. "Both trends point the expected way" can't tell real explanations from nonsense
A lead *fits* when both trends are significant and their signs match the prediction. Most places
have trends in many measurements, so a matching sign is close to a coin flip. Using the branch's own
rule on our 5° world grid (`Website/data/world.json`):

| Hypothesis | "Fits" where both trends are significant |
|---|---|
| warmer air → less snow (real) | 70% (79 of 113 places) |
| warmer air → less ozone (**placebo**) | 66% (361 of 545) |
| more haze → warmer air (placebo) | 50% |
| every pair of measurements, either sign | **50%** |

A placebo "fits" almost as often as the real hypothesis. Two series that both trend over the
same years always look related ("spurious regression"), whatever their connection.

### 2. The verdict ignores the evidence the branch already computes
For Svalbard snow depth, the workspace says **"The records fit this prediction"** for warmer air →
less snow. The same panel shows that, once seasons and trends are removed, the month-to-month
correlation is **+0.2**: warmer months come with *more* snow. That is the opposite of the melt
mechanism, but the headline doesn't use it.

The more careful check below shows what is really going on.

### 3. Both measurements often come from the same model, so the link is built in
MERRA-2's snow depth and soil wetness are calculated by MERRA-2's land model *from MERRA-2's own*
temperature, rain and evaporation. Finding that they move together mostly confirms the model's
equations, not the real world. The "precipitation minus evaporation" rival has the same problem:
soil wetness in the model is P − E − runoff accumulated over time.

### 4. Arrows say "cause and effect", but nothing tests direction or confounders
A shared driver produces the same pattern in both directions. Examples are a warming climate, or a
shift in large-scale weather patterns that brings both warmer and snowier winters. The user picks
the arrow's direction, and the lag option only shifts a correlation by whole months. Students will
read "Air temperature → Snow depth · Fits prediction" as "proven", which conflicts with our rule
*say what changed, never claim why*. Judges may see it as overreach.

### 5. Many tries, no accounting
Users can add explanations until one fits. With about 25 measurements and two signs, something
always will. The ledger records the tries (good) but never says "you tested 8 explanations; one fit
could be luck".

### 6. The dated-event check has no uncertainty
`interventionComparison` gives three window means and a placebo shift, but no range or p-value.
With monthly reanalysis data, a 12-month window is mostly weather noise. One placebo date can't
tell a real jump from an ordinary one.

### 7. The page lost its focus
The hero now says "Make a prediction…", and the first section is a blank form with CSV upload and
a *randomised treatment and control* design. That generic statistics calculator is unrelated to
NASA data. The challenge asks for a trend detective: select variables, visualise change, test
significance. A judge, or a 15-year-old, now meets an abstract research form before seeing any
NASA data.

### 8. The London case is outside the brief
The NO₂ comes from ground roadside monitors, not a NASA mission. It is weather-normalised by the
study, and the result has no uncertainty: in synthetic control, that usually comes from re-running
the method with each donor city as a pretend "treated" place. Check the data licence of the source
repository before publishing.

## Proposal: an evidence ladder instead of "fits / weakened"

Keep the workspace, but grade the **strength of evidence** instead of giving a pass/fail. Every
explanation climbs the same steps, and the page shows how far it got. All steps stay within
"linear trends and simple statistics".

| Step | Question | Method (all already in our code or a few lines more) |
|---|---|---|
| 0. Co-trend | Do both trend over the same years? | Today's rule. Label it **weak: expected by chance in about half of all pairs**. |
| 1. Month-to-month link | When the driver is unusually high, is the outcome unusual in the expected direction? | Regression of outcome anomalies on driver anomalies, after removing seasons and trends, with a 95% range using the effective sample size (as `stats.py`). **Per season** when the mechanism is seasonal (melt in spring and summer). |
| 2. Does it explain the size? | Is the link strong enough to produce the observed trend? | Predicted trend = link × driver trend; show it as a share of the observed trend, with a range. |
| 3. Independent data | Does it hold with measurements that weren't calculated from each other? | Use the second sources: GPM rain, AIRS temperature, MODIS land temperature, GLDAS soil. Flag pairs that are both MERRA-2: "this model links these by construction". |
| 4. Elsewhere too | Does the same link hold in similar places? | Use the precomputed grids: across all land squares, is a faster local warming trend matched by a faster local snow loss? |
| 5. Dated event | Did something change at a known date, more than at ordinary dates? | Gap A − B. Compare the jump at the real date with the jumps at **every other possible date**; the real date's rank is a simple, honest p-value. |

### Steps 1–2 on the Svalbard example
MERRA-2 via NASA POWER, 1981–2025. Snow depth is −4.75 cm per decade and air temperature is +0.69 °C per decade.

| Months | Month-to-month link | Warming alone predicts |
|---|---|---|
| All months | +1.1 cm per °C (95% +0.5 to +1.7) | +0.8 cm per decade: **more** snow |
| Melt season (May–July) | −3.3 cm per °C (95% −6.4 to −0.1) | −2.3 cm per decade: about **half** of the observed loss |
| Snow-building season (October–April) | +1.4 cm per °C (95% +0.8 to +2.1) | +1.0 cm per decade |

This is a much better lesson than "fits". Warmer melt seasons go with less snow, which explains
about half of the decline. In the cold season, warmer months come with *more* snow, likely because
warm months there are the stormy, moist ones. So temperature explains part of the loss, and
something else (snowfall, rain on snow) is needed for the rest. It stays honest: steps 1–2 are
still correlations, and both series come from MERRA-2 (step 3 is needed).

### Other suggestions
- **Show a causal diagram with the confounder in it.** Draw the measurements as boxes, plus a box
  that is always there: *shared drivers (climate change, weather patterns)*. Colour the arrows by
  how far up the ladder they got, not by fits or weakened. Students learn why correlation isn't
  causation by seeing the extra arrows.
- **Lock the prediction first, everywhere,** as the London case already does. Count the tries per
  place and say plainly when several explanations were tested.
- **Wording:** use "consistent with" and "not consistent with", never "fits" or "explains", and
  keep the evidence level next to every verdict.
- **Page order:** keep the trend detective first (search → answer → evidence). Offer "Investigate
  what might explain this →" from the answer card when a trend is significant. Move "Design your
  experiment" and the London case to a separate page or an advanced section. Drop the randomised
  CSV design, which isn't about Earth data.
- **London:** keep it as a short optional lesson. Add the donor-placebo range. As a stretch, show the
  same question with OMI NO₂: its 0.25° grid is coarser than the zone itself, a good lesson in the
  limits of satellite data.

## What was merged from the branch

Merged into `claude/epic-hypatia-eq4vfd`, commit "Add time period selection to Explore and Compare":
- `investigation.js` and its tests, unchanged.
- **Explore:** From/To months, periods named in questions ("since 2005", "2001 to 2015"), and links
  that keep the period (`?from=…&to=…`). The panel always shows the whole-record result next to a
  window and warns that short or hand-picked windows are uncertain.
- **Compare:** months observed at both places, A − B with a Newey–West range, and a "latest 15
  years" check.

Not merged: the workspace, rivals, dated events, experiment form and London case. They need the
redesign above first. The branch also started before the answer card and area averages, so a plain
git merge would conflict heavily in `app.js`; port the parts by hand.
