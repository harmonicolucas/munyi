from typing import Literal

from pydantic import BaseModel, Field, field_validator


class IncidentIn(BaseModel):
    description: str = Field(min_length=8, max_length=4000)
    location_text: str | None = Field(default=None, max_length=200)
    latitude: float | None = None
    longitude: float | None = None
    channel: Literal["text", "photo", "voice"] = "text"
    lang: Literal["pt", "en"] = "pt"

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, value: float | None) -> float | None:
        if value is not None and not -90 <= value <= 90:
            raise ValueError("latitude fora do intervalo")
        return value

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, value: float | None) -> float | None:
        if value is not None and not -180 <= value <= 180:
            raise ValueError("longitude fora do intervalo")
        return value


class StatusIn(BaseModel):
    status: Literal["pending_validation", "confirmed", "dismissed"]


class RouteIn(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    lang: Literal["pt", "en"] = "pt"

    @field_validator("latitude")
    @classmethod
    def check_lat(cls, value: float | None) -> float | None:
        if value is not None and not -90 <= value <= 90:
            raise ValueError("latitude fora do intervalo")
        return value

    @field_validator("longitude")
    @classmethod
    def check_lng(cls, value: float | None) -> float | None:
        if value is not None and not -180 <= value <= 180:
            raise ValueError("longitude fora do intervalo")
        return value
