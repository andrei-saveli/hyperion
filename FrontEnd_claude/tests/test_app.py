"""Smoke tests for the website: every place × measurement, demo buttons, toggle and compare tab.

Run from the repository root:  python -m pytest -q FrontEnd_claude
"""
import sys
from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]
APP = str(ROOT / "app.py")


def run_app():
    at = AppTest.from_file(APP, default_timeout=90).run()
    assert not at.exception, [e.message for e in at.exception]
    return at


def test_starts_with_a_demo_case_and_a_verdict():
    at = run_app()
    labels = [m.label for m in at.metric]
    assert "Change per decade" in labels and "p-value" in labels
    assert any("hy-card" in m.value for m in at.markdown)


def test_every_place_and_measurement_renders():
    """All 12 combinations show a verdict without errors."""
    sys.path[:0] = [str(ROOT.parent / "Task2")]
    from data_io import load_places, load_variables

    at = run_app()
    combos = [(p, c) for p in load_places()["id"] for c in load_variables()["code"]]
    assert len(combos) >= 12
    for place_id, code in combos:
        at.session_state["place"], at.session_state["code"] = place_id, code
        at.run()
        assert not at.exception, (place_id, code, [e.message for e in at.exception])
        assert not at.error, (place_id, code, [e.value for e in at.error])
        assert any("hy-card" in m.value for m in at.markdown), (place_id, code)


def test_demo_buttons_switch_the_investigation():
    at = run_app()
    demo = [b for b in at.button if "Arctic" in b.label][0]
    demo.click().run()
    assert at.session_state["place"] == "svalbard" and at.session_state["code"] == "TEMP"
    assert not at.exception


def test_low_reliability_and_years_estimate_are_shown():
    at = run_app()
    at.session_state["place"], at.session_state["code"] = "lake_mead", "SOILM"
    at.run()
    assert any("caution" in w.value for w in at.warning)
    at.session_state["place"], at.session_state["code"] = "niamey", "EVAP"
    at.run()
    assert any("more years" in i.value for i in at.info)


def test_seasons_toggle_and_search_box_dont_crash():
    at = run_app()
    at.toggle[0].set_value(False).run()
    assert not at.exception
    at.text_input[0].set_value("is the desert drying out").run()
    assert not at.exception


def test_compare_tab_has_two_cards():
    at = run_app()
    cards = [m for m in at.markdown if "hy-card" in m.value]
    assert len(cards) >= 3  # 1 investigate + 2 compare


def test_search_exploration_shows_trend_interval_and_opens_dataset(monkeypatch):
    at = run_app()
    import search

    monkeypatch.setattr(search, "explore", lambda _: [{
        "place_id": "niamey", "code": "RAIN", "match_label": "Related dataset",
        "reason": "How much rain and snow fall each day on average.",
    }])
    at.text_input[0].set_value("Is Lake Mead shrinking?").run()
    assert not at.exception
    assert any("couldn't confirm a match" in item.value for item in at.caption)
    assert any("95% confidence interval" in item.value and "mm/day per decade" in item.value
               for item in at.caption)
    at.button(key="sugg0").click().run()
    assert not at.exception
    assert at.session_state["place"] == "niamey"
    assert at.session_state["code"] == "RAIN"
