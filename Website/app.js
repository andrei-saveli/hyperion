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
const RECENT_COMPARISON_YEARS = 15;
const COMPARE_SIDES = ["a", "b"];
const POWER = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const GEOCODER = "https://geocoding-api.open-meteo.com/v1/search";
const GEOCODER_2 = "https://photon.komoot.io/api/";
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
const state = {
  lat: null, lon: null, name: "", code: "T2M",
  raw: false, loading: false, error: null, layer: true, scanOpen: false,
  fullRecord: null, analysis: null, period: null, selectedLead: null,
};
const compare = {
  code: "AOD_55", period: null, records: null,
  a: { name: "Beijing (China)", lat: 40.0, lon: 116.25 },
  b: { name: "Delhi (India)", lat: 28.5, lon: 77.5 },
};
const $ = (id) => document.getElementById(id);
const { monthText, periodOf, periodInQuestion, slicePeriod, matchMonths, recentPeriod, fitComparison } = ByteMeInvestigation;

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
const dateSpan = (first, last) => `${monthText(first)} to ${monthText(last)}`;
const seriesBounds = (series) => series && { first: series.dates[0], last: series.dates.at(-1) };

function bindPeriod(id, onChange) {
  const form = $(id);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const from = form.elements.from.value.trim(), to = form.elements.to.value.trim();
    const period = periodOf(from, to);
    if (!period && (from || to)) {
      form.querySelector("[data-error]").textContent = "Enter dates as YYYY-MM with the start before or equal to the end.";
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

const placeCache = new Map();
const powerCache = new Map();

function powerAt(lat, lon) {
  const cell = snap(lat, lon), key = `${cell.lat},${cell.lon}`;
  if (!powerCache.has(key)) {
    const job = downloadPower(cell.lat, cell.lon, END_YEAR)
      .catch(() => downloadPower(cell.lat, cell.lon, END_YEAR - 1));
    job.catch(() => powerCache.delete(key));
    powerCache.set(key, job);
  }
  return powerCache.get(key);
}

// Download every measurement for one grid square and run the trend analysis on each.
// Two sources: NASA POWER (asked live) and the NASA satellite/model grids we prepared (data/nasa/).
function loadPlace(lat, lon) {
  const cell = snap(lat, lon), grid = ByteMeNasa.locate(lat, lon, NASA?.tile || 10);
  const key = `${cell.lat},${cell.lon}:${grid.tile},${grid.square}`;
  if (!placeCache.has(key)) {
    const job = Promise.all([powerAt(lat, lon).catch(() => null), loadNasaCell(lat, lon)])
      .then(([raw, nasa]) => {
        const series = Object.fromEntries(VARS.map((v) => [
          v.code, v.dataset === "nasa" ? nasa.series[v.code] || null : toSeries(raw?.[v.code], v.scale || 1),
        ]));
        if (!raw || nasa.incomplete) placeCache.delete(key);
        if (!raw && !Object.values(series).some(Boolean)) throw new Error("Neither data source is available");
        return { ...analyzeMeasurements(series), powerUnavailable: !raw };
      });
    job.catch(() => placeCache.delete(key));   // a failed download can be tried again
    placeCache.set(key, job);
  }
  return placeCache.get(key);
}

function analyzeMeasurements(series, period = null) {
  const selected = {}, results = {};
  for (const { code, percent } of VARS) {
    const record = slicePeriod(series[code], period);
    selected[code] = record;
    results[code] = record ? ByteMeStats.analyze(record.dates, record.values, percent) : null;
  }
  return { series: selected, results };
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
  if (!tileCache.has(url)) {
    const job = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Tile download failed (${r.status})`);
      return r.arrayBuffer();
    });
    job.catch(() => tileCache.delete(url));
    tileCache.set(url, job);
  }
  return tileCache.get(url);
}

async function nasaSeries(lat, lon, code) {
  const info = NASA?.variables[code];
  if (!info) return null;
  const { tile, square } = ByteMeNasa.locate(lat, lon, NASA.tile);
  if (!info.tiles.includes(tile)) return null;
  return ByteMeNasa.decode(await nasaTile(code, tile), square, info, NASA.missing);
}

async function loadNasaCell(lat, lon) {
  const codes = Object.keys(NASA?.variables || {});
  const attempts = await Promise.allSettled(codes.map((code) => nasaSeries(lat, lon, code)));
  return {
    series: Object.fromEntries(codes.map((code, index) => [code, attempts[index].value ?? null])),
    incomplete: attempts.some((attempt) => attempt.status === "rejected"),
  };
}

// ------------------------------------------------------------------ second source
// Several measurements exist twice: from NASA POWER (MERRA-2) and from an independent satellite
// or model (GPM, AIRS, MODIS, GLDAS). We test both over the years they share, so they can be compared fairly.
function partnerOf(v) {
  return v.pair ? variable(v.pair) : VARS.find((x) => x.pair === v.code) || null;
}
function secondOpinion(place, v) {
  const other = partnerOf(v);
  if (!other || !place.series[v.code] || !place.series[other.code]) return null;
  const paired = matchMonths(place.series[v.code], place.series[other.code]);
  if (!paired || paired.count < 24) return null;
  const ra = ByteMeStats.analyze(paired.dates, paired.values[0], v.percent);
  const rb = ByteMeStats.analyze(paired.dates, paired.values[1], other.percent);
  if (ra.verdict === "insufficient" || rb.verdict === "insufficient") return null;
  const sig = (r) => r.verdict === "significant";
  let agreement;
  if (sig(ra) && sig(rb)) agreement = ra.direction === rb.direction ? "agree" : "disagree";
  else if (sig(ra) || sig(rb)) agreement = "partly";
  else agreement = "neither";
  return { other, ra, rb, agreement, period: dateSpan(paired.first, paired.last), count: paired.count };
}
const AGREEMENT_TEXT = {
  agree: "Both products show a significant trend in the same direction.",
  disagree: "The products show significant trends in opposite directions.",
  partly: "One product finds a significant trend over these months.",
  neither: "Neither product finds a significant trend over these months.",
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
  bindPeriod("explore-period", setExplorePeriod);
  const linkedComparison = readCompareLink();
  if (linkedComparison) Object.assign(compare, linkedComparison);
  buildCompare(catalogue.groups);
  const fromLink = readHash();
  const openExperiment = location.hash === "#experiment";
  const first = fromLink || CASES[0];
  if (fromLink) state.code = fromLink.code;
  selectPlace(first.lat, first.lon, first.name, first.code, true, first.period || null);
  if (linkedComparison) $("compare").scrollIntoView();
  else if (openExperiment) $("experiment").scrollIntoView();
});

// Preserve old place links and append an optional analysis period.
function readHash() {
  try {
    const [place, dates] = location.hash.slice(1).split("?");
    const [lat, lon, code, ...name] = place.split(",");
    if (!lat || !lon || !validPoint({ lat: +lat, lon: +lon }) || !variable(code)) return null;
    const params = new URLSearchParams(dates);
    return { lat: +lat, lon: +lon, code, name: decodeURIComponent(name.join(",")), period: periodOf(params.get("from"), params.get("to")) };
  } catch { return null; }
}
function writeHash() {
  const dates = state.period ? "?" + new URLSearchParams(state.period) : "";
  try { history.replaceState(null, "", `#${state.lat},${state.lon},${state.code},${encodeURIComponent(state.name)}${dates}`); } catch { /* fine without */ }
}
function validPoint({ lat, lon }) {
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180;
}

function showExplorePeriod() {
  const bounds = seriesBounds(state.fullRecord?.series[state.code]);
  const coverage = bounds ? `Available for ${variable(state.code).name} · ${dateSpan(bounds.first, bounds.last)}` : "";
  showPeriod("explore-period", state.period, bounds, coverage);
}

function setExplorePeriod(period) {
  state.period = period;
  updateExploreAnalysis();
  writeHash();
}

function updateExploreAnalysis() {
  const { fullRecord, period } = state;
  state.analysis = fullRecord && period ? analyzeMeasurements(fullRecord.series, period) : fullRecord;
  showExplorePeriod();
  renderScan();
  renderDetail();
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
  state.selectedLead = null;
  $("var-select").value = code;
  showExplorePeriod();
  writeHash(); refreshWorldLayer(); renderScan(); renderDetail();
}

function buildCases() {
  $("cases").innerHTML = CASES.map((c, i) =>
    `<button class="case" data-case="${i}"><span>${c.q}<small>${c.name} · ${variable(c.code).name}</small></span><span class="arrow">→</span></button>`).join("");
  $("cases").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const c = CASES[+b.dataset.case];
    selectPlace(c.lat, c.lon, c.name, c.code, true, null);
    $("explore").scrollIntoView({ behavior: "smooth" });
  }));
}

