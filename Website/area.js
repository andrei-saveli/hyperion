// Area averages for countries and regions.
//
// A country is much bigger than one NASA grid square, so for a country or region we average the
// monthly records of many squares inside its outline. Rivers and mountain ranges are lines, not
// areas: for them we average along the line instead (the land and air along a river, not the
// river's water).
// - NASA POWER (asked live, one point per request): up to MAX_POINTS evenly spaced points.
// - Satellite and model grids (data/nasa/): every 1-degree square inside the outline (for very big
//   countries, the squares in the MAX_TILES tiles that cover most of it).
// Squares nearer the poles cover less ground, so each one counts in proportion to cos(latitude).
// The trend test then runs on the averaged record, exactly as for a single place.
//
// Kept separate from app.js so tests/test_area.js can check it with Node.
const ByteMeArea = (function () {
  const MAX_POINTS = 16;     // NASA POWER points per area
  const MAX_TILES = 24;      // 10 x 10 degree tiles of satellite data per area
  const MIN_SHARE = 0.5;     // a month needs data from at least half of the squares

  // GeoJSON Polygon or MultiPolygon -> list of polygons, each a list of rings [[lon, lat], ...]
  const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
  // GeoJSON LineString or MultiLineString -> list of lines [[lon, lat], ...]
  const linesOf = (g) => (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []);
  const isLine = (g) => linesOf(g).length > 0;

  // Is a point inside the shape? (ray casting; holes such as lakes count as outside)
  function inside(lon, lat, geometry) {
    for (const polygon of polygonsOf(geometry)) {
      let crossings = 0;
      for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) crossings++;
        }
      }
      if (crossings % 2 === 1) return true;
    }
    return false;
  }

  function bbox(geometry) {
    let w = 180, s = 90, e = -180, n = -90;
    [...polygonsOf(geometry).map((p) => p[0]), ...linesOf(geometry)].forEach((ring) => ring.forEach(([x, y]) => {
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    }));
    return [w, s, e, n];
  }

  // Points every `step` degrees along a line feature (all its parts)
  function alongLine(geometry, step) {
    const out = [];
    linesOf(geometry).forEach((line) => {
      let carry = 0;
      for (let i = 1; i < line.length; i++) {
        const [x0, y0] = line[i - 1], [x1, y1] = line[i];
        const length = Math.hypot(x1 - x0, y1 - y0);
        for (let d = carry; d < length; d += step) out.push({ lon: x0 + ((x1 - x0) * d) / length, lat: y0 + ((y1 - y0) * d) / length });
        carry = length ? (step - ((length - carry) % step)) % step : carry;
      }
    });
    return out;
  }

  // Centres of a regular grid (spacing `step` degrees, aligned to whole degrees) that fall inside
  function gridInside(geometry, step) {
    const [w, s, e, n] = bbox(geometry), out = [];
    for (let lat = Math.floor(s / step) * step + step / 2; lat < n; lat += step) {
      for (let lon = Math.floor(w / step) * step + step / 2; lon < e; lon += step) {
        if (inside(lon, lat, geometry)) out.push({ lat, lon });
      }
    }
    return out;
  }

  // Up to MAX_POINTS evenly spaced points inside the shape: try a fine grid, make it coarser
  // until few enough points remain. A tiny shape gets the middle of its bounding box.
  function samplePoints(geometry) {
    if (isLine(geometry)) {                       // a river: evenly spaced along its course
      const fine = alongLine(geometry, 0.1);
      if (!fine.length) return [];
      const count = Math.min(MAX_POINTS, fine.length);
      return Array.from({ length: count }, (_, i) => fine[Math.round(((i + 0.5) * (fine.length - 1)) / count)]);
    }
    const [w, s, e, n] = bbox(geometry);
    let step = 0.5, points = gridInside(geometry, step);
    while (points.length > MAX_POINTS) { step *= 1.4; points = gridInside(geometry, step); }
    if (!points.length) points = [{ lat: (s + n) / 2, lon: (w + e) / 2 }];
    return points;
  }

  // 1-degree squares inside the shape, grouped by 10-degree tile. Very big shapes keep the
  // MAX_TILES tiles that hold most of their squares; `sampled` says when that happened.
  function squaresInside(geometry, tileSize = 10) {
    let squares = isLine(geometry)                // a river: the 1-degree squares it passes through
      ? [...new Map(alongLine(geometry, 0.1).map((p) => {
          const q = { lat: Math.floor(p.lat) + 0.5, lon: Math.floor(p.lon) + 0.5 };
          return [`${q.lat},${q.lon}`, q];
        })).values()]
      : gridInside(geometry, 1);
    if (!squares.length) {
      const [w, s, e, n] = bbox(geometry);
      squares = [{ lat: Math.floor((s + n) / 2) + 0.5, lon: Math.floor((w + e) / 2) + 0.5 }];
    }
    const tileOf = (q) => `${Math.floor((q.lat + 90) / tileSize)}_${Math.floor((q.lon + 180) / tileSize)}`;
    const byTile = new Map();
    squares.forEach((q) => { const k = tileOf(q); if (!byTile.has(k)) byTile.set(k, []); byTile.get(k).push(q); });
    if (byTile.size <= MAX_TILES) return { squares, total: squares.length, sampled: false };
    const kept = [...byTile.values()].sort((a, b) => b.length - a.length).slice(0, MAX_TILES).flat();
    return { squares: kept, total: squares.length, sampled: true };
  }

  // Average several monthly records ({dates, values}) into one, each weighted by cos(latitude).
  // members: [{ series, lat }]. Returns { dates, values } or null.
  function average(members) {
    const present = members.filter((m) => m.series);
    if (!present.length) return null;
    const key = (d) => d.year * 12 + d.month - 1;
    const months = new Map();   // month number -> [weighted sum, weight, count]
    present.forEach(({ series, lat }) => {
      const weight = Math.cos((lat * Math.PI) / 180);
      series.dates.forEach((d, i) => {
        const v = series.values[i];
        if (v === null || v === undefined) return;
        const m = months.get(key(d)) || [0, 0, 0];
        m[0] += v * weight; m[1] += weight; m[2] += 1;
        months.set(key(d), m);
      });
    });
    if (!months.size) return null;
    const first = Math.min(...months.keys()), last = Math.max(...months.keys());
    const dates = [], values = [];
    for (let k = first; k <= last; k++) {
      const m = months.get(k);
      dates.push({ year: Math.floor(k / 12), month: (k % 12) + 1 });
      values.push(m && m[2] >= MIN_SHARE * present.length ? m[0] / m[1] : null);
    }
    return { dates, values };
  }

  return { inside, bbox, isLine, samplePoints, squaresInside, average, MAX_POINTS, MAX_TILES };
})();

if (typeof module !== "undefined") module.exports = ByteMeArea;
