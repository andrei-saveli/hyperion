// ByteMe system design deck (English slides, Romanian speaker notes)
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/root/.claude/skills/synced/c2e77c29-75f7-4151-ba3a-b791a9815eb6_8d7f750a-106f-45aa-983e-52a3b2d14106/pptx/scripts/apply_theme.js");
const NOTES = require("./notes.js");

const THEME = {
  name: "ByteMe",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "141A19", lt1: "FFFFFF", dk2: "0E5E63", lt2: "F3F6F3",
    accent1: "19A99A", accent2: "D6F5DF", accent3: "EC7A6A", accent4: "2D8BB5",
    accent5: "D3F0F2", accent6: "5F6B68", hlink: "0E5E63", folHlink: "5F6B68",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "ByteMe system design";
pres.author = "Byte Me Analytics";
const C = pres.SchemeColor;
const S = pres.shapes;
const W = 13.333;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.2, w: 11.7, h: 1.6, fontSize: 54, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.0, w: 11.7, h: 1.4, fontSize: 22, color: C.accent2, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.85, fontSize: 34, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "B/ ByteMe  ·  System design", options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
});

// ---------- helpers ----------
let n = 0;
function box(slide, o) {
  // rounded box with a bold title line and an optional smaller second part
  const runs = [{ text: o.title, options: { bold: true, fontSize: o.ts || 14, color: o.tc || C.text1, breakLine: !!o.sub } }];
  if (o.sub) runs.push({ text: o.sub, options: { fontSize: o.ss || 11, color: o.sc || o.tc || C.text1 } });
  slide.addText(runs, {
    shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x: o.x, y: o.y, w: o.w, h: o.h,
    fill: { color: o.fill || C.background2, transparency: o.tr || 0 },
    line: o.line ? { color: o.line, width: 1.25 } : { type: "none" },
    align: o.align || "left", valign: o.valign || "middle", margin: o.m ?? 8,
    paraSpaceAfter: 2, objectName: "box" + ++n,
  });
}
function arrow(slide, x1, y1, x2, y2, o = {}) {
  slide.addShape(S.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color || C.accent6, width: o.wd || 1.75, endArrowType: o.noEnd ? undefined : "triangle", beginArrowType: o.both ? "triangle" : undefined },
    objectName: "arrow" + ++n,
  });
}
function label(slide, text, x, y, w, o = {}) {
  slide.addText(text, { x, y, w, h: o.h || 0.35, fontSize: o.fs || 12, bold: o.bold ?? true, color: o.color || C.accent6, margin: 0, isTextBox: true, align: o.align || "left", valign: o.valign || "middle", italic: o.italic, objectName: "label" + ++n });
}
function dot(slide, x, y, d, color) {
  slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" }, objectName: "dot" + ++n });
}
function numChip(slide, num, x, y, d = 0.42) {
  slide.addText(String(num), { shape: S.OVAL, x, y, w: d, h: d, fill: { color: C.text2 }, line: { type: "none" }, color: C.background1, bold: true, fontSize: 14, align: "center", valign: "middle", margin: 0, objectName: "num" + ++n });
}
function content(section, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}

// =====================================================================
// 1. Title
pres.addSection({ title: "Overview" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Overview" });
  s.addText("B/  ByteMe", { placeholder: "title" });
  s.addText([
    { text: "System design of an Earth trend detective", options: { breakLine: true } },
    { text: "Team Byte Me Analytics  ·  NASA Space Apps Challenge 2026", options: { fontSize: 16, color: C.accent5 } },
  ], { placeholder: "body" });
  // pixel motif: a small block of "satellite pixels"
  const cols = [C.accent1, C.accent5, C.accent2, C.accent1, C.accent3];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    if ((r * 7 + c * 3) % 5 === 0) continue;
    s.addShape(S.RECTANGLE, { x: 10.2 + c * 0.38, y: 0.7 + r * 0.38, w: 0.3, h: 0.3, fill: { color: cols[(r + c) % 5], transparency: (r + c) % 3 * 25 }, line: { type: "none" }, objectName: "pixel" + ++n });
  }
  s.addNotes(NOTES[1]);
}