// ------------------------------------------------------------------ choosing a place
let selectionTicket = 0;
async function selectPlace(lat, lon, name, code, fly, period = state.period) {
  const ticket = ++selectionTicket;
  Object.assign(state, {
    lat, lon, name: name || coordText(lat, lon), period,
    loading: true, error: null, fullRecord: null, analysis: null, selectedLead: null,
  });
  if (code) { state.code = code; $("var-select").value = code; }
  showExplorePeriod();
  writeHash(); refreshWorldLayer(); placeMarker(); renderScan(); renderDetail();
  if (fly && map) map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 2.6), duration: 1200 });
  if (!name) nameOf(lat, lon).then((found) => {
    if (found && ticket === selectionTicket) { state.name = found; writeHash(); renderScan(); renderDetail(); }
  });
  try {
    const fullRecord = await loadPlace(lat, lon);
    if (ticket !== selectionTicket) return;
    state.fullRecord = fullRecord;
  } catch (e) {
    if (ticket !== selectionTicket) return;
    state.error = "We couldn't reach NASA's data service just now.";
  }
  state.loading = false;
  updateExploreAnalysis();
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
  if (typeof maplibregl === "undefined") {
    $("map").textContent = "The map library is unavailable. You can still search for places.";
    $("layer").disabled = true;
    $("world").disabled = true;
    return;
  }
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
    placeMarker();
  });
  map.on("click", (e) => selectPlace(e.lngLat.lat, e.lngLat.wrap().lng, null, null, false));
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
  $("legend-title").textContent = layer ? `${v.name} · precomputed ${layer.start.slice(0, 4)}–${layer.end.slice(0, 4)}` : v.name;
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
  const r = state.analysis?.results[state.code];
  const el = marker.getElement();
  el.querySelector(".name").textContent = state.name;
  el.querySelector(".dot").outerHTML = dotHTML(r);
  placeBrackets();
}

