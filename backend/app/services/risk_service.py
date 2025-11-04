import json
import re

from app.config import REPO_ROOT
from app.services.textutil import clip, contains_any, fold

SEVERITIES = ("LOW", "MODERATE", "HIGH", "CRITICAL")
RANK = {name: index for index, name in enumerate(SEVERITIES)}
COORD_RE = re.compile(r"-?\d{1,3}\.\d{3,}")

_RULES: dict | None = None


def rules() -> dict:
    global _RULES
    if _RULES is None:
        _RULES = json.loads((REPO_ROOT / "shared" / "flood_rules.json").read_text(encoding="utf-8"))
    return _RULES


def lang_of(lang: str | None) -> str:
    return "en" if lang == "en" else "pt"


def _copy(lang: str) -> dict[str, str]:
    if lang == "en":
        return {
            "unknown_area": "Location not provided",
            "people_yes": "The report mentions people in the area. The number is not confirmed.",
            "people_no": "The report does not say whether people are at risk.",
            "missing_place": "The location is missing.",
            "missing_coords": "There are no verified coordinates. The place was given in text.",
            "need_human": "A person needs to confirm this report.",
            "road_line": "No road was classified as safe.",
            "filtered_safe": "A model sentence was removed because it suggested safety without verified data.",
            "filtered_depth": "A depth estimate was removed. A photograph does not measure depth.",
            "filtered_coords": "Coordinates written by the model were removed. This system does not invent positions.",
            "capped": "The model label was not accepted as a confirmed flood because the report has no flood evidence.",
            "floor": "Severity was kept at the deterministic reading because the text describes explicit danger.",
            "image_note": "The photograph is visual evidence only. It does not measure depth or make a road safe.",
            "summary_flood": "Flood report at {area}.",
            "summary_slide": "Possible landslide report at {area}.",
            "summary_other": "Report received. It is not confirmed as a flood.",
            "alert_flood": "Flood alert. {label} risk. A flood was reported at {area}. {actions}",
            "alert_slide": "Landslide alert. {label} risk. A landslide was reported at {area}. {actions}",
            "alert_other": "Report received. This is not confirmed as a flood. {actions}",
        }
    return {
        "unknown_area": "Local não indicado",
        "people_yes": "O relato menciona pessoas na zona. O número não foi confirmado.",
        "people_no": "O relato não indica se há pessoas em risco.",
        "missing_place": "Falta a localização.",
        "missing_coords": "Não há coordenadas verificadas. O local foi indicado por texto.",
        "need_human": "É precisa confirmação humana.",
        "road_line": "Nenhuma estrada foi classificada como segura.",
        "filtered_safe": "Uma frase do modelo foi retirada porque sugeria segurança sem dados verificados.",
        "filtered_depth": "Uma estimativa de profundidade foi retirada. Uma fotografia não mede a profundidade.",
        "filtered_coords": "Coordenadas escritas pelo modelo foram retiradas. O sistema não inventa posições.",
        "capped": "A classificação do modelo não foi aceite como inundação confirmada porque o relato não traz evidência de inundação.",
        "floor": "A gravidade manteve a leitura determinística porque o texto descreve perigo explícito.",
        "image_note": "A fotografia é evidência visual. Não mede profundidade nem torna uma estrada segura.",
        "summary_flood": "Inundação reportada em {area}.",
        "summary_slide": "Possível deslizamento reportado em {area}.",
        "summary_other": "Relato recebido. Ainda não está confirmado como inundação.",
        "alert_flood": "Alerta de inundação. Risco {label}. Existe uma inundação reportada em {area}. {actions}",
        "alert_slide": "Alerta de deslizamento. Risco {label}. Existe um deslizamento reportado em {area}. {actions}",
        "alert_other": "Relato recebido. Ainda não está confirmado como inundação. {actions}",
    }


def extract_area(text: str) -> str | None:
    patterns = [
        r"(?i)\b((?:rua|avenida|av\.)\s+\S+(?:\s+\S+){0,5})",
        r"(?i)(?:pr[oó]xim[ao]\s+d[aoe]|junto\s+[aà]o?|em\s+frente\s+[aà]o?)\s+([^.,;\n]{3,60})",
    ]
    blocked = set(rules()["generic_places"])
    for pattern in patterns:
        match = re.search(pattern, text or "")
        if not match:
            continue
        found = " ".join(match.group(1).split()).strip(" -")
        if fold(found) in blocked or len(found) < 4:
            continue
        return found[:120]
    return None


