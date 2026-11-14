# Task3 · Person 3

- [Person 3 handover](PERSON_3_SEARCH_EXPLAINABILITY_HANDOVER.md)
- [Searchlight model card and setup](models/search/MODEL_CARD.md)
- [Pretrained search benchmark](PRETRAINED_BENCHMARK.md)
- [Coverage-check experiment](COVERAGE_BENCHMARK.md)
- [Shared plan](../docs/PLAN.md) and [frozen interfaces](../docs/HANDSHAKES.md)

`search.py` provides H4 using Searchlight. It indexes the place and variable catalogs in `data/`
against the twelve local monthly series in `Task2/cleaned/`. Set up the required local model
artifacts before starting the app or running the handshake checker. See the model card for
the build commands and the difference between a provisional build and release evaluation.
For a fresh combined app, install `requirements-search.txt` as well as `requirements.txt`.

`explain.py` provides H3. Pass the H2 analysis and the selected H0 variable and place. The returned `headline` is the card verdict, `details` goes under **What does this mean?**, and `caveat` goes under **Data and method**. The frontend reads the numeric fields from H2 and checks series provenance against [the data handover](../Task2/SOURCES.md).

`pages/1_Guided_demo.py` shows Lake Mead temperature, Niamey evaporation, and a temperature
comparison. `pages/2_How_it_works.py` explains the method and how to read a verdict.
From the repository root, run `python Task4/scripts/combine.py --frontend PATH`, using the
frontend checkout with `app.py` and `charts.py`. Then enter `final/` and run
`streamlit run app.py`. Both pages appear in Streamlit's page navigation.

From the repository root, run `python Task4/scripts/check_handshakes.py` for the integration
checks. From Task3, run `python -m pytest -q scripts/test_search.py` for search tests.
