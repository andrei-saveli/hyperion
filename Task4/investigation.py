"""Date selection and paired comparisons for the Streamlit investigation."""

import re

import numpy as np
import pandas as pd
from scipy.stats import t

from stats import analyze, decimal_years


def period_in_question(question):
    """Read an explicit inclusive year or month range, or a starting date."""
    month = r"(\d{4}(?:-\d{2})?)"
    span = re.search(rf"\b{month}\s*(?:to|through|and|[-–—])\s*{month}\b", question, re.I)
    start = re.search(rf"\b(?:since|from)\s+{month}\b", question, re.I) if not span else None
    if not (span or start):
        return None
    first, last = span.groups() if span else (start.group(1), None)
    try:
        first = str(pd.Period(first, freq="M"))
        last = str(pd.Period(last if len(last) > 4 else last + "-12", freq="M")) if last else None
    except ValueError:
        return None
    return (first, last) if last is None or first <= last else None


def slice_period(df, period):
    """Keep the months in an inclusive (YYYY-MM, YYYY-MM) range."""
    dates = df["date"].dt.strftime("%Y-%m")
    return df.loc[dates.between(*period)].reset_index(drop=True)


def match_months(a, b):
    """Keep the overlapping calendar with gaps where either observation is missing."""
    if a.empty or b.empty:
        return pd.DataFrame({"date": pd.DatetimeIndex([]), "a": [], "b": []})
    start = max(a["date"].min(), b["date"].min())
    end = min(a["date"].max(), b["date"].max())
    calendar = pd.date_range(start, end, freq="MS", name="date")
    paired = pd.concat([a.set_index("date")["value"], b.set_index("date")["value"]], axis=1,
                       keys=["a", "b"]).reindex(calendar)
    paired.loc[~np.isfinite(paired).all(axis=1), :] = np.nan
    return paired.reset_index()


def fit_period(df, code, full, full_fit=None):
    """Fit a window. For a short window, display anomalies from its full-record baseline."""
    result = full_fit if full_fit is not None and len(df) == len(full) else analyze(df, code=code)
    if result["verdict"] == "insufficient":
        baseline_fit = full_fit if full_fit is not None else analyze(full, code=code)
        anomalies = pd.Series(baseline_fit["anomaly"], index=full["date"], dtype="float64")
        chart_values = anomalies.reindex(df["date"]).where(df["value"].notna().to_numpy())
        result = {**result, "anomaly": [float(x) if pd.notna(x) else None for x in chart_values]}
    return result


def compare_period(paired):
    """Estimate the trend in A minus B and its calendar-lag-adjusted interval."""
    difference = paired["a"] - paired["b"]
    fit = analyze(paired.assign(value=difference)[["date", "value"]])
    slope = fit["slope_per_decade"]
    if slope is None or fit["reliability"] == "low":
        return slope, None

    # Partial out calendar-month offsets before forming the slope's regression scores.
    # Keep gaps in the scores so Newey–West weights are based on actual calendar lags.
    valid = difference.notna()
    time = pd.Series(decimal_years(paired["date"]), index=paired.index).where(valid)
    months = paired["date"].dt.month
    adjusted_time = time - time.groupby(months).transform("mean")
    scores = (adjusted_time * (np.asarray(fit["anomaly"], dtype=float) - fit["trend"])).fillna(0).to_numpy()
    n = int(valid.sum())
    df = n - months[valid].nunique() - 1
    time_variation = (adjusted_time ** 2).sum()
    if df <= 0 or time_variation <= 0:
        return slope, None
    lags = 12
    variance = scores @ scores
    for lag in range(1, lags + 1):
        variance += 2 * (1 - lag / (lags + 1)) * (scores[lag:] @ scores[:-lag])
    margin = 10 * t.ppf(0.975, df) * np.sqrt(max(0, variance) * n / df) / time_variation
    return slope, (float(slope - margin), float(slope + margin))
