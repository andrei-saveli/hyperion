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
const CELL = { lat: 0.5, lon: 0.625 };                  // size of one MERRA-2 grid square

// Demo cases, chosen from real results (see README). Also lit up on the hero globe.
const CASES = [
  { q: "Is the Arctic warming?", name: "Svalbard (Arctic)", lat: 78.25, lon: 15.625, code: "T2M" },
  { q: "Is the air over Beijing getting cleaner?", name: "Beijing (China)", lat: 40.0, lon: 116.25, code: "AOD_55" },
  { q: "Is the Amazon getting less rain?", name: "Manaus, Amazon (Brazil)", lat: -3.0, lon: -60.0, code: "PRECTOTCORR" },
  { q: "Not significant… yet?", name: "Lake Mead (USA)", lat: 36.0, lon: -114.375, code: "GWETTOP" },
];
window.BYTEME_CASES = CASES;

let VARS = [], POWER_VARS = [], NASA = null, NOT_AVAILABLE = [], FAMILIES = {}, WORLD = null, LAND = null, map = null, marker = null;
// state.full: every measurement's whole record for the chosen place or area.
// state.place: the same, cut to the chosen period (state.period, null = whole record) and re-tested.
const state = { lat: null, lon: null, name: "", code: "T2M", raw: false, loading: false, error: null, place: null, full: null, period: null, layer: true };
const { monthText, periodOf, periodInQuestion, slicePeriod } = ByteMeInvestigation;
const dateSpan = (first, last) => `${monthText(first)} to ${monthText(last)}`;
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

// ------------------------------------------------------------------ time periods
// A period cuts every record to the chosen months and runs the trend test again on what is left.
function applyPeriod(full, period) {
  if (!full || !period) return full;
  const series = {};
  VARS.forEach((v) => { series[v.code] = slicePeriod(full.series[v.code], period); });
  return { ...full, series, results: analyzeAll(series) };
}
const periodLabel = (p) => p ? `${p.from || "start of record"} to ${p.to || "end of record"}` : "whole record";

// The period form in Explore: From / To month boxes, Apply, and Whole record
function bindPeriod(id, onChange) {
  const form = $(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const from = form.elements.from.value.trim(), to = form.elements.to.value.trim();
    const period = periodOf(from, to);
    if (!period && (from || to)) {
      form.querySelector("[data-error]").textContent = "Enter months as YYYY-MM, with the start before the end.";
      return;
    }
    onChange(period);
  });
  form.querySelector("[data-reset]").addEventListener("click", () => onChange(null));
}
function showPeriod(id, period, bounds, coverage) {
  const form = $(id);
  form.elements.from.value = period?.from || (bounds ? monthText(bounds.first) : "");
  form.elements.to.value = period?.to || (bounds ? monthText(bounds.last) : "");
  form.querySelector("[data-coverage]").textContent = coverage;
  form.querySelector("[data-error]").textContent = "";
}
function showExplorePeriod() {
  const s = state.full && state.full.series[state.code];
  const bounds = s && { first: s.dates[0], last: s.dates.at(-1) };
  showPeriod("explore-period", state.period, bounds,
    bounds ? `${variable(state.code).name}: data from ${dateSpan(bounds.first, bounds.last)}` + (state.period ? ` · now testing ${periodLabel(state.period)}` : "") : "");
}
function setExplorePeriod(period) {
  state.period = period;
  state.place = applyPeriod(state.full, period);
  writeHash(); showExplorePeriod(); renderScan(); renderDetail(); renderAnswer();
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
      job = nominatim(url.slice(NOMINATIM.length)).then((j) => {
        const g = j && j.features && j.features[0] && j.features[0].geometry;
        return g && ["Polygon", "MultiPolygon", "LineString", "MultiLineString"].includes(g.type) ? g : null;
      });
    }
    // no outline (e.g. the Caspian Sea): use the box around the feature that the search gave, and say so
    const box = (g) => {
      if (g || !hit.extent || hit.extent.some((v) => !Number.isFinite(v))) return g ? { geometry: g, box: false } : null;
      const [w, s, e, n] = hit.extent;
      return { geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] }, box: true };
    };
    shapeCache.set(key, job.then((g) => { const b = box(g); return b ? { key, geometry: b.geometry, box: b.box, name: hit.name || hit.label } : null; }));
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
  if (ByteMeArea.isLine(area.geometry)) {
    return `Average along ${escapeHTML(area.name)}: ${info.points} evenly spaced NASA POWER point${info.points === 1 ? "" : "s"}` +
      (info.squares ? ` and the ${info.squares}${info.sampled ? ` (of ${info.total})` : ""} one-degree squares it passes through` : "") +
      ". These describe the land and air along its course, not the water in it.";
  }
  return `Average over ${area.box ? `a box around ${escapeHTML(area.name)} (OpenStreetMap has no outline for it)` : escapeHTML(area.name)}: ${info.points} evenly spaced NASA POWER point${info.points === 1 ? "" : "s"}` +
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
  VARS = catalogue.variables; NOT_AVAILABLE = catalogue.not_available || []; FAMILIES = catalogue.families || {}; LAND = land; WORLD = world;
  buildVariableSelect(catalogue.groups);
  buildCases();
  buildMap(mapStyle);
  buildSearch();
  bindPeriod("explore-period", setExplorePeriod);
  const fromLink = readHash();
  const first = fromLink || CASES[0];
  if (fromLink) { state.code = fromLink.code; state.period = fromLink.period; }
  if (fromLink && fromLink.hit) goTo(fromLink.hit, fromLink.code);   // a shared link to a country or region
  else selectPlace(first.lat, first.lon, first.name, first.code, true);
});

// Shareable links look like  #44.5,26.25,T2M,Bucharest
function readHash() {
  const [placePart, datePart] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(datePart || "");
  const period = periodOf(params.get("from") || "", params.get("to") || "");
  const found = readPlaceHash(decodeURIComponent(placePart));
  return found && { ...found, period };
}
function readPlaceHash(text) {
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
  const dates = state.period ? "?" + new URLSearchParams(Object.entries(state.period).filter(([, v]) => v)) : "";
  const link = (state.area ? `#area=${state.area.key},${state.code},${encodeURIComponent(state.name)}`
                           : `#${state.lat},${state.lon},${state.code},${encodeURIComponent(state.name)}`) + dates;
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
  showExplorePeriod();
  writeHash(); refreshWorldLayer(); renderScan(); renderDetail();
}

function buildCases() {
  $("cases").innerHTML = CASES.map((c, i) =>
    `<button class="case" data-case="${i}"><span>${c.q}<small>${c.name} · ${variable(c.code).name}</small></span><span class="arrow">→</span></button>`).join("");
  $("cases").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const c = CASES[+b.dataset.case];
    state.question = { text: c.q, code: c.code, intent: intentOf(c.q), season: null, kind: "place" };
    state.period = null;
    selectPlace(c.lat, c.lon, c.name, c.code, true);
    $("explore").scrollIntoView({ behavior: "smooth" });
  }));
}

