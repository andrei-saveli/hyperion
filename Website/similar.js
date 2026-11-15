// "Places changing like this one": find the parts of the planet whose trends look most like the
// chosen place's trends (nearest-neighbour search, a simple kind of unsupervised machine learning).
//
// Every 5-degree square of the world overview (data/world.json) has a trend for each of the 18 NASA
// POWER measurements. That list of trends is the square's "fingerprint". To compare fingerprints:
// 1. Each trend is compared with the whole planet: (trend - planet average) / planet spread. So
//    "+2" means "changing much faster upwards than most of the planet". Values are capped at ±3 so
//    one extreme measurement can't decide everything.
// 2. Measurements that say nearly the same thing (four temperatures, three humidities, two soil
//    wetness layers) share one vote, so temperature doesn't count four times.
// 3. Similarity = weighted cosine of the two fingerprints: +1 = the same pattern of change,
//    0 = unrelated, -1 = the opposite pattern.
// Land is compared with land and sea with sea. Squares close to the place (they share its weather)
// are skipped, and the matches are kept far apart from each other, so they show different regions.
// This finds places that changed in a similar way. It says nothing about why.
//
// Kept separate from app.js so tests/test_similar.js can check it with Node.
const ByteMeSimilar = (function () {
  // The 18 measurements that exist everywhere (or on all land) make up the fingerprint. The ones
  // that only exist in some kinds of places (sea ice, snowfall, frost days...) are left out.
  const FINGERPRINT = ["T2M", "T2M_MAX", "T2M_MIN", "TS", "PRECTOTCORR", "EVLAND", "RH2M", "QV2M", "PW", "GWETTOP", "GWETROOT",
                       "SNODP", "WS10M", "PS", "TO3", "AOD_55", "ALLSKY_SFC_SW_DWN", "CLOUD_AMT"];
  const GROUPS = [["T2M", "T2M_MAX", "T2M_MIN", "TS"], ["RH2M", "QV2M", "PW"], ["GWETTOP", "GWETROOT"]];
  const LAND_ONLY = "EVLAND";      // only land squares have evaporation, root-zone soil and snow
  const CAP = 3;
  const MIN_SHARED = 10;           // measurements both fingerprints need before we compare them

  // Each measurement's vote: 1, or shared equally inside its group
  function weightOf(code) {
    const group = GROUPS.find((g) => g.includes(code));
    return group ? 1 / group.length : 1;
  }
  const groupOf = (code) => GROUPS.findIndex((g) => g.includes(code));

  // Distance along the Earth's surface, in km
  function km(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Planet average and spread of each measurement's trend, over the squares that have one
  function planetStats(world) {
    const out = {};
    FINGERPRINT.filter((code) => world.slope[code]).forEach((code) => {
      const values = world.slope[code].filter((s, i) => s !== null && world.verdict[code][i] > 0);
      if (values.length < 10) return;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      if (sd > 0) out[code] = { mean, sd };
    });
    return out;
  }

  // Trends -> fingerprint. slopes: {code: slope per decade or null}, verdicts: {code: 0..3}
  // (0 not enough data, 1 no clear trend, 2 possible, 3 significant)
  function fingerprint(slopes, verdicts, stats) {
    const z = {};
    Object.keys(stats).forEach((code) => {
      const s = slopes[code];
      if (s === null || s === undefined || !Number.isFinite(s) || !(verdicts[code] > 0)) return;
      z[code] = Math.max(-CAP, Math.min(CAP, (s - stats[code].mean) / stats[code].sd));
    });
    return z;
  }

  // Weighted cosine similarity over the measurements both fingerprints have; null if too few
  function similarity(a, b) {
    let ab = 0, aa = 0, bb = 0, shared = 0;
    Object.keys(a).forEach((code) => {
      if (b[code] === undefined) return;
      const w = weightOf(code);
      ab += w * a[code] * b[code]; aa += w * a[code] ** 2; bb += w * b[code] ** 2; shared++;
    });
    if (shared < MIN_SHARED || !aa || !bb) return null;
    return ab / Math.sqrt(aa * bb);
  }

  // One world square: its centre and its trends
  function square(world, i) {
    const slopes = {}, verdicts = {};
    FINGERPRINT.filter((code) => world.slope[code]).forEach((code) => { slopes[code] = world.slope[code][i]; verdicts[code] = world.verdict[code][i]; });
    const [lat, lon] = world.points[i];
    return { lat, lon, slopes, verdicts };
  }

  // The measurements a match shares most clearly with the place: significant at both, same
  // direction, strongest first, at most one per group.
  function sharedTrends(query, match, stats, count = 3) {
    const out = [], usedGroups = new Set();
    Object.keys(stats)
      .filter((code) => query.verdicts[code] === 3 && match.verdicts[code] === 3 && query.slopes[code] && match.slopes[code] &&
                        Math.sign(query.slopes[code]) === Math.sign(match.slopes[code]))
      .map((code) => ({ code, sign: Math.sign(query.slopes[code]),
                        strength: Math.min(Math.abs(query.slopes[code]), Math.abs(match.slopes[code])) / stats[code].sd }))
      .sort((x, y) => y.strength - x.strength)
      .forEach((t) => {
        const g = groupOf(t.code);
        if (out.length >= count || (g >= 0 && usedGroups.has(g))) return;
        if (g >= 0) usedGroups.add(g);
        out.push({ code: t.code, sign: t.sign });
      });
    return out;
  }

  // The search. query: {lat, lon, slopes, verdicts}. Returns
  // { matches: [{index, lat, lon, score, km, shares}], typical (median similarity of all the squares
  //   compared), compared (how many) } or null when the place has too few trends.
  // skip(lat, lon): optional, true for squares to leave out (e.g. inside the chosen country)
  function findSimilar(world, query, { count = 5, near = 1500, apart = 1500, skip = null } = {}) {
    const stats = planetStats(world);
    const q = fingerprint(query.slopes, query.verdicts, stats);
    if (Object.keys(q).length < MIN_SHARED) return null;
    const isLand = q[LAND_ONLY] !== undefined;
    const scored = [];
    world.points.forEach((_, i) => {
      const sq = square(world, i);
      const f = fingerprint(sq.slopes, sq.verdicts, stats);
      if ((f[LAND_ONLY] !== undefined) !== isLand) return;            // land with land, sea with sea
      const distance = km(query.lat, query.lon, sq.lat, sq.lon);
      if (distance < near || (skip && skip(sq.lat, sq.lon))) return;  // too close: same weather
      const score = similarity(q, f);
      if (score !== null) scored.push({ index: i, lat: sq.lat, lon: sq.lon, score, km: distance, square: sq });
    });
    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    const sortedScores = scored.map((s) => s.score).sort((a, b) => a - b);
    const typical = sortedScores[Math.floor(sortedScores.length / 2)];
    const matches = [];
    for (const s of scored) {
      if (matches.length >= count) break;
      if (matches.some((m) => km(m.lat, m.lon, s.lat, s.lon) < apart)) continue;   // a different region each time
      matches.push({ index: s.index, lat: s.lat, lon: s.lon, score: s.score, km: s.km,
                     shares: sharedTrends({ slopes: query.slopes, verdicts: query.verdicts }, s.square, stats) });
    }
    return { matches, typical, compared: scored.length };
  }

  return { findSimilar, fingerprint, similarity, planetStats, square, sharedTrends, km, weightOf };
})();

if (typeof module !== "undefined") module.exports = ByteMeSimilar;
