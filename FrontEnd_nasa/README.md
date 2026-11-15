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

Open [the local demo](http://127.0.0.1:8501). Choose **Start** and open a dataset using
**Browse available data** or Searchlight. Use **Months to analyze** to set the period.
**Compare with another place** uses the same valid months for both locations. The comparison
shows the difference in trends, offers a recent-period check, and includes an approximate
95% interval when the data support one.

## Optional Searchlight setup

From `final/streamlit/`, install and build the search model if it was not already assembled:

```sh
pip install -r requirements-search.txt
python -m scripts.build_search_index --download-models
python -m scripts.train_search_model --allow-draft
```

The browser reads the saved data through the local app without an Earthdata account.
The model setup uses the existing draft Searchlight calibration. If the artifacts are already
built in `Task3/models/search/`, the combine step copies them to `final/streamlit/` and you can skip the
build and calibration commands. **Browse available data** also works without the search model.
See [Task3](../Task3/README.md) for search setup and evaluation details.
