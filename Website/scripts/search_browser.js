const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json",
  ".css": "text/css; charset=utf-8", ".wasm": "application/wasm" };

async function inBrowser(run, overrides = new Map()) {
  const { chromium } = process.env.CHROME_PATH ? require("playwright-core") : require("playwright");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const name = url.pathname.slice(1) || "index.html";
    const type = types[path.extname(name)] || "application/octet-stream";
    if (overrides.has(name)) {
      res.writeHead(200, { "Content-Type": type });
      res.end(overrides.get(name));
      return;
    }
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
    const page = await browser.newPage();
    await run(page, "http://127.0.0.1:" + server.address().port);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

module.exports = { inBrowser, root };
