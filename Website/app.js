// ByteMe website: pick ANY place on Earth, read its NASA record live, and test every
// measurement for a trend.
//
// Where things come from
// - Monthly data: NASA POWER (no login), asked for live for the place the visitor picks.
// - Trend math: stats.js, a tested copy of the project's Python code (Task4/stats.py).
// - Measurements and their plain-language definitions: data/variables.json.
// - World overview squares: data/world.json, built once by build_world.py with the Python code.
// - Place names: Open-Meteo geocoding (search) and BigDataCloud (name of a clicked point).

const COLOURS = { up: "#ec7a6a", down: "#2d8bb5", neutral: "#b2bcb8", ink: "#141a19", deep: "#0e5e63" };
const START_YEAR = 1981;
const END_YEAR = new Date().getFullYear() - 1;          // last complete year
const POWER = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
const GEOCODER_2 = "https://photon.komoot.io/api/";
const NOMINATIM = "https://nominatim.openstreetmap.org";   // outlines of countries and regions
const REVERSE = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const REVERSE_2 = "https://nominatim.openstreetmap.org/reverse";
const CELL = { lat: 0.5, lon: 0.625 };                  // size of one MERRA-2 grid square

// Demo cases, chosen from real results (see README). Also lit up on the hero globe.
const CASES = [
  { q: "Is the Arctic warming?", name: "Svalbard (Arctic)", lat: 78.25, lon: 15.625, code: "T2M" },
  { q: "Is the air over Beijing getting cleaner?", name: "Beijing (China)", lat: 40.0, lon: 116.25, code: "AOD_55" },
  { q: "Is the Amazon getting less rain?", name: "Manaus, Amazon (Brazil)", lat: -3.0, lon: -60.0, code: "PRECTOTCORR" },
  { q: "Not significant… yet?", name: "Lake Mead (USA)", lat: 36.0, lon: -114.375, code: "GWETTOP" },
];
window.BYTEME_CASES = CASES;

let VARS = [], POWER_VARS = [], NASA = null, NOT_AVAILABLE = [], WORLD = null, LAND = null, map = null, marker = null;
const state = { lat: null, lon: null, name: "", code: "T2M", raw: false, loading: false, error: null, place: null, layer: true };
const compare = { code: "AOD_55", a: { name: "Beijing (China)", lat: 40.0, lon: 116.25 }, b: { name: "Delhi (India)", lat: 28.5, lon: 77.5 } };
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ small helpers
function num(v, signed = true) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toString() : Number(v.toPrecision(2)).toString();
  return (signed && v > 0 ? "+" + rounded : rounded).replace("-", "−");
}
const pText = (p) => (p === null || p === undefined ? "–" : p < 0.001 ? "< 0.001" : p.toFixed(3));
const variable = (code) => VARS.find((v) => v.code === code);
const escapeHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const coordText = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
const hasTrend = (r) => r && (r.verdict === "significant" || r.verdict === "possible");

function colourOf(r) {
  if (!hasTrend(r)) return COLOURS.neutral;
  return r.direction === "decrease" ? COLOURS.down : COLOURS.up;
}
function verdictText(r) {
  if (!r) return "No data here";
  const dir = r.direction === "decrease" ? "decrease" : "increase";
  return { significant: `Significant ${dir}`, possible: `Possible ${dir} · not significant yet`,
           none: "No clear trend yet", insufficient: "Not enough data" }[r.verdict];
}
function dotHTML(r) {
  const style = hasTrend(r) ? `background:${colourOf(r)};opacity:${r.verdict === "possible" ? 0.5 : 1}`
                            : `background:repeating-linear-gradient(45deg,${COLOURS.neutral} 0 2px,#fff 2px 5px)`;
  return `<span class="dot" style="${style}"></span>`;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ NASA data for one place
// The centre of the NASA grid square that contains a point (so nearby clicks share one download)
function snap(lat, lon) {
  lat = Math.max(-90, Math.min(90, Math.round(lat / CELL.lat) * CELL.lat));
  lon = Math.round(lon / CELL.lon) * CELL.lon;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon };
}

const placeCache = new Map();   // "lat,lon" -> promise of { series, results }

// NASA POWER records for one grid square: { code: {dates, values} }. Shared by single places
// and area averages, so a square is only downloaded once.
const powerCache = new Map();
function powerSeries(lat, lon) {
  const key = `${lat},${lon}`;
  if (!powerCache.has(key)) {
    const job = downloadPower(lat, lon, END_YEAR)
      .catch(() => downloadPower(lat, lon, END_YEAR - 1))   // early in a year, last year may not be ready yet
      .then((raw) => Object.fromEntries(POWER_VARS.map((v) => [v.code, toSeries(raw[v.code], v.scale || 1)])));
    job.catch(() => powerCache.delete(key));
    powerCache.set(key, job);
  }
  return powerCache.get(key);
}

// Run the trend analysis on every measurement's record
function analyzeAll(series) {
  const results = {};
  VARS.forEach((v) => {
    results[v.code] = series[v.code] ? ByteMeStats.analyze(series[v.code].dates, series[v.code].values, v.percent) : null;
  });
  return results;
}

// Download every measurement for one grid square and run the trend analysis on each.
// Two sources: NASA POWER (asked live) and the NASA satellite/model grids we prepared (data/nasa/).
function loadPlace(lat, lon) {
  const key = `${lat},${lon}`;
  if (!placeCache.has(key)) {
    const grids = loadNasaCell(lat, lon).catch(() => ({}));   // optional: the site works without them
    const job = Promise.all([powerSeries(lat, lon), grids]).then(([power, nasa]) => {
        const series = {};
        VARS.forEach((v) => { series[v.code] = (v.dataset === "nasa" ? nasa[v.code] : power[v.code]) || null; });
        return { series, results: analyzeAll(series) };
      });
    job.catch(() => placeCache.delete(key));   // a failed download can be tried again
    placeCache.set(key, job);
  }
  return placeCache.get(key);
}

async function downloadPower(lat, lon, endYear) {
  const url = `${POWER}?parameters=${POWER_VARS.map((v) => v.code).join(",")}&community=AG` +
    `&longitude=${lon}&latitude=${lat}&start=${START_YEAR}&end=${endYear}&format=JSON`;
  const reply = await fetch(url);
  if (!reply.ok) throw new Error(`NASA POWER answered ${reply.status}`);
  return (await reply.json()).properties.parameter;
}

// POWER's {"198101": 1.2, ..., "198113": yearly mean} -> { dates, values } (null = missing month).
// Missing months before the first and after the last real value are dropped.
function toSeries(monthly, scale) {
  if (!monthly) return null;
  const keys = Object.keys(monthly).filter((k) => +k.slice(4) <= 12).sort();   // "month 13" is the yearly mean
  let values = keys.map((k) => (monthly[k] === -999 ? null : monthly[k] * scale));
  const first = values.findIndex((v) => v !== null);
  if (first < 0) return null;   // nothing measured here (e.g. soil wetness over the ocean)
  let last = values.length - 1;
  while (values[last] === null) last--;
  values = values.slice(first, last + 1);
  const dates = keys.slice(first, last + 1).map((k) => ({ year: +k.slice(0, 4), month: +k.slice(4) }));
  return { dates, values };
}

// ------------------------------------------------------------------ NASA satellite and model grids
// data/nasa/index.json says which measurements exist; each 10 x 10 degree tile file holds the
// monthly series of its 100 one-degree squares as 16-bit whole numbers (see build_nasa_tiles.py).
const tileCache = new Map();
function nasaTile(code, name) {
  const url = `data/nasa/${code}/${name}.bin`;
  if (!tileCache.has(url)) tileCache.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  return tileCache.get(url);
}
async function loadNasaCell(lat, lon) {
  if (!NASA) return {};
  const { tile, square } = ByteMeNasa.locate(lat, lon, NASA.tile);
  const out = {};
  await Promise.all(Object.entries(NASA.variables).map(async ([code, info]) => {
    if (!info.tiles.includes(tile)) return;     // no data anywhere in this tile (e.g. land data over the ocean)
    const buffer = await nasaTile(code, tile);
    const series = buffer && ByteMeNasa.decode(buffer, square, info, NASA.missing);
    if (series) out[code] = series;
  }));
  return out;
}