// focus brackets: four corners drawn around the NASA grid square that the data describes
function placeBrackets() {
  const b = $("brackets");
  if (!map || state.lat === null) return;
  const grid = variable(state.code).dataset === "nasa";
  const center = grid ? { lat: Math.min(89, Math.floor(state.lat)) + 0.5, lon: Math.floor(state.lon === 180 ? -180 : state.lon) + 0.5 } : snap(state.lat, state.lon);
  const halfLat = (grid ? 1 : CELL.lat) / 2, halfLon = (grid ? 1 : CELL.lon) / 2;
  const nw = map.project([center.lon - halfLon, center.lat + halfLat]);
  const se = map.project([center.lon + halfLon, center.lat - halfLat]);
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
  const head = `<div><span class="tag">Investigation site</span>
    <h3>${escapeHTML(state.name)}</h3>
    <p class="meta">${coordText(state.lat, state.lon)} · ${state.period ? escapeHTML([state.period.from || "Record start", state.period.to || "Record end"].join(" to ")) : "Full records"}</p></div>`;
  if (state.loading) { el.innerHTML = head + `<div class="loading"><span class="spinner"></span>Reading up to ${END_YEAR - START_YEAR + 1} years of NASA data for this place…</div>`; return; }
  if (state.error) {
    el.innerHTML = head + `<div class="note warn"><b>Problem</b><span>${state.error} Check your internet connection and try again.</span></div>
      <button class="pill" id="retry">Try again</button>`;
    $("retry").addEventListener("click", () => selectPlace(state.lat, state.lon, state.name, null, false));
    return;
  }
  const results = state.analysis.results;
  const confirmed = (v) => {               // short note for measurements an independent source backs up
    const other = partnerOf(v);
    if (!other || !results[v.code] || results[v.code].verdict !== "significant") return "";
    const s = secondOpinion(state.analysis, v);
    return s && s.agreement === "agree" ? ` · also seen in ${other.source.split(" ")[0]}` : "";
  };
  const rows = VARS.map((v) => ({ v, r: results[v.code] })).sort((a, b) => {
    const rank = (x) => (x.r ? VERDICT_ORDER[x.r.verdict] : 4);
    return rank(a) - rank(b) || ((a.r && a.r.p_value) ?? 1) - ((b.r && b.r.p_value) ?? 1);
  });
  const count = (verdict) => rows.filter((x) => x.r && x.r.verdict === verdict).length;
  const tested = rows.filter((x) => x.r && x.r.verdict !== "insufficient").length;
  const summary = tested
    ? `<strong>${count("significant")} of ${tested}</strong> show a significant trend in individual tests`
      + (count("possible") ? `, ${count("possible")} more show a possible one.` : ".")
    : "No measurements have enough data for a trend verdict in this period.";
  el.innerHTML = head + `
    ${state.fullRecord.powerUnavailable ? `<p class="meta">Live NASA POWER data is unavailable. Bundled datasets are still available here.</p>` : ""}
    <p class="summary">Use the evidence below to inspect ${escapeHTML(variable(state.code).name.toLowerCase())}. Open a lead when another measurement could help test an explanation.</p>
    <details data-trend-scan${state.scanOpen ? " open" : ""}>
    <summary>Browse measurement trends</summary>
    <p class="summary">${summary}</p>
    <div class="scan">${rows.map(({ v, r }) => `
      <button class="row${v.code === state.code ? " on" : ""}" data-code="${v.code}" title="${escapeHTML(v.definition)}">
        ${dotHTML(r)}
        <span class="what">${v.name}<small>${r ? (r.verdict === "none" ? "No clear trend yet" : r.verdict === "insufficient" ? "Not enough data" : verdictText(r) + confirmed(v)) : "No data here"}</small></span>
        <span class="rate">${r && r.slope_per_decade !== null ? `${num(r.slope_per_decade)} <small>${v.units} / decade</small>` : "–"}</span>
      </button>`).join("")}</div>
    </details>`;
  const scan = el.querySelector("[data-trend-scan]");
  scan.addEventListener("toggle", () => { state.scanOpen = scan.open; });
  el.querySelectorAll(".row").forEach((b) => b.addEventListener("click", () => selectVariable(b.dataset.code)));
}