// 2. User journey
{
  const s = content("Overview", "One question in, four answers out");
  const steps = [
    ["Ask", "Type a place or a question, or click the map"],
    ["Locate", "Find the place: a point, a country or a river"],
    ["Fetch", "Get monthly NASA records for that spot"],
    ["Test", "Remove seasons, fit a trend, test significance"],
    ["Explain", "Plain verdict, chart and numbers with units"],
  ];
  const w = 2.2, g = 0.275, y = 1.6;
  steps.forEach(([t, d], i) => {
    const x = 0.6 + i * (w + g);
    box(s, { x, y, w, h: 1.75, title: t, sub: d, ts: 18, ss: 12, fill: i === 4 ? C.accent2 : C.background2, valign: "top", m: [52, 10, 8, 10] });
    numChip(s, i + 1, x + 0.12, y + 0.14);
    if (i < 4) arrow(s, x + w + 0.03, y + 0.875, x + w + g - 0.03, y + 0.875, { color: C.accent1 });
  });
  label(s, "EXAMPLE", 0.6, 4.0, 3);
  box(s, { x: 0.6, y: 4.4, w: 4.6, h: 1.6, title: "“Is Romania getting warmer?”", ts: 20, fill: C.accent5, align: "center" });
  arrow(s, 5.35, 5.2, 6.15, 5.2, { color: C.accent1, wd: 2.5 });
  s.addText([
    { text: "Yes. ", options: { bold: true, color: C.text2, fontSize: 20 } },
    { text: "Air temperature in Romania is rising:", options: { fontSize: 16, breakLine: true } },
    { text: "+0.57 °C per decade since 1981", options: { bold: true, fontSize: 22, color: C.text1, breakLine: true } },
    { text: "Significant · 95% interval and p-value shown · chart with trend line", options: { fontSize: 12, color: C.accent6 } },
  ], { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x: 6.3, y: 4.4, w: 6.4, h: 1.6, fill: { color: C.background2 }, line: { color: C.accent1, width: 1.5 }, margin: 12, valign: "middle", objectName: "answer" });
  label(s, "What changed, where, how much and how sure. Never why.", 0.6, 6.35, 12.1, { fs: 16, color: C.text2, italic: true, bold: false });
  s.addNotes(NOTES[2]);
}

// 3. System context
{
  const s = content("Overview", "System at a glance");
  const colW = 3.6, L = 0.6, M = 4.87, R = 9.1;
  label(s, "PREPARED ONCE · OFFLINE · PYTHON", L, 1.3, colW, { fs: 11 });
  label(s, "RUNS IN THE VISITOR'S BROWSER", M, 1.3, colW, { fs: 11 });
  label(s, "ASKED LIVE · NO LOGIN", R, 1.3, colW, { fs: 11 });

  box(s, { x: L, y: 1.75, w: colW, h: 1.2, title: "NASA Earthdata", sub: "GPM, GLDAS, MODIS, OMI, AIRS via CMR + OPeNDAP (token needed)" });
  box(s, { x: L, y: 3.35, w: colW, h: 1.2, title: "Build scripts", sub: "build_nasa_grids.py, build_world.py, the tested Task4/stats.py" });
  box(s, { x: L, y: 4.95, w: colW, h: 1.3, title: "Static data files", sub: "1° NASA tiles (8 measurements), world trend map, search index + language model", fill: C.accent2 });
  arrow(s, L + colW / 2, 2.98, L + colW / 2, 3.32);
  arrow(s, L + colW / 2, 4.58, L + colW / 2, 4.92);

  s.addText([
    { text: "ByteMe static site", options: { bold: true, fontSize: 18, color: C.background1, breakLine: true } },
    { text: "HTML · CSS · JavaScript, no server code", options: { fontSize: 12, color: C.accent5, breakLine: true } },
    { text: " ", options: { fontSize: 8, breakLine: true } },
    { text: "Search  ·  Place lookup", options: { fontSize: 14, color: C.background1, breakLine: true } },
    { text: "Data access  ·  Area averages", options: { fontSize: 14, color: C.background1, breakLine: true } },
    { text: "Trend engine (stats.js)", options: { fontSize: 14, color: C.background1, breakLine: true } },
    { text: "Map  ·  Charts  ·  Investigate", options: { fontSize: 14, color: C.background1 } },
  ], { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x: M, y: 1.75, w: colW, h: 2.8, fill: { color: C.text2 }, line: { type: "none" }, margin: 14, valign: "middle", objectName: "browser" });
  box(s, { x: M, y: 4.95, w: colW, h: 1.3, title: "Static hosting", sub: "Any free host (Space Apps domain, GitHub Pages). Upload one folder", line: C.text2, fill: C.background1 });
  arrow(s, L + colW + 0.04, 5.6, M - 0.04, 5.6);
  arrow(s, M + colW / 2, 4.92, M + colW / 2, 4.58);

  const rh = 0.82, ys = [1.75, 2.74, 3.73];
  box(s, { x: R, y: ys[0], w: colW, h: rh, title: "NASA POWER API", sub: "monthly since 1981, 18 measurements, any ~50 km square", ss: 11 });
  box(s, { x: R, y: ys[1], w: colW, h: rh, title: "Place names and outlines", sub: "Photon, Open-Meteo, Nominatim (OpenStreetMap)", ss: 11 });
  box(s, { x: R, y: ys[2], w: colW, h: rh, title: "Map tiles and libraries", sub: "OpenFreeMap, jsDelivr (MapLibre, Plotly), Google Fonts", ss: 11 });
  ys.forEach((y) => arrow(s, M + colW + 0.04, y + rh / 2, R - 0.04, y + rh / 2, { both: true, color: C.accent1 }));
  box(s, { x: R, y: 4.95, w: colW, h: 1.3, title: "If a live service fails", sub: "built-in land map, keyword search without the model, a clear message instead of a blank page", fill: C.background1, line: C.accent3, ss: 11 });
  s.addNotes(NOTES[3]);
}

