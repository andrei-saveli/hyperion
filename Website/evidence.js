// "What might explain this trend?" How much evidence is there for one explanation?
//
// An explanation links an OUTCOME (the measurement that is changing, e.g. snow depth) to a
// possible DRIVER (e.g. air temperature), with an expected direction (warmer air -> less snow).
// We never say "X causes Y". We climb an evidence ladder and say how far the explanation got:
//
//   1. Month to month: when the driver is unusually high, is the outcome unusual in the expected
//      direction? (both with seasons and long-term trends removed). We give a 95% range for this
//      link that allows for neighbouring months being alike (effective sample size).
//   2. Size: if that link held over the whole record, how much of the outcome's trend would the
//      driver's trend produce? ("explains about 40% of the trend").
//   3. Independent data: does step 1 still hold when a measurement made by a different
//      instrument or model replaces one from the same model? (Two quantities computed by the
//      same model can be linked by the model's own equations.)
//
// Passing every step still does not prove a cause: a third factor can drive both (a warming
// climate, a change in weather patterns). The page always says so.
//
// Kept separate from app.js so tests/test_evidence.js can check it with Node.
const ByteMeEvidence = (function (stats, investigation) {
  // Seasons a mechanism works in, worked out from the outcome's own usual yearly cycle at this
  // place: "falling" = months when the usual value drops (e.g. snow melting), "rising" = months
  // when it grows (e.g. snow building up). This adapts to every latitude: snow melts in March in
  // one place and in July in another.
  const SEASONS = { falling: "the months when it usually falls", rising: "the months when it usually builds up" };
  const MAX_LAG1 = 0.95;
  const MIN_SHARE = 0.1;      // explaining less than 10% of a trend doesn't count as explaining it

  // Keep only some calendar months (others become missing)
  function onlyMonths(series, months) {
    if (!months) return series;
    return { dates: series.dates, values: series.values.map((v, i) => (months.includes(series.dates[i].month) ? v : null)) };
  }

  // Month-to-month wiggles: each value minus its usual month and minus the long-term trend
  function wiggles(dates, values) {
    const r = stats.analyze(dates, values);
    if (r.verdict === "insufficient") return null;
    return { result: r, residual: r.anomaly.map((a, i) => (a === null || r.trend[i] === null ? null : a - r.trend[i])) };
  }

  // Correlation between each value and the next month's (pairs with both present)
  function lag1(values) {
    const a = [], b = [];
    for (let i = 0; i + 1 < values.length; i++) {
      if (values[i] !== null && values[i + 1] !== null) { a.push(values[i]); b.push(values[i + 1]); }
    }
    if (a.length < 3) return 0;
    const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
    let sab = 0, saa = 0, sbb = 0;
    a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }

  // Step 1: the month-to-month link between driver and outcome.
  // Returns { slope (outcome units per driver unit), low, high, r, n, effectiveN } or null.
  function monthlyLink(outcome, driver, months) {
    const paired = investigation.matchMonths(outcome, driver);
    if (!paired || paired.count < 24) return null;
    const o = wiggles(paired.dates, paired.values[0]), d = wiggles(paired.dates, paired.values[1]);
    if (!o || !d) return null;
    const x = [], y = [];
    paired.dates.forEach((date, i) => {
      if (months && !months.includes(date.month)) return;
      if (o.residual[i] !== null && d.residual[i] !== null) { x.push(d.residual[i]); y.push(o.residual[i]); }
    });
    const n = x.length;
    if (n < 24) return null;
    const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
    if (!sxx || !syy) return null;
    const slope = sxy / sxx, r = sxy / Math.sqrt(sxx * syy);
    // Neighbouring months are alike, so there are fewer independent pairs than months
    // (Bretherton et al., 1999): n_eff = n (1 - r1x r1y) / (1 + r1x r1y)
    const clip = (v) => Math.min(Math.max(v, 0), MAX_LAG1);
    const rx = clip(lag1(d.residual)), ry = clip(lag1(o.residual));
    const effectiveN = Math.max(3, (n * (1 - rx * ry)) / (1 + rx * ry));
    const sse = y.reduce((s, v, i) => s + (v - my - slope * (x[i] - mx)) ** 2, 0);
    const dof = Math.max(1, effectiveN - 2);
    const se = Math.sqrt(sse / dof / sxx);
    const t = stats.tCritical975(dof);
    const p = 2 * stats.tUpperTail(Math.abs(slope / se), dof);
    return { slope, low: slope - t * se, high: slope + t * se, r, n, effectiveN, p };
  }

  // Steps 1 + 2 for one explanation.
  // outcome, driver: {dates, values}; expectedSign: +1 (move together) or -1 (opposite ways);
  // months: calendar months the mechanism works in, or null for all.
  function assess(outcome, driver, expectedSign, months = null, percent = false) {
    const link = monthlyLink(outcome, driver, months);
    if (!link) return { level: "unclear", reason: "too little data at both places" };
    // trends over the same months (seasonal mechanisms: trends of those months only)
    const paired = investigation.matchMonths(outcome, driver);
    const seasonal = (k) => onlyMonths({ dates: paired.dates, values: paired.values[k] }, months);
    const so = seasonal(0), sd = seasonal(1);
    const outcomeTrend = stats.analyze(so.dates, so.values, percent), driverTrend = stats.analyze(sd.dates, sd.values);
    const out = { link, outcomeTrend, driverTrend, months };
    const clearLink = link.low > 0 || link.high < 0;
    if (!clearLink) return { ...out, level: "unclear", reason: "no clear month-to-month link" };
    if (Math.sign(link.slope) !== expectedSign) return { ...out, level: "against", reason: "month to month they move the opposite way to the prediction" };
    // Step 2: share of the outcome's trend the driver's trend would produce through this link
    const observed = outcomeTrend.slope_per_decade, change = driverTrend.slope_per_decade;
    if (observed === null || change === null || outcomeTrend.verdict === "none" || Math.abs(observed) < 1e-12) {
      return { ...out, level: "link", reason: `the outcome has no clear trend over the years both are measured (${paired.first.year}–${paired.last.year})` };
    }
    const share = [link.slope, link.low, link.high].map((s) => (s * change) / observed).sort((a, b) => a - b);
    const explained = { predicted: link.slope * change, share: (link.slope * change) / observed, low: share[0], high: share[2] };
    if (driverTrend.verdict !== "significant" && driverTrend.verdict !== "possible") {
      return { ...out, explained, level: "link", reason: "the driver itself has no clear trend, so it can't explain a trend" };
    }
    if (explained.low <= 0 || explained.high < MIN_SHARE) {
      return { ...out, explained, level: "link", reason: "the driver's trend is too small, or points the wrong way, to explain much of the outcome's trend" };
    }
    return { ...out, explained, level: "explains" };
  }

  // Which months a mechanism works in at this place, from the outcome's usual yearly cycle.
  // A month counts when its usual value is clearly below (falling) or above (rising) the month
  // before: at least 5% of the yearly range.
  function seasonMonths(season, outcome) {
    if (!season || !SEASONS[season] || !outcome) return null;
    const total = Array(13).fill(0), count = Array(13).fill(0);
    outcome.values.forEach((v, i) => { if (v !== null) { total[outcome.dates[i].month] += v; count[outcome.dates[i].month]++; } });
    if (count.slice(1).some((c) => !c)) return null;
    const usual = total.map((t, m) => (m ? t / count[m] : 0));
    const range = Math.max(...usual.slice(1)) - Math.min(...usual.slice(1));
    if (!range) return null;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const change = usual[m] - usual[m === 1 ? 12 : m - 1];
      if (season === "falling" ? change < -0.05 * range : change > 0.05 * range) months.push(m);
    }
    return months.length >= 2 ? months : null;
  }

  return { assess, monthlyLink, seasonMonths, SEASONS };
})(
  typeof module === "undefined" ? ByteMeStats : require("./stats.js"),
  typeof module === "undefined" ? ByteMeInvestigation : require("./investigation.js")
);

if (typeof module !== "undefined") module.exports = ByteMeEvidence;
