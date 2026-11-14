"""Hyperion's H4 entry point."""

import logging
from threading import Lock

_engine = None
_load_attempted = False
_load_lock = Lock()
_log = logging.getLogger(__name__)


def search(text: str) -> list[dict]:
    """Suggest up to five executable investigations, ranked by relevance."""
    global _engine, _load_attempted
    if not isinstance(text, str) or not text.strip():
        return []
    try:
        with _load_lock:
            if not _load_attempted:
                _load_attempted = True
                from search_model import SearchEngine

                _engine = SearchEngine.load()
        return _engine.suggest(text.strip()) if _engine is not None else []
    except Exception:
        _log.exception("Searchlight unavailable")
        return []