// 4. Module map
pres.addSection({ title: "Implementation" });
{
  const s = content("Implementation", "Inside the browser: five layers");
  const rows = [
    ["Interface", [["index.html", "page structure"], ["style.css", "look, phone layout"], ["app.js", "wires every part together"]]],
    ["Search", [["Keyword rules", "variables.json: 26 measurements"], ["meaning.js", "sentence model in the browser"], ["Place lookup", "coordinates, regions, geocoders"]]],
    ["Data", [["NASA POWER client", "live monthly records"], ["nasa.js", "reads 1° satellite tiles"], ["area.js", "country and river averages"]]],
    ["Analysis", [["stats.js", "trend + significance"], ["investigation.js", "time periods"], ["decompose.js", "possible drivers"], ["similar.js", "look-alike places"]]],
    ["Visuals", [["MapLibre", "map + trend squares"], ["Plotly", "charts with 95% band"], ["globe.js", "pixel-globe hero"]]],
  ];
  const y0 = 1.45, h = 0.92, g = 0.13, lw = 2.0, cx = 0.6 + lw + 0.2, cw = 2.33, cg = 0.135;
  rows.forEach(([name, chips], r) => {
    const y = y0 + r * (h + g);
    box(s, { x: 0.6, y, w: lw, h, title: name, ts: 16, tc: C.background1, fill: r === 3 ? C.text2 : C.accent1, align: "center" });
    chips.forEach(([t, d], i) => box(s, { x: cx + i * (cw + cg), y, w: cw, h, title: t, sub: d, ts: 13, ss: 11, fill: r === 3 ? C.accent2 : C.background2 }));
  });
  s.addNotes(NOTES[4]);
}

