// Checks that the search picks the right measurement for everyday questions
// (tests/search_questions.json). It runs the real search code in a browser, so it needs
// Playwright (npm install playwright); without it the test is skipped.
// Run from the repository root:  node Website/tests/test_search.js
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("search test skipped: Playwright is not installed"); process.exit(0); }

const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".bin": "application/octet-stream" };
const server = http.createServer((req, res) => {   // a tiny local web server for the Website folder
  const file = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, async () => {
  const { tuning, heldout } = JSON.parse(fs.readFileSync(path.join(__dirname, "search_questions.json"), "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof understand === "function" && VARS.length > 20, null, { timeout: 60000 });
  let failures = 0;
  for (const [label, cases] of [["tuning", tuning], ["held-out", heldout]]) {
    let right = 0;
    for (const [question, want] of cases) {
      const got = await page.evaluate((q) => { const u = understand(q); return u.variable && u.variable.code; }, question);
      if (want.includes(got)) right++; else { failures++; console.log(`FAIL ${question} -> ${got} (want ${want.join(" or ")})`); }
    }
    console.log(`${label}: ${right}/${cases.length} right measurement`);
  }
  // spelling: corrected only to known search words, never place names
  await page.waitForFunction(() => CAPITALS.length > 100, null, { timeout: 30000 });
  const spelling = [["Is the temprature rising in Madrid?", "T2M"], ["Is polution getting worse in Delhi?", "AOD_55"],
    ["precipitaion trend in Kenya", "PRECTOTCORR"], ["Is the windspeed dropping?", "WS10M"], ["sealevel in miami", "SEA_LEVEL"],
    ["evaporaton in iran", "EVLAND"], ["is the tempreture going up in chile", "T2M"]];
  for (const [question, want] of spelling) {
    const got = await page.evaluate((q) => { const u = understand(q); return u.variable && u.variable.code; }, question);
    if (got !== want) { failures++; console.log(`FAIL spelling: ${question} -> ${got} (want ${want})`); }
  }
  const untouched = ["is chile getting drier", "Is it hot in nice?", "rain in lima"];   // place names stay as typed
  for (const question of untouched) {
    const fixed = await page.evaluate((q) => understand(q).corrected || null, question);
    if (fixed) { failures++; console.log(`FAIL spelling changed a place: ${question} -> ${JSON.stringify(fixed)}`); }
  }
  // "capital of ..." places
  const capitals = [["How much water fell near Niger's capital?", "Niamey"], ["Is the capital of Australia warmer?", "Canberra"],
    ["Is the capital city of the UK rainier?", "London"], ["Is South Sudan's capital hotter?", "Juba"], ["is the capital of peru humid", "Lima"],
    ["Is the capital of South Africa warmer?", "Pretoria"], ["Is Paris getting warmer?", null]];
  for (const [question, want] of capitals) {
    const got = await page.evaluate((q) => { const c = capitalHits(q); return c.length ? c[0].name.split(",")[0] : null; }, question);
    if (got !== want) { failures++; console.log(`FAIL capital: ${question} -> ${got} (want ${want})`); }
  }
  console.log(`spelling and capitals: ${spelling.length + untouched.length + capitals.length} checks`);
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
});
