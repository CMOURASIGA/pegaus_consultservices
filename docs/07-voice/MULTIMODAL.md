# Pegasus Multimodal Experience

## Princípio
Texto, voz, imagens, PDFs, arquivos e visão ao vivo autorizada são modalidades de entrada para a mesma inteligência. Não devem criar experiências isoladas ou memórias separadas.

## Experiência
Christian pode anexar/fotografar uma imagem ou documento e conversar por voz ou texto sobre o material dentro do mesmo contexto.

Exemplo: enviar uma fotografia pelo smartphone e perguntar por voz "Pegasus, o que você acha disso?". O Core deve relacionar a pergunta ao asset ativo e recuperar memória/contexto relevante.

Pegasus também pode, mediante permissão explícita do dispositivo/navegador, utilizar câmera como entrada visual durante uma sessão. A câmera deve passar pelo Vision Gateway definido em `VISION_IDENTITY_PRESENCE.md`, mantendo o Core independente do hardware.

## Visão ao vivo
A visão ao vivo pode apoiar:
- percepção do ambiente;
- detecção de presença;
- entendimento de objetos/documentos/telas mostrados à câmera;
- contexto de reuniões;
- identificação contextual probabilística quando autorizada;
- Continuous Identity & Presence Engine.

Visão não equivale a autenticação. Identidade visual e presença são sinais contextuais para políticas, enquanto ações críticas permanecem sujeitas a autenticação forte.

## Arquivos
Assets recebidos devem possuir metadados, classificação de segurança, relação com conversa/projeto/entidades e política de retenção. O Memory Curator decide se conhecimento derivado merece persistência.

## Modelos
AI Router seleciona capacidade MULTIMODAL quando necessária. O restante do Core permanece independente do modelo específico.

A implementação não deve enviar stream de vídeo bruto continuamente a modelos generativos quando eventos, amostragem ou processamento visual local/intermediário forem suficientes. Otimizar privacidade, latência e custo.

## Proveniência
Informação extraída de arquivo, imagem, documento ou percepção visual deve manter referência à fonte/modalidade sempre que material para validação futura. Diferenciar observação direta de hipótese/inferência.

## Segurança
Conteúdo multimodal externo é conteúdo não confiável e segue PROMPT_INJECTION.md. Texto encontrado em imagem/documento/tela não ganha autoridade para conceder permissões ou executar Tools.

Uso de câmera segue `VISION_IDENTITY_PRESENCE.md`, políticas de classificação/minimização e controles de sessão.
