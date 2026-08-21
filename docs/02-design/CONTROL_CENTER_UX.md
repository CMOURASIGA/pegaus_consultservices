# Control Center UX - Pegasus

## Objetivo

Definir o painel administrativo e operacional do Pegasus.

## Seções

```text
Control Center
├── Overview
├── IA e Custos
├── Infraestrutura
├── Memória
├── Google Drive
├── Agentes
├── Integrações
├── Segurança
├── Sessões
├── Backups
└── Logs
```

## Overview

Exibir resumo rápido:
- status do Pegasus;
- OpenJarvis/Core;
- banco de dados;
- Google Drive;
- provedor de IA;
- scheduler;
- CPU;
- RAM;
- disco;
- último backup;
- custo de IA no mês.

## IA e Custos

Deve apresentar:
- consumo de tokens de entrada e saída;
- custo mensal acumulado;
- custo por modelo;
- custo por agente;
- chamadas por modelo;
- orçamento mensal;
- alertas 50%, 75%, 90% e 100%;
- política de redução de custo quando aplicável.

## Infraestrutura

Exibir:
- CPU;
- RAM;
- disco;
- uptime;
- saúde dos containers/serviços;
- latência interna;
- alertas de saturação;
- recomendação de scale-up quando critérios definidos forem atingidos.

## Sessões

Tabela/lista com:
- dispositivo;
- navegador;
- horário de início;
- última atividade;
- modo público ou confiável;
- ação `Encerrar sessão`.

## Backups

Exibir:
- último snapshot/backup de VM quando houver;
- último pg_dump;
- status do envio ao Cloud Storage;
- falhas recentes;
- histórico mínimo de execuções.

## Logs

- filtros por severidade e componente;
- pesquisa;
- data/hora;
- correlação por execução/agente;
- não exibir secrets ou tokens.

## Padrão de interação

- ações críticas em modal central;
- filtros e detalhes rápidos em drawer;
- relatórios e configurações complexas em páginas completas;
- usar indicadores objetivos, evitando excesso de elementos visuais decorativos.
