import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createLocal, localStats, mapContext, planRoute, setLocalStatus } from "./lib/engine";
import * as api from "./services/api";

const KEY = "munyi.incidents.v3";
const StoreContext = createContext(null);

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    /* start with an empty report list */
  }
  return [];
}

function apiLang(lang) {
  return lang === "en" ? "en" : "pt";
}

export function StoreProvider({ children }) {
  const [lang, setLangState] = useState(() => (localStorage.getItem("munyi.locale") === "pt-MZ" ? "pt-MZ" : "en"));
  const [contrast, setContrast] = useState(() => localStorage.getItem("munyi.contrast") === "1");
  const [largeText, setLargeText] = useState(() => localStorage.getItem("munyi.large") === "1");
  const [mode, setMode] = useState("checking");
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState(loadLocal);
  const [stats, setStats] = useState(() => localStats(loadLocal()));
  const incidentsRef = useRef(null);
  if (incidentsRef.current === null) incidentsRef.current = incidents;

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "pt-MZ";
    document.body.classList.toggle("contrast", contrast);
    document.body.classList.toggle("large-text", largeText);
  }, [lang, contrast, largeText]);

  async function refresh(nextMode = mode) {
      if (nextMode === "api") {
      const [rows, counts] = await Promise.all([api.listIncidents(), api.getStats()]);
      incidentsRef.current = rows;
      setIncidents(rows);
      setStats(counts);
      return rows;
    }
    const rows = loadLocal();
    incidentsRef.current = rows;
    setIncidents(rows);
    setStats(localStats(rows));
    return rows;
  }

  useEffect(() => {
    let cancelled = false;
    api.getHealth().then(async (probe) => {
      if (cancelled) return;
      if (probe) {
        setHealth(probe);
        setMode("api");
        try {
          await refresh("api");
        } catch {
          setMode("local");
          setHealth(null);
          await refresh("local");
        }
      } else {
        setMode("local");
        await refresh("local");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(rows) {
    incidentsRef.current = rows;
    localStorage.setItem(KEY, JSON.stringify(rows));
    setIncidents(rows);
    setStats(localStats(rows));
  }

  const apiValue = useMemo(
    () => ({
      lang,
      setLang(next) {
        const value = next === "pt-MZ" ? "pt-MZ" : "en";
        localStorage.setItem("munyi.locale", value);
        setLangState(value);
      },
      contrast,
      toggleContrast() {
        setContrast((value) => {
          localStorage.setItem("munyi.contrast", value ? "0" : "1");
          return !value;
        });
      },
      largeText,
      toggleLarge() {
        setLargeText((value) => {
          localStorage.setItem("munyi.large", value ? "0" : "1");
          return !value;
        });
      },
      mode,
      health,
      incidents,
      stats,
      async submit(input, file) {
        if (mode === "api") {
          const created = file
            ? await api.createIncidentWithPhoto(
                {
                  description: input.description,
                  location_text: input.locationText,
                  latitude: input.latitude,
                  longitude: input.longitude,
                  channel: input.channel,
                  lang: apiLang(input.lang),
                },
                file,
              )
            : await api.createIncident({
                description: input.description,
                location_text: input.locationText || null,
                latitude: input.latitude,
                longitude: input.longitude,
                channel: input.channel || "text",
                lang: apiLang(input.lang),
              });
          await refresh("api");
          return created;
        }
        const { incidents: rows, created } = createLocal(incidentsRef.current, input);
        persist(rows);
        return created;
      },
      async mark(id, status) {
        if (mode === "api") {
          const updated = await api.updateStatus(id, status);
          await refresh("api");
          return updated;
        }
        const rows = setLocalStatus(incidentsRef.current, id, status);
        persist(rows);
        return rows.find((item) => item.id === id);
      },
      async reset() {
        if (mode === "api") {
          await api.resetDemo();
          await refresh("api");
          return;
        }
        persist([]);
      },
      async route(latitude, longitude) {
        if (mode === "api") return api.requestRoute(latitude, longitude, apiLang(lang));
        return planRoute(latitude, longitude, incidentsRef.current, apiLang(lang));
      },
      async context() {
        if (mode === "api") return api.getMapContext(apiLang(lang));
        return mapContext(apiLang(lang));
      },
      transcribe: api.transcribeWav,
    }),
    [lang, contrast, largeText, mode, health, incidents, stats],
  );

  return <StoreContext.Provider value={apiValue}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
