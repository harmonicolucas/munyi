import heapq

from app.services.geo import haversine_km, load_json, point_segment_distance_km
from app.services.risk_service import lang_of


def network() -> dict:
    return load_json("demo_network.json")


def _node_map(data: dict) -> dict[str, dict]:
    return {node["id"]: node for node in data["nodes"]}


def _serious(incident) -> bool:
    return (
        getattr(incident, "status", "pending_validation") != "dismissed"
        and getattr(incident, "severity", "") in {"HIGH", "CRITICAL"}
        and getattr(incident, "latitude", None) is not None
        and getattr(incident, "longitude", None) is not None
        and getattr(incident, "incident_type", "flood") in {"flood", "landslide", "unconfirmed"}
    )


def _blocked(data: dict, incidents: list) -> tuple[set[str], set[str]]:
    radius = data["exclusion_radius_km"]
    nodes = _node_map(data)
    closed_nodes = set()
    closed_edges = set()
    serious = [item for item in incidents if _serious(item)]
    for node in data["nodes"]:
        for item in serious:
            if haversine_km(node["lat"], node["lng"], item.latitude, item.longitude) <= radius:
                closed_nodes.add(node["id"])
                break
    for edge in data["edges"]:
        start, end = nodes[edge["from"]], nodes[edge["to"]]
        if edge["from"] in closed_nodes or edge["to"] in closed_nodes:
            closed_edges.add(edge["id"])
            continue
        for item in serious:
            distance = point_segment_distance_km(
                item.latitude,
                item.longitude,
                start["lat"],
                start["lng"],
                end["lat"],
                end["lng"],
            )
            if distance <= radius:
                closed_edges.add(edge["id"])
                break
    return closed_nodes, closed_edges


def _nearest(data: dict, lat: float, lng: float) -> tuple[dict, float]:
    best = None
    best_distance = None
    for node in data["nodes"]:
        distance = haversine_km(lat, lng, node["lat"], node["lng"])
        if best_distance is None or distance < best_distance:
            best = node
            best_distance = distance
    return best, best_distance or 0


def _path(data: dict, start: str, goals: set[str], closed_edges: set[str]) -> list[str] | None:
    nodes = _node_map(data)
    graph: dict[str, list[tuple[str, float]]] = {node["id"]: [] for node in data["nodes"]}
    for edge in data["edges"]:
        if edge["id"] in closed_edges:
            continue
        a, b = nodes[edge["from"]], nodes[edge["to"]]
        weight = haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])
        graph[edge["from"]].append((edge["to"], weight))
        graph[edge["to"]].append((edge["from"], weight))
    queue = [(0.0, start, [start])]
    seen = set()
    while queue:
        cost, current, trail = heapq.heappop(queue)
        if current in seen:
            continue
        seen.add(current)
        if current in goals and current != start:
            return trail
        for nxt, weight in graph[current]:
            if nxt not in seen:
                heapq.heappush(queue, (cost + weight, nxt, trail + [nxt]))
    return None


def plan(latitude: float | None, longitude: float | None, incidents: list, lang: str | None = "pt") -> dict:
    language = lang_of(lang)
    data = network()
    disclaimer = data["disclaimer"][language]
    label = data["label"][language]
    closed_nodes, closed_edges = _blocked(data, incidents)
    blocked_payload = []
    nodes = _node_map(data)
    for edge in data["edges"]:
        if edge["id"] in closed_edges:
            start, end = nodes[edge["from"]], nodes[edge["to"]]
            blocked_payload.append(
                {
                    "id": edge["id"],
                    "name": edge["name"],
                    "positions": [[start["lat"], start["lng"]], [end["lat"], end["lng"]]],
                }
            )
    base = {
        "available": False,
        "reason": None,
        "disclaimer": disclaimer,
        "path": [],
        "distance_km": None,
        "shelter": None,
        "blocked_edges": blocked_payload,
        "network_label": label,
        "road_safety": "unknown",
    }
    if latitude is None or longitude is None:
        base["reason"] = data["no_origin_reason"][language]
        return base
    origin, distance = _nearest(data, latitude, longitude)
    if distance > data["max_start_distance_km"]:
        base["reason"] = data["outside_reason"][language]
        return base
    if origin["id"] in closed_nodes:
        base["reason"] = data["closed_start_reason"][language]
        return base
    open_shelters = []
    for shelter in data["shelters"]:
        if shelter["node"] in closed_nodes:
            continue
        node = nodes[shelter["node"]]
        open_shelters.append(shelter | {"lat": node["lat"], "lng": node["lng"]})
    if not open_shelters:
        base["reason"] = data["no_path_reason"][language]
        return base
    trail = _path(data, origin["id"], {item["node"] for item in open_shelters}, closed_edges)
    if not trail:
        base["reason"] = data["no_path_reason"][language]
        return base
    path = [
        {"id": node_id, "name": nodes[node_id]["name"], "lat": nodes[node_id]["lat"], "lng": nodes[node_id]["lng"]}
        for node_id in trail
    ]
    length = 0.0
    for left, right in zip(path, path[1:]):
        length += haversine_km(left["lat"], left["lng"], right["lat"], right["lng"])
    destination = next(item for item in open_shelters if item["node"] == trail[-1])
    base.update(
        {
            "available": True,
            "reason": None,
            "path": path,
            "distance_km": round(length, 2),
            "shelter": {
                "id": destination["id"],
                "name": destination["name"][language],
                "lat": destination["lat"],
                "lng": destination["lng"],
                "note": destination["note"][language],
            },
        }
    )
    return base
