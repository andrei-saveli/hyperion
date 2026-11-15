// Calendar-month windows and matched comparisons, independent of the page and data loaders.
const ByteMeInvestigation = (function (stats) {
  const key = ({ year, month }) => year * 12 + month - 1;
  const dateOf = (index) => ({ year: Math.floor(index / 12), month: index % 12 + 1 });
  const monthText = ({ year, month }) => `${year}-${String(month).padStart(2, "0")}`;
  const isMonth = (value) => typeof value === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
  function monthKey(value) {
    const [year, month] = value.split("-").map(Number);
    return key({ year, month });
  }

  function periodOf(from, to) {
    if ((from && !isMonth(from)) || (to && !isMonth(to)) || (from && to && from > to)) return null;
    return from || to ? { from: from || "", to: to || "" } : null;
  }

  function periodInQuestion(text) {
    const range = text.match(/\b(\d{4}(?:-\d{2})?)\s*(?:\bto\b|\bthrough\b|\band\b|[-–—])\s*(\d{4}(?:-\d{2})?)\b/i);
    if (range) {
      const from = range[1].length === 4 ? range[1] + "-01" : range[1];
      const to = range[2].length === 4 ? range[2] + "-12" : range[2];
      return periodOf(from, to);
    }
    const since = text.match(/\b(?:since|from)\s+(\d{4}(?:-\d{2})?)\b/i);
    if (!since) return null;
    return periodOf(since[1].length === 4 ? since[1] + "-01" : since[1], "");
  }

  function slice(series, period) {
    if (!series || !period) return series;
    const dates = [], values = [];
    series.dates.forEach((date, i) => {
      const month = monthText(date);
      if ((period.from && month < period.from) || (period.to && month > period.to)) return;
      dates.push(date);
      values.push(series.values[i]);
    });
    return dates.length ? { dates, values } : null;
  }

  function match(a, b, period = null) {
    if (!a || !b) return null;
    const start = Math.max(key(a.dates[0]), key(b.dates[0]), period?.from ? monthKey(period.from) : -Infinity);
    const end = Math.min(key(a.dates.at(-1)), key(b.dates.at(-1)), period?.to ? monthKey(period.to) : Infinity);
    if (start > end) return null;

    const byMonth = (series) => new Map(series.dates.map((date, i) => [key(date), series.values[i]]));
    const am = byMonth(a), bm = byMonth(b);
    const dates = [], av = [], bv = [], difference = [];
    let count = 0, first = null, last = null;
    for (let k = start; k <= end; k++) {
      const va = am.get(k), vb = bm.get(k);
      const paired = Number.isFinite(va) && Number.isFinite(vb);
      const date = dateOf(k);
      dates.push(date);
      av.push(paired ? va : null);
      bv.push(paired ? vb : null);
      difference.push(paired ? va - vb : null);
      if (paired) {
        count++;
        first ??= date;
        last = date;
      }
    }
    return { dates, values: [av, bv], difference, count, first, last };
  }

  function recentPeriod(first, last, years) {
    const from = key(last) - years * 12 + 1;
    return from > key(first) ? { from: monthText(dateOf(from)), to: monthText(last) } : null;
  }

  // Newey-West uncertainty for the slope of the paired difference. Partial out calendar-month
  // offsets from time and use Bartlett weights over actual month gaps (one year of lags).
  function differenceInterval(paired, fit) {
    const { dates, difference, count } = paired;
    const countByMonth = Array(13).fill(0), timeByMonth = Array(13).fill(0);
    const time = dates.map((date) => (key(date) - key(dates[0])) / 12);
    dates.forEach(({ month }, i) => {
      if (difference[i] === null) return;
      countByMonth[month]++;
      timeByMonth[month] += time[i];
    });
    let sumSquares = 0;
    const scores = dates.map(({ month }, i) => {
      if (difference[i] === null) return 0;
      const adjustedTime = time[i] - timeByMonth[month] / countByMonth[month];
      sumSquares += adjustedTime ** 2;
      return adjustedTime * (fit.anomaly[i] - fit.trend[i]);
    });
    const df = count - countByMonth.filter(Boolean).length - 1;
    if (sumSquares <= 0 || df <= 0) return null;

    const lags = 12;
    let variance = scores.reduce((sum, score) => sum + score ** 2, 0);
    for (let lag = 1; lag <= lags; lag++) {
      let covariance = 0;
      for (let i = lag; i < scores.length; i++) covariance += scores[i] * scores[i - lag];
      variance += 2 * (1 - lag / (lags + 1)) * covariance;
    }
    const margin = 10 * stats.tCritical975(df) * Math.sqrt(Math.max(0, variance) * count / df) / sumSquares;
    return [fit.slope_per_decade - margin, fit.slope_per_decade + margin];
  }

  function compare(paired, percent) {
    if (!paired?.count) return null;
    const { dates, values, difference } = paired;
    const sides = values.map((v) => stats.analyze(dates, v, percent));
    const fit = stats.analyze(dates, difference);
    const interval = fit.verdict === "insufficient" || fit.reliability === "low" ? null : differenceInterval(paired, fit);
    return { sides, slope: fit.slope_per_decade, interval };
  }

  return { monthText, periodOf, periodInQuestion, slice, match, recentPeriod, compare };
})(typeof module === "undefined" ? ByteMeStats : require("./stats.js"));

if (typeof module !== "undefined") module.exports = ByteMeInvestigation;
