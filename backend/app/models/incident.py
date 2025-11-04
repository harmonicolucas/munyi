from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    incident_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    affected_area: Mapped[str] = mapped_column(String(200), nullable=False)
    location_text: Mapped[str] = mapped_column(String(200), default="")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending_validation", index=True)
    channel: Mapped[str] = mapped_column(String(16), default="text")
    evidence_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="deterministic_rules")
    analysis: Mapped[dict] = mapped_column(JSON, nullable=False)
    segmentation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    requires_confirmation: Mapped[bool] = mapped_column(Boolean, default=True)
    people_at_risk: Mapped[str] = mapped_column(Text, default="")
    recommended_actions: Mapped[list] = mapped_column(JSON, nullable=False)
    simple_alert: Mapped[str] = mapped_column(Text, nullable=False)
    lang: Mapped[str] = mapped_column(String(8), default="pt")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