// ------------------------------------------------------------------ area averages (countries and regions)
// The outline comes from OpenStreetMap (Nominatim). area.js picks the squares inside it and averages them.
const shapeCache = new Map();
function shapeFor(hit) {
  const key = hit.box ? `region:${hit.regionKey}` : hit.osm ? hit.osm : `country:${hit.name.split(",")[0]}`;
  if (!shapeCache.has(key)) {
    let job;
    if (hit.box) {
      const [w, s, e, n] = hit.box;
      job = Promise.resolve({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
    } else {
      const url = hit.osm
        ? `${NOMINATIM}/lookup?osm_ids=${hit.osm}&format=geojson&polygon_geojson=1&polygon_threshold=0.02`
        : `${NOMINATIM}/search?q=${encodeURIComponent(hit.name.split(",")[0])}&featureType=country&limit=1&format=geojson&polygon_geojson=1&polygon_threshold=0.02`;
      job = fetch(url).then((r) => r.json()).then((j) => {
        const g = j.features && j.features[0] && j.features[0].geometry;
        return g && (g.type === "Polygon" || g.type === "MultiPolygon") ? g : null;
      }).catch(() => null);
    }
    shapeCache.set(key, job.then((geometry) => (geometry ? { key, geometry, name: hit.name || hit.label } : null)));
  }
  return shapeCache.get(key);
}

// Run `task` on every item, at most `limit` at a time (to be gentle with NASA's servers)
async function inBatches(items, limit, task) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await task(items[i]).catch(() => null); }
  }));
  return out;
}

// Average every measurement over an area and run the trend analysis on the averages
function loadArea(area) {
  const key = `area:${area.key}`;
  if (!placeCache.has(key)) {
    const job = (async () => {
      // NASA POWER: evenly spaced points (snapped to their grid squares, without repeats)
      const points = [...new Map(ByteMeArea.samplePoints(area.geometry).map((p) => {
        const c = snap(p.lat, p.lon); return [`${c.lat},${c.lon}`, c];
      })).values()];
      const power = await inBatches(points, 4, (p) => powerSeries(p.lat, p.lon));
      const okPoints = points.map((p, i) => ({ ...p, data: power[i] })).filter((p) => p.data);
      if (okPoints.length < Math.max(1, points.length / 2)) throw new Error("NASA POWER did not answer");
      // satellite and model grids: the 1-degree squares inside the outline
      const squares = NASA ? ByteMeArea.squaresInside(area.geometry, NASA.tile) : { squares: [], total: 0, sampled: false };
      const series = {};
      for (const v of VARS) {
        if (v.dataset !== "nasa") {
          series[v.code] = ByteMeArea.average(okPoints.map((p) => ({ series: p.data[v.code], lat: p.lat })));
          continue;
        }
        const info = NASA.variables[v.code];
        const members = await Promise.all(squares.squares.map(async (q) => {
          const { tile, square } = ByteMeNasa.locate(q.lat, q.lon, NASA.tile);
          if (!info.tiles.includes(tile)) return null;
          const buffer = await nasaTile(v.code, tile);
          return { series: buffer && ByteMeNasa.decode(buffer, square, info, NASA.missing), lat: q.lat };
        }));
        series[v.code] = ByteMeArea.average(members.filter(Boolean));
      }
      return { series, results: analyzeAll(series),
               info: { points: okPoints.length, squares: squares.squares.length, total: squares.total, sampled: squares.sampled } };
    })();
    job.catch(() => placeCache.delete(key));
    placeCache.set(key, job);
  }
  return placeCache.get(key);
}

// A sentence describing what an area average is made of
function areaText(area, info) {
  return `Average over ${escapeHTML(area.name)}: ${info.points} evenly spaced NASA POWER point${info.points === 1 ? "" : "s"}` +
    (info.squares ? ` and ${info.squares}${info.sampled ? ` of its ${info.total}` : ""} one-degree squares of satellite and model data` : "") + ".";
}

// ------------------------------------------------------------------ second source
// Several measurements exist twice: from NASA POWER (MERRA-2) and from an independent satellite
// or model (GPM, AIRS, MODIS, GLDAS). We test both over the years they share, so they can be compared fairly.
function partnerOf(v) {
  return v.pair ? variable(v.pair) : VARS.find((x) => x.pair === v.code) || null;
}
function sharedYears(a, b) {
  const key = (d) => d.year * 12 + d.month;
  const start = Math.max(key(a.dates[0]), key(b.dates[0])), end = Math.min(key(a.dates.at(-1)), key(b.dates.at(-1)));
  const cut = (s) => {
    const keep = s.dates.map((d, i) => (key(d) >= start && key(d) <= end ? i : -1)).filter((i) => i >= 0);
    return { dates: keep.map((i) => s.dates[i]), values: keep.map((i) => s.values[i]) };
  };
  return [cut(a), cut(b)];
}
function secondOpinion(place, v) {
  const other = partnerOf(v);
  if (!other || !place.series[v.code] || !place.series[other.code]) return null;
  const [a, b] = sharedYears(place.series[v.code], place.series[other.code]);
  if (a.dates.length < 24) return null;
  const ra = ByteMeStats.analyze(a.dates, a.values, v.percent), rb = ByteMeStats.analyze(b.dates, b.values, other.percent);
  if (ra.verdict === "insufficient" || rb.verdict === "insufficient") return null;
  const sig = (r) => r.verdict === "significant";
  let agreement;
  if (sig(ra) && sig(rb)) agreement = ra.direction === rb.direction ? "agree" : "disagree";
  else if (sig(ra) || sig(rb)) agreement = "partly";
  else agreement = "neither";
  return { other, ra, rb, agreement, years: `${a.dates[0].year}–${a.dates.at(-1).year}` };
}
const AGREEMENT_TEXT = {
  agree: "Both sources agree: the change is confirmed by an independent measurement.",
  disagree: "The two sources point in opposite directions, so treat this result with caution.",
  partly: "Only one of the two sources finds a significant trend over these years, so treat it with some caution.",
  neither: "Neither source finds a significant trend over these years.",
};

// ------------------------------------------------------------------ plain-language explanation
// (same wording rules as Task3/explain.py: say what changed and how sure we are, never why)
function explain(r, v, placeName) {
  const caveat = "A straight line simplifies a record that can rise and fall over time. " +
    "Identifying the cause requires a separate investigation.";
  const subject = `${v.name} in ${placeName}`;
  if (!r) return { headline: `${subject} · No data here`, details: "NASA has no values for this measurement at this place (some are measured over land only).", caveat };
  if (r.verdict === "insufficient") return { headline: `${subject} · Not enough usable data`, details: "This record has too little usable data to estimate a trend.", caveat };
  const label = r.verdict === "none" ? "No clear trend" : `${r.verdict === "significant" ? "Significant" : "Possible"} ${r.direction}`;
  const rate = `${num(r.slope_per_decade)} ${v.units} per decade`;
  const d = [`After removing seasonal swings, the straight line estimates ${rate} over ${r.start.slice(0, 4)}–${r.end.slice(0, 4)}.`];
  d.push(`The line's estimated change from start to finish is ${num(r.total_change)} ${v.units}` +
    (r.percent_change !== null ? ` (${num(r.percent_change)}% of the record average).` : "."));
  d.push(`The shaded 95% band shows uncertainty around the line. The 95% range for its rate is ${num(r.ci_low)} to ${num(r.ci_high)} ${v.units} per decade.`);
  if (r.ci_low <= 0 && r.ci_high >= 0) d.push("That range includes zero, so this record leaves the direction uncertain.");
  d.push(`The p-value is ${r.p_value < 0.001 ? "below 0.001" : r.p_value.toFixed(3)}. If the underlying rate were zero, the p-value tells us ` +
    "how often the test would see evidence at least this strong just by chance.");
  if (r.verdict === "none") d.push("No clear trend does not mean nothing changed: the record may be too short or too noisy to tell.");
  return { headline: `${subject} · ${label} (${rate})`, details: d.join(" "), caveat };
}