// ------------------------------------------------------------------ the evidence for one measurement
function renderDetail() {
  const el = $("detail"), v = variable(state.code);
  renderFollowUps(v);
  if (state.loading || state.error || !state.analysis) {
    el.innerHTML = `<div class="detail-text"><span class="tag">${escapeHTML(state.name)} · ${v.name}</span>
      <p style="margin:0"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p>
      ${state.loading ? `<div class="loading"><span class="spinner"></span>Working on the trend…</div>` : ""}</div>`;
    return;
  }
  const r = state.analysis.results[v.code], s = state.analysis.series[v.code];
  const full = state.fullRecord.series[v.code], fullFit = state.fullRecord.results[v.code], cell = snap(state.lat, state.lon);
  const text = explain(r, v, state.name);
  const nasaGrid = v.dataset === "nasa";
  const sourceLine = nasaGrid ? `${v.source} · ${v.product} · monthly · 1° square` : `${v.source} via NASA POWER · ${v.code} · monthly`;
  const reference = { dates: full?.dates, fit: fullFit };
  if (!r || r.verdict === "insufficient") {
    const hasValues = s?.values.some(Number.isFinite);
    let message = text.details;
    if (state.fullRecord.powerUnavailable && !nasaGrid) message = "Live NASA POWER data is unavailable. Try again or select a bundled measurement.";
    else if (!hasValues && full) message = "This measurement has no usable months in the selected period.";
    else if (hasValues) message = "A trend verdict requires at least 24 observations spanning 10 years. The chart shows the months available in this period.";
    el.innerHTML = `<div class="detail-text"><span class="tag">${escapeHTML(state.name)} · ${v.name}</span>
      <p class="meta">${sourceLine}</p><h3>${escapeHTML(text.headline)}</h3>
      <p style="margin:0"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p><p style="margin:0">${message}</p>
      ${state.period && full ? `<button type="button" class="pill compare-lead" data-full-record>Use the full record</button>` : ""}</div>
      ${hasValues ? detailChart(r) : ""}`;
    el.querySelector("[data-full-record]")?.addEventListener("click", () => setExplorePeriod(null));
    if (hasValues) bindDetailChart(el, r, s, v, reference);
    return;
  }
  const since = r.start.slice(0, 4);
  const notes = [];
  if (r.reliability === "low") notes.push(`<div class="note warn"><b>Caution</b><span>${r.reliability_note}</span></div>`);
  if (r.tests_agree === false) notes.push(`<div class="note warn"><b>Caution</b><span>${r.tests_note}</span></div>`);
  if (r.years_to_significance !== null) notes.push(`<div class="note time"><b>Estimate</b><span>About <strong>${r.years_to_significance} more years</strong> of data would make this trend significant, if the trend and the noise stay the same. Not a forecast.</span></div>`);
  if (belowSourceFloor(s.values, v)) {
    notes.unshift(`<div class="note warn"><b>Caution</b><span>${v.low_note}</span></div>`);
  }
  const second = secondOpinion(state.analysis, v);
  if (second) {
    const line = (x, rx) => `<li><strong style="font-weight:500">${x.source}</strong>: ${verdictText(rx).toLowerCase()}, ${num(rx.slope_per_decade)} ${x.units} per decade</li>`;
    notes.push(`<div class="note second ${second.agreement}"><b>Second source</b><span>${second.count} shared months (${second.period}).
      <ul>${line(v, second.ra)}${line(second.other, second.rb)}</ul>${AGREEMENT_TEXT[second.agreement]}</span></div>`);
  }

  el.innerHTML = `
    <div class="detail-text">
      <div><span class="tag">${escapeHTML(state.name)} · ${v.name}</span><p class="meta">${sourceLine} · ${r.start} to ${r.end}</p></div>
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
        <li>${nasaGrid
          ? `NASA ${v.source} monthly values (<code>${v.product}</code>, ${v.units}), averaged over the 1° square (about 110 km) that contains this place.`
          : `NASA POWER monthly values, parameter <code>${v.code}</code> (${v.units}), from ${v.source}, for the grid square centred on ${coordText(cell.lat, cell.lon)}.`}</li>
        <li>${r.start} to ${r.end} · ${r.n_months} months · ${r.n_missing} missing.</li>
        <li>${r.method}</li>
        <li>Seasonal Mann-Kendall p-value: ${pText(r.mk_p_value)} · Sen's slope: ${num(r.sen_slope_per_decade)} ${v.units} per decade.</li>
        <li>${nasaGrid
          ? `<a href="${v.landing}">About this NASA dataset</a> (downloads need a free Earthdata login)`
          : `<a href="${POWER}?parameters=${v.code}&community=AG&longitude=${cell.lon}&latitude=${cell.lat}&start=${START_YEAR}&end=${fullFit.end.slice(0, 4)}&format=CSV">Download the full NASA record (CSV)</a>`}</li>
      </ul></details>
      <button type="button" class="pill compare-lead" data-compare-place>Compare with another place</button>
    </div>
    ${detailChart(r)}`;
  el.querySelector("[data-compare-place]").addEventListener("click", () => useExploreInCompare(true));
  bindDetailChart(el, r, s, v, reference);
}

function detailChart(r) {
  return `<div class="detail-chart">
      <div class="chart-head">
        <span class="tag plain">Monthly record</span>
        <div class="toggle">
          <button class="pill ${state.raw ? "" : "on"}" data-raw="0">Seasons removed</button>
          <button class="pill ${state.raw ? "on" : ""}" data-raw="1">Raw monthly</button>
        </div>
      </div>
      <div class="chart" id="chart"></div>
      <p class="caption">${state.raw ? "Raw monthly values, including the seasonal swing."
        : r.verdict === "insufficient" ? "Monthly departures from the seasonal baseline of the full record."
        : "Thin line: monthly values with the seasons removed. Thick line: the straight-line trend. " + r.band_meaning}</p>
    </div>`;
}

function bindDetailChart(el, r, s, v, reference) {
  el.querySelectorAll("[data-raw]").forEach((b) => b.addEventListener("click", () => { state.raw = b.dataset.raw === "1"; renderDetail(); }));
  drawChart("chart", r, s, v, state.raw, undefined, reference);
}

// ------------------------------------------------------------------ follow up on the current finding
function renderFollowUps(measurement) {
  const panel = $("follow-ups");
  if (!state.analysis) {
    panel.hidden = true;
    panel.replaceChildren();
    return;
  }
  const full = state.fullRecord;
  const choices = ByteMeExperiments.relatedLeads(measurement.code, full.series);
  const partner = partnerOf(measurement);
  if (partner && full.series[partner.code]?.values.some(Number.isFinite)) {
    choices.push({
      from: measurement.code, to: partner.code, label: "Check another source", expectedSign: 1,
      prediction: "If the products agree about the direction of change, both should show the same direction over their shared months.",
      alternative: "Differences in coverage, resolution, or how a product defines the measurement can explain a disagreement.",
      nextEvidence: "Check the product descriptions for differences in spatial coverage and what each instrument measures.",
    });
  }
  panel.hidden = choices.length === 0;
  if (panel.hidden) return;
  panel.innerHTML = `<h3>Test a lead</h3><div class="lead-options">${choices.map(({ to, label }) =>
    `<button type="button" class="pill${state.selectedLead === to ? " on" : ""}" data-lead="${to}"
      aria-pressed="${state.selectedLead === to}">${escapeHTML(label)}</button>`).join("")}</div>
    <div class="lead-evidence"></div>`;

  panel.querySelectorAll("[data-lead]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLead = button.dataset.lead;
      renderFollowUps(measurement);
      panel.querySelector(".lead-evidence h4")?.focus({ preventScroll: true });
    });
  });
  const lead = choices.find(({ to }) => to === state.selectedLead);
  if (lead) renderLeadEvidence(panel.querySelector(".lead-evidence"), lead);
}