// ------------------------------------------------------------------ choosing an area (country or region)
async function selectArea(area, code) {
  const [w, s, e, n] = ByteMeArea.bbox(area.geometry);
  const middle = { lat: (s + n) / 2, lon: (w + e) / 2 };
  const samples = ByteMeArea.samplePoints(area.geometry);
  const centre = ByteMeArea.isLine(area.geometry) ? samples[Math.floor(samples.length / 2)]
    : ByteMeArea.inside(middle.lon, middle.lat, area.geometry) ? middle : samples[0];
  Object.assign(state, { area, lastArea: area, lat: centre.lat, lon: centre.lon, name: area.name, loading: true, error: null, place: null, full: null });
  if (code) { state.code = code; $("var-select").value = code; }
  writeHash(); refreshWorldLayer(); placeMarker(); showAreaOutline(); renderScan(); renderDetail(); renderAnswer();
  if (map) {
    if (e - w > 300) map.flyTo({ center: [centre.lon, centre.lat], zoom: 1.2, duration: 1200 });   // wraps round the globe
    else map.fitBounds([[w, s], [e, n]], { padding: 50, maxZoom: 6, duration: 1200 });
  }
  try {
    const place = await loadArea(area);
    if (state.area !== area) return;               // the visitor already moved on
    state.full = place;
    state.place = applyPeriod(place, state.period);
  } catch (err) {
    if (state.area !== area) return;
    state.error = "We couldn't reach NASA's data service for enough points in this area.";
  }
  state.loading = false;
  showExplorePeriod(); renderScan(); renderDetail(); renderAnswer();
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
  Object.assign(state, { area: null, lat: cell.lat, lon: cell.lon, name: name || coordText(cell.lat, cell.lon), loading: true, error: null, place: null, full: null });
  showAreaOutline();
  if (code) { state.code = code; $("var-select").value = code; }
  writeHash(); refreshWorldLayer(); placeMarker(); renderScan(); renderDetail(); renderAnswer();
  if (fly && map) map.flyTo({ center: [cell.lon, cell.lat], zoom: Math.max(map.getZoom(), 2.6), duration: 1200 });
  if (!name) nameOf(cell.lat, cell.lon).then((found) => {
    if (found && state.lat === cell.lat && state.lon === cell.lon) { state.name = found; writeHash(); renderScan(); renderDetail(); renderAnswer(); }
  });
  try {
    const place = await loadPlace(cell.lat, cell.lon);
    if (state.lat !== cell.lat || state.lon !== cell.lon || state.area) return;   // the visitor already moved on
    state.full = place;
    state.place = applyPeriod(place, state.period);
  } catch (e) {
    if (state.lat !== cell.lat || state.lon !== cell.lon) return;
    state.error = "We couldn't reach NASA's data service just now.";
  }
  state.loading = false;
  showExplorePeriod(); renderScan(); renderDetail(); renderAnswer();
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
    const j = await nominatim(`/reverse?lat=${lat}&lon=${lon}&zoom=8&format=jsonv2&accept-language=en`);   // rate-limited
    if (!j) return null;
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
    map.addLayer({ id: "area-fill", type: "fill", source: "area", filter: ["==", ["geometry-type"], "Polygon"],   // areas only, not rivers
      paint: { "fill-color": COLOURS.deep, "fill-opacity": 0.06 } });
    map.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": COLOURS.deep, "line-width": 2 } });
    map.addSource("similar", { type: "geojson", data: { type: "FeatureCollection", features: [] } });   // places changing like this one
    map.addLayer({ id: "similar-line", type: "line", source: "similar",
      paint: { "line-color": COLOURS.ink, "line-width": ["case", ["get", "on"], 3, 1.2], "line-dasharray": [2, 1.5] } });
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
  $("legend-title").textContent = layer ? `${v.name} · trend ${layer.start.slice(0, 4)}–${layer.end.slice(0, 4)} (whole record)` : v.name;
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
  renderInvestigate();
  renderSimilar();
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
  if (state.period) {                         // a chosen period: keep the whole record in view
    const whole = state.full.results[v.code];
    const span = r.end && (+r.end.slice(0, 4)) - (+r.start.slice(0, 4)) + 1;
    notes.unshift(`<div class="note"><b>Period</b><span>Only ${periodLabel(state.period)} is tested here (${r.n_months} months).
      ${whole && whole.verdict !== "insufficient" ? `The whole record (${whole.start.slice(0, 4)}–${whole.end.slice(0, 4)}) says: ${verdictText(whole).toLowerCase()}, ${num(whole.slope_per_decade)} ${v.units} per decade.` : ""}
      ${span && span < 20 ? " Short windows give less certain trends, and a window picked after looking at the chart can make almost anything look significant." : ""}</span></div>`);
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
// A word's stem, so different forms match: warmer/warming/warm, hazier/hazy/haze, rains/raining/rain.
// Simple suffix rules (good enough for search words, not a full English stemmer).
function stem(word) {
  for (const suffix of ["iest", "ier", "ies", "ied", "ing", "est", "ers", "er", "ed", "es", "s", "y", "e"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      word = word.slice(0, -suffix.length);
      break;
    }
  }
  return /([^lsz])\1$/.test(word) ? word.slice(0, -1) : word;   // hott(er) -> hot, sunn(y) -> sun
}
function matches(token, word) {
  return token === word || (token.length >= 3 && word.length >= 3 && stem(token) === stem(word));
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
  "i'm i've i'd it's don't doing put next other " +
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
  text = text.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2");   // "BlackSea" -> "Black Sea"
  const t = TEXT(text);
  let rest = t;                                  // the question minus the words we have explained
  const take = (piece) => { rest = rest.split(` ${piece} `).join("  "); };
  const tokens = words(text);

  // 0) things we don't have ("sea ice", "floods"): found first, and their words are set aside so
  //    they can't pull the search towards a measurement ("sea" -> sea surface temperature)
  let missing = null, scoreText = t;
  for (const n of NOT_AVAILABLE) {
    const phrase = listOf(n.phrases).find((p) => t.includes(` ${p} `));
    const word = tokens.find((tok) => words(n.words).includes(tok));
    if (phrase || word) {
      missing = n;
      [...listOf(n.phrases), ...words(n.words)].forEach((p) => { scoreText = scoreText.split(` ${p} `).join(" " + " ".repeat(p.length + 1)); take(p.split(" ")[0]); p.split(" ").forEach(take); });
      break;
    }
  }

  // Names written with capital letters ("Hoover Dam", "Black Sea"): the likely place names
  const capitals = (text.match(/[A-ZÀ-Ž][\p{L}'’.-]*(?:\s+(?:of|de|del|da|la|le|the)?\s*[A-ZÀ-Ž][\p{L}'’.-]*)*/gu) || [])
    .map((c) => c.replace(/['’]s\b/g, "").split(/\s+/))
    .map((ws) => { while (ws.length && FILLER.has(ws[0].toLowerCase())) ws.shift(); return ws.join(" "); })
    .map((c) => c.replace(/[.,;:!?]+$/, ""))
    .filter((c) => c.length >= 3 && !FILLER.has(c.toLowerCase()) && !VARS.some((v) => words(v.keywords).includes(c.toLowerCase())));

  // 1) measurement. Phrases count 6: all phrases of all measurements are found first and the
  //    longest wins where two overlap ("land surface temperature" beats "surface temperature").
  //    Then each remaining word counts once per measurement: a keyword 3; a weak keyword, a word
  //    of the measurement's name, or a word of its family (e.g. "warmer" for night temperature) 2.
  //    So "nights getting warmer" -> nights (3) + warmer (2) beats plain air temperature (3).
  // scoresOf(source, record): points per measurement for a text; record = true also marks the
  // words used, so they aren't mistaken for a place name
  const scoresOf = (source, record) => {
    const mark = record ? take : () => {};
    const hits = [];
    VARS.forEach((v, i) => listOf(v.phrases).forEach((p) => {
      for (let at = source.indexOf(` ${p} `); at >= 0; at = source.indexOf(` ${p} `, at + 1)) hits.push({ i, p, start: at, end: at + p.length + 1 });
    }));
    hits.sort((x, y) => y.p.length - x.p.length);
    const scores = VARS.map(() => 0), covered = [], familyCredit = VARS.map(() => 0);
    hits.forEach((h) => {
      if (covered.some(([s0, e0]) => h.start < e0 && s0 < h.end)) return;   // a longer phrase already covers these words
      covered.push([h.start, h.end]); scores[h.i] += 6; h.p.split(" ").forEach(take);
      const fam = VARS[h.i].family;               // the family's other members may get part of the credit (below)
      if (fam) VARS.forEach((v, j) => { if (j !== h.i && v.family === fam) familyCredit[j] = Math.max(familyCredit[j], 4); });
    });
    let free = source;
    covered.forEach(([s0, e0]) => { free = free.slice(0, s0) + " ".repeat(e0 - s0) + free.slice(e0); });
    const freeWords = words(free);
    VARS.forEach((v, i) => {
      const keys = words(v.keywords), weak = words(v.weak || ""), name = words(v.name).filter((w) => !FILLER.has(w));
      const family = v.family && FAMILIES[v.family] && FAMILIES[v.family].head !== v.code ? words(FAMILIES[v.family].words) : [];
      let ownKeyword = false;
      freeWords.forEach((tok) => {
        // ordinary words ("air", "ground") only count when a list holds exactly that word
        const same = FILLER.has(tok) ? (k) => k === tok : (k) => matches(tok, k);
        if (keys.some(same)) { scores[i] += 3; ownKeyword = true; mark(tok); return; }
        if (weak.some(same)) { scores[i] += 2; mark(tok); return; }
        if (FILLER.has(tok)) return;
        if ([...name, ...family].some(same)) { scores[i] += 2; mark(tok); }
      });
      // "GLDAS soil moisture": a family phrase counts for a member only when the question also names
      // that member specifically (here "gldas")
      if (ownKeyword) scores[i] += familyCredit[i];
    });
    return scores;
  };
  const scores = scoresOf(scoreText, true);
  const best = Math.max(...scores);
  let variable = best > 0 ? VARS[scores.indexOf(best)] : null;
  // The question asked for something we don't have ("sea level"). Did it also ask for one of our
  // measurements, or was that only suggested by a word of the place name ("sea" in "Black Sea")?
  let closestOnly = false;
  if (missing && missing.closest) {
    let withoutNames = scoreText;
    capitals.forEach((c) => { const p = TEXT(c).trim(); withoutNames = withoutNames.split(` ${p} `).join(" " + " ".repeat(p.length + 1)); });
    if (!variable || Math.max(...scoresOf(withoutNames, false)) === 0) {
      closestOnly = true;
      variable = VARS.find((v) => v.code === missing.closest) || null;   // the closest we have
    }
  }

  const years = (t.match(/\b(1[89]\d\d|20\d\d)\b/g) || []).map(Number);
  if (!missing && years.some((y) => y < START_YEAR)) missing = { say: `Our records start in ${START_YEAR} (haze in 2001), so earlier years aren't available.` };
  if (!missing && years.some((y) => y > END_YEAR)) missing = { say: `Our records run to ${END_YEAR}. ByteMe measures past change; it doesn't forecast.` };

  // 3) place: names with capital letters first ("Hoover Dam", found above), then the leftover words
  const leftover = words(rest).filter((w) => !FILLER.has(w) && !/^\d/.test(w)).map((w) => w.replace(/'s$/, ""));
  return {
    variable, missing, closestOnly, period: periodInQuestion(text),
    placeCandidates: [...new Set([...capitals, leftover.join(" ")])].filter(Boolean),
    namedPlaces: capitals,                       // names written with capital letters ("Lake Mead")
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
    // a big natural feature (a river, sea or mountain range that may cross borders) keeps just its name
    const natural = ["waterway", "natural", "water"].includes(p.osm_key) || ["sea", "ocean"].includes(p.osm_value);
    const bigFeature = natural && isLarge(p);
    found.push({ name: bigFeature ? p.name : [p.name, p.state !== p.name ? p.state : null, p.country !== p.name ? p.country : null].filter(Boolean).join(", "),
                 lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
                 kind: isLarge(p) ? "large" : "place", osm: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null,
                 feature: natural ? (p.osm_key === "waterway" ? "river" : p.osm_value) : null,
                 extent: p.extent ? [p.extent[0], p.extent[3], p.extent[2], p.extent[1]] : null });
  });
  ((meteo && meteo.results) || []).forEach((p) => found.push({
    name: [p.name, p.admin1 !== p.name ? p.admin1 : null, p.country !== p.name ? p.country : null].filter(Boolean).join(", "),
    lat: p.latitude, lon: p.longitude,
    kind: p.feature_code === "PCLI" ? "large" : "place" }));
  // drop repeats: same name, or practically the same spot
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name || (Math.abs(q.lat - p.lat) < 0.2 && Math.abs(q.lon - p.lon) < 0.2)) === i);
}

// ------------------------------------------------------------------ geographic features
// Rivers, lakes, seas, mountains, deserts... The two quick geocoders mostly know towns, so a name
// with a feature word ("Volga River", "Lake Baikal", "Mount Kilimanjaro") is also looked up in
// OpenStreetMap's main search (Nominatim), which ranks by importance, and only results of the
// matching kind are kept. Nominatim asks for at most one request per second: requests wait
// their turn and every answer is remembered.
const FEATURES = {
  river: [["waterway", "river"], ["waterway", "canal"], ["waterway", "stream"]],
  lake: [["water", "lake"], ["water", "reservoir"], ["natural", "water"], ["water", "lagoon"]],
  reservoir: [["water", "reservoir"], ["natural", "water"], ["water", "lake"]],
  sea: [["place", "sea"], ["place", "ocean"], ["natural", "bay"], ["natural", "strait"], ["natural", "water"], ["water", "lake"]],   // the Dead Sea is a lake
  ocean: [["place", "ocean"], ["place", "sea"]],
  gulf: [["natural", "bay"], ["place", "sea"], ["natural", "water"]],
  bay: [["natural", "bay"], ["natural", "water"]],
  strait: [["natural", "strait"]],
  mountain: [["natural", "mountain_range"], ["natural", "peak"], ["natural", "volcano"], ["natural", "ridge"], ["boundary", "region"], ["place", "region"]],
  mount: [["natural", "peak"], ["natural", "volcano"], ["natural", "mountain_range"]],
  peak: [["natural", "peak"], ["natural", "volcano"]],
  volcano: [["natural", "volcano"], ["natural", "peak"]],
  desert: [["natural", "desert"], ["place", "region"], ["natural", "sand"]],
  glacier: [["natural", "glacier"]],
  island: [["place", "island"], ["place", "archipelago"], ["place", "islet"]],
  delta: [["natural", "wetland"], ["place", "region"], ["waterway", "river"]],
  forest: [["natural", "wood"], ["landuse", "forest"], ["boundary", "protected_area"], ["boundary", "national_park"], ["place", "region"]],
  valley: [["natural", "valley"], ["place", "region"]],
  plateau: [["natural", "plateau"], ["place", "region"]],
  peninsula: [["natural", "peninsula"], ["place", "peninsula"]],
  reef: [["natural", "reef"]],
  wetland: [["natural", "wetland"]],
  swamp: [["natural", "wetland"]],
  canyon: [["natural", "valley"], ["natural", "canyon"]],
  waterfall: [["waterway", "waterfall"]],
  park: [["boundary", "national_park"], ["boundary", "protected_area"], ["leisure", "nature_reserve"]],
};
const FEATURE_ALIASES = { rivers: "river", lakes: "lake", seas: "sea", mountains: "mountain", mountain: "mountain", mt: "mount",
  range: "mountain", ranges: "mountain", hills: "mountain", islands: "island", deserts: "desert", glaciers: "glacier",
  forests: "forest", rainforest: "forest", valleys: "valley", reefs: "reef", marsh: "wetland", marshes: "wetland" };
// "blacksea" -> "black sea": a word that ends with a feature word (only used when nothing else matched)
function splitGlued(word) {
  const keys = [...Object.keys(FEATURES), ...Object.keys(FEATURE_ALIASES)].sort((x, y) => y.length - x.length);
  const key = keys.find((k) => word.length >= k.length + 3 && word.endsWith(k));
  return key ? `${word.slice(0, -key.length)} ${key}` : word;
}
const featureWordOf = (text) => {
  for (const w of words(text)) { const k = FEATURE_ALIASES[w] || w; if (FEATURES[k]) return k; }
  return null;
};

const nominatimCache = new Map();
let nominatimFree = 0;   // when the next Nominatim request may start
function nominatim(path) {
  if (!nominatimCache.has(path)) {
    const wait = Math.max(0, nominatimFree - Date.now());
    nominatimFree = Date.now() + wait + 1100;
    nominatimCache.set(path, new Promise((r) => setTimeout(r, wait))
      .then(() => fetch(`${NOMINATIM}${path}`)).then((r) => r.json()).catch(() => null));
  }
  return nominatimCache.get(path);
}

// Features of the kind named in `text` ("Volga River" -> rivers called Volga). Both services are
// asked: Nominatim ranks by importance, Photon knows some big outlines Nominatim misses (Caspian Sea).
async function findFeatures(text) {
  const kind = featureWordOf(text);
  if (!kind) return [];
  const fits = (category, type) => FEATURES[kind].some(([c, t]) => category === c && type === t);
  const search = async (q) => ((await nominatim(`/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&accept-language=en`)) || [])
    .filter((x) => fits(x.category, x.type));
  const [nominatimHits, photon] = await Promise.all([
    search(text),
    fetch(`${GEOCODER_2}?q=${encodeURIComponent(text)}&limit=10&lang=en`).then((r) => r.json()).catch(() => null),
  ]);
  let found = nominatimHits;
  // "Volga River" mostly finds small pieces of the river; the bare name "Volga" finds the whole river
  const bare = words(text).filter((w) => !FEATURES[FEATURE_ALIASES[w] || w] && !FILLER.has(w)).join(" ");
  if (bare && bare !== TEXT(text).trim() && !found.some((x) => (x.importance || 0) >= 0.3)) found = [...found, ...(await search(bare))];
  found.sort((x, y) => (y.importance || 0) - (x.importance || 0));
  const size = (w, s, e, n) => Math.max(Math.abs(e - w), Math.abs(n - s));
  const hit = (name, country, lat, lon, osm, span, box) => ({
    // a big feature, which may cross borders (the Danube), gets no country after its name
    name: [name, span < 1 && country && country !== name ? country : null].filter(Boolean).join(", "),
    lat, lon, osm, feature: kind, kind: span > 1 ? "large" : "place", extent: span > 1 ? box : null,
  });
  const hits = found.map((x) => {
    const [s, n, w, e] = (x.boundingbox || []).map(Number);
    const country = (x.display_name || "").split(",").map((p) => p.trim()).filter(Boolean).pop();
    return hit(x.name || x.display_name.split(",")[0], country, +x.lat, +x.lon,
      x.osm_type && x.osm_id ? `${x.osm_type[0].toUpperCase()}${x.osm_id}` : null, size(w, s, e, n) || 0, [w, s, e, n]);
  });
  ((photon && photon.features) || []).forEach((f) => {
    const p = f.properties;
    if (!p.name || !fits(p.osm_key, p.osm_value)) return;
    const span = p.extent ? size(p.extent[0], p.extent[3], p.extent[2], p.extent[1]) : 0;
    hits.push(hit(p.name, p.country, f.geometry.coordinates[1], f.geometry.coordinates[0], p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null, span,
      p.extent && [p.extent[0], p.extent[3], p.extent[2], p.extent[1]]));
  });
  return hits;
}

// Drop repeats: the same name nearby (two services, or several pieces of one feature)
const samePlace = (p, q) => p.name.split(",")[0] === q.name.split(",")[0] && Math.abs(p.lat - q.lat) < 1 && Math.abs(p.lon - q.lon) < 1;

// Find places by name: "lat, lon" typed directly, our short list of famous regions, then the geocoders
async function findPlaces(text) {
  const direct = text.match(/^\s*(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)\s*$/);
  if (direct && Math.abs(+direct[1]) <= 90 && Math.abs(+direct[2]) <= 180) {
    return [{ name: null, label: coordText(+direct[1], +direct[2]), lat: +direct[1], lon: +direct[2] }];   // name is looked up after picking
  }
  // order: features with a real outline ("Volga River", "Lake Baikal"), then our region boxes
  // ("Gobi"), then features that are only a point, then towns and other places
  let features = await findFeatures(text);
  if (!features.length && !featureWordOf(text)) {          // "blacksea" -> try "black sea"
    const split = words(text).map(splitGlued).join(" ");
    if (split !== TEXT(text).trim()) features = (await findFeatures(split)).filter((f) => f.kind === "large");
  }
  const outlined = features.filter((f) => f.kind === "large" && f.osm && f.osm[0] !== "N");
  const regions = REGIONS.filter(([key]) => TEXT(text).includes(` ${key}`)).map(regionHit);
  const found = [...outlined, ...regions, ...features.filter((f) => !outlined.includes(f)), ...(await geocode(text))];
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name || samePlace(p, q)) === i).slice(0, 6);
}

// Places for a whole question: famous regions in it, then each candidate name, then single words
async function placesForQuestion(question, q) {
  const regions = REGIONS.filter(([key]) => TEXT(question).includes(` ${key}`)).map(regionHit);
  // a named feature that isn't one of our regions ("Amazon River" is not the Amazon rainforest;
  // "Lake Mead" is our Lake Mead)
  const namesFeature = (q.namedPlaces || []).some((c) => featureWordOf(c) && !regions.some((r) => TEXT(c).trim() === r.regionKey));
  if (regions.length && !namesFeature) return regions.filter((p, i) => regions.findIndex((r) => r.name === p.name) === i);
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
                       kind: hit.kind || "place", feature: hit.feature || null, asksWhy: q.asksWhy, missing: q.missing,
                       closestOnly: q.closestOnly, period: q.period };
    state.period = q.period || null;            // a new question tests the years it names, or the whole record
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
  if (q.missing && !q.closestOnly) notes.push(escapeHTML(q.missing.say));
  if (q.asksWhy) notes.push("ByteMe shows what changed and how sure we are, not why: finding the cause needs a separate investigation.");
  if (state.area && state.place.info) notes.push(areaText(state.area, state.place.info));
  else if (q.feature && !["mount", "peak", "volcano", "waterfall"].includes(q.feature)) {
    notes.push(q.kind === "large"
      ? `OpenStreetMap has no outline for ${escapeHTML(state.name)}, so these numbers are for one NASA grid square near its middle (about 55 km wide). Click the map to check other parts.`
      : `These numbers are for the NASA grid square (about 55 km wide) at ${escapeHTML(state.name)}.`);
  }
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
      if (q.closestOnly) headline = `<b>We can't measure that.</b> ${escapeHTML(q.missing.say)}`;   // then the closest, below
      else if (r.verdict === "significant" && q.intent === -dir) headline = `<b>No, the opposite.</b> ${subject} is ${moving}.`;
      else if (r.verdict === "significant") headline = `<b>Yes.</b> ${subject} is ${moving}.`;
      else if (r.verdict === "possible") headline = `<b>Maybe.</b> ${subject} may be ${moving}, but it isn't significant yet.`;
      else headline = `<b>No clear change yet.</b> ${subject} shows no clear trend.`;
      detail = `${num(r.slope_per_decade)} ${v.units} per decade since ${r.start.slice(0, 4)} ` +
        `(about ${num(r.total_change)} ${v.units}${r.percent_change !== null ? `, ${num(r.percent_change)}%` : ""} in total) · p-value ${pText(r.p_value)}`;
      if (q.closestOnly) {
        detail = `<b>The closest measurement we have</b> is a different quantity, so it doesn't answer your question: ` +
          `${subject} shows ${r.verdict === "none" ? "no clear trend" : verdictText(r).toLowerCase()} (${detail}).`;
      }
      if (seasonal) notes.unshift(`Only ${seasonal.label} months are used here; the chart below shows every month.`);
      if (state.period) notes.unshift(`Only ${periodLabel(state.period)} is tested, as your question asked.`);
      const second = !seasonal && secondOpinion(state.place, v);
      if (second && second.agreement === "agree") notes.unshift(`Confirmed by a second, independent NASA source: ${second.other.source}.`);
      if (second && second.agreement !== "agree") notes.unshift(`${second.other.source} is a second source for this: ${AGREEMENT_TEXT[second.agreement].toLowerCase()}`);
      if (r.verdict === "none") notes.push("No clear trend doesn't mean nothing changed: the record may be too short or too noisy to tell.");
    }
    el.innerHTML = `<span class="tag">Your question</span><p class="asked">“${escapeHTML(q.text)}”</p>
      <h3>${headline}</h3>${detail ? `<p class="answer-numbers">${detail}</p>` : ""}
      ${notes.map((n) => `<p class="answer-note">${n}</p>`).join("")}
      ${(v.related || []).length ? `<div class="related"><span class="tag plain">Related measurements to check here</span><div class="chips">${relatedChips(v)}</div></div>` : ""}
      <div class="chips"><button class="pill" id="to-evidence">See the evidence ↓</button>
      ${r && (r.verdict === "significant" || r.verdict === "possible") ? `<button class="pill" id="to-investigate">What might explain this? →</button>` : ""}</div>`;
    $("to-evidence").addEventListener("click", () => { selectVariable(v.code); $("detail").scrollIntoView({ behavior: "smooth" }); });
    $("to-investigate")?.addEventListener("click", () => { selectVariable(v.code); $("investigate").scrollIntoView({ behavior: "smooth" }); });
  }
  el.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { selectVariable(b.dataset.code); $("detail").scrollIntoView({ behavior: "smooth" }); }));
}

