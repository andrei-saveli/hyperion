"""Shared top navigation for the Byte Me Analitics pages."""

import streamlit as st


def render_top_navigation(active_page):
    """Render shared page controls with a clear active state."""
    st.markdown(
        """
        <style>
            .st-key-top_navigation {
                padding-top: 0.8rem;
            }
            .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"] {
                border: 1px solid rgba(76, 203, 246, 0.6) !important;
                background: #06182d !important;
                color: #d5efff !important;
                opacity: 1 !important;
            }
            .st-key-top_navigation div[data-testid="stButton"] > button[kind="secondary"]:hover {
                border-color: #16d9ff !important;
                background: #0a2440 !important;
                color: #ffffff !important;
            }
            .st-key-top_navigation [data-testid="stLinkButton"] a {
                min-height: 2.35rem;
                width: 136px;
                border-radius: 0.15rem;
                font-size: 0.68rem;
                font-weight: 700;
                letter-spacing: 0.1em;
                border: 1px solid #16d9ff !important;
                background: #06182d !important;
                color: #16d9ff !important;
                box-shadow: none;
            }
            .st-key-top_navigation [data-testid="stLinkButton"] a:hover {
                border-color: #8ceeff !important;
                background: #0a2440 !important;
                color: #ffffff !important;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )
    with st.container(
        key="top_navigation",
        horizontal=True,
        horizontal_alignment="center",
        vertical_alignment="center",
        wrap=True,
        gap="small",
    ):
        if st.button(
            "HOME",
            key=f"nav_home_{active_page}",
            type="primary" if active_page == "home" else "secondary",
            width=136,
        ) and active_page != "home":
            st.switch_page("pages/0_Home.py")

        if st.button(
            "SEARCH",
            key=f"nav_search_{active_page}",
            type="primary" if active_page == "search" else "secondary",
            width=136,
        ) and active_page != "search":
            st.switch_page("pages/1_Investigation.py")

        if st.button(
            "ABOUT US",
            key=f"nav_about_{active_page}",
            type="primary" if active_page == "about" else "secondary",
            width=136,
        ) and active_page != "about":
            st.switch_page("pages/2_About.py")

        st.link_button(
            "SOURCES ↗",
            "https://giovanni.gsfc.nasa.gov/giovanni/",
            key=f"nav_sources_{active_page}",
            type="secondary",
            width=136,
            help="Open NASA Giovanni",
        )
