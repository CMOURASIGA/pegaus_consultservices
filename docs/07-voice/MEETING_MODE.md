# Pegasus Meeting Mode

## Objetivo
Permitir que Pegasus acompanhe reuniões autorizadas, transcreva, compreenda contexto e produza artefatos e ações posteriores.

## Consentimento
Meeting Mode não deve ser projetado para gravação silenciosa. Quando houver terceiros, uso de gravação/transcrição deve ser informado e respeitar consentimento e regras aplicáveis.

## Modos
### LISTENING MODE
Pegasus observa, separa interlocutores quando tecnicamente possível, transcreve e organiza o conteúdo sem participar espontaneamente.

### ASSIST MODE
Além de acompanhar, Pegasus pode responder quando Christian o chama durante a reunião, utilizando o contexto já ouvido.

### PARTICIPANT MODE
Evolução futura em que Pegasus pode participar da discussão dentro das permissões e regras explicitamente autorizadas. Deve continuar subordinado a Christian e às políticas do Core.

## Pipeline
Áudio autorizado -> diarização/separação de interlocutores -> transcrição -> identificação contextual/probabilística -> compreensão -> extração estruturada -> Memory Curator.

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
- referências a documentos/projetos citados.

## Identidade de interlocutores
Diarização e identificação são conceitos diferentes. O sistema pode separar Speaker A/B/C sem conhecer identidade. Quando houver hipótese de identidade, deve manter nível de confiança e contexto.

Reconhecimento de voz não equivale a autenticação e não deve ser tratado como certeza quando a confiança for insuficiente.

## Pós-reunião
Christian pode consultar o conteúdo de forma natural, por exemplo perguntar o que determinada pessoa ficou de fazer ou qual decisão foi tomada sobre determinado assunto.

Quando solicitado, Pegasus pode preparar tarefas, mensagens, documentos ou outras ações decorrentes. Execuções externas continuam sujeitas às permissões e aprovações aplicáveis.

## Memória
Não é obrigatório transformar a transcrição integral em memória permanente. Memory Curator avalia o que merece retenção, podendo preservar decisões, compromissos e contexto relevante. Christian pode ordenar explicitamente retenção do conteúdo.

## Privacidade
Áudio, transcrição e artefatos derivados seguem classificação de dados, minimização, retenção e controles de exclusão definidos nas políticas de segurança e memória.
