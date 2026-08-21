# Tools, Skills, Automação e Permissões

## Tool
Tool é uma capacidade técnica atômica oferecida ao Pegasus, como pesquisar Gmail, ler repositório GitHub, consultar Drive, ler Calendar, pesquisar Web ou enviar notificação.

Cada Tool deve declarar permissões, operações suportadas, risco, requisitos de aprovação, limites, timeout e dados auditáveis.

## Skill
Skill é conhecimento operacional reutilizável que combina raciocínio e uma ou mais Tools para atingir um objetivo. Exemplo: preparar briefing do dia usando Calendar, Gmail, memória e Decision Inbox.

Pegasus pode identificar padrões repetitivos e criar/propor novas Skills autonomamente.

Uma nova Skill que introduza permissões, ações externas ou riscos adicionais deve passar pelo Decision Guard antes de ser ativada.

## Aprendizado operacional
Fluxo desejado:
observar -> identificar padrão -> aprender -> criar capacidade/Skill -> propor quando necessário -> receber autoridade -> executar -> monitorar -> reportar -> melhorar.

## Automação
Pegasus pode identificar oportunidades de automação e sugeri-las. No futuro, conforme permissões concedidas, poderá criar e operar automações.

Exemplo: perceber que Christian solicita a mesma análise semanalmente e perguntar se deve prepará-la automaticamente e apenas notificar quando houver algo relevante.

## Monitoramentos
Monitoramentos recorrentes devem privilegiar silêncio quando nada relevante ocorrer. Mudanças relevantes passam pelo Attention Engine e podem gerar Decision Inbox/notificação.

## Matriz inicial de autonomia
- observar: autônomo;
- pesquisar em fontes autorizadas: autônomo;
- analisar: autônomo;
- aprender: autônomo, sujeito ao Memory Curator;
- planejar: autônomo;
- preparar: autônomo;
- testar: autônomo somente em ambiente seguro/autorizado;
- sugerir: autônomo;
- notificar: autônomo via Attention Engine;
- criar Skill sem novos privilégios: permitido com registro;
- criar monitoramento: conforme política, podendo propor antes da ativação;
- alterar sistema externo: aprovação;
- enviar/publicar: aprovação;
- excluir: aprovação forte;
- ação financeira: aprovação forte;
- risco crítico: Decision Guard pode recusar execução.

## Princípio de menor privilégio
Permissões devem ser concedidas por Tool e capacidade necessária. Uma Skill não ganha automaticamente acesso além das Tools que a compõem.

## Expansão futura
A arquitetura deve permitir novas Tools e Skills sem alterar o Pegasus Core. Novas integrações devem aderir ao padrão de permissões, aprovação, auditoria e observabilidade.
