"""Rank available investigations using words from the H0 catalogs (H4)."""

import csv
import logging
import os
import re
from pathlib import Path
from threading import Lock

_DATA = Path(__file__).resolve().parent / "data"
_QUESTION_WORDS = set(
    "a an at around about be can change changes changing compare did do does for get getting "
    "give has have how i in is it like look me more less much of on or out over please see show "
    "tell the to trend trends up vs was were what where which with you".split()
)

_engine = None
_load_attempted = False
_load_lock = Lock()
_log = logging.getLogger(__name__)


def _model_search(text):
    """Try the experimental ranker when explicitly enabled."""
    global _engine, _load_attempted
    try:
        with _load_lock:
            if not _load_attempted:
                _load_attempted = True
                if __package__:
                    from .search_model import SearchEngine
                else:
                    from search_model import SearchEngine

                _engine = SearchEngine.load()
        return _engine.suggest(text) if _engine is not None else []
    except Exception:
        _log.exception("Searchlight unavailable")
        return []


def _words(text):
    return set(re.findall(r"[^\W_]+", text.casefold()))


def _catalog(name):
    with (_DATA / f"{name}.csv").open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def search(text: str) -> list[dict]:
    """Suggest up to five investigations that have a local data file."""
    if not isinstance(text, str) or not (query := _words(text) - _QUESTION_WORDS):
        return []
    try:
        places = _catalog("places")
        variables = _catalog("variables")
    except (OSError, UnicodeError, csv.Error):
        _log.warning("Could not read the search catalogs", exc_info=True)
        return []

    # When run from the Task3 folder, the data team still owns the series in Task2.
    staged_series = _DATA.parent.parent / "Task2" / "cleaned"
    series_dir = staged_series if staged_series.is_dir() else _DATA
    place_matches = []
    for place in places:
        name = _words(place["name"]) | _words(place["id"])
        region = _words(place["type"])
        hits = query & (name | region)
        story_hits = query & (_words(place["story"]) - name - region)
        score = 3 * len(query & name) + len(query & region)
        if hits:
            score += min(1, len(story_hits))
        place_matches.append((place, score, hits))

    variable_matches = []
    for variable in variables:
        name = _words(variable["name"]) | _words(variable["code"])
        # "Air" alone is too broad to identify a measurement.
        name.discard("air")
        hits = query & (name | _words(variable["keywords"]))
        score = 3 * len(query & name) + len(hits - name)
        variable_matches.append((variable, score, hits))

    has_place = any(score for _, score, _ in place_matches)
    has_variable = any(score for _, score, _ in variable_matches)
    results = []
    available = set()
    for place, place_score, place_hits in place_matches:
        for variable, variable_score, variable_hits in variable_matches:
            place_id, code = place["id"], variable["code"]
            if not (series_dir / f"{place_id}_{code}.csv").is_file():
                continue
            available.add((place_id, code))
            if (has_place and not place_score) or (has_variable and not variable_score):
                continue
            # A place alone can browse its series. A place plus an unknown topic cannot.
            if not has_variable and (not has_place or query - place_hits):
                continue
            matches = ", ".join(sorted(place_hits | variable_hits))
            results.append({
                "place_id": place_id,
                "code": code,
                "reason": f"{variable['name']} in {place['name']} matches {matches}.",
                "score": place_score + variable_score,
            })

    results.sort(key=lambda result: result["score"], reverse=True)
    if results or os.getenv("HYPERION_USE_SEARCH_MODEL") != "1":
        return results[:5]
    return [
        result for result in _model_search(text.strip())
        if (result["place_id"], result["code"]) in available
    ][:5]
