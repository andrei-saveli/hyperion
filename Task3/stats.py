"""Trend and significance math for Hyperion (Person 4).

What it does, in plain words
----------------------------
1. Ignore missing months (never treat them as zero).
2. Remove the seasons: subtract each calendar month's average ("anomalies").
3. Fit a straight line through the anomalies -> change per decade and total change.
4. Measure how sure we are: a 95% interval and a t-test p-value, corrected for the fact that
   neighbouring months are similar (otherwise trends look more certain than they are).
5. Double-check with the Mann-Kendall test (does the series keep going up or down?) and
   Sen's slope (a robust rate that ignores outliers).
6. Give a verdict: 🟢 significant · 🟡 possible · ⚪ no clear trend · ⚫ not enough data.
7. Extra, for trends that aren't significant yet: estimate how many more years of data would
   likely be needed ("years until significant"), clearly labelled as an estimate.

The output dictionary is FROZEN by handshake H2 in docs/HANDSHAKES.md. Other people's code reads
these keys, so never rename or remove one. Adding a new key is fine.
"""
import math

import numpy as np
import pandas as pd
from scipy import stats as sps

MIN_MONTHS = 24            # fewer valid months than this -> "insufficient"
SIGNIFICANT_P = 0.05       # 🟢 below this
POSSIBLE_P = 0.10          # 🟡 below this
MAX_LAG1 = 0.95            # cap on month-to-month correlation, keeps the maths stable
MIN_YEARS_FOR_HORIZON = 10 # only estimate "years until significant" for records this long
MAX_HORIZON_YEARS = 100    # beyond this we just say "a very long time" (None)

RESULT_KEYS = [
    "slope_per_decade", "ci_low", "ci_high", "p_value", "mk_p_value", "total_change",
    "start", "end", "n_months", "n_missing", "direction", "verdict", "emoji",
    "anomaly", "trend", "band_low", "band_high", "years_to_significance", "method",
    # extra keys (allowed: they don't break the handshake)
    "sen_slope_per_decade", "lag1_autocorrelation", "effective_n",
]

EMOJI = {"significant": "🟢", "possible": "🟡", "none": "⚪", "insufficient": "⚫"}

METHOD = ("Seasons removed (each month minus its calendar-month average), then a straight-line "
          "trend; the 95% interval and t-test p-value are corrected for month-to-month "
          "correlation. Checked with a Mann-Kendall test and Sen's slope. 'Years until "
          "significant' is a planning estimate (Weatherhead et al., 1998) that assumes nothing "
          "changes; it is not a forecast.")


# ---------------------------------------------------------------- building blocks

def deseasonalize(values: pd.Series, dates: pd.Series) -> pd.Series:
    """Anomalies: each value minus the average of all values from the same calendar month."""
    month = pd.to_datetime(dates).dt.month
    climatology = values.groupby(month).transform("mean")  # NaNs are skipped automatically
    return values - climatology


def decimal_years(dates: pd.Series) -> np.ndarray:
    """Time in years since the first month (Jan 2001 = 0, Feb 2001 = 1/12, ...)."""
    d = pd.to_datetime(dates)
    months = (d.dt.year - d.dt.year.iloc[0]) * 12 + (d.dt.month - d.dt.month.iloc[0])
    return months.to_numpy(dtype=float) / 12.0


def lag1_autocorrelation(residuals: np.ndarray) -> float:
    """How similar each month is to the next one (0 = independent, 1 = identical).

    Only uses pairs of consecutive months where both are present.
    """
    a, b = residuals[:-1], residuals[1:]
    ok = ~np.isnan(a) & ~np.isnan(b)
    if ok.sum() < 3 or np.std(a[ok]) == 0 or np.std(b[ok]) == 0:
        return 0.0
    return float(np.corrcoef(a[ok], b[ok])[0, 1])


