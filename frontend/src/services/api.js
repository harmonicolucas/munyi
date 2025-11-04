import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const client = axios.create({ baseURL, timeout: 120000 });

export async function getHealth() {
  try {
    const { data } = await axios.get(`${baseURL}/api/health`, { timeout: 2000 });
    return data;
  } catch {
    return null;
  }
}

export async function listIncidents() {
  const { data } = await client.get("/api/incidents");
  return data;
}

export async function createIncident(payload) {
  const { data } = await client.post("/api/incidents", payload);
  return data;
}

export async function createIncidentWithPhoto(fields, file) {
  const form = new FormData();
  form.append("description", fields.description);
  form.append("location_text", fields.location_text || "");
  form.append("latitude", fields.latitude ?? "");
  form.append("longitude", fields.longitude ?? "");
  form.append("channel", fields.channel || "photo");
  form.append("lang", fields.lang || "pt");
  form.append("segment", "true");
  if (file) form.append("photo", file);
  const { data } = await client.post("/api/incidents/with-evidence", form);
  return data;
}

export async function updateStatus(id, status) {
  const { data } = await client.patch(`/api/incidents/${id}/status`, { status });
  return data;
}

export async function getStats() {
  const { data } = await client.get("/api/stats");
  return data;
}

export async function getMapContext(lang) {
  const { data } = await client.get("/api/map/context", { params: { lang } });
  return data;
}

export async function requestRoute(latitude, longitude, lang) {
  const { data } = await client.post("/api/routes", { latitude, longitude, lang });
  return data;
}

export async function transcribeWav(file) {
  const form = new FormData();
  form.append("audio", file);
  const { data } = await client.post("/api/transcribe", form);
  return data;
}

export async function resetDemo() {
  const { data } = await client.post("/api/demo/reset");
  return data;
}

export function evidenceSrc(url) {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${baseURL}${url}`;
}
