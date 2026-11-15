"""Build data/capitals.json: every country and its capital city, for questions such as
"Is the capital of Peru getting warmer?" or "rain near Niger's capital".

Source: Wikidata (public domain, CC0), asked once here; the website never asks Wikidata itself.
Countries with more than one capital (South Africa, Bolivia...) keep them all; the search then offers
each one. A few everyday names that Wikidata spells differently are added by hand (ALIASES).

Run from the repository root:  python3 Website/build_capitals.py     (Python standard library only)
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
QUERY = """
SELECT ?country ?countryLabel ?capital ?capitalLabel ?coord WHERE {
  ?country wdt:P31 wd:Q3624078; wdt:P36 ?capital.        # sovereign states and their capitals
  ?capital wdt:P625 ?coord.
  FILTER NOT EXISTS { ?country wdt:P576 [] }            # not dissolved
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""
# Everyday names -> the country name Wikidata uses
ALIASES = {
    "People's Republic of China": ["china"], "United States": ["usa", "us", "u.s.", "america", "united states of america"],
    "United Kingdom": ["uk", "britain", "great britain"], "Kingdom of the Netherlands": ["netherlands", "holland"],
    "Czech Republic": ["czechia"], "Ivory Coast": ["côte d'ivoire", "cote d'ivoire"], "Myanmar": ["burma"],
    "Turkey": ["türkiye", "turkiye"], "Democratic Republic of the Congo": ["dr congo", "drc", "congo-kinshasa"],
    "Republic of the Congo": ["congo-brazzaville"], "Timor-Leste": ["east timor"], "Eswatini": ["swaziland"],
    "North Macedonia": ["macedonia"], "Cape Verde": ["cabo verde"], "South Korea": ["korea"],
}
FIRST = {"South Africa": "Pretoria", "Bolivia": "La Paz", "Sri Lanka": "Sri Jayawardenepura Kotte"}   # shown first


def main():
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": QUERY})
    request = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json",
                                                   "User-Agent": "ByteMe-trend-detective-build/1.0 (NASA Space Apps project)"})
    with urllib.request.urlopen(request, timeout=120) as reply:
        rows = json.load(reply)["results"]["bindings"]
    countries = {}
    for row in rows:
        country, capital = row["countryLabel"]["value"], row["capitalLabel"]["value"]
        if country.startswith("Q") and country[1:].isdigit():      # no English name
            continue
        lon, lat = (float(v) for v in row["coord"]["value"].removeprefix("Point(").removesuffix(")").split())
        entry = countries.setdefault(country, {"country": country, "aliases": ALIASES.get(country, []), "capitals": []})
        if not any(c["name"] == capital for c in entry["capitals"]):
            entry["capitals"].append({"name": capital, "lat": round(lat, 4), "lon": round(lon, 4)})
    for entry in countries.values():
        first = FIRST.get(entry["country"])
        entry["capitals"].sort(key=lambda c: (c["name"] != first, c["name"]))
    missing = [name for name in ALIASES if name not in countries]
    if missing:
        raise SystemExit(f"Wikidata names changed, update ALIASES: {missing}")
    out = {"source": "Wikidata (CC0), sovereign states (Q3624078) and their capitals (P36); built by build_capitals.py",
           "countries": sorted(countries.values(), key=lambda e: e["country"])}
    (HERE / "data" / "capitals.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote data/capitals.json: {len(countries)} countries")


if __name__ == "__main__":
    main()
