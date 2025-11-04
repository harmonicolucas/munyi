from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.incident import Incident
from app.schemas import RouteIn
from app.services.geo import load_json
from app.services.route_service import plan

router = APIRouter()


@router.get("/map/context")
def map_context(lang: str = "pt"):
    data = load_json("demo_network.json")
    language = "en" if lang == "en" else "pt"
    return {
        "label": data["label"][language],
        "disclaimer": data["disclaimer"][language],
        "nodes": data["nodes"],
        "edges": data["edges"],
        "shelters": [
            {
                "id": item["id"],
                "node": item["node"],
                "name": item["name"][language],
                "note": item["note"][language],
                "lat": next(node["lat"] for node in data["nodes"] if node["id"] == item["node"]),
                "lng": next(node["lng"] for node in data["nodes"] if node["id"] == item["node"]),
            }
            for item in data["shelters"]
        ],
        "exclusion_radius_km": data["exclusion_radius_km"],
    }


@router.post("/routes")
def create_route(payload: RouteIn, db: Session = Depends(get_db)):
    incidents = db.query(Incident).all()
    return plan(payload.latitude, payload.longitude, incidents, payload.lang)
