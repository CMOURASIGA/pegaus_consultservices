# Pegasus Context Engine

## Objetivo
Montar para cada interação ou execução o contexto mínimo suficiente para Pegasus compreender corretamente a situação, raciocinar e agir sem enviar toda a memória e todo o conhecimento disponível aos modelos.

## Memória versus contexto
Memória representa o conhecimento preservado pelo Pegasus. Contexto é o subconjunto desse conhecimento necessário para a interação ou Task atual.

## Responsabilidades
Context Engine deve identificar, conforme necessário:
- identidade e preferências relevantes de Christian;
- conversa atual;
- domínio pessoal/profissional/técnico;
- pessoas, organizações, clientes, projetos e assuntos citados;
- referências temporais;
- memórias e decisões relacionadas;
- objetivos e prioridades;
- Tasks, approvals e automações relacionadas;
- documentos relevantes;
- resultados de integrações externas quando necessários.

## Recuperação progressiva
Pegasus deve preferir recuperação progressiva:
1. conversa atual e contexto imediato;
2. memória relevante;
3. entidades e relações;
4. documentos/Knowledge Store;
5. integrações externas;
6. pesquisa externa quando aplicável.

Não é obrigatório executar todas as etapas. A recuperação para quando houver contexto suficiente e confiável para o objetivo.

## Contexto temporal
O Engine deve distinguir estado atual de histórico. Informações superadas continuam recuperáveis para perguntas históricas, mas não devem substituir silenciosamente o estado vigente.

## Conflitos
Quando fontes divergirem, considerar recência, autoridade, proveniência, confiança, contexto e relação de supersessão/correção. Vector similarity isolada não determina verdade.

## Separação pessoal/profissional
Contextos devem permanecer separados por padrão, mas podem ser cruzados quando isso for material para a tarefa. Separação significa uso por necessidade, não isolamento absoluto.

## Atualização durante a interação
Nova informação fornecida por Christian durante texto ou voz pode alterar imediatamente restrições e contexto. Informações anteriores podem ser marcadas como superadas para o raciocínio corrente sem apagar histórico.

## Context Confidence
Antes de agir, Pegasus deve avaliar confiança sobre elementos críticos como projeto, pessoa, objetivo, ação e restrições. Quanto maior o impacto/reversibilidade da ação, maior deve ser a confiança mínima exigida. Ambiguidade material em ação relevante deve resultar em pergunta ou validação antes da execução.

## Context Snapshot para Tasks
Tasks persistentes podem armazenar snapshot estruturado contendo objetivo, restrições, entidades, decisões, fontes e contexto necessário à retomada. Antes de ações importantes, Pegasus deve verificar se fatos críticos mudaram desde o snapshot.

## Proveniência
Informações materiais devem manter referência à origem sempre que possível para permitir validação, explicação e resolução de conflitos.

## Integração
Context Engine alimenta AI Router, Memory Curator, Task Lifecycle, Attention Engine, Decision Guard e experiência conversacional.

## Segurança
Recuperar uma informação não significa autorização para compartilhá-la. Classificação de dados, minimização, permissões e políticas de segurança continuam aplicáveis ao contexto montado.
