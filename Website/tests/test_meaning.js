// Compare the original branch, gated fusion, and fusion on every non-exact query.
// Run with Playwright/Chromium or set CHROME_PATH and use playwright-core.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { inBrowser, root } = require("../scripts/search_browser.js");
const baseline = "801997c9852967087cb34b8a1003986b8a8d8df4";
const load = (file) => fs.readFileSync(path.join(root, file), "utf8");
const original = (file) => execFileSync("git", ["show", baseline + ":Website/" + file], { cwd: root, encoding: "utf8" });
const withoutStartup = (script) => script.slice(0, script.indexOf("// ------------------------------------------------------------------ start")) +
  script.slice(script.indexOf("// Shareable links"));

const lexical = JSON.parse(load("tests/search_questions.json"));
const meaning = JSON.parse(load("tests/meaning_questions.json"));
const additional = [
  ["Is the white stuff on the mountains thinning near the Black Sea?", ["SNODP"]],
  ["Is the white stuff on the mountains thinning near black sea?", ["SNODP"]],
  ["black sea", []],
  ["44.4, 26.1", []],
  ["Is air temperature rising in Paris, Texas?", ["T2M"]],
  ["Is the sea level rising in the Black Sea?", ["NA:sea level"]],
  ["Has there been a rise in sea level near Black Sea?", ["NA:sea level"]],
];

const overrides = new Map([
  ["bench.html", '<!doctype html><input id="search"><div id="suggestions"></div>'],
  ["app.js", withoutStartup(load("app.js"))],
  ["baseline-app.js", withoutStartup(original("app.js"))],
  ["baseline-meaning.js", original("meaning.js")],
]);

async function open(page, url, old) {
  await page.goto(url + "/bench.html");
  for (const file of ["stats.js", "investigation.js", old ? "baseline-meaning.js" : "meaning.js", old ? "baseline-app.js" : "app.js"]) {
    await page.addScriptTag({ url: url + "/" + file });
  }
  await page.evaluate(async () => {
    if (typeof understand !== "function") throw new Error("The configured search script did not load");
    const catalog = await fetch("data/variables.json").then((r) => r.json());
    VARS = catalog.variables;
    NOT_AVAILABLE = catalog.not_available;
    FAMILIES = catalog.families;
  });
}

async function classify(page, questions, strategy) {
  return page.evaluate(async ({ questions, strategy }) => {
    const outcomes = [];
    for (const [text] of questions) {
      const start = performance.now();
      const q = understand(text);
      const useMeaning = strategy === "original" ? !q.variable && !q.missing : needsMeaning(q, strategy === "always");
      if (useMeaning) await readByMeaning(q, text);
      outcomes.push({
        code: q.variable?.code || null,
        missing: q.missing ? String(q.missing.phrases || q.missing.words || "") : null,
        byMeaning: !!q.byMeaning, useMeaning, ms: performance.now() - start,
      });
    }
    return outcomes;
  }, { questions, strategy });
}

function summarize(questions, got) {
  const summary = { correct: 0, wrong: 0, abstained: 0, offTopicFalseAccepts: 0, modelCalls: 0 };
  const errors = [];
  questions.forEach(([text, want], i) => {
    const result = got[i];
    summary.modelCalls += Number(result.useMeaning);
    const correct = want.some((w) => w.startsWith("NA:") ?
      result.missing?.includes(w.slice(3)) : !result.missing && result.code === w);
    const answered = !!(result.code || result.missing);
    if (correct) summary.correct++;
    else if (!want.length && answered) { summary.offTopicFalseAccepts++; errors.push([text, result]); }
    else if (want.length && answered) { summary.wrong++; errors.push([text, result]); }
    else if (want.length) { summary.abstained++; errors.push([text, result]); }
  });
  return { ...summary, errors };
}

