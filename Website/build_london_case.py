"""Build a transparent synthetic-control example from the study's weekly input data."""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize


# Tong et al. (2025), ASCM_NO2.R, roadside group. Omit the London donor (Haringey)
# because the April 2019 policy could affect traffic beyond the zone boundary.
ROADSIDE_DONORS = [
    "Aberdeen_Union_Street_Roadside",
    "Birmingham_A4540_Roadside",
    "Blackburn_Accrington_Road",
    "Bristol_Temple_Way",
    "Bradford_Mayo_Avenue",
    "Dumfries",
    "Exeter_Roadside",
    "Glasgow_Great_Western_Road",
    "Glasgow_High_Street",
    "Luton_A505_Roadside",
    "Newcastle_Cradlewell_Roadside",
    "Swansea_Roadside",
    "York_Fishergate",
]
POLICY_START = "2019-04-08"
HOLDOUT_WEEKS = 8
SOURCE_REVISION = "0ba2df44dec7a99b8d95e924cf1b1c59cc4ca623"


def fit_control(london, donors, training_weeks):
    """Fit a fixed donor mix to pre-policy changes, allowing a constant level gap."""
    pre_london = london[:training_weeks]
    pre_donors = donors[:training_weeks]
    london_level = pre_london.mean()
    donor_levels = pre_donors.mean(axis=0)
    centered_london = pre_london - london_level
    centered_donors = pre_donors - donor_levels

    def error(weights):
        residual = centered_london - centered_donors @ weights
        return np.mean(residual ** 2)

    def gradient(weights):
        residual = centered_donors @ weights - centered_london
        return 2 * centered_donors.T @ residual / training_weeks

    count = donors.shape[1]
    fit = minimize(
        error,
        np.full(count, 1 / count),
        jac=gradient,
        method="SLSQP",
        bounds=[(0, 1)] * count,
        constraints=[{"type": "eq", "fun": lambda weights: weights.sum() - 1}],
        options={"ftol": 1e-10},
    )
    if not fit.success:
        raise ValueError(f"Synthetic control did not converge: {fit.message}")
    return london_level + (donors - donor_levels) @ fit.x, fit.x


def build(csv_path):
    weekly = pd.read_csv(csv_path)
    dates = weekly["date"]
    weekly["date"] = pd.to_datetime(dates, unit="s" if pd.api.types.is_numeric_dtype(dates) else None, utc=True)
    sites = ["Avg1_UT", *ROADSIDE_DONORS]
    rows = weekly[weekly["site"].isin(sites)].pivot(index="date", columns="site", values="NO2wn")
    calendar = pd.date_range("2018-04-02", "2020-03-02", freq="W-MON", tz="UTC")
    rows = rows.reindex(index=calendar, columns=sites)
    if rows.isna().any().any():
        raise ValueError("The study input must cover every selected site and calendar week.")

    intervention = int(calendar.get_loc(pd.Timestamp(POLICY_START, tz="UTC")))
    training_weeks = intervention - HOLDOUT_WEEKS
    london = rows["Avg1_UT"].to_numpy()
    donors = rows[ROADSIDE_DONORS].to_numpy()
    control, weights = fit_control(london, donors, training_weeks)
    largest_donor = int(np.argmax(weights))
    sensitivity, _ = fit_control(london, np.delete(donors, largest_donor, axis=1), training_weeks)

    return {
        "sourceRevision": SOURCE_REVISION,
        "policyStart": POLICY_START,
        "trainingWeeks": training_weeks,
        "donorCount": len(ROADSIDE_DONORS),
        "weights": [
            {"site": site.replace("_", " "), "weight": round(float(weight), 8)}
            for site, weight in zip(ROADSIDE_DONORS, weights)
        ],
        "omittedDonor": ROADSIDE_DONORS[largest_donor].replace("_", " "),
        "weeks": [
            [date.strftime("%Y-%m-%d"), *[round(float(value), 5) for value in values]]
            for date, *values in zip(calendar, london, control, sensitivity)
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_csv", type=Path, help="CSV export of the study's ASCM_NO2.Rdata")
    parser.add_argument("--out", type=Path, default=Path(__file__).with_name("data") / "london-ulez.json")
    args = parser.parse_args()
    args.out.write_text(json.dumps(build(args.source_csv), indent=2) + "\n", encoding="utf-8")
