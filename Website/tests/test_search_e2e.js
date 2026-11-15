// Checks the whole search the way the search box runs it (app.js placePicker): measurement by keywords,
// then by meaning when needed, then places. Uses tests/search_e2e_questions.json. Needs Playwright and
// internet (Photon, Open-Meteo and Nominatim name places), so it is slower than the other tests.
// Run from the repository root:  node Website/tests/test_search_e2e.js [tuning|heldout]
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("e2e search test skipped: Playwright is not installed"); process.exit(0); }
const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
const km = (a, b) => { const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

server.listen(0, async () => {
  const sets = JSON.parse(fs.readFileSync(path.join(__dirname, "search_e2e_questions.json"), "utf8"));
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof understand === "function" && VARS.length > 20, null, { timeout: 60000 });
  let failures = 0;
  for (const name of (process.argv[2] ? [process.argv[2]] : ["tuning", "heldout"])) {
    let measure = 0, place = 0, both = 0;
    for (const [text, codes, want] of sets[name]) {
      const ask = page.evaluate(async (text) => {
        const q = understand(text);
        const hasLocation = q.directPlace || q.placeCandidates.length || q.leftoverWords.length;
        const placesJob = hasLocation ? placesForQuestion(text, q, true) : Promise.resolve([]);   // as when Enter is pressed
        if (needsMeaning(q)) await readByMeaning(q, text);
        const places = await placesJob;
        const p = places[0];
        return { code: q.variable ? q.variable.code : null, place: p ? { name: p.name || p.label, lat: p.lat, lon: p.lon } : null };
      }, text);
      // a question that takes over a minute counts as failed (a place service didn't answer)
      const got = await Promise.race([ask, new Promise((r) => setTimeout(() => r({ code: null, place: null, timeout: true }), 60000))]);
      if (got.timeout) { await page.reload(); await page.waitForFunction(() => typeof understand === "function" && VARS.length > 20, null, { timeout: 60000 }); }
      const okM = codes.includes(got.code), d = got.place ? km(got.place, want) : null, okP = d !== null && d <= want.km;
      measure += okM; place += okP; both += okM && okP;
      if (!(okM && okP)) console.log(`  ${okM ? "" : "MEASUREMENT "}${okP ? "" : "PLACE "}| ${text} -> ${got.code} @ ${got.place ? `${got.place.name} (${Math.round(d)} km off)` : got.timeout ? "TIMED OUT" : "no place"}`);
    }
    const n = sets[name].length;
    console.log(`${name}: right measurement ${measure}/${n}, right place ${place}/${n}, both ${both}/${n}`);
    if (name === "heldout" && process.env.E2E_MIN && both < +process.env.E2E_MIN) failures++;
  }
  await browser.close(); server.close();
  process.exit(failures ? 1 : 0);
});
