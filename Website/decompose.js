// Trend Decomposer: how much of a trend can a few possible drivers statistically account for?
//
// Example: snow depth in Svalbard fell 4.7 cm per decade. Air temperature rose and snowfall
// changed. How much of the snow loss goes with each of them, and how much is left over?
//
// The method, step by step (all linear, like the rest of ByteMe):
//  1. Line up the months where the outcome and every driver have data.
//  2. Remove the seasons and the long-term trend from each record: what is left are the
//     month-to-month "wiggles" (a warm June, a snowy winter...).
//  3. Fit ONE regression of the outcome's wiggles on all drivers' wiggles together, so drivers
//     that move together aren't counted twice. Optionally each driver gets a separate link for
//     each season (Dec-Feb, Mar-May, Jun-Aug, Sep-Nov): warm summers melt snow, warm winters can
//     bring more snow. Fitting on wiggles means two unrelated records that both trend can't fake
//     a link (the classic "spurious regression" trap).
//  4. Apply each link to the driver's full record (trend included): that driver's
//     CONTRIBUTION. Its trend is the part of the outcome's trend the driver accounts for.
//     Outcome minus all contributions = what is LEFT; it gets the usual trend test.
//     Observed trend = sum of contributions + left over, exactly.
//  5. Uncertainty: re-run history 400 times with whole years drawn at random (a "block
//     bootstrap", which keeps each year's months together) and take the middle 95%.
//  6. Alibi check: slide one driver's record out of sync by whole years (3, 4, ... years) and
//     refit. A real link should be stronger than almost all out-of-sync copies; the share of
//     copies at least as strong is a simple p-value.
//
// Accounting for a trend statistically is not proof of cause: a third factor can drive both.
// Kept separate from app.js so tests/test_decompose.js can check it with Node.
const ByteMeDecompose = (function (stats) {
  const SEASONS = [[12, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]];
  const SEASON_NAMES = ["Dec–Feb", "Mar–May", "Jun–Aug", "Sep–Nov"];
  const seasonOf = (month) => SEASONS.findIndex((s) => s.includes(month));
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const key = (d) => d.year * 12 + d.month - 1;

  // A small random-number generator, so results are the same every time (seeded)
  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Solve (X'X) b = X'y for b (Gaussian elimination; tiny systems, at most 4 x drivers unknowns)
  function solve(A, b) {
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-12) return null;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  // Least-squares links: rows are months, each driver contributes one column per season group
  function fitLinks(rows, wiggles, target, groupOf, groups) {
    const D = wiggles.length, K = D * groups;
    const A = Array.from({ length: K }, () => Array(K).fill(0)), b = Array(K).fill(0);
    rows.forEach((i) => {
      const g = groupOf[i], x = wiggles.map((w) => w[i]);
      for (let p = 0; p < D; p++) {
        const kp = p * groups + g;
        b[kp] += x[p] * target[i];
        for (let q = 0; q < D; q++) A[kp][q * groups + g] += x[p] * x[q];
      }
    });
    for (let k = 0; k < K; k++) A[k][k] += 1e-9;   // keeps the system solvable if a season has no data
    const beta = solve(A, b);
    return beta && Array.from({ length: D }, (_, p) => beta.slice(p * groups, p * groups + groups));
  }

  // Straight-line slope against time (units per decade) over the months where values exist
  function slopePerDecade(values, years) {
    let n = 0, mx = 0, my = 0;
    values.forEach((v, i) => { if (isNum(v)) { n++; mx += years[i]; my += v; } });
    if (n < 3) return null;
    mx /= n; my /= n;
    let sxy = 0, sxx = 0;
    values.forEach((v, i) => { if (isNum(v)) { sxy += (years[i] - mx) * (v - my); sxx += (years[i] - mx) ** 2; } });
    return sxx ? (sxy / sxx) * 10 : null;
  }

  // Contributions of each driver (full record, trend included) and their trends
  function contributions(links, anomalies, groupOf, years, rows) {
    return links.map((link, p) => {
      const series = anomalies[p].map((a, i) => (rows.has(i) && isNum(a) ? link[groupOf[i]] * a : null));
      return { series, trend: slopePerDecade(series, years) };
    });
  }

  const percentile = (xs, q) => {
    const s = xs.filter(isNum).sort((a, b) => a - b);
    if (!s.length) return null;
    const at = (s.length - 1) * q, lo = Math.floor(at), hi = Math.ceil(at);
    return s[lo] + (s[hi] - s[lo]) * (at - lo);
  };

  // Main function.
  //   outcome: {dates, values}; drivers: [{code, series: {dates, values}}]
  //   options: seasonal (true: a link per season), reps (bootstrap re-runs), seed, percent
  function decompose(outcome, drivers, { seasonal = true, reps = 400, seed = 1, percent = false } = {}) {
    if (!outcome || !drivers.length) return null;
    // 1) the calendar months where everything is observed
    const all = [outcome, ...drivers.map((d) => d.series)];
    const maps = all.map((s) => new Map(s.dates.map((d, i) => [key(d), s.values[i]])));
    const first = Math.max(...all.map((s) => key(s.dates[0]))), last = Math.min(...all.map((s) => key(s.dates.at(-1))));
    if (last - first < 24) return null;
    const dates = [], cols = all.map(() => []);
    for (let k = first; k <= last; k++) {
      dates.push({ year: Math.floor(k / 12), month: (k % 12) + 1 });
      const vals = maps.map((m) => m.get(k));
      const ok = vals.every(isNum);
      vals.forEach((v, j) => cols[j].push(ok ? v : null));
    }
    // 2) anomalies (seasons removed) and wiggles (trend removed too), from the project's trend code
    const fits = cols.map((values, j) => stats.analyze(dates, values, j === 0 && percent));
    if (fits.some((f) => f.verdict === "insufficient")) return null;
    const anomalies = fits.map((f) => f.anomaly);
    const wiggles = fits.map((f) => f.anomaly.map((a, i) => (isNum(a) && isNum(f.trend[i]) ? a - f.trend[i] : null)));
    const years = dates.map((d) => (key(d) - first) / 12);
    const groups = seasonal ? 4 : 1;
    const groupOf = dates.map((d) => (seasonal ? seasonOf(d.month) : 0));
    const rowList = dates.map((_, i) => i).filter((i) => wiggles.every((w) => isNum(w[i])));
    const rows = new Set(rowList);
    const target = wiggles[0], dw = wiggles.slice(1), da = anomalies.slice(1);

    // 3) the links, fitted on wiggles; 4) contributions and what is left
    const links = fitLinks(rowList, dw, target, groupOf, groups);
    if (!links) return null;
    const contrib = contributions(links, da, groupOf, years, rows);
    const left = anomalies[0].map((a, i) => (rows.has(i) && isNum(a) ? a - contrib.reduce((s, c) => s + c.series[i], 0) : null));
    const leftFit = stats.analyze(dates, left);
    const observed = fits[0];
    const observedTrend = slopePerDecade(anomalies[0].map((a, i) => (rows.has(i) ? a : null)), years);

    // 5) block bootstrap over whole years
    const yearList = [...new Set(rowList.map((i) => dates[i].year))];
    const rowsByYear = new Map(yearList.map((y) => [y, rowList.filter((i) => dates[i].year === y)]));
    const rnd = random(seed);
    const boot = { contrib: drivers.map(() => []), links: drivers.map(() => Array.from({ length: groups }, () => [])), left: [], total: [] };
    for (let r = 0; r < reps; r++) {
      const sample = [];
      for (let k = 0; k < yearList.length; k++) sample.push(...rowsByYear.get(yearList[Math.floor(rnd() * yearList.length)]));
      const L = fitLinks(sample, dw, target, groupOf, groups);
      if (!L) continue;
      const C = contributions(L, da, groupOf, years, rows);
      C.forEach((c, p) => boot.contrib[p].push(c.trend));
      L.forEach((link, p) => link.forEach((v, g) => boot.links[p][g].push(v)));
      const total = C.reduce((s, c) => s + c.trend, 0);
      boot.total.push(total);
      boot.left.push(observedTrend - total);
    }

    // 6) alibi check: each driver slid out of sync by whole years
    const alibi = drivers.map((_, p) => {
      const n = dw[p].length, real = Math.abs(contrib[p].trend), shifts = [];
      for (let s = 36; s <= n - 36; s += 12) {
        const shift = (arr) => arr.map((_, i) => arr[(i + s) % n]);
        const w2 = dw.map((w, q) => (q === p ? shift(w) : w)), a2 = da.map((a, q) => (q === p ? shift(a) : a));
        const ok = rowList.filter((i) => w2.every((w) => isNum(w[i])) && isNum(a2[p][i]));
        const L = fitLinks(ok, w2, target, groupOf, groups);
        if (!L) continue;
        shifts.push(Math.abs(contributions(L, a2, groupOf, years, new Set(ok))[p].trend));
      }
      const beaten = shifts.filter((v) => v >= real).length;
      return shifts.length ? { p: (beaten + 1) / (shifts.length + 1), tries: shifts.length } : null;
    });

    // drivers that move together (their split is less certain)
    const together = [];
    for (let p = 0; p < dw.length; p++) for (let q = p + 1; q < dw.length; q++) {
      const a = [], b = [];
      rowList.forEach((i) => { a.push(dw[p][i]); b.push(dw[q][i]); });
      const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
      let sab = 0, saa = 0, sbb = 0;
      a.forEach((v, i) => { sab += (v - ma) * (b[i] - mb); saa += (v - ma) ** 2; sbb += (b[i] - mb) ** 2; });
      const r = saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
      if (Math.abs(r) >= 0.7) together.push({ a: drivers[p].code, b: drivers[q].code, r });
    }

    return {
      dates, months: rowList.length, start: dates[rowList[0]], end: dates[rowList.at(-1)], seasonal,
      seasons: seasonal ? SEASON_NAMES : ["All months"],
      observed: { trend: observedTrend, result: observed },
      drivers: drivers.map((d, p) => ({
        code: d.code,
        trend: contrib[p].trend,
        low: percentile(boot.contrib[p], 0.025), high: percentile(boot.contrib[p], 0.975),
        share: observedTrend ? contrib[p].trend / observedTrend : null,
        links: links[p].map((v, g) => ({ value: v, low: percentile(boot.links[p][g], 0.025), high: percentile(boot.links[p][g], 0.975) })),
        driverTrend: fits[p + 1].slope_per_decade,
        alibi: alibi[p],
        series: contrib[p].series,
      })),
      // all drivers together (its range comes from the re-runs; ranges of parts don't simply add)
      accounted: { trend: contrib.reduce((s, c) => s + c.trend, 0), low: percentile(boot.total, 0.025), high: percentile(boot.total, 0.975) },
      left: { trend: leftFit.slope_per_decade, low: percentile(boot.left, 0.025), high: percentile(boot.left, 0.975), result: leftFit, series: left },
      outcomeAnomaly: anomalies[0].map((a, i) => (rows.has(i) ? a : null)),
      together,
    };
  }

  // Across the planet: in comparable places (similar latitude), do faster driver trends go with
  // faster outcome trends? Uses the precomputed world trend grids, a second, independent line
  // of evidence (space instead of time). layers: {step, slope[]} on a regular grid.
  function acrossPlanet(outcomeLayer, driverLayer, lat, band = 20) {
    if (!outcomeLayer || !driverLayer) return null;
    const at = (layer, la, lo) => {
      const cols = Math.round(360 / layer.step);
      const row = Math.floor((la + 90) / layer.step), col = Math.floor((lo + 180) / layer.step);
      return layer.slope[row * cols + col];
    };
    const base = outcomeLayer.step >= driverLayer.step ? outcomeLayer : driverLayer;   // coarser grid
    const cols = Math.round(360 / base.step), points = [];
    base.slope.forEach((_, i) => {
      const la = -90 + base.step / 2 + Math.floor(i / cols) * base.step, lo = -180 + base.step / 2 + (i % cols) * base.step;
      if (Math.abs(la - lat) > band) return;
      const y = at(outcomeLayer, la, lo), x = at(driverLayer, la, lo);
      if (isNum(x) && isNum(y)) points.push([x, y, la, lo]);
    });
    if (points.length < 12) return null;
    const n = points.length, mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    points.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
    if (!sxx || !syy) return null;
    return { points, slope: sxy / sxx, intercept: my - (sxy / sxx) * mx, r: sxy / Math.sqrt(sxx * syy), n, band };
  }

  return { decompose, acrossPlanet, SEASON_NAMES, seasonOf };
})(typeof module === "undefined" ? ByteMeStats : require("./stats.js"));

if (typeof module !== "undefined") module.exports = ByteMeDecompose;
