// Checks the evidence ladder (evidence.js). Run:  node Website/tests/test_evidence.js
const fs = require("fs");
const path = require("path");
const { assess, monthlyLink, seasonMonths } = require("../evidence.js");
let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL " + what); } };

// reproducible random numbers
let seed = 42;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const dates = Array.from({ length: 360 }, (_, i) => ({ year: 1990 + Math.floor(i / 12), month: (i % 12) + 1 }));
const season = (i) => 10 * Math.sin((2 * Math.PI * i) / 12);

// 1) a driver that warms, and an outcome that responds with slope -2 (opposite way)
const driverVals = dates.map((_, i) => season(i) + 0.003 * i + normal());
const outcomeVals = driverVals.map((d, i) => 5 * Math.cos((2 * Math.PI * i) / 12) - 2 * (d - season(i)) + 0.5 * normal());
const driver = { dates, values: driverVals }, outcome = { dates, values: outcomeVals };
const link = monthlyLink(outcome, driver, null);
check(link && link.low < -2 && link.high > -2, `95% range covers the true link of -2 (got ${link && link.low.toFixed(2)}..${link && link.high.toFixed(2)})`);
const real = assess(outcome, driver, -1);
check(real.level === "explains", `real mechanism explains the trend (got ${real.level}: ${real.reason})`);
check(real.explained && Math.abs(real.explained.share - 1) < 0.25, `explains about all of it (share ${real.explained && real.explained.share.toFixed(2)})`);
check(assess(outcome, driver, +1).level === "against", "wrong expected direction is reported as against");

// 2) two unrelated series that both trend: co-trending is NOT evidence
const a = { dates, values: dates.map((_, i) => season(i) + 0.01 * i + normal()) };
const b = { dates, values: dates.map((_, i) => season(i) - 0.01 * i + normal()) };
const unrelated = assess(b, a, -1);
check(unrelated.level === "unclear", `unrelated trending series stay unclear (got ${unrelated.level})`);

// 3) a link that is real month to month, but whose driver has no trend: can't explain the trend
const flat = { dates, values: dates.map((_, i) => season(i) + normal()) };
const trending = { dates, values: flat.values.map((d, i) => 2 * (d - season(i)) + 0.02 * i + 0.5 * normal()) };
const noShare = assess(trending, flat, +1);
check(noShare.level === "link", `link but no explained share (got ${noShare.level})`);

// 4) neighbouring months alike: the range must widen (effective sample size)
let x = 0, y = 0;
const smoothX = [], smoothY = [];
dates.forEach(() => { x = 0.9 * x + normal(); y = 0.9 * y + normal(); smoothX.push(x); smoothY.push(y); });
const smooth = monthlyLink({ dates, values: smoothY }, { dates, values: smoothX }, null);
check(smooth.effectiveN < smooth.n / 2, `effective n much smaller than n for slow series (${smooth.effectiveN.toFixed(0)} of ${smooth.n})`);

// 5) seasons come from the outcome's usual yearly cycle: a snowpack that builds Oct-Apr and melts May-Jul
const snowCycle = [40, 50, 60, 70, 60, 30, 5, 0, 0, 10, 20, 30];   // Jan..Dec
const snow = { dates, values: dates.map((d) => snowCycle[d.month - 1] + normal()) };
const falling = seasonMonths("falling", snow), rising = seasonMonths("rising", snow);
check(JSON.stringify(falling) === "[5,6,7,8]", `melt months found from the data (got ${falling})`);
check(rising.includes(1) && rising.includes(10) && !rising.includes(6), `build-up months found (got ${rising})`);
check(seasonMonths(null, snow) === null, "no season means all months");

// 6) real data: Svalbard, warmer melt seasons go with less snow (NASA POWER fixture)
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "power_svalbard.json"), "utf8"));
const keys = Object.keys(fx.T2M).filter((k) => +k.slice(4) <= 12).sort();
const series = (code) => ({ dates: keys.map((k) => ({ year: +k.slice(0, 4), month: +k.slice(4) })), values: keys.map((k) => (fx[code][k] === -999 ? null : fx[code][k])) });
const melt = assess(series("SNODP"), series("T2M"), -1, seasonMonths("falling", series("SNODP")));
console.log("  Svalbard melt months from data:", seasonMonths("falling", series("SNODP")), "link", melt.link && melt.link.slope.toFixed(2), melt.level, melt.explained ? `share ${melt.explained.share.toFixed(2)}` : "");
check(melt.link && melt.link.slope < 0, `Svalbard melt season: warmer -> less snow (slope ${melt.link && melt.link.slope.toFixed(2)})`);
const allYear = assess(series("SNODP"), series("T2M"), -1, null);
check(allYear.level === "against", `Svalbard all months: warmer months have more snow (got ${allYear.level})`);

console.log(`evidence tests: ${failures} failures`);
process.exit(failures ? 1 : 0);
