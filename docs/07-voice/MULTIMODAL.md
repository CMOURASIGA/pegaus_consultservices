# Pegasus Multimodal Experience

## Princípio
Texto, voz, imagens, PDFs e arquivos são modalidades de entrada para a mesma inteligência. Não devem criar experiências isoladas ou memórias separadas.

## Experiência
Christian pode anexar/fotografar uma imagem ou documento e conversar por voz ou texto sobre o material dentro do mesmo contexto.

Exemplo: enviar uma fotografia pelo smartphone e perguntar por voz "Pegasus, o que você acha disso?". O Core deve relacionar a pergunta ao asset ativo e recuperar memória/contexto relevante.

## Arquivos
Assets recebidos devem possuir metadados, classificação de segurança, relação com conversa/projeto/entidades e política de retenção. O Memory Curator decide se conhecimento derivado merece persistência.

## Modelos
AI Router seleciona capacidade MULTIMODAL quando necessária. O restante do Core permanece independente do modelo específico.

## Proveniência
Informação extraída de arquivo, imagem ou documento deve manter referência à fonte sempre que material para validação futura.

## Segurança
Conteúdo multimodal externo é conteúdo não confiável e segue PROMPT_INJECTION.md. Texto encontrado em imagem/documento não ganha autoridade para conceder permissões ou executar Tools.
