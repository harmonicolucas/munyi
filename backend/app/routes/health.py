from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "munyi",
        "muse_configured": bool(settings.meta_api_key),
        "models": {
            "report_analysis": settings.muse_model,
            "segmentation": settings.sam_model,
            "transcription": settings.asr_model,
        },
        "safety": "This API never classifies a road as safe.",
    }
