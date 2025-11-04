# MUNYI

Da primeira evidência à evacuação inclusiva.

MUNYI is a flood-report assistant for the Meta Global AI Developer Hackathon, theme **Build for Your World**. A person sends a photo, a short text, or a voice note. The system reads the report, keeps possible duplicates, and answers in plain language. It never says a road is safe.

O MUNYI recebe um relato de inundação por fotografia, texto ou voz. Interpreta o perigo, agrupa relatos parecidos e devolve orientações curtas, com áudio. Não declara estradas seguras e não inventa coordenadas.

Contacto: [harmonicolucas@gmail.com](mailto:harmonicolucas@gmail.com)

Demonstração: [https://harmonicolucas.github.io/munyi/](https://harmonicolucas.github.io/munyi/)

## What it does

1. **Registo.** Texto, fotografia ou voz. O ditado do browser tem de ser relido. Um WAV pode ser transcrito no backend com Muse Voice Transcribe.
2. **Análise.** Regras determinísticas leem sempre o texto. Com `MODEL_API_KEY`, Muse Spark (`muse-spark-1.3`) devolve JSON e a resposta passa por um filtro de segurança.
3. **Duplicados.** Relatos próximos no lugar, na hora e nas palavras ficam no mesmo grupo. Não são apagados. Se um diz que a água sobe e outro que desce, o grupo pede confirmação.
4. **Mapa.** Leaflet e OpenStreetMap, com uma rede viária de teste em Maputo. Troços junto de relatos altos são excluídos. O percurso é de demonstração.
5. **Alertas inclusivos.** Frases curtas, botões grandes, contraste alto, texto maior e leitura em voz alta. O texto do alerta está sempre visível.

## Meta models

| Modelo | ID | Uso |
| --- | --- | --- |
| Muse Spark | `muse-spark-1.3` | Interpretar o relato e, se houver fotografia, a imagem |
| SAM 3.1 | `sam-3.1` | Segmentar água ou lama. Não mede profundidade |
| Muse Voice Transcribe | `muse-voice-transcribe-1.0` | Transcrever um WAV mono de 16-bit |

A chave fica em `backend/.env`. Não entra no React nem no GitHub Pages. Sem chave, o backend e o site usam as regras determinísticas e dizem isso.

Safety floor: if the words describe explicit danger, the published severity cannot be lower than the rule reading. Sentences that call a road safe, invent coordinates, or state a depth are removed.

## Quick start

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The API docs are at `http://127.0.0.1:8000/docs`.

Put the hackathon key in `backend/.env`:

```
MODEL_API_KEY=your_key
META_API_URL=https://api.meta.ai/v1
```

PostgreSQL is optional. The app creates a local SQLite file when `DATABASE_URL` is empty. The PostgreSQL contract is in `database/schema.sql`.

```powershell
pytest
```

These tests check behaviour. They are not an accuracy score.

## Demonstration scenarios

| Scenario | Expected result |
| --- | --- |
| Text: water rising fast near the school, cars stopped, people unable to cross | Flood, high severity, plain-language actions, road safety unknown |
| Two reports from the same street | Possible duplicate group, both reports kept |
| Report with no place and no coordinates | Confirmation requested, no invented pin |
| Synthetic street image | Image stored; SAM only when the backend key exists; depth is not stated |

The same four actions are buttons on the report screen. The picture in `frontend/public/samples/rua-inundada.png` is an original synthetic drawing, not a field photo.

Shelters and the road graph are fictional test data around Maputo. Do not use them as a real evacuation.

## Architecture

```
Citizen
  → React (report, map, accessible alert, dashboard)
  → FastAPI
       → rules (always)
       → Muse Spark (when MODEL_API_KEY is set)
       → SAM 3.1 (photograph, same condition)
       → Muse Voice Transcribe (WAV)
  → SQLite or PostgreSQL
  → test road network + Leaflet
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Demo script: [docs/DEMO.md](docs/DEMO.md). Paste-ready submission text: [docs/SUBMISSION.md](docs/SUBMISSION.md).

## Limits

- The administrative board has no login. Keep the API on your machine. Set `ENABLE_DEMO_RESET=false` before any public deployment.
- GitHub Pages runs the browser demonstration. It does not hold the API key, so judges see the rules, map, groups, and alerts there. Muse Spark and SAM run when the backend is started locally.
- A viewed report is still not a statement that a road is safe.
- No precision, recall, or accuracy number is published. The automated tests only lock the safety behaviour.

## Hackathon submission

- Public repository with this README and the MIT `LICENSE`
- Working demonstration and the four scenarios above
- Video of at most 3 minutes, public on YouTube or Vimeo. A timed script is in `docs/DEMO.md`
- Confirm the form fields on the [hackathon page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) before sending
