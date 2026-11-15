"""Explore two real Giovanni trend results and compare two regions."""

import streamlit as st

from charts import trend_chart
from data_io import load_places, load_series, load_variables
from explain import explain
from stats import analyze


def show_result(place_id, code, places, variables):
    place = places[place_id]
    variable = variables[code]
    series = load_series(place_id, code)
    result = analyze(series, code=code)
    explanation = explain(result, variable, place)
    chart = trend_chart(series, result, remove_seasons=True, title=place["name"])
    chart.update_yaxes(title_text=f"Difference from the usual month ({variable['units']})")
    st.plotly_chart(chart, key=f"demo_{place_id}_{code}")
    st.subheader(f"{result['emoji']} {explanation['headline']}")
    st.write(explanation["details"])


steps = (
    (
        "Is the desert around Lake Mead getting hotter?",
        "Look at the fitted line and its shaded band. Which way does the line slope?",
        (("lake_mead", "TEMP"),),
    ),
    (
        "Is evaporation increasing around Niamey?",
        "Look for zero in the range of rates below the chart. What does that tell you about the direction?",
        (("niamey", "EVAP"),),
    ),
    (
        "Does air temperature show the same trend in both places?",
        "Compare the rate and the evidence for each region using the same variable and method.",
        (("lake_mead", "TEMP"), ("niamey", "TEMP")),
    ),
)

st.title("Guided demo")
st.caption("Monthly NASA Giovanni data")
if "guided_demo_step" not in st.session_state:
    st.session_state.guided_demo_step = 0


def move_step(offset):
    st.session_state.guided_demo_step += offset


step = st.session_state.guided_demo_step
question, prompt, cases = steps[step]
st.progress((step + 1) / len(steps), text=f"Step {step + 1} of {len(steps)}")
st.header(question)
st.write(prompt)

places = load_places().set_index("id", drop=False).to_dict("index")
variables = load_variables().set_index("code", drop=False).to_dict("index")
columns = st.columns(2) if len(cases) == 2 else (st.container(),)
for column, (place_id, code) in zip(columns, cases):
    with column:
        show_result(place_id, code, places, variables)

st.caption("A straight line simplifies the record. Identifying the cause takes a separate investigation.")
back, next_step = st.columns(2)
with back:
    st.button("Back", on_click=move_step, args=(-1,), disabled=step == 0)
with next_step:
    st.button("Next", on_click=move_step, args=(1,), disabled=step == len(steps) - 1)
