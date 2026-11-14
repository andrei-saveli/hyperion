// Checks that the website's trend math (stats.js) gives the same numbers as the project's Python
// code (Task4/stats.py) on real NASA series. Run:  node Website/tests/test_stats.js
// The expected answers are in reference.json (made by make_reference.py).
const fs = require("fs");
const path = require("path");
const { analyze } = require("../stats.js");

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "reference.json"), "utf8"));
const TOLERANCE = 1e-6;   // numbers must agree to about 6 digits
let failures = 0, checks = 0;

function same(a, b) {
  if (a === null || b === null || typeof a !== "number" || typeof b !== "number") return a === b;
  return Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}

for (const c of cases) {
  const dates = c.dates.map((d) => ({ year: +d.slice(0, 4), month: +d.slice(5, 7) }));
  const got = analyze(dates, c.values, c.percent);
  for (const [key, want] of Object.entries(c.expected)) {
    checks++;
    let ok;
    if (Array.isArray(want)) ok = want.length === got[key].length && want.every((w, i) => same(w, got[key][i]));
    else if (key === "years_to_significance") ok = want === null ? got[key] === null : Math.abs(want - got[key]) <= 0.11;
    else ok = same(want, got[key]);
    if (!ok) {
      failures++;
      const show = (v) => (Array.isArray(v) ? `[${v.slice(0, 3)}...]` : v);
      console.log(`FAIL ${c.name} · ${key}: Python ${show(want)} vs website ${show(got[key])}`);
    }
  }
}
console.log(`${cases.length} series, ${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
