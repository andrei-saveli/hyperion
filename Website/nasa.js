// Reads one 1-degree square's monthly series out of a NASA tile file (data/nasa/<CODE>/<tile>.bin).
// Kept separate from app.js so tests/test_nasa.js can check it against the Python build.
//
// Tile format (written by build_nasa_tiles.py): little-endian 16-bit whole numbers, 100 squares
// (south to north, then west to east inside a 10 x 10 degree tile), each followed by all its months.
// Real value = number x scale + offset; the "missing" number means no data that month.
const ByteMeNasa = (function () {
  // Which tile file and which square inside it hold a place
  function locate(lat, lon, tileSize) {
    const row = Math.min(179, Math.max(0, Math.floor(lat + 90)));
    const col = ((Math.floor(lon + 180) % 360) + 360) % 360;
    const tileRow = row - (row % tileSize), tileCol = col - (col % tileSize);
    return { tile: `${tileRow - 90}_${tileCol - 180}`, square: (row - tileRow) * tileSize + (col - tileCol) };
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
