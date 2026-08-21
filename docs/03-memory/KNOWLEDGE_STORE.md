# Pegasus Knowledge Store

## Objetivo
Definir a camada de conhecimento documental do Pegasus e sua separação da memória pessoal estruturada.

## Fonte inicial
Google Drive será a fonte documental principal prevista para a V1, aproveitando documentos e arquivos mantidos pelo proprietário sem exigir que todo conteúdo seja copiado para a VM.

## Conteúdos esperados
- Markdown;
- PDF;
- documentos de texto;
- planilhas;
- materiais de projetos;
- referências e arquivos autorizados.

Outros formatos poderão ser adicionados conforme capacidade de extração e análise.

## Princípio de referência
Sempre que possível, o documento original permanece no Drive. Supabase mantém metadados, identificadores, versão/hash, classificação, índices e dados necessários à recuperação. Duplicação integral deve ser evitada sem necessidade técnica.

## Pipeline conceitual
1. detectar ou receber documento autorizado;
2. registrar metadados;
3. extrair conteúdo quando suportado;
4. classificar contexto e escopo;
5. dividir conteúdo para recuperação;
6. criar índice lexical/semântico conforme arquitetura escolhida;
7. relacionar documento a projetos, pessoas, clientes ou assuntos;
8. disponibilizar para recuperação orientada ao objetivo.

## Atualização
Alterações relevantes no documento devem permitir reindexação. O sistema deve evitar tratar versões antigas como atuais sem indicação.

## Recuperação
Pegasus não deve carregar documentos completos automaticamente para toda conversa. Deve recuperar trechos e fontes relevantes para o objetivo atual e expandir o contexto somente quando necessário.

## Rastreabilidade
Quando uma recomendação depender de documento, o Core deve conseguir preservar referência à origem utilizada para permitir validação posterior.

## Segurança
Acesso ao Knowledge Store deve respeitar as permissões concedidas por Christian. Indexar um documento não deve ampliar a autorização original de acesso nem tornar o conteúdo público.
