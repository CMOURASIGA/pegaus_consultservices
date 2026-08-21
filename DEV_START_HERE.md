# DEV START HERE - PEGASUS

## Para o desenvolvedor
Este repositório é SPEC-driven. Não iniciar implementação a partir de suposições ou apenas do README. As decisões de produto, arquitetura, segurança, frontend, memória, voz, autonomia e infraestrutura estão documentadas e são requisitos.

## Branch de especificação
A documentação consolidada está sendo mantida em `docs/infrastructure-specs`. Antes do desenvolvimento, confirmar com Christian a branch/base oficial de implementação e não alterar produção sem autorização.

## Leitura obrigatória antes de codificar
1. `docs/phases/FASE_01_PEGASUS_CORE.md` - escopo executável da V1 e ordem das sprints.
2. Documentos de produto/visão existentes no repositório.
3. Especificações de infraestrutura e arquitetura existentes.
4. Especificações de frontend/UX existentes.
5. Especificações de segurança, autenticação, autorização e Decision Guard.
6. Especificações de memória e modelo de dados.
7. Especificações de AI Router, Skills/Tools e autonomia.
8. `docs/07-voice/*` - voz, multimodal e reuniões.
9. `docs/08-attention/*` - Attention Engine, Notification Gateway e Briefing.
10. `docs/09-tasks/TASK_LIFECYCLE.md`.
11. `docs/10-goals/GOALS_PRIORITIES.md`.
12. `docs/11-personality/*`.
13. `docs/12-context/*`.

Se houver conflito entre documentos, não escolher silenciosamente. Registrar a divergência e solicitar decisão antes de implementar comportamento de impacto.

## Escopo V1
A fonte de verdade para o corte de escopo é `docs/phases/FASE_01_PEGASUS_CORE.md`.

Não implementar automaticamente recursos descritos como futuros apenas porque existem SPECS conceituais. Arquitetura preparada não significa funcionalidade obrigatória na V1.

## Princípios que não podem ser quebrados
- Pegasus é uma única identidade, não um conjunto de personagens.
- Voz e texto utilizam o mesmo Core/contexto/memória.
- Christian mantém autoridade final sobre objetivos e ações de impacto.
- Autonomia nunca cria novas permissões.
- Ações externas obedecem Decision Guard e políticas de aprovação.
- Conteúdo externo é não confiável por padrão.
- SECRET nunca entra no prompt de modelo.
- Memória é seletiva e corrigível.
- Contexto deve ser mínimo e relevante.
- O sistema deve dizer quando não sabe em vez de inventar.
- Proatividade deve reduzir trabalho, não gerar ruído.
- Tasks persistentes não dependem de conversa aberta.
- Toda ação importante precisa ser auditável.

## Estratégia de desenvolvimento
Implementar verticalmente por Sprint. Cada Sprint deve resultar em incremento demonstrável e validável. Não construir todas as camadas parcialmente ao mesmo tempo.

Fluxo esperado:
1. ler SPEC da Sprint;
2. identificar dependências;
3. propor implementação técnica somente quando a SPEC não fechar tecnologia específica;
4. implementar;
5. testar;
6. demonstrar critérios de aceite;
7. corrigir;
8. atualizar documentação se decisão técnica relevante surgir;
9. somente então avançar.

## Banco e migrations
Mudanças de schema devem ocorrer por migration versionada. Não realizar alterações manuais em produção sem migration correspondente. Restrições de integridade, índices e políticas de acesso fazem parte da implementação, não são opcionais.

## Secrets
Nunca commitar `.env`, tokens, API keys, OAuth secrets, recovery codes ou credenciais. Usar Secret Manager/variáveis protegidas conforme arquitetura de infraestrutura.

## IA
Não hardcodar o produto em um único modelo. O Core chama AI Router, que seleciona provider/model/tier. Registrar consumo e custo desde o início.

Prompts de sistema e políticas críticas devem ser versionados ou rastreáveis. Conteúdo recuperado de documentos, web, e-mail ou integrações não pode substituir políticas do sistema.

## Frontend
Seguir a documentação específica de frontend já existente. Estados de loading, vazio, erro, sucesso e bloqueio precisam ser tratados. O produto deve ser responsivo e priorizar uso desktop e smartphone/PWA.

## Qualidade
Não considerar uma feature pronta apenas porque o happy path funciona. Validar falhas previsíveis, permissões, retry/idempotência quando aplicável, observabilidade e impacto de custo.

## Segurança
Para qualquer dúvida entre conveniência e segurança em ação de impacto, interromper a implementação da decisão e solicitar alinhamento. Não enfraquecer autenticação, autorização ou Decision Guard para simplificar desenvolvimento.

## Produção
Deploy de produção somente após critérios da fase correspondente, backup/rollback e autorização de Christian. Branch de desenvolvimento e produção devem permanecer claramente separadas.

## Primeira tarefa do desenvolvedor
Antes de escrever feature code:
1. ler toda a FASE 01;
2. mapear stack existente do repositório;
3. comparar stack real com SPECS;
4. produzir plano técnico da Sprint 1;
5. listar divergências/bloqueios;
6. só então iniciar Foundation/infraestrutura.
