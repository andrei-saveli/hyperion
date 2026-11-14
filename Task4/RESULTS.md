# Results on the real data (Giovanni, 2001–2024)

Trend analysis (`stats.py`) on all 12 cleaned files from `Task2/cleaned/`, sorted by p-value.
Generated with `scripts/results_table.py`; all handshake checks pass.

| Place | Variable | Verdict | Change per decade | 95% interval | p-value | Mann-Kendall p | Years until significant* |
|---|---|---|---|---|---|---|---|
| Svalbard | Evaporation | 🟢 significant decrease | −0.078 mm/day | −0.108 to −0.047 | <0.001 | <0.001 | – |
| Niamey | Soil moisture | 🟢 significant decrease | −7.5 kg/m² | −12.7 to −2.4 | 0.006 | 0.005 | – |
| Lake Mead | Air temperature | 🟢 significant increase | +0.38 °C | +0.08 to +0.68 | 0.014 | 0.005 | – |
| Svalbard | Air temperature | 🟢 significant increase | +0.55 °C | +0.01 to +1.09 | 0.046 | 0.017 | – |
| Niamey | Evaporation | 🟡 possible increase | +0.048 mm/day | −0.007 to +0.102 | 0.086 | 0.16 | ≈13 |
| Niamey | Rainfall | ⚪ no clear trend | +0.074 mm/day | −0.041 to +0.189 | 0.21 | 0.59 | ≈22 |
| Svalbard | Rainfall | ⚪ no clear trend | +0.079 mm/day | −0.076 to +0.234 | 0.32 | 0.58 | ≈29 |
| Niamey | Air temperature | ⚪ no clear trend | −0.12 °C | −0.37 to +0.12 | 0.32 | 0.47 | ≈29 |
| Lake Mead | Evaporation | ⚪ no clear trend | +0.021 mm/day | −0.032 to +0.074 | 0.43 | 0.49 | ≈38 |
| Lake Mead | Rainfall | ⚪ no clear trend | −0.019 mm/day | −0.119 to +0.082 | 0.71 | 0.89 | – |
| Svalbard | Soil moisture ⚠️ | ⚪ no clear trend | +4.2 kg/m² | −24 to +33 | 0.72 | 0.56 | – |
| Lake Mead | Soil moisture | ⚪ no clear trend | +0.25 kg/m² | −12.9 to +13.4 | 0.97 | 0.74 | – |

\* Planning estimate (Weatherhead et al., 1998): extra years of data likely needed *if nothing
changes*. Not a forecast. "–" = already significant, or direction too unclear to estimate.
⚠️ Svalbard soil moisture: glacier/frozen ground; don't use in the demo.

**Summary:** 4 🟢 significant · 1 🟡 possible · 7 ⚪ no clear trend. Both tests (t-test and
Mann-Kendall) agree on every 🟢 result.

## Suggested demo cases (team decides at sync 2)

1. **🟢 Lake Mead, air temperature: "Is the desert getting hotter?"**
   +0.38 °C per decade, about +0.9 °C since 2001. Clear, relatable, both tests agree.
2. **🟡 Niamey, evaporation: "not significant *yet*"**
   Probably rising, but the 95% interval still includes zero. About 13 more years of data would
   likely be needed. Teaches what "significant" means (the challenge's own point).
3. **Compare: air temperature, Lake Mead 🟢 vs Niamey ⚪**
   Same variable, same method: one place shows a clear warming, the other no clear trend.
   Shows that trends differ by region.
4. **Bonus 🟢 Svalbard, air temperature**: Arctic warming of +0.55 °C per decade. Its interval
   (+0.01 to +1.09) is wide and p = 0.046 is close to the line: a good honest example of a
   significant but uncertain rate.

Wording rule for all of these: say *what* changed, never claim *why* (e.g. don't say Niamey's soil
moisture fell *because of* anything; the trend alone can't show that).
