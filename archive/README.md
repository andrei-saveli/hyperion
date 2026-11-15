# Archive

Earlier versions of the project, kept for reference. **The live site is `Website/`.** Nothing here is
used by the site or its build scripts.

| Folder | What it was |
|---|---|
| `Task2/` | Person 2 (data): Giovanni downloads for 3 regions, cleaning scripts, `cleaned/` CSVs. `Website/tests/make_reference.py` still reads `Task2/cleaned/` as test data. |
| `Task3/` | Person 3 (search + explanations): Searchlight, benchmarks, explanation text, Streamlit teaching pages. |
| `Task4/` | Person 4 (trend + integration): results tables, combine script, handshake checks. Its `stats.py` and tests moved to `Website/stats.py` and `Website/tests/test_stats_py.py`. |
| `FrontEnd_claude/`, `FrontEnd_nasa/` | The two Streamlit versions of the site. |
| `byte-me/` | An early front page. |
| `Website_old/` | The first static site's build script and data (3 Giovanni regions) and its screenshots. |
| `docs/` | The original plan, role handovers and interface agreements (H0–H6) for the Streamlit version. |

Some scripts here expect the old folder layout (e.g. `Task4/` next to `Task2/` in the repository root)
and won't run from `archive/` without changing their paths.

Old branches were tagged before they were deleted, so they can be restored:
`git checkout -b <name> archive/<branch name with / replaced by ->`, e.g. `archive/codex-trend-detective`.
