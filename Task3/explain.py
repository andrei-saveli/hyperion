"""Student-facing trend explanations (H3)."""

from math import floor, isfinite


_CAVEAT = (
    "A straight line simplifies a record that can rise and fall over time. "
    "Identifying the cause requires a separate investigation."
)


def _number(result, key):
    value = result.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value):
        return value
    return None


def _signed(value):
    return f"{value:+.3g}".replace("-", "−") if value else "0"


def explain(result: dict, variable: dict, place: dict) -> dict:
    """Describe the H2 verdict using the selected variable and area from H0."""
    verdict = result.get("verdict")
    direction = result.get("direction")
    place_name = place.get("name") or "Selected area"
    variable_name = variable.get("name") or "Variable"
    units = variable.get("units") or "units"
    subject = f"{variable_name} in {place_name}"

    if verdict == "insufficient":
        return {
            "headline": f"{subject} · Not enough usable data",
            "details": "This record has too little usable data to estimate a trend.",
            "caveat": _CAVEAT,
        }

    if verdict == "significant" and direction in ("increase", "decrease"):
        label = f"Significant {direction}"
    elif verdict == "possible" and direction in ("increase", "decrease"):
        label = f"Possible {direction}"
    elif verdict == "none":
        label = "No clear trend"
    else:
        return {"headline": "Trend verdict unavailable", "details": "", "caveat": _CAVEAT}

    headline = f"{subject} · {label}"
    details = []
    slope = _number(result, "slope_per_decade")
    total = _number(result, "total_change")
    percent = _number(result, "percent_change")
    start, end = result.get("start"), result.get("end")
    period = f" over {start[:4]}–{end[:4]}" if start and end else " over the record"
    if slope is not None:
        rate = f"{_signed(slope)} {units} per decade"
        headline += f" ({rate})"
        details.append(f"After removing seasonal swings, the straight line estimates {rate}{period}.")
    if total is not None:
        change = f"{_signed(total)} {units}"
        if percent is not None and variable.get("code") in ("RAIN", "SOILM", "EVAP"):
            change += f" ({_signed(percent)}% of the record average)"
        details.append(f"The line's estimated change from start to finish is {change}.")

    low, high = _number(result, "ci_low"), _number(result, "ci_high")
    if low is not None and high is not None:
        details.append(
            "The shaded 95% band shows uncertainty around the line. "
            f"The 95% range for its rate is {_signed(low)} to {_signed(high)} {units} per decade."
        )
        if low <= 0 <= high:
            details.append("That range includes zero, so this record leaves the direction uncertain.")

    p_value = _number(result, "p_value")
    if p_value is not None:
        p_label = "below 0.001" if p_value < 0.001 else f"{p_value:.3g}"
        details.append(
            f"The p-value is {p_label}. If the underlying rate were zero, the p-value tells us "
            "how often the test would see evidence at least this strong just by chance."
        )

    years = _number(result, "years_to_significance")
    if verdict in ("possible", "none") and years is not None and years > 0:
        rounded = floor(years + 0.5)
        if years < 1:
            duration = "less than one more year"
        elif rounded == 1:
            duration = "about one more year"
        else:
            duration = f"about {rounded} more years"
        details.append(
            f"If the estimated rate and month-to-month variation stay the same, {duration} "
            "of data could be enough to reach significance. This is a planning estimate."
        )
    if result.get("reliability") == "low":
        details.append(result.get("reliability_note") or "Treat this result with caution because nearby months are very similar.")
    if result.get("tests_agree") is False:
        details.append(result.get("tests_note") or "The two trend tests disagree, so treat this result with caution.")

    return {"headline": headline, "details": " ".join(details), "caveat": _CAVEAT}
