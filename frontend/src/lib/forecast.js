export const PLACES = [
  { id: "maputo", name: "Maputo", lat: -25.9692, lng: 32.5732 },
  { id: "lagos", name: "Lagos", lat: 6.5244, lng: 3.3792 },
  { id: "dhaka", name: "Dhaka", lat: 23.8103, lng: 90.4125 },
  { id: "jakarta", name: "Jakarta", lat: -6.2088, lng: 106.8456 },
  { id: "new-orleans", name: "New Orleans", lat: 29.9511, lng: -90.0715 },
  { id: "sao-paulo", name: "São Paulo", lat: -23.5558, lng: -46.6396 },
];

const RISK = { projNorm: 120, maxDailyNorm: 70, logisticCenter: 0.6, logisticScale: 4 };

function labelFor(percent) {
  if (percent >= 70) return "High";
  if (percent >= 40) return "Medium";
  return "Low";
}

function localDay(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString().slice(0, 10);
}

export function seasonalFactor(latitude, month) {
  const wet = latitude < 0 ? [11, 12, 1, 2, 3] : [5, 6, 7, 8, 9];
  if (wet.includes(month)) return 1.25;
  if (month === 4 || month === 10) return 1;
  return 0.8;
}

export function scoreForecast(data) {
  const today = localDay(data.utc_offset_seconds || 0);
  const rain = data.daily.precipitation_sum.map((value) => value || 0);
  const probability = data.daily.precipitation_probability_max || [];
  const rows = data.daily.time.map((time, index) => ({
    time,
    rain: rain[index],
    probability: probability[index] ?? null,
  }));
  const past = rows.filter((row) => row.time < today).slice(-3);
  const future = rows.filter((row) => row.time >= today).slice(0, 7);
  const recent3 = past.reduce((sum, row) => sum + row.rain, 0);
  const next7 = future.reduce((sum, row) => sum + row.rain, 0);
  const maxDaily = future.reduce((max, row) => Math.max(max, row.rain), 0);
  const month = Number(today.slice(5, 7));
  const seasonal = seasonalFactor(data.latitude, month);
  const proj30 = next7 * (30 / 7) * seasonal;
  const soilIndex = Math.min(1, recent3 / 60);
  const waterIndex = 0.6 * (proj30 / RISK.projNorm) + 0.3 * (maxDaily / RISK.maxDailyNorm) + 0.1 * soilIndex;
  const heuristicProb = 1 / (1 + Math.exp(-RISK.logisticScale * (waterIndex - RISK.logisticCenter)));
  const heuristicPct = Math.round(heuristicProb * 100);
  const linearScore = -1.2 + 0.004 * proj30 + 0.02 * maxDaily + 0.5 * soilIndex + 0.3 * seasonal;
  const linearPct = Math.round((1 / (1 + Math.exp(-linearScore))) * 100);
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    elevation: data.elevation,
    timezone: data.timezone,
    retrievedAt: new Date().toISOString(),
    future,
    recent3,
    next7,
    maxDaily,
    proj30,
    soilIndex,
    seasonal,
    month,
    waterIndex,
    heuristic: { label: labelFor(heuristicPct), percent: heuristicPct },
    linear: { label: labelFor(linearPct), percent: linearPct },
  };
}

export async function fetchOutlook(lat, lng) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", Number(lat).toFixed(4));
  url.searchParams.set("longitude", Number(lng).toFixed(4));
  url.searchParams.set("daily", "precipitation_sum,precipitation_probability_max");
  url.searchParams.set("past_days", "3");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");
  const response = await fetch(url);
  if (!response.ok) throw new Error("forecast unavailable");
  return scoreForecast(await response.json());
}

export async function searchPlaces(name, lang) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", lang === "en" ? "en" : "pt");
  const response = await fetch(url);
  if (!response.ok) throw new Error("search unavailable");
  const data = await response.json();
  return (data.results || []).map((item) => ({
    id: item.id,
    name: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
    lat: item.latitude,
    lng: item.longitude,
  }));
}

export async function rainRadarTemplate() {
  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!response.ok) throw new Error("radar unavailable");
  const data = await response.json();
  const frame = data.radar?.past?.at(-1);
  if (!frame) throw new Error("radar unavailable");
  return {
    url: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
    time: new Date(frame.time * 1000).toISOString(),
  };
}