function renderLeadEvidence(panel, lead) {
  const { paired, fits, verdict } = ByteMeExperiments.assessLead(
    lead, state.analysis.series[lead.from], state.analysis.series[lead.to],
  );
  const headlines = {
    consistent: "The records fit this prediction",
    weakened: "The trends weaken this explanation",
    insufficient: "The evidence leaves this lead open",
  };
  const evidence = {
    consistent: "Both measurements have a clear direction over the same months, and their directions fit the prediction.",
    insufficient: "The trend tests do not give both measurements a clear, reliable direction over this period.",
  };
  const finding = verdict === "weakened" ? leadCounterEvidence(lead, fits) : evidence[verdict];
  const coverage = paired?.count
    ? `${dateSpan(paired.first, paired.last)} · ${paired.count} shared observations`
    : "No months with usable observations in both records.";
  const chartSlots = [lead.from, lead.to].map((code, index) => {
    const id = index === 0 ? "lead-chart-a" : "lead-chart-b";
    return `<div><h4>${escapeHTML(variable(code).name)}</h4><div id="${id}" class="chart"></div></div>`;
  }).join("");
  const rival = verdict === "weakened" ? ByteMeExperiments.rivalLead(lead, state.analysis.series) : null;
  const explanation = verdict === "weakened"
    ? `<div class="lead-rival">
        <h4>A rival explanation</h4>
        <p>${escapeHTML(lead.alternative)}</p>
        ${rival ? `<button type="button" class="pill" data-test-rival>Test rival with ${escapeHTML(variable(rival.to).name.toLowerCase())}</button>` : ""}
        <div data-rival-result aria-live="polite"></div>
        <p class="meta">${escapeHTML(lead.nextEvidence)}</p>
      </div>`
    : `<p>${escapeHTML(lead.alternative)}</p>`;
  panel.innerHTML = `<p>${escapeHTML(lead.prediction)}</p>
    <div class="experiment-finding">
      <h4 tabindex="-1">${headlines[verdict]}</h4>
      <p class="meta">${coverage}</p>
      ${paired?.count ? `<p>${verdict === "weakened" ? "<strong>Counter-evidence</strong> · " : ""}${escapeHTML(finding)}</p>` : ""}
      ${verdict === "weakened" ? "" : explanation}
    </div>
    ${verdict === "weakened" ? explanation : ""}
    ${fits.length ? `<div class="lead-charts">${chartSlots}</div>` : ""}`;
  if (rival) {
    panel.querySelector("[data-test-rival]").addEventListener("click", () =>
      renderRivalResult(panel.querySelector("[data-rival-result]"), rival, paired)
    );
  }
  if (!fits.length) return;
  [lead.from, lead.to].forEach((code, index) => {
    const v = variable(code), id = index === 0 ? "lead-chart-a" : "lead-chart-b";
    const series = { dates: paired.dates, values: paired.values[index] };
    const reference = { dates: state.fullRecord.series[code]?.dates, fit: state.fullRecord.results[code] };
    drawChart(id, fits[index], series, v, false, undefined, reference);
  });
}

function leadCounterEvidence(lead, fits) {
  const names = [variable(lead.from).name, lead.targetName ?? variable(lead.to).name];
  const [first, second] = names.map((name, index) => {
    const verb = fits[index].direction === "increase" ? "rose" : "fell";
    return `${name} ${verb}`;
  });
  const prediction = lead.expectedSign === 1 ? "the same direction" : "opposite directions";
  return `${first}, while ${second}. The prediction called for ${prediction}.`;
}

function renderRivalResult(panel, rival, originalPair) {
  const { paired, fits, verdict, componentFits } = ByteMeExperiments.assessRival(rival, originalPair, state.analysis.series);
  const findings = {
    consistent: "The trends fit this rival prediction. The mechanism still needs a more direct test.",
    weakened: "The trends also weaken this rival explanation.",
    insufficient: "The observations leave this rival explanation open.",
  };
  const evidence = verdict === "weakened" ? ` ${leadCounterEvidence(rival, fits)}` : "";
  const waterEvidence = componentFits?.every((fit) => Number.isFinite(fit.slope_per_decade))
    ? `<p>Change per decade over those months</p>
      <ul>
        <li>Precipitation ${num(componentFits[0].slope_per_decade)} mm/day</li>
        <li>Evaporation ${num(componentFits[1].slope_per_decade)} mm/day</li>
        <li>Precipitation minus evaporation ${num(fits[1].slope_per_decade)} mm/day</li>
        <li>Root-zone wetness ${num(fits[0].slope_per_decade)} percentage points</li>
      </ul>
      <p>Runoff, irrigation, and changes in water storage can still affect root-zone wetness.</p>`
    : "";
  panel.innerHTML = `<p>${escapeHTML(rival.prediction)}</p>
    <p><strong>${findings[verdict]}</strong>${escapeHTML(evidence)}</p>
    <p class="meta">${paired?.count ?? 0} of the original ${originalPair.count} observed months could be used.</p>
    ${waterEvidence}`;
}

// ------------------------------------------------------------------ charts
function chartAnomalies(r, s, reference) {
  if (r.verdict !== "insufficient" || !reference?.fit) return r.anomaly;
  const byMonth = new Map(reference.dates.map((date, i) => [monthText(date), reference.fit.anomaly[i]]));
  return s.dates.map((date, i) => Number.isFinite(s.values[i]) ? byMonth.get(monthText(date)) ?? null : null);
}

function drawChart(el, r, s, v, raw, yRange, reference) {
  if (typeof Plotly === "undefined") {
    $(el).textContent = "The chart library is unavailable.";
    return;
  }
  const x = s.dates.map((date) => `${monthText(date)}-01`);
  const neutral = !hasTrend(r);
  const colour = neutral ? COLOURS.deep : colourOf(r);
  const traces = raw
    ? [{ x, y: s.values, type: "scatter", mode: "lines", line: { color: "#7c7f86", width: 1.2 }, name: v.name, hovertemplate: "%{y:.3g} " + v.units + "<extra></extra>" }]
    : [
        { x, y: chartAnomalies(r, s, reference), type: "scatter", mode: r.verdict === "insufficient" ? "lines+markers" : "lines", line: { color: "#8fb3ae", width: 1 }, marker: { size: 3 }, name: "Monthly", hovertemplate: "%{y:.2g}<extra>monthly</extra>" },
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
// 2. Unavailable measurements (e.g. river discharge): "not_available" in variables.json.
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
  "measured measure model output report reports land air ground water sky plants plant").split(" "));

