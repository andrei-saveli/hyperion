"""Charts for Hyperion (handshake H5). Owner: Frontend.

trend_chart(df, result, remove_seasons=True, title="", y_range=None) -> Plotly figure
place_map(places, selected_ids) -> Plotly figure

Rules: only draw what stats.analyze() computed. No statistics are calculated here.
"""
import plotly.graph_objects as go

# Colours that read well on both dark and light backgrounds
DATA_COLOUR = "#6f9fdc"     # thin monthly line
TREND_COLOUR = "#17b890"    # bold trend line
BAND_COLOUR = "rgba(23, 184, 144, 0.25)"  # shaded 95% range of the trend line


def _layout(fig, title, y_title, y_range, height):
    fig.update_layout(
        title=dict(text=title, x=0, font=dict(size=15)),
        height=height,
        margin=dict(l=10, r=10, t=40 if title else 10, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.0, xanchor="right", x=1),
        hovermode="x unified",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    fig.update_yaxes(title_text=y_title, range=y_range, zeroline=True, zerolinecolor="rgba(128,128,128,0.4)",
                     gridcolor="rgba(128,128,128,0.15)")
    fig.update_xaxes(gridcolor="rgba(128,128,128,0.15)")
    return fig


def trend_chart(df, result, remove_seasons=True, title="", y_range=None, units="", height=380, legend=True):
    """Monthly data with the trend line and its shaded 95% band (H5).

    remove_seasons=True:  anomalies (seasons removed) + trend + band, all from `result`.
    remove_seasons=False: the raw monthly values from `df` (no trend: it's fitted on anomalies).
    y_range: optional [low, high] so two charts can share the same scale (compare tab).
    """
    fig = go.Figure()
    dates = df["date"]
    if not remove_seasons:
        fig.add_scatter(x=dates, y=df["value"], mode="lines", name="Monthly values",
                        line=dict(color=DATA_COLOUR, width=1.5))
        return _layout(fig, title, units, y_range, height)

    fig.add_scatter(x=dates, y=result["anomaly"], mode="lines", name="Monthly (seasons removed)",
                    line=dict(color=DATA_COLOUR, width=1), opacity=0.8)
    if result.get("trend") and result["trend"][0] is not None:
        # Band: draw the upper edge invisibly, then fill down to the lower edge.
        fig.add_scatter(x=dates, y=result["band_high"], mode="lines", line=dict(width=0),
                        showlegend=False, hoverinfo="skip")
        fig.add_scatter(x=dates, y=result["band_low"], mode="lines", line=dict(width=0),
                        fill="tonexty", fillcolor=BAND_COLOUR, name="95% range of the trend", hoverinfo="skip")
        fig.add_scatter(x=dates, y=result["trend"], mode="lines", name="Trend",
                        line=dict(color=TREND_COLOUR, width=3.5))
    fig.update_layout(showlegend=legend)
    return _layout(fig, title, f"difference from usual ({units})" if units else "", y_range, height)


def place_map(places, selected_ids=(), height=230):
    """Small world map with each place's box; selected places highlighted."""
    fig = go.Figure()
    for _, p in places.iterrows():
        on = p["id"] in selected_ids
        lons = [p["west"], p["east"], p["east"], p["west"], p["west"]]
        lats = [p["south"], p["south"], p["north"], p["north"], p["south"]]
        fig.add_trace(go.Scattergeo(
            lon=lons, lat=lats, mode="lines", hoverinfo="skip", showlegend=False,
            line=dict(width=3 if on else 1.5, color=TREND_COLOUR if on else "#8b94ad")))
        fig.add_trace(go.Scattergeo(
            lon=[p["lon"]], lat=[p["lat"]], mode="markers", name=p["name"], showlegend=False,
            hovertemplate=f"{p['name']}<extra></extra>",
            marker=dict(size=11 if on else 7, color=TREND_COLOUR if on else "#8b94ad",
                        line=dict(width=1, color="white"))))
    fig.update_geos(projection_type="natural earth", showland=True, landcolor="rgba(128,128,128,0.25)",
                    showocean=False, showcountries=False, coastlinecolor="rgba(128,128,128,0.6)",
                    showframe=False, bgcolor="rgba(0,0,0,0)")
    fig.update_layout(height=height, margin=dict(l=0, r=0, t=0, b=0), paper_bgcolor="rgba(0,0,0,0)")
    return fig