// ------------------------------------------------------------------ Investigate: the Trend Decomposer
// The student picks possible drivers; decompose.js works out how much of the trend each one
// statistically accounts for (with ranges from 400 re-runs of history), what is left over, and
// whether each link beats its own out-of-sync copies ("alibi check"). A second, independent line
// of evidence comes from the world grids ("across the planet"). Never a claim about causes.

// Independent versions of MERRA-2 measurements (different instrument or model)
const INDEPENDENT = { PRECTOTCORR: "GPM_RAIN", T2M: "AIRS_T2M", GWETROOT: "GLDAS_SOILM", EVLAND: "GLDAS_EVAP", TS: "MODIS_LST" };
const inv = { picked: null, outcome: null, seasonal: true, satellite: false, planetDriver: null, tried: new Map() };
const resultCache = new Map();
const pct = (x) => `${Math.round(100 * x)}%`;

function investigateKey(outcome, drivers) {
  return `${state.area ? state.area.key : `${state.lat},${state.lon}`}|${state.period ? periodLabel(state.period) : "all"}|${outcome}|${drivers.join("+")}|${inv.seasonal}`;
}

// The drivers actually used: with "satellite data", MERRA-2 drivers are swapped for independent versions
function usedDrivers() {
  return inv.picked.map((c) => (inv.satellite && INDEPENDENT[c] && state.place.series[INDEPENDENT[c]] ? INDEPENDENT[c] : c))
    .filter((c, i, all) => all.indexOf(c) === i);
}

