"""Student-facing trend explanations (H3)."""

from math import isfinite


_DIRECTION_WORDS = {"increase": "upward", "decrease": "downward"}
_CAVEAT = (
    "A straight line summarizes the change over this record. "
    "Identifying the cause requires a separate investigation."
)


def explain(result: dict, variable: dict, place: dict) -> dict:
    """Describe the H2 verdict using the selected variable and area from H0."""
    verdict = result.get("verdict")
    direction = result.get("direction")

    if verdict == "insufficient":
        return {
            "headline": "Not enough usable data",
            "details": "This record has too little usable data to estimate a trend.",
            "caveat": _CAVEAT,
        }

    # H2 decides the verdict and direction. Keep both independent of display rounding.
    direction_word = _DIRECTION_WORDS.get(direction) if isinstance(direction, str) else None
    if verdict == "significant" and direction_word:
        headline = f"Clear {direction}"
        evidence = "The trend test shows clear evidence of this direction over the analysis period."
    elif verdict == "possible" and direction_word:
        headline = f"Possible {direction}"
        evidence = "The trend test gives some evidence of this direction over the analysis period."
    elif verdict == "none":
        headline = "No clear trend"
        evidence = "The direction of any change remains uncertain in this record."
    else:
        return {"headline": "Trend verdict unavailable", "details": "", "caveat": _CAVEAT}

    if verdict in ("possible", "none"):
        low, high = result.get("ci_low"), result.get("ci_high")
        if (isinstance(low, (int, float)) and isfinite(low)
                and isinstance(high, (int, float)) and isfinite(high) and low <= 0 <= high):
            evidence = "The rate interval includes zero, so this record leaves the direction uncertain."

    estimate = ""
    if direction_word:
        variable_name = variable.get("name")
        place_name = place.get("name")
        subject = "The best estimate"
        if isinstance(variable_name, str) and variable_name.strip():
            subject += f" for {variable_name.strip().lower()}"
        if isinstance(place_name, str) and place_name.strip():
            subject += f" in {place_name.strip()}"
        estimate = f"{subject} points {direction_word}. "

    return {"headline": headline, "details": estimate + evidence, "caveat": _CAVEAT}