// 5. Search pipeline
{
  const s = content("Implementation", "Search: from a sentence to an investigation");
  box(s, { x: 0.6, y: 3.0, w: 2.35, h: 1.6, title: "“Is Romania getting warmer since 2005?”", ts: 15, fill: C.accent5, align: "center" });
  const lx = 3.55, lw = 6.05;
  const lanes = [
    { y: 1.45, h: 1.75 }, { y: 3.4, h: 1.3 }, { y: 4.9, h: 1.15 },
  ];
  box(s, { x: lx, y: lanes[0].y, w: 2.95, h: lanes[0].h, title: "Measurement · keyword rules", sub: "word stems (warmer = warm), phrase 6 · keyword 3 · weak 2 points, longest phrase wins, measurement families, “not available” list", ss: 11, valign: "top" });
  box(s, { x: lx + 3.1, y: lanes[0].y, w: 2.95, h: lanes[0].h, title: "Measurement · meaning model", sub: "all-MiniLM-L6-v2 runs locally; cosine vs catalogue vectors; used only if score ≥ 0.42 and it leads by ≥ 0.03, then ranks are fused", ss: 11, valign: "top", fill: C.accent2 });
  box(s, { x: lx, y: lanes[1].y, w: lw, h: lanes[1].h, title: "Place", sub: "coordinates → direct  ·  famous regions (Sahel, Amazon) → box  ·  names, rivers, lakes → Photon, Open-Meteo, Nominatim", ss: 11 });
  box(s, { x: lx, y: lanes[2].y, w: lw, h: lanes[2].h, title: "Period and season", sub: "“since 2005”, “2001 to 2015”, “in summer” → months to keep", ss: 11 });
  // fan out / fan in connectors
  const cy = [lanes[0].y + lanes[0].h / 2, lanes[1].y + lanes[1].h / 2, lanes[2].y + lanes[2].h / 2];
  const fx = 3.25, mx = 9.92;
  arrow(s, 2.98, 3.8, fx, 3.8, { noEnd: true });
  arrow(s, fx, cy[0], fx, cy[2], { noEnd: true });
  cy.forEach((y) => arrow(s, fx, y, lx - 0.04, y));
  cy.forEach((y) => arrow(s, lx + lw + 0.04, y, mx, y, { noEnd: true }));
  arrow(s, mx, cy[0], mx, cy[2], { noEnd: true });
  arrow(s, mx, 3.8, 10.2, 3.8);
  s.addText([
    { text: "Investigation", options: { bold: true, fontSize: 16, color: C.background1, breakLine: true } },
    { text: "place or area", options: { fontSize: 13, color: C.accent5, breakLine: true } },
    { text: "+ measurement", options: { fontSize: 13, color: C.accent5, breakLine: true } },
    { text: "+ period", options: { fontSize: 13, color: C.accent5, breakLine: true } },
    { text: "→ fetch and test", options: { fontSize: 13, color: C.background1, bold: true } },
  ], { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x: 10.25, y: 2.85, w: 2.45, h: 1.9, fill: { color: C.text2 }, line: { type: "none" }, margin: 12, valign: "middle", objectName: "query" });
  label(s, "“Why …?” → reminder that we show what changed, not why  ·  unavailable topics → “we can’t measure that” + closest measurement", 0.6, 6.3, 12.1, { fs: 12, bold: false });
  s.addNotes(NOTES[5]);
}

// 6. Trend engine
{
  const s = content("Implementation", "The trend engine");
  const steps = [
    ["Monthly record", "missing months skipped, never zero"],
    ["Remove seasons", "12 monthly means fitted with the line"],
    ["Straight line", "OLS slope per decade, total change"],
    ["Memory fix", "lag-1 autocorrelation → effective n (Santer 2000)"],
    ["Two tests", "t-test + 95% CI; seasonal Mann-Kendall + Sen"],
    ["Verdict", "plain words + numbers with units"],
  ];
  const w = 1.85, g = 0.2, y = 1.45;
  steps.forEach(([t, d], i) => {
    const x = 0.6 + i * (w + g);
    box(s, { x, y, w, h: 1.85, title: t, sub: d, ts: 14, ss: 11, valign: "top", m: [48, 8, 6, 8], fill: i === 5 ? C.accent2 : C.background2 });
    numChip(s, i + 1, x + 0.1, y + 0.12, 0.38);
    if (i < 5) arrow(s, x + w + 0.02, y + 0.92, x + w + g - 0.02, y + 0.92, { color: C.accent1 });
  });
  // verdict legend
  label(s, "VERDICTS", 0.6, 3.65, 3.5, { fs: 11 });
  const v = [[C.text2, "Significant", "p < 0.05"], [C.accent1, "Possible, not yet", "p < 0.10"], ["B2BCB8", "No clear trend yet", "never “no change”"], [C.text1, "Not enough data", "< 10 years or 24 months"]];
  v.forEach(([col, t, d], i) => {
    const yy = 4.05 + i * 0.6;
    dot(s, 0.6, yy + 0.08, 0.28, col);
    s.addText([{ text: t + "  ", options: { bold: true, fontSize: 14 } }, { text: d, options: { fontSize: 12, color: C.accent6 } }], { x: 1.0, y: yy, w: 3.4, h: 0.44, margin: 0, valign: "middle", isTextBox: true, objectName: "v" + i });
  });
  // stat callouts
  const stat = (x, big, small) => s.addText([
    { text: big, options: { fontSize: 40, bold: true, color: C.text2, breakLine: true } },
    { text: small, options: { fontSize: 13, color: C.text1 } },
  ], { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y: 3.75, w: 3.95, h: 2.75, fill: { color: C.background2 }, line: { type: "none" }, margin: 16, valign: "middle", objectName: "stat" + ++n });
  stat(4.7, "44% → 6%", "how often random data with month-to-month memory is wrongly called “significant”: naive test vs ours");
  stat(8.75, "0 differences", "Python stats.py (offline maps, tests) vs browser stats.js: 105 real series, 2,051 checks");
  s.addNotes(NOTES[6]);
}

