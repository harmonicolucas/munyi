import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    meta_api_key: str = os.getenv("MODEL_API_KEY") or os.getenv("META_API_KEY") or ""
    meta_api_url: str = os.getenv("META_API_URL", "https://api.meta.ai/v1").rstrip("/")
    muse_model: str = os.getenv("MUSE_MODEL", "muse-spark-1.3")
    sam_model: str = os.getenv("SAM_MODEL", "sam-3.1")
    asr_model: str = os.getenv("ASR_MODEL", "muse-voice-transcribe-1.0")
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BACKEND_ROOT / 'munyi.db').as_posix()}",
    )
    enable_demo_reset: bool = _flag("ENABLE_DEMO_RESET", "true")
    upload_dir: Path = BACKEND_ROOT / "uploads"


settings = Settings()
