import { Link, useParams } from "react-router-dom";
import AlertCard from "../components/AlertCard";
import { useStore } from "../store";
import { useCopy } from "../i18n";

export default function AlertPage() {
  const { id } = useParams();
  const store = useStore();
  const t = useCopy(store.lang);
  const incident = store.incidents.find((item) => item.id === id);
  if (!incident) {
    return (
      <div className="shell">
        <p>{t.empty}</p>
        <Link to="/">{t.navReport}</Link>
      </div>
    );
  }
  return (
    <div className="shell" style={{ maxWidth: 760 }}>
      <p className="note">{incident.id}</p>
      <AlertCard incident={incident} />
    </div>
  );
}
