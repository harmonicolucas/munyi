import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import FloodMap from "../components/FloodMap";
import { useStore } from "../store";
import { useCopy } from "../i18n";

export default function MapPage() {
  const store = useStore();
  const t = useCopy(store.lang);
  const [params] = useSearchParams();
  const [context, setContext] = useState(null);
  const [route, setRoute] = useState(null);
  const [message, setMessage] = useState("");
  const focus = store.incidents.find((item) => item.id === params.get("foco")) || null;

  useEffect(() => {
    store.context().then(setContext).catch(() => setContext(null));
  }, [store.mode, store.lang]);

  async function draw(latitude, longitude) {
    const result = await store.route(latitude, longitude);
    setRoute(result);
    setMessage(result.available ? `${result.shelter?.name || ""} · ${result.distance_km} km` : result.reason);
  }

  function fromDevice() {
    if (!navigator.geolocation) {
      setMessage(t.locateFail);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => draw(position.coords.latitude, position.coords.longitude),
      () => setMessage(t.locateFail),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="shell">
      <h1>{t.mapTitle}</h1>
      <p className="lead">{t.mapLead}</p>
      <p className="note">{context?.disclaimer}</p>
      <div className="legend">
        <span><i className="swatch" style={{ background: "#c2410c" }} />{t.legendReports}</span>
        <span><i className="swatch" style={{ background: "#9f1239" }} />{t.legendBlocked}</span>
        <span><i className="swatch" style={{ background: "#083344" }} />{t.legendRoute}</span>
        <span><i className="swatch" style={{ background: "#86efac" }} />{t.legendShelter}</span>
      </div>
      <div className="actions">
        <button type="button" className="primary" onClick={() => draw(-25.9692, 32.5732)}>
          {t.routeHere}
        </button>
        <button type="button" className="secondary" onClick={fromDevice}>
          {t.routeMe}
        </button>
        <button type="button" className="secondary" onClick={() => { setRoute(null); setMessage(""); }}>
          {t.clearRoute}
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {route && !route.available ? <p className="error">{t.noRoute}. {route.reason}</p> : null}
      <FloodMap incidents={store.incidents} route={route} shelters={context?.shelters || []} focus={focus} lang={store.lang} />
      <p className="note">{context?.label}. {route?.disclaimer || context?.disclaimer}</p>
    </div>
  );
}
