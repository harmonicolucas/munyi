import json
import re

from app.config import settings
from app.services.meta_client import MetaAPIError, extract_text, post_json

DEVELOPER = """You are MUNYI, an AI-powered flood incident analysis assistant.
Analyze reports submitted by citizens.

Your tasks:
1. Identify the incident type.
2. Extract the reported location.
3. Estimate the severity.
4. Identify potentially affected people.
5. Detect missing or contradictory information.
6. Recommend safe precautionary actions.
7. Indicate whether human verification is required.

Never invent geographic coordinates.
Never claim that a road, bridge, or path is safe.
Never estimate water depth in metres from a photograph.
Return one JSON object only, with these keys:
incident_type (flood, landslide, or other),
severity (LOW, MODERATE, HIGH, or CRITICAL),
summary (string),
affected_area (string),
people_at_risk (string),
missing_information (array of strings),
requires_confirmation (boolean),
recommended_action (string).

Do not include latitude or longitude.
"""


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model did not return JSON")
    payload = json.loads(cleaned[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("model JSON was not an object")
    payload.pop("latitude", None)
    payload.pop("longitude", None)
    payload.pop("lat", None)
    payload.pop("lng", None)
    return payload


def _user_text(description: str, location_text: str | None, has_coordinates: bool, has_image: bool) -> str:
    place = location_text.strip() if location_text else "not provided"
    lines = [
        f"Citizen report: {description}",
        f"Place named by the citizen: {place}",
        f"Citizen attached coordinates: {'yes' if has_coordinates else 'no'}.",
        "Do not repeat or invent coordinates.",
    ]
    if has_image:
        lines.append(
            "A photograph is attached. Describe only visible evidence. Do not estimate depth and do not say a road is passable."
        )
    return "\n".join(lines)


def interpret(
    description: str,
    location_text: str | None,
    has_coordinates: bool,
    image_data_url: str | None = None,
) -> dict:
    if not settings.meta_api_key:
        raise MetaAPIError(0, "MODEL_API_KEY is not configured")
    text = _user_text(description, location_text, has_coordinates, bool(image_data_url))
    content = [{"type": "input_text", "text": text}]
    if image_data_url:
        content.append({"type": "input_image", "image_url": image_data_url})
    body = {
        "model": settings.muse_model,
        "instructions": DEVELOPER,
        "input": [{"type": "message", "role": "user", "content": content}],
        "max_output_tokens": 1200,
        "reasoning": {"effort": "low"},
    }
    try:
        payload = post_json("/responses", body)
    except MetaAPIError as exc:
        if exc.status != 400:
            raise
        chat_content: list | str
        if image_data_url:
            chat_content = [
                {"type": "text", "text": text},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ]
        else:
            chat_content = text
        payload = post_json(
            "/chat/completions",
            {
                "model": settings.muse_model,
                "messages": [
                    {"role": "developer", "content": DEVELOPER},
                    {"role": "user", "content": chat_content},
                ],
                "reasoning_effort": "low",
                "max_completion_tokens": 1200,
            },
        )
    parsed = _parse_json(extract_text(payload))
    parsed["_model"] = settings.muse_model
    return parsed
