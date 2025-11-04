import re
import unicodedata


def fold(text: str | None) -> str:
    value = (text or "").lower().replace("’", "'")
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    return value


def tokens(text: str | None, stopwords: set[str]) -> set[str]:
    folded = re.sub(r"[^a-z0-9\s]", " ", fold(text))
    return {part for part in folded.split() if len(part) > 2 and part not in stopwords}


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def contains_any(folded: str, phrases: list[str]) -> str | None:
    for phrase in phrases:
        if phrase and phrase in folded:
            return phrase
    return None


def clip(text: str | None, limit: int = 400) -> str:
    value = " ".join((text or "").split())
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"
