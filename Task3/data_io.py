# FAKE: will be replaced by the real data_io.py from the Data person (handshake H1).
# Copied from docs/HANDSHAKES.md so Task3 runs on its own. Don't edit; replace it.
import numpy as np
import pandas as pd


def load_places():
    return pd.DataFrame([
        {"id": "lake_mead", "name": "Lake Mead (USA)", "lat": 36.1, "lon": -114.7, "type": "desert", "story": "Is the desert around Lake Mead drying out?"},
        {"id": "svalbard", "name": "Svalbard (Arctic)", "lat": 78.2, "lon": 15.6, "type": "polar", "story": "Is the Arctic warming?"},
    ])


def load_variables():
    return pd.DataFrame([{"code": "T2M", "name": "Air temperature", "units": "°C",
                          "definition": "How warm the air is 2 metres above the ground.", "keywords": "temperature hot warm"}])


def load_series(place_id, code):
    dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
    t = np.arange(len(dates)) / 120                      # time in decades
    seasons = 10 * np.sin(2 * np.pi * (dates.month - 4) / 12)
    noise = np.random.default_rng(0).normal(0, 1, len(dates))
    return pd.DataFrame({"date": dates, "value": 15 + 0.5 * t + seasons + noise})  # trend: +0.5 per decade
