import base64
import re

from app.config import settings
from app.services.meta_client import MetaAPIError, extract_text, post_json

NOTE = {
    "pt": "A segmentação mostra regiões visuais. Não indica profundidade nem se uma estrada é segura.",
    "en": "Segmentation shows visual regions. It does not show depth and it does not mean a road is safe.",
}


def _boxes(payload, width: int, height: int) -> list[list[float]]:
    found: list[list[float]] = []

    def walk(node) -> None:
        if isinstance(node, dict):
            for key in ("bbox", "box", "xyxy"):
                value = node.get(key)
                if isinstance(value, list) and len(value) == 4 and all(isinstance(n, (int, float)) for n in value):
                    found.append([float(n) for n in value])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    text = payload if isinstance(payload, str) else ""
    if isinstance(payload, dict):
        text = extract_text(payload)
    for match in re.finditer(r"\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]", text or ""):
        found.append([float(match.group(i)) for i in range(1, 5)])
    usable = []
    for box in found:
        x1, y1, x2, y2 = box
        normalized = max(box) <= 1.5
        if normalized:
            usable.append(box)
            continue
        if 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height:
            usable.append([x1 / width, y1 / height, x2 / width, y2 / height])
    unique: list[list[float]] = []
    for box in usable:
        if box not in unique:
            unique.append(box)
    return unique[:12]


def segment_image(image_bytes: bytes, content_type: str, width: int, height: int, prompt: str, lang: str = "pt") -> dict:
    language = "en" if lang == "en" else "pt"
    note = NOTE[language]
    if not settings.meta_api_key:
        return {
            "status": "unavailable",
            "model": settings.sam_model,
            "prompt": prompt,
            "boxes": [],
            "parsed": False,
            "note": note,
            "reason": "MODEL_API_KEY is not configured",
        }
    data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    body = {
        "model": settings.sam_model,
        "input": [
            {
                "type": "message",
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": data_url},
                ],
            }
        ],
    }
    try:
        payload = post_json("/responses", body, timeout=120)
    except MetaAPIError as exc:
        return {
            "status": "error",
            "model": settings.sam_model,
            "prompt": prompt,
            "boxes": [],
            "parsed": False,
            "note": note,
            "reason": str(exc),
        }
    text = extract_text(payload)
    boxes = _boxes(payload, width, height)
    return {
        "status": "completed",
        "model": settings.sam_model,
        "prompt": prompt,
        "boxes": boxes,
        "parsed": bool(boxes),
        "note": note,
        "raw_preview": text[:1500],
        "reason": None
        if boxes
        else (
            "A resposta chegou, mas esta versão não converteu a região marcada em geometria desenhável."
            if language == "pt"
            else "A reply arrived, but this version could not turn the marked region into drawable geometry."
        ),
    }