function runDecomposer(outcome) {
  const drivers = usedDrivers().filter((c) => state.place.series[c]);
  if (!drivers.length) return null;
  const key = investigateKey(outcome.code, drivers);
  if (!resultCache.has(key)) {
    resultCache.set(key, ByteMeDecompose.decompose(state.place.series[outcome.code],
      drivers.map((c) => ({ code: c, series: state.place.series[c] })), { seasonal: inv.seasonal, percent: outcome.percent }));
    const place = placeKey();
    inv.tried.set(place, new Set([...(inv.tried.get(place) || []), ...drivers]));
  }
  return resultCache.get(key);
}
function placeKey() {
  return `${state.area ? state.area.key : `${state.lat},${state.lon}`}|${state.code}`;
}

// ---- small drawings (plain SVG, no extra library)
const signed = (v, u) => `${num(v)} ${u}`;
function balanceSheet(res, outcome) {
  const rows = [{ label: "Observed trend", sub: `${res.start.year}–${res.end.year}`, value: res.observed.trend, ink: true },
    ...res.drivers.map((d) => ({ label: variable(d.code).name, sub: d.alibi && d.alibi.p > 0.1 ? "link not distinguishable from chance" : "accounted for", value: d.trend, low: d.low, high: d.high })),
    { label: "Left over", sub: res.left.result.verdict === "significant" ? "still a significant trend" : "no longer a significant trend", value: res.left.trend, low: res.left.low, high: res.left.high, left: true }];
  const max = Math.max(...rows.flatMap((r) => [r.value, r.low, r.high].filter(Number.isFinite).map(Math.abs)), 1e-9);
  const W = 520, mid = W / 2, x = (v) => mid + (v / max) * (mid - 6);
  return `<div class="sheet">${rows.map((r) => {
    const a = x(Math.min(0, r.value)), b = x(Math.max(0, r.value));
    const fill = r.ink ? "var(--ink)" : r.left ? "repeating-linear-gradient(45deg,#9aa5a2 0 3px,#d9e0dd 3px 7px)" : r.value * res.observed.trend > 0 ? "var(--deep)" : "var(--down)";
    return `<div class="sheet-row${r.left ? " left" : ""}">
      <div class="sheet-name">${escapeHTML(r.label)}<small>${escapeHTML(r.sub)}</small></div>
      <div class="sheet-track"><span class="zero" style="left:${mid}px"></span>
        <span class="bar" style="left:${a}px;width:${Math.max(2, b - a)}px;background:${fill}"></span>
        ${Number.isFinite(r.low) ? `<span class="whisker" style="left:${x(r.low)}px;width:${Math.max(1, x(r.high) - x(r.low))}px"></span>` : ""}</div>
      <div class="sheet-val num">${signed(r.value, outcome.units)}<small>${r.ink ? "per decade" : `${Number.isFinite(r.low) ? `${num(r.low)} to ${num(r.high)}` : ""}`}</small></div>
    </div>`;
  }).join("")}</div>`;
}

