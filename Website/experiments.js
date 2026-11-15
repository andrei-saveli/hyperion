// These links encode testable predictions for selected pairs of measurements.
// The sign says whether the long-term slopes should point in the same (+1)
// or opposite (-1) directions under the stated hypothesis.
const ByteMeExperiments = (function (stats, investigation) {
  const evaporationRival = {
    kind: "evaporation", from: "GWETROOT", to: "EVLAND", expectedSign: 1,
    targetName: "Precipitation minus evaporation",
    prediction: "If evaporation helps explain the change in root-zone wetness, precipitation minus evaporation should trend in the same direction as soil wetness.",
  };
  const hypotheses = [
    {
      from: "T2M", to: "SNODP", label: "Check snow depth", expectedSign: -1,
      prediction: "If changes in air temperature account for changes in snow depth through melting, the long-term trends should point in opposite directions.",
      alternative: "Changes in how much snow falls could outweigh changes in melting. Wetter winters could add snow even as the air warms.",
      rival: { from: "SNODP", to: "PRECTOTCORR" },
      nextEvidence: "Look for snowfall-only observations to separate changes in accumulation from changes in melt.",
    },
    {
      from: "SNODP", to: "T2M", label: "Check air temperature", expectedSign: -1,
      prediction: "An explanation based on warmer air predicts that snow depth and temperature move in opposite directions.",
      alternative: "Changes in snow accumulation could outweigh changes in melt. A change in the number or intensity of snowstorms could explain the pattern.",
      rival: { from: "SNODP", to: "PRECTOTCORR" },
      nextEvidence: "Look for snowfall-only observations to see whether snow accumulation changed.",
    },
    {
      from: "SNODP", to: "PRECTOTCORR", label: "Test the precipitation explanation", expectedSign: 1,
      prediction: "If total precipitation accounts for the change in snow depth, the two trends should point in the same direction.",
      alternative: "Temperature could be changing either the rate of melt or how much precipitation falls as snow. A shift from snow to rain could reduce snow depth even as total precipitation rises.",
      rival: { from: "SNODP", to: "T2M" },
      nextEvidence: "Look for snowfall-only observations to distinguish less snow falling from faster melt.",
    },
    {
      from: "PRECTOTCORR", to: "GWETROOT", label: "Check root-zone wetness", expectedSign: 1,
      prediction: "If changing precipitation is driving soil wetness, the two measures should generally move in the same direction.",
      alternative: "Water losses could dominate the rainfall change. More evaporation or runoff can leave the root zone drier during a wetter period.",
      rival: evaporationRival,
      nextEvidence: "Check evaporation and runoff during the months in which the two records diverge.",
    },
    {
      from: "GWETROOT", to: "PRECTOTCORR", label: "Test the precipitation explanation", expectedSign: 1,
      prediction: "If changes in precipitation account for changes in soil moisture, their trends should generally point in the same direction.",
      alternative: "Evaporation or drainage could explain soil drying during a wetter period. Irrigation or reduced losses could explain wetter soil during a drier period.",
      rival: evaporationRival,
      nextEvidence: "Check evaporation and local water management over the same period.",
    },
    {
      from: "GWETROOT", to: "MODIS_NDVI", label: "Check vegetation greenness", expectedSign: 1,
      prediction: "If water limits plant growth in this region, root-zone wetness and greenness should tend to move in the same direction.",
      alternative: "A change in land use or plant cover could explain a greenness trend that runs against the moisture trend.",
      nextEvidence: "Check whether land cover, crops, or the timing of the growing season changed over these years.",
    },
  ];

  function relatedLeads(code, records) {
    return hypotheses.filter((lead) => lead.from === code && records[lead.to]?.values.some(Number.isFinite));
  }

  function assessLead(lead, first, second) {
    const paired = investigation.matchMonths(first, second);
    if (!paired?.count) return { paired, fits: [], verdict: "insufficient" };

    const fits = paired.values.map((values) => stats.analyze(paired.dates, values));
    const clearDirection = fits.every((fit) =>
      fit.verdict === "significant" && fit.tests_agree && fit.reliability !== "low"
    );
    if (!clearDirection) return { paired, fits, verdict: "insufficient" };

    const observedSign = fits[0].direction === fits[1].direction ? 1 : -1;
    return { paired, fits, verdict: observedSign === lead.expectedSign ? "consistent" : "weakened" };
  }

  function rivalLead(lead, records) {
    if (!lead.rival) return null;
    const { from, to } = lead.rival;
    const required = lead.rival.kind === "evaporation" ? [from, to, "PRECTOTCORR"] : [from, to];
    if (!required.every((code) => records[code]?.values.some(Number.isFinite))) return null;
    if (lead.rival.kind === "evaporation") return lead.rival;
    return hypotheses.find((candidate) => candidate.from === from && candidate.to === to) ?? null;
  }

  // Keep the rival check inside the original comparison's observed months.
  // Missing data in a third measurement can shorten the overlap further.
  function assessRival(rival, originalPair, records) {
    const { dates, values } = originalPair;
    function onOriginalCalendar({ dates: recordDates, values: recordValues }) {
      const byMonth = new Map(recordDates.map((date, index) => [investigation.monthText(date), recordValues[index]]));
      return {
        dates,
        values: dates.map((date, index) => Number.isFinite(values[0][index])
          ? byMonth.get(investigation.monthText(date)) ?? null
          : null),
      };
    }
    const first = onOriginalCalendar(records[rival.from]);
    const second = onOriginalCalendar(records[rival.to]);
    if (rival.kind !== "evaporation") return assessLead(rival, first, second);

    const precipitation = onOriginalCalendar(records.PRECTOTCORR);
    const balance = precipitation.values.map((rain, index) => {
      const evaporation = second.values[index];
      return Number.isFinite(rain) && Number.isFinite(evaporation) ? rain - evaporation : null;
    });
    const assessment = assessLead(rival, first, { dates, values: balance });
    if (!assessment.paired?.count) return assessment;

    const matchedWetness = assessment.paired.values[0];
    const componentFits = [precipitation, second].map((series) => stats.analyze(
      dates, series.values.map((value, index) => matchedWetness[index] === null ? null : value),
    ));
    return { ...assessment, componentFits };
  }

  function policyTest(study, { postWeeks, omitLargestDonor = false, adjustBaseline = false } = {}) {
    const controlColumn = omitLargestDonor ? 3 : 2;
    const weeks = study.weeks.map((row) => ({ date: row[0], observed: row[1], control: row[controlColumn] }));
    const intervention = weeks.findIndex(({ date }) => date === study.policyStart);
    const heldOut = weeks.slice(study.trainingWeeks, intervention);
    const before = summarizeGap(heldOut);
    const levelAdjustment = adjustBaseline ? before.gap : 0;
    const last = postWeeks ? intervention + postWeeks : weeks.length;
    const selected = weeks.slice(0, last).map((week) => ({
      ...week, control: week.control + levelAdjustment,
    }));
    const after = summarizeGap(selected.slice(intervention));
    return { intervention, before, after, weeks: selected };
  }

  function summarizeGap(weeks) {
    const mean = (key) => weeks.reduce((sum, week) => sum + week[key], 0) / weeks.length;
    const observed = mean("observed"), control = mean("control");
    const gap = observed - control;
    const squaredError = weeks.reduce((sum, week) => sum + (week.observed - week.control) ** 2, 0);
    return { gap, percent: 100 * gap / control, rmse: Math.sqrt(squaredError / weeks.length), count: weeks.length };
  }

  return { relatedLeads, assessLead, rivalLead, assessRival, policyTest };
})(
  typeof module === "undefined" ? ByteMeStats : require("./stats.js"),
  typeof module === "undefined" ? ByteMeInvestigation : require("./investigation.js")
);

if (typeof module !== "undefined") module.exports = ByteMeExperiments;