def _people(folded: str, lang: str) -> str:
    copy = _copy(lang)
    if contains_any(folded, rules()["people_terms"]):
        return copy["people_yes"]
    return copy["people_no"]


def _base_actions(incident_type: str, severity: str, lang: str) -> list[str]:
    data = rules()
    if incident_type == "other":
        actions = list(data["unknown_actions"][lang])
    elif incident_type == "unconfirmed" and severity in {"HIGH", "CRITICAL"}:
        actions = list(data["unconfirmed_danger_actions"][lang])
    else:
        actions = list(data["actions"][lang][severity])
    if incident_type == "landslide":
        actions = list(data["landslide_actions"][lang]) + actions
    return actions


def assess(
    description: str,
    location_text: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    has_image: bool = False,
    lang: str | None = "pt",
) -> dict:
    language = lang_of(lang)
    copy = _copy(language)
    folded = fold(description)
    data = rules()
    flood = contains_any(folded, data["flood_terms"]) is not None
    slide = contains_any(folded, data["landslide_terms"]) is not None
    level = None
    for name in ("CRITICAL", "HIGH", "MODERATE", "LOW"):
        if contains_any(folded, data["severity_terms"][name]):
            level = name
            break

    if slide:
        incident_type = "landslide"
    elif flood:
        incident_type = "flood"
    elif level in {"HIGH", "CRITICAL"}:
        incident_type = "unconfirmed"
    else:
        incident_type = "other"

    if level is None and incident_type == "landslide":
        level = "HIGH"
    elif level is None and incident_type == "flood":
        level = "MODERATE"
    elif level is None:
        level = "LOW"

    area = (location_text or "").strip() or extract_area(description) or copy["unknown_area"]
    has_place = area != copy["unknown_area"]
    has_coords = latitude is not None and longitude is not None
    missing = []
    if not has_place and not has_coords:
        missing.append(copy["missing_place"])
    elif not has_coords:
        missing.append(copy["missing_coords"])
    if level in {"HIGH", "CRITICAL"} or incident_type in {"landslide", "unconfirmed"}:
        missing.append(copy["need_human"])

    actions = _base_actions(incident_type, level, language)
    if incident_type == "flood":
        summary = copy["summary_flood"].format(area=area)
        alert = copy["alert_flood"]
    elif incident_type == "landslide":
        summary = copy["summary_slide"].format(area=area)
        alert = copy["alert_slide"]
    else:
        summary = copy["summary_other"]
        alert = copy["alert_other"]
    action_text = " ".join(actions)
    label = data["labels"][language][level]
    simple = alert.format(label=label, area=area, actions=action_text)
    simple = f"{simple} {copy['road_line']}"

    requires = (not has_coords) or level in {"HIGH", "CRITICAL"} or incident_type != "flood"
    return {
        "incident_type": incident_type,
        "severity": level,
        "summary": summary,
        "affected_area": area,
        "people_at_risk": _people(folded, language),
        "missing_information": missing,
        "requires_confirmation": requires,
        "recommended_actions": actions,
        "simple_alert": simple,
        "source": "deterministic_rules",
        "model": None,
        "road_safety": "unknown",
        "severity_policy": "rules",
        "notes": [copy["image_note"]] if has_image else [],
        "meta_error": None,
        "hazard_found": flood or slide or incident_type == "unconfirmed",
    }


def _dirty(text: str, phrases: list[str]) -> bool:
    folded = fold(text)
    return contains_any(folded, phrases) is not None


def _clean_model_text(text: str | None, notes: list[str], copy: dict[str, str]) -> str:
    value = clip(text, 500)
    if not value:
        return ""
    if COORD_RE.search(value):
        value = COORD_RE.sub("", value)
        value = " ".join(value.split())
        notes.append(copy["filtered_coords"])
    if _dirty(value, rules()["safe_claim_terms"]):
        notes.append(copy["filtered_safe"])
        return ""
    if _dirty(value, rules()["depth_claim_terms"]):
        notes.append(copy["filtered_depth"])
        return ""
    return value