// One dot-and-range per season: the link between driver and outcome month to month
function linkGlyphs(d, res) {
  const vals = d.links.flatMap((l) => [l.low, l.high, l.value]).filter(Number.isFinite).map(Math.abs);
  const max = Math.max(...vals, 1e-9), W = 150, x = (v) => W / 2 + (v / max) * (W / 2 - 6);
  return `<div class="glyphs">${d.links.map((l, g) => {
    const clear = Number.isFinite(l.low) && (l.low > 0 || l.high < 0);
    const colour = !clear ? "#9aa5a2" : l.value > 0 ? COLOURS.up : COLOURS.down;
    return `<div class="glyph"><span>${res.seasons[g]}</span><svg width="${W}" height="14">
      <line x1="${W / 2}" x2="${W / 2}" y1="0" y2="14" stroke="rgba(20,26,25,.3)" stroke-dasharray="2 2"/>
      ${Number.isFinite(l.low) ? `<line x1="${x(l.low)}" x2="${x(l.high)}" y1="7" y2="7" stroke="${colour}" stroke-width="2.5" stroke-linecap="round"/>` : ""}
      <circle cx="${x(l.value)}" cy="7" r="4.5" fill="${colour}"/></svg></div>`;
  }).join("")}</div>`;
}

function planetScatter(ap, outcome, driver) {
  const W = 420, H = 230, L = 46, B = 30, T = 10, R = 10;
  const xs = ap.points.map((p) => p[0]), ys = ap.points.map((p) => p[1]);
  const q = (arr, f) => [...arr].sort((a, b) => a - b)[Math.floor(f * (arr.length - 1))];
  const x0 = q(xs, 0.01), x1 = q(xs, 0.99), y0 = q(ys, 0.01), y1 = q(ys, 0.99);
  const sx = (v) => L + ((Math.min(Math.max(v, x0), x1) - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (v) => T + (1 - (Math.min(Math.max(v, y0), y1) - y0) / (y1 - y0 || 1)) * (H - T - B);
  const here = ap.points.reduce((best, p) => (Math.hypot(p[2] - state.lat, p[3] - state.lon) < Math.hypot(best[2] - state.lat, best[3] - state.lon) ? p : best), ap.points[0]);
  return `<svg class="planet" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trends in places at similar latitudes">
    <line x1="${L}" x2="${W - R}" y1="${sy(0)}" y2="${sy(0)}" stroke="rgba(20,26,25,.2)"/>
    <line x1="${sx(0)}" x2="${sx(0)}" y1="${T}" y2="${H - B}" stroke="rgba(20,26,25,.2)"/>
    ${ap.points.map((p) => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="2.6" fill="#19a99a" fill-opacity=".45"/>`).join("")}
    <line x1="${sx(x0)}" y1="${sy(ap.intercept + ap.slope * x0)}" x2="${sx(x1)}" y2="${sy(ap.intercept + ap.slope * x1)}" stroke="${COLOURS.deep}" stroke-width="2.5"/>
    <circle cx="${sx(here[0])}" cy="${sy(here[1])}" r="6" fill="${COLOURS.up}" stroke="#fff" stroke-width="2"/>
    <text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="11">${escapeHTML(driver.name)} trend →</text>
    <text x="12" y="${T + 4}" font-size="11" transform="rotate(-90 12 ${T + 4})" text-anchor="end">${escapeHTML(outcome.name)} trend</text>
  </svg>`;
}

function renderInvestigate() {
  const el = $("investigate");
  if (!el) return;
  if (state.loading || state.error || !state.place) { el.innerHTML = ""; el.style.display = "none"; return; }
  el.style.display = "flex";
  const outcome = variable(state.code), r = state.place.results[outcome.code];
  const head = `<span class="tag">Investigate · ${escapeHTML(outcome.name)} · ${escapeHTML(state.name)}</span><h3>What accounts for the trend?</h3>`;
  if (!r || !(r.verdict === "significant" || r.verdict === "possible")) {
    el.innerHTML = head + `<p>${escapeHTML(outcome.name)} shows no clear trend here${state.period ? " in this period" : ""}, so there is nothing to account for yet. Pick a measurement with a trend from the list above.</p>`;
    return;
  }
  // which drivers are offered and picked
  const suggested = (outcome.drivers || []).filter((d) => variable(d.driver) && state.place.series[d.driver]);
  if (inv.outcome !== outcome.code) { inv.outcome = outcome.code; inv.picked = suggested.slice(0, 2).map((d) => d.driver); inv.planetDriver = null; }
  inv.picked = inv.picked.filter((c) => state.place.series[c]);
  const chips = [...new Set([...suggested.map((d) => d.driver), ...inv.picked])];
  const howOf = (c) => (suggested.find((d) => d.driver === c) || {}).how || "";
  const others = VARS.filter((v) => v.code !== outcome.code && v.code !== outcome.pair && v.pair !== outcome.code && state.place.series[v.code] && !chips.includes(v.code));
  const res = inv.picked.length ? runDecomposer(outcome) : null;

  let body = "";
  if (!inv.picked.length) body = `<p class="muted">Pick at least one possible driver above.</p>`;
  else if (!res) body = `<p class="muted">Too few months with data for all of these at once. Try fewer drivers.</p>`;
  else {
    const share = res.observed.trend ? res.accounted.trend / res.observed.trend : 0;
    const shareRange = [res.accounted.low, res.accounted.high].map((v) => v / res.observed.trend).sort((a, b) => a - b);
    const leftSig = res.left.result.verdict === "significant";
    const names = res.drivers.map((d) => lowerFirst(variable(d.code).name));
    const who = names.length > 1 ? `Together, ${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0][0].toUpperCase() + names[0].slice(1);
    // the years all chosen records share (satellite records start later than NASA POWER)
    const full = state.place.series[outcome.code], shorter = full && res.start.year > full.dates[0].year;
    const span = `${shorter ? "Over the years all these records cover" : "Over"} ${res.start.year}–${res.end.year}, ${lowerFirst(outcome.name)} changed by ${signed(res.observed.trend, outcome.units)} per decade.`;
    const part = share < -0.1
      ? `${who} would push the trend <strong>the other way</strong> (${pct(share)}), so they don't account for it.`
      : `${who} statistically account for <strong>about ${pct(Math.min(share, 9.99))}</strong> of it (range ${pct(shareRange[0])} to ${pct(shareRange[1])}).`;
    const summary = `<p class="inv-summary">${span} ${part} What's left, ${signed(res.left.trend, outcome.units)} per decade, is
      <strong>${leftSig ? "still a significant trend: something else is at work too" : "no longer a significant trend"}</strong>.</p>`;
    const verdictOf = (d) => {
      if (d.alibi && d.alibi.p > 0.1) return ["No clear link", "v-weak", "its out-of-sync copies do as well"];
      const clear = d.low > 0 || d.high < 0, sameWay = d.trend * res.observed.trend > 0;
      if (clear && sameWay && Math.abs(d.share) >= 0.1) return [`Accounts for ~${pct(d.share)}`, "v-yes", ""];
      if (clear && !sameWay) return ["Works against the trend", "v-down", "it pushes the other way"];
      return ["Linked, small effect", "v-weak", "real link, but little trend effect"];
    };
    const table = `<table class="inv-table"><thead><tr><th>Driver</th><th>Month-to-month link, by season<br><span>dot = estimate · bar = 95% range · dashed = no link</span></th>
      <th>Accounts for</th><th>Alibi check</th><th>Verdict</th></tr></thead><tbody>
      ${res.drivers.map((d) => {
        const v = variable(d.code), [word, cls, why] = verdictOf(d);
        return `<tr><td class="who"><b>${escapeHTML(v.name)}</b><small>${escapeHTML(howOf(d.code) || v.source)}</small></td>
          <td>${linkGlyphs(d, res)}<small class="unit">${escapeHTML(outcome.units)} per ${escapeHTML(v.units)}</small></td>
          <td class="num">${signed(d.trend, outcome.units)}<small>per decade · ${pct(d.share)}</small></td>
          <td>${d.alibi ? `${d.alibi.p <= 0.1 ? "Passes" : "Fails"}<small>p = ${d.alibi.p.toFixed(2)}, ${d.alibi.tries} shifted copies</small>` : "–"}</td>
          <td class="verdict-word ${cls}">${word}${why ? `<small>${why}</small>` : ""}</td></tr>`;
      }).join("")}</tbody></table>`;
    const together = res.together.map((t) => `<p class="answer-note">${escapeHTML(variable(t.a).name)} and ${escapeHTML(variable(t.b).name)} move together month to month (r = ${t.r.toFixed(2)}), so the split between them is uncertain.</p>`).join("");
    body = summary + balanceSheet(res, outcome) + together + table +
      `<div class="inv-chart-head"><span class="tag plain">What's left after taking the drivers out</span></div><div class="chart" id="inv-chart"></div>
       <p class="caption">Grey: ${escapeHTML(outcome.name.toLowerCase())} with seasons removed. Teal: the same with the drivers' part taken out. Lines: their straight-line trends.</p>
       <div id="inv-planet"></div>`;
  }
  const tried = (inv.tried.get(placeKey()) || new Set()).size;
  el.innerHTML = head + `
    <p class="muted" style="margin:0">${escapeHTML(outcome.name)} shows a ${verdictText(r).toLowerCase()} here (${signed(r.slope_per_decade, outcome.units)} per decade).
      Pick possible drivers: we work out how much of the trend each one statistically accounts for, and what's left.</p>
    <div class="inv-controls">
      <div class="driver-chips">${chips.map((c) => `<button class="pill${inv.picked.includes(c) ? " on" : ""}" data-driver="${c}" title="${escapeHTML(howOf(c))}">${escapeHTML(variable(c).name)}</button>`).join("")}
        ${others.length ? `<select id="add-driver" aria-label="Add a driver"><option value="">+ Add a driver…</option>${others.map((v) => `<option value="${v.code}">${escapeHTML(v.name)}</option>`).join("")}</select>` : ""}</div>
      <div class="inv-options">
        <label><input type="checkbox" id="inv-seasonal" ${inv.seasonal ? "checked" : ""}> Let the link change with the season</label>
        <label><input type="checkbox" id="inv-satellite" ${inv.satellite ? "checked" : ""}> Use satellite data instead of MERRA-2 where possible</label>
      </div>
    </div>
    ${body}
    <details class="how"><summary>How does this work?</summary><ol>
      <li>We remove the seasons and the long-term trend from every record, keeping only the month-to-month wiggles (a warm June, a dry spring).</li>
      <li>One regression links the wiggles of ${escapeHTML(outcome.name.toLowerCase())} to all chosen drivers at once, so drivers that move together aren't counted twice. With the season option, each season gets its own link.</li>
      <li>Each link times the driver's own trend is the part of the trend that driver accounts for. What remains is tested for a trend again.</li>
      <li>Ranges come from re-running history 400 times with whole years drawn at random. The alibi check slides each driver out of sync by 3 to ${Math.max(3, Math.floor((res ? res.months : 120) / 12) - 3)} years: a real link should beat almost all of those copies.</li>
      <li>Across the planet compares trends in other places at a similar latitude, a separate line of evidence from space instead of time.</li></ol></details>
    <p class="answer-note">Accounting for a trend statistically is not proof of cause: a third factor, such as a changing climate or a shift in weather patterns, can drive both.${tried > 2 ? ` Drivers tried here: ${tried}.` : ""}</p>`;

  el.querySelectorAll("[data-driver]").forEach((b) => b.addEventListener("click", () => {
    const c = b.dataset.driver;
    inv.picked = inv.picked.includes(c) ? inv.picked.filter((x) => x !== c) : [...inv.picked, c].slice(0, 5);
    renderInvestigate();
  }));
  $("add-driver")?.addEventListener("change", (e) => { if (e.target.value) { inv.picked = [...inv.picked, e.target.value].slice(0, 5); renderInvestigate(); } });
  $("inv-seasonal").addEventListener("change", (e) => { inv.seasonal = e.target.checked; renderInvestigate(); });
  $("inv-satellite").addEventListener("change", (e) => { inv.satellite = e.target.checked; renderInvestigate(); });
  if (res) {
    drawLeftOver(res, outcome);
    renderPlanet(res, outcome);
  }
}

