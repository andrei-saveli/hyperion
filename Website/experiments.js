// These links encode testable predictions for selected pairs of measurements.
// The sign says whether the long-term slopes should point in the same (+1)
// or opposite (-1) directions under the stated hypothesis.
const ByteMeExperiments = (function (stats, investigation) {
  const hypotheses = [
    {
      from: "T2M", to: "SNODP", label: "Check snow depth", expectedSign: -1,
      prediction: "If changes in air temperature account for changes in snow depth through melting, the long-term trends should point in opposite directions.",
      alternative: "Changes in snowfall or the timing of storms can also change snow depth.",
    },
    {
      from: "SNODP", to: "T2M", label: "Check air temperature", expectedSign: -1,
      prediction: "An explanation based on warmer air predicts that snow depth and temperature move in opposite directions.",
      alternative: "Look at snowfall and storm timing as rival explanations for a change in snow depth.",
    },
    {
      from: "SNODP", to: "PRECTOTCORR", label: "Test the precipitation explanation", expectedSign: 1,
      prediction: "If total precipitation accounts for the change in snow depth, the two trends should point in the same direction.",
      alternative: "Total precipitation includes both rain and snow. A shift from snow to rain could reduce snow depth even as total precipitation rises.",
    },
    {
      from: "PRECTOTCORR", to: "GWETROOT", label: "Check root-zone wetness", expectedSign: 1,
      prediction: "If changing precipitation is driving soil wetness, the two measures should generally move in the same direction.",
      alternative: "Evaporation, irrigation, and runoff can alter how much water reaches or stays in the soil.",
    },
    {
      from: "GWETROOT", to: "PRECTOTCORR", label: "Test the precipitation explanation", expectedSign: 1,
      prediction: "If changes in precipitation account for changes in soil moisture, their trends should generally point in the same direction.",
      alternative: "Changes in evaporation, irrigation, or drainage can dry soil even where total precipitation rises.",
    },
    {
      from: "GWETROOT", to: "MODIS_NDVI", label: "Check vegetation greenness", expectedSign: 1,
      prediction: "If water limits plant growth in this region, root-zone wetness and greenness should tend to move in the same direction.",
      alternative: "Land use, temperature, and differences in the plants observed can change greenness independently of soil moisture.",
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

  return { relatedLeads, assessLead, policyTest };
})(
  typeof module === "undefined" ? ByteMeStats : require("./stats.js"),
  typeof module === "undefined" ? ByteMeInvestigation : require("./investigation.js")
);

if (typeof module !== "undefined") module.exports = ByteMeExperiments;
