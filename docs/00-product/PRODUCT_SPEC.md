# Pegasus Product Spec

## Visão
Pegasus é um parceiro pessoal de IA, permanente, privado, proativo e acessível pela nuvem. Deve trabalhar ao lado de Christian para debater assuntos, orientar decisões, preservar contexto e preparar futuras ações.

Não deve ser apenas uma interface alternativa para modelos generativos. Os modelos são motores substituíveis por trás de uma identidade, memória, regras, ferramentas e experiência próprias do Pegasus.

## Experiência central V1
- interação por texto e voz desde a V1;
- análise de documentos, arquivos e imagens fornecidos pelo usuário;
- memória persistente e continuidade de contexto;
- classificação contextual entre pessoal, trabalho, projeto, cliente e assunto;
- proatividade orientada a relevância;
- notificações mobile quando algo realmente requer atenção;
- histórico e rastreabilidade do que foi observado, proposto e executado;
- Christian permanece responsável pela validação das ações externas.

## Modelo de autonomia
### Nível 1 - Observar
Pode ocorrer autonomamente: ler fontes autorizadas, monitorar, classificar, relacionar informações, identificar relevância, preparar análises e detectar pendências.

### Nível 2 - Propor
Pegasus apresenta o que identificou, explica contexto e recomenda uma ação. Pode preparar conteúdo ou plano, mas não efetiva ação externa que exija aprovação.

### Nível 3 - Executar
Ações externas relevantes, destrutivas, publicáveis, financeiras, de comunicação ou que alterem dados/sistemas exigem autorização humana conforme a política da ferramenta.

## Princípio Human-in-the-loop
Pegasus pode observar e analisar autonomamente. Toda ação com potencial de impacto externo deve possuir trilha de auditoria e, por padrão, aprovação humana antes da execução.

## Proatividade
Proatividade não significa responder e-mails sozinho ou alterar sistemas sem autorização. Significa reduzir ruído e destacar o que merece atenção.

Exemplo: de 50 e-mails, Pegasus pode identificar que 3 são relevantes, explicar por quê, relacioná-los ao contexto existente e solicitar atenção somente nesses casos.

## Integrações V1 planejadas
- Google Drive;
- Gmail;
- Google Calendar;
- GitHub.

A arquitetura deverá permitir novas integrações posteriormente sem acoplamento ao Core.

## Multimodalidade
A V1 deve prever texto, voz, documentos e imagens como entradas válidas. A conversa deve preservar contexto independentemente do canal de entrada.

## Contextos
Pegasus deve distinguir automaticamente, sempre que possível: pessoal, trabalho, projeto, cliente e assunto. Em caso de ambiguidade relevante, deve solicitar confirmação em vez de assumir silenciosamente.

## Objetivo humano
O produto deve se comportar como um recurso permanentemente disponível para trabalhar com Christian: debater, analisar, lembrar, contextualizar, chamar atenção e orientar. A execução autônoma ampla não é objetivo inicial.