// ------------------------------------------------------------------ start
Promise.all([
  fetch("data/variables.json").then((r) => r.json()),
  fetch("data/land.geojson").then((r) => r.json()),
  fetch("data/world.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),   // optional overview
  fetch(MAP_STYLE).then((r) => (r.ok ? r.json() : null)).catch(() => null),             // optional detailed map
  fetch("data/nasa/index.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),  // optional satellite grids
]).then(([catalogue, land, world, mapStyle, nasa]) => {
  NASA = nasa;
  // measurements from the satellite grids are only offered when those grids are present
  catalogue.variables = catalogue.variables.filter((v) => v.dataset !== "nasa" || (nasa && nasa.variables[v.code]));
  POWER_VARS = catalogue.variables.filter((v) => v.dataset !== "nasa");
  VARS = catalogue.variables; NOT_AVAILABLE = catalogue.not_available || []; LAND = land; WORLD = world;
  if (world) $("built").textContent = `World overview built ${world.built}`;
  buildVariableSelect(catalogue.groups);
  buildCases();
  buildMap(mapStyle);
  buildSearch();
  buildCompare(catalogue.groups);
  const fromLink = readHash();
  const first = fromLink || CASES[0];
  if (fromLink) state.code = fromLink.code;
  if (fromLink && fromLink.hit) goTo(fromLink.hit, fromLink.code);   // a shared link to a country or region
  else selectPlace(first.lat, first.lon, first.name, first.code, true);
});

// Shareable links look like  #44.5,26.25,T2M,Bucharest
function readHash() {
  const text = decodeURIComponent(location.hash.slice(1));
  if (text.startsWith("area=")) {               // e.g. #area=R90689,T2M,Romania  or  #area=region:sahel,PRECTOTCORR,Sahel
    const [key, code, ...name] = text.slice(5).split(",");
    if (!variable(code)) return null;
    const region = key.startsWith("region:") && REGIONS.find((r) => r[0] === key.slice(7));
    const hit = region ? regionHit(region) : key.startsWith("country:") ? { name: key.slice(8), kind: "large" } : { osm: key, name: name.join(","), kind: "large" };
    hit.name = hit.name || name.join(",");
    return { hit, code, name: hit.name };
  }
  const [lat, lon, code, ...name] = text.split(",");
  if (!Number.isFinite(parseFloat(lat)) || !Number.isFinite(parseFloat(lon)) || !variable(code)) return null;
  return { lat: +lat, lon: +lon, code, name: name.join(",") };
}
function writeHash() {
  const link = state.area ? `#area=${state.area.key},${state.code},${encodeURIComponent(state.name)}`
                          : `#${state.lat},${state.lon},${state.code},${encodeURIComponent(state.name)}`;
  try { history.replaceState(null, "", link); } catch (e) { /* fine without */ }
}

// ------------------------------------------------------------------ choosing a measurement
function optionsHTML(groups) {
  return groups.map((g) => `<optgroup label="${g}">` +
    VARS.filter((v) => v.group === g).map((v) => `<option value="${v.code}">${v.name}</option>`).join("") + "</optgroup>").join("");
}
function buildVariableSelect(groups) {
  $("var-select").innerHTML = optionsHTML(groups);
  $("var-select").addEventListener("change", (e) => selectVariable(e.target.value));
}
function selectVariable(code) {
  state.code = code;
  $("var-select").value = code;
  writeHash(); refreshWorldLayer(); renderScan(); renderDetail();
}

function buildCases() {
  $("cases").innerHTML = CASES.map((c, i) =>
    `<button class="case" data-case="${i}"><span>${c.q}<small>${c.name} · ${variable(c.code).name}</small></span><span class="arrow">→</span></button>`).join("");
  $("cases").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const c = CASES[+b.dataset.case];
    state.question = { text: c.q, code: c.code, intent: intentOf(c.q), season: null, kind: "place" };
    selectPlace(c.lat, c.lon, c.name, c.code, true);
    $("explore").scrollIntoView({ behavior: "smooth" });
  }));
}

// ------------------------------------------------------------------ choosing an area (country or region)
async function selectArea(area, code) {
  const [w, s, e, n] = ByteMeArea.bbox(area.geometry);
  const middle = { lat: (s + n) / 2, lon: (w + e) / 2 };
  const centre = ByteMeArea.inside(middle.lon, middle.lat, area.geometry) ? middle : ByteMeArea.samplePoints(area.geometry)[0];
  Object.assign(state, { area, lastArea: area, lat: centre.lat, lon: centre.lon, name: area.name, loading: true, error: null, place: null });
  if (code) { state.code = code; $("var-select").value = code; }
  writeHash(); refreshWorldLayer(); placeMarker(); showAreaOutline(); renderScan(); renderDetail(); renderAnswer();
  if (map) {
    if (e - w > 300) map.flyTo({ center: [centre.lon, centre.lat], zoom: 1.2, duration: 1200 });   // wraps round the globe
    else map.fitBounds([[w, s], [e, n]], { padding: 50, maxZoom: 6, duration: 1200 });
  }
  try {
    const place = await loadArea(area);
    if (state.area !== area) return;               // the visitor already moved on
    state.place = place;
  } catch (err) {
    if (state.area !== area) return;
    state.error = "We couldn't reach NASA's data service for enough points in this area.";
  }
  state.loading = false;
  renderScan(); renderDetail(); renderAnswer();
}

// The outline of the chosen area on the map (empty for a single place)
function showAreaOutline() {
  if (!map || !map.getSource("area")) return;
  map.getSource("area").setData(state.area ? { type: "Feature", geometry: state.area.geometry, properties: {} } : { type: "FeatureCollection", features: [] });
  placeBrackets();
}

// ------------------------------------------------------------------ choosing a place
async function selectPlace(lat, lon, name, code, fly) {
  const cell = snap(lat, lon);
  Object.assign(state, { area: null, lat: cell.lat, lon: cell.lon, name: name || coordText(cell.lat, cell.lon), loading: true, error: null, place: null });
  showAreaOutline();
  if (code) { state.code = code; $("var-select").value = code; }
  writeHash(); refreshWorldLayer(); placeMarker(); renderScan(); renderDetail(); renderAnswer();
  if (fly && map) map.flyTo({ center: [cell.lon, cell.lat], zoom: Math.max(map.getZoom(), 2.6), duration: 1200 });
  if (!name) nameOf(cell.lat, cell.lon).then((found) => {
    if (found && state.lat === cell.lat && state.lon === cell.lon) { state.name = found; writeHash(); renderScan(); renderDetail(); renderAnswer(); }
  });
  try {
    const place = await loadPlace(cell.lat, cell.lon);
    if (state.lat !== cell.lat || state.lon !== cell.lon) return;   // the visitor already moved on
    state.place = place;
  } catch (e) {
    if (state.lat !== cell.lat || state.lon !== cell.lon) return;
    state.error = "We couldn't reach NASA's data service just now.";
  }
  state.loading = false;
  renderScan(); renderDetail(); renderAnswer();
}

// A readable name for a clicked point ("Bucharest, Romania", "North Atlantic Ocean").
// Tries BigDataCloud first, then OpenStreetMap's Nominatim; if both fail the coordinates are shown.
async function nameOf(lat, lon) {
  try {
    const j = await (await fetch(`${REVERSE}?latitude=${lat}&longitude=${lon}&localityLanguage=en`)).json();
    const parts = [j.city || j.locality || j.principalSubdivision, j.countryName].filter(Boolean);
    if (parts.length) return [...new Set(parts)].join(", ");
  } catch (e) { /* try the second service */ }
  try {
    const j = await (await fetch(`${REVERSE_2}?lat=${lat}&lon=${lon}&zoom=8&format=jsonv2&accept-language=en`)).json();
    const a = j.address || {};
    const parts = [a.city || a.town || a.village || a.county || a.state || j.name, a.country].filter(Boolean);
    return [...new Set(parts)].join(", ") || null;
  } catch (e) { return null; }
}

// ------------------------------------------------------------------ map
// Our own minimal base map: a land outline shipped with the site (data/land.geojson). Used when
// the detailed map can't be loaded, so the map always works in a live demo.
function outlineStyle() {
  return {
    version: 8,
    sources: { land: { type: "geojson", data: LAND, attribution: "Natural Earth" } },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": "#d9f0ef" } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#fbfdfb" } },
      { id: "coast", type: "line", source: "land", paint: { "line-color": "#7fb9b1", "line-width": 0.7 } },
    ],
  };
}

