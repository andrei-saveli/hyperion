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
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
});
