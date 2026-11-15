# Byte Me Analitics browser demo

This demo uses the [frontend archive](https://github.com/andrei-saveli/frontend-nasa/tree/b0602eb)
and Hyperion's saved NASA Giovanni time series. It covers Lake Mead, Niamey, and Svalbard from
2001 through 2024, with air temperature, rainfall, root-zone soil moisture, and evaporation.

From the Hyperion repository root, using Python 3.11 or newer:

```sh
python Task4/scripts/combine.py --frontend FrontEnd_nasa --no-checks
python -m pip install -r final/requirements.txt -r final/requirements-search.txt
cd final
python -m scripts.build_search_index --download-models
python -m scripts.train_search_model --allow-draft
python -m streamlit run app.py --server.address 127.0.0.1
```

Open [the local demo](http://127.0.0.1:8501). **Guided demo** walks through Lake Mead
air temperature, Niamey evaporation, and a comparison of temperature trends in both
places. **Start** opens Searchlight. Try `Is the Arctic warming?`, then open one of the ranked
datasets. Adjust **Years to analyze** to focus on a shorter period or use **Remove seasons**
to see the raw monthly series.

The browser reads the saved data through the local app without an Earthdata account.
The model setup uses the existing draft Searchlight calibration. If the artifacts are already
built in `Task3/models/search/`, the combine step copies them to `final/` and you can skip the
build and calibration commands. **Browse available data** also works without the search model.
See [Task3](../Task3/README.md) for search setup and evaluation details.
