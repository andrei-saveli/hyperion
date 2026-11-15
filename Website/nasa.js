// Reads one square's monthly series out of a NASA tile file (data/nasa/<CODE>/<tile>.bin).
// Most measurements use 1-degree squares; smooth fields of the upper air and of dust and smoke use
// 2-degree squares ("step": 2 in data/nasa/index.json) to keep the files small.
// Kept separate from app.js so tests/test_nasa.js can check it against the Python build.
//
// Tile format (written by build_nasa_tiles.py): little-endian 16-bit whole numbers, 100 squares
// (25 for 2-degree squares; south to north, then west to east inside a 10 x 10 degree tile), each
// followed by all its months.
// Real value = number x scale + offset; the "missing" number means no data that month.
const ByteMeNasa = (function () {
  // Which tile file and which square inside it hold a place
  // tileSize: degrees per tile (10); step: degrees per square (1 or 2)
  function locate(lat, lon, tileSize, step = 1) {
    const rows = 180 / step, cols = 360 / step, n = tileSize / step;   // n squares along a tile's side
    const row = Math.min(rows - 1, Math.max(0, Math.floor((lat + 90) / step)));
    const col = ((Math.floor((lon + 180) / step) % cols) + cols) % cols;
    const tileRow = row - (row % n), tileCol = col - (col % n);
    return { tile: `${tileRow * step - 90}_${tileCol * step - 180}`, square: (row - tileRow) * n + (col - tileCol) };
  }

  // -> { dates: [{year, month}], values: [number | null] }, without the empty months at either end,
  //    or null when the square has no data at all
  function decode(buffer, square, info, missing) {
    const view = new DataView(buffer), first = square * info.months * 2;
    const [y0, m0] = info.start.split("-").map(Number);
    const dates = [], values = [];
    for (let i = 0; i < info.months; i++) {
      const raw = view.getInt16(first + 2 * i, true);
      const m = m0 - 1 + i;
      dates.push({ year: y0 + Math.floor(m / 12), month: (m % 12) + 1 });
      values.push(raw === missing ? null : raw * info.scale + info.offset);
    }
    const firstReal = values.findIndex((v) => v !== null);
    if (firstReal < 0) return null;
    let last = values.length - 1;
    while (values[last] === null) last--;
    return { dates: dates.slice(firstReal, last + 1), values: values.slice(firstReal, last + 1) };
  }

  return { locate, decode };
})();

if (typeof module !== "undefined") module.exports = ByteMeNasa;
