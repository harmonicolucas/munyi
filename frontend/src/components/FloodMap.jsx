import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useCopy } from "../i18n";

function FlyTo({ position, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom || map.getZoom(), { duration: 0.6 });
  }, [position, zoom, map]);
  return null;
}

function ClickCatch({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

const COLORS = { LOW: "#15803d", MODERATE: "#a16207", HIGH: "#c2410c", CRITICAL: "#9f1239" };

export default function FloodMap({ incidents, route, shelters, focus, lang, layer, radarUrl, selected, onPick }) {
  const t = useCopy(lang);
  const focusPoint = focus?.latitude != null ? [focus.latitude, focus.longitude] : null;
  const selectedPoint = selected ? [selected.lat, selected.lng] : null;
  return (
    <div className="map-wrap">
      <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        {layer === "satellite" ? (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {layer === "radar" && radarUrl ? (
          <TileLayer attribution="Radar &copy; RainViewer" url={radarUrl} opacity={0.65} />
        ) : null}
        <ClickCatch onPick={onPick} />
        <FlyTo position={selectedPoint || focusPoint} zoom={selected?.zoom || (focusPoint ? 13 : undefined)} />
        {shelters?.map((shelter) => (
          <CircleMarker key={shelter.id} center={[shelter.lat, shelter.lng]} radius={8} pathOptions={{ color: "#14532d", fillColor: "#86efac", fillOpacity: 0.9 }}>
            <Popup>
              <strong>{shelter.name}</strong>
              <br />
              {shelter.note}
            </Popup>
          </CircleMarker>
        ))}
        {incidents
          .filter((item) => item.latitude != null && item.status !== "dismissed" && ["HIGH", "CRITICAL"].includes(item.severity))
          .map((item) => (
            <Circle
              key={`zone-${item.id}`}
              center={[item.latitude, item.longitude]}
              radius={350}
              pathOptions={{ color: "#9f1239", weight: 1, fillOpacity: 0.08 }}
            />
          ))}
        {route?.blocked_edges?.map((edge) => (
          <Polyline key={edge.id} positions={edge.positions} pathOptions={{ color: "#9f1239", weight: 5, dashArray: "2 8" }}>
            <Popup>{edge.name}</Popup>
          </Polyline>
        ))}
        {route?.path?.length ? (
          <Polyline positions={route.path.map((node) => [node.lat, node.lng])} pathOptions={{ color: "#1d4e89", weight: 5 }} />
        ) : null}
        {incidents
          .filter((item) => item.latitude != null)
          .map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.latitude, item.longitude]}
              radius={item.id === focus?.id ? 11 : 7}
              pathOptions={{ color: "#102027", fillColor: COLORS[item.severity] || "#1d4e89", fillOpacity: 0.95 }}
            >
              <Popup>
                <strong>
                  {item.id} · {t.severity[item.severity]}
                </strong>
                <br />
                {item.summary}
                <br />
                <a href={`#/alerta/${item.id}`}>{t.openAlert}</a>
              </Popup>
            </CircleMarker>
          ))}
        {selectedPoint ? (
          <CircleMarker center={selectedPoint} radius={9} pathOptions={{ color: "#1d4e89", fillColor: "#ffffff", fillOpacity: 1, weight: 3 }} />
        ) : null}
      </MapContainer>
    </div>
  );
}
