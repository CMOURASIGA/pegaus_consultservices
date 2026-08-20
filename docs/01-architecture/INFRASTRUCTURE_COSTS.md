# Infrastructure Cost Baseline - Pegasus V1

## 1. Objetivo

Registrar as estimativas obtidas durante o desenho da infraestrutura para manter decisões de custo rastreáveis.

## 2. Compute Engine selecionado

Configuração candidata oficial da V1:

- `e2-small`
- 0,5 vCPU
- 2 GiB RAM
- 50 GiB Standard Persistent Disk
- `us-central1` - Iowa
- Provisioning Model: Regular
- 730 horas/mês
- sem GPU

Estimativa observada na Google Cloud Pricing Calculator em 20/08/2026:

- aproximadamente US$ 13,03/mês para Compute Engine na configuração acima.

## 3. Configurações comparadas

Durante o estudo também foram avaliadas:

### e2-medium

- 1 vCPU
- 4 GiB RAM
- 50 GiB Standard Persistent Disk
- Iowa
- Regular
- estimativa observada: aproximadamente R$ 146,93/mês.

### e2-standard-2

- 2 vCPU
- 8 GiB RAM
- 50 GiB Standard Persistent Disk
- Iowa
- Regular
- estimativa observada: aproximadamente R$ 289,20/mês.

### Região São Paulo

A mudança da configuração para São Paulo elevou substancialmente o custo na simulação, por isso `us-central1` foi selecionada para a V1.

### Cloud Run

Cloud Run foi simulado com parâmetros mais próximos do uso real do Pegasus e não apresentou vantagem econômica suficiente para justificar a complexidade adicional de scheduler/agentes persistentes.

## 4. Serviços complementares

Planejamento V1:

- Secret Manager: uso inicial dentro de volume muito baixo, custo esperado desprezível/baixo.
- Cloud Storage: pequeno volume para backups, custo esperado baixo.
- Supabase PostgreSQL: começar no Free, se limites permitirem.
- Google Drive: utilizar espaço já existente como Knowledge Store.
- GitHub: repositório de código e specs.

## 5. IA

O custo de modelos de IA é variável e não faz parte do custo fixo da VM.

A V1 deverá implementar medição e orçamento configurável no Control Center.

Orçamento inicial sugerido para experimentação:

- IA: US$ 15/mês como teto operacional inicial configurável.

Esse valor não é contrato nem previsão garantida. Deve ser recalibrado após coleta de uso real.

## 6. Orçamento inicial de referência

Considerando Compute Engine econômico e baixo consumo dos serviços auxiliares, o custo fixo de infraestrutura deverá permanecer próximo do valor da VM, acrescido de pequenos valores de backup/storage.

O custo total dependerá principalmente do consumo de APIs de IA.

## 7. Regra financeira

Nenhum aumento permanente de infraestrutura deverá ocorrer sem:

1. métrica que demonstre gargalo;
2. impacto observado no usuário ou em jobs;
3. estimativa de custo antes da mudança;
4. registro da decisão na documentação.