// 7. Area averaging
{
  const s = content("Implementation", "From one point to a whole country");
  // grid visual
  const gx = 0.8, gy = 1.6, cell = 0.5, nc = 9, nr = 8;
  const cxE = gx + nc * cell / 2, cyE = gy + nr * cell / 2, rx = 2.0, ry = 1.65;
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const px = gx + c * cell + cell / 2, py = gy + r * cell + cell / 2;
    const inside = ((px - cxE) / rx) ** 2 + ((py - cyE) / ry) ** 2 <= 1;
    s.addShape(S.RECTANGLE, { x: gx + c * cell, y: gy + r * cell, w: cell - 0.04, h: cell - 0.04, fill: { color: inside ? C.accent1 : C.background2, transparency: inside ? 15 + r * 8 : 0 }, line: { type: "none" }, objectName: "cell" + ++n });
  }
  s.addShape(S.OVAL, { x: cxE - rx, y: cyE - ry, w: rx * 2, h: ry * 2, fill: { type: "none" }, line: { color: C.text2, width: 2.5 }, objectName: "outline" });
  [[-1.2, -0.6], [0, -1.0], [1.1, -0.5], [-0.6, 0.3], [0.6, 0.4], [-1.4, 0.6], [1.4, 0.7], [0, 1.1], [0.2, -0.1]].forEach(([dx, dy]) => dot(s, cxE + dx - 0.09, cyE + dy - 0.09, 0.18, C.accent3));
  dot(s, 0.8, 5.85, 0.18, C.accent3); label(s, "NASA POWER sample points (up to 16)", 1.05, 5.77, 4, { fs: 11, bold: false, color: C.text1 });
  s.addShape(S.RECTANGLE, { x: 0.8, y: 6.2, w: 0.18, h: 0.18, fill: { color: C.accent1 }, line: { type: "none" }, objectName: "lg2" }); label(s, "1° satellite / model squares, paler = smaller weight", 1.05, 6.12, 4, { fs: 11, bold: false, color: C.text1 });

  const steps = [
    ["Outline", "country or lake from OpenStreetMap; famous regions use a box; rivers use points along the course"],
    ["Sample", "up to 16 NASA POWER points + every 1° square inside (largest countries: 24 main tiles)"],
    ["Weight", "each square × cos(latitude): squares near the poles cover less ground"],
    ["Coverage", "a month counts only if at least half of the squares have data"],
    ["Same test", "one averaged record → the same trend engine as a single point"],
  ];
  steps.forEach(([t, d], i) => {
    const y = 1.5 + i * 0.86;
    numChip(s, i + 1, 6.3, y + 0.12, 0.42);
    s.addText([{ text: t, options: { bold: true, fontSize: 15, breakLine: true } }, { text: d, options: { fontSize: 12, color: C.accent6 } }], { x: 6.9, y, w: 5.8, h: 0.75, margin: 0, valign: "middle", isTextBox: true, objectName: "st" + i });
  });
  box(s, { x: 6.3, y: 5.9, w: 6.4, h: 0.75, title: "Second source check", sub: "MERRA-2 vs an independent satellite (GPM, AIRS, MODIS, GLDAS) → “confirmed by …”", fill: C.accent2, ss: 11 });
  s.addNotes(NOTES[7]);
}

