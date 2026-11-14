"""Byte Me Analitics landing page."""

from base64 import b64encode
from pathlib import Path

import streamlit as st

from data_io import load_places
from ui_navigation import render_top_navigation


st.set_page_config(
    page_title="Byte Me Analitics · Earth System Trend Detective",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="collapsed",
)


EARTH_IMAGE = (
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa"
    "?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=85&w=1400"
)
LOGO = Path(__file__).resolve().parents[1] / "assets" / "byte-me-analytics.png"
LOGO_DATA = b64encode(LOGO.read_bytes()).decode("ascii")


@st.cache_data
def get_home_places():
    """Load available places for the working example links."""
    return load_places()


st.markdown(
    f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

        :root {{
            --space: #020b19;
            --panel: rgba(6, 27, 52, 0.78);
            --panel-strong: rgba(7, 34, 66, 0.94);
            --line: rgba(45, 201, 255, 0.18);
            --cyan: #16d9ff;
            --cyan-soft: #8ceeff;
            --mint: #20e0b2;
            --muted: #8ca8c7;
        }}

        html,
        body,
        [data-testid="stAppViewContainer"],
        button,
        input,
        textarea {{
            font-family: "JetBrains Mono", monospace;
        }}

        [data-testid="stAppViewContainer"] {{
            background: #03101f;
        }}

        [data-testid="stAppViewContainer"]::before {{
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: 0.12;
            background-image:
                radial-gradient(circle at 18% 22%, rgba(255,255,255,0.8) 0 1px, transparent 1.5px),
                radial-gradient(circle at 72% 12%, rgba(255,255,255,0.55) 0 1px, transparent 1.5px),
                radial-gradient(circle at 84% 64%, rgba(255,255,255,0.5) 0 1px, transparent 1.5px),
                radial-gradient(circle at 35% 73%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px);
            background-size: 19rem 19rem, 23rem 23rem, 29rem 29rem, 31rem 31rem;
        }}

        [data-testid="stHeader"] {{
            background: transparent;
        }}

        [data-testid="stSidebar"] {{
            display: none;
        }}

        .block-container {{
            max-width: 1220px;
            padding-top: 2rem;
            padding-bottom: 4rem;
        }}

        .brand-nav {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem 0 1.5rem;
            border-bottom: 1px solid rgba(99, 203, 255, 0.12);
        }}

        .brand {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: #f5fbff;
            font-size: 1.05rem;
            font-weight: 750;
            letter-spacing: 0.08em;
        }}

        .brand-logo {{
            display: block;
            width: min(17rem, 48vw);
            height: auto;
        }}

        .nav-status {{
            display: flex;
            align-items: center;
            gap: 0.55rem;
            color: var(--muted);
            font-size: 0.78rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }}

        .status-dot {{
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
            background: var(--mint);
            box-shadow: 0 0 12px var(--mint);
        }}

        .hero-copy {{
            padding: 4.8rem 1rem 2.5rem 0;
        }}

        .eyebrow {{
            display: inline-flex;
            align-items: center;
            gap: 0.55rem;
            color: var(--cyan);
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            margin-bottom: 1.3rem;
        }}

        .eyebrow::before {{
            content: "";
            width: 2.5rem;
            height: 1px;
            background: var(--cyan);
            box-shadow: 0 0 8px var(--cyan);
        }}

        .hero-title {{
            color: #f6fbff;
            font-size: clamp(3rem, 6vw, 5.7rem);
            font-weight: 750;
            letter-spacing: -0.055em;
            line-height: 0.97;
            margin: 0;
            max-width: 11ch;
        }}

        .hero-title span {{
            color: var(--cyan);
            text-shadow: none;
        }}

        .hero-subtitle {{
            color: #a6bdd6;
            font-size: 1.06rem;
            line-height: 1.75;
            max-width: 34rem;
            margin: 1.65rem 0 1.1rem;
        }}

        .hero-note {{
            color: #6483a4;
            font-size: 0.78rem;
            letter-spacing: 0.04em;
            margin-bottom: 0.4rem;
        }}

        div[data-testid="stButton"] > button[kind="primary"] {{
            min-height: 3.6rem;
            border: 1px solid rgba(137, 239, 255, 0.9);
            border-radius: 0.2rem;
            background: #16d9ff;
            color: #01111d;
            font-size: 0.95rem;
            font-weight: 850;
            letter-spacing: 0.14em;
            box-shadow: none;
            transition: transform 160ms ease, box-shadow 160ms ease;
        }}

        div[data-testid="stButton"] > button[kind="primary"]:hover {{
            transform: translateY(-2px);
            border-color: #ffffff;
            color: #01111d;
            background: #8ceeff;
            box-shadow: none;
        }}

        div[data-testid="stButton"] > button[kind="secondary"] {{
            min-height: 3.2rem;
            border: 1px solid rgba(76, 203, 246, 0.28);
            border-radius: 0.2rem;
            background: #06182d;
            color: #dff7ff;
            font-size: 0.78rem;
            text-align: left;
        }}

        div[data-testid="stButton"] > button[kind="secondary"]:hover {{
            border-color: var(--cyan);
            color: var(--cyan);
        }}

        .earth-shell {{
            position: relative;
            min-height: 34rem;
            margin-top: 2.2rem;
            border: 1px solid var(--line);
            border-radius: 0.25rem;
            overflow: hidden;
            background:
                linear-gradient(180deg, rgba(3, 17, 35, 0.05), rgba(3, 17, 35, 0.9)),
                url("{EARTH_IMAGE}") center / cover no-repeat;
            box-shadow: none;
        }}

        .earth-shell::before,
        .earth-shell::after {{
            content: none;
            position: absolute;
            border: 1px solid rgba(44, 221, 255, 0.32);
            border-radius: 50%;
            left: 50%;
            top: 51%;
            transform: translate(-50%, -50%) rotate(-18deg);
        }}

        .earth-shell::before {{
            width: 88%;
            height: 45%;
        }}

        .earth-shell::after {{
            width: 58%;
            height: 82%;
            transform: translate(-50%, -50%) rotate(28deg);
        }}

        .visual-label {{
            position: absolute;
            left: 1.25rem;
            top: 1.25rem;
            padding: 0.65rem 0.8rem;
            border: 1px solid rgba(66, 218, 255, 0.24);
            border-radius: 0.2rem;
            background: rgba(2, 16, 34, 0.74);
            backdrop-filter: blur(10px);
        }}

        .visual-label strong {{
            display: block;
            color: #f3fbff;
            font-size: 0.8rem;
            letter-spacing: 0.08em;
        }}

        .visual-label span {{
            color: var(--cyan);
            font-size: 0.68rem;
            text-transform: uppercase;
        }}

        .earth-credit {{
            position: absolute;
            right: 1rem;
            bottom: 0.8rem;
            z-index: 2;
            color: rgba(211, 231, 245, 0.62);
            font-size: 0.62rem;
        }}

        .earth-credit a {{
            color: rgba(211, 231, 245, 0.8);
        }}

        .stat-card {{
            min-height: 7.4rem;
            padding: 1.15rem 1.2rem;
            border: 1px solid var(--line);
            border-radius: 0.25rem;
            background: #06182d;
            box-shadow: none;
        }}

        .stat-label {{
            color: #7695b6;
            font-size: 0.68rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }}

        .stat-value {{
            color: #e8f8ff;
            font-size: 1.5rem;
            font-weight: 750;
            margin: 0.35rem 0 0.1rem;
        }}

        .stat-detail {{
            color: #7794b2;
            font-size: 0.72rem;
        }}

        .section-kicker {{
            color: var(--cyan);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            margin-top: 3.5rem;
        }}

        .section-title {{
            color: #f4faff;
            font-size: clamp(1.8rem, 3vw, 2.7rem);
            font-weight: 720;
            letter-spacing: -0.03em;
            margin: 0.35rem 0 1.4rem;
        }}

        .feature-card {{
            min-height: 12rem;
            padding: 1.35rem;
            border: 1px solid rgba(63, 202, 255, 0.14);
            border-radius: 0;
            border-width: 1px 0 0;
            background: transparent;
        }}

        .feature-number {{
            color: var(--cyan);
            font-size: 0.68rem;
            letter-spacing: 0.12em;
        }}

        .feature-title {{
            color: #eef9ff;
            font-size: 1.08rem;
            font-weight: 700;
            margin: 1.5rem 0 0.55rem;
        }}

        .feature-copy {{
            color: #83a0bf;
            font-size: 0.82rem;
            line-height: 1.65;
        }}

        .result-list {{
            border-top: 1px solid var(--line);
            margin-bottom: 1rem;
        }}

        .result-row {{
            display: grid;
            grid-template-columns: 3rem minmax(10rem, 0.75fr) 1.5fr;
            gap: 1rem;
            padding: 1.15rem 0;
            border-bottom: 1px solid var(--line);
        }}

        .result-index {{
            color: var(--cyan);
            font-size: 0.72rem;
        }}

        .result-name {{
            color: #eef8ff;
            font-size: 0.86rem;
            font-weight: 700;
        }}

        .result-description {{
            color: #829eba;
            font-size: 0.8rem;
            line-height: 1.6;
        }}

        .method-note {{
            margin-top: 3.5rem;
            padding: 1.4rem 0;
            border-top: 1px solid var(--line);
            border-bottom: 1px solid var(--line);
            display: grid;
            grid-template-columns: minmax(12rem, 0.65fr) 1.35fr;
            gap: 2rem;
        }}

        .method-note strong {{
            color: #edf9ff;
            font-size: 0.9rem;
        }}

        .method-note p {{
            color: #7f9bb8;
            font-size: 0.78rem;
            line-height: 1.7;
            margin: 0;
        }}

        .site-footer {{
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            margin-top: 2.5rem;
            color: #587694;
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }}

        .st-key-top_navigation {{
            padding-bottom: 0.8rem;
            border-bottom: 1px solid var(--line);
        }}

        .st-key-top_navigation div[data-testid="stButton"] > button {{
            min-height: 2.35rem;
            padding: 0.35rem 0.8rem;
            border-radius: 0.15rem;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            box-shadow: none;
            transform: none;
        }}

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="primary"] {{
            border-color: var(--cyan);
            background: var(--cyan);
            color: #01111d;
        }}

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"] {{
            border-color: rgba(76, 203, 246, 0.2);
            background: transparent;
            color: #7f9dbb;
        }}

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"]:hover {{
            border-color: rgba(76, 203, 246, 0.55);
            color: #dff7ff;
        }}

        @media (max-width: 780px) {{
            .block-container {{
                padding: 1rem 1rem 2.5rem;
            }}
            .hero-copy {{
                padding: 3.2rem 0 1.2rem;
            }}
            .hero-title {{
                font-size: clamp(2.8rem, 15vw, 4.2rem);
            }}
            .earth-shell {{
                min-height: 25rem;
                margin-top: 1rem;
            }}
            .nav-status {{
                display: none;
            }}
            .result-row {{
                grid-template-columns: 2rem 1fr;
            }}
            .result-description {{
                grid-column: 2;
            }}
            .method-note {{
                grid-template-columns: 1fr;
                gap: 0.75rem;
            }}
            .site-footer {{
                flex-direction: column;
            }}
        }}
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    f"""
    <div class="brand-nav">
        <div class="brand">
            <img
                class="brand-logo"
                src="data:image/png;base64,{LOGO_DATA}"
                alt="Byte Me Analitics"
            />
        </div>
        <div class="nav-status">
            <span class="status-dot"></span>
            LOCAL NASA DATA · READY
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

render_top_navigation("home")

hero_copy, hero_visual = st.columns([1.03, 0.97], gap="large", vertical_alignment="center")

with hero_copy:
    st.markdown(
        """
        <div class="hero-copy">
            <div class="eyebrow">NASA GIOVANNI · 2001–2024</div>
            <h1 class="hero-title">Explore <span>Earth trends.</span></h1>
            <p class="hero-subtitle">
                Ask a question or choose a dataset. See the monthly record, a linear trend,
                and how certain that trend is.
            </p>
            <p class="hero-note">For students, teachers, and anyone curious about Earth data.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("START", type="primary", width="stretch"):
        st.switch_page("pages/1_Investigation.py")
    st.page_link("pages/1_Guided_demo.py", label="Guided demo", icon=":material/play_circle:")

