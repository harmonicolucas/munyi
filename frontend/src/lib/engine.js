import rules from "@shared/flood_rules.json";
import network from "@shared/demo_network.json";
import demoReports from "@shared/demo_reports.json";

const RANK = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

export function fold(text) {
  return (text || "")
    .toLowerCase()
    .replaceAll("’", "'")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function containsAny(folded, phrases) {
  return (phrases || []).find((phrase) => phrase && folded.includes(phrase)) || null;
}

function tokens(text) {
  const stop = new Set(rules.stopwords);
  return new Set(
    fold(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((part) => part.length > 2 && !stop.has(part)),
  );
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const item of left) if (right.has(item)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function copy(lang) {
  if (lang === "en") {
    return {
      unknown: "Location not provided",
      peopleYes: "The report mentions people in the area. The number is not confirmed.",
      peopleNo: "The report does not say whether people are at risk.",
      missingPlace: "The location is missing.",
      missingCoords: "There are no verified coordinates. The place was given in text.",
      needHuman: "A person needs to confirm this report.",
      road: "No road was classified as safe.",
      image: "The photograph is visual evidence only. It does not measure depth or make a road safe.",
      summaryFlood: (area) => `Flood report at ${area}.`,
      summarySlide: (area) => `Possible landslide report at ${area}.`,
      summaryOther: "Report received. It is not confirmed as a flood.",
      alertFlood: (label, area, actions) =>
        `Flood alert. ${label} risk. A flood was reported at ${area}. ${actions}`,
      alertSlide: (label, area, actions) =>
        `Landslide alert. ${label} risk. A landslide was reported at ${area}. ${actions}`,
      alertOther: (actions) => `Report received. This is not confirmed as a flood. ${actions}`,
      sam: "SAM 3.1 runs on the backend when the key is configured. A picture alone does not measure depth.",
    };
  }
  return {
    unknown: "Local não indicado",
    peopleYes: "O relato menciona pessoas na zona. O número não foi confirmado.",
    peopleNo: "O relato não indica se há pessoas em risco.",
    missingPlace: "Falta a localização.",
    missingCoords: "Não há coordenadas verificadas. O local foi indicado por texto.",
    needHuman: "É precisa confirmação humana.",
    road: "Nenhuma estrada foi classificada como segura.",
    image: "A fotografia é evidência visual. Não mede profundidade nem torna uma estrada segura.",
    summaryFlood: (area) => `Inundação reportada em ${area}.`,
    summarySlide: (area) => `Possível deslizamento reportado em ${area}.`,
    summaryOther: "Relato recebido. Ainda não está confirmado como inundação.",
    alertFlood: (label, area, actions) =>
      `Alerta de inundação. Risco ${label}. Existe uma inundação reportada em ${area}. ${actions}`,
    alertSlide: (label, area, actions) =>
      `Alerta de deslizamento. Risco ${label}. Existe um deslizamento reportado em ${area}. ${actions}`,
    alertOther: (actions) => `Relato recebido. Ainda não está confirmado como inundação. ${actions}`,
    sam: "A segmentação SAM 3.1 corre no backend quando a chave está configurada. Uma imagem sozinha não mede profundidade.",
  };
}

function extractArea(text) {
  const patterns = [
    /\b((?:rua|avenida|av\.)\s+\S+(?:\s+\S+){0,5})/i,
    /(?:pr[oó]xim[ao]\s+d[aoe]|junto\s+[aà]o?|em\s+frente\s+[aà]o?)\s+([^.,;\n]{3,60})/i,
  ];
  const blocked = new Set(rules.generic_places);
  for (const pattern of patterns) {
    const match = (text || "").match(pattern);
    if (!match) continue;
    const found = match[1].replace(/\s+/g, " ").trim();
    if (blocked.has(fold(found)) || found.length < 4) continue;
    return found.slice(0, 120);
  }
  return null;
}

function baseActions(type, severity, lang) {
  if (type === "other") return [...rules.unknown_actions[lang]];
  if (type === "unconfirmed" && (severity === "HIGH" || severity === "CRITICAL")) {
    return [...rules.unconfirmed_danger_actions[lang]];
  }
  const actions = [...rules.actions[lang][severity]];
  if (type === "landslide") return [...rules.landslide_actions[lang], ...actions];
  return actions;
}

export function assess({ description, locationText, latitude, longitude, hasImage, lang = "pt" }) {
  const language = lang === "en" ? "en" : "pt";
  const text = copy(language);
  const folded = fold(description);
  const flood = Boolean(containsAny(folded, rules.flood_terms));
  const slide = Boolean(containsAny(folded, rules.landslide_terms));
  let level = null;
  for (const name of ["CRITICAL", "HIGH", "MODERATE", "LOW"]) {
    if (containsAny(folded, rules.severity_terms[name])) {
      level = name;
      break;
    }
  }
  let incidentType = "other";
  if (slide) incidentType = "landslide";
  else if (flood) incidentType = "flood";
  else if (level === "HIGH" || level === "CRITICAL") incidentType = "unconfirmed";
  if (!level && incidentType === "landslide") level = "HIGH";
  else if (!level && incidentType === "flood") level = "MODERATE";
  else if (!level) level = "LOW";

  const area = (locationText || "").trim() || extractArea(description) || text.unknown;
  const hasPlace = area !== text.unknown;
  const hasCoords = latitude != null && longitude != null;
  const missing = [];
  if (!hasPlace && !hasCoords) missing.push(text.missingPlace);
  else if (!hasCoords) missing.push(text.missingCoords);
  if (level === "HIGH" || level === "CRITICAL" || incidentType === "landslide" || incidentType === "unconfirmed") {
    missing.push(text.needHuman);
  }
  const actions = baseActions(incidentType, level, language);
  const label = rules.labels[language][level];
  const actionText = actions.join(" ");
  let summary = text.summaryOther;
  let simple = text.alertOther(actionText);
  if (incidentType === "flood") {
    summary = text.summaryFlood(area);
    simple = text.alertFlood(label, area, actionText);
  } else if (incidentType === "landslide") {
    summary = text.summarySlide(area);
    simple = text.alertSlide(label, area, actionText);
  }
  simple = `${simple} ${text.road}`;
  const requires = !hasCoords || level === "HIGH" || level === "CRITICAL" || incidentType !== "flood";
  return {
    incident_type: incidentType,
    severity: level,
    summary,
    affected_area: area,
    people_at_risk: containsAny(folded, rules.people_terms) ? text.peopleYes : text.peopleNo,
    missing_information: missing,
    requires_confirmation: requires,
    recommended_actions: actions,
    simple_alert: simple,
    source: "deterministic_rules",
    model: null,
    road_safety: "unknown",
    severity_policy: "rules",
    notes: hasImage ? [text.image] : [],
    meta_error: null,
  };
}

function haversine(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlmb = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlmb / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function pointSegment(lat, lng, alat, alng, blat, blng) {
  const lat0 = -25.96;
  const lng0 = 32.58;
  const xy = (la, ln) => [(ln - lng0) * 111.32 * Math.cos((lat0 * Math.PI) / 180), (la - lat0) * 110.574];
  const [px, py] = xy(lat, lng);
  const [ax, ay] = xy(alat, alng);
  const [bx, by] = xy(blat, blng);
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  if (!denom) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function placeText(item) {
  return [item.location_text, item.affected_area].filter(Boolean).join(" ");
}

export function related(left, right) {
  const hours = Math.abs(new Date(left.created_at) - new Date(right.created_at)) / 36e5;
  if (hours > rules.cluster_window_hours) return false;
  const close =
    left.latitude != null &&
    right.latitude != null &&
    haversine(left.latitude, left.longitude, right.latitude, right.longitude) <= rules.cluster_radius_km;
  const a = fold(placeText(left));
  const b = fold(placeText(right));
  const named = a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a) || jaccard(tokens(a), tokens(b)) >= 0.5);
  if (!close && !named) return false;
  const score = jaccard(tokens(left.description), tokens(right.description));
  if (close && score >= rules.text_similarity_with_coords) return true;
  if (named && score >= rules.text_similarity_with_place_text) return true;
  return false;
}

function trend(text) {
  const folded = fold(text);
  const up = Boolean(containsAny(folded, rules.rising_terms));
  const down = Boolean(containsAny(folded, rules.falling_terms));
  if (up && down) return "both";
  if (up) return "up";
  if (down) return "down";
  return "none";
}

export function contradictions(group, lang = "pt") {
  const en = lang === "en";
  const notes = [];
  const trends = group.map((item) => trend(item.description || ""));
  if (trends.includes("both")) {
    notes.push(en ? "The same report says the water is both rising and falling. Confirm it." : "O mesmo relato diz que a água sobe e desce. Confirme.");
  }
  if (trends.includes("up") && trends.includes("down")) {
    notes.push(
      en
        ? "One report says the water is rising and another says it is falling. Confirm before acting."
        : "Um relato indica água a subir e outro indica água a baixar. Confirme antes de agir.",
    );
  }
  const ranks = group.map((item) => RANK[item.severity]).filter((item) => item != null);
  if (ranks.length && Math.max(...ranks) - Math.min(...ranks) >= 2) {
    notes.push(
      en
        ? "The stated severity does not match across reports. A person needs to confirm this."
        : "A gravidade indicada não coincide entre os relatos. É precisa confirmação humana.",
    );
  }
  return notes;
}

export function decorate(incidents) {
  const rows = [...incidents].sort((a, b) => new Date(a.created_at) - new Date(b.created_at) || a.id.localeCompare(b.id));
  const groups = [];
  for (const row of rows) {
    const group = groups.find((items) => items.some((other) => related(row, other)));
    if (group) group.push(row);
    else groups.push([row]);
  }
  const tagged = groups.flatMap((group, index) => group.map((row) => ({ ...row, cluster_id: `GRP-${String(index + 1).padStart(3, "0")}` })));
  return tagged
    .map((row) => {
      const group = tagged.filter((item) => item.cluster_id === row.cluster_id);
      const siblings =
        group.length > 1
          ? group
              .filter((item) => item.id !== row.id)
              .map((item) => ({
                id: item.id,
                summary: item.summary,
                severity: item.severity,
                status: item.status,
                created_at: item.created_at,
              }))
          : [];
      return {
        ...row,
        siblings,
        contradictions: group.length > 1 ? contradictions(group, row.lang) : [],
        road_safety: "unknown",
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function nextId(incidents) {
  const numbers = incidents.map((item) => Number((item.id.match(/\d+/) || [0])[0]));
  return `INC-${String(Math.max(0, ...numbers) + 1).padStart(3, "0")}`;
}

export function createLocal(incidents, input) {
  const lang = input.lang === "en" ? "en" : "pt";
  const analysis = assess({
    description: input.description,
    locationText: input.locationText,
    latitude: input.latitude,
    longitude: input.longitude,
    hasImage: Boolean(input.evidenceUrl),
    lang,
  });
  const now = new Date().toISOString();
  const row = {
    id: input.id || nextId(incidents),
    incident_type: analysis.incident_type,
    severity: analysis.severity,
    description: input.description.trim(),
    summary: analysis.summary,
    affected_area: analysis.affected_area,
    location_text: (input.locationText || "").trim(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    status: "pending_validation",
    channel: input.channel || "text",
    source: "deterministic_rules",
    requires_confirmation: analysis.requires_confirmation,
    people_at_risk: analysis.people_at_risk,
    recommended_actions: analysis.recommended_actions,
    simple_alert: analysis.simple_alert,
    lang,
    analysis,
    segmentation: input.evidenceUrl
      ? {
          status: "unavailable",
          model: "sam-3.1",
          prompt: analysis.incident_type === "landslide" ? "mud" : "water",
          boxes: [],
          parsed: false,
          note: copy(lang).sam,
          reason: "offline",
        }
      : null,
    evidence_url: input.evidenceUrl || null,
    created_at: input.createdAt || now,
    updated_at: now,
  };
  const decorated = decorate([...incidents.map(strip), row]);
  return { incidents: decorated, created: decorated.find((item) => item.id === row.id) };
}

function strip(item) {
  const { siblings, contradictions: ignored, ...rest } = item;
  return rest;
}

export function seedLocal() {
  const now = Date.now();
  const rows = demoReports.map((item) => {
    const analysis = assess({
      description: item.description,
      locationText: item.location_text,
      latitude: item.latitude,
      longitude: item.longitude,
      hasImage: item.channel === "photo",
      lang: "pt",
    });
    const created = new Date(now - Number(item.hours_ago || 0) * 36e5).toISOString();
    return {
      id: item.id,
      incident_type: analysis.incident_type,
      severity: analysis.severity,
      description: item.description,
      summary: analysis.summary,
      affected_area: analysis.affected_area,
      location_text: item.location_text || "",
      latitude: item.latitude,
      longitude: item.longitude,
      status: "pending_validation",
      channel: item.channel,
      source: "demo_seed",
      requires_confirmation: analysis.requires_confirmation,
      people_at_risk: analysis.people_at_risk,
      recommended_actions: analysis.recommended_actions,
      simple_alert: analysis.simple_alert,
      lang: "pt",
      analysis,
      segmentation:
        item.channel === "photo"
          ? {
              status: "unavailable",
              model: "sam-3.1",
              prompt: "water",
              boxes: [],
              parsed: false,
              note: copy("pt").sam,
              reason: "seed",
            }
          : null,
      evidence_url: null,
      created_at: created,
      updated_at: created,
    };
  });
  return decorate(rows);
}

export function setLocalStatus(incidents, id, status) {
  const note =
    status === "confirmed"
      ? "Confirmar significa que uma pessoa viu o relato. Não significa que uma estrada esteja segura."
      : null;
  const next = incidents.map((item) => {
    if (item.id !== id) return strip(item);
    const analysis = { ...item.analysis, road_safety: "unknown", notes: [...(item.analysis?.notes || [])] };
    if (note && !analysis.notes.includes(note)) analysis.notes.push(note);
    return { ...strip(item), status, analysis, updated_at: new Date().toISOString() };
  });
  return decorate(next);
}

export function localStats(incidents) {
  const bySeverity = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  const areas = {};
  const clusters = {};
  for (const row of incidents) {
    bySeverity[row.severity] = (bySeverity[row.severity] || 0) + 1;
    areas[row.affected_area] = (areas[row.affected_area] || 0) + 1;
    if (row.cluster_id) clusters[row.cluster_id] = (clusters[row.cluster_id] || 0) + 1;
  }
  return {
    total: incidents.length,
    by_severity: bySeverity,
    pending_confirmation: incidents.filter((row) => row.requires_confirmation && row.status === "pending_validation").length,
    pending_status: incidents.filter((row) => row.status === "pending_validation").length,
    active_alerts: incidents.filter(
      (row) => row.status !== "dismissed" && ["HIGH", "CRITICAL"].includes(row.severity) && ["flood", "landslide"].includes(row.incident_type),
    ).length,
    images: incidents.filter((row) => row.evidence_url || row.channel === "photo" || row.segmentation?.status === "completed").length,
    areas: Object.entries(areas)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area)),
    possible_duplicate_groups: Object.values(clusters).filter((count) => count > 1).length,
    metrics_note: "Contagens dos relatos registados. Não são métricas de precisão do modelo.",
  };
}

function serious(item) {
  return (
    item.status !== "dismissed" &&
    ["HIGH", "CRITICAL"].includes(item.severity) &&
    item.latitude != null &&
    item.longitude != null &&
    ["flood", "landslide", "unconfirmed"].includes(item.incident_type)
  );
}

export function planRoute(latitude, longitude, incidents, lang = "pt") {
  const language = lang === "en" ? "en" : "pt";
  const nodes = Object.fromEntries(network.nodes.map((node) => [node.id, node]));
  const blockedNodes = new Set();
  const blockedEdges = new Set();
  const hazards = incidents.filter(serious);
  for (const node of network.nodes) {
    if (hazards.some((item) => haversine(node.lat, node.lng, item.latitude, item.longitude) <= network.exclusion_radius_km)) {
      blockedNodes.add(node.id);
    }
  }
  for (const edge of network.edges) {
    const start = nodes[edge.from];
    const end = nodes[edge.to];
    if (blockedNodes.has(edge.from) || blockedNodes.has(edge.to)) {
      blockedEdges.add(edge.id);
      continue;
    }
    if (
      hazards.some(
        (item) =>
          pointSegment(item.latitude, item.longitude, start.lat, start.lng, end.lat, end.lng) <= network.exclusion_radius_km,
      )
    ) {
      blockedEdges.add(edge.id);
    }
  }
  const blocked = network.edges
    .filter((edge) => blockedEdges.has(edge.id))
    .map((edge) => ({
      id: edge.id,
      name: edge.name,
      positions: [
        [nodes[edge.from].lat, nodes[edge.from].lng],
        [nodes[edge.to].lat, nodes[edge.to].lng],
      ],
    }));
  const base = {
    available: false,
    reason: null,
    disclaimer: network.disclaimer[language],
    path: [],
    distance_km: null,
    shelter: null,
    blocked_edges: blocked,
    network_label: network.label[language],
    road_safety: "unknown",
  };
  if (latitude == null || longitude == null) {
    base.reason = network.no_origin_reason[language];
    return base;
  }
  let origin = network.nodes[0];
  let nearest = Infinity;
  for (const node of network.nodes) {
    const distance = haversine(latitude, longitude, node.lat, node.lng);
    if (distance < nearest) {
      nearest = distance;
      origin = node;
    }
  }
  if (nearest > network.max_start_distance_km) {
    base.reason = network.outside_reason[language];
    return base;
  }
  if (blockedNodes.has(origin.id)) {
    base.reason = network.closed_start_reason[language];
    return base;
  }
  const shelters = network.shelters
    .filter((item) => !blockedNodes.has(item.node))
    .map((item) => ({ ...item, lat: nodes[item.node].lat, lng: nodes[item.node].lng }));
  if (!shelters.length) {
    base.reason = network.no_path_reason[language];
    return base;
  }
  const goals = new Set(shelters.map((item) => item.node));
  const graph = Object.fromEntries(network.nodes.map((node) => [node.id, []]));
  for (const edge of network.edges) {
    if (blockedEdges.has(edge.id)) continue;
    const weight = haversine(nodes[edge.from].lat, nodes[edge.from].lng, nodes[edge.to].lat, nodes[edge.to].lng);
    graph[edge.from].push([edge.to, weight]);
    graph[edge.to].push([edge.from, weight]);
  }
  const queue = [[0, origin.id, [origin.id]]];
  const seen = new Set();
  let trail = null;
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, current, path] = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    if (goals.has(current) && current !== origin.id) {
      trail = path;
      break;
    }
    for (const [next, weight] of graph[current]) {
      if (!seen.has(next)) queue.push([cost + weight, next, [...path, next]]);
    }
  }
  if (!trail) {
    base.reason = network.no_path_reason[language];
    return base;
  }
  const path = trail.map((id) => ({ id, name: nodes[id].name, lat: nodes[id].lat, lng: nodes[id].lng }));
  let distance = 0;
  for (let i = 1; i < path.length; i += 1) {
    distance += haversine(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  }
  const destination = shelters.find((item) => item.node === trail[trail.length - 1]);
  return {
    ...base,
    available: true,
    path,
    distance_km: Math.round(distance * 100) / 100,
    shelter: {
      id: destination.id,
      name: destination.name[language],
      lat: destination.lat,
      lng: destination.lng,
      note: destination.note[language],
    },
  };
}

export function mapContext(lang = "pt") {
  const language = lang === "en" ? "en" : "pt";
  const nodes = Object.fromEntries(network.nodes.map((node) => [node.id, node]));
  return {
    label: network.label[language],
    disclaimer: network.disclaimer[language],
    nodes: network.nodes,
    shelters: network.shelters.map((item) => ({
      id: item.id,
      node: item.node,
      name: item.name[language],
      note: item.note[language],
      lat: nodes[item.node].lat,
      lng: nodes[item.node].lng,
    })),
    exclusion_radius_km: network.exclusion_radius_km,
  };
}

export const demoNetwork = network;
