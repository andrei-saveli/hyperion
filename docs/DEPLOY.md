# Putting ByteMe online

The site is the `Website/` folder: plain HTML, JavaScript and data files, no build step. Any static
host works. It is about 460 MB in some 11,000 files; the largest file is 23 MB (the search model).

## Option A (recommended): Cloudflare Pages, connected to GitHub
Free, works with a private repository, redeploys by itself after every push to `main`.

1. Sign in at https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, and pick `andrei-saveli/hyperion`.
2. Production branch: `main`. Framework preset: **None**. Build command: *(leave empty)*.
   Build output directory: `Website`.
3. **Save and Deploy**. The site appears at `https://<name>.pages.dev` after a few minutes.

Limits that matter: 25 MB per file (our largest is 23 MB) and 20,000 files (we have about 11,000).
Don't use the dashboard's drag-and-drop upload: it takes at most 1,000 files.

## Option B: Netlify, connected to GitHub
https://app.netlify.com → **Add new site** → **Import an existing project** → GitHub → the
repository. Branch `main`, build command empty, publish directory `Website`.

## Option C: GitHub Pages
Needs a public repository or a paid GitHub plan for a private one. Repository **Settings** →
**Pages** → Source: **GitHub Actions**. Then **Actions** → **Deploy the website to GitHub Pages** →
**Run workflow** (`.github/workflows/deploy-pages.yml`; it only runs when started by hand). The site
lives at `https://andrei-saveli.github.io/hyperion/`.

## What the deploy already includes
- `Website/_headers`: caching for the data and model files, the right type for the WebAssembly file,
  and basic security headers (Netlify and Cloudflare read it; other hosts ignore it).
- `Website/404.html`, `Website/robots.txt`, `Website/favicon.svg`, and `Website/og-image.png` with
  the sharing tags in `index.html` (how a shared link looks).
- `Website/data/services.json`: switches for outside services (see below).

## Outside services the visitor's browser talks to
| Service | Used for | Rules we follow |
|---|---|---|
| NASA POWER (`power.larc.nasa.gov`) | Monthly data, asked live | No key needed. Credit NASA POWER (in the page and the README). |
| Photon (`photon.komoot.io`, OpenStreetMap data) | Place search while typing; naming a clicked point and the "places changing like this one" squares | Fair use, answers kept in memory. |
| Open-Meteo geocoding (GeoNames data) | Towns and cities | Free for non-commercial use; credited on the map. |
| Nominatim (`nominatim.openstreetmap.org`) | Outlines of countries, regions and rivers; rivers, seas and mountains by name | At most one request per second, **never while typing** (only after Enter or a pick), answers cached in the browser for 30 days. Its limit counts all our visitors together, so with heavy traffic set `"nominatim": false` in `data/services.json`, or move to a paid geocoder. |
| OpenFreeMap | Map background | Free; attribution on the map. |
| jsDelivr, Google Fonts | Map and chart libraries (pinned versions), fonts | – |

No cookies and no analytics. Questions typed in the search box are sent to the place-name services
above (only the words, nothing else about the visitor).

## Before you announce the link
- Open the site, ask two questions (one about a country, e.g. "Is Romania getting warmer?"), click
  the map, open Investigate. Check the browser console for errors.
- Try it on a phone.
- Data rebuilds add hundreds of MB to the repository: rebuild rarely (see `Website/README.md`).