// Well-known regions that a place-name search doesn't find well
const REGIONS = [
  ["sahel", "Niamey, Sahel (Niger)", 13.5, 1.875], ["sahara", "Sahara (Algeria)", 24.0, 5.0],
  ["amazon", "Manaus, Amazon (Brazil)", -3.0, -60.0], ["arctic", "Svalbard (Arctic)", 78.25, 15.625],
  ["svalbard", "Svalbard (Arctic)", 78.25, 15.625], ["antarctica", "Antarctica (Vostok)", -78.5, 106.875],
  ["antarctic", "Antarctica (Vostok)", -78.5, 106.875], ["north pole", "North Pole", 89.5, 0],
  ["south pole", "South Pole", -89.5, 0], ["greenland", "Greenland ice sheet", 72.0, -40.0],
  ["himalaya", "Himalaya (Everest region)", 28.0, 86.875], ["siberia", "Siberia (Yakutsk)", 62.0, 129.375],
  ["alps", "Alps (Switzerland)", 46.5, 10.0], ["lake mead", "Lake Mead (USA)", 36.0, -114.375],
  ["aral sea", "Aral Sea", 45.0, 60.0], ["great barrier reef", "Great Barrier Reef (Australia)", -18.0, 147.5],
  ["pacific", "Pacific Ocean (equator)", 0, -140.0], ["atlantic", "Atlantic Ocean", 30.0, -40.0],
  ["indian ocean", "Indian Ocean", -10.0, 80.0], ["mediterranean", "Mediterranean Sea", 35.0, 18.125],
  ["gobi", "Gobi Desert (Mongolia)", 43.0, 105.0], ["congo", "Congo rainforest", 0, 21.25],
  ["outback", "Australian outback", -25.0, 133.75],
];

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
  const period = periodInQuestion(text);

  // 3) place: names with capital letters first ("Hoover Dam"), then the leftover words
  const capitals = (text.match(/[A-ZÀ-Ž][\p{L}'’.-]*(?:\s+(?:of|de|del|da|la|le|the)?\s*[A-ZÀ-Ž][\p{L}'’.-]*)*/gu) || [])
    .map((c) => c.replace(/['’]s\b/g, "").split(/\s+/))
    .map((ws) => { while (ws.length && FILLER.has(ws[0].toLowerCase())) ws.shift(); return ws.join(" "); })
    .map((c) => c.replace(/[.,;:!?]+$/, ""))
    .filter((c) => c.length >= 3 && !FILLER.has(c.toLowerCase()) && !VARS.some((v) => words(v.keywords).includes(c.toLowerCase())));
  const leftover = words(rest).filter((w) => !FILLER.has(w) && !/^\d/.test(w)).map((w) => w.replace(/'s$/, ""));
  return {
    variable, missing, period,
    placeCandidates: [...new Set([...capitals, leftover.join(" ")])].filter(Boolean),
    leftoverWords: leftover,
    asksWhy: tokens.includes("why") || tokens.includes("because") || tokens.includes("cause") || tokens.includes("causes"),
  };
}

// Look a name up in two free place-name services: Photon (OpenStreetMap: good for lakes, dams,
// islands, regions) and Open-Meteo (GeoNames: good for towns and cities). Photon's best answers first.
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
                 lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] });
  });
  ((meteo && meteo.results) || []).forEach((p) => found.push({
    name: [p.name, p.admin1 !== p.name ? p.admin1 : null, p.country !== p.name ? p.country : null].filter(Boolean).join(", "),
    lat: p.latitude, lon: p.longitude }));
  // drop repeats: same name, or practically the same spot
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name || (Math.abs(q.lat - p.lat) < 0.2 && Math.abs(q.lon - p.lon) < 0.2)) === i);
}

// Find places by name: "lat, lon" typed directly, our short list of famous regions, then the geocoders
async function findPlaces(text) {
  const direct = text.match(/^\s*(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)\s*$/);
  if (direct && Math.abs(+direct[1]) <= 90 && Math.abs(+direct[2]) <= 180) {
    return [{ name: null, label: coordText(+direct[1], +direct[2]), lat: +direct[1], lon: +direct[2] }];   // name is looked up after picking
  }
  const found = REGIONS.filter(([key]) => TEXT(text).includes(` ${key}`)).map(([, name, lat, lon]) => ({ name, lat, lon }));
  found.push(...(await geocode(text)));
  return found.filter((p, i) => found.findIndex((q) => q.name === p.name) === i).slice(0, 6);
}

