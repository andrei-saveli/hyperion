const assert = require("node:assert/strict");
const { test } = require("node:test");
const { relatedLeads, assessLead, rivalLead, assessRival, policyTest } = require("../experiments.js");
const london = require("../data/london-ulez.json");

function record(rate) {
  const dates = Array.from({ length: 240 }, (_, i) => ({ year: 2000 + Math.floor(i / 12), month: i % 12 + 1 }));
  const values = dates.map(({ month }, i) => rate * i / 120 + Math.sin(month) + 0.1 * Math.sin(i * 2));
  return { dates, values };
}

test("a lead can fit a prediction, weaken it, or remain open", () => {
  const temperature = record(2), fallingSnow = record(-3), risingSnow = record(3);
  const [lead] = relatedLeads("T2M", { SNODP: fallingSnow });
  assert.equal(lead.to, "SNODP");
  assert.equal(relatedLeads("T2M", {}).length, 0);
  assert.equal(assessLead(lead, temperature, fallingSnow).verdict, "consistent");
  assert.equal(assessLead(lead, temperature, risingSnow).verdict, "weakened");
  assert.equal(assessLead(lead, temperature, record(0)).verdict, "insufficient");
  assert.equal(assessLead(lead, temperature, null).verdict, "insufficient");
});

test("a weakened snow lead can test a rival on the original observed months", () => {
  const records = { SNODP: record(-3), PRECTOTCORR: record(2), T2M: record(2) };
  records.PRECTOTCORR.values[24] = null;
  records.T2M.values[35] = null;
  const precipitation = relatedLeads("SNODP", records).find(({ to }) => to === "PRECTOTCORR");
  const original = assessLead(precipitation, records.SNODP, records.PRECTOTCORR);
  assert.equal(original.verdict, "weakened");

  const rival = rivalLead(precipitation, records);
  assert.equal(rival.to, "T2M");
  const followUp = assessRival(rival, original.paired, records);
  assert.equal(followUp.verdict, "consistent");
  assert.equal(followUp.paired.count, original.paired.count - 1);
  assert.equal(followUp.paired.values[0][24], null);
  assert.equal(followUp.paired.values[0][35], null);
  assert.equal(rivalLead(precipitation, { ...records, T2M: null }), null);
});

test("the soil-wetness rival tests precipitation minus evaporation over three-way overlaps", () => {
  const records = { GWETROOT: record(-3), PRECTOTCORR: record(2), EVLAND: record(5) };
  const [lead] = relatedLeads("GWETROOT", records);
  records.PRECTOTCORR.values[24] = null;
  records.EVLAND.values[35] = null;
  const original = assessLead(lead, records.GWETROOT, records.PRECTOTCORR);
  const rival = rivalLead(lead, records);
  assert.equal(original.verdict, "weakened");
  assert.equal(rival.kind, "evaporation");
  assert.equal(rivalLead(lead, { ...records, EVLAND: null }), null);

  const followUp = assessRival(rival, original.paired, records);
  assert.equal(followUp.verdict, "consistent");
  assert.equal(followUp.paired.count, original.paired.count - 1);
  assert.equal(followUp.paired.values[1][24], null);
  assert.equal(followUp.paired.values[1][35], null);
  const [precipitation, evaporation] = followUp.componentFits;
  assert.ok(evaporation.slope_per_decade > precipitation.slope_per_decade);
  assert.ok(Math.abs(followUp.fits[1].slope_per_decade
    - (precipitation.slope_per_decade - evaporation.slope_per_decade)) < 1e-9);

  assert.equal(assessRival(rival, original.paired, { ...records, EVLAND: record(1) }).verdict, "weakened");
  assert.equal(assessRival(rival, original.paired, { ...records, EVLAND: record(2) }).verdict, "insufficient");
});

test("the data and checks reproduce the London policy experiment", () => {
  const initial = policyTest(london, { postWeeks: 13 });
  assert.equal(initial.weeks[initial.intervention].date, "2019-04-08");
  assert.equal(initial.before.count, 8);
  assert.equal(initial.after.count, 13);
  assert.ok(Math.abs(initial.before.gap - (-5.66)) < 0.01);
  assert.ok(Math.abs(initial.after.gap - (-11.88)) < 0.01);
  assert.ok(Math.abs(initial.after.percent - (-17.44)) < 0.01);

  const adjusted = policyTest(london, { postWeeks: 13, adjustBaseline: true });
  assert.ok(adjusted.after.gap > initial.after.gap && adjusted.after.gap < 0);
  assert.ok(Math.abs(adjusted.after.gap - (initial.after.gap - initial.before.gap)) < 1e-10);
  const bothChecks = policyTest(london, { omitLargestDonor: true, adjustBaseline: true });
  assert.equal(bothChecks.after.count, 48);
  assert.ok(bothChecks.after.gap < 0);
  assert.ok(Math.abs(london.weights.reduce((sum, { weight }) => sum + weight, 0) - 1) < 1e-6);
});
