# Results on the real data (Giovanni, 2001–2024)

Trend analysis (`stats.py`) on all 12 cleaned files from `Task2/cleaned/`, sorted by p-value.
Regenerate with `python Task4/scripts/results_table.py`; all handshake checks pass.

| Place | Variable | Verdict | Change per decade | 95% interval | Change over record | t-test p | Seasonal MK p | Years until significant* | Reliability |
|---|---|---|---|---|---|---|---|---|---|
| Svalbard | Evaporation | 🟢 significant decrease | −0.078 mm/day | −0.108 to −0.047 | – (values dip below 0) | <0.001 | <0.001 | – | good |
| Niamey | Soil moisture | 🟢 significant decrease | −7.5 kg/m² | −12.7 to −2.4 | **−9.3%** | 0.006 | <0.001 | – | good |
| Lake Mead | Air temperature | 🟢 significant increase | +0.38 °C | +0.08 to +0.68 | +0.9 °C | 0.014 | 0.002 | – | good |
| Svalbard | Air temperature | 🟢 significant increase | +0.55 °C | +0.01 to +1.09 | +1.3 °C | 0.046 | <0.001 | – | good |
| Niamey | Evaporation | 🟡 possible increase | +0.048 mm/day | −0.007 to +0.102 | +8.1% | 0.086 | 0.054 | **≈2** | good |
| Niamey | Rainfall | ⚪ no clear trend | +0.074 mm/day | −0.041 to +0.189 | +11.7% | 0.21 | 0.88 | ≈8 | good |
| Svalbard | Rainfall | ⚪ no clear trend | +0.079 mm/day | −0.076 to +0.234 | +14.0% | 0.32 | 0.16 | ≈13 | good |
| Niamey | Air temperature | ⚪ no clear trend | −0.12 °C | −0.37 to +0.12 | −0.3 °C | 0.32 | 0.32 | ≈14 | good |
| Lake Mead | Evaporation | ⚪ no clear trend | +0.021 mm/day | −0.032 to +0.074 | +8.7% | 0.43 | 0.23 | ≈20 | good |
| Lake Mead | Rainfall | ⚪ no clear trend | −0.019 mm/day | −0.119 to +0.082 | −7.2% | 0.71 | 0.51 | – | good |
| Svalbard | Soil moisture | ⚪ no clear trend | +4.2 kg/m² | −24 to +33 | +2.9% | 0.72 | 0.28 | – | ⚠️ **low** |
| Lake Mead | Soil moisture | ⚪ no clear trend | +0.25 kg/m² | −12.9 to +13.4 | +0.4% | 0.97 | 0.26 | – | ⚠️ **low** |

\* If the trend and the noise stay as they are, about how many more years of data it would take
for the trend to reach significance. A planning estimate, not a forecast. "–" = already
significant, or direction too unclear to estimate.

**Summary:** 4 🟢 significant · 1 🟡 possible · 7 ⚪ no clear trend.
- The **two independent tests agree on all 12 results** (t-test with memory correction, and
  seasonal Mann-Kendall with year-to-year memory correction).
- Both soil-moisture series outside Niamey change so slowly from month to month that they're worth
  only 7 (Svalbard) and 18 (Lake Mead) independent months, so they're flagged **low reliability**.
  Svalbard is also mostly glacier: don't use its soil moisture in the demo.

## Suggested demo cases (team decides at sync 2)

1. **🟢 Lake Mead, air temperature: "Is the desert getting hotter?"**
   +0.38 °C per decade, about +0.9 °C since 2001. Both tests agree. Clear and relatable.
2. **🟡 Niamey, evaporation: "not significant *yet*"**
   Probably rising (+8% since 2001), but the 95% interval still includes zero. If nothing
   changes, about **2 more years** of data would make it significant. Teaches what "significant"
   means (the challenge's own point).
3. **Compare: air temperature, Lake Mead 🟢 vs Niamey ⚪**
   Same variable and method, different places, different answers.
4. **Bonus 🟢 Niamey, soil moisture: −9.3% since 2001**, while Niamey's rainfall shows no clear
   trend. An interesting pair to show side by side, **without claiming why**.

Wording rule for all of these: say *what* changed, never claim *why*.
