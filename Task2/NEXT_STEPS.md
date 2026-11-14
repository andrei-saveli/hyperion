# Task 2: next steps (NO₂ data, raw files, SOURCES date)

Three things are left. Follow the steps in order; it takes about 30–45 minutes.
You need your **Earthdata login** and the folder on your computer where you made the 12 cleaned files.

---

## Part 1: download the 3 NO₂ files from Giovanni

Do this **3 times**, once per place.

| Place | Save the download as | Box: West, South, East, North |
|---|---|---|
| Lake Mead | `lake_mead_NO2.csv` | −116, 35, −113, 37.5 |
| Niamey | `niamey_NO2.csv` | 1.0, 12.5, 3.0, 14.5 |
| Svalbard | `svalbard_NO2.csv` | 14.0, 77.5, 17.0, 79.0 |

1. Open https://giovanni.gsfc.nasa.gov/giovanni/ and **log in** (top right) with Earthdata.
2. **Select Plot:** choose **"Time Series, Area-Averaged"** (same as for the other files).
3. **Select Date Range:**
   - Begin: **2004-10-01** (the OMI satellite instrument starts in October 2004)
   - End: **2024-12-31**
4. **Select Region:** type the box from the table, e.g. for Lake Mead: `-116, 35, -113, 37.5`
   (order: West, South, East, North).
5. **Select Variables:** in the search box type **`OMNO2d`**. Tick the variable called
   **"NO2 Tropospheric Column (30% Cloud Screened)"**, product **OMNO2d v003**.
   ⚠️ *Tropospheric*, not *Total*: we want the pollution near the ground.
6. Click **Plot Data**. It's daily data for 20 years, so it can take a few minutes. Wait.
7. When the chart appears: **Downloads** → **CSV**.
8. Rename the downloaded file exactly as in the table (e.g. `lake_mead_NO2.csv`).
   Don't open and save it in Excel: that can change the file.

✅ After Part 1 you have 3 new raw files.

---

## Part 2: put all 15 raw files in one folder

1. On your computer, inside your Task 2 folder, make a folder called **`raw`**.
2. Put in it **all 15 original Giovanni downloads**, untouched, named `<place>_<CODE>.csv`:
   ```
   raw/lake_mead_TEMP.csv   raw/lake_mead_RAIN.csv   raw/lake_mead_SOILM.csv   raw/lake_mead_EVAP.csv   raw/lake_mead_NO2.csv
   raw/niamey_TEMP.csv      raw/niamey_RAIN.csv      raw/niamey_SOILM.csv      raw/niamey_EVAP.csv      raw/niamey_NO2.csv
   raw/svalbard_TEMP.csv    raw/svalbard_RAIN.csv    raw/svalbard_SOILM.csv    raw/svalbard_EVAP.csv    raw/svalbard_NO2.csv
   ```
   These are the files straight from Giovanni (they start with lines like `User Start Date:`),
   **not** the cleaned ones (which start with `date,value`).
   Lost an original? Download it again from Giovanni the same way (dates 2001-01-01 to 2024-12-31).

---

## Part 3: clean the NO₂ files with the same converter

1. Open `convert_giovanni.py` (the one you used before, from
   `docs/PERSON_2_DATA_GIOVANNI_HANDOVER.md`).
2. Change **two lines** near the top so it reads your `raw` folder and writes into a new
   `cleaned` folder (so your existing files aren't overwritten):
   ```python
   RAW = Path("raw")
   OUT = Path("cleaned")
   ```
   and add this line right below them:
   ```python
   OUT.mkdir(exist_ok=True)
   ```
3. Open a terminal **in your Task 2 folder** (the one that contains `raw`) and run:
   ```bash
   python convert_giovanni.py
   ```
4. It prints one line per file. For the NO₂ files expect something like:
   ```
   lake_mead_NO2: 288 months, 45 missing
   niamey_NO2: 288 months, 45 missing
   svalbard_NO2: 288 months, 70 missing
   ```
   - **45 missing is correct**: 2001-01 to 2004-09 is before the instrument existed.
   - **Svalbard can have more missing**: in winter it's dark (polar night) and the satellite can't
     measure. That's expected.
5. Quick look inside `cleaned/lake_mead_NO2.csv`:
   - the first rows have an **empty** value (`2001-01-01,`)
   - from `2004-10-01` there are numbers, roughly **0.3 to 10** (that's ×10¹⁵ molecules/cm²)
   - if you see huge numbers like `3000000000000000`, the unit conversion didn't run: tell the team lead.

✅ After Part 3 you have `cleaned/lake_mead_NO2.csv`, `cleaned/niamey_NO2.csv`,
`cleaned/svalbard_NO2.csv`. (The other 12 in `cleaned/` you don't need to upload; the team lead
will use them to double-check.)

---

## Part 4: upload to GitHub (website)

### 4a. The 15 raw files → `Task2/raw/`
1. Go to https://github.com/andrei-saveli/hyperion and click the **`Task2`** folder.
2. Click **Add file** → **Upload files**.
3. **Drag the whole `raw` folder** from your computer into the page. GitHub keeps the folder, so
   the files land in `Task2/raw/`. (Check the list shows `raw/lake_mead_TEMP.csv` etc.)
4. At the bottom, commit message: `Add raw Giovanni downloads` → **Commit changes**.

### 4b. The 3 cleaned NO₂ files → `Task2/`
1. Back in the **`Task2`** folder: **Add file** → **Upload files**.
2. Drag in **only** `lake_mead_NO2.csv`, `niamey_NO2.csv`, `svalbard_NO2.csv` from `cleaned/`.
3. Commit message: `Add cleaned NO2 files` → **Commit changes**.

---

## Part 5: update `SOURCES.md` (on the GitHub website)

1. In the `Task2` folder, click **`SOURCES.md`**, then the **pencil icon ✏️** (Edit).
2. Find the line:
   ```
   Download date: 2026-11-14 (files uploaded to the repository). Update this if re-downloaded.
   ```
   Replace it with the real date(s), for example:
   ```
   Download date: TEMP, RAIN, SOILM, EVAP on 2026-11-14; NO2 on 2026-11-15.
   ```
3. In the **Files** table, for the 3 NO₂ rows change `⏳ to download` to `✅`.
4. In "How the data was made", step 4, delete the words `(*to be uploaded*)`.
5. Commit message: `Update SOURCES: download dates and NO2` → **Commit changes**.

---

## Part 6: tell the team

Send in the team chat:
> *"NO₂ files and all 15 raw Giovanni files are in Task2. SOURCES.md updated."*

The team lead will then:
- re-run the converter on your raw files and compare value by value with the cleaned files
- run the automatic checker (all 15 files should pass)
- run the trend analysis on NO₂

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Can't find the NO₂ variable in Giovanni | Search `NO2` and pick the one with **OMNO2d** and **Tropospheric** and **Cloud Screened** in its name |
| Giovanni says the date range is invalid | Begin date must be **2004-10-01** or later for NO₂ |
| Plot takes very long or fails | Try again; or split into two downloads (2004–2014 and 2015–2024) and tell the team lead |
| Converter error | Copy the full error and paste it to your AI chat together with this file; or send it to the team lead |
| Converter says `No files in raw` | You're not running it from the folder that contains `raw`; `cd` into it first |
