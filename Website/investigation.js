// A series has parallel dates ({ year, month }) and values (null for missing).
// A period has inclusive YYYY-MM bounds. An empty bound uses the available record.
const ByteMeInvestigation = (function (stats) {
  const monthIndex = ({ year, month }) => year * 12 + month - 1;
  const dateFromIndex = (index) => ({ year: Math.floor(index / 12), month: index % 12 + 1 });
  const monthText = ({ year, month }) => `${year}-${String(month).padStart(2, "0")}`;
  const isMonth = (value) => typeof value === "string" && /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
  function parseMonthIndex(value) {
    const [year, month] = value.split("-").map(Number);
    return monthIndex({ year, month });
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

  function slicePeriod(series, period) {
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

  function matchMonths(a, b, period = null) {
    if (!a || !b) return null;
    const selectedStart = period?.from ? parseMonthIndex(period.from) : -Infinity;
    const selectedEnd = period?.to ? parseMonthIndex(period.to) : Infinity;
    const start = Math.max(monthIndex(a.dates[0]), monthIndex(b.dates[0]), selectedStart);
    const end = Math.min(monthIndex(a.dates.at(-1)), monthIndex(b.dates.at(-1)), selectedEnd);
    if (start > end) return null;

    const byMonth = (series) => new Map(series.dates.map((date, i) => [monthIndex(date), series.values[i]]));
    const aByMonth = byMonth(a), bByMonth = byMonth(b);
    const dates = [], aValues = [], bValues = [], difference = [];
    let count = 0, first = null, last = null;
    // Keep missing months in the timeline so the chart and serial lags follow the calendar.
    for (let index = start; index <= end; index++) {
      const aValue = aByMonth.get(index), bValue = bByMonth.get(index);
      const observedInBoth = Number.isFinite(aValue) && Number.isFinite(bValue);
      const date = dateFromIndex(index);
      dates.push(date);
      aValues.push(observedInBoth ? aValue : null);
      bValues.push(observedInBoth ? bValue : null);
      difference.push(observedInBoth ? aValue - bValue : null);
      if (observedInBoth) {
        count++;
        first ??= date;
        last = date;
      }
    }
    return { dates, values: [aValues, bValues], difference, count, first, last };
  }

  function recentPeriod(first, last, years) {
    const from = monthIndex(last) - years * 12 + 1;
    return from > monthIndex(first) ? { from: monthText(dateFromIndex(from)), to: monthText(last) } : null;
  }

  // Newey-West uncertainty for the slope of the paired difference. Partial out calendar-month
  // offsets from time and use Bartlett weights over actual month gaps (one year of lags).
  function differenceInterval(paired, fit) {
    const { dates, difference, count } = paired;
    const countByMonth = Array(13).fill(0), timeByMonth = Array(13).fill(0);
    const start = monthIndex(dates[0]);
    const time = dates.map((date) => (monthIndex(date) - start) / 12);
    dates.forEach(({ month }, i) => {
      if (difference[i] === null) return;
      countByMonth[month]++;
      timeByMonth[month] += time[i];
    });
    let sumSquares = 0;
    const scores = dates.map(({ month }, i) => {
      if (difference[i] === null) return 0;
      const timeWithinMonth = time[i] - timeByMonth[month] / countByMonth[month];
      sumSquares += timeWithinMonth ** 2;
      return timeWithinMonth * (fit.anomaly[i] - fit.trend[i]);
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
    const standardErrorPerYear = Math.sqrt(Math.max(0, variance) * count / df) / sumSquares;
    const margin = 10 * stats.tCritical975(df) * standardErrorPerYear;
    return [fit.slope_per_decade - margin, fit.slope_per_decade + margin];
  }

  function fitComparison(paired, percent) {
    if (!paired?.count) return null;
    const { dates, values, difference } = paired;
    const sides = values.map((v) => stats.analyze(dates, v, percent));
    const fit = stats.analyze(dates, difference);
    const interval = fit.verdict === "insufficient" || fit.reliability === "low" ? null : differenceInterval(paired, fit);
    return { sides, slope: fit.slope_per_decade, interval };
  }

  return { monthText, periodOf, periodInQuestion, slicePeriod, matchMonths, recentPeriod, fitComparison };
})(typeof module === "undefined" ? ByteMeStats : require("./stats.js"));

if (typeof module !== "undefined") module.exports = ByteMeInvestigation;
