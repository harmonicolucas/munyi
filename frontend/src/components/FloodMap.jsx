import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useCopy } from "../i18n";

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15);
  }, [position, map]);
  return null;
}

const COLORS = { LOW: "#15803d", MODERATE: "#a16207", HIGH: "#c2410c", CRITICAL: "#9f1239" };

export default function FloodMap({ incidents, route, shelters, focus, lang }) {
  const t = useCopy(lang);
  const focusPoint = focus?.latitude != null ? [focus.latitude, focus.longitude] : null;
  return (
    <div className="map-wrap">
      <MapContainer center={[-25.96, 32.58]} zoom={13} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyTo position={focusPoint} />
        {shelters?.map((shelter) => (
          <CircleMarker key={shelter.id} center={[shelter.lat, shelter.lng]} radius={10} pathOptions={{ color: "#14532d", fillColor: "#86efac", fillOpacity: 0.9 }}>
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
          <Polyline
            positions={route.path.map((node) => [node.lat, node.lng])}
            pathOptions={{ color: "#083344", weight: 5 }}
          />
        ) : null}
        {incidents
          .filter((item) => item.latitude != null)
          .map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.latitude, item.longitude]}
              radius={item.id === focus?.id ? 12 : 8}
              pathOptions={{ color: "#102027", fillColor: COLORS[item.severity] || "#0f766e", fillOpacity: 0.95 }}
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
      </MapContainer>
    </div>
  );
}
