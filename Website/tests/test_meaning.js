// Checks the search-by-meaning fallback (meaning.js) on questions worded without our keywords
// (tests/meaning_questions.json). It runs the real search code and the real language model in a
// browser, so it needs Playwright and the model files (python3 Website/get_search_model.py);
// without them the test is skipped.
// Run from the repository root:  node Website/tests/test_meaning.js
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.log("meaning test skipped: Playwright is not installed"); process.exit(0); }
const root = path.join(__dirname, "..");
if (!fs.existsSync(path.join(root, "models", "all-MiniLM-L6-v2", "onnx", "model_quantized.onnx"))) {
  console.log("meaning test skipped: run python3 Website/get_search_model.py first"); process.exit(0);
}
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {   // a tiny local web server for the Website folder
  const file = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, async () => {
  const sets = JSON.parse(fs.readFileSync(path.join(__dirname, "meaning_questions.json"), "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof understand === "function" && VARS.length > 20, null, { timeout: 60000 });
  if (!(await page.evaluate(() => ByteMeMeaning.load().then((m) => !!m)))) { console.log("FAIL the model didn't load"); process.exit(1); }
  let failures = 0;
  for (const label of ["tuning", "heldout"]) {
    let misses = 0, right = 0, wrong = 0, offTopic = 0, offTopicAnswered = 0, overall = 0;
    for (const [question, want] of sets[label]) {
      const got = await page.evaluate(async (text) => {
        const q = understand(text);
        const ruleMiss = !q.variable && !q.missing;
        if (ruleMiss) await readByMeaning(q, text);
        const answer = q.missing && q.closestOnly ? q.missing : null;
        return { ruleMiss, byMeaning: !!q.byMeaning, code: q.variable ? q.variable.code : null,
                 missing: answer ? `${answer.phrases || ""} ${answer.words || ""}` : null };
      }, question);
      const ok = want.length > 0 && want.some((w) => (w.startsWith("NA:") ? got.missing && got.missing.includes(w.slice(3)) : !got.missing && got.code === w));
      if (ok) overall++;
      if (!want.length) {                       // off-topic: must not be given a measurement by meaning
        offTopic++;
        if (got.byMeaning) { offTopicAnswered++; console.log(`  off-topic answered: ${question} -> ${got.code}`); }
        continue;
      }
      if (!got.ruleMiss) continue;              // the keyword rules answered; tests/test_search.js covers those
      misses++;
      if (!got.byMeaning) continue;             // no answer by meaning (the search then shows the place's clearest changes)
      if (ok) right++; else { wrong++; console.log(`  wrong by meaning: ${question} -> ${got.missing ? "NA" : got.code} (want ${want.join(" or ")})`); }
    }
    console.log(`${label}: of ${misses} answerable questions the keyword rules miss, ${right} read right by meaning, ${wrong} wrong, ` +
      `${misses - right - wrong} left unanswered · off-topic answered ${offTopicAnswered}/${offTopic} · whole search right ${overall}/${sets[label].length - offTopic}`);
    if (offTopicAnswered > 0) { failures++; console.log(`FAIL ${label}: an off-topic question got a measurement`); }
    if (wrong > 2) { failures++; console.log(`FAIL ${label}: more than 2 wrong readings`); }
    if (right < 0.6 * misses) { failures++; console.log(`FAIL ${label}: fewer than 60% of rule misses read right`); }
  }
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
});
