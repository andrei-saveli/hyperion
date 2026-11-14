# Task3 · Person 3

- [Person 3 handover](PERSON_3_SEARCH_EXPLAINABILITY_HANDOVER.md)
- [Searchlight model card and setup](models/search/MODEL_CARD.md)
- [Shared plan](../docs/PLAN.md) and [frozen interfaces](../docs/HANDSHAKES.md)

`search.py` provides H4 using the place and variable catalogs in `data/`. It ranks keywords and
only suggests combinations with a local monthly series. The catalog covers the three regions
already downloaded by Task2. Searchlight is an optional experiment for queries that keyword
search cannot answer. See its model card for setup and the remaining review steps.

`explain.py` provides H3. Pass the H2 analysis and the selected H0 variable and place. The returned `headline` is the card verdict, `details` goes under **What does this mean?**, and `caveat` goes under **Data and method**. The frontend reads the numeric fields from H2 and checks series provenance against [the data handover](../Task2/SOURCES.md).

`pages/1_Guided_demo.py` shows Lake Mead temperature, Niamey evaporation, and a temperature
comparison. `pages/2_How_it_works.py` explains the method and how to read a verdict.
From the repository root, run `python Task4/scripts/combine.py --frontend PATH`, using the
frontend checkout with `app.py` and `charts.py`. Then enter `final/` and run
`streamlit run app.py`. Both pages appear in Streamlit's page navigation.

From the repository root, run `python Task4/scripts/check_handshakes.py` for the integration
checks. From Task3, run `python -m pytest -q scripts/test_search.py` for search tests.
