# Pegasus Meeting Mode

## Objetivo
Permitir que Pegasus acompanhe reuniões autorizadas por áudio e, quando disponível/autorizado, visão, compreenda contexto, apoie a condução e produza artefatos e ações posteriores.

## Consentimento
Meeting Mode não deve ser projetado para gravação ou observação silenciosa de terceiros. Quando houver terceiros, uso de câmera, gravação, transcrição ou análise deve ser informado e respeitar consentimento e regras aplicáveis.

## Modos
### LISTENING MODE
Pegasus observa, separa interlocutores quando tecnicamente possível, transcreve e organiza o conteúdo sem participar espontaneamente.

### COPILOT MODE
Pegasus acompanha a reunião e orienta discretamente o responsável pela condução. Pode combinar áudio, visão autorizada, pauta, tempo, participantes, objetivos, histórico e Context Engine.

O Copilot deve privilegiar evidências observáveis, por exemplo:
- distribuição de tempo de fala;
- interrupções;
- tentativas de participação;
- perguntas sem resposta;
- assuntos repetidos;
- divergências explícitas;
- decisões sem responsável/prazo;
- desvio da pauta;
- tempo restante;
- tópicos ainda pendentes;
- participação muito concentrada;
- entradas/saídas de participantes quando visualmente detectáveis.

Pode recomendar ao condutor ações como ouvir participante pouco contemplado, fechar uma decisão, retornar à pauta, esclarecer divergência ou administrar tempo.

### ASSIST MODE
Além de acompanhar, Pegasus pode responder quando Christian o chama durante a reunião, utilizando o contexto já ouvido/visto de forma autorizada.

### PARTICIPANT MODE
Evolução futura em que Pegasus pode participar da discussão dentro das permissões e regras explicitamente autorizadas. Deve continuar subordinado a Christian e às políticas do Core.

## Pipeline multimodal
Câmera autorizada -> Vision Gateway -> detecção/tracking contextual de pessoas/ambiente

Áudio autorizado -> diarização/separação de interlocutores -> transcrição

Ambos -> Context Fusion -> identificação contextual/probabilística -> compreensão -> Meeting Copilot -> extração estruturada -> Memory Curator.

## Reações e comportamento
Pegasus não deve afirmar estado mental, caráter, intenção ou veracidade com base apenas em expressão facial, postura ou comportamento visual.

Usar padrão:
OBSERVAÇÃO -> HIPÓTESE -> CONTEXTO -> RECOMENDAÇÃO.

Exemplo aceitável: "João fez quatro perguntas consecutivas sobre custo. Pode haver uma preocupação de orçamento; talvez valha perguntar se existe algum ponto específico que precisa ser tratado."

Evitar afirmações como "João está irritado", "Maria está mentindo" ou "Carlos não gostou da proposta" quando não houver evidência explícita suficiente.

## Saídas
Pegasus deve poder produzir, conforme solicitado:
- transcrição;
- resumo executivo;
- ata;
- decisões;
- pendências;
- responsáveis;
- prazos;
- riscos;
- perguntas em aberto;
- tarefas propostas;
- referências a documentos/projetos citados;
- análise objetiva da dinâmica da reunião;
- recomendações para melhoria da condução.

## Identidade de interlocutores
Diarização, detecção visual e identificação são conceitos diferentes. O sistema pode separar Speaker A/B/C e Pessoa Visual A/B/C sem conhecer identidade.

Context Fusion pode correlacionar sinais quando houver base técnica, mantendo score/confiança. Reconhecimento de rosto/voz não equivale a autenticação e não deve ser tratado como certeza quando a confiança for insuficiente.

## Feedback ao responsável
No Copilot Mode, feedback durante a reunião deve ser discreto, curto e priorizado. Não interromper continuamente. Alertas devem considerar relevância, tempo e possibilidade de aguardar.

Exemplos:
- "18 minutos restantes; ainda há dois itens da pauta.";
- "Há uma pergunta de segurança que ficou sem resposta.";
- "A decisão sobre fornecedor ainda está sem responsável.".

## Pós-reunião
Christian pode consultar o conteúdo de forma natural, inclusive pedir análise de sua condução. Feedback deve apontar evidências observáveis e ações concretas de melhoria, evitando julgamento psicológico dos participantes.

Quando solicitado, Pegasus pode preparar tarefas, mensagens, documentos ou outras ações decorrentes. Execuções externas continuam sujeitas às permissões e aprovações aplicáveis.

## Memória
Não é obrigatório transformar transcrição/vídeo integral em memória permanente. Memory Curator avalia o que merece retenção, podendo preservar decisões, compromissos e contexto relevante. Christian pode ordenar explicitamente retenção do conteúdo quando permitido.

## Privacidade
Áudio, vídeo, transcrição e artefatos derivados seguem classificação de dados, minimização, retenção e controles de exclusão definidos nas políticas de segurança e memória.

Preferir eventos/metadados derivados ao armazenamento contínuo de vídeo quando o vídeo bruto não for necessário.
