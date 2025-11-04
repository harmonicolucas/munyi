# Arquitectura

O MUNYI separa a leitura do modelo da decisão que chega ao cidadão.

1. O browser envia descrição, local escrito, coordenadas opcionais e, se existir, uma fotografia.
2. `risk_service.assess` produz uma leitura determinística: tipo, gravidade, área, pessoas, lacunas e acções em linguagem simples.
3. Se `MODEL_API_KEY` existir, `muse_service` chama `POST /v1/responses` com `muse-spark-1.3`. As coordenadas do aparelho não são enviadas ao modelo. Só se diz se o cidadão as anexou.
4. `risk_service.combine` publica o resultado:
   - a gravidade não desce abaixo da leitura das regras quando o texto descreve perigo explícito;
   - um texto sem evidência de inundação não é aceite como cheia crítica;
   - frases de estrada segura, profundidade e coordenadas inventadas são retiradas;
   - `road_safety` fica sempre `unknown`;
   - as acções visíveis vêm da tabela de regras, não do texto livre do modelo.
5. Com fotografia, `sam_service` pede ao `sam-3.1` a segmentação de `water` ou `mud`. A nota da interface diz que a máscara não mede profundidade.
6. `cluster_service` agrupa por proximidade (400 m), janela de 12 horas e semelhança do texto. Não apaga relatos. Contradições de tendência ou de gravidade ficam visíveis.
7. `route_service` corre um grafo de teste. Nós e troços a menos de 350 m de um relato alto ou crítico são fechados. Se não houver caminho, o sistema diz isso e não inventa outro. O percurso traz sempre o aviso de que não é uma rota real de evacuação.

A base local é SQLite, criada na arranque. `database/schema.sql` descreve as mesmas tabelas em PostgreSQL.

O site em GitHub Pages usa o mesmo motor de regras no browser (`frontend/src/lib/engine.js`) quando `http://127.0.0.1:8000` não responde. A chave da Meta não é incluída nesse site.