def effective_sample_size(n: int, r1: float) -> float:
    """How many truly independent months the record is worth (Santer et al., 2000).

    If neighbouring months are similar (r1 > 0), the record holds less information than its
    length suggests. Negative r1 is treated as 0 (no correction), to stay cautious.
    """
    r = min(max(r1, 0.0), MAX_LAG1)
    return max(n * (1 - r) / (1 + r), 3.0)


def mann_kendall(y: np.ndarray, n_ratio: float = 1.0) -> float:
    """Two-sided Mann-Kendall p-value for a steady rise or fall.

    n_ratio = n / effective_n inflates the variance to account for month-to-month correlation
    (effective-sample-size correction). n_ratio = 1 gives the classic test.
    """
    y = y[~np.isnan(y)]
    n = len(y)
    if n < 3:
        return float("nan")
    s = 0.0
    for i in range(n - 1):
        s += np.sign(y[i + 1:] - y[i]).sum()
    _, counts = np.unique(y, return_counts=True)
    ties = counts[counts > 1]
    var_s = (n * (n - 1) * (2 * n + 5) - np.sum(ties * (ties - 1) * (2 * ties + 5))) / 18.0
    var_s *= n_ratio
    if var_s <= 0:
        return 1.0
    z = (s - np.sign(s)) / math.sqrt(var_s)  # continuity correction
    return float(2 * sps.norm.sf(abs(z)))


def years_to_significance(slope_per_year: float, noise_sd: float, r1: float,
                          record_years: float, t_value: float, verdict: str):
    """Estimate how many MORE years of data a not-yet-significant trend would need.

    Uses the standard formula of Weatherhead et al. (1998): the number of years n* needed to
    detect a trend with 90% probability at the 5% level is
        n* = [ (3.3 * noise_sd / |slope|) * sqrt((1 + r1) / (1 - r1)) ] ** (2/3)
    with noise_sd = scatter of the monthly anomalies around the line and r1 = month-to-month
    correlation. It ASSUMES the trend, the noise and the measurements stay the same, so it's a
    planning estimate, not a forecast.

    Returns None when it doesn't make sense: already significant, not enough data, a record
    shorter than 10 years, a slope too small to tell from zero, or more than 100 years needed.
    """
    if verdict not in ("possible", "none") or record_years < MIN_YEARS_FOR_HORIZON:
        return None
    if slope_per_year == 0 or abs(t_value) < 0.5 or noise_sd <= 0:
        return None  # direction itself is too uncertain to project
    r = min(max(r1, 0.0), MAX_LAG1)
    n_star = ((3.3 * noise_sd / abs(slope_per_year)) * math.sqrt((1 + r) / (1 - r))) ** (2 / 3)
    more = n_star - record_years
    if more > MAX_HORIZON_YEARS:
        return None
    return round(max(more, 0.0), 1)


def sen_slope(x: np.ndarray, y: np.ndarray) -> float:
    """Median of the slopes between every pair of points (robust to outliers)."""
    ok = ~np.isnan(y)
    if ok.sum() < 3:
        return float("nan")
    return float(sps.theilslopes(y[ok], x[ok]).slope)


# ---------------------------------------------------------------- helpers

def _clean(v):
    """float -> rounded float, NaN/None -> None (so results are JSON-friendly)."""
    if v is None:
        return None
    v = float(v)
    return None if math.isnan(v) or math.isinf(v) else v


def _clean_list(arr):
    return [_clean(v) for v in arr]


def _empty_result(df, anomaly, n_missing):
    """Result for a record that's too short: all numbers are None, verdict ⚫."""
    n = len(df)
    return {
        "slope_per_decade": None, "ci_low": None, "ci_high": None, "p_value": None,
        "mk_p_value": None, "total_change": None,
        "start": None, "end": None, "n_months": n, "n_missing": int(n_missing),
        "direction": "flat", "verdict": "insufficient", "emoji": EMOJI["insufficient"],
        "anomaly": _clean_list(anomaly), "trend": [None] * n,
        "band_low": [None] * n, "band_high": [None] * n,
        "years_to_significance": None, "method": METHOD,
        "sen_slope_per_decade": None, "lag1_autocorrelation": None, "effective_n": None,
    }


