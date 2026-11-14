# Task3 · Person 3

- [Person 3 handover](PERSON_3_SEARCH_EXPLAINABILITY_HANDOVER.md)
- [Searchlight model card and setup](models/search/MODEL_CARD.md)
- [Shared plan](../docs/PLAN.md) and [frozen interfaces](../docs/HANDSHAKES.md)

`search.py` provides H4. The local encoder and ranking code is in `search_model.py`, the question splits are in `data/`, and the index, training, and evaluation commands are in `scripts/`.

From this folder, run `python -m pytest -q scripts/test_search.py` to check Searchlight. The model card describes how to provision the pinned checkpoints for the offline model test.
