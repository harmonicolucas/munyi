import { useStore } from "../store";

export default function AboutPage() {
  const { lang } = useStore();
  const en = lang === "en";
  return (
    <article className="shell prose card">
      <h1>{en ? "How MUNYI works" : "Como o MUNYI funciona"}</h1>
      <p>
        {en
          ? "MUNYI helps a person report a flood by text, photo, or voice. It groups similar reports, shows them on a demonstration map, and reads short safety instructions aloud."
          : "O MUNYI permite reportar uma inundação por texto, fotografia ou voz. Agrupa relatos parecidos, mostra-os num mapa de demonstração e lê instruções curtas em voz alta."}
      </p>
      <h2>{en ? "Meta models" : "Modelos Meta"}</h2>
      <ul>
        <li>
          <strong>Muse Spark 1.3</strong> — {en ? "reads the report and, when a key is set, returns structured JSON." : "lê o relato e, com a chave configurada, devolve JSON estruturado."}
        </li>
        <li>
          <strong>SAM 3.1</strong> — {en ? "segments visual water or mud. The mask is not a depth measurement." : "segmenta água ou lama visível. A máscara não é uma medida de profundidade."}
        </li>
        <li>
          <strong>Muse Voice Transcribe</strong> — {en ? "transcribes a WAV file on the backend. Browser dictation is separate and must be reread." : "transcreve um WAV no backend. O ditado do browser é outro caminho e tem de ser relido."}
        </li>
      </ul>
      <h2>{en ? "What the system refuses to do" : "O que o sistema não faz"}</h2>
      <ul>
        <li>{en ? "It never classifies a road as safe." : "Nunca classifica uma estrada como segura."}</li>
        <li>{en ? "It never invents coordinates. A pin exists only if the person sent one." : "Nunca inventa coordenadas. Só há um ponto se a pessoa o enviou."}</li>
        <li>{en ? "It does not delete a possible duplicate. It keeps both reports and asks for confirmation when they disagree." : "Não apaga um possível duplicado. Guarda os dois relatos e pede confirmação quando discordam."}</li>
        <li>{en ? "The path on the map is a test network around Maputo. The assistance points are fictional." : "O percurso no mapa é uma rede de teste à volta de Maputo. Os pontos de assistência são fictícios."}</li>
      </ul>
      <h2>{en ? "How a report is judged" : "Como um relato é julgado"}</h2>
      <p>
        {en
          ? "Deterministic rules always read the text. If Muse Spark replies, its severity cannot undercut an explicit danger in the words, and a photograph cannot be turned into a depth. Citizen-facing actions stay in plain language from the rule table."
          : "As regras determinísticas leem sempre o texto. Se a Muse Spark responder, a gravidade não pode ficar abaixo de um perigo explícito nas palavras, e uma fotografia não se transforma em profundidade. As instruções ao cidadão ficam na linguagem simples da tabela de regras."}
      </p>
      <p>
        {en ? "Contact: harmonicolucas@gmail.com" : "Contacto: harmonicolucas@gmail.com"}
      </p>
    </article>
  );
}
