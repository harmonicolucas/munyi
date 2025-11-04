import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store";
import { useCopy } from "../i18n";
import { evidenceSrc } from "../services/api";

const TYPE_KEY = {
  flood: "typeFlood",
  landslide: "typeSlide",
  unconfirmed: "typeUnknown",
  other: "typeOther",
};

export default function AlertCard({ incident, compact = false }) {
  const store = useStore();
  const t = useCopy(store.lang);
  const [speaking, setSpeaking] = useState(false);
  const [speechMissing, setSpeechMissing] = useState(false);
  if (!incident) return null;
  const label = t.severity[incident.severity] || incident.severity;
  const source =
    incident.source === "demo_seed"
      ? t.sourceSeed
      : incident.source === "deterministic_rules"
        ? t.sourceRules
        : incident.source;

  function listen() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setSpeechMissing(true);
      return;
    }
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(incident.simple_alert);
    utter.lang = incident.lang === "en" ? "en-US" : "pt-MZ";
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utter);
    setSpeaking(true);
  }

  return (
    <article className="card alert-sheet" aria-live="polite">
      <p className="chips">
        <span className={`severity ${incident.severity}`}>
          {label}
        </span>
        <span className="chip">{t[TYPE_KEY[incident.incident_type]] || incident.incident_type}</span>
        {incident.source === "demo_seed" || incident.source === "deterministic_rules" ? <span className="chip">{source}</span> : null}
      </p>
      <h2>{incident.summary}</h2>
      <p>{incident.simple_alert}</p>
      <p>
        <strong>{t.road}</strong>
      </p>
      {incident.requires_confirmation ? <p className="chip">{t.confirm}</p> : null}
      <h3>{t.actions}</h3>
      <ul>
        {incident.recommended_actions?.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <button type="button" className="secondary" onClick={listen}>
        {speaking ? t.stopListen : t.listen}
      </button>
      {speechMissing ? <p>{t.listenMissing}</p> : null}
      {!compact ? (
        <>
          <h3>{t.people}</h3>
          <p>{incident.people_at_risk}</p>
          {incident.analysis?.missing_information?.length ? (
            <>
              <h3>{t.missing}</h3>
              <ul>
                {incident.analysis.missing_information.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {incident.siblings?.length ? (
            <>
              <h3>{t.duplicates}</h3>
              <ul>
                {incident.siblings.map((item) => (
                  <li key={item.id}>
                    <Link to={`/alerta/${item.id}`}>
                      {item.id}: {item.summary}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {incident.contradictions?.length ? (
            <>
              <h3>{t.contradictions}</h3>
              <ul>
                {incident.contradictions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          {incident.analysis?.notes?.length ? (
            <ul>
              {incident.analysis.notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {incident.evidence_url ? (
            <figure className="photo-preview">
              <img src={evidenceSrc(incident.evidence_url)} alt="" />
              {incident.segmentation?.note ? <figcaption>{incident.segmentation.note}</figcaption> : null}
              <Segmentation image={evidenceSrc(incident.evidence_url)} boxes={incident.segmentation?.boxes || []} />
            </figure>
          ) : null}
          <p className="actions">
            <Link className="button" to={`/mapa?foco=${incident.id}`}>
              {t.openMap}
            </Link>
          </p>
        </>
      ) : null}
    </article>
  );
}

function Segmentation({ image, boxes }) {
  if (!boxes.length) return null;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="SAM" style={{ width: "100%", background: `url(${image}) center/cover` }}>
      {boxes.map((box, index) => {
        const [x1, y1, x2, y2] = box.map((value) => value * 100);
        return <rect key={`${x1}-${y1}-${index}`} x={x1} y={y1} width={Math.max(0, x2 - x1)} height={Math.max(0, y2 - y1)} fill="rgba(14,116,144,0.35)" stroke="#083344" strokeWidth="0.6" />;
      })}
    </svg>
  );
}
