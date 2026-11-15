# Byte Me Analitics browser demo

This demo uses the [frontend archive](https://github.com/andrei-saveli/frontend-nasa/tree/b0602eb)
and Hyperion's saved NASA Giovanni time series. It covers Lake Mead, Niamey, and Svalbard from
2001 through 2024, with air temperature, rainfall, root-zone soil moisture, and evaporation.

From the Hyperion repository root, using Python 3.11 or newer:

```sh
python Task4/scripts/combine.py --frontend FrontEnd_nasa --out final/streamlit --no-checks
cd final/streamlit
pip install -r requirements.txt
streamlit run app.py
```

Open [the local demo](http://127.0.0.1:8501). Choose **Start** and enter
`Lake Mead from 2005 to 2020`. The Query page matches a place name or alias and extracts the
dates. Use **Months to analyze** to adjust the period after opening the results.
**Compare with another place** uses the same valid months for both locations. The comparison
shows the difference in trends, offers a recent-period check, and includes an approximate
95% interval when the data support one.

The query uses deterministic text matching and the browser reads the bundled data through
the local app. The bar and comparison controls live in `investigation_view.py`. The statistical
helpers live in `Task4/investigation.py`.
