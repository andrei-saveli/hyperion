"""Reusable Plotly charts for Byte Me Analitics."""

import plotly.graph_objects as go


def trend_chart(df, result, remove_seasons=True, title=""):
    """Return the monthly trend chart required by handshake H5.

    The chart deliberately uses only ``df`` and ``result`` so that the guided
    demo can reuse it without loading any extra data.
    """
    figure = go.Figure()

    has_trend = result["slope_per_decade"] is not None
    if remove_seasons and has_trend:
        figure.add_trace(
            go.Scatter(
                x=df["date"],
                y=result["band_high"],
                mode="lines",
                line={"width": 0},
                hoverinfo="skip",
                showlegend=False,
                name="95% interval upper bound",
            )
        )
        figure.add_trace(
            go.Scatter(
                x=df["date"],
                y=result["band_low"],
                mode="lines",
                line={"width": 0},
                fill="tonexty",
                fillcolor="rgba(59, 130, 246, 0.18)",
                hoverinfo="skip",
                name="95% interval",
            )
        )
    figure.add_trace(
        go.Scatter(
            x=df["date"],
            y=result["anomaly"] if remove_seasons else df["value"],
            mode="lines" if has_trend else "lines+markers",
            line={"color": "#38bdf8", "width": 1.5},
            marker={"size": 4},
            name="Monthly anomaly" if remove_seasons else "Monthly value",
            hovertemplate="%{x|%b %Y}<br>%{y:.3g}<extra></extra>",
        )
    )
    if remove_seasons and has_trend:
        figure.add_trace(
            go.Scatter(
                x=df["date"],
                y=result["trend"],
                mode="lines",
                line={"color": "#f97316", "width": 3},
                name="Linear trend",
                hovertemplate="%{x|%b %Y}<br>%{y:.3g}<extra></extra>",
            )
        )
    figure.update_layout(
        title={"text": title, "x": 0.01, "xanchor": "left"},
        xaxis_title="Date",
        yaxis_title="Anomaly" if remove_seasons else "Monthly value",
        font={"family": "JetBrains Mono, monospace"},
        hovermode="x unified",
        legend={"orientation": "h", "yanchor": "bottom", "y": 1.02, "x": 0},
        margin={"l": 24, "r": 16, "t": 74 if title else 48, "b": 24},
        height=430,
    )
    return figure
