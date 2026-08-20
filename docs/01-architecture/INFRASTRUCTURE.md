# Infrastructure Specification - Pegasus V1

## 1. Objetivo

Definir a infraestrutura inicial do Pegasus com foco em baixo custo, disponibilidade 24x7, segurança, observabilidade, crescimento simples e independência entre aplicação, memória, conhecimento e provedores de IA.

## 2. Arquitetura V1

```text
Internet
   |
   v
Cloudflare / HTTPS
   |
   v
Google Compute Engine
   |
   +-- Pegasus Web/API
   +-- OpenJarvis
   +-- Scheduler / agentes persistentes
   +-- Reverse Proxy
   |
   +----------------------+----------------------+----------------------+
   |                      |                      |                      |
   v                      v                      v                      v
Supabase              Google Drive        Secret Manager          AI Router
PostgreSQL            Knowledge Store     Google Cloud            APIs externas
   |                      |                      |                      |
   v                      v                      v                      v
Memória/estado        Markdown/docs        Tokens/secrets          LLMs

Backups técnicos
   |
   v
Google Cloud Storage
```

## 3. Compute Engine

### Configuração inicial aprovada para V1

- Provedor: Google Cloud
- Serviço: Compute Engine
- Série: E2
- Tipo de máquina: `e2-small`
- Provisioning model: `Regular`
- Região inicial: `us-central1` - Iowa
- Uso estimado: 730 horas/mês
- CPU: 0,5 vCPU
- Memória: 2 GiB RAM
- GPU: nenhuma
- Disco: 50 GiB Standard Persistent Disk
- Sistema operacional: Ubuntu LTS ou distribuição Linux equivalente suportada pelo projeto

### Estimativa observada na calculadora

- Compute Engine: aproximadamente US$ 13,03/mês na configuração acima.
- O valor é uma referência e deve ser revisto antes da criação do recurso.
- Região São Paulo foi descartada na V1 por apresentar custo significativamente maior na simulação.

## 4. Regra de capacidade

A V1 deve ser projetada para operar dentro de 2 GiB de RAM e 0,5 vCPU, evitando serviços desnecessários na VM.

O PostgreSQL não deverá rodar dentro da VM na V1.

### Critérios de scale-up

Avaliar migração de `e2-small` para `e2-medium` quando ocorrer um ou mais dos cenários abaixo de forma sustentada:

- CPU acima de 80% por períodos relevantes.
- RAM acima de 85%.
- Swap frequente.
- Eventos OOM.
- Indexação interferindo no chat.
- Jobs/agentes causando degradação perceptível.
- Latência interna incompatível com o uso esperado.

O scale-up deve ser vertical e não exigir alteração arquitetural.

## 5. Provisioning Model

A VM principal deverá usar `Regular`.

Não usar Spot/Preemptible VM para o Pegasus principal, pois a instância poderá ser interrompida pelo provedor.

Spot poderá ser considerada futuramente para workers temporários, indexação em lote ou tarefas que tolerem interrupção e retomada.

## 6. Banco de dados

### V1

- PostgreSQL externo à VM.
- Provedor inicial: Supabase.
- Começar no plano gratuito se os limites forem suficientes para o MVP.
- O banco será responsável por memória operacional, estado, sessões, metadados de agentes, telemetria funcional e demais dados estruturados.

### Evolução

Migrar para plano pago ou serviço gerenciado superior somente mediante necessidade comprovada.

A aplicação não deve depender de funcionalidades proprietárias que impeçam uma futura migração de PostgreSQL.

## 7. Google Drive

Google Drive será o Knowledge Store documental do Pegasus.

Responsabilidades:

- documentos pessoais e profissionais autorizados;
- arquivos Markdown;
- specs de conhecimento;
- decisões;
- atas e reuniões;
- documentos de referência;
- arquivos para indexação e consulta RAG;
- pasta Inbox para ingestão futura.

