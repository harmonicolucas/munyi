from datetime import datetime

from app.services.risk_service import lang_of, rules
from app.services.textutil import contains_any, fold, jaccard, tokens
from app.services.geo import haversine_km


def _hours(left, right) -> float:
    a = getattr(left, "created_at", None)
    b = getattr(right, "created_at", None)
    if not isinstance(a, datetime) or not isinstance(b, datetime):
        return 0.0
    return abs((a - b).total_seconds()) / 3600


def _place_text(item) -> str:
    return " ".join(
        part
        for part in (getattr(item, "location_text", "") or "", getattr(item, "affected_area", "") or "")
        if part
    )


def similarity(left, right) -> float:
    stop = set(rules()["stopwords"])
    return jaccard(tokens(getattr(left, "description", ""), stop), tokens(getattr(right, "description", ""), stop))


def _location_similar(left, right) -> bool:
    a = fold(_place_text(left))
    b = fold(_place_text(right))
    if len(a) < 4 or len(b) < 4:
        return False
    if a in b or b in a:
        return True
    stop = set(rules()["stopwords"])
    return jaccard(tokens(a, stop), tokens(b, stop)) >= 0.5


def _close(left, right) -> bool:
    lat1, lng1 = getattr(left, "latitude", None), getattr(left, "longitude", None)
    lat2, lng2 = getattr(right, "latitude", None), getattr(right, "longitude", None)
    if None in (lat1, lng1, lat2, lng2):
        return False
    return haversine_km(lat1, lng1, lat2, lng2) <= rules()["cluster_radius_km"]


def related(left, right) -> bool:
    if _hours(left, right) > rules()["cluster_window_hours"]:
        return False
    close = _close(left, right)
    named = _location_similar(left, right)
    if not close and not named:
        return False
    score = similarity(left, right)
    if close and score >= rules()["text_similarity_with_coords"]:
        return True
    if named and score >= rules()["text_similarity_with_place_text"]:
        return True
    return False


def trend(text: str) -> str:
    folded = fold(text)
    data = rules()
    up = contains_any(folded, data["rising_terms"]) is not None
    down = contains_any(folded, data["falling_terms"]) is not None
    if up and down:
        return "both"
    if up:
        return "up"
    if down:
        return "down"
    return "none"


def contradictions(group, lang: str | None = "pt") -> list[str]:
    language = lang_of(lang)
    if language == "en":
        mixed = "One report says the water is rising and another says it is falling. Confirm before acting."
        self_mixed = "The same report says the water is both rising and falling. Confirm it."
        gap = "The stated severity does not match across reports. A person needs to confirm this."
    else:
        mixed = "Um relato indica água a subir e outro indica água a baixar. Confirme antes de agir."
        self_mixed = "O mesmo relato diz que a água sobe e desce. Confirme."
        gap = "A gravidade indicada não coincide entre os relatos. É precisa confirmação humana."
    notes = []
    trends = [trend(getattr(item, "description", "") or "") for item in group]
    if "both" in trends:
        notes.append(self_mixed)
    if "up" in trends and "down" in trends:
        notes.append(mixed)
    ranks = []
    order = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
    for item in group:
        level = getattr(item, "severity", None)
        if level in order:
            ranks.append(order[level])
    if ranks and max(ranks) - min(ranks) >= 2:
        notes.append(gap)
    return notes


def recluster(db) -> None:
    from app.models.incident import Incident

    rows = db.query(Incident).order_by(Incident.created_at, Incident.id).all()
    groups: list[list] = []
    for row in rows:
        placed = False
        for group in groups:
            if any(related(row, other) for other in group):
                group.append(row)
                placed = True
                break
        if not placed:
            groups.append([row])
    for index, group in enumerate(groups, start=1):
        cluster_id = f"GRP-{index:03d}"
        for row in group:
            row.cluster_id = cluster_id
    db.commit()
