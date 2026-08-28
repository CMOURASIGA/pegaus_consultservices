# Tools, Skills, Automação e Permissões

## Tool
Tool é uma capacidade técnica atômica oferecida ao Pegasus, como pesquisar Gmail, ler repositório GitHub, consultar Drive, ler Calendar, pesquisar Web, enviar notificação ou operar uma capability local por meio de Device Agent autorizado.

Cada Tool deve declarar permissões, operações suportadas, risco, requisitos de aprovação, limites, timeout, origem da execução e dados auditáveis.

## Device Tools
Tools locais devem ser expostas exclusivamente pelo Device Gateway/Device Agent, nunca como acesso direto irrestrito do modelo ao sistema operacional.

Exemplos:
- `device.status`;
- `screen.capture_context`;
- `filesystem.read`;
- `filesystem.write`;
- `app.open`;
- `terminal.run_safe_command`;
- `notification.local`;
- `camera.request_context`;
- `microphone.request_context`.

Cada Device Tool deve validar device_id, sessão, capability concedida, path/scope, argumentos, risco e aprovação necessária.

## Níveis de execução local
- OBSERVE: somente contexto/leitura autorizada;
- ASSIST: análise/recomendação sem alteração relevante;
- ACT: execução dentro de capabilities explicitamente concedidas;
- ELEVATED: ação sensível exige step-up/aprovação forte.

O nível não substitui a permissão granular da Tool.

## Skill
Skill é conhecimento operacional reutilizável que combina raciocínio e uma ou mais Tools para atingir um objetivo. Exemplo: preparar briefing do dia usando Calendar, Gmail, memória e Decision Inbox.

Pegasus pode identificar padrões repetitivos e criar/propor novas Skills autonomamente.

Uma nova Skill que introduza permissões, ações externas ou riscos adicionais deve passar pelo Decision Guard antes de ser ativada.

Skills que usam Device Tools não podem ampliar capabilities do Device Agent nem acessar diretórios/comandos fora do escopo concedido.

## Aprendizado operacional
Fluxo desejado:
observar -> identificar padrão -> aprender -> criar capacidade/Skill -> propor quando necessário -> receber autoridade -> executar -> monitorar -> reportar -> melhorar.

## Automação
Pegasus pode identificar oportunidades de automação e sugeri-las. No futuro, conforme permissões concedidas, poderá criar e operar automações.

Exemplo: perceber que Christian solicita a mesma análise semanalmente e perguntar se deve prepará-la automaticamente e apenas notificar quando houver algo relevante.

Automações dependentes de dispositivo devem declarar device/capability necessária. Se o dispositivo estiver offline, a Task deve aguardar em WAITING_DEVICE ou equivalente, sem trocar silenciosamente para outro dispositivo.

## Monitoramentos
Monitoramentos recorrentes devem privilegiar silêncio quando nada relevante ocorrer. Mudanças relevantes passam pelo Attention Engine e podem gerar Decision Inbox/notificação.

## Matriz inicial de autonomia
- observar: autônomo dentro de fonte/capability autorizada;
- pesquisar em fontes autorizadas: autônomo;
- analisar: autônomo;
- aprender: autônomo, sujeito ao Memory Curator;
- planejar: autônomo;
- preparar: autônomo;
- capturar Screen Context: somente quando policy/sessão permitir;
- ler arquivo local: autônomo somente dentro de escopo READ previamente concedido;
- escrever arquivo local: conforme nível ACT e policy;
- executar comando local seguro: somente dentro de allowlist/policy;
- executar comando administrativo: aprovação forte, se permitido;
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

Device Agent não deve executar comando desconhecido apenas porque o modelo o solicitou. A Tool/Agent deve validar contrato, argumentos e policy localmente antes da execução.

## Auditoria local
Registrar execuções locais proporcionais ao risco, incluindo:
- dispositivo;
- Tool;
- capability;
- escopo/path;
- comando normalizado quando aplicável;
- aprovação;
- resultado/erro;
- duração;
- Task/conversa de origem.

## Expansão futura
A arquitetura deve permitir novas Tools e Skills sem alterar o Pegasus Core. Novas integrações e Device Tools devem aderir ao padrão de permissões, aprovação, auditoria e observabilidade definido nas specs.
