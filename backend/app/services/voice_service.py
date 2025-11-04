import json

import requests

from app.config import settings
from app.services.meta_client import redact


def transcribe(audio: bytes, filename: str) -> dict:
    if not settings.meta_api_key:
        return {"transcript": "", "source": None, "error": "MODEL_API_KEY is not configured"}
    if not filename.lower().endswith(".wav") and not audio.startswith(b"RIFF"):
        return {
            "transcript": "",
            "source": settings.asr_model,
            "error": "Muse Voice Transcribe accepts a mono 16-bit WAV file at 16 kHz or 24 kHz. Read the browser transcript, or upload a WAV.",
        }
    request = {
        "mode": "PUSH_TO_TALK",
        "model": settings.asr_model,
        "audioEncoding": "WAV",
        "languageBias": ["Portuguese"],
        "keywords": ["inundação", "MUNYI", "Maputo", "enchente"],
    }
    try:
        response = requests.post(
            f"{settings.meta_api_url}/asr/transcribe",
            headers={"Authorization": f"Bearer {settings.meta_api_key}"},
            files={
                "request": (None, json.dumps(request), "application/json"),
                "audio": (filename or "audio.wav", audio, "audio/wav"),
            },
            timeout=90,
        )
    except requests.RequestException as exc:
        return {"transcript": "", "source": settings.asr_model, "error": redact(str(exc))}
    if response.status_code >= 400:
        return {"transcript": "", "source": settings.asr_model, "error": redact(response.text)}
    payload = response.json()
    return {
        "transcript": (payload.get("transcript") or "").strip(),
        "source": settings.asr_model,
        "error": None,
    }
