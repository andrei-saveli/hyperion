// ByteMe website: map, results, search and compare.
// All numbers come from data/results.json, which build_data.py makes with the project's real
// Python code (stats.py, explain.py). This file only displays them; it computes no statistics.

const COLOURS = { up: "#ec7a6a", down: "#2d8bb5", neutral: "#b2bcb8", ink: "#141a19", deep: "#0e5e63" };
const VERDICT_TEXT = {
  significant: (dir) => `Significant ${dir}`,
  possible: (dir) => `Possible ${dir} · not significant yet`,
  none: () => "No clear trend yet",
  insufficient: () => "Not enough data",
};
const SOURCE_NAME = { TEMP: "MERRA-2", RAIN: "GPM IMERG", SOILM: "GLDAS", EVAP: "GLDAS" };
const STOP = new Set("is are the a an of in on at to and or does do did it its getting get more less than there any how what which where has have been".split(" "));

let DATA, LAND, map, state = { place: "lake_mead", code: "TEMP", raw: false };
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ small helpers
function num(v, signed = true) {
  if (v === null || v === undefined || Number.isNaN(v)) return "–";
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toString() : Number(v.toPrecision(2)).toString();
  const text = signed && v > 0 ? "+" + rounded : rounded;
  return text.replace("-", "−");
}
const pText = (p) => (p === null || p === undefined ? "–" : p < 0.001 ? "< 0.001" : p.toFixed(3));
const place = (id) => DATA.places.find((p) => p.id === id);
const variable = (code) => DATA.variables.find((v) => v.code === code);
const result = (id, code) => DATA.results[`${id}_${code}`];

function colourOf(r) {
  if (!r || r.verdict === "none" || r.verdict === "insufficient") return COLOURS.neutral;
  return r.direction === "decrease" ? COLOURS.down : COLOURS.up;
}
function verdictText(r) {
  if (!r) return "No data";
  return VERDICT_TEXT[r.verdict](r.direction === "decrease" ? "decrease" : "increase");
}
function dotHTML(r) {
  const hatched = !r || r.verdict === "none" || r.verdict === "insufficient";
  const style = hatched ? `background:repeating-linear-gradient(45deg,${COLOURS.neutral} 0 2px,#fff 2px 5px)`
                        : `background:${colourOf(r)};opacity:${r.verdict === "possible" ? 0.55 : 1}`;
  return `<span class="dot" style="${style}"></span>`;
}

// ------------------------------------------------------------------ start
Promise.all([fetch("data/results.json").then((r) => r.json()), fetch("data/land.geojson").then((r) => r.json())])
  .then(([data, landShape]) => {
  DATA = data;
  LAND = landShape;
  $("built").textContent = `Results built ${data.built}`;
  const [slug, code] = location.hash.slice(1).split("--");
  const id = (slug || "").replace(/-/g, "_");
  if (place(id) && variable(code)) Object.assign(state, { place: id, code });
  buildVariablePills();
  buildMap();
  buildSearch();
  buildCompare();
  document.querySelectorAll("[data-place]").forEach((b) =>
    b.addEventListener("click", () => {
      select(b.dataset.place, b.dataset.code, true);
      $("explore").scrollIntoView({ behavior: "smooth" });
    }));
  renderPanel();
});

// ------------------------------------------------------------------ variable pills
function buildVariablePills() {
  $("vars").innerHTML = DATA.variables.map((v) =>
    `<button class="pill" data-code="${v.code}">${v.name}</button>`).join("");
  $("vars").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => select(state.place, b.dataset.code, false)));
  markPills();
}
function markPills() {
  $("vars").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.code === state.code));
}

// ------------------------------------------------------------------ map
function regionFeatures() {
  return {
    type: "FeatureCollection",
    features: DATA.places.map((p) => {
      const r = result(p.id, state.code);
      const hatched = !r || r.verdict === "none" || r.verdict === "insufficient";
      return {
        type: "Feature",
        properties: { id: p.id, colour: colourOf(r), opacity: hatched ? 0.25 : r.verdict === "possible" ? 0.35 : 0.6 },
        geometry: { type: "Polygon", coordinates: [[[p.west, p.south], [p.east, p.south], [p.east, p.north], [p.west, p.north], [p.west, p.south]]] },
      };
    }),
  };
}