// Places for a whole question: famous regions in it, then each candidate name, then single words
async function placesForQuestion(question, q) {
  const regions = REGIONS.filter(([key]) => TEXT(question).includes(` ${key}`)).map(([, name, lat, lon]) => ({ name, lat, lon }));
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
  let timer = null, ticket = 0, hits = [];
  const hide = () => (list.style.display = "none");
  const show = (html) => { list.innerHTML = html; list.style.display = "block"; };
  const run = async () => {
    const text = input.value.trim(), mine = ++ticket;
    if (!text) { hide(); return; }
    const q = withQuestions ? understand(text) : null;
    const notes = [];
    if (q && q.missing) notes.push(`<button disabled>${escapeHTML(q.missing.say)}<span class="why">${q.variable ? "Closest we have: " + q.variable.name : "Try another measurement"}</span></button>`);
    if (q && q.asksWhy) notes.push(`<button disabled>Open a result to test related measurements.<span class="why">The London experiment shows how a comparison can help test a cause.</span></button>`);
    if (q && !q.placeCandidates.length && !q.leftoverWords.length) {   // a question about a measurement only: answer it for the place on the map
      hits = q.variable ? [{ name: state.name, lat: state.lat, lon: state.lon, variable: q.variable }] : [];
    } else {
      show(`<button disabled>Searching places…</button>`);
      const places = q ? await placesForQuestion(text, q) : await findPlaces(text);
      if (mine !== ticket) return;   // the visitor kept typing
      hits = places.map((p) => ({ ...p, variable: q ? q.variable : null }));
    }
    if (q?.period) hits = hits.map((hit) => ({ ...hit, period: q.period }));
    const notesHTML = notes.join("");
    show(hits.length
      ? notesHTML + hits.map((h, i) => `<button data-i="${i}">${escapeHTML(h.name || h.label)}<span class="why">${h.variable ? h.variable.name + " · " : ""}${coordText(h.lat, h.lon)}${h.period ? " · " + escapeHTML([h.period.from || "Record start", h.period.to || "Record end"].join(" to ")) : ""}</span></button>`).join("")
      : notesHTML + `<button disabled>No place found. Try a city, country or region, or click the map<span class="why">Examples: Bucharest · Sahel · Great Barrier Reef · 44.4, 26.1</span></button>`);
    list.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { hide(); onPick(hits[+b.dataset.i]); }));
  };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 350); });
  input.addEventListener("focus", () => { if (input.value.trim()) run(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
    if (e.key === "Enter") { const first = list.querySelector("[data-i]"); if (first) first.click(); else { clearTimeout(timer); run(); } }
  });
  document.addEventListener("click", (e) => { if (e.target !== input && !list.contains(e.target)) hide(); });
}

function buildSearch() {
  placePicker($("search"), $("suggestions"), (hit) => selectPlace(hit.lat, hit.lon, hit.name, hit.variable?.code, true, hit.period ?? state.period), true);
}

// ------------------------------------------------------------------ compare two places
function buildCompare(groups) {
  $("cmp-var").innerHTML = optionsHTML(groups);
  $("cmp-var").value = compare.code;
  $("cmp-var").addEventListener("change", (e) => { compare.code = e.target.value; loadComparison(); });
  for (const side of COMPARE_SIDES) {
    $(`cmp-${side}`).value = compare[side].name;
    placePicker($(`cmp-${side}`), $(`cmp-${side}-list`), (hit) => {
      compare[side] = { name: hit.name || hit.label, lat: hit.lat, lon: hit.lon };
      $(`cmp-${side}`).value = compare[side].name;
      loadComparison();
    }, false);
  }
  $("cmp-use").addEventListener("click", () => useExploreInCompare(false));
  bindPeriod("compare-period", setComparePeriod);
  loadComparison();
}

function useExploreInCompare(scroll) {
  if (state.lat === null) return;
  compare.a = { name: state.name, lat: state.lat, lon: state.lon };
  compare.code = state.code;
  compare.period = state.period;
  $("cmp-a").value = state.name;
  $("cmp-var").value = state.code;
  loadComparison();
  if (scroll) {
    $("compare").scrollIntoView();
    $("cmp-b").focus({ preventScroll: true });
  }
}

function readCompareLink() {
  try {
    const saved = JSON.parse(new URLSearchParams(location.search).get("compare"));
    if (!saved || !variable(saved.code)) return null;
    const { a, b, code, period } = saved;
    if (![a, b].every((p) => p && typeof p.name === "string" && validPoint(p))) return null;
    return { a, b, code, period: periodOf(period?.from, period?.to) };
  } catch { return null; }
}

function comparisonLink() {
  const url = new URL(location.href);
  const { a, b, code, period } = compare;
  url.searchParams.set("compare", JSON.stringify({ a, b, code, period }));
  url.hash = "compare";
  return url.href;
}

function setComparePeriod(period) {
  compare.period = period;
  if (compare.records) renderCompare();
  else showPeriod("compare-period", period, null, "Reading the selected records…");
}

async function comparisonSeries({ lat, lon }, v) {
  if (v.dataset === "nasa") return nasaSeries(lat, lon, v.code);
  return toSeries((await powerAt(lat, lon))[v.code], v.scale || 1);
}

let compareTicket = 0;
async function loadComparison() {
  const measurement = variable(compare.code);
  const ticket = ++compareTicket;
  compare.records = null;
  showPeriod("compare-period", compare.period, null, "Reading the selected records…");
  $("compare-finding").innerHTML = `<p class="loading"><span class="spinner"></span>Finding months observed in both places…</p>`;
  for (const side of COMPARE_SIDES) {
    $(`cmp-panel-${side}`).innerHTML = `<span class="tag">${escapeHTML(compare[side].name)}</span>`;
  }
  const requests = await Promise.allSettled(COMPARE_SIDES.map((side) => comparisonSeries(compare[side], measurement)));
  if (ticket !== compareTicket) return;   // the user changed a place or the measurement
  const [a, b] = requests;
  const full = matchMonths(a.value, b.value);
  compare.records = { requests, full, fullFit: fitComparison(full, measurement.percent) };
  renderCompare();
}

function belowSourceFloor(values, v) {
  if (v.low_level === undefined) return false;
  const present = values.filter(Number.isFinite);
  return present.length > 0 && present.reduce((sum, value) => sum + value, 0) / present.length < v.low_level;
}