export function outlookCopy(lang) {
  const pt = lang === "pt-MZ" || lang === "pt";
  if (!pt) {
    return {
      title: "Flood outlook",
      lead: "Click any point on the world map, search for a place, or pick an example. Rainfall is the Open-Meteo forecast for that point. The risk figure is calculated from those millimetres. It is not a river gauge, and it does not mean a road is safe.",
      search: "Search a place",
      searchButton: "Search",
      examples: "Examples",
      searchEmpty: "No place matched that name.",
      searchFailed: "Place search did not respond.",
      place: "Place",
      forecast: "Next 7 days",
      why: "How this number is made",
      tipsTitle: "What to do",
      methodRain: "Rainfall index",
      methodLinear: "Linear score",
      loading: "Fetching the forecast…",
      failed: "The forecast service did not respond. No risk number was filled in.",
      rain: "Rain",
      chance: "Chance",
      past: "Rain in the past 3 days",
      week: "Forecast rain, next 7 days",
      max: "Highest forecast day",
      scaled: "30-day figure, scaled from those 7 days",
      index: "Rainfall index",
      source: "Source: Open-Meteo forecast. Radar: RainViewer. Map: OpenStreetMap.",
      streets: "Streets",
      satellite: "Satellite",
      radar: "Rain radar",
      reports: "Citizen reports",
      noReports: "No citizen reports on the map.",
      report: "Report flooding",
      route: "Maputo test path",
      tips: {
        Low: ["Check the forecast again in a few days.", "Keep drains clear.", "Save local emergency numbers in your phone."],
        Medium: ["Move valuables off the floor.", "Do not park in low ground.", "Watch rivers and culverts near you."],
        High: ["Follow local authority guidance and be ready to leave.", "Switch off electricity if water enters the house.", "Do not walk or drive through flood water."],
      },
    };
  }
  return {
    title: "Perspectiva de inundação",
    lead: "Clique em qualquer ponto do mapa-mundo, procure um lugar ou escolha um exemplo. A chuva é a previsão Open-Meteo desse ponto. O valor de risco é calculado a partir desses milímetros. Não é uma medição de rio e não significa que uma estrada esteja segura.",
    search: "Procurar um lugar",
    searchButton: "Procurar",
    examples: "Exemplos",
    searchEmpty: "Nenhum lugar corresponde a esse nome.",
    searchFailed: "A procura de lugares não respondeu.",
    place: "Local",
    forecast: "Próximos 7 dias",
    why: "Como este número é feito",
    tipsTitle: "O que fazer",
    methodRain: "Índice de chuva",
    methodLinear: "Pontuação linear",
    loading: "A obter a previsão…",
    failed: "O serviço de previsão não respondeu. Nenhum valor de risco foi preenchido.",
    rain: "Chuva",
    chance: "Probabilidade",
    past: "Chuva nos últimos 3 dias",
    week: "Chuva prevista, próximos 7 dias",
    max: "Dia com mais chuva prevista",
    scaled: "Valor de 30 dias, escalado a partir desses 7 dias",
    index: "Índice de chuva",
    source: "Fonte: previsão Open-Meteo. Radar: RainViewer. Mapa: OpenStreetMap.",
    streets: "Ruas",
    satellite: "Satélite",
    radar: "Radar de chuva",
    reports: "Relatos de cidadãos",
    noReports: "Não há relatos de cidadãos no mapa.",
    report: "Reportar inundação",
    route: "Percurso de teste em Maputo",
    tips: {
      Low: ["Volte a ver a previsão dentro de alguns dias.", "Mantenha as valas limpas.", "Guarde os números de emergência no telefone."],
      Medium: ["Suba os objectos de valor do chão.", "Não estacione em zonas baixas.", "Observe rios e valas perto de si."],
      High: ["Siga a orientação das autoridades locais e esteja pronto para sair.", "Desligue a electricidade se a água entrar em casa.", "Não atravesse a água a pé nem de carro."],
    },
  };
}

export function riskWord(label, lang) {
  const pt = lang === "pt-MZ" || lang === "pt";
  const words = pt
    ? { Low: "Baixo", Medium: "Médio", High: "Alto" }
    : { Low: "Low", Medium: "Medium", High: "High" };
  return words[label] || label;
}

export function reasonLines(outlook, lang) {
  const pt = lang === "pt-MZ" || lang === "pt";
  const hemisphere = outlook.latitude < 0 ? (pt ? "hemisfério sul" : "southern hemisphere") : pt ? "hemisfério norte" : "northern hemisphere";
  const weight = pt ? String(outlook.seasonal).replace(".", ",") : outlook.seasonal;
  if (!pt) {
    return [
      `Open-Meteo rainfall for the next 7 days: ${outlook.next7.toFixed(1)} mm.`,
      `Highest single day in that forecast: ${outlook.maxDaily.toFixed(1)} mm.`,
      `Rain over the previous 3 days: ${outlook.recent3.toFixed(1)} mm.`,
      `The 30-day figure (${outlook.proj30.toFixed(1)} mm) is the 7-day total times 30/7, with season weight ${weight} (${hemisphere}). It is not a published 30-day forecast.`,
      `Rainfall index ${outlook.heuristic.percent}% (${outlook.heuristic.label}). Linear score ${outlook.linear.percent}% (${outlook.linear.label}).`,
      "A road was not classified as safe.",
    ];
  }
  return [
    `Chuva Open-Meteo para os próximos 7 dias: ${outlook.next7.toFixed(1)} mm.`,
    `Dia mais alto nessa previsão: ${outlook.maxDaily.toFixed(1)} mm.`,
    `Chuva nos 3 dias anteriores: ${outlook.recent3.toFixed(1)} mm.`,
    `O valor de 30 dias (${outlook.proj30.toFixed(1)} mm) é o total de 7 dias vezes 30/7, com peso de época ${weight} (${hemisphere}). Não é uma previsão oficial de 30 dias.`,
    `Índice de chuva ${outlook.heuristic.percent}% (${riskWord(outlook.heuristic.label, lang)}). Pontuação linear ${outlook.linear.percent}% (${riskWord(outlook.linear.label, lang)}).`,
    "Nenhuma estrada foi classificada como segura.",
  ];
}
