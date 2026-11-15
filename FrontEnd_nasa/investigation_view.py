"""Time controls and the matched comparison for Byte Me's Query page."""

import streamlit as st

from charts import trend_chart
from investigation import compare_period, fit_period, match_months, slice_period


def set_analysis_period(period=None):
    """Update the shareable dates and reset the slider after a follow-up action."""
    for key, value in zip(("from", "to"), period or (None, None)):
        if value:
            st.query_params[key] = value
        else:
            st.query_params.pop(key, None)
    st.session_state.period_revision = st.session_state.get("period_revision", 0) + 1


def select_analysis_period(series):
    months = series["date"].dt.strftime("%Y-%m").tolist()
    start = st.query_params.get("from", months[0])
    end = st.query_params.get("to", months[-1])
    available = [month for month in months if start <= month <= end]
    if not available:
        st.caption("Those dates fall outside this dataset. The selector shows the available record.")
    options = available or months
    period = (options[0], options[-1])
    if len(months) > 1:
        revision = st.session_state.get("period_revision", 0)
        period = st.select_slider("Months to analyze", months, value=period, key=f"analysis_period_{revision}")
    st.button("Use full record", on_click=set_analysis_period)
    for key, value in zip(("from", "to"), period):
        if st.query_params.get(key) != value:
            st.query_params[key] = value
    return period


def _show_finding(paired, observations, primary_name, reference_name, units):
    first, last = observations["date"].iloc[[0, -1]].dt.strftime("%Y-%m")
    st.caption(f"{first} to {last} · {len(observations)} of {len(paired)} months observed in both places")
    slope, interval = compare_period(paired)
    if slope is None:
        st.subheader("Too little shared data for a trend comparison")
        st.caption("A trend needs at least 24 observations spanning 10 years. You can still inspect the selected months.")
        return
    if interval is None:
        headline = "The difference is uncertain"
    elif interval[0] <= 0 <= interval[1]:
        headline = "The rates could be the same"
    else:
        name = primary_name if interval[0] > 0 else reference_name
        headline = f"The trend rate is higher in {name}"
    st.subheader(headline)
    st.write(f"**{primary_name} minus {reference_name}** · {slope:+.3g} {units} per decade")
    if interval is None:
        st.caption("There are too few effectively independent months to quote an interval.")
    else:
        low, high = interval
        st.caption(f"Approximate 95% interval {low:+.3g} to {high:+.3g} {units} per decade.")
        st.caption("We fit a season-adjusted trend to the difference in each shared month. "
                   "The interval uses a Newey–West adjustment over 12 calendar-month lags.")


def _show_matched_charts(full, paired, names, code, units):
    charts = []
    values = []
    for side, name in zip(("a", "b"), names):
        series = paired[["date", side]].rename(columns={side: "value"})
        baseline = full[["date", side]].rename(columns={side: "value"})
        result = fit_period(series, code, baseline)
        chart = trend_chart(series, result, title=name)
        chart.update_layout(height=320, showlegend=False)
        charts.append(chart)
        values.extend(v for key in ("anomaly", "band_low", "band_high") for v in result[key] if v is not None)
    for column, chart in zip(st.columns(2), charts):
        chart.update_yaxes(title=f"Anomaly ({units})")
        if values and min(values) < max(values):
            chart.update_yaxes(range=[min(values), max(values)])
        with column:
            st.plotly_chart(chart, width="stretch", config={"displayModeBar": False})


def show_matched_comparison(primary, reference, primary_name, reference_name, variable, period):
    full = match_months(primary, reference)
    observed = full.dropna()
    if observed.empty:
        st.info("These records have no shared observations. Try another place.")
        return
    # Keep internal gaps so the uncertainty calculation uses real calendar lags.
    full = full.loc[observed.index[0]:observed.index[-1]].reset_index(drop=True)
    paired = slice_period(full, period)
    observed = paired.dropna()
    units = variable["units"]
    if observed.empty:
        st.info("No months in this period have observations at both places.")
    else:
        _show_finding(paired, observed, primary_name, reference_name, units)

    if len(paired) < len(full):
        full_slope, _ = compare_period(full)
        if full_slope is not None:
            st.caption(f"Full shared record difference · {full_slope:+.3g} {units} per decade")
        full_period = tuple(full["date"].iloc[[0, -1]].dt.strftime("%Y-%m"))
        st.button("Recheck the full shared record", on_click=set_analysis_period, args=(full_period,))
    elif len(full) > 180:
        recent_period = tuple(full["date"].iloc[[-180, -1]].dt.strftime("%Y-%m"))
        st.button("Check the latest 15 years", on_click=set_analysis_period, args=(recent_period,))

    if not observed.empty:
        _show_matched_charts(full, paired, (primary_name, reference_name), variable["code"], units)
