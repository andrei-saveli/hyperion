// Checks the area-average helpers (area.js). Run:  node Website/tests/test_area.js
const { inside, samplePoints, squaresInside, average, MAX_POINTS } = require("../area.js");
let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; console.log("FAIL " + what); } };

// a square "country" from 20E to 30E and 40N to 50N, with a lake hole in the middle
const square = { type: "Polygon", coordinates: [[[20, 40], [30, 40], [30, 50], [20, 50], [20, 40]],
                                                 [[24, 44], [26, 44], [26, 46], [24, 46], [24, 44]]] };
check(inside(22, 42, square), "point inside");
check(!inside(31, 42, square), "point outside");
check(!inside(25, 45, square), "point in the lake counts as outside");
const islands = { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]] };
check(inside(10.5, 10.5, islands) && inside(0.5, 0.5, islands) && !inside(5, 5, islands), "multipolygon");

const points = samplePoints(square);
check(points.length > 4 && points.length <= MAX_POINTS, `between 5 and ${MAX_POINTS} points (got ${points.length})`);
check(points.every((p) => inside(p.lon, p.lat, square)), "all sample points inside");
check(samplePoints({ type: "Polygon", coordinates: [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]] }).length === 1, "tiny shape: one point");

const sq = squaresInside(square);
check(sq.total === 96 && !sq.sampled, `96 one-degree squares (100 minus the 4 in the lake), got ${sq.total}`);
const big = squaresInside({ type: "Polygon", coordinates: [[[-180, 0], [180, 0], [180, 60], [-180, 60], [-180, 0]]] });
check(big.sampled && big.squares.length < big.total, "very big shape keeps only some tiles");

// average: two records, one with a gap; weights by cos(latitude)
const d = (y, m) => ({ year: y, month: m });
const a = { dates: [d(2000, 1), d(2000, 2), d(2000, 3)], values: [1, 2, 3] };
const b = { dates: [d(2000, 2), d(2000, 3), d(2000, 4)], values: [4, null, 6] };
const avg = average([{ series: a, lat: 0 }, { series: b, lat: 60 }]);   // weights 1 and 0.5
check(avg.dates.length === 4, "covers both records' months");
check(Math.abs(avg.values[1] - (2 * 1 + 4 * 0.5) / 1.5) < 1e-12, "weighted mean");
check(avg.values[0] === 1 && avg.values[2] === 3 && avg.values[3] === 6, "months with half the members still count");
const three = average([{ series: a, lat: 0 }, { series: b, lat: 0 }, { series: { dates: [d(2000, 1)], values: [9] }, lat: 0 }]);
check(three.values[3] === null, "a month with fewer than half the members is missing");
check(average([{ series: null, lat: 0 }]) === null, "no data gives null");

console.log(`area tests: ${failures} failures`);
process.exit(failures ? 1 : 0);
