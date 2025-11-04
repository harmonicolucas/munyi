import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FloodMap from "../components/FloodMap";
import { PLACES, fetchOutlook, outlookCopy, rainRadarTemplate, reasonLines, riskWord, searchPlaces } from "../lib/forecast";
import { useCopy } from "../i18n";
import { useStore } from "../store";

export default function MapPage() {
  const store = useStore();
  const t = useCopy(store.lang);
  const f = outlookCopy(store.lang);
  const [params] = useSearchParams();
  const [context, setContext] = useState(null);
  const [route, setRoute] = useState(null);
  const [message, setMessage] = useState("");
  const [layer, setLayer] = useState("streets");
  const [radarUrl, setRadarUrl] = useState("");
  const [method, setMethod] = useState("heuristic");
  const [selected, setSelected] = useState(null);
  const [outlook, setOutlook] = useState(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [searchNote, setSearchNote] = useState("");
  const focus = store.incidents.find((item) => item.id === params.get("foco")) || null;
  const active = outlook ? outlook[method === "linear" ? "linear" : "heuristic"] : null;
  const locale = store.lang === "en" ? "en-GB" : "pt-MZ";

  useEffect(() => {
    store.context().then(setContext).catch(() => setContext(null));
  }, [store.mode, store.lang]);

  async function choose(lat, lng, name, zoom) {
    setSelected({ lat, lng, name: name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`, zoom });
    setOutlook(null);
    setStatus("loading");
    try {
      setOutlook(await fetchOutlook(lat, lng));
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  }

  async function onSearch(event) {
    event.preventDefault();
    const name = query.trim();
    if (name.length < 2) return;
    setSearchNote("loading");
    setHits([]);
    try {
      const found = await searchPlaces(name, store.lang);
      setHits(found);
      setSearchNote(found.length ? "" : "empty");
    } catch {
      setSearchNote("failed");
    }
  }

  async function showRadar() {
    setLayer("radar");
    if (radarUrl) return;
    try {
      const frame = await rainRadarTemplate();
      setRadarUrl(frame.url);
    } catch {
      setLayer("streets");
    }
  }

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
    <div className="desk">
      <section className="desk-panel" aria-labelledby="outlook-title">
        <h1 id="outlook-title">{f.title}</h1>
        <p className="lead">{f.lead}</p>
        <form className="place-search" onSubmit={onSearch}>
          <label htmlFor="place-search">{f.search}</label>
          <div className="search-row">
            <input id="place-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" className="secondary">{f.searchButton}</button>
          </div>
        </form>
        {searchNote === "loading" ? <p role="status">{f.loading}</p> : null}
        {searchNote === "empty" ? <p role="status">{f.searchEmpty}</p> : null}
        {searchNote === "failed" ? <p className="error" role="alert">{f.searchFailed}</p> : null}
        {hits.length ? (
          <ul className="search-results">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" onClick={() => { setHits([]); choose(hit.lat, hit.lng, hit.name, 8); }}>
                  {hit.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="examples">{f.examples}</p>
        <div className="places" role="group" aria-label={f.examples}>
          {PLACES.map((place) => (
            <button
              key={place.id}
              type="button"
              className={selected?.name === place.name ? "chip on" : "chip"}
              onClick={() => choose(place.lat, place.lng, place.name, 8)}
            >
              {place.name}
            </button>
          ))}
        </div>
        {selected ? (
          <p className="place-line">
            <strong>{selected.name}</strong>
            <span>
              {selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}
            </span>
          </p>
        ) : null}
        {status === "loading" ? <p role="status">{f.loading}</p> : null}
        {status === "failed" ? <p className="error" role="alert">{f.failed}</p> : null}
        {outlook && active ? (
          <>
            <div className="method" role="group" aria-label={f.why}>
              <button type="button" aria-pressed={method === "heuristic"} onClick={() => setMethod("heuristic")}>
                {f.methodRain}
              </button>
              <button type="button" aria-pressed={method === "linear"} onClick={() => setMethod("linear")}>
                {f.methodLinear}
              </button>
            </div>
            <p className={`risk risk-${active.label.toLowerCase()}`}>
              <span>{riskWord(active.label, store.lang)}</span>
              <strong>{active.percent}%</strong>
            </p>
            <h2>{f.forecast}</h2>
            <table className="days">
              <thead>
                <tr>
                  <th>{f.place}</th>
                  <th>{f.rain}</th>
                  <th>{f.chance}</th>
                </tr>
              </thead>
              <tbody>
                {outlook.future.map((row) => (
                  <tr key={row.time}>
                    <td>{new Date(`${row.time}T12:00:00Z`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                    <td>{row.rain.toFixed(1)} mm</td>
                    <td>{row.probability == null ? "—" : `${row.probability}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2>{f.why}</h2>
            <ul className="reasons">
              {reasonLines(outlook, store.lang).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h2>{f.tipsTitle}</h2>
            <ul>
              {f.tips[active.label].map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="layers" role="group" aria-label={f.streets}>
          <button type="button" aria-pressed={layer === "streets"} onClick={() => setLayer("streets")}>{f.streets}</button>
          <button type="button" aria-pressed={layer === "satellite"} onClick={() => setLayer("satellite")}>{f.satellite}</button>
          <button type="button" aria-pressed={layer === "radar"} onClick={showRadar}>{f.radar}</button>
        </div>
        <h2>{f.reports}</h2>
        {store.incidents.length ? (
          <ul className="report-list">
            {store.incidents.slice(0, 6).map((item) => (
              <li key={item.id}>
                <Link to={`/alerta/${item.id}`}>{item.summary}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>{f.noReports}</p>
        )}
        <div className="actions">
          <Link className="primary link-button" to="/relato">{f.report}</Link>
          <button type="button" className="secondary" onClick={() => draw(-25.9692, 32.5732)}>{f.route}</button>
          <button type="button" className="secondary" onClick={fromDevice}>{t.routeMe}</button>
          {route ? (
            <button type="button" className="secondary" onClick={() => { setRoute(null); setMessage(""); }}>{t.clearRoute}</button>
          ) : null}
        </div>
        {message ? <p role="status">{message}</p> : null}
        {route && !route.available ? <p className="error">{t.noRoute}. {route.reason}</p> : null}
        <p className="note">{route?.disclaimer || context?.disclaimer}</p>
        <p className="note">{f.source}</p>
      </section>
      <FloodMap
        incidents={store.incidents}
        route={route}
        shelters={context?.shelters || []}
        focus={focus}
        lang={store.lang}
        layer={layer}
        radarUrl={radarUrl}
        selected={selected}
        onPick={(lat, lng) => choose(lat, lng, "", undefined)}
      />
    </div>
  );
}