def combine(
    baseline: dict,
    model: dict | None,
    *,
    has_image: bool,
    lang: str | None,
) -> dict:
    language = lang_of(lang)
    copy = _copy(language)
    result = dict(baseline)
    result["notes"] = list(baseline.get("notes") or [])
    result["road_safety"] = "unknown"
    result.pop("hazard_found", None)
    if not model:
        result["simple_alert"] = _ensure_road_line(result["simple_alert"], copy)
        return result

    notes = result["notes"]
    model_severity = str(model.get("severity") or "").upper()
    hazard = baseline.get("hazard_found", False)
    incident_type = baseline["incident_type"]
    if model_severity not in RANK:
        severity, policy = baseline["severity"], "rules"
    elif not hazard and not has_image:
        if RANK[model_severity] > RANK["MODERATE"]:
            severity, policy = "MODERATE", "capped_without_evidence"
            notes.append(copy["capped"])
        else:
            severity, policy = model_severity, "model_rejected_type"
        incident_type = baseline["incident_type"]
    else:
        if hazard and RANK[model_severity] < RANK[baseline["severity"]]:
            severity, policy = baseline["severity"], "safety_floor"
            notes.append(copy["floor"])
        else:
            severity, policy = model_severity, "model_from_image" if has_image and not hazard else "model"
        proposed = str(model.get("incident_type") or "").lower()
        incident_type = proposed if proposed in {"flood", "landslide", "other", "unconfirmed"} else baseline["incident_type"]
        if not hazard and not has_image:
            incident_type = baseline["incident_type"]

    if not hazard and not has_image:
        incident_type = baseline["incident_type"]

    summary = _clean_model_text(model.get("summary") or model.get("description"), notes, copy) or baseline["summary"]
    people = _clean_model_text(model.get("people_at_risk"), notes, copy) or baseline["people_at_risk"]
    if not (baseline.get("affected_area") and baseline["affected_area"] != copy["unknown_area"]):
        area = _clean_model_text(model.get("affected_area"), notes, copy) or baseline["affected_area"]
    else:
        area = baseline["affected_area"]

    extra_missing = []
    raw_missing = model.get("missing_information") or []
    if isinstance(raw_missing, str):
        raw_missing = [raw_missing]
    for item in raw_missing:
        cleaned = _clean_model_text(str(item), notes, copy)
        if cleaned:
            extra_missing.append(cleaned)

    actions = _base_actions(incident_type, severity, language)
    data = rules()
    label = data["labels"][language][severity]
    if incident_type == "flood":
        template = copy["alert_flood"]
        if summary == baseline["summary"]:
            summary = copy["summary_flood"].format(area=area)
    elif incident_type == "landslide":
        template = copy["alert_slide"]
    else:
        template = copy["alert_other"]
    simple = template.format(label=label, area=area, actions=" ".join(actions))
    simple = f"{simple} {copy['road_line']}"

    requires = bool(baseline["requires_confirmation"]) or bool(model.get("requires_confirmation"))
    if severity in {"HIGH", "CRITICAL"} or has_image or incident_type != "flood":
        requires = True
    missing = list(dict.fromkeys([*baseline["missing_information"], *extra_missing]))
    if requires and copy["need_human"] not in missing and severity in {"HIGH", "CRITICAL"}:
        missing.append(copy["need_human"])

    model_name = model.get("_model") or "muse-spark"
    result.update(
        {
            "incident_type": incident_type,
            "severity": severity,
            "summary": summary,
            "affected_area": area,
            "people_at_risk": people,
            "missing_information": missing,
            "requires_confirmation": requires,
            "recommended_actions": actions,
            "simple_alert": simple,
            "source": model_name,
            "model": model_name,
            "road_safety": "unknown",
            "severity_policy": policy,
            "notes": list(dict.fromkeys(notes)),
        }
    )
    return result


def _ensure_road_line(text: str, copy: dict[str, str]) -> str:
    if copy["road_line"] in text:
        return text
    return f"{text} {copy['road_line']}"
