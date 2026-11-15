"""Experimental Task2 coverage checks for the pretrained embedding search."""

import re
from dataclasses import dataclass


# These phrases describe the four documented measurements and three indexed boxes.
# Region aliases refer to the corresponding local box, as in the H0 catalog.
PLACES = {
    "lake_mead": r"lake mead|hoover dam|nevada reservoir|desert reservoir",
    "niamey": r"niamey|sahel|niger['’]s capital|capital of niger",
    "svalbard": r"svalbard|longyearbyen|spitsbergen|arctic islands|the arctic",
}
VARIABLES = {
    "TEMP": r"air temp(?:eratures?)?|temperature|warm\w*|hot\w*|cold\w*|heat",
    "RAIN": r"rain\w*|precipitation|downpour\w*|water.{0,32}(?:from|out of) the sky",
    "SOILM": (
        r"soil moisture|soil water|root.zone|root.layer|rooting.layer|"
        r"(?:soil|dirt|roots?).{0,30}(?:hold|stor|moist|dry|water)|"
        r"(?:water|moisture).{0,38}(?:soil|dirt|roots?|rooting)"
    ),
    "EVAP": (
        r"evap\w*|(?:land|ground|soil|plants?).{0,48}(?:into|to) the (?:air|atmosphere)|"
        r"water (?:loss|going|given off|sent back).{0,45}(?:air|atmosphere)|"
        r"water.{0,25}(?:into|to|back to) the atmosphere"
    ),
}
UNAVAILABLE = (
    r"sea.ice|snow depth|snowpack|glacier mass|ice mass|land.surface temperature|skin temperature|"
    r"subsurface|buried layers|soil temperature|below the surface|relative humidity|nitrogen dioxide|no[₂2]|"
    r"carbon dioxide|co[₂2]|ndvi|greenness|groundwater|aquifers?|wells?|runoff|"
    r"overland flow|river (?:flow|discharge)|flow(?:s)? (?:in|down) the (?:niger )?river|"
    r"surface area|surface footprint|shrink\w*|square kilometres|reservoir (?:level|storage)|"
    r"snowfall only|snow.only|as snow(?:flakes)?[,. ]|excluding (?:anything that fell as )?rain|"
    r"liquid rain removed|top (?:centimetre|centimeter|1 cm)|surface.only soil|"
    r"open.water|off the reservoir|(?:lake|reservoir) surface only|water surface of lake mead|"
    r"(?:lake|reservoir)(?:'s)? water surface|snow accumulation|"
    r"forecast\w*|projected|next (?:year|month|june)|days? (?:above|over|with a maximum)|"
    r"daily (?:maximum|minimum|rainfall|precipitation|observations|record|readings)|"
    r"hourly|day.by.day|week.by.week|afternoons?"
)
CLAUSE_BREAK = re.compile(r"\s*(?:[;:]|,(?!\s*\d)|\b(?:and|plus|versus|vs\.?|alongside|compared with|compare[ds]? with)\b)\s*")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")


def mentions(text, aliases):
    return {key for key, phrases in aliases.items() if re.search(rf"\b(?:{phrases})\b", text)}


@dataclass
class Request:
    places: set
    variables: set
    years: set


def requests(query):
    """Share place context across measurements and measurement context across places."""
    text = query.casefold().strip(" ?.")
    all_places = mentions(text, PLACES)
    clauses = [
        (mentions(clause, PLACES), mentions(clause, VARIABLES), {int(year) for year in YEAR.findall(clause)})
        for clause in CLAUSE_BREAK.split(text)
        if not unavailable(clause)
    ]
    all_variables = set().union(*(variables for _, variables, _ in clauses))
    years = {int(year) for year in YEAR.findall(text)}
    for places, variables, clause_years in clauses:
        if variables:
            yield Request(places or all_places, variables, clause_years or years)
        elif places and len(all_variables) == 1:
            yield Request(places, all_variables, years)


def unavailable(text):
    return bool(re.search(rf"\b(?:{UNAVAILABLE})\b", text))


def covered_candidates(query, keys, coverage):
    """Return indices of covered intents and whether to try semantic fallback."""
    covered = set()
    for request in requests(query):
        if not request.places:
            continue
        for i, key in enumerate(keys):
            place, variable = key.split(":")
            if place not in request.places or variable not in request.variables:
                continue
            start, end = coverage[key]
            if all(start <= year <= end for year in request.years):
                covered.add(i)
    text = query.casefold().strip(" ?.")
    fallback = (
        not covered
        and not YEAR.search(text)
        and not unavailable(text)
        and bool(mentions(text, PLACES))
    )
    return covered, fallback


def rank_covered(case, coverage_match, policy):
    """Rank verified intents or accept one semantic suggestion when scores separate."""
    _, keys, features, _ = case
    indices, fallback = coverage_match
    scores = features[:, 0]
    if indices:
        return [keys[i] for i in sorted(indices, key=lambda i: (-scores[i], i))[:5]]
    if fallback and policy is not None and len(keys) > 1:
        first, second = (-scores).argsort(kind="stable")[:2]
        if scores[first] >= policy["accept"] and scores[first] - scores[second] >= policy["margin"]:
            return [keys[first]]
    return []
