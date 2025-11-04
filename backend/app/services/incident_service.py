import json
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import REPO_ROOT, settings
from app.models.incident import Incident
from app.services.cluster_service import contradictions, recluster
from app.services.images import prepare_image
from app.services.meta_client import redact
from app.services.muse_service import interpret
from app.services.risk_service import assess, combine
from app.services.sam_service import segment_image


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _next_id(db: Session) -> str:
    numbers = []
    for (value,) in db.query(Incident.id).all():
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits:
            numbers.append(int(digits))
    return f"INC-{(max(numbers) if numbers else 0) + 1:03d}"


def create_incident(
    db: Session,
    *,
    description: str,
    location_text: str | None,
    latitude: float | None,
    longitude: float | None,
    channel: str,
    lang: str,
    image: bytes | None = None,
    run_segmentation: bool = False,
    use_model: bool = True,
    incident_id: str | None = None,
    created_at: datetime | None = None,
) -> Incident:
    prepared = None
    if image:
        prepared = prepare_image(image)
    has_image = prepared is not None
    baseline = assess(description, location_text, latitude, longitude, has_image, lang)
    model = None
    error = None
    if use_model and settings.meta_api_key:
        try:
            data_url = None
            if prepared:
                import base64

                data_url = f"data:{prepared[1]};base64,{base64.b64encode(prepared[0]).decode()}"
            model = interpret(description, location_text, latitude is not None and longitude is not None, data_url)
        except Exception as exc:
            error = redact(str(exc))
    analysis = combine(baseline, model, has_image=has_image, lang=lang)
    if incident_id and not use_model:
        analysis["source"] = "demo_seed"
        analysis["model"] = None
    if error and model is None:
        analysis["source"] = "deterministic_rules"
        analysis["model"] = None
        analysis["meta_error"] = error
        analysis["notes"] = list(dict.fromkeys([*analysis.get("notes", []), "Muse Spark não respondeu. A leitura visível veio das regras determinísticas."]))
    elif model is None:
        analysis["meta_error"] = None

    segmentation = None
    if prepared and run_segmentation:
        prompt = "mud" if analysis["incident_type"] == "landslide" else "water"
        segmentation = segment_image(prepared[0], prepared[1], prepared[2], prepared[3], prompt, lang)

    now = created_at or utcnow()
    incident_id = incident_id or _next_id(db)
    evidence_name = None
    if prepared:
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        evidence_name = f"{incident_id}.jpg"
        (settings.upload_dir / evidence_name).write_bytes(prepared[0])

    row = Incident(
        id=incident_id,
        incident_type=analysis["incident_type"],
        severity=analysis["severity"],
        description=description.strip(),
        summary=analysis["summary"],
        affected_area=analysis["affected_area"],
        location_text=(location_text or "").strip(),
        latitude=latitude,
        longitude=longitude,
        status="pending_validation",
        channel=channel,
        evidence_path=evidence_name,
        source=analysis["source"],
        analysis=analysis,
        segmentation=segmentation,
        requires_confirmation=analysis["requires_confirmation"],
        people_at_risk=analysis["people_at_risk"],
        recommended_actions=analysis["recommended_actions"],
        simple_alert=analysis["simple_alert"],
        lang="en" if lang == "en" else "pt",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    recluster(db)
    db.refresh(row)
    return row


def set_status(db: Session, incident_id: str, status: str) -> Incident | None:
    row = db.get(Incident, incident_id)
    if row is None:
        return None
    row.status = status
    row.updated_at = utcnow()
    note = (
        "A confirmation means a person looked at the report. It does not mean a road is safe."
        if row.lang == "en"
        else "Confirmar significa que uma pessoa viu o relato. Não significa que uma estrada esteja segura."
    )
    analysis = dict(row.analysis or {})
    notes = list(analysis.get("notes") or [])
    if status == "confirmed" and note not in notes:
        notes.append(note)
    analysis["notes"] = notes
    analysis["road_safety"] = "unknown"
    row.analysis = analysis
    db.commit()
    db.refresh(row)
    return row


def to_public(row: Incident, db: Session) -> dict:
    siblings = []
    notes = []
    if row.cluster_id:
        group = (
            db.query(Incident)
            .filter(Incident.cluster_id == row.cluster_id)
            .order_by(Incident.created_at)
            .all()
        )
        if len(group) > 1:
            siblings = [
                {
                    "id": item.id,
                    "summary": item.summary,
                    "severity": item.severity,
                    "status": item.status,
                    "created_at": item.created_at.isoformat(),
                }
                for item in group
                if item.id != row.id
            ]
            notes = contradictions(group, row.lang)
    analysis = dict(row.analysis or {})
    analysis["road_safety"] = "unknown"
    return {
        "id": row.id,
        "incident_type": row.incident_type,
        "severity": row.severity,
        "description": row.description,
        "summary": row.summary,
        "affected_area": row.affected_area,
        "location_text": row.location_text,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "status": row.status,
        "channel": row.channel,
        "source": row.source,
        "requires_confirmation": row.requires_confirmation,
        "people_at_risk": row.people_at_risk,
        "recommended_actions": row.recommended_actions,
        "simple_alert": row.simple_alert,
        "lang": row.lang,
        "cluster_id": row.cluster_id,
        "siblings": siblings,
        "contradictions": notes,
        "analysis": analysis,
        "segmentation": row.segmentation,
        "evidence_url": f"/uploads/{row.evidence_path}" if row.evidence_path else None,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "road_safety": "unknown",
    }


def stats(db: Session) -> dict:
    rows = db.query(Incident).all()
    by_severity = {name: 0 for name in ("LOW", "MODERATE", "HIGH", "CRITICAL")}
    areas: dict[str, int] = {}
    clusters: dict[str, int] = {}
    for row in rows:
        by_severity[row.severity] = by_severity.get(row.severity, 0) + 1
        areas[row.affected_area] = areas.get(row.affected_area, 0) + 1
        if row.cluster_id:
            clusters[row.cluster_id] = clusters.get(row.cluster_id, 0) + 1
    return {
        "total": len(rows),
        "by_severity": by_severity,
        "pending_confirmation": sum(1 for row in rows if row.requires_confirmation and row.status == "pending_validation"),
        "pending_status": sum(1 for row in rows if row.status == "pending_validation"),
        "active_alerts": sum(
            1
            for row in rows
            if row.status != "dismissed" and row.severity in {"HIGH", "CRITICAL"} and row.incident_type in {"flood", "landslide"}
        ),
        "images": sum(
            1
            for row in rows
            if row.evidence_path or row.channel == "photo" or (row.segmentation and row.segmentation.get("status") == "completed")
        ),
        "areas": [{"area": key, "count": value} for key, value in sorted(areas.items(), key=lambda item: (-item[1], item[0]))],
        "possible_duplicate_groups": sum(1 for value in clusters.values() if value > 1),
        "metrics_note": "Contagens dos relatos registados. Não são métricas de precisão do modelo.",
    }


def seed_if_empty(db: Session) -> None:
    if db.query(Incident).count():
        return
    payload = json.loads((REPO_ROOT / "shared" / "demo_reports.json").read_text(encoding="utf-8"))
    now = utcnow()
    for item in payload:
        create_incident(
            db,
            description=item["description"],
            location_text=item.get("location_text"),
            latitude=item.get("latitude"),
            longitude=item.get("longitude"),
            channel=item.get("channel") or "text",
            lang="pt",
            use_model=False,
            incident_id=item["id"],
            created_at=now - timedelta(hours=float(item.get("hours_ago") or 0)),
        )


def reset_demo(db: Session) -> None:
    db.query(Incident).delete()
    db.commit()
    if settings.upload_dir.exists():
        for path in settings.upload_dir.glob("*.jpg"):
            path.unlink(missing_ok=True)
    seed_if_empty(db)
