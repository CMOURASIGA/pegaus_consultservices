# Observability and Control Center Specification - Pegasus

## 1. Objetivo

Definir o painel administrativo do Pegasus como centro operacional para acompanhar saúde, segurança, consumo e custos.

## 2. Escopo do Control Center

O Control Center deverá consolidar, quando tecnicamente disponível:

- status da aplicação;
- status do OpenJarvis;
- CPU, RAM, disco e load average;
- status do banco;
- status do Google Drive sync/indexação;
- status dos provedores de IA;
- sessões ativas;
- jobs e agentes;
- backups;
- logs operacionais;
- consumo de tokens;
- custo de IA;
- alertas de infraestrutura.

## 3. Dashboard inicial

Exemplo esperado:

```text
PEGASUS STATUS

Pegasus API        ONLINE
OpenJarvis         ONLINE
Database           ONLINE
Google Drive       SYNC
AI Provider        ONLINE
Scheduler          ONLINE

CPU                34%
RAM                1.4 / 2.0 GiB
Disk               11 / 50 GiB
Last backup        OK
```

## 4. Custos de IA

O painel deverá permitir consulta por período e detalhamento por modelo/agente.

Indicadores mínimos:

- chamadas;
- tokens de entrada;
- tokens de saída;
- custo estimado;
- orçamento mensal;
- percentual consumido;
- tendência de consumo.

## 5. Infraestrutura

Indicadores mínimos:

- CPU atual e média;
- RAM atual e média;
- disco utilizado/livre;
- uptime;
- reinicializações de container;
- falhas recentes;
- uso de swap;
- eventos OOM, se detectáveis.

## 6. Sessões

O Control Center deverá permitir listar e revogar sessões.

Dados previstos:

- tipo de dispositivo/navegador;
- horário de início;
- última atividade;
- classificação de dispositivo confiável ou público, quando disponível;
- expiração;
- ação para encerrar sessão.

## 7. Backups

O painel deverá mostrar pelo menos:

- último backup do banco;
- status;
- tamanho;
- duração;
- último snapshot da VM, quando aplicável;
- falhas de backup.

O painel não precisa executar o mecanismo de backup na V1, mas deve comprovar visualmente seu estado.

## 8. Alertas

Alertas mínimos:

- CPU sustentada acima de 80%;
- RAM sustentada acima de 85%;
- disco acima de 80%;
- falha de backup;
- banco indisponível;
- Google Drive sem sincronização por período anormal;
- provedor de IA indisponível;
- custo de IA acima dos thresholds definidos.

## 9. Segurança

O Control Center é uma área administrativa sensível e deverá exigir autenticação forte e autorização explícita.

Não exibir segredos, tokens completos ou credenciais em nenhuma tela.