function drawLeftOver(res, outcome) {
  if (typeof Plotly === "undefined") return;
  const x = res.dates.map((d) => `${d.year}-${String(d.month).padStart(2, "0")}-01`);
  const fit = (series) => {
    const pts = series.map((v, i) => [i, v]).filter(([, v]) => v !== null && Number.isFinite(v));
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    return series.map((_, i) => my + b * (i - mx));
  };
  Plotly.react("inv-chart", [
    { x, y: res.outcomeAnomaly, type: "scatter", mode: "lines", line: { color: "#b8c2bf", width: 1 }, name: "Observed", hovertemplate: "%{y:.2g}<extra>observed</extra>" },
    { x, y: res.left.series, type: "scatter", mode: "lines", line: { color: "#5aa9a0", width: 1 }, name: "Left over", hovertemplate: "%{y:.2g}<extra>left over</extra>" },
    { x, y: fit(res.outcomeAnomaly), type: "scatter", mode: "lines", line: { color: COLOURS.ink, width: 2.5 }, name: "Observed trend", hoverinfo: "skip" },
    { x, y: fit(res.left.series), type: "scatter", mode: "lines", line: { color: COLOURS.deep, width: 3, dash: "dot" }, name: "Left-over trend", hoverinfo: "skip" },
  ], {
    margin: { l: 52, r: 8, t: 6, b: 30 }, showlegend: true, legend: { orientation: "h", y: 1.12, font: { size: 11 } }, hovermode: "x unified",
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { family: "Geist, Arial, sans-serif", size: 12, color: "#161616" },
    xaxis: { gridcolor: "rgba(22,22,22,.08)", linecolor: "#161616" },
    yaxis: { gridcolor: "rgba(22,22,22,.08)", zerolinecolor: "rgba(22,22,22,.35)", title: { text: `vs usual month (${outcome.units})`, font: { size: 11 } } },
  }, { displayModeBar: false, responsive: true });
}

