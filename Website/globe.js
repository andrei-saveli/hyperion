// Hero art: a slowly rotating globe drawn from "satellite pixels".
// Each square is one land grid cell (from data/land.geojson, Natural Earth); our three study
// regions (from data/results.json) are lit in coral. Pure decoration: no data is computed here.
(function () {
  const canvas = document.getElementById("globe");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const STEP = 2.2;                         // grid cell size in degrees
  const TILT = (-18 * Math.PI) / 180;       // tip the north pole towards the viewer
  const TEAL = [25, 169, 154], CYAN = [60, 199, 218], CORAL = [236, 122, 106];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let land = [], ocean = [], regions = [], spin = -95, visible = true;

  // --- which grid cells are land? (ray-casting point-in-polygon, with a bounding-box pre-check)
  function ringsOf(geojson) {
    const rings = [];
    geojson.features.forEach((f) => f.geometry.coordinates.forEach((poly) => poly.forEach((ring) => {
      let w = 180, e = -180, s = 90, n = -90;
      ring.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); });
      rings.push({ ring, w, e, s, n });
    })));
    return rings;
  }
  function inside(lon, lat, rings) {
    let hits = 0;
    for (const r of rings) {
      if (lon < r.w || lon > r.e || lat < r.s || lat > r.n) continue;
      let c = false;
      for (let i = 0, j = r.ring.length - 1; i < r.ring.length; j = i++) {
        const [xi, yi] = r.ring[i], [xj, yj] = r.ring[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
      }
      if (c) hits++;
    }
    return hits % 2 === 1;  // holes (lakes) count as water
  }

  // --- orthographic projection: longitude/latitude -> x, y on screen, z = facing us (0..1)
  function project(lon, lat, cx, cy, radius) {
    const l = ((lon - spin) * Math.PI) / 180, p = (lat * Math.PI) / 180;
    const x = Math.cos(p) * Math.sin(l);
    const y = Math.cos(TILT) * Math.sin(p) - Math.sin(TILT) * Math.cos(p) * Math.cos(l);
    const z = Math.sin(TILT) * Math.sin(p) + Math.cos(TILT) * Math.cos(p) * Math.cos(l);
    return [cx + radius * x, cy - radius * y, z];
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const radius = Math.min(w, h) * 0.44, cx = w * 0.5, cy = h * 0.47;
    const cell = (radius * STEP * Math.PI) / 180;   // size of one grid cell at the globe's centre

    // soft glow behind the globe
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.25);
    glow.addColorStop(0, "rgba(255,255,255,0.85)");
    glow.addColorStop(0.75, "rgba(211,240,242,0.55)");
    glow.addColorStop(1, "rgba(214,245,223,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2); ctx.fill();

    // faint ocean pixels give the sphere its shape
    for (const [lon, lat] of ocean) {
      const [x, y, z] = project(lon, lat, cx, cy, radius);
      if (z <= 0) continue;
      const s = cell * 0.28 * (0.5 + 0.5 * z);
      ctx.fillStyle = `rgba(60,199,218,${0.1 + 0.18 * z})`;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    // land pixels: teal at the poles, cyan near the equator, brighter when facing us
    for (const [lon, lat] of land) {
      const [x, y, z] = project(lon, lat, cx, cy, radius);
      if (z <= 0) continue;
      const s = cell * 0.72 * (0.55 + 0.45 * z);
      const [r, g, b] = mix(TEAL, CYAN, 1 - Math.abs(lat) / 90);
      ctx.fillStyle = `rgba(${r},${g},${b},${0.3 + 0.7 * z})`;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    // our study regions, pulsing gently
    const pulse = still ? 1 : 0.75 + 0.25 * Math.sin(Date.now() / 450);
    for (const [lon, lat] of regions) {
      const [x, y, z] = project(lon, lat, cx, cy, radius);
      if (z <= 0) continue;
      const s = cell * 0.9 * (0.6 + 0.4 * z);
      ctx.fillStyle = `rgba(${CORAL.join(",")},${(0.55 + 0.45 * z) * pulse})`;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }

  function loop() {
    if (visible) { spin = (spin + 0.08) % 360; draw(); }
    requestAnimationFrame(loop);
  }

  Promise.all([fetch("data/land.geojson").then((r) => r.json()), fetch("data/results.json").then((r) => r.json())])
    .then(([geo, data]) => {
      const rings = ringsOf(geo);
      for (let lat = -84 + STEP / 2; lat < 84; lat += STEP) {
        for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) {
          (inside(lon, lat, rings) ? land : ocean).push([lon, lat]);
        }
      }
      ocean = ocean.filter((_, i) => i % 3 === 0);   // fewer, fainter ocean pixels
      // light up the grid cells inside each region's box (at least its centre cell)
      data.places.forEach((p) => {
        let found = false;
        for (let lat = p.south; lat <= p.north; lat += STEP / 2) {
          for (let lon = p.west; lon <= p.east; lon += STEP / 2) { regions.push([lon, lat]); found = true; }
        }
        if (!found) regions.push([p.lon, p.lat]);
      });
      resize();
      window.addEventListener("resize", () => { resize(); draw(); });
      if (still) { draw(); return; }
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
      loop();
    })
    .catch(() => { canvas.style.display = "none"; });   // decoration only: hide if data can't load
})();
