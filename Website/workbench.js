// The investigation ledger and reusable analysis methods. A check keeps the records
// from the period when it ran so later changes to the date picker cannot rewrite it.
const ByteMeWorkbench = (function (experiments, investigation) {
  const cases = new Map();

  function openCase({ lat, lon, code }) {
    const key = JSON.stringify([lat, lon, code]);
    if (!cases.has(key)) cases.set(key, { entries: [], studies: [], active: null });
    return cases.get(key);
  }

  const samePeriod = (a, b) => a?.from === b?.from && a?.to === b?.to;

  function findEntry(file, lead, period, lag = 0, rivalOf = null) {
    return file.entries.find((entry) => entry.lead.to === lead.to && entry.lead.label === lead.label
      && entry.lead.driver === lead.driver && entry.lead.prediction === lead.prediction
      && entry.lag === lag && entry.rivalOf === rivalOf && samePeriod(entry.period, period));
  }

  function runLead(file, lead, period, records, lag = 0, original = null) {
    const rivalOf = original?.id ?? null;
    if (original) {
      period = original.period;
      records = original.records;
    }
    let entry = findEntry(file, lead, period, lag, rivalOf);
    if (!entry) {
      const assessment = original && records[lead.to]?.values.some(Number.isFinite)
        ? experiments.assessRival(lead, original.assessment.paired, records)
        : experiments.assessLead(lead, records[lead.from], records[lead.to]);
      entry = {
        id: file.entries.length + 1, lead, period, records, lag, assessment, rivalOf,
        association: lead.driver ? residualAssociation(assessment, lag, lead.driver === lead.from ? 0 : 1) : null,
        rival: null,
      };
      file.entries.push(entry);
    }
    file.active = entry;
    return entry;
  }

  function runRival(entry, rival) {
    entry.rival ??= {
      lead: rival, assessment: experiments.assessRival(rival, entry.assessment.paired, entry.records),
    };
    return entry.rival;
  }

  // The proposed driver leads the outcome by the chosen lag. We retain
  // calendar gaps and compare residuals after removing seasonality and linear trend.
  function residualAssociation({ paired, fits }, lag, driverIndex) {
    if (!paired?.count || fits.some((fit) => !Number.isFinite(fit.slope_per_decade))) return null;
    const driver = fits[driverIndex], outcome = fits[1 - driverIndex];
    const pairs = [];
    for (let month = lag; month < paired.dates.length; month++) {
      if (outcome.anomaly[month] === null || driver.anomaly[month - lag] === null) continue;
      pairs.push([
        driver.anomaly[month - lag] - driver.trend[month - lag],
        outcome.anomaly[month] - outcome.trend[month],
      ]);
    }
    if (pairs.length < 3) return null;
    const mean = (index) => pairs.reduce((sum, pair) => sum + pair[index], 0) / pairs.length;
    const xMean = mean(0), yMean = mean(1);
    let cross = 0, xSquares = 0, ySquares = 0;
    for (const [x, y] of pairs) {
      cross += (x - xMean) * (y - yMean);
      xSquares += (x - xMean) ** 2;
      ySquares += (y - yMean) ** 2;
    }
    if (!xSquares || !ySquares) return null;
    return { correlation: cross / Math.sqrt(xSquares * ySquares), count: pairs.length };
  }

  // Compare A minus B across three equal windows. A month is usable only when both
  // places have data for that calendar position in all three windows.
  function interventionComparison(paired, month, monthsPerWindow) {
    if (!paired || !investigation.periodOf(month, "") || ![12, 24, 36].includes(monthsPerWindow)) return null;
    const launch = paired.dates.findIndex((date) => investigation.monthText(date) === month);
    const start = launch - 2 * monthsPerWindow;
    if (start < 0 || launch + monthsPerWindow > paired.dates.length) return null;

    const gaps = [[], [], []];
    for (let offset = 0; offset < monthsPerWindow; offset++) {
      const values = gaps.map((_, window) => paired.difference[start + offset + window * monthsPerWindow]);
      if (values.every(Number.isFinite)) values.forEach((value, window) => gaps[window].push(value));
    }
    const count = gaps[0].length;
    if (!count) return null;
    const [earlier, before, after] = gaps.map((window) => window.reduce((sum, gap) => sum + gap, 0) / count);
    return { earlier, before, after, difference: after - before, placebo: before - earlier, count };
  }

  return { openCase, samePeriod, findEntry, runLead, runRival, interventionComparison };
})(ByteMeExperiments, ByteMeInvestigation);
