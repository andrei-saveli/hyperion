# ByteMe project: handover for a new chat / agent

Read this first. It explains what the project is, what exists, what works, **what is broken**,
and how to run it. Written 2026-11-14. Repository: `andrei-saveli/hyperion` (private, branch `main`).

---

## 1. What we're building

**NASA Space Apps Challenge 2026: "Be An Earth System Trend Detective!"**
Build a tool where a user picks an Earth-science variable and a region, sees how it changed over
time, and learns **what** is changing, **where**, **how much**, and whether the change is
**statistically significant** (t-test, Mann-Kendall, confidence intervals). Audience: high-school
and college students. Full challenge text: `AGENTS.md`.

- **Team name:** Byte Me Analytics. **Product name:** **ByteMe** (logo `B/ ByteMe`).
- **Team:** 4 people with minimal coding skills, all using AI chat tools. The team lead (the user)
  uses an AI coding agent. Everyone pushes directly to `main`.
- **Scope rule:** remove the seasonal cycle, fit a **straight-line** trend, test significance.
  No forecasting, no claims about **why** something changed.

---

## 2. Data (what exists)

- Source: **NASA Giovanni**, monthly area averages over a box per place, **2001-01 to 2024-12**
  (288 months). Downloads need an Earthdata login (the team has one; agents don't).
- **Only 3 regions** and **4 variables** = 12 series:

| Region (id) | Box W, S, E, N |
|---|---|
| Lake Mead, USA (`lake_mead`) | −116, 35, −113, 37.5 |
| Niamey, Sahel, Niger (`niamey`) | 1, 12.5, 3, 14.5 |
| Svalbard, Arctic (`svalbard`) | 14, 77.5, 17, 79 |

| Code | Variable | Dataset | Units |
|---|---|---|---|
| `TEMP` | Air temperature | MERRA-2 `M2IMNXASM_5_12_4_T2M` | °C |
| `RAIN` | Rainfall | GPM IMERG `GPM_3IMERGM_07_precipitation` | mm/day |
| `SOILM` | Soil moisture | GLDAS `GLDAS_NOAH025_M_2_1_RootMoist_inst` | kg/m² |
| `EVAP` | Evaporation | GLDAS `GLDAS_NOAH025_M_2_1_Evap_tavg` | mm/day |

NO₂ was dropped. `svalbard_SOILM` is unreliable (glacier): don't use it in demos.
**Anything outside these 3 regions (e.g. Romania) has no data**, see §6.

---

## 3. Repository map

| Folder | Owner | What it is | State |
|---|---|---|---|
| `Task2/` | Person 2 (Data) | `raw/` 12 original Giovanni CSVs, `cleaned/` 12 clean CSVs (`date,value`), `convert_giovanni.py`, `data_io.py` (loader), `SOURCES.md` | ✅ done, verified |
| `Task3/` | Person 3 (Search + explanations) | `search.py` + `search_model.py` (AI search "Searchlight"), `explain.py` (plain-language text), `pages/` (Guided demo, How it works), `data/places.csv` + `variables.csv` (catalogue + keywords), benchmarks, `FEEDBACK.md` | ⚠️ search needs a manual build (§5) |
| `Task4/` | Person 4 = team lead | `stats.py` (trend + significance), 34 tests, `scripts/combine.py` (builds the final app), `check_handshakes.py`, `results_table.py`, `RESULTS.md` | ✅ done, tests pass |
| `Website/` | team lead | **The chosen public site "ByteMe"**: static HTML/JS (MapLibre map, Plotly charts, Geist fonts, light mint/teal design, pixel-globe hero). `build_data.py` runs the real Python code once → `data/results.json`; the site only displays it. Search = simple keyword matching in JavaScript | ✅ works |
| `FrontEnd_claude/` | team lead (for Person 1) | Older **Streamlit** app (dark, still titled "Hyperion"). The only front end that can run the Python AI search | ✅ works |
| `final/` | generated | Output of `combine.py` (Task2+3+4+FrontEnd_claude in one folder). Git-ignored, rebuilt every run | generated |
| `docs/` | | `PLAN.md` (roles/timeline), `HANDSHAKES.md` (interfaces H0–H6), data guides, this file | |
| `byte-me/` | a teammate | Single "Byte Me" splash page (bouncing title). Not used | ignore |
| separate repo `andrei-saveli/frontend-nasa` | Person 1 | Their own dark Streamlit app, uploaded **as a zip** (`Byte-Me-Analitics-project.zip`). Reviewed: works with the real data but has outdated text ("NASA POWER", "Analitics"). Team decided to keep the `Website/` design | review only |

Key interfaces (`docs/HANDSHAKES.md`): `load_places()`, `load_variables()`, `load_series(place, code)`
(H1) → `analyze(df, code=None)` (H2, result dict with slope, CI, p-values, verdict, flags) →
`explain(result, variable, place)` (H3) and `search(text)` / `explore(text)` (H4).

---

## 4. Results (real data)

4 significant, 1 possible, 7 no clear trend. Highlights: Lake Mead air temperature **+0.38 °C per
decade** (p = 0.014); Niamey soil moisture **−9.3%** since 2001 (significant); Niamey evaporation
possible increase, **≈2 more years** to significance. Full table: `Task4/RESULTS.md`.

---

## 5. How to run

### A. The public website (no Python libraries needed)
```bash
python3 Website/build_data.py
```
```bash
python3 -m http.server 8000 --directory Website
```
Open http://localhost:8000. Needs internet for fonts and the two JS libraries.

### B. The full Python product with AI search (Streamlit)
Needs **Python 3.11+** (macOS ships 3.9 → install 3.12 from python.org) and ~1 GB of libraries.
```bash
python3 -m venv .venv && source .venv/bin/activate
```
```bash
python3 Task4/scripts/combine.py --frontend FrontEnd_claude --no-checks
```
```bash
cd final && pip install -r requirements.txt -r requirements-search.txt
```
```bash
python3 -m scripts.build_search_index --download-models && python3 -m scripts.train_search_model --allow-draft
```
```bash
streamlit run app.py
```
Open http://localhost:8501. Re-running `combine.py` wipes `final/`, including the built model:
repeat the build step after it.

### Checks
```bash
python3 -m pytest -q Task4
```
```bash
python3 Task4/scripts/check_handshakes.py
```
Today: 34 tests pass. The checker reports **4 problems** (search returns nothing) unless the search
model has been built in that folder.

---

## 6. ❌ What is NOT working (start here)

1. **Search returns nothing out of the box.** `Task3/search.py` only works after building the AI
   model (§5B, ~1 GB download). As committed, `search()` returns `[]` and the checker shows 4 ❌.
   Person 3 removed the keyword fallback in commit 1bcdd7a. Once built, the 4 demo questions
   work ("is the desert drying out" → Lake Mead soil moisture, etc.).
   **Fix:** restore a keyword fallback in `search.py` when the model files are missing.

2. **Questions about places we don't have give confusing answers.** E.g. *"why is romania cold"*:
   `search()` → `[]`; `explore()` → offers **Svalbard air temperature** labelled "Explore a
   dataset", which looks random. Same for "temperature in Romania".
   **Fix A (quick):** in the search UI, when no match, say *"We don't have data for that place yet.
   Available regions: Lake Mead (USA), Niamey (Sahel), Svalbard (Arctic)."*
   **Fix B:** for "why …" questions, add *"ByteMe shows what changed and how sure we are, not why."*
   **Fix C (data):** add Romania as a 4th region: a row in `Task3/data/places.csv`
   (e.g. box W 22, S 44, E 28, N 48, type `farmland`), 4 Giovanni downloads by Person 2
   (`romania_TEMP/RAIN/SOILM/EVAP`, same variables and dates, guide in
   `docs/PERSON_2_DATA_GIOVANNI_HANDOVER.md`), clean with `Task2/convert_giovanni.py`, then
   rebuild `Website/data/results.json` and the search index. Agents can't download from
   Giovanni (login required).

3. **Running on the team lead's Mac failed** (Python from python.org, macOS):
   - `TypeError: unsupported operand type(s) for |` → Python too old (was 3.9). Fixed by
     installing 3.12; `combine.py` now prints a clear message.
   - `SSL: CERTIFICATE_VERIFY_FAILED` when building the search model → run
     `"/Applications/Python 3.12/Install Certificates.command"`, or
     `pip install --upgrade certifi && export SSL_CERT_FILE="$(python3 -m certifi)"`, then rebuild.
   - Cloning failed ("Password authentication is not supported"): the repo is private. Use
     **Code → Download ZIP** on GitHub, or `brew install gh && gh auth login`.
   - Streamlit asks for an email on first start: press Enter.

4. **The `Website/` keyword search is simple** (JavaScript word matching on Person 3's keywords).
   It can't run the Python AI model. It also only knows the 3 regions.

5. **Two front ends look different.** `Website/` (light, "ByteMe") is the chosen design;
   `FrontEnd_claude/` (dark, "Hyperion") is only needed to demo the Python AI search.

---

## 7. Decisions already made (don't re-open without the user)

- Design: `Website/`, light Isomorphic-Labs-inspired style, mint/aqua/teal, Geist + Geist Mono,
  no emoji, name **ByteMe**, logo `B/ ByteMe`.
- Statistics: our own numpy + scipy code (`Task4/stats.py`); seasonal Mann-Kendall matches
  `pymannkendall` exactly. Never state causes; non-significant ≠ "no change".
- Hosting idea: free Space Apps domain (Porkbun) + static hosting for `Website/`.
- Commit and push directly to `main`; no AI tool or model names in code or docs.

## 8. Useful links
- Website preview (private, owner only): https://claude.ai/artifact/Vg8jkfG9YFXE8hUDe6Ntod
- Project rules and full challenge text: `AGENTS.md`
- Results and demo cases: `Task4/RESULTS.md`
- Reviews of Person 3's work: `Task3/FEEDBACK.md`
