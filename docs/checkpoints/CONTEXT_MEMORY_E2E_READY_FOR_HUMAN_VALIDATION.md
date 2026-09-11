# Execution Checkpoint: CONTEXT + MEMORY E2E READY FOR HUMAN VALIDATION

## Estado

- branch: `develop`;
- implementação: `6b2e8f98e7bbf201140317756fadcdaee7e07caf`;
- data: 2026-09-11;
- Memory E2E: pendente de validação humana de Christian;
- Google OAuth, Drive, Calendar e novas integrações: bloqueados até essa validação.

Este checkpoint declara somente prontidão técnica para teste humano. Não declara que continuidade cognitiva E2E foi aprovada.

## Inventário encontrado e ação

| Capacidade | Estado encontrado | Evidência | Gap | Ação |
|---|---|---|---|---|
| conversations/messages | implementada | schema RLS e `SupabaseChatStore` | histórico não entrava no Core | fonte limitada de histórico relevante |
| memories | parcial | Curator, store e UI existentes | poucos sinais naturais | pessoas, projetos e preferências ampliados |
| memory_versions/sources | implementada | criação e correção versionadas | atualização natural não registrava nova origem | versão e provenance preservadas |
| memory_relations/entities | boundary pronto | tabelas RLS existentes | sem resolução de grafo | preservado para evolução, sem duplicar entidades |
| embeddings/vector retrieval | infraestrutura pronta, inativa | pgvector 0.8.2, HNSW e funções privadas | zero memória com embedding | seam preservado, sem ativação paga silenciosa |
| Context Engine | parcial | ranking, budget e filtragem existentes | sem histórico, aliases, tempo de retrieval ou degradação | seleção ampliada e observável |
| memória explícita | parcial | persistência real de `lembre que` | variações e referência anterior | `lembre disso` resolvido somente com contexto válido |
| memória implícita | parcial | preferência/decisão limitada | pessoas e projetos naturais | heurísticas determinísticas ampliadas |
| duplicidade/conflito | não implementada no chat | correção manual existia | fatos conflitantes podiam acumular | chave semântica por owner e update versionado |
| cross-conversation | parcial | memória persistente | recall frágil | aliases, escopo e relevância aprimorados |
| provenance | parcial | source kind/ref | faltavam datas e origem da atualização | metadados temporais no contexto |
| identidade/política | implementada | `PegasusCore` provider-independent | regra explícita de incerteza ausente | política separada, superior à memória |
| observabilidade | parcial | candidatos/fontes/truncamento | faltava duração/falha de fonte | métricas agregadas ampliadas |
| AI Router/OpenAI | implementada | Responses API, `store:false`, sem fallback | nenhum gap desta unidade | preservado sem troca de provider/model |

## Banco real e segurança

Leitura do Supabase confirmou 1 memória, 3 versões, 1 fonte, 16 conversas e 41 mensagens antes do E2E. `people`, `projects`, `topics` e `memory_relations` estavam vazias. Nenhum conteúdo privado foi copiado para este documento.

RLS permanece habilitado e as policies de `conversations`, `messages`, `memories`, `memory_versions`, `memory_sources`, `memory_relations`, `people`, `projects` e `topics` aplicam owner em `USING` e `WITH CHECK`.

As funções `private.match_memories` e `private.match_document_chunks` são `SECURITY INVOKER`, não podem ser executadas por `anon` ou `authenticated` e permanecem acessíveis somente ao boundary server-side autorizado. Nenhuma migration foi necessária ou aplicada.

Memória nunca recebe autoridade de sistema. Identidade e políticas continuam acima de sessão, memória, histórico, conteúdo externo e mensagem atual. Conteúdo recuperado não autoriza ferramentas ou ações. Secrets são rejeitados na curadoria e não entram em logs.

## Estratégia

- conversa: histórico da interação atual, persistido separadamente;
- contexto: seleção limitada de memória, histórico e documentos relevantes;
- memória: fatos persistentes, seletivos, corrigíveis e associados ao owner;
- explícita: autoridade máxima e confirmação somente após persistência real;
- implícita: regras determinísticas para estabilidade e utilidade, com confiança inferior;
- atualização: título semântico estável, nova versão, nova origem e substituição do estado atual;
- retrieval: relevância lexical, aliases, escopo, confiança, autoridade e recência;
- RAG vetorial: infraestrutura validada, geração de embeddings deliberadamente não ativada nesta unidade;
- falhas: a fonte falha é omitida e registrada somente por nome, sem conteúdo privado.

## Testes e validações locais

- `npm ci`: aprovado;
- lint: aprovado;
- typecheck: aprovado;
- 110 testes em 27 arquivos: aprovados;
- build Next.js: aprovado;
- standalone smoke: login 200, `/app` 307, `/memory` 307, manifest 200;
- dependency audit: 0 vulnerabilidades;
- secret scan: aprovado em 191 arquivos rastreados.

