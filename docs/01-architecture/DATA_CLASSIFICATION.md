# Data Classification

## Objetivo
Classificar dados para determinar armazenamento, envio a modelos, logging, compartilhamento e exigência de aprovação.

## Classes iniciais
### PUBLIC
Informação que pode ser publicamente conhecida ou compartilhada sem impacto relevante.

### INTERNAL
Informação de uso interno que não deve ser publicada automaticamente.

### CONFIDENTIAL
Informação privada de projetos, clientes, trabalho ou vida pessoal cujo compartilhamento exige necessidade clara.

### SENSITIVE
Dados pessoais, documentos, contratos, valores, identificadores e outras informações cujo vazamento pode causar impacto relevante.

### SECRET
Credenciais, tokens, API keys, senhas, recovery material e equivalentes. Não devem entrar em memória, prompts, Knowledge Store ou logs.

## Classificação automática
Pegasus pode sugerir/classificar conteúdo automaticamente. Classificação inferida deve permanecer corrigível por Christian.

## Minimização
Antes de enviar conteúdo a um modelo externo, recuperar somente o necessário e, quando possível, remover ou mascarar campos que não contribuam para o objetivo.

## Contexto
A classificação deve considerar conteúdo e contexto. Um dado aparentemente simples pode tornar-se sensível quando combinado com outros dados.

## Logging
CONFIDENTIAL e SENSITIVE não devem ser duplicados integralmente em logs sem justificativa técnica explícita. SECRET nunca deve ser logado.

## Retenção
Políticas de retenção deverão ser configuráveis por classe e tipo de registro conforme evolução do produto.
