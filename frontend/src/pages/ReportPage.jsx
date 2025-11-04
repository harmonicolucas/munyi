import { useRef, useState } from "react";
import { useStore } from "../store";
import { useCopy } from "../i18n";
import AlertCard from "../components/AlertCard";

const SCHOOL = {
  pt: {
    text: "A água está a subir rapidamente na estrada próxima da escola. Existem vários carros parados e pessoas sem conseguir atravessar.",
    place: "Estrada próxima da escola",
    sameA: "Água acumulada na Rua da Resistência, junto à escola. Há carros parados.",
    sameB: "Fotografei a Rua da Resistência. Há água na mesma zona e há carros parados.",
    street: "Rua da Resistência",
    missing: "Vi água a subir mas não sei dizer a rua.",
    photo: "Imagem sintética de teste: há água desenhada na estrada junto à escola. Não é uma fotografia de campo.",
  },
  en: {
    text: "The water is rising fast on the road near the school. Several cars are stopped and people cannot cross.",
    place: "Road near the school",
    sameA: "Standing water on Resistance Street, near the school. Cars are stopped.",
    sameB: "I photographed Resistance Street. There is water in the same area and the cars are stopped.",
    street: "Resistance Street",
    missing: "I saw water rising but I cannot name the street.",
    photo: "Synthetic test image: water is drawn on the road near the school. This is not a field photograph.",
  },
};

export default function ReportPage() {
  const store = useStore();
  const t = useCopy(store.lang);
  const pack = SCHOOL[store.lang] || SCHOOL.pt;
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [channel, setChannel] = useState("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const resultRef = useRef(null);
  const recognition = useRef(null);

  async function send(input, photo) {
    setBusy(true);
    setError("");
    try {
      const created = await store.submit(input, photo || null);
      setResult(created);
      setTimeout(() => resultRef.current?.focus(), 0);
      return created;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (description.trim().length < 8) {
      setError(store.lang === "en" ? "Add a little more detail." : "Descreva o que está a acontecer com um pouco mais de detalhe.");
      return;
    }
    let evidenceUrl = "";
    if (file && store.mode !== "api") {
      evidenceUrl = await fileToDataUrl(file);
      if (evidenceUrl.length > 1_200_000) {
        evidenceUrl = "";
        setInfo(store.lang === "en" ? "The photo was too large to keep in this browser." : "A fotografia era grande demais para ficar guardada neste browser.");
      }
    }
    await send(
      {
        description,
        locationText: place,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        channel: file ? "photo" : channel,
        lang: store.lang,
        evidenceUrl,
      },
      store.mode === "api" ? file : null,
    );
  }

  function locate() {
    if (!navigator.geolocation) {
      setInfo(t.locateFail);
      return;
    }
    setInfo(t.locating);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setInfo(t.located);
      },
      () => setInfo(t.locateFail),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function dictate() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      setInfo(t.voiceMissing);
      return;
    }
    if (listening && recognition.current) {
      recognition.current.stop();
      setListening(false);
      return;
    }
    const rec = new Rec();
    rec.lang = store.lang === "en" ? "en-US" : "pt-MZ";
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      for (let index = 0; index < event.results.length; index += 1) text += event.results[index][0].transcript;
      setDescription(text);
      setChannel("voice");
    };
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
    setInfo(t.voiceHint);
  }

  async function onFile(event) {
    const next = event.target.files?.[0];
    setFile(next || null);
    setPreview(next ? URL.createObjectURL(next) : "");
    if (next) setChannel("photo");
  }

  async function transcribe(event) {
    const next = event.target.files?.[0];
    if (!next) return;
    if (store.mode !== "api") {
      setInfo(t.voiceMissing);
      return;
    }
    setBusy(true);
    try {
      const data = await store.transcribe(next);
      if (data.transcript) {
        setDescription(data.transcript);
        setChannel("voice");
        setInfo(t.transcript);
      } else {
        setError(data.error || "—");
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell grid">
      <section className="card">
        <h1>{t.reportTitle}</h1>
        <p className="lead">{t.reportLead}</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="story">{t.story}</label>
          <textarea id="story" value={description} onChange={(event) => setDescription(event.target.value)} required />
          <label htmlFor="place">{t.place}</label>
          <input id="place" type="text" value={place} onChange={(event) => setPlace(event.target.value)} />
          <p className="note">{t.placeHint}</p>
          <div className="actions">
            <button type="button" className="secondary" onClick={locate}>
              {t.locate}
            </button>
            <button type="button" className="secondary" onClick={dictate}>
              {listening ? t.voiceStop : t.voice}
            </button>
          </div>
          {info ? <p role="status">{info}</p> : null}
          {coords ? (
            <p>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </p>
          ) : null}
          <label htmlFor="photo">{t.photo}</label>
          <input id="photo" type="file" accept="image/*" onChange={onFile} />
          {preview ? (
            <p className="photo-preview">
              <img src={preview} alt="" />
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFile(null);
                  setPreview("");
                }}
              >
                {t.removePhoto}
              </button>
            </p>
          ) : null}
          <label htmlFor="wav">{t.wav}</label>
          <input id="wav" type="file" accept="audio/wav,.wav" onChange={transcribe} />
          {error ? <p className="error">{String(error)}</p> : null}
          <div className="actions">
            <button className="primary" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? t.sending : t.send}
            </button>
          </div>
          <p className="note">{t.step}</p>
        </form>
        <h2>{t.scenarios}</h2>
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => send(base(pack.text, pack.place, -25.9605, 32.59, "text", store.lang))}>
            {t.scenario1}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              await send(base(pack.sameA, pack.street, -25.9612, 32.5906, "text", store.lang));
              const second = await send(base(pack.sameB, pack.street, -25.9608, 32.5894, "text", store.lang));
              setResult(second);
            }}
          >
            {t.scenario2}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => send(base(pack.missing, "", null, null, "voice", store.lang))}>
            {t.scenario3}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={() => sendSample(pack, store, send, setPreview, setFile)}>
            {t.scenario4}
          </button>
        </div>
      </section>
      <section>
        <h2 ref={resultRef} tabIndex={-1}>
          {t.resultTitle}
        </h2>
        {result ? <AlertCard incident={result} /> : <p className="note">{t.reportLead}</p>}
      </section>
    </div>
  );
}

function base(description, locationText, latitude, longitude, channel, lang) {
  return { description, locationText, latitude, longitude, channel, lang, evidenceUrl: "" };
}

async function sendSample(pack, store, send, setPreview, setFile) {
  const response = await fetch(`${import.meta.env.BASE_URL}samples/rua-inundada.png`);
  const blob = await response.blob();
  const file = new File([blob], "rua-inundada.png", { type: "image/png" });
  setFile(file);
  setPreview(URL.createObjectURL(blob));
  const evidenceUrl = store.mode === "api" ? "" : await fileToDataUrl(file);
  await send(
    {
      description: pack.photo,
      locationText: pack.place,
      latitude: -25.9605,
      longitude: 32.59,
      channel: "photo",
      lang: store.lang,
      evidenceUrl,
    },
    store.mode === "api" ? file : null,
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
