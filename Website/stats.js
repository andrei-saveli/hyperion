// ByteMe trend and significance math, in JavaScript, so the website can analyse ANY place live.
//
// This is a line-by-line translation of the project's Python code (Task4/stats.py). The two are
// kept identical on purpose: Website/tests/test_stats.js checks that this file gives the same
// numbers as the Python code on real NASA series. If you change one, change the other.
//
// What it does, in plain words
// 1. Ignore missing months (never treat them as zero).
// 2. Remove the seasons: subtract each calendar month's average ("anomalies"), with the 12
//    averages estimated together with the trend line.
// 3. Fit a straight line through the anomalies -> change per decade and total change.
// 4. Measure how sure we are: a 95% interval and a t-test p-value, corrected for the fact that
//    neighbouring months are similar (otherwise trends look more certain than they are).
// 5. Double-check with the seasonal Mann-Kendall test and the seasonal Sen's slope.
// 6. Give a verdict: significant / possible / none / insufficient, plus caution flags.

const ByteMeStats = (function () {
  const MIN_MONTHS = 24;             // fewer valid months than this -> "insufficient"
  const MIN_RECORD_YEARS = 10;       // a record spanning fewer years than this -> "insufficient"
  const SIGNIFICANT_P = 0.05;
  const POSSIBLE_P = 0.10;
  const MAX_LAG1 = 0.95;             // cap on month-to-month correlation, keeps the maths stable
  const MIN_YEARS_FOR_HORIZON = 10;
  const MAX_HORIZON_YEARS = 100;
  const MIN_EFFECTIVE_MONTHS = 30;   // below this many independent months -> "low" reliability

  const BAND_MEANING = "Shaded band: the 95% range of the straight-line trend, i.e. where the true " +
    "trend line most likely lies. It is not the range of the monthly values.";
  const METHOD = "Seasons removed (each month minus its calendar-month average, estimated together with " +
    "the trend), then a straight-line " +
    "trend; the 95% interval and t-test p-value are corrected for month-to-month correlation. " +
    "Checked with a seasonal Mann-Kendall test and seasonal Sen's slope. 'Years until significant' " +
    "is a planning estimate that assumes the trend and the noise stay the same; it is not a forecast.";

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (a) => sum(a) / a.length;

  // ---------------------------------------------------------------- probability functions
  // (Python gets these from scipy; here they are written out. Accurate to about 10 digits.)

  function logGamma(x) {   // Lanczos approximation
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  function betaFraction(a, b, x) {   // continued fraction for the incomplete beta function
    const TINY = 1e-300;
    let c = 1, d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 500; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const step = d * c;
      h *= step;
      if (Math.abs(step - 1) < 1e-15) break;
    }
    return h;
  }

  function incompleteBeta(a, b, x) {   // regularized incomplete beta I_x(a, b)
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (front * betaFraction(a, b, x)) / a
                                     : 1 - (front * betaFraction(b, a, 1 - x)) / b;
  }

  // Chance that a Student-t value with `dof` degrees of freedom is larger than t (t >= 0)
  function tUpperTail(t, dof) {
    return 0.5 * incompleteBeta(dof / 2, 0.5, dof / (dof + t * t));
  }

  // The t value that leaves 2.5% in the upper tail (the "1.96" of small samples)
  function tCritical975(dof) {
    let low = 0, high = 1000;
    for (let i = 0; i < 200; i++) {
      const mid = (low + high) / 2;
      if (tUpperTail(mid, dof) > 0.025) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  // Chance that a standard normal value is larger than z (z >= 0)
  function normalUpperTail(z) {
    const x = z / Math.SQRT2;
    if (x < 3) {   // series for erf(x)
      let term = x, total = x;
      for (let n = 1; n < 200; n++) {
        term *= (-x * x) / n;
        total += term / (2 * n + 1);
        if (Math.abs(term) < 1e-17) break;
      }
      return 0.5 * (1 - (2 / Math.sqrt(Math.PI)) * total);
    }
    // continued fraction for erfc(x), good for large x
    let f = 0;
    for (let k = 60; k >= 1; k--) f = (k / 2) / (x + f);
    return 0.5 * Math.exp(-x * x) / (Math.sqrt(Math.PI) * (x + f));
  }

  // ---------------------------------------------------------------- building blocks

  // Anomalies, with the 12 calendar-month averages estimated TOGETHER with the trend line
  // (same as deseasonalize_with_trend in stats.py). Each value is compared only with values from
  // the same calendar month; that gives the slope. Then each month's average is moved to the
  // middle of the record, so the anomalies are the trend plus noise, centred on zero.
  function deseasonalize(values, months, times) {
    const tSum = new Array(13).fill(0), vSum = new Array(13).fill(0), count = new Array(13).fill(0);
    values.forEach((v, i) => { if (isNum(v)) { tSum[months[i]] += times[i]; vSum[months[i]] += v; count[months[i]]++; } });
    const tMonth = (i) => tSum[months[i]] / count[months[i]], vMonth = (i) => vSum[months[i]] / count[months[i]];
    let sxy = 0, sxx = 0, tTotal = 0, n = 0;
    values.forEach((v, i) => {
      if (!isNum(v)) return;
      const dt = times[i] - tMonth(i);
      sxy += dt * (v - vMonth(i)); sxx += dt * dt; tTotal += times[i]; n++;
    });
    const slope = sxx > 0 ? sxy / sxx : 0;
    const tMiddle = tTotal / n;
    return values.map((v, i) => (isNum(v) ? v - (vMonth(i) - slope * (tMonth(i) - tMiddle)) : null));
  }

  // Correlation between each value and the one `lag` steps later (pairs with both present)
  function lagAutocorrelation(residuals, lag) {
    const a = [], b = [];
    for (let i = 0; i + lag < residuals.length; i++) {
      if (isNum(residuals[i]) && isNum(residuals[i + lag])) { a.push(residuals[i]); b.push(residuals[i + lag]); }
    }
    if (a.length < 3) return 0;
    const ma = mean(a), mb = mean(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) {
      sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2;
    }
    if (saa === 0 || sbb === 0) return 0;
    return sab / Math.sqrt(saa * sbb);
  }

  // How many truly independent months the record is worth (Santer et al., 2000)
  function effectiveSampleSize(n, r1) {
    const r = Math.min(Math.max(r1, 0), MAX_LAG1);
    return Math.max((n * (1 - r)) / (1 + r), 3);
  }

  // Mann-Kendall S statistic (sum of signs of all later-minus-earlier pairs) and its variance
  function mkSAndVariance(y) {
    y = y.filter(isNum);
    const n = y.length;
    let s = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) s += Math.sign(y[j] - y[i]);
    const counts = new Map();
    y.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    let tieTerm = 0;
    counts.forEach((c) => { if (c > 1) tieTerm += c * (c - 1) * (2 * c + 5); });
    return { s, varS: (n * (n - 1) * (2 * n + 5) - tieTerm) / 18, n };
  }

  function pFromS(s, varS) {
    if (varS <= 0) return 1;
    const z = (s - Math.sign(s)) / Math.sqrt(varS);   // continuity correction
    return 2 * normalUpperTail(Math.abs(z));
  }

  // Seasonal Mann-Kendall p-value (Hirsch et al., 1982): compares Januaries with Januaries, etc.
  function seasonalMannKendall(values, months, nRatio) {
    let sTotal = 0, varTotal = 0;
    for (let m = 1; m <= 12; m++) {
      const { s, varS, n } = mkSAndVariance(values.filter((_, i) => months[i] === m));
      if (n >= 3) { sTotal += s; varTotal += varS; }
    }
    if (varTotal === 0) return null;
    return pFromS(sTotal, varTotal * nRatio);
  }

  // Seasonal Sen's slope: median of the yearly slopes between same-month pairs (units per year)
  function seasonalSenSlope(values, months, years) {
    const slopes = [];
    for (let m = 1; m <= 12; m++) {
      const y = [], t = [];
      values.forEach((v, i) => { if (months[i] === m && isNum(v)) { y.push(v); t.push(years[i]); } });
      for (let i = 0; i < y.length - 1; i++) for (let j = i + 1; j < y.length; j++) {
        if (t[j] - t[i] > 0) slopes.push((y[j] - y[i]) / (t[j] - t[i]));
      }
    }
    if (!slopes.length) return null;
    slopes.sort((a, b) => a - b);
    const mid = slopes.length >> 1;
    return slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
  }

  // Estimate how many MORE years of data a not-yet-significant trend would need (see stats.py)
  function yearsToSignificance(tValue, recordYears, verdict) {
    if ((verdict !== "possible" && verdict !== "none") || recordYears < MIN_YEARS_FOR_HORIZON) return null;
    const t = Math.abs(tValue);
    if (t < 0.5) return null;   // direction itself is too uncertain to project
    const more = recordYears * (1.96 / t) ** (2 / 3) - recordYears;
    if (more > MAX_HORIZON_YEARS) return null;
    return Math.round(Math.max(more, 0) * 10) / 10;
  }

  // Do the t-test and the seasonal Mann-Kendall test tell the same story?
  function testsAgree(pT, pMk, slope, sen) {
    if (!isNum(pMk)) return [null, null];
    const oneSided = (pT < SIGNIFICANT_P && pMk >= POSSIBLE_P) || (pMk < SIGNIFICANT_P && pT >= POSSIBLE_P);
    const opposite = Math.sign(slope) * Math.sign(sen) < 0 && Math.min(pT, pMk) < POSSIBLE_P;
    if (oneSided || opposite) {
      return [false, "The two tests disagree about this trend, so treat it with caution: " +
        "it may depend on a few unusual months."];
    }
    return [true, null];
  }

  function reliability(nEff) {
    if (nEff >= MIN_EFFECTIVE_MONTHS) return ["good", null];
    return ["low", `Each month is very similar to the next, so this record is worth only about ` +
      `${nEff.toFixed(0)} independent months. Treat this result with caution.`];
  }

  const ym = (d) => `${d.year}-${String(d.month).padStart(2, "0")}`;

  // ---------------------------------------------------------------- main function

  // Trend analysis of one monthly series.
  //   dates:  [{year: 1981, month: 1}, ...] one entry per month, oldest first
  //   values: numbers; null = missing month
  //   percentOk: true when a percent change makes sense for this measurement (rain: yes, °C: no)
  // Returns the same result dictionary as Python's analyze() (handshake H2).
  function analyze(dates, values, percentOk = false) {
    const months = dates.map((d) => d.month);
    const xAll = dates.map((d) => ((d.year - dates[0].year) * 12 + (d.month - dates[0].month)) / 12);
    const anomaly = deseasonalize(values, months, xAll);
    const validIndex = anomaly.map((v, i) => (isNum(v) ? i : -1)).filter((i) => i >= 0);
    const nMissing = values.filter((v) => !isNum(v)).length;
    const n = validIndex.length;
    const spanYears = n ? xAll[validIndex[n - 1]] - xAll[validIndex[0]] : 0;
    const nulls = () => dates.map(() => null);

    if (n < MIN_MONTHS || spanYears < MIN_RECORD_YEARS) {
      // Too little data for a climate trend: 2 years can't tell a trend from a wet spell.
      return {
        slope_per_decade: null, ci_low: null, ci_high: null, p_value: null, mk_p_value: null, total_change: null,
        start: null, end: null, n_months: dates.length, n_missing: nMissing,
        direction: "flat", verdict: "insufficient",
        anomaly, trend: nulls(), band_low: nulls(), band_high: nulls(),
        years_to_significance: null, method: METHOD,
        sen_slope_per_decade: null, lag1_autocorrelation: null, effective_n: null,
        reliability: null, reliability_note: null, percent_change: null,
        tests_agree: null, tests_note: null, band_meaning: null,
      };
    }

    // 1) straight line through the anomalies
    const x = validIndex.map((i) => xAll[i]), y = validIndex.map((i) => anomaly[i]);
    const xMean = mean(x), yMean = mean(y);
    const sxx = sum(x.map((v) => (v - xMean) ** 2));
    const slope = sum(x.map((v, i) => (v - xMean) * (y[i] - yMean))) / sxx;   // units per year
    const intercept = yMean - slope * xMean;
    const residuals = anomaly.map((v, i) => (isNum(v) ? v - (intercept + slope * xAll[i]) : null));
    const sse = sum(residuals.filter(isNum).map((v) => v * v));

    // 2) correct for month-to-month correlation
    const r1 = lagAutocorrelation(residuals, 1);
    const nEff = effectiveSampleSize(n, r1);
    const dof = Math.max(nEff - 2, 1);
    const sE = Math.sqrt(sse / dof);            // typical scatter around the line
    const seSlope = sE / Math.sqrt(sxx);

    // 3) t-test and 95% interval
    const pValue = seSlope === 0 ? (slope === 0 ? 1 : 0) : 2 * tUpperTail(Math.abs(slope / seSlope), dof);
    const tCrit = tCritical975(dof);
    const ciLow = (slope - tCrit * seSlope) * 10, ciHigh = (slope + tCrit * seSlope) * 10;

    // 4) trend line and its 95% band, for every month (also missing ones, for a smooth chart)
    const trend = xAll.map((v) => intercept + slope * v);
    const half = xAll.map((v) => tCrit * sE * Math.sqrt(1 / nEff + (v - xMean) ** 2 / sxx));

    // 5) second opinions: seasonal Mann-Kendall + seasonal Sen's slope on the raw values
    const r12 = Math.min(Math.max(lagAutocorrelation(residuals, 12), 0), MAX_LAG1);
    const mkP = seasonalMannKendall(values, months, (1 + r12) / (1 - r12));
    const sen = seasonalSenSlope(values, months, xAll);

    // 6) verdict
    const verdict = pValue < SIGNIFICANT_P ? "significant" : pValue < POSSIBLE_P ? "possible" : "none";
    const direction = slope > 0 ? "increase" : slope < 0 ? "decrease" : "flat";

    // 7) extra: how many more years until this trend would likely become significant?
    const recordYears = x[n - 1] - x[0];
    const horizon = yearsToSignificance(seSlope > 0 ? slope / seSlope : 0, recordYears, verdict);
    const [quality, qualityNote] = reliability(nEff);
    const [agree, agreeNote] = testsAgree(pValue, mkP, slope, sen);

    // 8) percent change over the record, relative to the average level (only where meaningful)
    const totalChange = slope * recordYears;
    const present = values.filter(isNum);
    const average = mean(present);
    const neverNegative = Math.min(...present) >= 0;
    const percent = percentOk && average > 0 && neverNegative ? (totalChange / average) * 100 : null;

    return {
      slope_per_decade: slope * 10, ci_low: ciLow, ci_high: ciHigh, p_value: pValue, mk_p_value: mkP,
      total_change: totalChange,
      start: ym(dates[validIndex[0]]), end: ym(dates[validIndex[n - 1]]),
      n_months: dates.length, n_missing: nMissing, direction, verdict,
      anomaly, trend,
      band_low: trend.map((v, i) => v - half[i]), band_high: trend.map((v, i) => v + half[i]),
      years_to_significance: horizon, method: METHOD,
      sen_slope_per_decade: sen === null ? null : sen * 10,
      lag1_autocorrelation: r1, effective_n: nEff,
      reliability: quality, reliability_note: qualityNote, percent_change: percent,
      tests_agree: agree, tests_note: agreeNote, band_meaning: BAND_MEANING,
    };
  }

  return { analyze, deseasonalize, tUpperTail, tCritical975, normalUpperTail };
})();

if (typeof module !== "undefined") module.exports = ByteMeStats;   // lets the tests load this file