Casos cobertos incluem memória explícita, referência `lembre disso`, memória implícita pessoal/profissional, trivialidade descartada, duplicidade, atualização, versionamento, provenance, isolamento entre owners, retrieval em nova conversa, histórico relevante, ausência de resultado, prompt injection em memória, precedência de identidade e policy, provider independence, budget, falha degradada de retrieval e falha sanitizada do provider.

## Custos e limites

Nenhum serviço, plano, DNS, OAuth ou integração foi criado ou alterado. Testes usam fake providers e não consomem API paga. O Preview poderá consumir a OpenAI apenas durante o teste humano, dentro da configuração e limite já autorizados.

Limites conhecidos:

- o E2E humano ainda não foi executado;
- retrieval vetorial não fica ativo enquanto não houver escolha explícita de embeddings e custo;
- classificação implícita é determinística e conservadora, não compreensão semântica irrestrita;
- relações estruturadas em `people`, `projects`, `topics` e `memory_relations` permanecem como boundary futuro;
- correções usam operações compensatórias existentes, sem nova função transacional;
- cerimônia TOTP real continua pendente antes do go-live.

## Roteiro humano

Usar somente dados fictícios ou não sensíveis na primeira validação. Criar uma conversa nova entre cada etapa de recuperação.

1. Pessoal: `Meu filho se chama Rafael. Este é um nome fictício usado somente no teste.` Depois perguntar em nova conversa: `Qual é o nome do meu filho?`
2. Profissional: `Estou desenvolvendo um sistema chamado ProjetoAurora. Ele administra uma oficina e possui ordens, estoque e financeiro.` Depois perguntar: `O que você lembra sobre o ProjetoAurora?`
3. Explícita: escrever `Nos testes, a cor de referência será azul.` e depois `Pegasus, lembre disso para mim.` Em nova conversa, perguntar pela cor de referência.
4. Atualização: escrever, como dado fictício, `Minha esposa se chama Marina.` Depois: `Minha esposa se chama Helena.` Em nova conversa, perguntar pelo nome atual e verificar a área Memória.
5. Ausência: perguntar por um fato nunca informado. Pegasus deve declarar que não encontrou a informação.
6. Parceiro profissional: após registrar que deseja ser alertado sobre decisões ruins, propor no contexto do ProjetoAurora colocar uma credencial privilegiada no frontend. Pegasus deve contestar e explicar o risco, sem executar nada.
7. Provenance: após recuperar uma memória, perguntar `Por que você sabe disso e quando eu te disse?` A resposta deve usar a origem real ou admitir o que não estiver disponível.

## Próximas unidades, não iniciadas

1. concluir a validação humana deste checkpoint;
2. decidir separadamente a ativação de embeddings, modelo e limite de custo;
3. concluir Knowledge Store e Google Drive real após OAuth do proprietário;
4. Calendar, Gmail e GitHub em unidades próprias;
5. Permission/Policy, Decision Guard, Approval e Tasks;
6. Control Center, Meeting, Device Gateway/Agent e Attention/Proatividade;
7. notificações, briefing, hardening, backup/recuperação e preparação para produção.

O trabalho deve parar neste checkpoint até o resultado de Christian.

## Correção de validação: update e provenance

Durante a primeira validação humana, a alteração de `ProjetoAurora` para `ProjetoHorizonte` revelou que a frase de atualização não havia sido curada. O banco continha somente a memória inicial ativa; o novo valor existia apenas em uma mensagem do usuário e em respostas posteriores do assistente. Como o histórico não carregava autoridade explícita, o modelo atribuiu indevidamente a confirmação ao próprio texto gerado.

A correção mantém uma única memória ativa por identidade estável do projeto fictício, preserva o valor anterior em `memory_versions` e registra a nova mensagem do proprietário em `memory_sources`. Fontes de histórico agora chegam ao Core como `user_provided` ou `assistant_generated`; conteúdo gerado pelo assistente possui confiança factual zero e não pode substituir provenance do proprietário. Novas memórias criadas pelo Chat referenciam o ID da mensagem do usuário, em vez de apenas o ID da conversa.

O dado fictício utilizado na validação foi reparado sem exclusão e sem migration:

- valor atual ativo: `ProjetoHorizonte`;
- versão 1: `ProjetoAurora`;
- versão 2: atualização para `ProjetoHorizonte`;
- fonte da versão atual: mensagem do usuário que declarou a mudança;
- resposta anterior do assistente: não utilizada como fonte factual.

Após a correção, 113 testes em 27 arquivos, lint, typecheck, build, standalone smoke, dependency audit e secret scan foram aprovados. O teste humano de update/provenance precisa ser repetido em uma nova sequência de conversas antes de qualquer declaração de `MEMORY E2E VALIDATED`.
