"""Byte Me Analitics page router."""

import streamlit as st


home_page = st.Page(
    "pages/0_Home.py",
    title="Home",
    icon=":material/public:",
    default=True,
)
investigation_page = st.Page(
    "pages/1_Investigation.py",
    title="Query",
    icon=":material/query_stats:",
    url_path="query",
)
about_page = st.Page(
    "pages/2_About.py",
    title="About us",
    icon=":material/info:",
    url_path="about",
)
demo_page = st.Page(
    "pages/1_Guided_demo.py",
    title="Guided demo",
    icon=":material/play_circle:",
    url_path="demo",
)

navigation = st.navigation(
    [home_page, investigation_page, demo_page, about_page],
    position="hidden",
)
if navigation == demo_page:
    st.page_link(home_page, label="Home", icon=":material/home:")
    st.page_link(investigation_page, label="Search", icon=":material/query_stats:")
navigation.run()
