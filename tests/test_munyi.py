from datetime import datetime, timedelta
from types import SimpleNamespace

from app.services.cluster_service import contradictions, related
from app.services.muse_service import _parse_json
from app.services.risk_service import assess, combine
from app.services.route_service import plan

SCHOOL = (
    "A água está a subir rapidamente na estrada próxima da escola. "
    "Existem vários carros parados e pessoas sem conseguir atravessar."
)


def report(**kwargs):
    base = dict(
        description="",
        location_text="",
        affected_area="",
        latitude=None,
        longitude=None,
        severity="MODERATE",
        created_at=datetime(2026, 11, 4, 12, 0, 0),
        status="pending_validation",
        incident_type="flood",
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_scenario_text_report_is_classified_as_high_flood():
    result = assess(SCHOOL, "Estrada próxima da escola", -25.9605, 32.59, lang="pt")
    assert result["incident_type"] == "flood"
    assert result["severity"] == "HIGH"
    assert result["source"] == "deterministic_rules"
    assert result["road_safety"] == "unknown"
    assert "Não atravesse a água." in result["recommended_actions"]
    assert "Nenhuma estrada foi classificada como segura." in result["simple_alert"]
    assert "latitude" not in result
    assert result["requires_confirmation"] is True


def test_scenario_missing_location_requests_confirmation():
    result = assess("Vi água a subir mas não sei dizer a rua.")
    assert result["requires_confirmation"] is True
    assert result["affected_area"] == "Local não indicado"
    assert "Falta a localização." in result["missing_information"]
    assert result["severity"] == "HIGH"


def test_scenario_same_place_reports_can_be_duplicates_without_being_deleted():
    now = datetime(2026, 11, 4, 12, 0, 0)
    first = report(
        description=SCHOOL,
        location_text="Estrada próxima da escola",
        affected_area="Estrada próxima da escola",
        latitude=-25.9605,
        longitude=32.59,
        severity="HIGH",
        created_at=now,
    )
    second = report(
        description="Água acumulada na Rua da Resistência, junto à escola. Há carros parados.",
        location_text="Rua da Resistência",
        affected_area="Rua da Resistência",
        latitude=-25.9612,
        longitude=32.5906,
        severity="HIGH",
        created_at=now + timedelta(minutes=20),
    )
    third = report(
        description="Fotografei a Rua da Resistência. Há água na mesma zona e há carros parados.",
        location_text="Rua da Resistência",
        affected_area="Rua da Resistência",
        latitude=-25.9608,
        longitude=32.5894,
        severity="HIGH",
        created_at=now + timedelta(minutes=40),
    )
    assert related(first, second)
    assert related(second, third)
    assert first.description != second.description


def test_scenario_photo_does_not_assert_depth_or_a_safe_road():
    baseline = assess("Fotografia de uma rua com água.", "Rua da Resistência", -25.96, 32.59, has_image=True)
    model = {
        "_model": "muse-spark-1.3",
        "incident_type": "flood",
        "severity": "HIGH",
        "summary": "The water is 2 meters deep and the road is safe to cross.",
        "latitude": -25.1,
        "longitude": 32.2,
        "recommended_action": "It is safe to drive through.",
    }
    result = combine(baseline, model, has_image=True, lang="en")
    assert result["road_safety"] == "unknown"
    assert "latitude" not in result
    assert "meters deep" not in result["summary"].lower()
    assert "safe to cross" not in result["summary"].lower()
    assert all("safe to drive" not in action.lower() for action in result["recommended_actions"])
    assert result["notes"]
    assert "No road was classified as safe." in result["simple_alert"]


def test_safety_floor_stops_the_model_from_softening_explicit_danger():
    baseline = assess(SCHOOL, "Estrada próxima da escola", -25.96, 32.59)
    model = {"_model": "muse-spark-1.3", "incident_type": "flood", "severity": "LOW", "summary": "Minor wet road."}
    result = combine(baseline, model, has_image=False, lang="pt")
    assert result["severity"] == "HIGH"
    assert result["severity_policy"] == "safety_floor"


def test_unrelated_text_is_not_accepted_as_a_critical_flood():
    baseline = assess("O pão está no forno e o chá está quente.")
    model = {"_model": "muse-spark-1.3", "incident_type": "flood", "severity": "CRITICAL", "summary": "City-wide disaster."}
    result = combine(baseline, model, has_image=False, lang="pt")
    assert result["incident_type"] == "other"
    assert result["severity"] == "MODERATE"
    assert result["requires_confirmation"] is True
    assert "Alerta de inundação" not in result["simple_alert"]


def test_parser_drops_coordinates_from_model_json():
    parsed = _parse_json('{"severity":"HIGH","latitude":-25.12345,"longitude":32.5,"summary":"Água na escola"}')
    assert "latitude" not in parsed
    assert "longitude" not in parsed
    assert parsed["summary"] == "Água na escola"


def test_reports_without_a_time_are_not_treated_as_the_same_moment():
    undated = report(description=SCHOOL, latitude=-25.96, longitude=32.59, created_at=None)
    dated = report(description=SCHOOL, latitude=-25.9601, longitude=32.5901)
    assert related(undated, dated) is False


def test_mixed_timezones_are_not_grouped():
    from datetime import timezone

    local = report(description=SCHOOL, latitude=-25.96, longitude=32.59, created_at=datetime(2026, 11, 4, 12, 0, 0))
    aware = report(
        description=SCHOOL,
        latitude=-25.9601,
        longitude=32.5901,
        created_at=datetime(2026, 11, 4, 12, 0, 0, tzinfo=timezone.utc),
    )
    assert related(local, aware) is False


def test_old_reports_are_not_grouped():
    now = datetime(2026, 11, 4, 12, 0, 0)
    left = report(description=SCHOOL, latitude=-25.96, longitude=32.59, created_at=now)
    right = report(description=SCHOOL, latitude=-25.9601, longitude=32.5901, created_at=now - timedelta(hours=30))
    assert related(left, right) is False


def test_contradiction_between_rising_and_falling_water():
    group = [
        report(description=SCHOOL, severity="HIGH"),
        report(
            description="Na Rua da Resistência, junto à escola, a água já passou e está a baixar.",
            severity="MODERATE",
        ),
    ]
    notes = contradictions(group, "pt")
    assert any("subir" in note and "baixar" in note for note in notes)


def test_demo_route_avoids_flooded_test_segment_and_is_not_a_real_evacuation():
    incidents = [
        report(
            description=SCHOOL,
            latitude=-25.9605,
            longitude=32.59,
            severity="HIGH",
            incident_type="flood",
        )
    ]
    result = plan(-25.9692, 32.5732, incidents, "pt")
    assert result["available"] is True
    assert result["road_safety"] == "unknown"
    assert "não é uma rota real" in result["disclaimer"].lower()
    assert all(node["id"] != "escola" for node in result["path"])
    assert "baixa-escola" in {edge["id"] for edge in result["blocked_edges"]}
    assert result["shelter"]["id"] == "abrigo-alto-mae"


def test_route_is_refused_inside_a_reported_flood_and_outside_the_test_network():
    flooded = [report(latitude=-25.9605, longitude=32.59, severity="HIGH")]
    blocked = plan(-25.9605, 32.59, flooded, "pt")
    assert blocked["available"] is False
    assert "Afaste-se" in blocked["reason"]
    assert "segura" in blocked["disclaimer"]

    shelters_closed = [
        report(latitude=-25.962, longitude=32.56, severity="CRITICAL"),
        report(latitude=-25.955, longitude=32.605, severity="HIGH"),
    ]
    nowhere = plan(-25.9692, 32.5732, shelters_closed, "pt")
    assert nowhere["available"] is False
    assert "não significa que outra estrada seja segura" in nowhere["reason"]

    outside = plan(38.72, -9.14, [], "pt")
    assert outside["available"] is False
    assert "fora da rede" in outside["reason"]


def test_dismissed_report_does_not_close_a_test_road():
    dismissed = [report(latitude=-25.9605, longitude=32.59, severity="HIGH", status="dismissed")]
    result = plan(-25.9605, 32.59, dismissed, "pt")
    assert result["available"] is True
    assert result["path"][0]["id"] == "escola"
