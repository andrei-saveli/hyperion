"""About Byte Me Analitics."""

from pathlib import Path

import streamlit as st

from ui_navigation import render_top_navigation


st.set_page_config(
    page_title="About us · Byte Me Analitics",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

        html, body, [data-testid="stAppViewContainer"],
        h1, h2, h3, p, button {
            font-family: "JetBrains Mono", monospace;
        }
        [data-testid="stAppViewContainer"] {
            background: #03101f;
        }
        [data-testid="stHeader"] {
            background: transparent;
        }
        .block-container {
            max-width: 1160px;
            padding-top: 2.4rem;
            padding-bottom: 4rem;
        }
        .st-key-top_navigation {
            padding-bottom: 0.8rem;
            margin-bottom: 1.2rem;
            border-bottom: 1px solid rgba(54, 207, 255, 0.2);
        }
        .st-key-top_navigation button {
            min-height: 2.35rem;
            border-radius: 0.15rem;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            box-shadow: none;
        }
        .st-key-top_navigation button[kind="primary"] {
            border-color: #16d9ff;
            background: #16d9ff;
            color: #01111d;
        }
        .st-key-top_navigation button[kind="secondary"] {
            border-color: rgba(76, 203, 246, 0.2);
            background: transparent;
            color: #7f9dbb;
        }
        .st-key-top_navigation button[kind="secondary"]:hover {
            border-color: #16d9ff;
            color: #dff7ff;
        }
        @media (max-width: 780px) {
            .block-container {
                padding: 1rem 1rem 2.5rem;
            }
        }
    </style>
    """,
    unsafe_allow_html=True,
)

st.image(Path(__file__).resolve().parents[1] / "assets" / "byte-me-analytics.png", width=320)
render_top_navigation("about")

st.title("About us")
st.write(
    "Byte Me Analitics is an Earth-system trend explorer built for the NASA "
    "Space Apps challenge, “Be An Earth System Trend Detective!”"
)

st.divider()
mission, approach = st.columns(2, gap="large")
with mission:
    st.subheader("What we’re building")
    st.write(
        "A way for students and curious readers to explore how a place changes "
        "over time. Choose a place and period, inspect monthly observations, "
        "and read the estimated trend alongside its uncertainty."
    )
with approach:
    st.subheader("How we work")
    st.write(
        "The project brings together data loading, trend analysis, explanations, "
        "and a Python interface built with Streamlit and Plotly."
    )

st.subheader("The measurements")
st.write(
    "Explore air temperature, rainfall, root-zone soil moisture, and evaporation. "
    "NASA Giovanni provided monthly area averages for Lake Mead, Niamey, "
    "and Svalbard from 2001 through 2024."
)

st.subheader("Reading the results responsibly")
st.write(
    "A linear trend is a summary, not a forecast. Statistical significance "
    "describes the evidence for a trend; it does not explain its cause. "
    "A result without a clear trend is not proof that nothing changed."
)

st.page_link("pages/1_Guided_demo.py", label="Try the guided demo", icon=":material/play_circle:")