# ---------------------------------------------------------------- main function

def analyze(df: pd.DataFrame) -> dict:
    """Trend analysis of one monthly series.

    df: columns `date` (dates) and `value` (numbers; NaN = missing), one row per month.
    Returns the H2 result dictionary (see docs/HANDSHAKES.md).
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)

    anomaly = deseasonalize(df["value"], df["date"])
    valid = anomaly.notna().to_numpy()
    n_missing = int(df["value"].isna().sum())
    if valid.sum() < MIN_MONTHS or df["date"].nunique() < MIN_MONTHS:
        return _empty_result(df, anomaly, n_missing)

    # 1) straight line through the anomalies
    x_all = decimal_years(df["date"])
    x, y = x_all[valid], anomaly.to_numpy()[valid]
    n = len(x)
    x_mean = x.mean()
    sxx = np.sum((x - x_mean) ** 2)
    slope = np.sum((x - x_mean) * (y - y.mean())) / sxx            # units per year
    intercept = y.mean() - slope * x_mean
    residuals_all = anomaly.to_numpy() - (intercept + slope * x_all)  # NaN where missing
    sse = np.nansum(residuals_all ** 2)

    # 2) correct for month-to-month correlation
    r1 = lag1_autocorrelation(residuals_all)
    n_eff = effective_sample_size(n, r1)
    dof = max(n_eff - 2, 1.0)
    s_e = math.sqrt(sse / dof)                                     # typical scatter around the line
    se_slope = s_e / math.sqrt(sxx)

    # 3) t-test and 95% interval
    if se_slope == 0:
        p_value = 1.0 if slope == 0 else 0.0
    else:
        p_value = float(2 * sps.t.sf(abs(slope / se_slope), dof))
    t_crit = float(sps.t.ppf(0.975, dof))
    ci_low, ci_high = (slope - t_crit * se_slope) * 10, (slope + t_crit * se_slope) * 10

    # 4) trend line and its 95% band, for every row (also missing months, for a smooth chart)
    trend = intercept + slope * x_all
    half_width = t_crit * s_e * np.sqrt(1 / n_eff + (x_all - x_mean) ** 2 / sxx)

    # 5) second opinions
    mk_p = mann_kendall(anomaly.to_numpy(), n_ratio=n / n_eff)
    sen = sen_slope(x_all, anomaly.to_numpy())

    # 6) verdict
    if p_value < SIGNIFICANT_P:
        verdict = "significant"
    elif p_value < POSSIBLE_P:
        verdict = "possible"
    else:
        verdict = "none"
    direction = "increase" if slope > 0 else "decrease" if slope < 0 else "flat"

    # 7) extra: how many more years until this trend would likely become significant?
    noise_sd = math.sqrt(sse / max(n - 2, 1))
    t_value = slope / se_slope if se_slope > 0 else 0.0
    horizon = years_to_significance(slope, noise_sd, r1, x.max() - x.min(), t_value, verdict)

    valid_dates = df["date"][valid]
    return {
        "slope_per_decade": _clean(slope * 10),
        "ci_low": _clean(ci_low),
        "ci_high": _clean(ci_high),
        "p_value": _clean(p_value),
        "mk_p_value": _clean(mk_p),
        "total_change": _clean(slope * (x.max() - x.min())),
        "start": valid_dates.iloc[0].strftime("%Y-%m"),
        "end": valid_dates.iloc[-1].strftime("%Y-%m"),
        "n_months": int(len(df)),
        "n_missing": n_missing,
        "direction": direction,
        "verdict": verdict,
        "emoji": EMOJI[verdict],
        "anomaly": _clean_list(anomaly.to_numpy()),
        "trend": _clean_list(trend),
        "band_low": _clean_list(trend - half_width),
        "band_high": _clean_list(trend + half_width),
        "years_to_significance": horizon,
        "method": METHOD,
        "sen_slope_per_decade": _clean(sen * 10),
        "lag1_autocorrelation": _clean(r1),
        "effective_n": _clean(n_eff),
    }
