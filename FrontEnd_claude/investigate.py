"""Hyperion: the main "Investigate" page of the website (Frontend).

Opened through app.py (the menu). Run from the repository root:  streamlit run FrontEnd_claude/app.py

It uses the real parts of the project (handshakes in docs/HANDSHAKES.md):
  data_io.py (Task2)  load_places, load_variables, load_series   H1
  stats.py   (Task4)  analyze                                     H2
  explain.py (Task3)  explain                                     H3
  search.py  (Task3)  search                                      H4
This file only DISPLAYS results: it never computes statistics or writes its own verdicts.
"""
import logging
import sys
from pathlib import Path

import streamlit as st

# ---------------------------------------------------------------------------------- imports
# In the final project everything sits next to this file. While we work in Task folders, also
# look in the sibling Task2 (data), Task3 (search, explain) and Task4 (stats) folders.
HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE)] + [str(HERE.parent / t) for t in ("Task2", "Task3", "Task4")]

from charts import place_map, trend_chart  # noqa: E402
from data_io import load_places, load_series, load_variables  # noqa: E402
from explain import explain  # noqa: E402
from stats import analyze  # noqa: E402

try:
    from search import search  # noqa: E402
except Exception:  # search is optional: the app works without it
    def search(text):
        return []
logging.getLogger("search").setLevel(logging.CRITICAL)  # don't flood the screen if search is offline


# ---------------------------------------------------------------------------------- content
# Demo questions shown as buttons (chosen from the real results in Task4/RESULTS.md).
DEMO_QUESTIONS = [
    ("🌡️ Is the desert getting hotter?", "lake_mead", "TEMP"),
    ("🧊 Is the Arctic warming?", "svalbard", "TEMP"),
    ("💧 Is the Sahel's soil drying?", "niamey", "SOILM"),
    ("⏳ Not significant… yet?", "niamey", "EVAP"),
]
VARIABLE_ICON = {"TEMP": "🌡️", "RAIN": "🌧️", "SOILM": "💧", "EVAP": "💨"}
PLACE_ICON = {"desert": "🏜️", "polar": "🧊", "savanna": "🌾", "city": "🏙️", "forest": "🌳",
              "coast": "🌊", "mountain": "⛰️", "farmland": "🚜"}
VERDICT_COLOUR = {"significant": "#22c55e", "possible": "#f2b84b", "none": "#8b94ad", "insufficient": "#4b5563"}
VERDICT_WORDS = {"significant": "Significant", "possible": "Possible, not significant yet",
                 "none": "No clear trend yet", "insufficient": "Not enough data"}

