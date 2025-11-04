from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.incident import Incident
from app.schemas import IncidentIn, StatusIn
from app.services.images import ImageRejected
from app.services.incident_service import create_incident, reset_demo, set_status, stats, to_public
from app.services.voice_service import transcribe

router = APIRouter()


@router.get("/incidents")
def list_incidents(db: Session = Depends(get_db)):
    rows = db.query(Incident).order_by(Incident.created_at.desc()).all()
    return [to_public(row, db) for row in rows]


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    row = db.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Relato não encontrado.")
    return to_public(row, db)


@router.post("/incidents", status_code=201)
def post_incident(payload: IncidentIn, db: Session = Depends(get_db)):
    row = create_incident(
        db,
        description=payload.description,
        location_text=payload.location_text,
        latitude=payload.latitude,
        longitude=payload.longitude,
        channel=payload.channel,
        lang=payload.lang,
    )
    return to_public(row, db)


@router.post("/incidents/with-evidence", status_code=201)
async def post_incident_with_evidence(
    description: str = Form(...),
    location_text: str = Form(""),
    latitude: str = Form(""),
    longitude: str = Form(""),
    channel: str = Form("photo"),
    lang: str = Form("pt"),
    segment: bool = Form(True),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if len(description.strip()) < 8:
        raise HTTPException(status_code=400, detail="Descreva o que está a acontecer com um pouco mais de detalhe.")
    if channel not in {"text", "photo", "voice"}:
        raise HTTPException(status_code=400, detail="Canal inválido.")
    lat = _optional_float(latitude, "latitude")
    lng = _optional_float(longitude, "longitude")
    raw = await photo.read() if photo is not None else None
    if raw == b"":
        raw = None
    try:
        row = create_incident(
            db,
            description=description,
            location_text=location_text,
            latitude=lat,
            longitude=lng,
            channel=channel,
            lang=lang if lang in {"pt", "en"} else "pt",
            image=raw,
            run_segmentation=bool(segment and raw),
        )
    except ImageRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return to_public(row, db)


@router.patch("/incidents/{incident_id}/status")
def patch_status(incident_id: str, payload: StatusIn, db: Session = Depends(get_db)):
    row = set_status(db, incident_id, payload.status)
    if row is None:
        raise HTTPException(status_code=404, detail="Relato não encontrado.")
    return to_public(row, db)


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return stats(db)


@router.post("/transcribe")
async def post_transcribe(audio: UploadFile = File(...)):
    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Ficheiro de áudio vazio.")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="O áudio passa de 15 MB.")
    return transcribe(raw, audio.filename or "audio.wav")


@router.post("/demo/reset")
def post_reset(db: Session = Depends(get_db)):
    if not settings.enable_demo_reset:
        raise HTTPException(status_code=403, detail="A reposição de demonstração está desligada.")
    reset_demo(db)
    return {"reset": True}


def _optional_float(value: str, name: str) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{name} inválida.") from exc
    limit = 90 if name == "latitude" else 180
    if not -limit <= number <= limit:
        raise HTTPException(status_code=400, detail=f"{name} fora do intervalo.")
    return number