const markers = {};
function buildMap() {
  map = new maplibregl.Map({
    container: "map",
    // Our own minimal base map: a land outline shipped with the site (data/land.geojson, Natural
    // Earth, public domain). No outside tile server, so the map always works in a live demo.
    style: {
      version: 8,
      sources: { land: { type: "geojson", data: LAND, attribution: "Natural Earth" } },
      layers: [
        { id: "ocean", type: "background", paint: { "background-color": "#d9f0ef" } },
        { id: "land", type: "fill", source: "land", paint: { "fill-color": "#fbfdfb" } },
        { id: "coast", type: "line", source: "land", paint: { "line-color": "#7fb9b1", "line-width": 0.7 } },
      ],
    },
    renderWorldCopies: false,
    center: [0, 30], zoom: 0.9, minZoom: 0.5, maxZoom: 9,
    attributionControl: { compact: true },
    dragRotate: false, pitchWithRotate: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => {
    map.addSource("regions", { type: "geojson", data: regionFeatures() });
    map.addLayer({ id: "region-fill", type: "fill", source: "regions",
      paint: { "fill-color": ["get", "colour"], "fill-opacity": ["get", "opacity"] } });
    map.addLayer({ id: "region-line", type: "line", source: "regions",
      paint: { "line-color": COLOURS.ink, "line-width": 1.2 } });
    map.on("click", "region-fill", (e) => select(e.features[0].properties.id, state.code, true));
    map.on("mouseenter", "region-fill", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "region-fill", () => (map.getCanvas().style.cursor = ""));
    DATA.places.forEach((p) => {
      const el = document.createElement("div");
      el.className = "marker";
      el.addEventListener("click", () => select(p.id, state.code, true));
      markers[p.id] = { el, marker: new maplibregl.Marker({ element: el, anchor: "left" }).setLngLat([p.lon, p.lat]).addTo(map) };
    });
    refreshMap();
    if (location.hash) flyTo(state.place); else worldView(0);
  });
  map.on("move", placeBrackets);
  $("world").addEventListener("click", worldView);
}

function refreshMap() {
  if (!map || !map.getSource("regions")) return;
  map.getSource("regions").setData(regionFeatures());
  DATA.places.forEach((p) => {
    const r = result(p.id, state.code);
    const m = markers[p.id];
    m.el.className = "marker" + (p.id === state.place ? " selected" : "");
    m.el.innerHTML = `${dotHTML(r)}<span class="name">${p.name}</span>`;
    m.el.title = `${p.name}: ${verdictText(r)}`;
  });
  placeBrackets();
}

// Zoom out to show every region (with room for the labels on the right)
function worldView(duration = 1200) {
  const lons = DATA.places.flatMap((p) => [p.west, p.east]), lats = DATA.places.flatMap((p) => [p.south, p.north]);
  map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding: { top: 70, bottom: 130, left: 50, right: 190 }, maxZoom: 3, duration });
}

function flyTo(id) {
  const p = place(id);
  map.fitBounds([[p.west, p.south], [p.east, p.north]], { padding: 140, maxZoom: 5.5, duration: 1200 });
}

