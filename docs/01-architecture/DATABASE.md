# Pegasus Database Architecture

## Plataforma
Supabase/PostgreSQL é o banco operacional e Memory Store previsto. A estrutura física deve ser derivada do DATA_MODEL.md e criada por migrations versionadas.

## Diretrizes
- UUID como identificador preferencial para entidades distribuídas, salvo justificativa contrária.
- timestamps com timezone para eventos relevantes.
- foreign keys e constraints para integridade.
- índices derivados dos padrões reais de consulta.
- versionamento/migrations no GitHub.
- nenhum secret em tabelas de domínio.
- vetores/embeddings somente quando a estratégia de retrieval for validada.

## Segurança
Mesmo sendo V1 single-user, projetar autorização explicitamente. RLS deve ser considerada/ativada nas tabelas expostas por APIs do Supabase, com políticas mínimas e service role restrita ao backend confiável.

O frontend não deve possuir service-role key.

## Retenção de conversas
Mensagens não são automaticamente memória permanente. O banco deve suportar ciclo de vida no qual conversa é processada, Memory Curator avalia relevância e o sistema pode manter conteúdo integral, resumo, memórias derivadas ou descartar conteúdo conforme política.

Ordens explícitas de Christian para lembrar têm prioridade conforme MEMORY_ARCHITECTURE.md.

## Histórico e temporalidade
Preferir estruturas versionadas ou eventos append-only para mudanças relevantes. Estado atual pode ser materializado/consultado de forma eficiente, mas alterações não devem apagar silenciosamente evidências necessárias à auditoria e evolução.

## Pessoas e identidade multimodal
O banco deve distinguir pessoa confirmada de observação probabilística. Speaker observations não podem ser tratadas como autenticação. Qualquer armazenamento futuro de voiceprints/biometria exige ADR e revisão específica antes da implementação.

## Documentos
Documentos originais permanecem preferencialmente no Google Drive. O banco guarda metadados, referências, versões, relações e índices necessários à recuperação.

## Embeddings
Embeddings devem possuir referência ao conteúdo de origem, modelo/versão do embedding, data de geração e mecanismo de reindexação. Troca de modelo não deve tornar impossível reconstruir o índice.

## Auditoria
Audit events devem favorecer append-only e registrar ator, sessão, ação, alvo, resultado, timestamp e correlação da execução, sem duplicar conteúdo sensível desnecessariamente.

## Execuções assíncronas
Tasks e runs devem possuir estados explícitos como queued, running, waiting_approval, completed, failed, cancelled e expired conforme aplicável. Retentativas devem ser idempotentes quando possível.

## Custos
AI usage deve permitir agregação por período, provedor, modelo, tier, tarefa e contexto para alimentar o Control Center e alertas de orçamento.

## Backup
Banco segue BACKUP_RECOVERY.md. Migrations e schema versionado no GitHub não substituem backup de dados.

## Performance
O desenho inicial deve privilegiar simplicidade. Particionamento, caches complexos ou otimizações prematuras só entram mediante evidência de necessidade.

## Migrações
Nenhuma alteração estrutural em produção deve depender de edição manual não documentada. Migrations precisam ser reproduzíveis, revisáveis e possuir estratégia de rollback/forward fix quando aplicável.
