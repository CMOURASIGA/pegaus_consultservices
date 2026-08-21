# Pegasus AI Router

## Objetivo
AI Router desacopla o Pegasus Core de modelos e fornecedores específicos. Christian conversa com Pegasus, não escolhe manualmente GPT, Gemini, Claude ou outro motor a cada demanda.

## Dimensões de decisão
A seleção deve considerar, no mínimo:
- complexidade;
- urgência;
- risco;
- custo;
- modalidade necessária, como texto, visão ou voz;
- disponibilidade e saúde dos provedores.

## Tiers de capacidade
A arquitetura deve solicitar capacidades, não nomes fixos de modelos:
- FAST: baixa latência e baixo custo para tarefas simples;
- BALANCED: equilíbrio entre qualidade, velocidade e custo;
- REASONING: raciocínio aprofundado para problemas complexos;
- DEEP_REASONING: maior profundidade, revisão e validação para casos que justifiquem custo/latência superiores;
- MULTIMODAL: interpretação de imagens/documentos quando necessária;
- VOICE: interação de voz conforme arquitetura definida.

Um provedor/modelo poderá atender mais de uma capacidade.

## Política inicial
- conversa simples, classificação e resumo: FAST;
- análise normal: BALANCED;
- debate complexo ou problema com múltiplas dependências: REASONING;
- decisão com impacto relevante: REASONING ou DEEP_REASONING com validação;
- urgente e simples: priorizar FAST;
- urgente e complexo: selecionar o modelo capaz com menor latência aceitável, sem eliminar controles de segurança;
- alto risco: capacidade adequada + Decision Guard, independentemente da urgência.

## Escalonamento dinâmico
Pegasus pode iniciar uma tarefa com tier econômico e escalar se detectar insuficiência de capacidade.

Exemplo: FAST -> BALANCED -> REASONING.

O escalonamento deve possuir limites de custo e evitar loops de reprocessamento.

## Urgência
Urgência altera prioridade e escolha de latência, mas não remove validações obrigatórias, Decision Guard, aprovação humana ou políticas de segurança.

## Fallback
Se o modelo/provedor preferencial estiver indisponível, exceder timeout ou apresentar falha recuperável, o Router deve tentar alternativa compatível com a capacidade solicitada, respeitando custo, segurança, modalidade e políticas de dados.

Fallback entre provedores não deve exigir alteração no Pegasus Core.

## Custo
Toda chamada deve registrar, quando disponível:
- provedor;
- modelo;
- tier/capacidade solicitada;
- motivo da seleção;
- tokens/medidas de consumo;
- custo estimado/real;
- latência;
- resultado/falha;
- escalonamentos e fallbacks.

O Router deve respeitar orçamento mensal e limites definidos no Control Center. Redução de custo não deve provocar execução insegura ou resposta deliberadamente insuficiente em decisões críticas.

## Princípio de independência
Nenhum fluxo de negócio central deve depender de um nome específico de modelo. Mapeamentos entre capacidade e modelos devem ser configuráveis para permitir substituição futura sem redesenhar Pegasus.
