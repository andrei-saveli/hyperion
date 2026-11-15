"""Regression tests for matching calendar months and paired trend uncertainty."""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from scipy.stats import t

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from investigation import compare_period, match_months, period_in_question, slice_period  # noqa: E402


def test_dates_and_missing_months():
    assert period_in_question("Rainfall from 2002 to 2014") == ("2002-01", "2014-12")
    assert period_in_question("Rainfall since 2014") == ("2014-01", None)
    dates = pd.date_range("2002-01-01", periods=4, freq="MS")
    a = pd.DataFrame({"date": dates, "value": [1, 2, 3, 4]})
    b = pd.DataFrame({"date": dates[[1, 3]], "value": [5, 6]})
    paired = match_months(a, b)
    assert paired["date"].tolist() == list(dates[1:])
    assert paired.loc[1, ["a", "b"]].isna().all()
    assert compare_period(slice_period(paired, ("2002-02", "2002-03"))) == (None, None)


def test_interval_matches_a_hand_calculable_case():
    months = np.arange(144)
    dates = pd.date_range("2000-01-01", periods=len(months), freq="MS")
    baseline = np.sin(dates.month)
    residuals = np.zeros(len(dates))
    residuals[[0, 12, 24]] = [1, -2, 1]
    paired = pd.DataFrame({"date": dates, "a": baseline + 3 * months / 120 + residuals, "b": baseline})
    slope, interval = compare_period(paired)

    # Only three scores are nonzero. The first two pairs are 12 months apart.
    variance = 123.5 - (2 / 13) * 81
    margin = 10 * t.ppf(0.975, 131) * np.sqrt(variance * 144 / 131) / 1716
    assert slope == pytest.approx(3)
    assert interval == pytest.approx((3 - margin, 3 + margin))