with hero_visual:
    st.markdown(
        """
        <div class="earth-shell" role="img" aria-label="The blue Earth viewed from space">
            <div class="visual-label">
                <strong>EARTH OBSERVATION</strong>
                <span>Monthly record · 2001–2024</span>
            </div>
            <div class="earth-credit">
                Photo by <a href="https://unsplash.com/@nasa" target="_blank">NASA</a> on Unsplash
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

stat_columns = st.columns(4)
stats = [
    ("Coverage", "2001–2024", "Monthly records"),
    ("Measurements", "4", "Temperature · rainfall · soil moisture · evaporation"),
    ("Analysis", "Linear trend", "With a 95% confidence interval"),
    ("Source", "NASA Giovanni", "Monthly area averages"),
]
for column, (label, value, detail) in zip(stat_columns, stats):
    with column:
        st.markdown(
            f"""
            <div class="stat-card">
                <div class="stat-label">{label}</div>
                <div class="stat-value">{value}</div>
                <div class="stat-detail">{detail}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

st.markdown(
    """
    <div class="section-kicker">How it works</div>
    <div class="section-title">Ask a question. Check the evidence.</div>
    """,
    unsafe_allow_html=True,
)

feature_columns = st.columns(3)
features = [
    (
        "01 · ASK",
        "Ask about a trend",
        "Try a question such as “Is the Arctic warming?”",
    ),
    (
        "02 · INSPECT",
        "Review the record",
        "Check the location, monthly observations, missing values, and available variables.",
    ),
    (
        "03 · UNDERSTAND",
        "Read the result",
        "See the estimated change, uncertainty, and statistical significance.",
    ),
]
for column, (number, title, copy) in zip(feature_columns, features):
    with column:
        st.markdown(
            f"""
            <div class="feature-card">
                <div class="feature-number">{number}</div>
                <div class="feature-title">{title}</div>
                <div class="feature-copy">{copy}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

st.markdown(
    """
    <div class="section-kicker">Example queries</div>
    <div class="section-title">Start with a place already in the dataset.</div>
    """,
    unsafe_allow_html=True,
)

available_places = get_home_places()
if available_places.empty:
    st.caption("Example queries will appear when place metadata is available.")
else:
    example_columns = st.columns(min(3, len(available_places)))
    for index, (_, example_place) in enumerate(available_places.head(3).iterrows()):
        with example_columns[index]:
            if st.button(
                f"{example_place['name']} · 2001–2024",
                key=f"example_{example_place['id']}",
                width="stretch",
            ):
                st.session_state.active_query = {
                    "place_id": example_place["id"],
                    "code": "TEMP",
                }
                st.session_state.pop("investigation_years", None)
                st.session_state.query_form_visible = False
                st.switch_page("pages/1_Investigation.py")

st.markdown(
    """
    <div class="section-kicker">What the result includes</div>
    <div class="section-title">The record, the trend, and its uncertainty.</div>
    <div class="result-list">
        <div class="result-row">
            <div class="result-index">01</div>
            <div class="result-name">Place context</div>
            <div class="result-description">
                Name, coordinates, place type, guiding question, and map location.
            </div>
        </div>
        <div class="result-row">
            <div class="result-index">02</div>
            <div class="result-name">Monthly observations</div>
            <div class="result-description">
                The selected NASA record with an option to remove the repeating seasonal pattern.
            </div>
        </div>
        <div class="result-row">
            <div class="result-index">03</div>
            <div class="result-name">Trend statistics</div>
            <div class="result-description">
                Change per decade, total change, p-value, and a 95% confidence interval.
            </div>
        </div>
        <div class="result-row">
            <div class="result-index">04</div>
            <div class="result-name">Plain explanation</div>
            <div class="result-description">
                A short interpretation of what changed and how strong the evidence is.
            </div>
        </div>
    </div>
    <div class="method-note">
        <strong>A trend describes what changed, not why.</strong>
        <p>
            Byte Me Analitics removes the average seasonal cycle before fitting a straight
            trend line. The line is a useful summary, not a forecast or proof of cause.
            Data source: NASA Giovanni monthly area averages.
        </p>
    </div>
    <div class="site-footer">
        <span>Byte Me Analitics</span>
        <span>NASA Space Apps · Earth System Trend Detective</span>
    </div>
    """,
    unsafe_allow_html=True,
)
