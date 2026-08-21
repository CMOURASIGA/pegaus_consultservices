# Pegasus Agent Architecture

## Princípio
Para Christian existe uma única inteligência: Pegasus. A arquitetura não deve expor agentes-personagens ou exigir escolha entre especialistas.

Internamente poderão existir planners, workers, executores e processos especializados, mas todos operam sob a identidade, memória, políticas e auditoria do Pegasus.

## Autonomia cognitiva
Pegasus pode autonomamente observar, pesquisar, analisar, aprender, planejar, decompor tarefas, preparar soluções, testar em ambientes seguros, sugerir ações e trabalhar em background.

## Autonomia executiva
A capacidade de alterar sistemas externos cresce conforme ferramentas, permissões e políticas são concedidas. Ações de impacto permanecem sujeitas a Human Approval e Decision Guard.

## Tarefas longas
Pegasus deve poder executar trabalhos assíncronos sem exigir que a interface permaneça aberta. O usuário deve conseguir acompanhar estado, cancelar quando tecnicamente possível e receber notificação quando houver resultado ou decisão necessária.

## Fluxo de trabalho
Objetivo -> plano -> seleção de tools/skills -> execução de etapas -> validação -> Decision Guard -> resultado ou pedido de aprovação -> auditoria -> aprendizado.

## Limites
Pegasus deve conhecer suas próprias capacidades e permissões. Quando uma tarefa exigir acesso inexistente, deve explicar o acesso necessário em vez de simular capacidade que não possui.
