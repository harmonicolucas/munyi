import { useStore } from "../store";

export default function AboutPage() {
  const { lang } = useStore();
  const en = lang === "en";
  return (
    <article className="shell prose card">
      <h1>{en ? "How MUNYI works" : "Como o MUNYI funciona"}</h1>
      <p>
        {en
          ? "The tables show the published Open-Meteo rainfall and, where a river cell exists, the GloFAS discharge for that cell. A percentage further down is calculated on this page from the rainfall. It is not a published flood warning and it does not mean a road is safe."
          : "As tabelas mostram a chuva publicada pela Open-Meteo e, quando existe uma célula de rio, a descarga GloFAS dessa célula. A percentagem mais abaixo é calculada nesta página a partir da chuva. Não é um aviso de inundação publicado e não significa que uma estrada esteja segura."}
      </p>
      <p>
        {en
          ? "A person can also report a flood by text, photograph, or voice. Similar reports stay separate. Short instructions can be read aloud."
          : "Uma pessoa também pode reportar uma inundação por texto, fotografia ou voz. Relatos parecidos ficam separados. As instruções curtas podem ser lidas em voz alta."}
      </p>
      <h2>{en ? "What the system refuses to do" : "O que o sistema não faz"}</h2>
      <ul>
        <li>{en ? "It never classifies a road as safe." : "Nunca classifica uma estrada como segura."}</li>
        <li>{en ? "It never invents coordinates. A pin exists only if the person sent one." : "Nunca inventa coordenadas. Só há um ponto se a pessoa o enviou."}</li>
        <li>{en ? "It does not delete a possible duplicate. It keeps both reports and asks for confirmation when they disagree." : "Não apaga um possível duplicado. Guarda os dois relatos e pede confirmação quando discordam."}</li>
        <li>{en ? "The path on the map is a test network around Maputo. The assistance points are fictional." : "O percurso no mapa é uma rede de teste à volta de Maputo. Os pontos de assistência são fictícios."}</li>
        <li>{en ? "A photograph is not a depth measurement." : "Uma fotografia não é uma medida de profundidade."}</li>
      </ul>
      <h2>{en ? "How a report is judged" : "Como um relato é julgado"}</h2>
      <p>
        {en
          ? "Fixed rules always read the text. An extra reading, when the server has a key, cannot lower an explicit danger in the words. The actions shown to the person come from the rule table."
          : "Regras fixas leem sempre o texto. Uma leitura extra, quando o servidor tem uma chave, não pode baixar um perigo explícito nas palavras. As acções mostradas à pessoa vêm da tabela de regras."}
      </p>
      <p>{en ? "Contact: harmonicolucas@gmail.com" : "Contacto: harmonicolucas@gmail.com"}</p>
    </article>
  );
}
