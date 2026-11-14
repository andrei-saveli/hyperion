"""Hyperion: Earth System Trend Detective. The website's front door and menu (Frontend).

Run from the repository root:  streamlit run FrontEnd_claude/app.py

This file only sets up the page and the menu. The pages:
  investigate.py               main page: search, verdict card, chart, compare (Frontend)
  pages/1_Guided_demo.py       step-by-step demo (Person 3)
  pages/2_How_it_works.py      trends and significance explained (Person 3)
"""
import sys
from pathlib import Path

import streamlit as st

# In the final project everything sits next to this file. While we work in Task folders, also
# look in the sibling Task2 (data), Task3 (search, explain) and Task4 (stats) folders.
HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE)] + [str(HERE.parent / t) for t in ("Task2", "Task3", "Task4")]

st.set_page_config(page_title="Hyperion: Trend Detective", page_icon="🛰️", layout="wide")

pages = [st.Page(str(HERE / "investigate.py"), title="Investigate", icon="🔎", default=True)]
for file, title, icon in (("1_Guided_demo.py", "Guided demo", "🕵️"), ("2_How_it_works.py", "How it works", "📚")):
    if (HERE / "pages" / file).exists():  # Person 3's pages, when they exist
        pages.append(st.Page(str(HERE / "pages" / file), title=title, icon=icon))

st.navigation(pages).run()