// Across the planet: the same question asked of space instead of time
async function renderPlanet(res, outcome) {
  const box = $("inv-planet");
  if (!box) return;
  const choices = res.drivers.map((d) => d.code);
  const code = choices.includes(inv.planetDriver) ? inv.planetDriver : res.drivers.slice().sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))[0].code;
  const [lo, ld] = await Promise.all([layerFor(outcome.code), layerFor(code)]);
  if (!$("inv-planet")) return;
  const ap = ByteMeDecompose.acrossPlanet(lo, ld, state.lat, 20);
  const driver = variable(code);
  if (!ap) { box.innerHTML = ""; return; }
  const sameWay = ap.slope * (res.drivers.find((d) => d.code === code).links.reduce((s, l) => s + l.value, 0)) > 0;
  box.innerHTML = `<div class="planet-box">
      <div><span class="tag plain">Across the planet</span>
        <p>In ${ap.n} places at similar latitudes (within ${ap.band}° of here), where ${escapeHTML(driver.name.toLowerCase())} rose faster,
          ${escapeHTML(outcome.name.toLowerCase())} ${ap.slope < 0 ? "fell" : "rose"} faster (r = ${ap.r.toFixed(2)}).
          ${Math.abs(ap.r) < 0.2 ? "That relationship is weak." : sameWay ? "That points the same way as the link found here month to month: two independent lines of evidence agree." : "That points the other way from the link found here month to month, so the two lines of evidence disagree."}</p>
        ${choices.length > 1 ? `<label class="meta">Driver <select id="planet-driver">${choices.map((c) => `<option value="${c}"${c === code ? " selected" : ""}>${escapeHTML(variable(c).name)}</option>`).join("")}</select></label>` : ""}
        <p class="caption">Each dot is one grid square's trend over the whole record; the coral dot is here. Neighbouring squares are related, so treat this as a picture, not a test.</p></div>
      ${planetScatter(ap, outcome, driver)}</div>`;
  $("planet-driver")?.addEventListener("change", (e) => { inv.planetDriver = e.target.value; renderPlanet(res, outcome); });
}