Google Drive não deve ser tratado como banco relacional.

## 8. Cloud Storage

Google Cloud Storage será utilizado para armazenamento técnico, incluindo:

- dumps de banco;
- backups técnicos;
- exportações;
- arquivos temporários que não pertencem ao Knowledge Store;
- artefatos operacionais quando necessário.

Na V1, manter o volume mínimo necessário para controlar custos.

## 9. Secret Manager

Google Cloud Secret Manager será o repositório oficial de segredos da aplicação.

Exemplos:

- chaves de APIs de IA;
- credenciais OAuth;
- token GitHub;
- chaves do OpenJarvis;
- credenciais de banco;
- JWT secrets;
- tokens de integração.

Regras:

- nenhum segredo em GitHub;
- nenhum segredo em documentação;
- nenhum segredo hardcoded;
- acesso pelo princípio de menor privilégio;
- rotação possível sem alteração de código;
- logs nunca devem imprimir valor de segredo.

## 10. Reverse Proxy e HTTPS

O Pegasus deverá ser exposto apenas por HTTPS.

A API interna do OpenJarvis não deve ser publicada diretamente na internet.

Arquitetura esperada:

```text
Internet
  -> Cloudflare
  -> HTTPS
  -> Reverse Proxy
  -> Pegasus Web/API
  -> OpenJarvis interno
```

Portas internas deverão permanecer fechadas externamente sempre que possível.

## 11. Docker

A implantação deverá usar containers para manter reprodutibilidade e facilitar atualização.

A V1 deverá evitar excesso de containers devido ao limite de 2 GiB de RAM.

Serviços candidatos na VM:

- Pegasus Web/API;
- OpenJarvis;
- reverse proxy;
- scheduler/worker somente quando necessário.

Redis não é requisito inicial. Só adicionar mediante necessidade comprovada.

## 12. AI Router

A V1 deverá possuir abstração de roteamento de IA para impedir acoplamento a um único fornecedor/modelo.

Responsabilidades:

- selecionar modelo por tipo de tarefa;
- registrar tokens de entrada/saída;
- registrar custo estimado;
- aplicar limites de consumo;
- fallback futuro entre provedores;
- impedir uso indiscriminado de modelos caros.

O processamento pesado dos modelos ocorrerá em APIs externas na V1.

## 13. Controle de custo de IA

Deverá existir orçamento configurável no Pegasus Control Center.

Política inicial sugerida:

- 50%: informativo;
- 75%: alerta;
- 90%: priorizar modelos econômicos;
- 100%: impedir tarefas autônomas de alto custo, preservando funcionalidades essenciais conforme política futura.

Registrar consumo por:

- modelo;
- provedor;
- agente;
- tipo de tarefa;
- período;
- tokens de entrada;
- tokens de saída;
- custo estimado.

## 14. Cloud Run

Cloud Run foi avaliado como alternativa à VM.

Na simulação realizada, a configuração realista para o uso previsto não apresentou vantagem de custo em relação à VM econômica e adicionaria complexidade para scheduler, agentes persistentes e processos contínuos.

Decisão V1: usar Compute Engine.

Cloud Run permanece como opção futura para serviços stateless específicos.

## 15. Região

Região inicial escolhida: `us-central1`.

Motivos:

- custo menor que São Paulo na simulação;
- adequado para MVP pessoal;
- latência adicional considerada aceitável para chat e integrações via API.

A região poderá ser revista com base em métricas reais de latência e custo.

## 16. Princípios de infraestrutura

1. Começar pequeno e escalar por métricas.
2. Não executar LLM pesado localmente na V1.
3. Separar aplicação, memória estruturada e conhecimento documental.
4. Evitar dependência desnecessária de fornecedor.
5. Não criar recursos antes de documentação e estimativa de custo.
6. Nenhum dado crítico deve existir em um único lugar sem política de recuperação.
7. Toda expansão de custo deve ser justificável por telemetria.