// focus brackets: four corners drawn around the selected region's box
function placeBrackets() {
  const b = $("brackets");
  const p = place(state.place);
  if (!map || !p) return;
  const nw = map.project([p.west, p.north]), se = map.project([p.east, p.south]);
  const pad = 12, minSize = 46;
  let x = nw.x - pad, y = nw.y - pad, w = se.x - nw.x + 2 * pad, h = se.y - nw.y + 2 * pad;
  if (w < minSize) { x -= (minSize - w) / 2; w = minSize; }
  if (h < minSize) { y -= (minSize - h) / 2; h = minSize; }
  Object.assign(b.style, { display: "block", left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
}

// ------------------------------------------------------------------ selection
function select(id, code, fly) {
  state.place = id; state.code = code;
  try { history.replaceState(null, "", `#${id.replace(/_/g, "-")}--${code}`); } catch (e) { /* links still work without it */ }
  markPills(); refreshMap(); renderPanel();
  if (fly && map) flyTo(id);
}

// ------------------------------------------------------------------ result panel
function renderPanel() {
  const p = place(state.place), v = variable(state.code), r = result(state.place, state.code);
  const panel = $("panel");
  if (!r) { panel.innerHTML = `<span class="tag">${p.name}</span><h3>No data for ${v.name.toLowerCase()} here yet.</h3>`; return; }
  const period = r.start ? `${r.start.slice(0, 4)}–${r.end.slice(0, 4)}` : "";
  const total = num(r.total_change) + ` <small>${v.units}</small>` +
    (r.percent_change !== null ? ` <small>(${num(r.percent_change)}%)</small>` : "");
  const notes = [];
  if (r.reliability === "low" && r.reliability_note) notes.push(`<div class="note warn"><b>Caution</b><span>${r.reliability_note}</span></div>`);
  if (r.tests_agree === false && r.tests_note) notes.push(`<div class="note warn"><b>Caution</b><span>${r.tests_note}</span></div>`);
  if (r.years_to_significance !== null) notes.push(`<div class="note time"><b>Estimate</b><span>About <strong>${r.years_to_significance} more years</strong> of data would make this trend significant, if the trend and the noise stay the same. Not a forecast.</span></div>`);

  panel.innerHTML = `
    <div>
      <span class="tag">${p.name} · ${v.name}</span>
      <p class="muted" style="margin:10px 0 0;font:400 11px/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase">
        ${SOURCE_NAME[v.code] || ""} · ${v.source} · ${period} · Monthly · Area average</p>
    </div>
    <h3>${r.explain.headline}</h3>
    <div class="verdict">${dotHTML(r)}${verdictText(r)}${r.tests_agree ? " · both tests agree" : ""}</div>
    <p style="margin:0;font-size:15px"><strong style="font-weight:500">${v.name}:</strong> ${v.definition}</p>
    ${r.verdict === "insufficient" ? "" : `
    <div class="numbers">
      <div><div class="label">Change per decade</div><div class="value">${num(r.slope_per_decade)} <small>${v.units}</small></div></div>
      <div><div class="label">Total since ${period.slice(0, 4)}</div><div class="value">${total}</div></div>
      <div><div class="label">Likely range (95%)</div><div class="value">${num(r.ci_low)} to ${num(r.ci_high)}</div></div>
      <div><div class="label">p-value</div><div class="value">${pText(r.p_value)}</div></div>
    </div>`}
    ${notes.join("")}
    <div class="chart-head">
      <span class="tag plain">Monthly record</span>
      <div class="toggle">
        <button class="pill ${state.raw ? "" : "on"}" data-raw="0">Seasons removed</button>
        <button class="pill ${state.raw ? "on" : ""}" data-raw="1">Raw monthly</button>
      </div>
    </div>
    <div class="chart" id="chart"></div>
    <p class="caption">${state.raw ? "Raw monthly values, including the seasonal swing. Switch to “Seasons removed” to see the trend."
      : "Grey: monthly values with the seasons removed. Line: the straight-line trend. " + (r.band_meaning || "")}</p>
    <details><summary>What does this mean?</summary><p>${r.explain.details}</p><p class="muted">${r.explain.caveat}</p></details>
    <details><summary>Data and method</summary><ul>
      <li>NASA Giovanni area-averaged time series, <code>${v.source}</code> (${v.units}), over the box W ${p.west}, S ${p.south}, E ${p.east}, N ${p.north}.</li>
      <li>${r.start} to ${r.end} · ${r.n_months} months · ${r.n_missing} missing.</li>
      <li>${r.method}</li>
      <li>Seasonal Mann-Kendall p-value: ${pText(r.mk_p_value)} · Sen's slope: ${num(r.sen_slope_per_decade)} ${v.units} per decade.</li>
    </ul></details>`;
  panel.querySelectorAll("[data-raw]").forEach((b) => b.addEventListener("click", () => {
    state.raw = b.dataset.raw === "1"; renderPanel();
  }));
  drawChart("chart", r, v, state.raw);
}

// ------------------------------------------------------------------ charts
function drawChart(el, r, v, raw, yRange) {
  const x = DATA.dates.map((d) => d + "-01");
  const neutral = colourOf(r) === COLOURS.neutral;
  const colour = neutral ? COLOURS.deep : colourOf(r);
  const traces = raw
    ? [{ x, y: r.value, type: "scatter", mode: "lines", line: { color: "#7c7f86", width: 1.2 }, name: v.name, hovertemplate: "%{y:.3g} " + v.units + "<extra></extra>" }]
    : [
        { x, y: r.anomaly, type: "scatter", mode: "lines", line: { color: "#8fb3ae", width: 1 }, name: "Monthly", hovertemplate: "%{y:.2g}<extra>monthly</extra>" },
        ...(r.trend[0] === null ? [] : [
          { x, y: r.band_high, type: "scatter", mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
          { x, y: r.band_low, type: "scatter", mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: hexA(colour, neutral ? 0.08 : 0.22), hoverinfo: "skip", showlegend: false },
          { x, y: r.trend, type: "scatter", mode: "lines", line: { color: colour, width: 3 }, name: "Trend", hovertemplate: "%{y:.2g}<extra>trend</extra>" },
        ]),
      ];
  Plotly.react(el, traces, {
    margin: { l: 48, r: 8, t: 6, b: 30 }, showlegend: false, hovermode: "x unified",
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Geist, Arial, sans-serif", size: 12, color: "#161616" },
    xaxis: { gridcolor: "rgba(22,22,22,.08)", linecolor: "#161616", tickfont: { family: "Geist Mono, monospace", size: 11 } },
    yaxis: { gridcolor: "rgba(22,22,22,.08)", zerolinecolor: "rgba(22,22,22,.35)", range: yRange,
             title: { text: raw ? v.units : `vs usual month (${v.units})`, font: { size: 11, family: "Geist Mono, monospace" } },
             tickfont: { family: "Geist Mono, monospace", size: 11 } },
  }, { displayModeBar: false, responsive: true });
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ search (simple keyword matching)
function words(text) { return (text || "").toLowerCase().match(/[a-z0-9]+/g) || []; }
function matches(token, word) {
  return token === word || (word.length >= 4 && token.startsWith(word)) || (token.length >= 4 && word.startsWith(token));
}
function search(text) {
  const tokens = words(text).filter((t) => !STOP.has(t));
  if (!tokens.length) return [];
  const out = [];
  for (const p of DATA.places) for (const v of DATA.variables) {
    if (!result(p.id, v.code)) continue;
    let score = 0; const why = new Set(); let varHit = false, placeHit = false;
    for (const t of tokens) {
      if (words(v.name).some((w) => matches(t, w)) || t === v.code.toLowerCase()) { score += 4; why.add(t); varHit = true; }
      else if (words(v.keywords).some((w) => matches(t, w))) { score += 2; why.add(t); varHit = true; }
      if (words(p.name).some((w) => matches(t, w))) { score += 4; why.add(t); placeHit = true; }
      else if (words(p.type).some((w) => matches(t, w))) { score += 3; why.add(t); placeHit = true; }
      else if (words(p.story).some((w) => matches(t, w)) && t.length > 3) { score += 1; }
    }
    if (score > 0 && (varHit || placeHit)) out.push({ p, v, score: score + (varHit && placeHit ? 3 : 0), why: [...why] });
  }
  return out.sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id)).slice(0, 5);
}
function buildSearch() {
  const box = $("suggestions"), input = $("search");
  const show = () => {
    const hits = search(input.value);
    if (!input.value.trim()) { box.style.display = "none"; return; }
    box.innerHTML = hits.length
      ? hits.map((h, i) => `<button data-i="${i}">${h.v.name} · ${h.p.name}<span class="why">${verdictText(result(h.p.id, h.v.code))} · matched: ${h.why.join(", ")}</span></button>`).join("")
      : `<button disabled>No match yet. Try a place (desert, Arctic, Sahel) or a measurement (rain, heat, soil)<span class="why">Our regions: Lake Mead · Niamey · Svalbard</span></button>`;
    box.style.display = "block";
    box.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
      const h = hits[+b.dataset.i]; select(h.p.id, h.v.code, true); box.style.display = "none";
    }));
  };
  input.addEventListener("input", show);
  input.addEventListener("focus", show);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") box.querySelector("[data-i]")?.click(); if (e.key === "Escape") box.style.display = "none"; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) box.style.display = "none"; });
}

