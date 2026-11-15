"""Byte Me Analitics: investigate NASA trends with a plain-language query."""

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from charts import trend_chart
from data_io import load_places, load_series, load_variables
from explain import explain
from investigation import fit_period, period_in_question, slice_period
from investigation_view import select_analysis_period, set_analysis_period, show_matched_comparison
from search import explore
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
def get_record(place_id, variable_code):
    """Load the full series and cache its fixed seasonal baseline."""
    series = load_series(place_id, variable_code)
    return series, analyze(series, code=variable_code)


def get_period_analysis(place_id, variable_code, period):
    full, full_fit = get_record(place_id, variable_code)
    series = slice_period(full, period)
    return series, None if series.empty else fit_period(series, variable_code, full, full_fit)


def safe_number(value, suffix="", signed=False):
    """Format an optional number to three significant digits."""
    if value is None or pd.isna(value):
        return "–"
    prefix = "+" if signed and value > 0 else ""
    return f"{prefix}{value:.3g}{suffix}"


def row_as_dict(frame, column, value):
    """Return one metadata row as a plain dictionary."""
    return frame.loc[frame[column] == value].iloc[0].to_dict()


def open_dataset(place_id, code, period=None):
    """Open a dataset and include the starting investigation in its link."""
    st.session_state.active_query = {"place_id": place_id, "code": code}
    st.query_params.update({"place": place_id, "measurement": code})
    st.query_params.pop("compare", None)
    st.session_state.pop("comparison_place", None)
    set_analysis_period(period)
    st.session_state.query_form_visible = False


def render_suggestions(suggestions, places, variables, period):
    """Display Searchlight's ranked cards and the confidence interval of each series."""
    if not suggestions:
        st.info("Searchlight returned no suggestions. You can browse the available data below.")
        return
    if suggestions[0]["match_label"] != "Possible match":
        st.caption("Searchlight couldn’t confirm a match. You can explore the dataset below.")
    for suggestion in suggestions:
        place_id, code = suggestion["place_id"], suggestion["code"]
        place = row_as_dict(places, "id", place_id)
        variable = row_as_dict(variables, "code", code)
        st.button(
            f"{suggestion['match_label']} · {variable['name']} · {place['name']}",
            key=f"search_result_{place_id}_{code}",
            on_click=open_dataset,
            args=(place_id, code, period),
            width="stretch",
        )
        st.caption(suggestion["reason"])
        if period:
            continue  # The selected range gets its own fit when opened.
        _, result = get_record(place_id, code)
        if result["ci_low"] is not None and result["ci_high"] is not None:
            low = safe_number(result["ci_low"], signed=True)
            high = safe_number(result["ci_high"], signed=True)
            st.caption(f"95% confidence interval ({result['start']} to {result['end']}) · "
                       f"{low} to {high} {variable['units']} per decade")


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
    linked_place, linked_code = st.query_params.get("place"), st.query_params.get("measurement")
    if linked_place in set(places["id"]) and linked_code in set(variables["code"]):
        st.session_state.active_query = {"place_id": linked_place, "code": linked_code}
    st.session_state.query_form_visible = "active_query" not in st.session_state

if st.session_state.query_form_visible:
    st.title("Search Earth trends")
    st.write("Ask a question and Searchlight will suggest datasets you can investigate.")
    with st.form("investigation_query"):
        query = st.text_input("Ask a question", placeholder="Is the Arctic warming?")
        submitted = st.form_submit_button("Find datasets", type="primary", width="stretch")

    if submitted:
        if query.strip():
            with st.spinner("Searching datasets…"):
                st.session_state.search_results = explore(query.strip())
                st.session_state.search_period = period_in_question(query)
        else:
            st.session_state.pop("search_results", None)
            st.warning("Enter a question first.")

    if "search_results" in st.session_state:
        render_suggestions(st.session_state.search_results, places, variables, st.session_state.get("search_period"))

    with st.expander("Browse available data"):
        place_name = st.selectbox("Place", places["name"])
        measurement = st.selectbox("Measurement", variables["name"])
        place_id = row_as_dict(places, "name", place_name)["id"]
        code = row_as_dict(variables, "name", measurement)["code"]
        st.button("Open dataset", on_click=open_dataset, args=(place_id, code, period_in_question(query)))
    st.stop()

active_query = st.session_state.active_query
place = row_as_dict(places, "id", active_query["place_id"])
selected_variable = row_as_dict(variables, "code", active_query["code"])
summary_column, action_column = st.columns([5, 1], vertical_alignment="center")
with summary_column:
    st.caption("SELECTED DATASET")
    st.markdown(f"**{selected_variable['name']} · {place['name']}**")
with action_column:
    if st.button("NEW QUERY", width="stretch"):
        st.session_state.query_form_visible = True
        for parameter in ("place", "measurement", "from", "to", "compare"):
            st.query_params.pop(parameter, None)
        st.rerun()

try:
    selected_record, _ = get_record(place["id"], selected_variable["code"])
except FileNotFoundError:
    st.info("This dataset has no record yet. Open New Query to choose another measurement.")
    st.stop()
if selected_record.empty:
    st.info("This dataset has no observations yet.")
    st.stop()
period = select_analysis_period(selected_record)
period_label = f"{period[0]} to {period[1]}"

with st.expander("Compare with another place", expanded=bool(st.query_params.get("compare"))):
    st.caption(f"Compare {selected_variable['name'].lower()} in the months observed at both places.")
    choices = places.loc[places["id"] != place["id"], "id"].tolist()
    names = places.set_index("id")["name"]
    saved = st.query_params.get("compare")
    reference_id = st.selectbox("Comparison place", choices, format_func=names.__getitem__,
                                index=choices.index(saved) if saved in choices else None,
                                key="comparison_place")
    if reference_id is None:
        st.query_params.pop("compare", None)
    else:
        if saved != reference_id:
            st.query_params["compare"] = reference_id
        try:
            reference, _ = get_record(reference_id, selected_variable["code"])
        except FileNotFoundError:
            st.info("This measurement has no record at the comparison place.")
        else:
            show_matched_comparison(selected_record, reference, place["name"], names[reference_id],
                                    selected_variable, period)

st.divider()
st.caption(f"INVESTIGATION · {period_label}")
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

variable_tabs = st.tabs(variables["name"].tolist(), default=selected_variable["name"])
for tab, (_, variable_row) in zip(variable_tabs, variables.iterrows()):
    variable = variable_row.to_dict()
    with tab:
        st.subheader(f"{variable['name']} · {variable['units']}")
        st.write(variable["definition"])
        try:
            dataframe, result = get_period_analysis(
                place["id"],
                variable["code"],
                period,
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
            title=f"{variable['name']} in {place['name']}, {period_label}",
        )
        chart.update_yaxes(
            title=f"{'Anomaly' if remove_seasons else variable['name']} ({variable['units']})"
        )
        st.plotly_chart(
            chart, key=f"query_chart_{variable['code']}", width="stretch",
            config={"displayModeBar": False},
        )
        if remove_seasons and result["verdict"] == "insufficient":
            st.caption("Monthly departures from the full record’s seasonal baseline.")
        elif remove_seasons and result.get("band_meaning"):
            st.caption(result["band_meaning"])
        render_verdict(result, explanation, variable)
