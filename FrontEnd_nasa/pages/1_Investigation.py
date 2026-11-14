"""Byte Me Analitics: investigate NASA trends with a plain-language query."""

import re
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from charts import trend_chart
from data_io import load_places, load_series, load_variables
from explain import explain
from stats import analyze
from ui_navigation import render_top_navigation


st.set_page_config(
    page_title="Query · Byte Me Analitics",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

        :root {
            --query-cyan: #16d9ff;
            --query-panel: rgba(5, 27, 52, 0.82);
            --query-line: rgba(54, 207, 255, 0.2);
        }

        html,
        body,
        [data-testid="stAppViewContainer"],
        button,
        input,
        textarea {
            font-family: "JetBrains Mono", monospace;
        }

        [data-testid="stAppViewContainer"] {
            background: #03101f;
        }

        [data-testid="stAppViewContainer"]::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            opacity: 0.1;
            background-image:
                radial-gradient(circle at 14% 18%, rgba(255,255,255,0.8) 0 1px, transparent 1.5px),
                radial-gradient(circle at 75% 23%, rgba(255,255,255,0.55) 0 1px, transparent 1.5px),
                radial-gradient(circle at 88% 72%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px),
                radial-gradient(circle at 38% 82%, rgba(255,255,255,0.45) 0 1px, transparent 1.5px);
            background-size: 21rem 21rem, 27rem 27rem, 31rem 31rem, 35rem 35rem;
        }

        [data-testid="stHeader"] {
            background: transparent;
        }

        .block-container {
            max-width: 1160px;
            padding-top: 2.4rem;
            padding-bottom: 4rem;
        }

        h1, h2, h3 {
            letter-spacing: -0.035em;
        }

        [data-testid="stForm"] {
            padding: 1.25rem;
            border: 1px solid var(--query-line);
            border-radius: 0.25rem;
            background: #06182d;
            box-shadow: none;
        }

        [data-testid="stTextInput"] input {
            min-height: 3.3rem;
            border-color: rgba(88, 215, 255, 0.28);
            background: rgba(1, 13, 28, 0.72);
        }

        [data-testid="stTextInput"] input:focus {
            border-color: var(--query-cyan);
            box-shadow: 0 0 0 1px var(--query-cyan);
        }

        div[data-testid="stFormSubmitButton"] button {
            min-height: 3.2rem;
            border-color: rgba(145, 242, 255, 0.9);
            background: #16d9ff;
            color: #01111d;
            font-weight: 800;
            letter-spacing: 0.1em;
            box-shadow: none;
        }

        [data-testid="stMetric"],
        [data-testid="stExpander"] {
            border: 1px solid var(--query-line);
            border-radius: 0.25rem;
            background: #06182d;
        }

        [data-testid="stMetric"] {
            padding: 0.9rem 1rem;
        }

        [data-testid="stAlert"] {
            border: 1px solid rgba(76, 211, 255, 0.18);
            background: rgba(5, 28, 53, 0.76);
        }

        .query-guide {
            margin: 1.25rem 0 1.5rem;
            padding: 1.2rem;
            border-left: 2px solid var(--query-cyan);
            background: rgba(6, 24, 44, 0.72);
        }

        .query-guide-label {
            color: #7896b4;
            font-size: 0.68rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }

        .query-pattern {
            margin: 0.55rem 0 0.85rem;
            color: #e8f8ff;
            font-size: clamp(0.85rem, 2vw, 1.05rem);
        }

        .query-pattern span {
            color: var(--query-cyan);
        }

        .query-guide-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }

        .query-guide h4 {
            margin: 0 0 0.45rem;
            color: #dcefff;
            font-size: 0.75rem;
        }

        .query-guide ul {
            margin: 0;
            padding-left: 1.1rem;
            color: #83a0bd;
            font-size: 0.72rem;
            line-height: 1.75;
        }

        .query-example {
            color: #83a0bd;
            font-size: 0.72rem;
            line-height: 1.75;
        }

        .query-example code {
            color: #dff8ff;
            background: #020e1d;
            padding: 0.15rem 0.3rem;
            border-radius: 0.15rem;
        }

        .st-key-top_navigation {
            padding-bottom: 0.8rem;
            margin-bottom: 1.2rem;
            border-bottom: 1px solid var(--query-line);
        }

        .st-key-top_navigation div[data-testid="stButton"] > button {
            min-height: 2.35rem;
            padding: 0.35rem 0.8rem;
            border-radius: 0.15rem;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            box-shadow: none;
        }

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="primary"] {
            border-color: var(--query-cyan);
            background: var(--query-cyan);
            color: #01111d;
        }

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"] {
            border-color: rgba(76, 203, 246, 0.2);
            background: transparent;
            color: #7f9dbb;
        }

        .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"]:hover {
            border-color: rgba(76, 203, 246, 0.55);
            color: #dff7ff;
        }

        @media (max-width: 780px) {
            .block-container {
                padding: 1rem 1rem 2.5rem;
            }
            .query-guide-grid {
                grid-template-columns: 1fr;
                gap: 1rem;
            }
        }
    </style>
    """,
    unsafe_allow_html=True,
)

@st.cache_data
def get_places():
    """Load place metadata once per app session."""
    return load_places()


@st.cache_data
def get_variables():
    """Load variable metadata once per app session."""
    return load_variables()


@st.cache_data
def get_period_analysis(place_id, variable_code, start_year, end_year):
    """Load one series, select the requested period, and pass it to analyze()."""
    series = load_series(place_id, variable_code)
    in_period = series["date"].dt.year.between(start_year, end_year)
    period_series = series.loc[in_period].reset_index(drop=True)
    return period_series, analyze(period_series, code=variable_code)


def safe_number(value, suffix="", signed=False):
    """Format an optional number to three significant digits."""
    if value is None or pd.isna(value):
        return "–"
    prefix = "+" if signed and value > 0 else ""
    return f"{prefix}{value:.3g}{suffix}"


def row_as_dict(frame, column, value):
    """Return one metadata row as a plain dictionary."""
    return frame.loc[frame[column] == value].iloc[0].to_dict()


def place_aliases(place):
    """Return simple names a user might type for a repository place."""
    visible_name = str(place["name"]).lower()
    return {
        visible_name,
        visible_name.split("(")[0].strip(),
        visible_name.split(",")[0].strip(),
        str(place["id"]).lower().replace("_", " "),
    }


def parse_query(text, places):
    """Find a repository place and two four-digit years in a user query."""
    cleaned = " ".join(text.lower().split())
    years = [int(year) for year in re.findall(r"\b(?:19|20)\d{2}\b", cleaned)]

    if len(years) < 2:
        return None, None, None, "Include a start and end year, such as 2005 to 2020."

    start_year, end_year = years[0], years[1]
    if start_year > end_year:
        return None, None, None, "The start year must come before the end year."
    if start_year < 2001 or end_year > 2024:
        return None, None, None, "Choose years from 2001 through 2024."

    matched_place_id = None
    matched_alias_length = 0
    for _, place in places.iterrows():
        for alias in place_aliases(place):
            if alias and re.search(rf"\b{re.escape(alias)}(?!\w)", cleaned) and len(alias) > matched_alias_length:
                matched_place_id = place["id"]
                matched_alias_length = len(alias)

    if matched_place_id is None:
        available = ", ".join(places["name"].tolist())
        return None, None, None, f"Place not found. Available places: {available}."

    return matched_place_id, start_year, end_year, None


def verdict_label(verdict):
    """Give every status a text label so colour is never the only signal."""
    return {
        "significant": "Statistically significant trend",
        "possible": "Possible trend — not significant yet",
        "none": "No clear trend yet",
        "insufficient": "Not enough data",
    }.get(verdict, "Trend result")


def render_verdict(result, explanation, variable):
    """Display only statistics supplied by analyze() and wording from explain()."""
    units = variable["units"]
    verdict = result.get("verdict", "insufficient")
    emoji = result.get("emoji") or {
        "significant": "🟢",
        "possible": "🟡",
        "none": "⚪",
        "insufficient": "⚫",
    }.get(verdict, "⚫")

    st.subheader(f"{emoji} {verdict_label(verdict)}")
    if verdict == "insufficient":
        st.markdown("**Not enough data for this place and variable.**")
        if explanation.get("headline"):
            st.write(explanation["headline"])
        return

    st.markdown(f"### {explanation['headline']}")
    metric_columns = st.columns(4)
    metrics = [
        ("Change per decade", safe_number(result.get("slope_per_decade"), f" {units}", True)),
        ("Change during period", safe_number(result.get("total_change"), f" {units}", True)),
        ("p-value", safe_number(result.get("p_value"))),
        (
            "95% interval",
            (
                f"{safe_number(result.get('ci_low'), signed=True)} to "
                f"{safe_number(result.get('ci_high'), signed=True)} {units}"
            ),
        ),
    ]
    for column, (label, value) in zip(metric_columns, metrics):
        column.metric(label, value)

    with st.expander("What does this mean?"):
        st.markdown(explanation.get("details", ""))
        if explanation.get("caveat"):
            st.info(explanation["caveat"])

    st.caption(
        f"Period used: {result.get('start', '–')}–{result.get('end', '–')} · "
        f"Months: {safe_number(result.get('n_months'))} · "
        f"Missing months: {safe_number(result.get('n_missing'))} · "
        f"Method: {result.get('method', '–')} · Source: NASA Giovanni · "
        f"{variable['source']}"
    )
    for note in ("reliability_note", "tests_note"):
        if result.get(note):
            st.warning(result[note])


def map_layer_controls():
    """Render a compact layer picker and return the selected map options."""
    with st.popover(
        "MAP LAYERS",
        icon=":material/layers:",
        help="Choose which geographic layers are visible",
    ):
        st.caption("BASE MAP")
        base_map = st.selectbox(
            "Map appearance",
            ["Political", "Physical", "Minimal"],
            label_visibility="collapsed",
            key="map_base_layer",
        )

        st.caption("OVERLAYS")
        show_other_places = st.toggle(
            "Other available places",
            value=True,
            key="map_other_places",
        )
        show_countries = st.toggle(
            "Country borders",
            value=True,
            key="map_country_borders",
        )
        show_coastlines = st.toggle(
            "Coastlines",
            value=True,
            key="map_coastlines",
        )
        show_water = st.toggle(
            "Lakes and rivers",
            value=False,
            key="map_water",
        )
        show_grid = st.toggle(
            "Coordinate grid",
            value=False,
            key="map_grid",
        )

    return {
        "base_map": base_map,
        "show_other_places": show_other_places,
        "show_countries": show_countries,
        "show_coastlines": show_coastlines,
        "show_water": show_water,
        "show_grid": show_grid,
    }


def location_map(places, selected_place_id, layers):
    """Show the queried location with user-selected geographic layers."""
    selected = places["id"].eq(selected_place_id)
    figure = go.Figure()
    if layers["show_other_places"]:
        figure.add_trace(
            go.Scattergeo(
                lat=places.loc[~selected, "lat"],
                lon=places.loc[~selected, "lon"],
                text=places.loc[~selected, "name"],
                mode="markers",
                marker={
                    "size": 7,
                    "color": "#94a3b8",
                    "line": {"width": 1, "color": "#ffffff"},
                },
                hovertemplate="%{text}<extra>Available place</extra>",
                name="Other places",
            )
        )

    figure.add_trace(
        go.Scattergeo(
            lat=places.loc[selected, "lat"],
            lon=places.loc[selected, "lon"],
            text=places.loc[selected, "name"],
            mode="markers+text",
            textposition="top center",
            marker={"size": 16, "color": "#f97316", "line": {"width": 2, "color": "#ffffff"}},
            hovertemplate="%{text}<extra>Queried place</extra>",
            name="Queried place",
        )
    )

    base_styles = {
        "Political": {
            "landcolor": "#10243a",
            "oceancolor": "#041629",
            "countrycolor": "rgba(140, 190, 220, 0.5)",
        },
        "Physical": {
            "landcolor": "#17342f",
            "oceancolor": "#06213a",
            "countrycolor": "rgba(130, 190, 170, 0.32)",
        },
        "Minimal": {
            "landcolor": "#0a1c30",
            "oceancolor": "#061426",
            "countrycolor": "rgba(130, 170, 200, 0.22)",
        },
    }
    base_style = base_styles[layers["base_map"]]
    figure.update_geos(
        projection_type="natural earth",
        showland=True,
        landcolor=base_style["landcolor"],
        showocean=True,
        oceancolor=base_style["oceancolor"],
        showcountries=layers["show_countries"],
        countrycolor=base_style["countrycolor"],
        showcoastlines=layers["show_coastlines"],
        coastlinecolor="rgba(130, 210, 235, 0.55)",
        showlakes=layers["show_water"],
        lakecolor="#0a3658",
        showrivers=layers["show_water"],
        rivercolor="#1675a3",
        lataxis={"showgrid": layers["show_grid"], "gridcolor": "rgba(120, 190, 220, 0.22)"},
        lonaxis={"showgrid": layers["show_grid"], "gridcolor": "rgba(120, 190, 220, 0.22)"},
        bgcolor="rgba(0, 0, 0, 0)",
    )
    figure.update_layout(
        height=350,
        margin={"l": 0, "r": 0, "t": 0, "b": 0},
        legend={"orientation": "h", "y": 0, "x": 0},
        font={"family": "JetBrains Mono, monospace"},
    )
    st.plotly_chart(figure, width="stretch", config={"displayModeBar": False})


places = get_places()
variables = get_variables()

if places.empty or variables.empty:
    st.error("No places or variables are available yet.")
    st.stop()

st.image(Path(__file__).resolve().parents[1] / "assets" / "byte-me-analytics.png", width=320)
render_top_navigation("search")

if "query_form_visible" not in st.session_state:
    st.session_state.query_form_visible = "active_query" not in st.session_state

if st.session_state.query_form_visible:
    st.title("Explore a place")
    st.write(
        "Ask about an available place and a period of time. Byte Me Analitics will locate it "
        "and investigate every Earth-system variable currently supplied by the project."
    )
    st.markdown(
        """
        <div class="query-guide">
            <div class="query-guide-label">Query format</div>
            <div class="query-pattern">
                <span>[place name]</span> from <span>[start year]</span> to <span>[end year]</span>
            </div>
            <div class="query-guide-grid">
                <div>
                    <h4>Requirements</h4>
                    <ul>
                        <li>Use a place listed under “Places currently available.”</li>
                        <li>Write both years with four digits.</li>
                        <li>Put the earlier year first.</li>
                        <li>Choose years from 2001 through 2024.</li>
                        <li>The trend test requires a record spanning at least 10 years.</li>
                    </ul>
                </div>
                <div>
                    <h4>Examples</h4>
                    <div class="query-example">
                        <code>Lake Mead from 2005 to 2020</code><br>
                        <code>Show me Svalbard between 2010 and 2022</code><br>
                        Extra words are fine; the place and two years are what matter.
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    example_place = places.iloc[0]["name"].split("(")[0].strip()
    with st.form("investigation_query"):
        query = st.text_input(
            "What place and time period do you want to investigate?",
            placeholder=f"Example: Show me {example_place} from 2005 to 2020",
            key="query_text",
        )
        submitted = st.form_submit_button("Investigate", type="primary", width="stretch")

    with st.expander("Places currently available"):
        for _, available_place in places.iterrows():
            st.markdown(
                f"- **{available_place['name']}** — {available_place['story']} "
                f"({available_place['lat']:.3g}, {available_place['lon']:.3g})"
            )

    if not submitted:
        st.info("Enter a place and two years to begin.")
        st.stop()

    if not query.strip():
        st.warning("Enter a place and a time period first.")
        st.stop()
    place_id, start_year, end_year, query_error = parse_query(query, places)
    if query_error:
        st.warning(query_error)
        st.stop()
    st.session_state.active_query = {
        "text": query,
        "place_id": place_id,
        "start_year": start_year,
        "end_year": end_year,
    }
    st.session_state.query_form_visible = False
    st.rerun()

