const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { periodOf, periodInQuestion, slice, match, recentPeriod, compare } = require("../investigation.js");
const { tCritical975 } = require("../stats.js");
const { locate, decode } = require("../nasa.js");
const index = require("../data/nasa/index.json");

const dates = Array.from({ length: 144 }, (_, i) => ({ year: 2000 + Math.floor(i / 12), month: i % 12 + 1 }));
const series = (value) => ({ dates, values: dates.map(value) });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

assert.deepEqual(periodInQuestion("Did rain decline from 2001 to 2015?"), { from: "2001-01", to: "2015-12" });
assert.deepEqual(periodInQuestion("rain 2001-03–2015-10"), { from: "2001-03", to: "2015-10" });
assert.deepEqual(periodInQuestion("rain 2001-2015"), { from: "2001-01", to: "2015-12" });
assert.deepEqual(periodInQuestion("temperature since 2009"), { from: "2009-01", to: "" });
assert.equal(periodOf("2015-01", "2001-12"), null);
assert.equal(periodOf("2015-13", ""), null);
assert.deepEqual(recentPeriod(dates[0], dates.at(-1), 11), { from: "2001-01", to: "2011-12" });
assert.equal(recentPeriod(dates[0], dates.at(-1), 15), null);

const a = series((_, i) => i % 5 === 0 ? null : i);
const b = series((_, i) => 2 * i);
b.dates = b.dates.slice(1).filter((_, i) => i !== 2);
b.values = b.values.slice(1).filter((_, i) => i !== 2);
const short = periodOf("2000-01", "2000-06");
const paired = match(a, b, short);
assert.deepEqual(paired.dates.map((d) => d.month), [2, 3, 4, 5, 6]);
assert.deepEqual(paired.values, [[1, 2, null, 4, null], [2, 4, null, 8, null]]);
assert.deepEqual(paired.difference, [-1, -2, null, -4, null]);
assert.equal(paired.count, 3);
assert.equal(compare(paired).slope, null);
assert.equal(compare(paired).interval, null);
assert.equal(match(a, b, periodOf("2020-01", "")), null);
assert.equal(slice(a, periodOf("", "1999-12")), null);
assert.equal(slice(a, short).dates.length, 6);

// This constructed residual is orthogonal to the calendar and time terms. Only three
// residual scores are nonzero, so the expected covariance has one hand-calculable lag.
const residual = { 0: 1, 12: -2, 24: 1 };
const baseline = series(({ month }, i) => 25 * Math.sin(month) + i / 120);
const rising = series(({ month }, i) => 25 * Math.sin(month) + 4 * i / 120 + (residual[i] || 0));
const trend = compare(match(rising, baseline));
near(trend.sides[0].slope_per_decade - trend.sides[1].slope_per_decade, 3);
near(trend.slope, 3);
const variance = 123.5 - (2 / 13) * 81;
const margin = 10 * tCritical975(131) * Math.sqrt(variance * 144 / 131) / 1716;
near(trend.interval[0], 3 - margin);
near(trend.interval[1], 3 + margin);
const noDifference = compare(match(baseline, baseline));
assert.equal(noDifference.slope, 0);
assert.deepEqual(noDifference.interval, [0, 0]);

function omi(lat, lon) {
  const { tile, square } = locate(lat, lon, index.tile);
  const bytes = fs.readFileSync(path.join(__dirname, "../data/nasa/OMI_NO2", tile + ".bin"));
  return decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), square, index.variables.OMI_NO2, index.missing);
}
const observations = match(omi(40, 116.25), omi(28.5, 77.5));
const result = compare(observations);
assert.equal(observations.count, 255);
near(result.slope, -1.7804706673267718);
assert.ok(result.interval[0] < result.slope && result.interval[1] < 0);

console.log("Investigation checks passed (dates, missing months, short windows, slope uncertainty, and real OMI data)");