// ------------------------------------------------------------------ compare
function buildCompare() {
  const opt = (items, val, label) => items.map((i) => `<option value="${i[val]}">${i[label]}</option>`).join("");
  $("cmp-var").innerHTML = opt(DATA.variables, "code", "name");
  $("cmp-a").innerHTML = $("cmp-b").innerHTML = opt(DATA.places, "id", "name");
  $("cmp-a").value = "lake_mead"; $("cmp-b").value = "niamey";
  ["cmp-var", "cmp-a", "cmp-b"].forEach((id) => $(id).addEventListener("change", renderCompare));
  renderCompare();
}
function renderCompare() {
  const v = variable($("cmp-var").value);
  const ids = [$("cmp-a").value, $("cmp-b").value];
  const rs = ids.map((id) => result(id, v.code));
  const all = rs.filter(Boolean).flatMap((r) => [...r.anomaly, ...r.band_low, ...r.band_high]).filter((x) => x !== null);
  const yRange = all.length ? [Math.min(...all), Math.max(...all)] : undefined;
  ["cmp-panel-a", "cmp-panel-b"].forEach((panelId, i) => {
    const p = place(ids[i]), r = rs[i], el = $(panelId);
    if (!r) { el.innerHTML = `<span class="tag">${p.name}</span><h3>No data yet.</h3>`; return; }
    el.innerHTML = `<span class="tag">${p.name}</span>
      <h3>${num(r.slope_per_decade)} ${v.units} per decade</h3>
      <div class="verdict">${dotHTML(r)}${verdictText(r)}</div>
      <div class="chart" id="${panelId}-chart"></div>
      <p class="caption">Total since ${r.start.slice(0, 4)}: ${num(r.total_change)} ${v.units}${r.percent_change !== null ? ` (${num(r.percent_change)}%)` : ""} · p-value ${pText(r.p_value)}</p>`;
    drawChart(`${panelId}-chart`, r, v, false, yRange);
  });
}
