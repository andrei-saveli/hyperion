"""Opens Person 3's page from Task3/pages/2_How_it_works.py inside this website.

While we work in Task folders, this small file makes the real modules (Task2/3/4 and charts.py)
importable and then runs the page. In the final project (combine.py) the real page replaces it.
"""
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]  # FrontEnd_claude/
REPO = HERE.parent
sys.path[:0] = [str(HERE)] + [str(REPO / t) for t in ("Task2", "Task3", "Task4")]
runpy.run_path(str(REPO / "Task3" / "pages" / "2_How_it_works.py"), run_name="__main__")
