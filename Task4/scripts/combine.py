"""Combine everyone's Task folders into the final project layout, then check it.

Run from the repository root:
    python Task4/scripts/combine.py                      # builds ./final
    python Task4/scripts/combine.py --frontend ../frontend-nasa   # also adds the website
    python Task4/scripts/combine.py --out some/other/folder

What goes where (see AGENTS.md "Repo layout"):
    Task2 (Data)            -> data_io.py, data/<place>_<CODE>.csv, data/raw/giovanni/, data/SOURCES.md,
                               scripts/convert_giovanni.py
    Task3 (Search+explain)  -> search.py, search_model.py, explain.py, pages/, models/search/,
                               scripts/*search*.py, data/search_*.jsonl
    Task4 (Trend)           -> stats.py, tests/, scripts/results_table.py, scripts/check_handshakes.py
    Frontend (optional)     -> app.py, investigate.py, charts.py, .streamlit/  (its FAKE data_io/stats/explain/search
                               files are NOT copied: the real ones above replace them)
    places.csv/variables.csv -> from Task3/data if they exist, otherwise the starting catalogue
                               built into Task2/data_io.py

The output folder is rebuilt from scratch every time. Nothing in the Task folders is changed.
"""
import sys

# Friendly check first: the project needs Python 3.11+ (macOS ships 3.9, which fails with a
# confusing "unsupported operand type(s) for |" error).
if sys.version_info < (3, 11):
    sys.exit(f"This project needs Python 3.11 or newer; you have {sys.version.split()[0]}.\n"
             "Install it from https://www.python.org/downloads/ and open a new Terminal window.")

import argparse
import importlib.util
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "final"  # set in main()

REQUIREMENTS = """\
# Hyperion: everything the app needs (merged from all parts)
streamlit>=1.40
plotly>=5.20
pandas>=2.0
numpy>=1.26
scipy>=1.11
pytest>=8.0
"""

# The AI search (Task3) needs large extra libraries (~1 GB). Kept separate on purpose:
# install only if the search model has been built and calibrated.
REQUIREMENTS_SEARCH = """\
# Optional: only for the AI search model in search_model.py (~1 GB of libraries).
# Without these, search() returns an empty list instead of crashing.
sentence-transformers==5.1.2
torch
"""


def _show(path: Path) -> str:
    for base in (OUT, REPO):
        if path.is_relative_to(base):
            return str(path.relative_to(base))
    return str(path)


def copy(src: Path, dst: Path):
    """Copy a file or folder, creating parent folders. Missing sources are skipped with a note."""
    if not src.exists():
        print(f"  skip (not found): {_show(src)}")
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache"))
    else:
        shutil.copy2(src, dst)
    print(f"  {_show(src)} -> {_show(dst)}")


def write_catalogues(out: Path):
    """places.csv / variables.csv: Task3's real files if present, else Task2's starting catalogue."""
    for name in ("places.csv", "variables.csv"):
        real = REPO / "Task3" / "data" / name
        if real.exists():
            copy(real, out / "data" / name)
            continue
        spec = importlib.util.spec_from_file_location("task2_data_io", REPO / "Task2" / "data_io.py")
        data_io = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(data_io)
        table = data_io.load_places() if name == "places.csv" else data_io.load_variables()
        table.to_csv(out / "data" / name, index=False)
        print(f"  starting catalogue -> data/{name} (Task3 hasn't delivered its own yet)")


def combine(out: Path, frontend: Path | None):
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    t2, t3, t4 = REPO / "Task2", REPO / "Task3", REPO / "Task4"

    print("Data (Task2):")
    copy(t2 / "data_io.py", out / "data_io.py")
    for csv in sorted((t2 / "cleaned").glob("*.csv")):
        copy(csv, out / "data" / csv.name)
    copy(t2 / "raw", out / "data" / "raw" / "giovanni")
    copy(t2 / "SOURCES.md", out / "data" / "SOURCES.md")
    copy(t2 / "convert_giovanni.py", out / "scripts" / "convert_giovanni.py")
    write_catalogues(out)

    print("Search + explainability (Task3):")
    for name in ("search.py", "search_model.py", "explain.py"):
        copy(t3 / name, out / name)
    copy(t3 / "pages", out / "pages")
    copy(t3 / "models", out / "models")
    for script in sorted((t3 / "scripts").glob("*.py")):
        copy(script, out / "scripts" / script.name)
    for jsonl in sorted((t3 / "data").glob("search_*.jsonl")):
        copy(jsonl, out / "data" / jsonl.name)

    print("Trend + integration (Task4):")
    copy(t4 / "stats.py", out / "stats.py")
    copy(t4 / "tests", out / "tests")
    for name in ("results_table.py", "check_handshakes.py"):
        copy(t4 / "scripts" / name, out / "scripts" / name)

    if frontend:
        print("Frontend:")
        for name in ("app.py", "investigate.py", "charts.py"):
            copy(frontend / name, out / name)
        copy(frontend / ".streamlit", out / ".streamlit")
        # pages/ come from Task3 only (the frontend's pages/ are just links to them)
    else:
        print("Frontend: not included (pass --frontend PATH once app.py exists)")

    (out / "requirements.txt").write_text(REQUIREMENTS, encoding="utf-8")
    (out / "requirements-search.txt").write_text(REQUIREMENTS_SEARCH, encoding="utf-8")
    print("  requirements.txt, requirements-search.txt written")


def run_checks(out: Path) -> bool:
    """Run the tests and the handshake checker inside the combined project."""
    ok = True
    for title, cmd in (("Tests", [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "tests"]),
                       ("Handshakes", [sys.executable, "scripts/check_handshakes.py"])):
        print(f"\n== {title}")
        result = subprocess.run(cmd, cwd=out, capture_output=True, text=True)
        lines = (result.stdout + result.stderr).strip().splitlines()
        if title == "Tests":
            print(lines[-1] if lines else "no output")
        else:  # show only problems, warnings and the summary (not the long list of ✅)
            print("\n".join(line for line in lines if not line.startswith("✅")))
        ok &= result.returncode == 0
    for cache in out.rglob("__pycache__"):
        shutil.rmtree(cache, ignore_errors=True)
    return ok


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=REPO / "final", help="output folder (default: ./final)")
    parser.add_argument("--frontend", type=Path, help="folder with app.py and charts.py (e.g. ../frontend-nasa)")
    parser.add_argument("--no-checks", action="store_true", help="only copy, don't run tests/checks")
    args = parser.parse_args()

    global OUT
    OUT = args.out.resolve()
    combine(OUT, args.frontend.resolve() if args.frontend else None)
    if args.no_checks:
        return
    ok = run_checks(OUT)
    print("\nREADY" if ok else "\nNOT READY: fix the ❌ lines above (or the failing tests) first")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