active_query = st.session_state.active_query
summary_column, action_column = st.columns([5, 1], vertical_alignment="center")
with summary_column:
    st.caption("RESULTS FOR")
    st.markdown(f"**{active_query['text']}**")
with action_column:
    if st.button("NEW QUERY", width="stretch"):
        st.session_state.query_form_visible = True
        st.rerun()

place = row_as_dict(places, "id", active_query["place_id"])
start_year = active_query["start_year"]
end_year = active_query["end_year"]

st.divider()
st.caption(f"INVESTIGATION · {start_year}–{end_year}")
st.header(place["name"])
st.write(place["story"])

detail_columns = st.columns(3)
detail_columns[0].metric("Latitude", f"{place['lat']:.3f}°")
detail_columns[1].metric("Longitude", f"{place['lon']:.3f}°")
detail_columns[2].metric("Place type", str(place["type"]).title())

layers = map_layer_controls()
location_map(places, place["id"], layers)

st.header("Earth-system information")
st.write(
    "The sections below come directly from the variables available in the repository. "
    "Additional values will appear automatically when their data files are added."
)
remove_seasons = st.toggle(
    "Remove seasons",
    value=True,
    help="Subtract the usual pattern for each calendar month so the long-term signal is easier to see.",
)

variable_tabs = st.tabs(variables["name"].tolist())
for tab, (_, variable_row) in zip(variable_tabs, variables.iterrows()):
    variable = variable_row.to_dict()
    with tab:
        st.subheader(f"{variable['name']} · {variable['units']}")
        st.write(variable["definition"])
        try:
            dataframe, result = get_period_analysis(
                place["id"],
                variable["code"],
                start_year,
                end_year,
            )
        except FileNotFoundError:
            st.info("Data for this place and variable will be added later.")
            continue

        if dataframe.empty:
            st.info("No observations are available in the requested period.")
            continue

        explanation = explain(result, variable, place)
        chart = trend_chart(
            dataframe,
            result,
            remove_seasons=remove_seasons,
            title=f"{variable['name']} in {place['name']}, {start_year}–{end_year}",
        )
        chart.update_yaxes(
            title=f"{'Anomaly' if remove_seasons else variable['name']} ({variable['units']})"
        )
        st.plotly_chart(
            chart, key=f"query_chart_{variable['code']}", width="stretch",
            config={"displayModeBar": False},
        )
        if remove_seasons and result.get("band_meaning"):
            st.caption(result["band_meaning"])
        render_verdict(result, explanation, variable)