inBrowser(async (page, url) => {
  page.on("pageerror", (error) => console.error(error.message));
  const groups = { tuning: [...lexical.tuning, ...meaning.tuning], heldout: [...lexical.heldout, ...meaning.heldout], additional };
  let originalHeldout;
  for (const strategy of ["original", "gated", "always"]) {
    const run = await page.context().browser().newPage();
    await open(run, url, strategy === "original");
    const [first] = await classify(run, [["Is the white stuff on the mountains thinning in the Alps?", ["SNODP"]]], strategy);
    assert.equal(first.code, "SNODP");
    console.log(strategy + " first semantic search in local Chrome: " + Math.round(first.ms) + " ms");
    for (const [name, questions] of Object.entries(groups)) {
      const results = await classify(run, questions, strategy);
      const { errors, ...summary } = summarize(questions, results);
      console.log(strategy, name, JSON.stringify(summary));
      if (name === "additional" || process.env.SEARCH_BENCH_VERBOSE) {
        for (const [text, result] of errors) console.log("  " + text + " -> " + JSON.stringify(result));
      }
      if (strategy === "gated" && name === "additional") {
        assert.equal(summary.correct, 5);
        assert.equal(summary.offTopicFalseAccepts, 0);
      }
      if (name === "heldout" && strategy === "original") originalHeldout = summary;
      if (name === "heldout" && strategy === "gated") {
        assert.ok(summary.correct >= originalHeldout.correct);
        assert.ok(summary.offTopicFalseAccepts <= originalHeldout.offTopicFalseAccepts);
      }
    }
    await run.close();
  }

  await open(page, url, false);
  await page.route("https://**/*", async (route) => {
    const request = new URL(route.request().url());
    const name = (request.searchParams.get("name") || request.searchParams.get("q") || "").toLowerCase();
    let data = {};
    if (request.hostname === "geocoding-api.open-meteo.com") {
      const paris = name === "paris, texas" ? { name: "Paris", admin1: "Texas", country: "United States", latitude: 33.66, longitude: -95.56 } :
        { name: "Paris", country: "France", latitude: 48.86, longitude: 2.35 };
      data = { results: name.startsWith("paris") ? [paris] : [] };
    } else if (request.hostname === "nominatim.openstreetmap.org") {
      data = [{ name: "Black Sea", category: "place", type: "sea", importance: 0.9,
        lat: "43", lon: "35", osm_type: "relation", osm_id: 1, boundingbox: ["40", "46", "27", "42"] }];
    }
    await route.fulfill({ json: data });
  });
  await page.evaluate(() => placePicker($("search"), $("suggestions"), (hit) => { window.picked = hit; }, true));
  const search = page.locator("#search");
  const first = page.locator("#suggestions [data-i]").first();
  for (const [query, expected] of [
    ["44.4, 26.1", { lat: 44.4, lon: 26.1, code: null }],
    ["black sea", { lat: 43, lon: 35, code: null }],
    ["Paris, Texas", { lat: 33.66, lon: -95.56, code: null }],
    ["paris, texas", { lat: 33.66, lon: -95.56, code: null }],
    ["Is air temperature rising in Paris, Texas?", { lat: 33.66, lon: -95.56, code: "T2M" }],
  ]) {
    await search.fill(query);
    await first.click();
    assert.deepEqual(await page.evaluate(() => ({ lat: picked.lat, lon: picked.lon, code: picked.variable?.code || null })), expected, query);
  }
  // A broken or missing generated index must leave geocoding and place selection working.
  await open(page, url, false);
  await page.route("**/models/meaning-index.json", (route) => route.fulfill({ status: 404 }));
  const result = await page.evaluate(async () => {
    const text = "Has the white stuff been thinning in Paris, Texas?";
    const q = understand(text);
    await readByMeaning(q, text);
    const [place] = await placesForQuestion(text, q);
    return { byMeaning: !!q.byMeaning, name: place.name };
  });
  assert.deepEqual(result, { byMeaning: false, name: "Paris, Texas, United States" });
  console.log("Place routing and missing-index fallback passed");
}, overrides).catch((error) => { console.error(error); process.exitCode = 1; });