// 8. Investigate
{
  const s = content("Implementation", "Going deeper: Investigate");
  const cw = 5.95;
  box(s, { x: 0.6, y: 1.45, w: cw, h: 5.2, title: "", fill: C.background2 });
  box(s, { x: 6.75, y: 1.45, w: cw, h: 5.2, title: "", fill: C.background2 });
  label(s, "Trend Decomposer", 0.9, 1.65, 5, { fs: 20, color: C.text1 });
  label(s, "How much of a trend do possible drivers account for?", 0.9, 2.05, 5.4, { fs: 12, bold: false });
  // balance bars (Svalbard snow example)
  label(s, "Svalbard snow depth, −4.8 cm per decade", 0.9, 2.6, 5.4, { fs: 12, color: C.text1 });
  s.addShape(S.RECTANGLE, { x: 0.9, y: 3.0, w: 5.3, h: 0.4, fill: { color: C.accent4 }, line: { type: "none" }, objectName: "obs" });
  label(s, "observed trend", 0.95, 3.0, 3, { fs: 11, color: C.background1, h: 0.4 });
  s.addShape(S.RECTANGLE, { x: 0.9, y: 3.5, w: 0.48, h: 0.4, fill: { color: C.accent1 }, line: { type: "none" }, objectName: "drv" });
  s.addShape(S.RECTANGLE, { x: 1.42, y: 3.5, w: 4.78, h: 0.4, fill: { color: "B2BCB8" }, line: { type: "none" }, objectName: "left" });
  label(s, "air temp ≈ 9%", 0.9, 3.95, 2, { fs: 11, color: C.text2 });
  label(s, "left over ≈ 91% (tested again)", 2.6, 3.95, 3.6, { fs: 11, color: C.accent6, align: "right" });
  const dl = ["Regression on month-to-month wiggles: two trending records can’t fake a link", "Ranges from a block bootstrap (400 re-runs, whole years)", "Alibi test: driver shifted by whole years must lose its link", "Across the planet: do places with faster drivers change faster?"];
  s.addText(dl.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < dl.length - 1 } })), { x: 0.9, y: 4.4, w: 5.4, h: 2.1, fontSize: 12, color: C.text1, paraSpaceAfter: 6, margin: 0, isTextBox: true, valign: "top", objectName: "dlist" });

  label(s, "Places changing like this one", 7.05, 1.65, 5.5, { fs: 20, color: C.text1 });
  label(s, "Nearest neighbours over trend fingerprints", 7.05, 2.05, 5.4, { fs: 12, bold: false });
  const fa = [2, 1, 2, 2, 0, 1, -1, -2, 0, 1, 2, -1, 0, 1, -2, 0, 1, 2];
  const fb = [2, 2, 1, 2, 0, 1, -1, -1, 0, 0, 2, -1, 1, 1, -2, -1, 1, 1];
  const col = (v) => (v > 0 ? C.accent3 : v < 0 ? C.accent4 : "B2BCB8");
  [[fa, "Chosen place", 2.75], [fb, "Match far away (illustration)", 3.45]].forEach(([f, t, y]) => {
    label(s, t, 7.05, y - 0.32, 5, { fs: 11, color: C.text1, h: 0.3 });
    f.forEach((v, i) => s.addShape(S.RECTANGLE, { x: 7.05 + i * 0.29, y, w: 0.25, h: 0.25, fill: { color: col(v), transparency: Math.abs(v) === 1 ? 45 : 0 }, line: { type: "none" }, objectName: "fp" + ++n }));
  });
  label(s, "coral = rising · blue = falling · one square per measurement (18)", 7.05, 3.8, 5.4, { fs: 11, bold: false });
  const sl = ["Fingerprint: each 5° square’s 18 trends vs the planet ((trend − mean) / spread, capped ±3)", "Related measurements share one vote (4 temperatures count once)", "Weighted cosine similarity: +1 same pattern, −1 opposite", "Top 5, land with land, at least 1,500 km apart"];
  s.addText(sl.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < sl.length - 1 } })), { x: 7.05, y: 4.4, w: 5.4, h: 2.1, fontSize: 12, color: C.text1, paraSpaceAfter: 6, margin: 0, isTextBox: true, valign: "top", objectName: "slist" });
  s.addNotes(NOTES[8]);
}

