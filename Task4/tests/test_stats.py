"""Tests for stats.py: fake series where we know the right answer.

Run from the Task4 folder:  python -m pytest -q
"""
import json
import os
import sys

import numpy as np
import pandas as pd
import pytest
from scipy import stats as sps

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from stats import (RESULT_KEYS, analyze, deseasonalize, deseasonalize_with_trend, mann_kendall,  # noqa: E402
                   seasonal_mann_kendall, seasonal_sen_slope, years_to_significance)
from stats import tests_agree as agreement  # noqa: E402  (renamed so pytest doesn't treat it as a test)

H2_KEYS = {  # the keys promised in docs/HANDSHAKES.md (H2)
    "slope_per_decade", "ci_low", "ci_high", "p_value", "mk_p_value", "total_change",
    "start", "end", "n_months", "n_missing", "direction", "verdict", "emoji",
    "anomaly", "trend", "band_low", "band_high", "years_to_significance", "method",
}


def make_series(slope_per_decade=0.0, season=10.0, noise=1.0, phi=0.0, months=288, seed=0,
                start="2001-01-01"):
    """Fake monthly series: trend + seasonal cycle + (optionally correlated) noise."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, periods=months, freq="MS")
    t = np.arange(months) / 120  # decades
    e = np.zeros(months)
    shocks = rng.normal(0, noise, months)
    for i in range(months):  # AR(1): each month remembers part of the previous one
        e[i] = (phi * e[i - 1] if i else 0) + shocks[i]
    seasons = season * np.sin(2 * np.pi * (dates.month - 4) / 12)
    return pd.DataFrame({"date": dates, "value": 15 + slope_per_decade * t + seasons + e})


# ------------------------------------------------------------------ handshake shape

def test_result_has_every_handshake_key_and_is_json():
    r = analyze(make_series(0.5))
    assert H2_KEYS <= set(r)
    assert set(r) == set(RESULT_KEYS)
    json.dumps(r)  # must be JSON-friendly (no NaN, no numpy types)
    n = 288
    for key in ("anomaly", "trend", "band_low", "band_high"):
        assert len(r[key]) == n


# ------------------------------------------------------------------ correctness

def test_known_positive_slope_is_recovered():
    r = analyze(make_series(slope_per_decade=0.5, noise=0.3, seed=1))
    assert r["slope_per_decade"] == pytest.approx(0.5, abs=0.1)
    assert r["ci_low"] < 0.5 < r["ci_high"]
    assert r["verdict"] == "significant" and r["emoji"] == "🟢"
    assert r["direction"] == "increase"
    assert r["total_change"] == pytest.approx(r["slope_per_decade"] * 287 / 120, rel=1e-9)


def test_known_negative_slope_is_recovered():
    r = analyze(make_series(slope_per_decade=-0.8, noise=0.5, seed=2))
    assert r["slope_per_decade"] == pytest.approx(-0.8, abs=0.15)
    assert r["direction"] == "decrease" and r["verdict"] == "significant"
    assert r["mk_p_value"] < 0.05
    assert r["sen_slope_per_decade"] == pytest.approx(-0.8, abs=0.2)


def joint_regression_slope(df):
    """Reference answer: one big regression, value ~ 12 month averages + slope x time."""
    ok = df["value"].notna().to_numpy()
    t = np.arange(len(df))[ok] / 12
    dummies = np.eye(12)[df["date"].dt.month.to_numpy()[ok] - 1]
    X = np.column_stack([dummies, t])
    coef, *_ = np.linalg.lstsq(X, df["value"].to_numpy()[ok], rcond=None)
    return coef[-1]


def test_slope_matches_joint_regression_with_month_averages():
    df = make_series(0.3, seed=3)
    assert analyze(df)["slope_per_decade"] == pytest.approx(joint_regression_slope(df) * 10, rel=1e-9)


def test_slope_matches_joint_regression_with_gaps_and_partial_years():
    df = make_series(0.3, seed=5, months=200, start="2003-07-01")   # starts in July, ends in February
    df.loc[[5, 6, 40, 41, 42, 120], "value"] = np.nan
    assert analyze(df)["slope_per_decade"] == pytest.approx(joint_regression_slope(df) * 10, rel=1e-9)


def test_slope_matches_ordinary_regression_on_anomalies():
    df = make_series(0.3, seed=3)
    r = analyze(df)
    anom = deseasonalize_with_trend(df["value"], df["date"])
    ref = sps.linregress(np.arange(len(df)) / 12, anom)
    assert r["slope_per_decade"] == pytest.approx(ref.slope * 10, rel=1e-9)


def test_joint_fit_recovers_exact_trend_where_plain_averages_fall_short():
    # No noise, record starts mid-year: the joint fit is exact, the plain one slightly too small.
    df = make_series(1.0, noise=0.0, months=150, start="2001-07-01")
    assert analyze(df)["slope_per_decade"] == pytest.approx(1.0, rel=1e-9)
    plain = sps.linregress(np.arange(len(df)) / 120, deseasonalize(df["value"], df["date"])).slope
    assert plain < 0.999


def test_seasons_only_gives_flat_anomalies():
    r = analyze(make_series(0.0, season=10, noise=0.0))
    assert abs(r["slope_per_decade"]) < 1e-9
    assert max(abs(v) for v in r["anomaly"]) < 1e-9
    assert r["verdict"] == "none" and r["emoji"] == "⚪"


def test_mann_kendall_matches_kendall_tau_without_correction():
    y = make_series(0.2, seed=4)["value"].to_numpy()
    ours = mann_kendall(y, n_ratio=1.0)
    ref = sps.kendalltau(np.arange(len(y)), y, method="asymptotic").pvalue
    assert ours == pytest.approx(ref, rel=0.05)


# ------------------------------------------------------------------ honesty of the p-value

def false_positive_rate(phi, use_correction=True, runs=300):
    hits = 0
    for seed in range(runs):
        df = make_series(0.0, phi=phi, seed=seed)
        if use_correction:
            hits += analyze(df)["p_value"] < 0.05
        else:  # naive: ordinary regression that ignores month-to-month correlation
            anom = deseasonalize(df["value"], df["date"])
            hits += sps.linregress(np.arange(len(df)), anom).pvalue < 0.05
    return hits / runs


def test_no_trend_is_rarely_called_significant():
    rate = false_positive_rate(phi=0.0)
    assert rate <= 0.09  # should be about 5%


def test_correlation_correction_prevents_false_alarms():
    corrected = false_positive_rate(phi=0.7)
    naive = false_positive_rate(phi=0.7, use_correction=False)
    assert corrected <= 0.12          # close to 5%
    assert naive > corrected + 0.1    # ignoring correlation cries wolf much more often


def test_correlated_noise_gives_wider_interval():
    white = analyze(make_series(0.0, phi=0.0, seed=7))
    red = analyze(make_series(0.0, phi=0.7, seed=7))
    assert red["effective_n"] < white["effective_n"]
    assert (red["ci_high"] - red["ci_low"]) > (white["ci_high"] - white["ci_low"])


# ------------------------------------------------------------------ robustness

def test_missing_months_are_skipped_not_zero():
    df = make_series(0.5, noise=0.3, seed=8)
    rng = np.random.default_rng(8)
    gaps = rng.choice(len(df), size=50, replace=False)
    df.loc[gaps, "value"] = np.nan
    r = analyze(df)
    assert r["n_missing"] == 50
    assert all(r["anomaly"][i] is None for i in gaps)
    assert r["slope_per_decade"] == pytest.approx(0.5, abs=0.15)
    assert all(v is not None for v in r["trend"])  # line is drawn through the gaps


def test_late_start_uses_first_valid_month():
    df = make_series(0.5, noise=0.3, seed=9)
    df.loc[:45, "value"] = np.nan  # e.g. NO₂ only starts in late 2004
    r = analyze(df)
    assert r["start"] == "2004-11" and r["end"] == "2024-12"


def test_too_short_record_is_insufficient():
    r = analyze(make_series(0.5, months=20))
    assert r["verdict"] == "insufficient" and r["emoji"] == "⚫"
    for key in ("slope_per_decade", "ci_low", "ci_high", "p_value", "total_change"):
        assert r[key] is None
    json.dumps(r)


def test_eight_year_record_is_insufficient():
    r = analyze(make_series(1.0, noise=0.1, months=96))  # 8 years, even with a strong trend
    assert r["verdict"] == "insufficient" and r["slope_per_decade"] is None


def test_ten_year_record_gets_a_verdict():
    assert analyze(make_series(1.0, noise=0.1, months=121))["verdict"] == "significant"


def test_mostly_missing_record_is_insufficient():
    df = make_series(0.5)
    df.loc[20:, "value"] = np.nan
    assert analyze(df)["verdict"] == "insufficient"


def test_constant_series_does_not_crash():
    df = make_series(0.0, season=0, noise=0)
    r = analyze(df)
    assert r["verdict"] == "none" and r["p_value"] == 1.0


def test_unsorted_rows_and_text_dates_are_handled():
    df = make_series(0.5, noise=0.3, seed=10)
    shuffled = df.sample(frac=1, random_state=1).assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d"))
    assert analyze(shuffled)["slope_per_decade"] == pytest.approx(analyze(df)["slope_per_decade"])


# ------------------------------------------------------------------ years until significant

def test_significant_trend_needs_no_more_years():
    assert analyze(make_series(0.5, noise=0.3, seed=1))["years_to_significance"] is None


def test_weak_trend_gets_a_positive_estimate():
    hits = []
    for seed in range(20):
        r = analyze(make_series(0.15, noise=1.0, phi=0.3, seed=seed))
        if r["verdict"] in ("possible", "none") and r["years_to_significance"] is not None:
            hits.append(r["years_to_significance"])
    assert hits and all(0 <= h <= 100 for h in hits)


def test_horizon_grows_as_the_trend_gets_less_clear():
    near = years_to_significance(1.8, 24, "possible")
    far = years_to_significance(0.8, 24, "none")
    assert 0 < near < far


def test_horizon_matches_the_t_test():
    # a trend that is exactly at the significance line needs no more years
    assert years_to_significance(1.96, 24, "none") == 0
    # half the t-value -> needs 2**(2/3) ≈ 1.59 times the record length in total
    assert years_to_significance(0.98, 24, "none") == pytest.approx(24 * (2 ** (2 / 3) - 1), abs=0.1)


def test_horizon_hidden_when_it_makes_no_sense():
    assert years_to_significance(0.3, 24, "none") is None          # direction unclear
    assert years_to_significance(1.5, 5, "none") is None           # record too short
    assert years_to_significance(0.51, 24, "none") is not None     # just clear enough
    assert years_to_significance(3.0, 24, "significant") is None   # already significant
    assert analyze(make_series(0.5, months=20))["years_to_significance"] is None


# ------------------------------------------------------------------ reliability

def test_normal_record_has_good_reliability():
    r = analyze(make_series(0.5, noise=0.3, seed=1))
    assert r["reliability"] == "good" and r["reliability_note"] is None


def test_very_sticky_record_is_flagged_low():
    r = analyze(make_series(0.0, phi=0.98, seed=3))  # each month ≈ the previous one
    assert r["effective_n"] < 30
    assert r["reliability"] == "low" and "caution" in r["reliability_note"]


def test_insufficient_record_has_no_reliability():
    r = analyze(make_series(0.5, months=20))
    assert r["reliability"] is None


# ------------------------------------------------------------------ percent change

def test_percent_change_for_rain_like_variables():
    df = make_series(0.5, season=0, noise=0.0)  # level 15, +0.5 per decade over 23.9 years
    r = analyze(df, code="RAIN")
    expected = r["total_change"] / df["value"].mean() * 100
    assert r["percent_change"] == pytest.approx(expected)
    assert r["percent_change"] == pytest.approx(1.2 / 15.6 * 100, rel=0.05)


def test_no_percent_change_for_temperature_or_unknown_variable():
    df = make_series(0.5, noise=0.3, seed=1)
    assert analyze(df, code="TEMP")["percent_change"] is None
    assert analyze(df)["percent_change"] is None


def test_no_percent_change_when_values_go_below_zero():
    df = make_series(-0.5, season=0.2, noise=0.1, seed=4)
    df["value"] = df["value"] - 15.1  # small average, some negative months
    assert df["value"].min() < 0
    assert analyze(df, code="EVAP")["percent_change"] is None


# ------------------------------------------------------------------ seasonal Mann-Kendall

def test_seasonal_mk_ignores_the_seasonal_cycle():
    df = make_series(0.0, season=10, noise=1.0, seed=11)
    p = seasonal_mann_kendall(df["value"].to_numpy(), df["date"].dt.month.to_numpy())
    assert p > 0.05


def test_seasonal_mk_finds_a_real_trend():
    df = make_series(0.8, season=10, noise=0.5, seed=12)
    months = df["date"].dt.month.to_numpy()
    assert seasonal_mann_kendall(df["value"].to_numpy(), months) < 0.001
    years = np.arange(len(df)) / 12
    assert seasonal_sen_slope(df["value"].to_numpy(), months, years) * 10 == pytest.approx(0.8, abs=0.15)


def test_seasonal_mk_on_a_hand_checked_example():
    # 3 Januaries going up (S=+3) and 3 Februaries going down (S=-3): they cancel -> p = 1
    values = np.array([1, 9, 2, 8, 3, 7], dtype=float)
    months = np.array([1, 2, 1, 2, 1, 2])
    assert seasonal_mann_kendall(values, months) == pytest.approx(1.0)


# ------------------------------------------------------------------ do the two tests agree?

def test_clear_trend_both_tests_agree():
    r = analyze(make_series(0.8, noise=0.5, seed=12))
    assert r["tests_agree"] is True and r["tests_note"] is None


def test_disagreement_rules():
    assert agreement(0.01, 0.30, 1.0, 1.0) == (False, agreement(0.01, 0.30, 1.0, 1.0)[1])  # one significant, other far
    assert agreement(0.30, 0.01, 1.0, 1.0)[0] is False
    assert agreement(0.04, 0.06, 1.0, 1.0)[0] is True      # just either side of the line: fine
    assert agreement(0.08, 0.40, 1.0, -1.0)[0] is False    # opposite directions near significance
    assert agreement(0.50, 0.70, 1.0, -1.0)[0] is True     # opposite but both nowhere near: no story
    assert agreement(0.01, float("nan"), 1.0, 1.0) == (None, None)


def test_band_meaning_is_explained():
    r = analyze(make_series(0.5, noise=0.3, seed=1))
    assert "trend line" in r["band_meaning"] and "not the range" in r["band_meaning"]
    # the band really is narrower than the spread of the monthly anomalies
    width = np.nanmean(np.array(r["band_high"]) - np.array(r["band_low"]))
    assert width < np.nanstd(np.array(r["anomaly"], dtype=float))
