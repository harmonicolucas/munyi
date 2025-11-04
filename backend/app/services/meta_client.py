import requests

from app.config import settings


class MetaAPIError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = redact(detail)
        super().__init__(f"Meta Model API {status}: {self.detail}")


def redact(text: str) -> str:
    value = text or ""
    if settings.meta_api_key:
        value = value.replace(settings.meta_api_key, "[redacted]")
    return value[:800]


def post_json(path: str, body: dict, timeout: int = 90) -> dict:
    response = requests.post(
        f"{settings.meta_api_url}{path}",
        headers={
            "Authorization": f"Bearer {settings.meta_api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=timeout,
    )
    if response.status_code >= 400:
        raise MetaAPIError(response.status_code, response.text)
    return response.json()


def extract_text(payload: dict) -> str:
    chunks: list[str] = []
    if isinstance(payload.get("output_text"), str):
        chunks.append(payload["output_text"])
    for item in payload.get("output") or []:
        if isinstance(item, str):
            chunks.append(item)
        elif isinstance(item, dict):
            if isinstance(item.get("text"), str):
                chunks.append(item["text"])
            for part in item.get("content") or []:
                if isinstance(part, str):
                    chunks.append(part)
                elif isinstance(part, dict) and isinstance(part.get("text"), str):
                    chunks.append(part["text"])
    for choice in payload.get("choices") or []:
        message = choice.get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            chunks.append(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    chunks.append(part["text"])
    return "\n".join(chunk for chunk in chunks if chunk).strip()
