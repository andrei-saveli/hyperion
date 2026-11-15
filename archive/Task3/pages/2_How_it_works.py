"""Explain the analysis in language students can use to read a result."""

import streamlit as st


st.title("How it works")

st.header("Start with monthly data")
st.write(
    "Pick a place and a measurement, such as air temperature or rainfall. "
    "Each point is the average for the selected area in one month. "
    "The app leaves missing months out when it estimates the trend."
)

st.header("Remove the seasonal cycle")
st.write(
    "July is usually warmer than January, even if the climate stays steady. "
    "We compare each July with the average of all Julys in the record, then do the same "
    "for the other months. The difference shows how far each month was from its usual level."
)

st.header("Read the line and its shaded band")
st.write(
    "The app fits a straight line through those differences. The slope is the estimated change "
    "every ten years. A rate of +0.4 °C per decade means the fitted line rises by about "
    "0.4 °C for every ten years along the chart. "
    "The shaded 95% band shows uncertainty about where the fitted trend lies. "
    "The result also gives a 95% range for how steep the line could be."
)

st.header("What makes a trend significant?")
st.write(
    "Imagine the underlying rate were zero. The p-value tells you how often the test would "
    "find evidence at least as strong as yours in that situation. A smaller p-value gives "
    "stronger evidence of a trend. The test accounts for how similar nearby months can be."
)
st.markdown(
    "- 🟢 **Significant trend** · p below 0.05\n"
    "- 🟡 **Possible trend** · p of 0.05 or higher, below 0.10\n"
    "- ⚪ **No clear trend** · p of 0.10 or higher\n"
    "- ⚫ **Not enough data** · under 10 years of coverage or fewer than 24 usable months"
)
st.write(
    "An unclear result leaves open the possibility that the measurement is changing. "
    "In some cases, the app estimates how many more years of data might help, assuming the "
    "estimated rate and variation stay the same."
)
st.caption("A straight line simplifies the record. Identifying the cause takes a separate investigation.")
