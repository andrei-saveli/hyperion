// Run with Playwright and its Chromium, or set CHROME_PATH and use playwright-core.
const fs = require("node:fs");
const path = require("node:path");
const { inBrowser, root } = require("./search_browser.js");

inBrowser(async (page, url) => {
  await page.goto(url + "/build-index.html");
  await page.addScriptTag({ url: url + "/meaning.js" });
  const { version, texts, vectors } = await page.evaluate(async () => {
    const { variables, not_available } = await fetch("data/variables.json").then((r) => r.json());
    return ByteMeMeaning.buildIndex(variables, not_available);
  });
  const bytes = Buffer.alloc(vectors.length * 384 * 4);
  vectors.flat().forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  const target = path.join(root, "models", "meaning-index.json");
  fs.writeFileSync(target, JSON.stringify({ version, texts, vectors: bytes.toString("base64") }) + "\n");
  console.log("Wrote " + texts.length + " catalog vectors to " + target);
}, new Map([["build-index.html", "<!doctype html><title>Build catalog embeddings</title>"]]))
  .catch((error) => { console.error(error); process.exitCode = 1; });
