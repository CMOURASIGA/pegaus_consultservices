# Pegasus Security and Privacy

## Objetivo
Segurança e privacidade são requisitos estruturais do Pegasus. O sistema terá acesso progressivo a memória pessoal, documentos, e-mail, agenda, GitHub e outras integrações, portanto nenhuma capacidade de IA deve possuir acesso irrestrito a dados ou ferramentas.

## Princípio de propriedade
A memória e os dados privados pertencem exclusivamente a Christian. Provedores de modelos recebem somente o contexto mínimo necessário para executar uma tarefa, conforme política do AI Router e classificação de dados.

## Minimização de contexto
Fluxo esperado:
Memory Store / Knowledge Store -> recuperação orientada ao objetivo -> filtragem/classificação -> contexto mínimo -> AI Router -> modelo.

O modelo generativo não recebe acesso direto ao Supabase, Google Drive ou histórico integral.

## Separação entre modelo e ferramentas
Modelos generativos não executam Tools diretamente. Toda solicitação de ferramenta deve passar por controles determinísticos:
LLM -> Tool Request -> Permission Check -> Policy Engine -> Decision Guard -> Human Approval quando aplicável -> Tool Executor.

## Princípio de autoridade
Nenhum conteúdo recebido pelo Pegasus pode aumentar as permissões do próprio Pegasus. E-mail, documento, PDF, imagem, página Web, memória, modelo generativo ou integração não concedem privilégios.

Somente Christian, por mecanismo autenticado e auditável, pode ampliar permissões.

## Menor privilégio
Serviços, integrações e Tools recebem apenas as permissões necessárias. Permissão de leitura não implica escrita. Autorização de uma integração não implica autorização para qualquer operação disponível naquele fornecedor.

## Secrets
Senhas, tokens, API keys, client secrets e demais credenciais devem permanecer no Secret Manager ou mecanismo equivalente aprovado.

É proibido armazenar secrets em:
- GitHub;
- Markdown;
- memória do Pegasus;
- prompts persistentes;
- logs;
- mensagens de erro exibidas ao usuário.

Devem existir processos de rotação, revogação e auditoria de acesso.

## Auditoria com minimização
Registrar eventos suficientes para rastrear o comportamento sem criar uma segunda cópia desnecessária dos dados privados. Preferir metadados de operação em vez de conteúdo integral.

Exemplos: integração consultada, Tool utilizada, ação aprovada, modelo selecionado, custo, latência, resultado e erro sanitizado.

## Proteção de saída de dados
Antes de transmitir dados para serviço externo, Pegasus deve considerar origem, destino, classificação, finalidade e autorização. Conteúdo externo não pode instruir o sistema a exfiltrar informações.

## Direito de correção e exclusão
Christian deve poder corrigir e solicitar remoção de memórias. Remoção de memória não implica automaticamente exclusão do documento original no Google Drive. Operações destrutivas devem mostrar impacto e exigir confirmação apropriada.

## Defense in Depth
A arquitetura deve combinar autenticação forte, autorização, menor privilégio, isolamento entre componentes, criptografia em trânsito e em repouso quando suportada, rate limiting, validação de entrada, proteção contra replay, observabilidade, backups e controles de emergência.
