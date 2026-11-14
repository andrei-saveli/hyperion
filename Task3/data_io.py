# FAKE: will be replaced by the real data_io.py from the Data person (handshake H1).
# Copied from docs/HANDSHAKES.md so Task3 runs on its own. Don't edit; replace it.
import numpy as np, pandas as pd

def load_places():
    return pd.DataFrame([
        {"id": "lake_mead", "name": "Lake Mead (USA)", "lat": 36.25, "lon": -114.5, "west": -116, "south": 35, "east": -113, "north": 37.5,
         "type": "desert", "story": "Is the desert around Lake Mead drying out?"},
        {"id": "svalbard", "name": "Svalbard (Arctic)", "lat": 78.25, "lon": 15.5, "west": 14.0, "south": 77.5, "east": 17.0, "north": 79.0,
         "type": "polar", "story": "Is the Arctic warming?"},
    ])

def load_variables():
    return pd.DataFrame([{"code": "TEMP", "name": "Air temperature", "units": "°C",
                          "definition": "How warm the air is 2 metres above the ground.", "keywords": "temperature hot warm",
                          "source": "M2IMNXASM_5_12_4_T2M"}])

def load_series(place_id, code):
    dates = pd.date_range("2001-01-01", "2024-12-01", freq="MS")
    t = np.arange(len(dates)) / 120                      # time in decades
    seasons = 10 * np.sin(2 * np.pi * (dates.month - 4) / 12)
    noise = np.random.default_rng(0).normal(0, 1, len(dates))
    return pd.DataFrame({"date": dates, "value": 15 + 0.5 * t + seasons + noise})  # trend: +0.5 per decade