function describeComparison(fit, lowSignal, units, aName, bName) {
  if (!fit || fit.slope === null) return ["Too little shared data for a trend comparison",
    "A comparison requires at least 24 shared observations spanning 10 years."];
  const rate = `The estimated rate at A minus the rate at B is ${num(fit.slope)} ${units} per decade.`;
  if (lowSignal) return ["The difference is hard to assess at these levels", rate + " The measurement is near its detection limit in at least one place."];
  if (!fit.interval) return ["The difference is uncertain", rate + " There are too few effectively independent months to quote an interval."];
  const [low, high] = fit.interval;
  const range = `${rate} Approximate 95% interval ${num(low)} to ${num(high)} ${units} per decade.`;
  if (low <= 0 && high >= 0) return ["The rates could be the same", range];
  const higher = low > 0 ? aName : bName;
  const lower = low > 0 ? bName : aName;
  const [a, b] = fit.sides;
  if ([a, b].every((r) => r.verdict === "significant" && r.reliability !== "low")) {
    if (a.direction !== b.direction) return [`Rising near ${higher} and falling near ${lower}`, range];
    if (a.direction === "increase") return [`Rising faster near ${higher}`, range];
    if (a.direction === "decrease") return [`Falling faster near ${lower}`, range];
  }
  return [`The rate is higher near ${higher}`, range];
}

function renderCompare() {
  const { requests, full, fullFit } = compare.records;
  const measurement = variable(compare.code);
  const [a, b] = requests;
  const selected = compare.period ? matchMonths(a.value, b.value, compare.period) : full;
  const fit = compare.period ? fitComparison(selected, measurement.percent) : fullFit;
  const coverage = full?.count
    ? `Shared record · ${dateSpan(full.first, full.last)} · ${full.count} months observed in both places`
    : "No shared record available.";
  showPeriod("compare-period", compare.period, full?.count ? full : null, coverage);
  renderComparisonFinding(measurement, selected, fit);
  renderComparisonCharts(measurement, selected, fit);
}

function renderComparisonFinding(measurement, selected, fit) {
  const { requests, full, fullFit } = compare.records;
  const el = $("compare-finding"), units = measurement.units;
  const requestFailed = requests.some((record) => record.status === "rejected");
  const lowSignal = selected?.values.some((values) => belowSourceFloor(values, measurement));
  let headline, detail;
  if (requestFailed) {
    headline = "A data request failed";
    detail = "Retry the request or choose another measurement.";
  } else if (!selected?.count) {
    headline = "No months observed in both places";
    detail = full?.count ? "Choose another period or use the shared record." : "Try another place or measurement.";
  } else {
    [headline, detail] = describeComparison(fit, lowSignal, units, compare.a.name, compare.b.name);
  }

  const narrowed = compare.period && full?.count && (selected?.count ?? 0) !== full.count;
  const recent = !compare.period && full?.count
    ? recentPeriod(full.first, full.last, RECENT_COMPARISON_YEARS)
    : null;
  const lead = narrowed ? "Recheck the shared record" : recent ? `Check the latest ${RECENT_COMPARISON_YEARS} years` : "";
  const fullDifference = narrowed && fullFit && fullFit.slope !== null
    ? `<p class="meta">Full shared record · A minus B ${num(fullFit.slope)} ${units} per decade</p>` : "";
  const selectedCoverage = selected?.count
    ? `<p class="meta">${measurement.source} · ${dateSpan(selected.first, selected.last)} · ${selected.count} of ${selected.dates.length} months observed in both places</p>`
    : "";
  el.innerHTML = `<h3>${escapeHTML(headline)}</h3><p>${detail}</p>
    ${selectedCoverage}
    ${fullDifference}
    ${fit?.interval && !lowSignal ? `<details><summary>How was the difference estimated?</summary><p>We subtract B from A in each shared month, remove the seasonal cycle, then fit a line. The interval uses a Newey–West adjustment with 12 calendar-month lags.</p></details>` : ""}
    <div class="compare-actions">
      ${lead ? `<button type="button" class="pill on" data-next-period>${lead}</button>` : ""}
      ${requestFailed ? `<button type="button" class="pill" data-retry>Retry</button>` : ""}
      <a class="pill" href="${escapeHTML(comparisonLink())}">Share comparison</a>
    </div>`;
  el.querySelector("[data-next-period]")?.addEventListener("click", () => setComparePeriod(narrowed ? null : recent));
  el.querySelector("[data-retry]")?.addEventListener("click", loadComparison);
}

function renderComparisonCharts(measurement, selected, fit) {
  const { requests, full, fullFit } = compare.records;
  const plots = fit ? fit.sides.map((result, index) => {
    const series = { dates: selected.dates, values: selected.values[index] };
    const reference = { dates: full.dates, fit: fullFit?.sides[index] };
    return { result, series, reference };
  }) : [];
  const values = plots.flatMap(({ result, series, reference }) => [
    ...chartAnomalies(result, series, reference), ...result.band_low, ...result.band_high,
  ]).filter(Number.isFinite);
  const low = Math.min(...values), high = Math.max(...values);
  const yRange = low < high ? [low, high] : undefined;
  COMPARE_SIDES.forEach((side, index) => {
    const panel = $(`cmp-panel-${side}`), id = `cmp-panel-${side}-chart`;
    const header = `<span class="tag">${side.toUpperCase()} · ${escapeHTML(compare[side].name)}</span>`;
    if (!plots[index]) {
      const record = requests[index];
      let message = "No data for this measurement here.";
      if (record.status === "rejected") message = "Couldn’t load this record.";
      else if (record.value) message = "No shared observations in this period.";
      panel.innerHTML = header + `<p>${message}</p>`;
      return;
    }
    const { result, series, reference } = plots[index];
    let summary = "Monthly departures from the seasonal baseline of the full shared record.";
    let rate = "";
    if (result.verdict !== "insufficient") {
      rate = `<h3>${num(result.slope_per_decade)} ${measurement.units} per decade</h3>`;
      summary = belowSourceFloor(series.values, measurement)
        ? "Near the measurement’s detection limit."
        : `${verdictText(result)} · 95% interval ${num(result.ci_low)} to ${num(result.ci_high)}`;
    }
    panel.innerHTML = header + rate + `<p>${summary}</p><div class="chart" id="${id}"></div>`;
    drawChart(id, result, series, measurement, false, yRange, reference);
  });
}