function buildMap(detailedStyle) {
  // The detailed map (countries, cities, rivers) is OpenFreeMap's free "positron" style, with the
  // water recoloured to match the site.
  if (detailedStyle) detailedStyle.layers.forEach((l) => { if (l.id === "water") l.paint["fill-color"] = "#d3ecec"; });
  map = new maplibregl.Map({
    container: "map",
    style: detailedStyle || outlineStyle(),
    center: [10, 25], zoom: 1.1, minZoom: 0.5, maxZoom: 9,
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.getCanvas().style.cursor = "crosshair";
  map.on("load", () => {
    map.addSource("world", { type: "geojson", data: worldSquares(null) });
    map.addLayer({ id: "world-fill", type: "fill", source: "world",
      paint: { "fill-color": ["get", "colour"], "fill-opacity": ["get", "opacity"] } },
      (map.getStyle().layers.find((l) => l.type === "symbol") || {}).id);   // squares go under the place labels
    map.addSource("area", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": COLOURS.deep, "fill-opacity": 0.06 } });
    map.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": COLOURS.deep, "line-width": 2 } });
    placeMarker(); showAreaOutline();
  });
  map.on("click", (e) => { state.question = null; state.lastArea = null; selectPlace(e.lngLat.lat, e.lngLat.wrap().lng, null, null, false); });
  map.on("move", placeBrackets);
  map.on("mousemove", showTip);
  map.on("mouseout", () => ($("map-tip").style.display = "none"));
  $("world").addEventListener("click", () => map.flyTo({ center: [10, 25], zoom: 1.1, duration: 1200 }));
  $("layer").addEventListener("click", () => {
    state.layer = !state.layer;
    $("layer").classList.toggle("on", state.layer);
    refreshWorldLayer();
  });
}

// The world overview for one measurement: { step (degrees), start, end, slope[], verdict[] }, squares
// in order south to north, then west to east. NASA POWER measurements: data/world.json (5 degrees).
// Satellite and model measurements: data/nasa/<CODE>_map.json (2 degrees), loaded when first chosen.
const layerCache = new Map();
function layerFor(code) {
  const v = variable(code);
  if (v.dataset !== "nasa") {
    return Promise.resolve(WORLD && WORLD.slope[code]
      ? { step: WORLD.step, start: String(WORLD.start), end: String(WORLD.end), slope: WORLD.slope[code], verdict: WORLD.verdict[code] } : null);
  }
  if (!layerCache.has(code)) layerCache.set(code, fetch(`data/nasa/${code}_map.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return layerCache.get(code);
}

// One square per grid point, coloured by the trend of the chosen measurement.
// Stronger colour = faster change. Squares with no clear trend are left blank.
function worldSquares(layer) {
  const features = [];
  if (layer && state.layer) {
    const slopes = layer.slope, verdicts = layer.verdict, step = layer.step, h = step / 2, cols = Math.round(360 / step);
    const sizes = slopes.filter((s, i) => s !== null && verdicts[i] >= 2).map(Math.abs).sort((a, b) => a - b);
    const strong = sizes[Math.floor(sizes.length * 0.9)] || 1;   // a "fast" change for this measurement
    slopes.forEach((slope, i) => {
      const lat = -90 + h + Math.floor(i / cols) * step, lon = -180 + h + (i % cols) * step;
      if (verdicts[i] < 2 || !slopes[i]) return;
      const strength = Math.min(1, Math.abs(slopes[i]) / strong);
      features.push({
        type: "Feature",
        properties: { colour: slopes[i] > 0 ? COLOURS.up : COLOURS.down,
                      opacity: verdicts[i] === 3 ? 0.25 + 0.45 * strength : 0.14 },
        geometry: { type: "Polygon", coordinates: [[[lon - h, lat - h], [lon + h, lat - h], [lon + h, lat + h], [lon - h, lat + h], [lon - h, lat - h]]] },
      });
    });
  }
  return { type: "FeatureCollection", features };
}
async function refreshWorldLayer() {
  const code = state.code, v = variable(code);
  const layer = await layerFor(code);
  if (code !== state.code) return;                       // the visitor already chose another measurement
  state.layerData = layer;
  $("legend-title").textContent = layer ? `${v.name} · trend ${layer.start.slice(0, 4)}–${layer.end.slice(0, 4)}` : v.name;
  if (map && map.getSource("world")) map.getSource("world").setData(worldSquares(layer));
}

// Hovering the map shows the overview result for that square
function showTip(e) {
  const tip = $("map-tip");
  const layer = state.layerData;
  if (!layer || !state.layer) { tip.style.display = "none"; return; }
  const { lat, lng } = e.lngLat.wrap(), step = layer.step;
  const row = Math.floor((lat + 90) / step), col = Math.floor((lng + 180) / step);
  const i = row * Math.round(360 / step) + col;
  const slope = layer.slope[i], verdict = layer.verdict[i], v = variable(state.code);
  if (row < 0 || row >= 180 / step || slope === undefined || slope === null) { tip.style.display = "none"; return; }
  const word = ["not enough data", "no clear trend", "possible, not significant yet", "significant"][verdict];
  tip.textContent = `${v.name}: ${num(slope)} ${v.units} per decade · ${word}`;
  Object.assign(tip.style, { display: "block", left: `${e.point.x + 14}px`, top: `${e.point.y + 14}px` });
}

function placeMarker() {
  if (!map || state.lat === null) return;
  if (!marker) {
    const el = document.createElement("div");
    el.className = "marker selected";
    el.innerHTML = `<span class="dot"></span><span class="name"></span>`;
    marker = new maplibregl.Marker({ element: el, anchor: "left", offset: [-8, 0] });
  }
  marker.setLngLat([state.lon, state.lat]).addTo(map);
  const r = state.place && state.place.results[state.code];
  const el = marker.getElement();
  el.querySelector(".name").textContent = state.name;
  el.querySelector(".dot").outerHTML = dotHTML(r);
  placeBrackets();
}

// focus brackets: four corners drawn around the NASA grid square that the data describes
function placeBrackets() {
  const b = $("brackets");
  if (state.area) { b.style.display = "none"; return; }   // an area shows its outline instead
  if (!map || state.lat === null) return;
  const nw = map.project([state.lon - CELL.lon / 2, state.lat + CELL.lat / 2]);
  const se = map.project([state.lon + CELL.lon / 2, state.lat - CELL.lat / 2]);
  const pad = 6, minSize = 40;
  let x = nw.x - pad, y = nw.y - pad, w = se.x - nw.x + 2 * pad, h = se.y - nw.y + 2 * pad;
  if (w < minSize) { x -= (minSize - w) / 2; w = minSize; }
  if (h < minSize) { y -= (minSize - h) / 2; h = minSize; }
  Object.assign(b.style, { display: "block", left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
}

// ------------------------------------------------------------------ "what is changing here" list
const VERDICT_ORDER = { significant: 0, possible: 1, none: 2, insufficient: 3 };
function renderScan() {
  const el = $("scan");
  placeMarker();
  const switcher = state.area
    ? `<button class="pill small" id="to-centre">Show only the grid square at its centre</button>`
    : state.lastArea ? `<button class="pill small" id="to-area">Show the whole of ${escapeHTML(state.lastArea.name)} again</button>` : "";
  const meta = state.area
    ? (state.place && state.place.info ? areaText(state.area, state.place.info) : `Averaging NASA data over ${escapeHTML(state.area.name)}…`)
    : `${coordText(state.lat, state.lon)} · NASA grid square about ${Math.round(111 * CELL.lat)} km tall`;
  const head = `<div><span class="tag">What is changing here</span>
    <h3>${escapeHTML(state.name)}</h3>
    <p class="meta">${meta}</p>${switcher}</div>`;
  const wireSwitcher = () => {
    if ($("to-centre")) $("to-centre").addEventListener("click", () => selectPlace(state.lat, state.lon, `Centre of ${state.area.name}`, null, true));
    if ($("to-area")) $("to-area").addEventListener("click", () => selectArea(state.lastArea, null));
  };
  if (state.loading) {
    el.innerHTML = head + `<div class="loading"><span class="spinner"></span>${state.area
      ? `Averaging up to ${END_YEAR - START_YEAR + 1} years of NASA data over ${escapeHTML(state.area.name)} (this can take half a minute)…`
      : `Reading up to ${END_YEAR - START_YEAR + 1} years of NASA data for this place…`}</div>`;
    wireSwitcher(); return;
  }
  if (state.error) {
    el.innerHTML = head + `<div class="note warn"><b>Problem</b><span>${state.error} Check your internet connection and try again.</span></div>
      <button class="pill" id="retry">Try again</button>`;
    $("retry").addEventListener("click", () => selectPlace(state.lat, state.lon, state.name, null, false));
    return;
  }
  const results = state.place.results;
  const confirmed = (v) => {               // short note for measurements an independent source backs up
    const other = partnerOf(v);
    if (!other || !results[v.code] || results[v.code].verdict !== "significant") return "";
    const s = secondOpinion(state.place, v);
    return s && s.agreement === "agree" ? ` · confirmed by ${other.source.split(" ")[0]}` : "";
  };
  const rows = VARS.map((v) => ({ v, r: results[v.code] })).sort((a, b) => {
    const rank = (x) => (x.r ? VERDICT_ORDER[x.r.verdict] : 4);
    return rank(a) - rank(b) || ((a.r && a.r.p_value) ?? 1) - ((b.r && b.r.p_value) ?? 1);
  });
  const count = (verdict) => rows.filter((x) => x.r && x.r.verdict === verdict).length;
  const tested = rows.filter((x) => x.r && x.r.verdict !== "insufficient").length;
  el.innerHTML = head + `
    <p class="summary"><strong>${count("significant")} of ${tested}</strong> measurements show a significant trend here` +
      (count("possible") ? `, ${count("possible")} more show a possible one` : "") + `. Strongest evidence first; click one to see it.</p>
    <div class="scan">${rows.map(({ v, r }) => `
      <button class="row${v.code === state.code ? " on" : ""}" data-code="${v.code}" title="${escapeHTML(v.definition)}">
        ${dotHTML(r)}
        <span class="what">${v.name}<small>${r ? (r.verdict === "none" ? "No clear trend yet" : r.verdict === "insufficient" ? "Not enough data" : verdictText(r) + confirmed(v)) : "No data here"}</small></span>
        <span class="rate">${r && r.slope_per_decade !== null ? `${num(r.slope_per_decade)} <small>${v.units} / decade</small>` : "–"}</span>
      </button>`).join("")}</div>`;
  el.querySelectorAll(".row").forEach((b) => b.addEventListener("click", () => selectVariable(b.dataset.code)));
  wireSwitcher();
}

// ------------------------------------------------------------------ the evidence for one measurement
function renderDetail() {
  const el = $("detail"), v = variable(state.code);
  if (state.loading || state.error || !state.place) {
    el.innerHTML = `<div class="detail-text"><span class="tag">${escapeHTML(state.name)} · ${v.name}</span>
      <p style="margin:0"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p>
      ${state.loading ? `<div class="loading"><span class="spinner"></span>Working on the trend…</div>` : ""}</div>`;
    return;
  }
  const r = state.place.results[v.code], s = state.place.series[v.code];
  const text = explain(r, v, state.name);
  const nasaGrid = v.dataset === "nasa";
  const sourceLine = (nasaGrid ? `${v.source} · ${v.product} · monthly` : `${v.source} via NASA POWER · ${v.code} · monthly`) +
    (state.area ? " · area average" : nasaGrid ? " · 1° square" : "");
  if (!r || r.verdict === "insufficient") {
    el.innerHTML = `<div class="detail-text"><span class="tag">${escapeHTML(state.name)} · ${v.name}</span>
      <p class="meta">${sourceLine}</p><h3>${escapeHTML(text.headline)}</h3>
      <p style="margin:0"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p><p style="margin:0">${text.details}</p></div>`;
    return;
  }
  const since = r.start.slice(0, 4);
  const notes = [];
  if (r.reliability === "low") notes.push(`<div class="note warn"><b>Caution</b><span>${r.reliability_note}</span></div>`);
  if (r.tests_agree === false) notes.push(`<div class="note warn"><b>Caution</b><span>${r.tests_note}</span></div>`);
  if (r.years_to_significance !== null) notes.push(`<div class="note time"><b>Estimate</b><span>About <strong>${r.years_to_significance} more years</strong> of data would make this trend significant, if the trend and the noise stay the same. Not a forecast.</span></div>`);
  if (v.low_level !== undefined) {           // e.g. NO2 over clean areas: too close to the satellite's detection limit
    const present = s.values.filter((x) => x !== null);
    if (present.reduce((sum, x) => sum + x, 0) / present.length < v.low_level) notes.unshift(`<div class="note warn"><b>Caution</b><span>${v.low_note}</span></div>`);
  }
  const second = secondOpinion(state.place, v);
  if (second) {
    const line = (x, rx) => `<li><strong style="font-weight:500">${x.source}</strong>: ${verdictText(rx).toLowerCase()}, ${num(rx.slope_per_decade)} ${x.units} per decade</li>`;
    notes.push(`<div class="note second ${second.agreement}"><b>Second source</b><span>Same area, same years (${second.years}):
      <ul>${line(v, second.ra)}${line(second.other, second.rb)}</ul>${AGREEMENT_TEXT[second.agreement]}</span></div>`);
  }

  el.innerHTML = `
    <div class="detail-text">
      <div><span class="tag">${escapeHTML(state.name)} · ${v.name}</span><p class="meta">${sourceLine} · ${since}–${r.end.slice(0, 4)}</p></div>
      <h3>${escapeHTML(text.headline)}</h3>
      <div class="verdict">${dotHTML(r)}${verdictText(r)}${r.tests_agree ? " · both tests agree" : ""}</div>
      <p style="margin:0"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p>
      <div class="numbers">
        <div><div class="label">Change per decade</div><div class="value">${num(r.slope_per_decade)} <small>${v.units}</small></div></div>
        <div><div class="label">Total since ${since}</div><div class="value">${num(r.total_change)} <small>${v.units}</small>${r.percent_change !== null ? ` <small>(${num(r.percent_change)}%)</small>` : ""}</div></div>
        <div><div class="label">Likely range (95%)</div><div class="value">${num(r.ci_low)} to ${num(r.ci_high)}</div></div>
        <div><div class="label">p-value</div><div class="value">${pText(r.p_value)}</div></div>
      </div>
      ${notes.join("")}
      <details><summary>What does this mean?</summary><p>${text.details}</p><p class="muted">${text.caveat}</p></details>
      <details><summary>Data and method</summary><ul>
        ${state.area && state.place.info ? `<li>${areaText(state.area, state.place.info)} Squares nearer the poles count less, because they cover less ground.</li>` : ""}
        <li>${state.area
          ? `NASA ${nasaGrid ? `${v.source} (<code>${v.product}</code>)` : `POWER (<code>${v.code}</code>, from ${v.source})`} monthly values in ${v.units}, averaged over the area as described above.`
          : nasaGrid
          ? `NASA ${v.source} monthly values (<code>${v.product}</code>, ${v.units}), averaged over the 1° square (about 110 km) that contains this place.`
          : `NASA POWER monthly values, parameter <code>${v.code}</code> (${v.units}), from ${v.source}, for the grid square centred on ${coordText(state.lat, state.lon)}.`}</li>
        <li>${r.start} to ${r.end} · ${r.n_months} months · ${r.n_missing} missing.</li>
        <li>${r.method}</li>
        <li>Seasonal Mann-Kendall p-value: ${pText(r.mk_p_value)} · Sen's slope: ${num(r.sen_slope_per_decade)} ${v.units} per decade.</li>
        <li>${nasaGrid || state.area
          ? `<a href="${v.landing || "https://power.larc.nasa.gov/"}">About this NASA dataset</a>${nasaGrid ? " (downloads need a free Earthdata login)" : ""}`
          : `<a href="${POWER}?parameters=${v.code}&community=AG&longitude=${state.lon}&latitude=${state.lat}&start=${START_YEAR}&end=${r.end.slice(0, 4)}&format=CSV">Download this record from NASA (CSV)</a>`}</li>
      </ul></details>
    </div>
    <div class="detail-chart">
      <div class="chart-head">
        <span class="tag plain">Monthly record</span>
        <div class="toggle">
          <button class="pill ${state.raw ? "" : "on"}" data-raw="0">Seasons removed</button>
          <button class="pill ${state.raw ? "on" : ""}" data-raw="1">Raw monthly</button>
        </div>
      </div>
      <div class="chart" id="chart"></div>
      <p class="caption">${state.raw ? "Raw monthly values, including the seasonal swing. Switch to “Seasons removed” to see the trend."
        : "Thin line: monthly values with the seasons removed. Thick line: the straight-line trend. " + r.band_meaning}</p>
    </div>`;
  el.querySelectorAll("[data-raw]").forEach((b) => b.addEventListener("click", () => { state.raw = b.dataset.raw === "1"; renderDetail(); }));
  drawChart("chart", r, s, v, state.raw);
}

// ------------------------------------------------------------------ charts
function drawChart(el, r, s, v, raw, yRange) {
  const x = s.dates.map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-01`);
  const neutral = !hasTrend(r);
  const colour = neutral ? COLOURS.deep : colourOf(r);
  const traces = raw
    ? [{ x, y: s.values, type: "scatter", mode: "lines", line: { color: "#7c7f86", width: 1.2 }, name: v.name, hovertemplate: "%{y:.3g} " + v.units + "<extra></extra>" }]
    : [
        { x, y: r.anomaly, type: "scatter", mode: "lines", line: { color: "#8fb3ae", width: 1 }, name: "Monthly", hovertemplate: "%{y:.2g}<extra>monthly</extra>" },
        ...(r.trend[0] === null ? [] : [
          { x, y: r.band_high, type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
          { x, y: r.band_low, type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: hexA(colour, neutral ? 0.08 : 0.22), hoverinfo: "skip", showlegend: false },
          { x, y: r.trend, type: "scatter", mode: "lines", line: { color: colour, width: 3 }, name: "Trend", hovertemplate: "%{y:.2g}<extra>trend</extra>" },
        ]),
      ];
  Plotly.react(el, traces, {
    margin: { l: 52, r: 8, t: 6, b: 30 }, showlegend: false, hovermode: "x unified",
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Geist, Arial, sans-serif", size: 12, color: "#161616" },
    xaxis: { gridcolor: "rgba(22,22,22,.08)", linecolor: "#161616", tickfont: { family: "Geist Mono, monospace", size: 11 } },
    yaxis: { gridcolor: "rgba(22,22,22,.08)", zerolinecolor: "rgba(22,22,22,.35)", range: yRange,
             title: { text: raw ? v.units : `vs usual month (${v.units})`, font: { size: 11, family: "Geist Mono, monospace" } },
             tickfont: { family: "Geist Mono, monospace", size: 11 } },
  }, { displayModeBar: false, responsive: true });
}

// ------------------------------------------------------------------ search: any place + a question
// How a question is read (simple rules, no AI):
// 1. Measurement: look for each measurement's phrases (strong) and keywords (weaker) from
//    data/variables.json. The best score wins.
// 2. Things we don't have (NO₂, river flow, forecasts...): "not_available" in variables.json.
//    We say so plainly and offer the closest measurement we do have.
// 3. Place: well-known regions ("Sahel"), then names written with capital letters ("Hoover Dam"),
//    then the words left over. Each is looked up in two free place-name services.
// Lower case, hyphens become spaces ("root-zone" = "root zone"), punctuation dropped
const TEXT = (s) => " " + (s || "").toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9à-ž']+/g, " ").replace(/'s\b/g, "").trim() + " ";
function words(text) { return TEXT(text).trim().split(" ").filter(Boolean); }
function matches(token, word) {
  return token === word || (word.length >= 4 && token.startsWith(word)) || (token.length >= 4 && word.startsWith(token));
}
const listOf = (s) => (s || "").split(",").map((x) => TEXT(x).trim()).filter(Boolean);

// Words that are part of the question, not of a place name
const FILLER = new Set(("is are was were the a an of in on at to and or does do did it its it's getting get got gotten become becoming " +
  "more less than then there any how what which where why when who has have had been being much many trend trends change changes " +
  "changing changed over around near nearby here now this that these those about show me my tell for with be will would could should " +
  "can i you we us our please need want like see find look up down rising falling increasing decreasing higher lower level levels " +
  "amount amounts long term long-term long-run years year last past since really still also just only both together alongside " +
  "versus vs compare compared comparing between from through until till to data dataset datasets record records series monthly " +
  "month months daily per each every average averaged averages nowadays days today used use early earlier late later decade decades " +
  "twenty ten area areas region regions box site place places surrounding wider across two three separate side by give pull plot " +
  "i'm i've i'd it's don't doing " +
  "chart charts graph map maps typically usually people same different faster slower rate rates historical history " +
  "making make made goes going gone come comes coming out off into onto as total totals inputs input losses loss school project poster " +
  "measured measure model output report reports land air ground water sky plants plant " +
  "summer summers summertime winter winters wintertime spring springs autumn autumns season seasons").split(" "));

// Well-known regions that a place-name search doesn't find well. With a box [west, south, east,
// north] the region is averaged over that box; without one it is a single place.
const REGIONS = [
  ["sahel", "Sahel", 13.5, 1.875, [-17, 11, 38, 17]], ["sahara", "Sahara", 24.0, 5.0, [-15, 18, 32, 31]],
  ["amazon", "Amazon rainforest", -3.0, -60.0, [-74, -15, -48, 4]], ["arctic", "Svalbard (Arctic)", 78.25, 15.625],
  ["svalbard", "Svalbard (Arctic)", 78.25, 15.625], ["antarctica", "Antarctica", -78.5, 106.875, [-180, -85, 180, -66]],
  ["antarctic", "Antarctica", -78.5, 106.875, [-180, -85, 180, -66]], ["north pole", "North Pole", 89.5, 0],
  ["south pole", "South Pole", -89.5, 0], ["greenland", "Greenland ice sheet", 72.0, -40.0, [-52, 61, -22, 81]],
  ["himalaya", "Himalaya", 28.0, 86.875, [74, 27, 95, 36]], ["siberia", "Siberia", 62.0, 129.375, [60, 50, 140, 72]],
  ["alps", "Alps", 46.5, 10.0, [5.5, 44, 16, 48]], ["lake mead", "Lake Mead (USA)", 36.0, -114.375],
  ["aral sea", "Aral Sea", 45.0, 60.0], ["great barrier reef", "Great Barrier Reef (Australia)", -18.0, 147.5],
  ["pacific", "Pacific Ocean (equator)", 0, -140.0], ["atlantic", "Atlantic Ocean", 30.0, -40.0],
  ["indian ocean", "Indian Ocean", -10.0, 80.0], ["mediterranean", "Mediterranean Sea", 35.0, 18.125, [-5, 31, 35, 44]],
  ["gobi", "Gobi Desert", 43.0, 105.0, [95, 38, 115, 46]], ["congo", "Congo rainforest", 0, 21.25, [12, -6, 30, 5]],
  ["outback", "Australian outback", -25.0, 133.75, [120, -32, 146, -20]],
];
const regionHit = ([key, name, lat, lon, box]) => ({ name, lat, lon, box, regionKey: key, kind: box ? "large" : "region" });

// Read a question: which measurement, what we don't have, which words might name a place
function understand(text) {
  const t = TEXT(text);
  let rest = t;                                  // the question minus the words we have explained
  const take = (piece) => { rest = rest.split(` ${piece} `).join("  "); };
  const tokens = words(text);

  // 1) measurement: phrases count 6, keywords 3, words of the measurement's name 2
  const scores = VARS.map((v) => {
    let score = 0, own = t;                      // own: the question minus this measurement's phrases
    listOf(v.phrases).forEach((p) => {
      if (own.includes(` ${p} `)) { score += 6; own = own.split(` ${p} `).join("  "); p.split(" ").forEach(take); }
    });
    const keys = words(v.keywords), name = words(v.name).filter((w) => !FILLER.has(w));
    words(own).forEach((tok) => {               // a word inside a phrase that already counted isn't counted again
      if (FILLER.has(tok)) return;
      if (keys.some((k) => matches(tok, k))) { score += 3; take(tok); }
      else if (name.some((k) => matches(tok, k))) { score += 2; take(tok); }
    });
    return score;
  });
  const best = Math.max(...scores);
  let variable = best > 0 ? VARS[scores.indexOf(best)] : null;

  // 2) things we don't have
  let missing = null;
  for (const n of NOT_AVAILABLE) {
    const hit = listOf(n.phrases).some((p) => t.includes(` ${p} `)) || tokens.some((tok) => words(n.words).includes(tok));
    if (hit) {
      missing = n;
      listOf(n.phrases).forEach((p) => p.split(" ").forEach(take));
      words(n.words).forEach(take);
      if (!variable && n.closest) variable = variable || VARS.find((v) => v.code === n.closest);
      break;
    }
  }
  const years = (t.match(/\b(1[89]\d\d|20\d\d)\b/g) || []).map(Number);
  if (!missing && years.some((y) => y < START_YEAR)) missing = { say: `Our records start in ${START_YEAR} (haze in 2001), so earlier years aren't available.` };
  if (!missing && years.some((y) => y > END_YEAR)) missing = { say: `Our records run to ${END_YEAR}. ByteMe measures past change; it doesn't forecast.` };

  // 3) place: names with capital letters first ("Hoover Dam"), then the leftover words
  const capitals = (text.match(/[A-ZÀ-Ž][\p{L}'’.-]*(?:\s+(?:of|de|del|da|la|le|the)?\s*[A-ZÀ-Ž][\p{L}'’.-]*)*/gu) || [])
    .map((c) => c.replace(/['’]s\b/g, "").split(/\s+/))
    .map((ws) => { while (ws.length && FILLER.has(ws[0].toLowerCase())) ws.shift(); return ws.join(" "); })
    .map((c) => c.replace(/[.,;:!?]+$/, ""))
    .filter((c) => c.length >= 3 && !FILLER.has(c.toLowerCase()) && !VARS.some((v) => words(v.keywords).includes(c.toLowerCase())));
  const leftover = words(rest).filter((w) => !FILLER.has(w) && !/^\d/.test(w)).map((w) => w.replace(/'s$/, ""));
  return {
    variable, missing,
    placeCandidates: [...new Set([...capitals, leftover.join(" ")])].filter(Boolean),
    leftoverWords: leftover,
    asksWhy: tokens.includes("why") || tokens.includes("because") || tokens.includes("cause") || tokens.includes("causes"),
  };
}

// Look a name up in two free place-name services: Photon (OpenStreetMap: good for lakes, dams,
// islands, regions) and Open-Meteo (GeoNames: good for towns and cities). Photon's best answers first.
// A place much wider than one NASA grid square (about 1 degree), e.g. a country or a big region.
// Photon gives each area's extent as [west, north, east, south].
function isLarge(p) {
  if (p.osm_value === "country") return true;
  if (!p.extent) return false;
  const [w, n, e, s] = p.extent;
  return Math.abs(e - w) > 1.5 || Math.abs(n - s) > 1.5;
}
const SKIP_KINDS = new Set(["highway", "building", "shop", "amenity", "office", "railway", "leisure", "tourism", "craft", "historic"]);
async function geocode(name) {
  const found = [];
  const [photon, meteo] = await Promise.all([
    fetch(`${GEOCODER_2}?q=${encodeURIComponent(name)}&limit=6&lang=en`).then((r) => r.json()).catch(() => null),
    fetch(`${GEOCODER}?name=${encodeURIComponent(name)}&count=5&language=en&format=json`).then((r) => r.json()).catch(() => null),
  ]);
  ((photon && photon.features) || []).forEach((f) => {
    const p = f.properties;
    if (!p.name || SKIP_KINDS.has(p.osm_key)) return;
    found.push({ name: [p.name, p.state !== p.name ? p.state : null, p.country !== p.name ? p.country : null].filter(Boolean).join(", "),
                 lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
                 kind: isLarge(p) ? "large" : "place", osm: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null });
  });
  ((meteo && meteo.results) || []).forEach((p) => found.push({
    name: [p.name, p.admin1 !== p.name ? p.admin1 : null, p.country !== p.name ? p.country : null].filter(Boolean).join(", "),
    lat: p.latitude, lon: p.longitude,
    kind: p.feature_code === "PCLI" ? "large" : "place" }));
  // drop repeats: same name, or practically the same spot
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name || (Math.abs(q.lat - p.lat) < 0.2 && Math.abs(q.lon - p.lon) < 0.2)) === i);
}

// Find places by name: "lat, lon" typed directly, our short list of famous regions, then the geocoders
async function findPlaces(text) {
  const direct = text.match(/^\s*(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)\s*$/);
  if (direct && Math.abs(+direct[1]) <= 90 && Math.abs(+direct[2]) <= 180) {
    return [{ name: null, label: coordText(+direct[1], +direct[2]), lat: +direct[1], lon: +direct[2] }];   // name is looked up after picking
  }
  const found = REGIONS.filter(([key]) => TEXT(text).includes(` ${key}`)).map(regionHit);
  found.push(...(await geocode(text)));
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name) === i).slice(0, 6);
}

// Places for a whole question: famous regions in it, then each candidate name, then single words
async function placesForQuestion(question, q) {
  const regions = REGIONS.filter(([key]) => TEXT(question).includes(` ${key}`)).map(regionHit);
  if (regions.length) return regions.filter((p, i) => regions.findIndex((r) => r.name === p.name) === i);
  for (const candidate of q.placeCandidates) {
    const places = await findPlaces(candidate);
    if (places.length) return places;
  }
  for (const word of [...q.leftoverWords].sort((a, b) => b.length - a.length)) {   // "romania cold winters" -> word by word
    if (word.length < 3) continue;
    const places = await findPlaces(word);
    if (places.length) return places;
  }
  return [];
}

// Turns an <input> into a place picker with a list of suggestions.
// withQuestions = true also understands "is Romania getting warmer?" (the main search box).
function placePicker(input, list, onPick, withQuestions) {
  let timer = null, ticket = 0, hits = [], enterPressed = false;
  const hide = () => (list.style.display = "none");
  const show = (html) => { list.innerHTML = html; list.style.display = "block"; };
  const run = async () => {
    const text = input.value.trim(), mine = ++ticket;
    if (!text) { hide(); return; }
    const q = withQuestions ? understand(text) : null;
    const notes = [];
    if (q && q.missing) notes.push(`<button disabled>${escapeHTML(q.missing.say)}<span class="why">${q.variable ? "Closest we have: " + q.variable.name : "Try another measurement"}</span></button>`);
    if (q && q.asksWhy) notes.push(`<button disabled>ByteMe shows what changed and how sure we are, not why.<span class="why">Finding the cause needs a separate investigation</span></button>`);
    if (q && !q.placeCandidates.length && !q.leftoverWords.length) {   // a question about a measurement only: answer it for the place on the map
      hits = q.variable ? [{ name: state.name, lat: state.lat, lon: state.lon, variable: q.variable }] : [];
    } else {
      show(`<button disabled>Searching places…</button>`);
      const places = q ? await placesForQuestion(text, q) : await findPlaces(text);
      if (mine !== ticket) return;   // the visitor kept typing
      hits = places.map((p) => ({ ...p, variable: q ? q.variable : null }));
    }
    const notesHTML = notes.join("");
    show(hits.length
      ? notesHTML + hits.map((h, i) => `<button data-i="${i}">${escapeHTML(h.name || h.label)}<span class="why">${h.variable ? h.variable.name + " · " : ""}${coordText(h.lat, h.lon)}</span></button>`).join("")
      : notesHTML + `<button disabled>No place found. Try a city, country or region, or click the map<span class="why">Examples: Bucharest · Sahel · Great Barrier Reef · 44.4, 26.1</span></button>`);
    list.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { hide(); onPick(hits[+b.dataset.i], text, q); }));
    if (enterPressed && hits.length) { enterPressed = false; list.querySelector("[data-i]").click(); }   // Enter was pressed while we searched
  };
  input.addEventListener("input", () => { enterPressed = false; clearTimeout(timer); timer = setTimeout(run, 350); });
  input.addEventListener("focus", () => { if (input.value.trim()) run(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
    if (e.key === "Enter") {
      const first = list.querySelector("[data-i]");
      if (first && list.style.display !== "none") first.click(); else { enterPressed = true; clearTimeout(timer); run(); }
    }
  });
  document.addEventListener("click", (e) => { if (e.target !== input && !list.contains(e.target)) hide(); });
}

function buildSearch() {
  placePicker($("search"), $("suggestions"), (hit, text, q) => {
    state.question = { text, code: hit.variable ? hit.variable.code : null, intent: intentOf(text), season: seasonOf(text),
                       kind: hit.kind || "place", asksWhy: q.asksWhy, missing: q.missing };
    state.lastArea = null;
    goTo(hit, state.question.code);
    setTimeout(() => $("answer").scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, true);
}

// A search result: countries and regions are averaged over their outline, other places are one square
async function goTo(hit, code) {
  if (hit.kind !== "large") { selectPlace(hit.lat, hit.lon, hit.name || hit.label, code, true); return; }
  Object.assign(state, { area: null, name: hit.name, loading: true, place: null });
  renderAnswer(); renderScan();
  const area = await shapeFor(hit);
  if (area) selectArea(area, code); else selectPlace(hit.lat, hit.lon, hit.name, code, true);
}

// ------------------------------------------------------------------ answering the question
// The search box gets a direct answer in words: does the data show what the question asks about?
// Which way does the question point? "warmer", "more polluted" -> up; "colder", "drier", "cleaner" -> down.
const UP_WORDS = new Set(("more increase increasing increased rising rise rises higher warmer warming hotter heating wetter " +
  "windier humid humider muggier polluted dirtier greener growing gaining thicker deeper bigger stronger sunnier cloudier").split(" "));
const DOWN_WORDS = new Set(("less fewer decrease decreasing decreased declining decline dropping lower colder cooler cooling " +
  "drier dryer drying drought droughts cleaner melting melt shrinking disappearing vanishing thinner smaller weaker").split(" "));
function intentOf(text) {
  let up = 0, down = 0;
  words(text).forEach((w) => { if (UP_WORDS.has(w)) up++; if (DOWN_WORDS.has(w)) down++; });
  return Math.sign(up - down);
}

// "in summer", "winters": use only those months (summer is June-August north of the equator, December-February south)
const SEASONS = { summer: [[6, 7, 8], [12, 1, 2], "June–August", "December–February"],
                  winter: [[12, 1, 2], [6, 7, 8], "December–February", "June–August"],
                  spring: [[3, 4, 5], [9, 10, 11], "March–May", "September–November"],
                  autumn: [[9, 10, 11], [3, 4, 5], "September–November", "March–May"] };
function seasonOf(text) {
  const w = words(text);
  return Object.keys(SEASONS).find((s) => w.some((x) => x.startsWith(s))) || null;
}
function seasonOnly(series, season, lat, v) {
  const [north, south, northLabel, southLabel] = SEASONS[season];
  const months = lat >= 0 ? north : south;
  const values = series.values.map((x, i) => (months.includes(series.dates[i].month) ? x : null));
  return { result: ByteMeStats.analyze(series.dates, values, v.percent), label: lat >= 0 ? northLabel : southLabel };
}

const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
function relatedChips(v) {
  return (v.related || []).map(variable).filter(Boolean).map((x) => {
    const r = state.place.results[x.code];
    return `<button class="chip" data-code="${x.code}">${dotHTML(r)}${x.name}<small>${r ? verdictText(r) : "No data here"}</small></button>`;
  }).join("");
}

function renderAnswer() {
  const el = $("answer"), q = state.question;
  if (!q || state.error) { el.style.display = "none"; return; }
  el.style.display = "flex";
  if (state.loading || !state.place) {
    el.innerHTML = `<span class="tag">Your question</span><p class="asked">“${escapeHTML(q.text)}”</p>
      <div class="loading"><span class="spinner"></span>${state.area ? `Averaging NASA data over ${escapeHTML(state.name)}…` : `Reading NASA data for ${escapeHTML(state.name)}…`}</div>`;
    return;
  }
  const v = q.code && variable(q.code);
  const notes = [];
  if (q.missing) notes.push(escapeHTML(q.missing.say));
  if (q.asksWhy) notes.push("ByteMe shows what changed and how sure we are, not why: finding the cause needs a separate investigation.");
  if (state.area && state.place.info) notes.push(areaText(state.area, state.place.info));
  else if (q.kind === "large") {
    notes.push(`We couldn't get the outline of ${escapeHTML(state.name)}, so these numbers are for one NASA grid square near its centre ` +
      `(about ${v && v.dataset === "nasa" ? 110 : 55} km wide). Click the map to check other parts.`);
  }

  if (!v) {   // a place without a measurement: show the strongest changes there
    const top = VARS.map((x) => ({ x, r: state.place.results[x.code] }))
      .filter((e) => e.r && e.r.verdict === "significant").sort((a, b) => a.r.p_value - b.r.p_value).slice(0, 4);
    el.innerHTML = `<span class="tag">Your question</span><p class="asked">“${escapeHTML(q.text)}”</p>
      <h3>${top.length ? `The clearest changes in ${escapeHTML(state.name)}` : `No clear changes found in ${escapeHTML(state.name)}`}</h3>
      <div class="chips">${top.map(({ x, r }) => `<button class="chip" data-code="${x.code}">${dotHTML(r)}${x.name}<small>${num(r.slope_per_decade)} ${x.units} per decade</small></button>`).join("")}</div>
      ${notes.map((n) => `<p class="answer-note">${n}</p>`).join("")}
      <p class="answer-note">Ask about something specific, for example “is ${escapeHTML(state.name.split(",")[0])} getting drier?”</p>`;
  } else {
    const series = state.place.series[v.code];
    const seasonal = q.season && series ? seasonOnly(series, q.season, state.lat, v) : null;
    const r = seasonal ? seasonal.result : state.place.results[v.code];
    const subject = `${seasonal ? q.season[0].toUpperCase() + q.season.slice(1) + " " + lowerFirst(v.name) : v.name} in ${escapeHTML(state.name)}`;
    let headline, detail = "";
    if (!r) headline = `There's no ${lowerFirst(v.name)} data for this place.`;
    else if (r.verdict === "insufficient") headline = `Not enough data yet to tell how ${lowerFirst(v.name)} is changing here.`;
    else {
      const dir = r.direction === "increase" ? 1 : -1, moving = dir > 0 ? "rising" : "falling";
      if (r.verdict === "significant" && q.intent === -dir) headline = `<b>No, the opposite.</b> ${subject} is ${moving}.`;
      else if (r.verdict === "significant") headline = `<b>Yes.</b> ${subject} is ${moving}.`;
      else if (r.verdict === "possible") headline = `<b>Maybe.</b> ${subject} may be ${moving}, but it isn't significant yet.`;
      else headline = `<b>No clear change yet.</b> ${subject} shows no clear trend.`;
      detail = `${num(r.slope_per_decade)} ${v.units} per decade since ${r.start.slice(0, 4)} ` +
        `(about ${num(r.total_change)} ${v.units}${r.percent_change !== null ? `, ${num(r.percent_change)}%` : ""} in total) · p-value ${pText(r.p_value)}`;
      if (seasonal) notes.unshift(`Only ${seasonal.label} months are used here; the chart below shows every month.`);
      const second = !seasonal && secondOpinion(state.place, v);
      if (second && second.agreement === "agree") notes.unshift(`Confirmed by a second, independent NASA source: ${second.other.source}.`);
      if (second && second.agreement !== "agree") notes.unshift(`${second.other.source} is a second source for this: ${AGREEMENT_TEXT[second.agreement].toLowerCase()}`);
      if (r.verdict === "none") notes.push("No clear trend doesn't mean nothing changed: the record may be too short or too noisy to tell.");
    }
    el.innerHTML = `<span class="tag">Your question</span><p class="asked">“${escapeHTML(q.text)}”</p>
      <h3>${headline}</h3>${detail ? `<p class="answer-numbers">${detail}</p>` : ""}
      ${notes.map((n) => `<p class="answer-note">${n}</p>`).join("")}
      ${(v.related || []).length ? `<div class="related"><span class="tag plain">Related measurements to check here</span><div class="chips">${relatedChips(v)}</div></div>` : ""}
      <button class="pill" id="to-evidence">See the evidence ↓</button>`;
    $("to-evidence").addEventListener("click", () => { selectVariable(v.code); $("detail").scrollIntoView({ behavior: "smooth" }); });
  }
  el.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { selectVariable(b.dataset.code); $("detail").scrollIntoView({ behavior: "smooth" }); }));
}

// ------------------------------------------------------------------ compare two places
function buildCompare(groups) {
  $("cmp-var").innerHTML = optionsHTML(groups);
  $("cmp-var").value = compare.code;
  $("cmp-var").addEventListener("change", (e) => { compare.code = e.target.value; renderCompare(); });
  ["a", "b"].forEach((side) => {
    $(`cmp-${side}`).value = compare[side].name;
    placePicker($(`cmp-${side}`), $(`cmp-${side}-list`), async (hit) => {
      const area = hit.kind === "large" ? await shapeFor(hit) : null;   // countries and regions: area average
      compare[side] = { name: hit.name || hit.label, lat: hit.lat, lon: hit.lon, area };
      $(`cmp-${side}`).value = compare[side].name;
      renderCompare();
    }, false);
  });
  $("cmp-use").addEventListener("click", () => {
    compare.a = { name: state.name, lat: state.lat, lon: state.lon, area: state.area };
    compare.code = state.code;
    $("cmp-a").value = state.name; $("cmp-var").value = state.code;
    renderCompare();
  });
  renderCompare();
}

let compareTicket = 0;
async function renderCompare() {
  const v = variable(compare.code), mine = ++compareTicket;
  const sides = ["a", "b"].map((side) => ({ ...compare[side], ...snap(compare[side].lat, compare[side].lon), el: $(`cmp-panel-${side}`), id: `cmp-panel-${side}` }));
  sides.forEach((p) => (p.el.innerHTML = `<span class="tag">${escapeHTML(p.name)}</span><div class="loading"><span class="spinner"></span>Reading NASA data…</div>`));
  const places = await Promise.all(sides.map((p) => (p.area ? loadArea(p.area) : loadPlace(p.lat, p.lon)).catch(() => null)));
  if (mine !== compareTicket) return;
  const rs = places.map((pl) => pl && pl.results[v.code]);
  const all = rs.filter((r) => r && r.verdict !== "insufficient").flatMap((r) => [...r.anomaly, ...r.band_low, ...r.band_high]).filter((n) => n !== null);
  const yRange = all.length ? [Math.min(...all), Math.max(...all)] : undefined;   // same scale on both charts
  sides.forEach((p, i) => {
    const r = rs[i];
    if (!places[i]) { p.el.innerHTML = `<span class="tag">${escapeHTML(p.name)}</span><h3>Couldn't reach NASA's data service.</h3>`; return; }
    if (!r || r.verdict === "insufficient") { p.el.innerHTML = `<span class="tag">${escapeHTML(p.name)}</span><h3>${r ? "Not enough data" : "No data"} for ${v.name.toLowerCase()} here.</h3>`; return; }
    p.el.innerHTML = `<span class="tag">${escapeHTML(p.name)}</span>
      <h3>${num(r.slope_per_decade)} ${v.units} per decade</h3>
      <div class="verdict">${dotHTML(r)}${verdictText(r)}</div>
      <div class="chart" id="${p.id}-chart"></div>
      <p class="caption">Total since ${r.start.slice(0, 4)}: ${num(r.total_change)} ${v.units}${r.percent_change !== null ? ` (${num(r.percent_change)}%)` : ""} · p-value ${pText(r.p_value)}${p.area ? ` · ${areaText(p.area, places[i].info)}` : ""}</p>`;
    drawChart(`${p.id}-chart`, r, places[i].series[v.code], v, false, yRange);
  });
}
