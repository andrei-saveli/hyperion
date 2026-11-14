// Checks that the website reads the NASA tile files back to the same monthly values the Python
// build saw (within the 16-bit rounding). Run after `python3 Website/build_nasa_grids.py build`:
//     node Website/tests/test_nasa.js
const fs = require("fs");
const path = require("path");
const { locate, decode } = require("../nasa.js");

const root = path.join(__dirname, "..", "data", "nasa");
const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "nasa_reference.json"), "utf8"));
let failures = 0;

for (const c of cases) {
  const info = index.variables[c.code];
  const { tile, square } = locate(c.lat, c.lon, index.tile);
  const file = path.join(root, c.code, `${tile}.bin`);
  const expectedReal = c.values.filter((v) => v !== null).length;
  if (!fs.existsSync(file)) {
    if (expectedReal) { failures++; console.log(`FAIL ${c.code} ${c.lat},${c.lon}: tile ${tile} missing`); }
    continue;
  }
  const buf = fs.readFileSync(file);
  const got = decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), square, info, index.missing);
  if (!got) {
    if (expectedReal) { failures++; console.log(`FAIL ${c.code} ${c.lat},${c.lon}: no series read`); }
    continue;
  }
  // line the decoded months up with the full list of months
  const startIndex = c.months.indexOf(`${got.dates[0].year}-${String(got.dates[0].month).padStart(2, "0")}`);
  const tolerance = info.scale * 0.51;     // half a step of the 16-bit rounding
  got.values.forEach((v, i) => {
    const want = c.values[startIndex + i];
    const ok = (v === null && want === null) || (v !== null && want !== null && Math.abs(v - want) <= tolerance);
    if (!ok) { failures++; if (failures < 10) console.log(`FAIL ${c.code} ${c.lat},${c.lon} ${c.months[startIndex + i]}: ${want} vs ${v}`); }
  });
}
console.log(`${cases.length} series checked, ${failures} differences`);
process.exit(failures ? 1 : 0);