st.markdown("""
<style>
.hy-card {border-left: 7px solid var(--c); background: rgba(127,127,127,0.08); border-radius: 14px;
          padding: 16px 20px; display: flex; gap: 18px; align-items: center; margin: 4px 0 12px 0;}
.hy-emoji {font-size: 46px; line-height: 1;}
.hy-head {font-size: 1.45rem; font-weight: 750; line-height: 1.25;}
.hy-sub {opacity: 0.75; margin-top: 2px;}
.hy-chip {display: inline-block; border: 1px solid rgba(127,127,127,0.4); border-radius: 99px;
          padding: 2px 10px; margin: 2px 4px 2px 0; font-size: 0.8rem; opacity: 0.85;}
.hy-tag {opacity: 0.75; font-size: 1.0rem; margin-top: -8px;}
[data-testid="stMetricValue"] {font-size: 1.6rem;}
.block-container {padding-top: 2.2rem;}
</style>""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------------- data (cached)
@st.cache_data
def catalogue():
    places = load_places()
    variables = load_variables()
    return places, variables


@st.cache_data
def series_and_result(place_id, code):
    """Load one series and analyze it. Returns (df, result) or (None, None) if there's no file."""
    try:
        df = load_series(place_id, code)
    except FileNotFoundError:
        return None, None
    return df, analyze(df, code=code)


@st.cache_data(show_spinner=False)
def run_search(text):
    try:
        return search(text)
    except Exception:
        return []


places, variables = catalogue()
PLACE = places.set_index("id")
VAR = variables.set_index("code")


# ---------------------------------------------------------------------------------- formatting
def num(v, signed=True, digits=2):
    """Round to 2–3 significant digits; None -> '–'."""
    if v is None:
        return "–"
    text = f"{v:+.{digits}g}" if signed else f"{v:.{digits}g}"
    return text.replace("e+0", "e").replace("-", "−")


def p_text(p):
    if p is None:
        return "–"
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def place_label(pid):
    p = PLACE.loc[pid]
    return f"{PLACE_ICON.get(p['type'], '📍')} {p['name']}"


def var_label(code):
    return f"{VARIABLE_ICON.get(code, '📈')} {VAR.loc[code, 'name']}"


# ---------------------------------------------------------------------------------- state
if "place" not in st.session_state:
    st.session_state.place, st.session_state.code = DEMO_QUESTIONS[0][1], DEMO_QUESTIONS[0][2]


def choose(place_id, code):
    """Used by demo buttons and search suggestions."""
    st.session_state.place, st.session_state.code = place_id, code


# ---------------------------------------------------------------------------------- pieces
def verdict_card(result, variable, place, compact=False):
    """The answer: emoji + headline (from explain) + the key numbers (from analyze)."""
    text = explain(result, variable, place)
    verdict = result["verdict"]
    period = f"{result['start'][:4]}–{result['end'][:4]}" if result.get("start") else ""
    sub = f"{VERDICT_WORDS[verdict]} · {variable['name']} · {place['name']}" + (f" · {period}" if period else "")
    size = "1.15rem" if compact else "1.45rem"
    st.markdown(
        f"<div class='hy-card' style='--c:{VERDICT_COLOUR[verdict]}'><div class='hy-emoji'>{result['emoji']}</div>"
        f"<div><div class='hy-head' style='font-size:{size}'>{text['headline']}</div>"
        f"<div class='hy-sub'>{sub}</div></div></div>", unsafe_allow_html=True)

    if verdict == "insufficient":
        st.info("Not enough data for this place and variable: a trend needs at least 10 years of observations.")
        return text

    units = variable["units"]
    total = f"{num(result['total_change'])} {units}"
    if result.get("percent_change") is not None:
        total += f" ({num(result['percent_change'], digits=2)}%)"
    cols = st.columns(2) if compact else st.columns(4)
    cols[0].metric("Change per decade", f"{num(result['slope_per_decade'])} {units}")
    cols[1].metric(f"Total since {result['start'][:4]}", total)
    if not compact:
        cols[2].metric("Likely range (95%)", f"{num(result['ci_low'])} to {num(result['ci_high'])}",
                       help="Where the true rate per decade most likely lies.")
        cols[3].metric("p-value", p_text(result["p_value"]),
                       help="Chance of seeing a trend this strong if nothing were really changing. Below 0.05 = significant.")

    if not compact:
        notes(result)
    return text


def notes(result):
    """Cautions and the years-until-significant estimate (shown under the numbers, or under the
    chart in the compare tab so both charts stay aligned)."""
    if result.get("reliability") == "low" and result.get("reliability_note"):
        st.warning(result["reliability_note"], icon="⚠️")
    if result.get("tests_agree") is False and result.get("tests_note"):
        st.warning(result["tests_note"], icon="⚠️")
    if result.get("years_to_significance") is not None:
        st.info(f"Estimate: about **{result['years_to_significance']:g} more years** of data would make this "
                "trend significant, if the trend and the noise stay the same. Not a forecast.", icon="⏳")


def details(result, variable, place, text):
    with st.expander("💬 What does this mean?"):
        st.markdown(text["details"] or "–")
        st.caption(text["caveat"])
    with st.expander("🛰️ Data & method"):
        st.markdown(
            f"- **Data:** NASA Giovanni, `{variable.get('source', '–')}` ({variable['units']}), monthly, "
            f"averaged over the box W {place['west']}, S {place['south']}, E {place['east']}, N {place['north']}\n"
            f"- **Period:** {result.get('start') or '–'} to {result.get('end') or '–'} · "
            f"{result['n_months']} months · {result['n_missing']} missing\n"
            f"- **Method:** {result['method']}\n"
            f"- **Second test (seasonal Mann-Kendall) p-value:** {p_text(result.get('mk_p_value'))}\n"
            f"- **Robust rate (Sen's slope):** {num(result.get('sen_slope_per_decade'))} {variable['units']} per decade")


# ---------------------------------------------------------------------------------- header
st.markdown("## 🛰️ Hyperion: Earth System Trend Detective")
st.markdown("<div class='hy-tag'>Pick a place and a NASA measurement: is it changing, how fast, and is it real?"
            "&nbsp; <span class='hy-chip'>NASA Giovanni</span><span class='hy-chip'>MERRA-2</span>"
            "<span class='hy-chip'>GPM</span><span class='hy-chip'>GLDAS</span></div>", unsafe_allow_html=True)
st.write("")

# ---------------------------------------------------------------------------------- sidebar
with st.sidebar:
    st.markdown("### 🔎 Your investigation")
    st.selectbox("Place", list(PLACE.index), key="place", format_func=place_label)
    st.caption(f"“{PLACE.loc[st.session_state.place, 'story']}”")
    st.selectbox("Measurement", list(VAR.index), key="code", format_func=var_label)
    v = VAR.loc[st.session_state.code]
    st.caption(f"**{v['units']}** · {v['definition']}")
    st.markdown("**Where we looked**")
    st.plotly_chart(place_map(places, [st.session_state.place]), width="stretch",
                    config={"displayModeBar": False})
    st.caption("Each box is the area NASA's data is averaged over.")

# ---------------------------------------------------------------------------------- tabs
tab_investigate, tab_compare = st.tabs(["🔎 Investigate", "⚖️ Compare places"])

with tab_investigate:
    question = st.text_input("Ask a question", placeholder="e.g. Is the desert drying out?",
                             label_visibility="collapsed")
    suggestions = run_search(question) if question.strip() else []
    if question.strip() and not suggestions:
        st.caption("No suggestions for that question yet. Try one of these, or pick a place and measurement on the left:")
    if suggestions:
        st.caption("Suggestions:")
        for i, s in enumerate(suggestions):
            if s["place_id"] in PLACE.index and s["code"] in VAR.index:
                st.button(f"{var_label(s['code'])} · {PLACE.loc[s['place_id'], 'name']}: {s['reason']}",
                          key=f"sugg{i}", on_click=choose, args=(s["place_id"], s["code"]))
    cols = st.columns(len(DEMO_QUESTIONS))
    for col, (label, pid, code) in zip(cols, DEMO_QUESTIONS):
        col.button(label, on_click=choose, args=(pid, code), width="stretch")

    place = {**PLACE.loc[st.session_state.place].to_dict(), "id": st.session_state.place}
    variable = {**VAR.loc[st.session_state.code].to_dict(), "code": st.session_state.code}
    df, result = series_and_result(place["id"], variable["code"])
    if df is None:
        st.error(f"No data file yet for {variable['name']} in {place['name']}.")
    else:
        text = verdict_card(result, variable, place)
        remove = st.toggle("Remove seasons", value=True,
                           help="Subtract each calendar month's average so the long-term drift is easier to see.")
        st.plotly_chart(trend_chart(df, result, remove_seasons=remove, units=variable["units"]),
                        width="stretch", config={"displayModeBar": False})
        if remove:
            st.caption("Thin line: monthly values with the seasons removed · Bold line: the straight-line trend · "
                       + (result.get("band_meaning") or ""))
        else:
            st.caption("Raw monthly values, including the seasons. Switch on “Remove seasons” to see the trend.")
        details(result, variable, place, text)

with tab_compare:
    st.markdown("**Same measurement, two places, same scale, same method.**")
    c1, c2, c3 = st.columns(3)
    code = c1.selectbox("Measurement", list(VAR.index), format_func=var_label, key="cmp_code")
    ids = list(PLACE.index)
    a = c2.selectbox("Place A", ids, index=ids.index("lake_mead") if "lake_mead" in ids else 0,
                     format_func=place_label, key="cmp_a")
    b = c3.selectbox("Place B", ids, index=ids.index("niamey") if "niamey" in ids else min(1, len(ids) - 1),
                     format_func=place_label, key="cmp_b")
    variable = {**VAR.loc[code].to_dict(), "code": code}
    pairs = [(pid, *series_and_result(pid, code)) for pid in (a, b)]
    # Shared y-axis so both charts use the same scale (display only: min/max of what analyze returned)
    values = [v for _, df, r in pairs if r for k in ("anomaly", "band_low", "band_high") for v in r[k] if v is not None]
    y_range = [min(values), max(values)] if values else None
    for col, (pid, df, r) in zip(st.columns(2), pairs):
        with col:
            place = {**PLACE.loc[pid].to_dict(), "id": pid}
            if df is None:
                st.error(f"No data file yet for {variable['name']} in {place['name']}.")
                continue
            verdict_card(r, variable, place, compact=True)
            st.plotly_chart(trend_chart(df, r, remove_seasons=True, units=variable["units"],
                                        y_range=y_range, height=300, legend=False),
                            width="stretch", config={"displayModeBar": False}, key=f"cmp_chart_{pid}")
            notes(r)
    st.info("Same method, different answers: trends depend on the place. A trend shows **what** changed, not **why**.",
            icon="💡")

st.divider()
st.caption("Hyperion · NASA Space Apps Challenge · Data: NASA Giovanni (MERRA-2, GPM IMERG, GLDAS). "
           "Trends are straight-line summaries of 2001–2024; they show what changed, not why.")