// ------------------------------------------------------------------ places changing like this one
// Nearest-neighbour search over trend fingerprints (similar.js): the five parts of the planet whose
// 18 NASA POWER trends (1981 onwards, whole record) follow the closest pattern to this place's.
const VERDICT_NUMBER = { insufficient: 0, none: 1, possible: 2, significant: 3 };
const similarCache = new Map(), similarNames = new Map();
let similarShown = 0;   // which drawing of the panel is on screen (names arrive later)

function similarFor() {
  const key = state.area ? state.area.key : `${state.lat},${state.lon}`;
  if (!similarCache.has(key)) {
    const slopes = {}, verdicts = {};
    POWER_VARS.forEach((v) => {
      const r = state.full.results[v.code];
      slopes[v.code] = r && r.verdict !== "insufficient" ? r.slope_per_decade : null;
      verdicts[v.code] = r ? VERDICT_NUMBER[r.verdict] || 0 : 0;
    });
    const area = state.area;
    // squares inside the chosen country or region are part of it, not "somewhere else"
    const skip = area && !ByteMeArea.isLine(area.geometry) ? (lat, lon) => ByteMeArea.inside(lon, lat, area.geometry) : null;
    similarCache.set(key, ByteMeSimilar.findSimilar(WORLD, { lat: state.lat, lon: state.lon, slopes, verdicts }, { skip }));
  }
  return similarCache.get(key);
}

function nameOfSquare(m) {
  const key = `${m.lat},${m.lon}`;
  // A 5-degree square is region-sized, so it is named after its state or province and country.
  // Only Nominatim is asked (rate-limited, one request per second), so the names arrive one by one.
  if (!similarNames.has(key)) similarNames.set(key, nominatim(`/reverse?lat=${m.lat}&lon=${m.lon}&zoom=5&format=jsonv2&accept-language=en`).then((j) => {
    const a = (j && j.address) || {};
    const parts = [a.state || a.region || a.province || a.county, a.country].filter(Boolean);
    return parts.length ? [...new Set(parts)].join(", ") : coordText(m.lat, m.lon);   // open sea or an unnamed coast
  }));
  return similarNames.get(key);
}

function showSimilarOnMap(matches, on) {
  if (!map || !map.getSource("similar")) return;
  const h = WORLD ? WORLD.step / 2 : 2.5;
  map.getSource("similar").setData({ type: "FeatureCollection", features: (matches || []).map((m, i) => ({
    type: "Feature", properties: { on: i === on },
    geometry: { type: "Polygon", coordinates: [[[m.lon - h, m.lat - h], [m.lon + h, m.lat - h], [m.lon + h, m.lat + h], [m.lon - h, m.lat + h], [m.lon - h, m.lat - h]]] },
  })) });
}

function renderSimilar() {
  const el = $("similar");
  if (!el) return;
  if (!WORLD || state.loading || state.error || !state.full) { el.style.display = "none"; showSimilarOnMap(null); return; }
  const res = similarFor();
  el.style.display = "flex";
  const head = `<span class="tag">Places changing like this one · ${escapeHTML(state.name)}</span><h3>Where else is the planet changing like this?</h3>`;
  if (!res || !res.matches.length) {
    el.innerHTML = head + `<p class="muted">Too few of the 18 measurements have a trend here to compare this place with the rest of the planet.</p>`;
    showSimilarOnMap(null);
    return;
  }
  const land = state.full.results.EVLAND && state.full.results.EVLAND.verdict !== "insufficient";
  const arrow = (t) => `${escapeHTML(variable(t.code).name)} ${t.sign > 0 ? "↑" : "↓"}`;
  el.innerHTML = head + `
    <p class="muted">We compared how ${escapeHTML(state.name)}'s 18 NASA POWER measurements changed (${WORLD.start}–${WORLD.end}, whole record${state.period ? ", not just the chosen period" : ""})
      with ${res.compared.toLocaleString("en")} ${land ? "land" : "ocean"} squares of 5° at least 1,500 km away. These follow the closest pattern of change.</p>
    <ol class="similar-list">${res.matches.map((m, i) => `
      <li><button class="similar-row" data-i="${i}">
        <span class="similar-name" data-name="${i}">${escapeHTML(coordText(m.lat, m.lon))}</span>
        <span class="similar-score"><span class="bar"><i style="width:${Math.max(0, m.score) * 100}%"></i></span>${m.score.toFixed(2)}</span>
        <span class="similar-shares">${m.shares.length ? "Both: " + m.shares.map(arrow).join(" · ") : "Similar pattern, but no single trend significant at both"}</span>
      </button></li>`).join("")}</ol>
    <p class="caption">Similarity runs from +1 (the same pattern of change) through 0 (unrelated) to −1 (the opposite); a typical square scores ${res.typical.toFixed(2)}.
      Each trend is compared with how the whole planet changed, and related measurements (the four temperatures, the three humidities) share one vote.
      Changing alike doesn't mean the same cause. Click a place to open it.</p>`;
  showSimilarOnMap(res.matches, -1);
  const shown = ++similarShown;
  res.matches.forEach((m, i) => nameOfSquare(m).then((name) => {
    const slot = el.querySelector(`[data-name="${i}"]`);
    if (shown === similarShown && slot) slot.textContent = name;
  }));
  el.querySelectorAll(".similar-row").forEach((b) => {
    const m = res.matches[+b.dataset.i];
    b.addEventListener("mouseenter", () => showSimilarOnMap(res.matches, +b.dataset.i));
    b.addEventListener("mouseleave", () => showSimilarOnMap(res.matches, -1));
    b.addEventListener("click", async () => {
      state.question = null; state.lastArea = null;
      selectPlace(m.lat, m.lon, await nameOfSquare(m), state.code, true);
      $("explore").scrollIntoView({ behavior: "smooth" });
    });
  });
}
