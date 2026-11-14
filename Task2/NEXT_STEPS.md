# Task 2: next steps (raw files + download date)

Task 2 is now organised like this:
```
Task2/
├── cleaned/      the 12 cleaned files (date,value): done ✅
├── raw/          the original Giovanni downloads: ⏳ upload them here
├── data_io.py    loads the data (reads cleaned/)
├── SOURCES.md    where every file comes from
└── NEXT_STEPS.md this file
```
NO₂ was dropped (not available in Giovanni's web interface), so there are **12 files**, not 15.

Two things are left. It takes about 10 minutes.

---

## Part 1: upload the 12 raw Giovanni files to `Task2/raw/`

1. On your computer, find the **original files exactly as downloaded from Giovanni**: they start
   with lines like `User Start Date:` and `User Bounding Box:` (not `date,value`).
2. Make sure they're named exactly like the cleaned files:
   ```
   lake_mead_TEMP.csv  lake_mead_RAIN.csv  lake_mead_SOILM.csv  lake_mead_EVAP.csv
   niamey_TEMP.csv     niamey_RAIN.csv     niamey_SOILM.csv     niamey_EVAP.csv
   svalbard_TEMP.csv   svalbard_RAIN.csv   svalbard_SOILM.csv   svalbard_EVAP.csv
   ```
   Lost one? Download it again on https://giovanni.gsfc.nasa.gov/giovanni/ the same way as before
   (Time Series, Area-Averaged; 2001-01-01 to 2024-12-31; same box). Don't open/save them in Excel.
3. Go to https://github.com/andrei-saveli/hyperion → open **`Task2`** → open **`raw`**.
4. Click **Add file** → **Upload files**, drag in the 12 files.
5. Commit message: `Add raw Giovanni downloads` → **Commit changes**.

Check: `Task2/raw/` now shows the 12 CSV files plus `README.md`.

---

## Part 2: fix the download date in `SOURCES.md`

1. In `Task2`, click **`SOURCES.md`** → pencil icon ✏️ (Edit).
2. Find the line starting with `Download date:` and put the real date you downloaded the files, e.g.:
   ```
   Download date: 2026-11-14.
   ```
3. In "How the data was made", step 4, change `(⏳ to be uploaded)` to `(✅ uploaded)`.
4. Commit message: `Update SOURCES download date` → **Commit changes**.

---

## Part 3: tell the team

> *"The 12 raw Giovanni files are in Task2/raw. SOURCES.md updated."*

The team lead will then re-run the converter on the raw files and compare them value by value with
`cleaned/`. That proves the cleaned data matches NASA's originals exactly.
