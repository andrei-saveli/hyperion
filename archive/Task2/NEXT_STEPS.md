# Task 2: status

✅ **Done.** All 12 raw Giovanni files are in `raw/`, the 12 cleaned files are in `cleaned/`, and
re-cleaning the raw files with [`convert_giovanni.py`](convert_giovanni.py) reproduces `cleaned/`
exactly. Details and checks: [SOURCES.md](SOURCES.md).

Only open item: if the files weren't downloaded on 2026-11-14, fix the `Download date:` line in
`SOURCES.md`.

**Optional extras** (only if the team wants more):
- more places: add a row to `data/places.csv` (box), download 4 files each, put them in `raw/`,
  run `python Task2/convert_giovanni.py`, add lines to `SOURCES.md`
- more variables: pick from https://api.giovanni.earthdata.nasa.gov/configured-variables/ and ask
  the team first (handshake H0)