// 9. Quality
{
  const s = content("Implementation", "How we know it works");
  const st = [["34", "Python tests on data with known answers"], ["2,051", "browser = Python checks on 105 real series"], ["33 / 36", "held-out questions: right place and measurement first"], ["8 / 8", "off-topic questions correctly refused"]];
  st.forEach(([big, d], i) => {
    const x = 0.6 + i * 3.075;
    s.addText([{ text: big, options: { fontSize: 44, bold: true, color: C.text2, breakLine: true } }, { text: d, options: { fontSize: 13, color: C.text1 } }], { shape: S.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y: 1.5, w: 2.875, h: 2.3, fill: { color: i % 2 ? C.accent5 : C.accent2 }, line: { type: "none" }, margin: 14, valign: "middle", objectName: "q" + i });
  });
  label(s, "AUTOMATED CHECKS", 0.6, 4.15, 4, { fs: 11 });
  const t = [["test_stats", "math matches Python"], ["test_nasa", "satellite tiles read back"], ["test_area", "outlines and averages"], ["test_investigation", "periods, matched months"], ["test_decompose", "known contributions, fake trends"], ["test_search", "right measurement"], ["test_meaning", "search by meaning"], ["test_similar", "look-alike places"]];
  t.forEach(([a, b], i) => {
    const x = 0.6 + (i % 4) * 3.075, y = 4.55 + Math.floor(i / 4) * 0.95;
    box(s, { x, y, w: 2.875, h: 0.8, title: a, sub: b, ts: 13, ss: 11, fill: C.background2 });
  });
  label(s, "Honest note: benchmark questions are drafts written by the team, not yet real students.", 0.6, 6.5, 12.1, { fs: 11, bold: false, italic: true });
  s.addNotes(NOTES[9]);
}

// 10. Trade-offs
{
  const s = content("Implementation", "Design choices and their price");
  const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 }, fontSize: 14 } });
  const rows = [
    ["Static site, no server", "free hosting, nothing to install, no login", "depends on live services (NASA POWER, geocoders) → fallbacks"],
    ["NASA satellite grids prepared once", "visitors never need an Earthdata login", "≈200 MB of tiles; a rebuild needs a token"],
    ["Language model in the browser", "private, no API key, no cost per question", "≈23 MB first download; keywords still decide clear cases"],
    ["Straight-line trend after removing seasons", "the challenge’s scope; easy to explain", "misses curved changes, and we say so"],
    ["Never state causes", "a trend line can’t prove why", "Decomposer says “accounts for”, not “causes”"],
  ];
  const body = rows.map((r, i) => r.map((c, j) => ({ text: c, options: { fontSize: 13, bold: j === 0, color: C.text1, fill: { color: i % 2 ? C.background1 : C.background2 } } })));
  s.addTable([[hdr("Decision"), hdr("Why"), hdr("Price we pay")], ...body], {
    x: 0.6, y: 1.5, w: 12.1, colW: [3.6, 4.0, 4.5], rowH: 0.78, valign: "middle", margin: [4, 10, 4, 10],
    border: { type: "solid", pt: 0.75, color: "D9E2DF" }, objectName: "tradeoffs",
  });
  s.addNotes(NOTES[10]);
}

// 11. Closing
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Implementation" });
  s.addText("What changed, where, how much, how sure", { placeholder: "title" });
  s.addText([
    { text: "Never why.", options: { bold: true, breakLine: true } },
    { text: "Next: test with real students  ·  publish on the Space Apps domain  ·  more NASA datasets", options: { fontSize: 16, color: C.accent5 } },
  ], { placeholder: "body" });
  s.addNotes(NOTES[11]);
}

(async () => {
  const f = process.argv[2] || "ByteMe_System_Design.pptx";
  await pres.writeFile({ fileName: f });
  await applyTheme(f, THEME);
  console.log("wrote", f);
})();
