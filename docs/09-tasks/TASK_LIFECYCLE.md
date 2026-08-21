# Pegasus Task Lifecycle

## Objetivo
Definir como Pegasus transforma demandas em trabalho persistente, executa tarefas assíncronas, aguarda dependências/aprovações, retoma execução e valida conclusão.

## Princípio
Pegasus não deve depender de uma conversa ou navegador aberto para continuar trabalhando. A conversa pode criar, consultar, modificar ou cancelar trabalho, mas a execução pertence ao backend/servidor.

## Quando criar uma Task
Perguntas simples podem ser respondidas diretamente. Demandas que envolvam múltiplas etapas, duração relevante, dependências, ferramentas, acompanhamento ou execução posterior podem ser promovidas automaticamente a Task sem Christian precisar pedir explicitamente.

## Estrutura conceitual
Uma Task deve possuir pelo menos objetivo, origem, prioridade, estado, plano/etapas, contexto necessário, permissões aplicáveis, timestamps, resultado e relações com approvals/automations quando existirem.

## Decomposição
Pegasus pode decompor trabalho complexo em etapas e subtasks. O plano pode evoluir durante a execução conforme novas informações forem descobertas.

## Estados
Estados iniciais previstos:
- PLANNING;
- QUEUED;
- RUNNING;
- WAITING_EXTERNAL;
- WAITING_APPROVAL;
- PAUSED;
- COMPLETED;
- PARTIALLY_COMPLETED;
- FAILED;
- CANCELLED;
- EXPIRED.

Transições devem ser auditáveis.

## Aprovação
Quando uma etapa exigir ação sujeita a aprovação, Pegasus preserva todo o progresso e muda para WAITING_APPROVAL. Após aprovação válida, retoma do ponto apropriado sem refazer trabalho desnecessário.

## Trabalho de longa duração
Tasks podem durar minutos, horas ou dias. A arquitetura deve suportar persistência de estado, retomada após reinicialização e acompanhamento de dependências externas.

## Dependências externas
Quando o próximo avanço depender de terceiro ou evento externo, usar WAITING_EXTERNAL em vez de polling/executar continuamente sem necessidade. Uma integração, monitoramento ou scheduler autorizado pode acordar a Task quando a condição relevante mudar.

## Progresso
Christian pode consultar o estado de qualquer Task por conversa ou Control Center. Preferir progresso verificável por etapas. Percentuais só devem ser exibidos quando houver base real para calculá-los.

## Falhas e retry
Falhas recuperáveis podem usar retry/backoff com limites e idempotência quando aplicável. Falha de uma Tool não deve destruir progresso já realizado.

Quando intervenção for necessária, Pegasus preserva estado e explica claramente o bloqueio.

## Cancelamento e mudança de direção
Christian pode cancelar ou modificar uma Task por comando natural ou Control Center. Pegasus deve interromper novas execuções quando cancelada e, quando possível, adaptar o plano a novas restrições sem reiniciar todo o trabalho.

## Validação antes da conclusão
Pegasus não marca COMPLETED apenas porque o último passo terminou. Antes deve validar:
- objetivo atendido;
- etapas necessárias concluídas;
- ausência de falhas silenciosas conhecidas;
- coerência do resultado;
- pendências restantes;
- necessidade de validação adicional.

Quando apenas parte do objetivo foi atingida, usar PARTIALLY_COMPLETED e declarar o que faltou.

## Subtasks
Pegasus pode criar Tasks derivadas para investigar ou resolver partes de um problema. Subtasks herdam as fronteiras de permissão e segurança da origem e não podem criar novos privilégios.

## Control Center
Execuções devem permitir visualizar estado, plano, etapas, Tools/Skills utilizadas, decisões, custos, Activity Timeline, erros e resultado.

## Segurança
Task persistente não equivale a autorização persistente irrestrita. Toda etapa continua sujeita às permissões atuais, Integration Standard, Decision Guard e Emergency Lock.
