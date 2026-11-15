// Checks the Trend Decomposer (decompose.js). Run:  node Website/tests/test_decompose.js
const fs = require("fs");
const path = require("path");
const { decompose, acrossPlanet } = require("../decompose.js");
let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL " + what); } };
let seed = 3;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const dates = Array.from({ length: 480 }, (_, i) => ({ year: 1985 + Math.floor(i / 12), month: (i % 12) + 1 }));
const S = (fn) => ({ dates, values: dates.map(fn) });
const season = (i) => 8 * Math.sin((2 * Math.PI * i) / 12);

// 1) outcome = -2 x driver A (+ A's trend) + 1 x driver B + noise: contributions must add up and match
const A = dates.map((_, i) => season(i) + 0.004 * i + normal());
const B = dates.map((_, i) => 0.5 * season(i) - 0.002 * i + normal());
const Y = dates.map((_, i) => 3 * season(i) - 2 * (A[i] - season(i)) + 1 * (B[i] - 0.5 * season(i)) + 0.3 * normal());
const r = decompose(S((_, i) => Y[i]), [{ code: "A", series: S((_, i) => A[i]) }, { code: "B", series: S((_, i) => B[i]) }], { seasonal: false, reps: 150 });
const total = r.drivers.reduce((s, d) => s + d.trend, 0) + (r.observed.trend - r.drivers.reduce((s, d) => s + d.trend, 0));
check(Math.abs(total - r.observed.trend) < 1e-9, "contributions + left over = observed");
check(Math.abs(r.drivers[0].links[0].value + 2) < 0.1 && Math.abs(r.drivers[1].links[0].value - 1) < 0.1, `links recovered (got ${r.drivers.map((d) => d.links[0].value.toFixed(2))})`);
const truth = -2 * r.drivers[0].driverTrend;   // link x the driver trend that actually happened in this sample
check(r.drivers[0].low < truth && r.drivers[0].high > truth, `A's contribution range covers the truth ${truth.toFixed(2)} (${r.drivers[0].low.toFixed(2)}..${r.drivers[0].high.toFixed(2)})`);
check(r.accounted.low <= r.accounted.trend && r.accounted.trend <= r.accounted.high, "combined range contains the combined estimate");
check(Math.abs(r.left.trend) < 0.05 && r.left.result.verdict !== "significant", `nothing significant left over (left ${r.left.trend.toFixed(3)}, ${r.left.result.verdict})`);
check(r.drivers[0].alibi.p < 0.1, `A beats its out-of-sync copies (alibi p ${r.drivers[0].alibi.p.toFixed(3)})`);

// 2) a driver that only trends (no month-to-month link) must account for ~nothing (no spurious regression)
const T = dates.map((_, i) => season(i) - 0.01 * i + normal());
const Z = dates.map((_, i) => season(i) + 0.01 * i + normal());
const sp = decompose(S((_, i) => Z[i]), [{ code: "T", series: S((_, i) => T[i]) }], { seasonal: false, reps: 150 });
check(sp.drivers[0].low <= 0 && sp.drivers[0].high >= 0 || Math.abs(sp.drivers[0].share) < 0.15, `unrelated trending driver accounts for ~nothing (share ${sp.drivers[0].share.toFixed(2)})`);
check(sp.left.result.verdict === "significant", "the unrelated trend stays left over");

// 3) a link that flips with the season is found by the seasonal model
const W = dates.map((_, i) => season(i) + normal());
const V = dates.map((d, i) => ([6, 7, 8].includes(d.month) ? -3 : [12, 1, 2].includes(d.month) ? 2 : 0) * (W[i] - season(i)) + 0.3 * normal());
const sz = decompose(S((_, i) => V[i]), [{ code: "W", series: S((_, i) => W[i]) }], { seasonal: true, reps: 100 });
check(sz.drivers[0].links[2].value < -2.5 && sz.drivers[0].links[0].value > 1.5, `seasonal links found (Jun-Aug ${sz.drivers[0].links[2].value.toFixed(2)}, Dec-Feb ${sz.drivers[0].links[0].value.toFixed(2)})`);

// 4) two drivers that move together are flagged
const C1 = dates.map((_, i) => season(i) + normal());
const C2 = C1.map((v) => v + 0.2 * normal());
const tg = decompose(S((_, i) => C1[i] + normal()), [{ code: "C1", series: S((_, i) => C1[i]) }, { code: "C2", series: S((_, i) => C2[i]) }], { seasonal: false, reps: 30 });
check(tg.together.length === 1, "drivers that move together are flagged");

// 5) across the planet: a made-up grid where outcome trend = -3 x driver trend
const step = 10, cols = 36, rows = 18, n = cols * rows;
const dl = Array.from({ length: n }, () => normal()), ol = dl.map((x) => -3 * x + 0.1 * normal());
const ap = acrossPlanet({ step, slope: ol }, { step, slope: dl }, 45, 30);
check(ap && Math.abs(ap.slope + 3) < 0.2 && ap.r < -0.9, `across-planet slope recovered (${ap && ap.slope.toFixed(2)})`);

// 6) real data: Svalbard snow vs air temperature and rain+snowfall (NASA POWER fixture)
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "power_svalbard.json"), "utf8"));
const keys = Object.keys(fx.T2M).filter((k) => +k.slice(4) <= 12).sort();
const series = (code) => ({ dates: keys.map((k) => ({ year: +k.slice(0, 4), month: +k.slice(4) })), values: keys.map((k) => (fx[code][k] === -999 ? null : fx[code][k])) });
const sv = decompose(series("SNODP"), [{ code: "T2M", series: series("T2M") }, { code: "PRECTOTCORR", series: series("PRECTOTCORR") }], { seasonal: true, reps: 200 });
const t = sv.drivers[0];
console.log(`  Svalbard snow ${sv.observed.trend.toFixed(2)} cm/decade: temperature ${t.trend.toFixed(2)} (${t.low.toFixed(2)}..${t.high.toFixed(2)}), ` +
  `rain+snow ${sv.drivers[1].trend.toFixed(2)}, left ${sv.left.trend.toFixed(2)} (${sv.left.result.verdict}); Jun-Aug link ${t.links[2].value.toFixed(1)} cm/°C, Dec-Feb ${t.links[0].value.toFixed(1)}; alibi p ${t.alibi.p.toFixed(3)}`);
check(t.links[2].value < 0, "Svalbard: warm summers go with less snow");

console.log(`decompose tests: ${failures} failures`);
process.exit(failures ? 1 : 0);
