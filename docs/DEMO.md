# Demonstração

Os quatro cenários também estão na página Reportar. Os testes em `tests/test_munyi.py` fixam o comportamento. Não há taxa de precisão para apresentar.

| Cenário | O que fazer | Resultado esperado |
| --- | --- | --- |
| Fotografia de rua | Botão “Imagem sintética de rua” ou uma fotografia real com o backend ligado | A imagem fica no relato. Com chave, o SAM 3.1 é chamado com o prompt `water`. Sem chave, a interface diz que a segmentação não correu. Ninguém afirma a profundidade. |
| Relato textual | Botão “Relato junto à escola” | Tipo inundação, gravidade alta, acções como “Não atravesse a água.”, estrada não classificada como segura. |
| Dois relatos no mesmo sítio | Botão “Dois relatos no mesmo sítio” | Os dois ficam no mesmo grupo possível. Nenhum é apagado. |
| Sem localização | Botão “Relato sem localização” | “Falta a localização.”, confirmação pedida, sem coordenadas inventadas. |

O quinto relato de demonstração, já semeado, diz que a água na mesma rua está a baixar. O painel deve mostrar que os relatos não coincidem.

## Roteiro de vídeo (até 3 minutos)

0:00 - Inundações em Maputo e a pergunta: o que faz uma pessoa com uma fotografia e sem saber se a rua é segura.

0:20 - Enviar o relato da escola. Mostrar gravidade alta, confirmação humana e a frase “Nenhuma estrada foi classificada como segura.”

0:50 - Enviar o segundo relato da mesma rua. Mostrar o grupo e a contradição com o relato em que a água desce.

1:20 - Abrir a imagem sintética e explicar o SAM: máscara visual, não profundidade. Se a chave estiver activa, mostrar a resposta; se não, mostrar o estado “indisponível”.

1:50 - Mapa. Troço Baixa-Escola excluído. Percurso de teste até ao ponto fictício do Alto Maé. Ler o aviso de que não é evacuação real.

2:20 - Ouvir o alerta, aumentar o texto e ligar o contraste.

2:40 - Nomear Muse Spark 1.3, SAM 3.1 e Muse Voice Transcribe. Dizer que a chave não está no site público e que não há métrica de precisão inventada.

Grave em ecrã inteiro, com o áudio do alerta. Publique no YouTube ou Vimeo como vídeo público, com menos de 3 minutos.

## O que anotar à mão

Durante a gravação, aponte falhas reais: tempo de resposta do modelo, máscara não desenhada, browser sem voz, localização recusada. Essas notas são a evidência. Não as transforme numa percentagem.
