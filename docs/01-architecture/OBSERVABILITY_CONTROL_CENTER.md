# Observability and Control Center Specification - Pegasus

## 1. Objetivo
Definir observabilidade operacional do Pegasus e o Control Center como centro para acompanhar saúde, segurança, atividade, integrações, IA, custos, memória, automações e execuções.

Pegasus deve detectar seus próprios problemas sempre que possível. Christian não deve precisar descobrir primeiro que uma integração, worker, automação ou serviço crítico deixou de funcionar.

## 2. Princípio de atenção
Falhas transitórias recuperáveis devem ser tratadas automaticamente dentro de limites seguros e registradas sem interromper Christian desnecessariamente.

Quando retries forem esgotados, houver degradação material, ação necessária ou risco relevante, o evento passa pelo Attention Engine e pode gerar notificação/Decision Inbox.

## 3. Saúde do Pegasus
Monitorar, quando tecnicamente disponível:
- frontend/backend/API;
- OpenJarvis/componentes herdados enquanto existirem;
- banco/Supabase;
- filas e workers;
- scheduler/jobs;
- armazenamento;
- autenticação;
- Notification Gateway;
- memória e retrieval;
- Google Drive sync/indexação;
- serviços de voz;
- provedores de IA;
- CPU, RAM, disco, swap e load average;
- containers/processos e reinicializações;
- backups.

## 4. Recuperação automática
Componentes podem realizar retry automático para falhas transitórias. Retries devem possuir limite, backoff quando adequado, idempotência quando aplicável e auditoria.

Exemplo: worker falha -> retry -> sucesso: registrar e seguir. Falhas repetidas além do limite: Attention Engine -> informar Christian se houver necessidade de intervenção ou impacto relevante.

## 5. Integrações
Cada integração deve possuir health state claro, como healthy, degraded, auth_required, unavailable ou revoked.

Exibir status, última operação bem-sucedida, falhas recentes e necessidade de reautenticação. Pegasus pode resolver falhas transitórias autonomamente, mas deve solicitar Christian quando nova autorização for necessária.

## 6. IA e qualidade operacional
Além de disponibilidade da API, monitorar:
- latência;
- erros e timeouts;
- fallback entre modelos/provedores;
- escalonamento de tiers;
- consumo/tokens;
- custo;
- respostas interrompidas;
- Tool calls rejeitadas;
- tarefas refeitas;
- taxa de sucesso por tipo de tarefa quando mensurável.

Os dados devem permitir avaliar a política do AI Router. Exemplo: se FAST escala para REASONING na maioria das tarefas de uma categoria, a regra de roteamento pode precisar de ajuste.

## 7. Custos
Consolidar custos de IA e, quando possível, infraestrutura, banco, storage e notificações.

Indicadores mínimos de IA:
- chamadas;
- tokens/consumo de entrada e saída;
- custo estimado/real;
- orçamento mensal;
- percentual consumido;
- tendência;
- detalhamento por provedor, modelo, tier, tarefa e período.

Thresholds iniciais sugeridos:
- 70% do orçamento: informativo;
- 85%: atenção;
- 100%: crítico.

Atingir 100% não deve desligar Pegasus automaticamente por padrão. Pegasus pode adotar estratégias econômicas e alertar Christian. Bloqueio por orçamento somente se explicitamente configurado.

## 8. Infraestrutura
Indicadores mínimos:
- CPU atual e média;
- RAM atual e média;
- disco utilizado/livre;
- uptime;
- reinicializações;
- falhas recentes;
- swap;
- eventos OOM quando detectáveis.

## 9. Control Center
Navegação prevista:
- Visão Geral;
- Saúde;
- IA & Custos;
- Memória;
- Integrações;
- Skills;
- Automações;
- Decision Inbox;
- Execuções;
- Dispositivos & Sessões;
- Segurança;
- Auditoria;
- Backups;
- Configurações.

## 10. Activity Timeline
Control Center deve possuir linha do tempo operacional para responder: "O que Pegasus esteve fazendo enquanto eu não estava falando com ele?"

Exemplos de eventos:
- análise de novos e-mails;
- itens classificados como relevantes;
- criação de Decision Inbox;
- execução de automação;
- monitoramento sem anomalias;
- uso de Tool;
- fallback de modelo;
- falha/retry;
- aprovação e execução.

A Timeline deve priorizar metadados e resumos, evitando duplicar conteúdo sensível integral.

## 11. Sessões
Permitir listar e revogar sessões. Dados previstos:
- dispositivo/navegador;
- início;
- última atividade;
- dispositivo confiável ou público;
- expiração;
- ação de encerramento.

## 12. Backups
Mostrar pelo menos:
- último backup do banco;
- status;
- tamanho;
- duração;
- último snapshot da VM quando aplicável;
- falhas de backup.

O painel não precisa executar o mecanismo de backup na primeira implementação, mas deve comprovar visualmente seu estado.

## 13. Alertas
Alertas técnicos iniciais:
- CPU sustentada acima de 80%;
- RAM sustentada acima de 85%;
- disco acima de 80%;
- falha de backup;
- banco indisponível;
- Drive sem sincronização por período anormal;
- provedor de IA indisponível/degradado;
- integração exigindo autenticação;
- automação repetidamente falhando;
- custo acima dos thresholds.

Alertas devem passar por classificação de relevância para evitar fadiga de notificação.

## 14. Segurança
Control Center é área administrativa sensível e exige autenticação forte e autorização explícita. Ações críticas podem exigir step-up authentication.

Nunca exibir secrets, tokens completos, recovery codes utilizados ou credenciais.

## 15. Princípio de operação silenciosa
Observabilidade detalhada deve existir no Control Center, mas Pegasus só deve interromper Christian quando houver informação relevante, decisão necessária, risco ou ação que dependa dele. O restante permanece disponível na Activity Timeline e nos dashboards.
