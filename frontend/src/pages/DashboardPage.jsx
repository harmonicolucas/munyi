import { Link } from "react-router-dom";
import { useStore } from "../store";
import { useCopy } from "../i18n";

const STATUS = {
  pending_validation: "statusPending",
  confirmed: "statusConfirmed",
  dismissed: "statusDismissed",
};

export default function DashboardPage() {
  const store = useStore();
  const t = useCopy(store.lang);
  const stats = store.stats;
  const maxArea = Math.max(1, ...(stats?.areas || []).map((item) => item.count));
  return (
    <div className="shell">
      <h1>{t.dashTitle}</h1>
      <p className="lead">{t.dashLead}</p>
      <section className="stats">
        <article className="card"><span>{t.total}</span><strong>{stats?.total ?? "—"}</strong></article>
        <article className="card"><span>{t.pending}</span><strong>{stats?.pending_confirmation ?? "—"}</strong></article>
        <article className="card"><span>{t.active}</span><strong>{stats?.active_alerts ?? "—"}</strong></article>
        <article className="card"><span>{t.images}</span><strong>{stats?.images ?? "—"}</strong></article>
        <article className="card"><span>{t.groups}</span><strong>{stats?.possible_duplicate_groups ?? "—"}</strong></article>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.areas}</h2>
        <div className="bars">
          {(stats?.areas || []).map((item) => (
            <div key={item.area}>
              <div className="row"><span>{item.area}</span><strong>{item.count}</strong></div>
              <div className="bar" style={{ width: `${(item.count / maxArea) * 100}%` }} />
            </div>
          ))}
        </div>
      </section>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (window.confirm(t.reset)) store.reset();
          }}
        >
          {t.reset}
        </button>
      </div>
      <h2>{t.history}</h2>
      {store.incidents.length === 0 ? <p>{t.empty}</p> : null}
      <div className="list">
        {store.incidents.map((incident) => (
          <article key={incident.id} className="card">
            <div className="row">
              <div>
                <p className="chips">
                  <span className={`severity ${incident.severity}`}>{t.severity[incident.severity]}</span>
                  <span className="chip">{incident.id}</span>
                  <span className="chip">{t[STATUS[incident.status]] || incident.status}</span>
                  {incident.cluster_id ? <span className="chip">{incident.cluster_id}</span> : null}
                </p>
                <h3>
                  <Link to={`/alerta/${incident.id}`}>{incident.summary}</Link>
                </h3>
                <p>{new Date(incident.created_at).toLocaleString(store.lang === "en" ? "en" : "pt-MZ")}</p>
              </div>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => store.mark(incident.id, "confirmed")}>
                  {t.seen}
                </button>
                <button type="button" className="secondary" onClick={() => store.mark(incident.id, "dismissed")}>
                  {t.dismiss}
                </button>
              </div>
            </div>
            <p className="note">{t.seenNote}</p>
            {incident.contradictions?.length ? (
              <ul>
                {incident.contradictions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
