# Byte Me Analitics browser demo

This demo uses the [frontend archive](https://github.com/andrei-saveli/frontend-nasa/tree/b0602eb)
and Hyperion's saved NASA Giovanni time series. It covers Lake Mead, Niamey, and Svalbard from
2001 through 2024, with air temperature, rainfall, root-zone soil moisture, and evaporation.

From the Hyperion repository root, using Python 3.11 or newer:

```sh
python Task4/scripts/combine.py --frontend FrontEnd_nasa --no-checks
python -m pip install -r final/requirements.txt
cd final
python -m streamlit run app.py --server.address 127.0.0.1
```

Open [the local demo](http://127.0.0.1:8501). **Guided demo** walks through Lake Mead
air temperature, Niamey evaporation, and a comparison of temperature trends in both
places. **Start** opens a place-and-year query. Try `Niamey from 2001 to 2024`, then
switch between variables and use **Remove seasons** to see the raw monthly series.

The browser reads the saved data through the local app without an Earthdata account.
The query uses place names and years. The optional Searchlight model is only needed
for the separate H4 search checks documented in [Task3](../Task3/README.md).
