# Pegasus Integration Standard

## Princípio
Toda integração externa deve seguir um contrato comum de autenticação, capacidades, permissões, aprovação, auditoria e revogação. O Pegasus Core não deve ser redesenhado para cada novo fornecedor.

## Fluxo padrão
Integration -> Authentication -> Capabilities -> Permissions -> Tools -> Approval Policy -> Audit.

## Solicitação de acesso
Quando uma tarefa exigir acesso inexistente, Pegasus deve informar qual integração e qual permissão precisa e solicitar autorização de Christian. Pegasus não pode ampliar seus próprios privilégios.

## Permissões granulares
Permissões devem ser separadas por capacidade. Exemplo Gmail: ler, pesquisar, preparar rascunho e enviar são capacidades distintas. Autorizar leitura não autoriza escrita ou envio.

## Uso proativo
Uma integração autorizada pode ser consultada proativamente dentro das permissões concedidas quando isso for relevante ao objetivo, monitoramento ou Attention Engine. Autorização para consultar nunca implica autorização para alterar.

## Revogação
Christian pode revogar uma integração ou capacidade pelo Control Center ou por comando conversacional ao Pegasus. Quando tecnicamente possível, revogação deve invalidar/remover token ou credencial, não apenas marcar a integração como inativa.

Pegasus deve interromper novos usos, registrar auditoria e confirmar a revogação.

## Credenciais
Tokens, API keys, client secrets e senhas não pertencem à memória, Markdown, prompt ou histórico de conversa. Devem permanecer no Secret Manager ou mecanismo equivalente aprovado. Pegasus conhece a disponibilidade/capacidade da integração sem precisar expor o segredo.

## Falhas
Se uma integração estiver indisponível ou uma consulta falhar, Pegasus deve informar que a análise está incompleta quando a fonte for material para a resposta. Nunca deve inventar resultado ausente.

## Acesso temporário
Deve ser possível conceder autorização lógica limitada a uma tarefa, sessão ou período. Ao expirar, novas operações ficam bloqueadas e o estado é auditado.

## Menor privilégio
Cada integração recebe somente as permissões necessárias. Skills e automações herdam apenas as capacidades explicitamente autorizadas das Tools que utilizam.

## Integrações iniciais
- Google Drive;
- Gmail;
- Google Calendar;
- GitHub;
- pesquisa Web e arquivos fornecidos ao Pegasus conforme políticas específicas.

Integrações futuras como Vercel, Supabase, WhatsApp e sistemas próprios deverão aderir ao mesmo padrão.

## Auditoria mínima
Registrar integração, capacidade utilizada, data/hora, finalidade/tarefa, resultado, aprovação quando aplicável, identidade/sessão e evento de concessão/revogação.
