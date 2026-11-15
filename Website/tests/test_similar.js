// Checks "Places changing like this one" (similar.js). Run:  node Website/tests/test_similar.js
const fs = require("fs");
const path = require("path");
const S = require("../similar.js");
let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL " + what); } };
const world = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "world.json"), "utf8"));
const stats = S.planetStats(world);
const indexOf = (lat, lon) => world.points.findIndex(([a, b]) => Math.abs(a - lat) < 1e-9 && Math.abs(b - lon) < 1e-9);

// 1) similarity basics: a fingerprint matches itself (+1) and its mirror image (-1); weights share a vote
const sq = S.square(world, indexOf(47.5, 2.5));          // France
const f = S.fingerprint(sq.slopes, sq.verdicts, stats);
const mirror = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, -v]));
check(Math.abs(S.similarity(f, f) - 1) < 1e-12, "a fingerprint is identical to itself");
check(Math.abs(S.similarity(f, mirror) + 1) < 1e-12, "the opposite fingerprint scores -1");
check(Math.abs(S.weightOf("T2M") * 4 - 1) < 1e-12 && S.weightOf("PS") === 1, "the four temperatures share one vote");
check(S.similarity({ T2M: 1, PS: 1 }, { T2M: 1, PS: 1 }) === null, "too few shared measurements -> no score");
check(Object.values(f).every((z) => z >= -3 && z <= 3), "fingerprint values are capped at ±3");

// 2) distances
check(Math.abs(S.km(0, 0, 0, 1) - 111.19) < 0.1, "1 degree at the equator is about 111 km");
check(Math.abs(S.km(10, 179.5, 10, -179.5) - S.km(10, 0, 10, 1)) < 1e-6, "distance wraps across the date line");

// 3) the search on real squares: rules hold for many places
const places = [[47.5, 2.5], [-2.5, -62.5], [77.5, 17.5], [22.5, 12.5], [42.5, -32.5], [-32.5, 147.5], [62.5, 102.5]];
places.forEach(([lat, lon]) => {
  const i = indexOf(lat, lon), q = S.square(world, i);
  const res = S.findSimilar(world, q);
  const isLand = q.slopes.EVLAND !== null;
  check(res && res.matches.length === 5, `${lat},${lon}: five matches`);
  if (!res) return;
  const m = res.matches;
  check(m.every((x, k) => k === 0 || x.score <= m[k - 1].score + 1e-12), `${lat},${lon}: best match first`);
  check(m.every((x) => x.km >= 1500), `${lat},${lon}: no match within 1500 km of the place`);
  check(m.every((x, k) => m.slice(0, k).every((y) => S.km(x.lat, x.lon, y.lat, y.lon) >= 1500)), `${lat},${lon}: matches are far apart from each other`);
  check(m.every((x) => (world.slope.EVLAND[x.index] !== null) === isLand), `${lat},${lon}: land matches land, sea matches sea`);
  check(m.every((x) => x.score >= -1 - 1e-12 && x.score <= 1 + 1e-12), `${lat},${lon}: scores between -1 and 1`);
  check(m[0].score > res.typical, `${lat},${lon}: the best match beats a typical square`);
  check(m.every((x) => x.shares.every((t) => world.verdict[t.code][x.index] === 3 && q.verdicts[t.code] === 3 &&
    Math.sign(world.slope[t.code][x.index]) === t.sign && Math.sign(q.slopes[t.code]) === t.sign)), `${lat},${lon}: shared trends are significant at both, same direction`);
  check(m.every((x) => x.shares.filter((t) => ["T2M", "T2M_MAX", "T2M_MIN", "TS"].includes(t.code)).length <= 1), `${lat},${lon}: at most one temperature in the shared list`);
  console.log(`  ${lat},${lon}: best ${m.map((x) => `${x.lat},${x.lon} (${x.score.toFixed(2)})`).join(" · ")} · typical ${res.typical.toFixed(2)} of ${res.compared}`);
});

// 4) without the distance rule, a square finds itself first
const self = S.findSimilar(world, S.square(world, indexOf(47.5, 2.5)), { near: 0 });
check(self.matches[0].index === indexOf(47.5, 2.5) && Math.abs(self.matches[0].score - 1) < 1e-12, "with no distance rule a square's best match is itself");

// 4b) squares the caller skips (e.g. inside the chosen country) never come back
const skipBox = (lat, lon) => lat > 30 && lat < 60 && lon > -20 && lon < 60;
const skipped = S.findSimilar(world, S.square(world, indexOf(47.5, 2.5)), { skip: skipBox, count: 10 });
check(skipped.matches.every((x) => !skipBox(x.lat, x.lon)), "skipped squares are never matches");

// 5) a place with too few trends gets no answer
check(S.findSimilar(world, { lat: 0, lon: 0, slopes: { T2M: 0.3 }, verdicts: { T2M: 3 } }) === null, "too few trends -> no answer");

// 6) the same place from slightly different data (as a live NASA POWER point differs from the
//    5-degree overview) keeps most of its best matches
const base = S.square(world, indexOf(47.5, 2.5));
let seed = 7;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const noisy = { ...base, slopes: Object.fromEntries(Object.entries(base.slopes).map(([k, s]) => [k, s === null ? null : s + 0.1 * stats[k].sd * (rand() - 0.5)])) };
const a = S.findSimilar(world, base).matches.map((x) => x.index), b = S.findSimilar(world, noisy, { count: 10 }).matches.map((x) => x.index);
check(a.filter((x) => b.includes(x)).length >= 3, `small changes keep most matches (${a.filter((x) => b.includes(x)).length} of 5 kept)`);

console.log(`similar tests: ${failures} failures`);
process.exit(failures ? 1 : 0);
