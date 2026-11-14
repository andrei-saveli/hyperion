"""Hyperion's H4 entry point."""

import logging
from pathlib import Path
from threading import Lock

_engine = None
_load_attempted = False
_load_lock = Lock()
_log = logging.getLogger(__name__)
_calibration = Path(__file__).resolve().parent / "models" / "search" / "calibrated_config.json"


def search(text: str) -> list[dict]:
    """Suggest up to five executable investigations, ranked by relevance."""
    return _suggest(text, explore=False)


def explore(text: str) -> list[dict]:
    """Offer up to three possible matches or one clearly labeled dataset to explore."""
    return _suggest(text, explore=True)


def _suggest(text, *, explore):
    global _engine, _load_attempted
    if not isinstance(text, str) or not text.strip():
        return []
    try:
        with _load_lock:
            if not _load_attempted:
                # The artifacts may be built while a local app is running.
                if not _calibration.is_file():
                    _log.warning("Build and calibrate Searchlight to enable search.")
                    return []
                _load_attempted = True
                if __package__:
                    from .search_model import SearchEngine
                else:
                    from search_model import SearchEngine

                _engine = SearchEngine.load()
        if _engine is None:
            return []
        return _engine.suggest(text.strip(), explore=True) if explore else _engine.suggest(text.strip())
    except Exception:
        _log.exception("Searchlight unavailable")
        return []
