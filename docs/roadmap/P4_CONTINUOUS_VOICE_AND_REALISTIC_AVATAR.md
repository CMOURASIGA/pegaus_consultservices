# P4 — Conversa contínua e presença realista | checkpoint local

## Princípio
O Pegasus continua sendo uma IA pessoal única, com autenticação e autorização próprias, e não importa um framework de terceiros como autoridade. Interação conversacional não equivale à autorização de ações consequenciais.

## Entrega implementada neste checkpoint
- A abertura intencional da rota de voz inicia uma sessão de captura, sujeita às permissões do navegador.
- O envio da fala continua automático por pausa de silêncio via VAD existente, sem clicar em Enviar.
- Após a fala sintetizada terminar, a captura reinicia somente se a sessão não foi encerrada.
- Encerrar/voltar cancela a captura, reprodução e solicitações e impede reinícios posteriores.
- Os textos da tela explicitam envio por pausa e controle manual alternativo.

## Limites de segurança e qualidade
- O usuário precisa navegar intencionalmente para a conversa por voz; não ativar microfone na Home após login silenciosamente.
- Não ativar câmera, wake word, execução de comando ou automações.
- O VAD atual baseado em energia não distingue sempre ruído, fala e pausa reflexiva. A prova técnica seguinte deve medir falso disparo, palavras cortadas e latência em pt-BR, comparando soluções como WebRTC VAD, open-gpt-live, Pipecat, LiveKit e voxturn antes de integrá-las.
- Avaliar áudio em dispositivos reais, permissão do navegador, troca de aba, áudio TTS indisponível e sessão longa.
- O retorno à escuta automática não significa que a conversa ficou sempre ativa: a sessão termina ao encerrar ou sair da rota.

## Avatar realista
- Há uma referência fotográfica pessoal na documentação de origem, mas **a foto não foi copiada** para a aplicação nem para o arquivo de distribuição.
- Registrar apenas asset derivado expressamente aprovado e devidamente licenciado. Aparência não autoriza ações, não faz reconhecimento facial e não cria biometria.
- POC: comparar TalkingHead (GLB + visemas em pt-BR), talking-avatar browser, LivePortrait/MuseTalk; estes últimos podem exigir GPU e servidor persistente. A solução visual deve funcionar offline com fallback leve sem depender de GPU.
- Atualizar `DigitalPresenceAsset` para manifesto versionado, validação e revogação somente após aprovação da imagem final. Não substituir o placeholder por uma foto original.

## Critérios de aceite faltantes
1. Revalidar Memory E2E, Histórico, TOTP e Quality.
2. Em uma sessão de voz, três turnos consecutivos sem envio manual; detectar silêncio de maneira consistente.
3. A sessão encerra de fato após Encerrar, Voltar e logout; não recaptura áudio indevidamente.
4. Interrupção da fala do Pegasus, concorrência de requests e desconexão sem duplicar mensagens.
5. Avatar personalizado aprovado, privado, responsivo, com fallback e acessibilidade.
6. CI completo lint, typecheck, testes, build, secret scan, audit antes de qualquer merge.

## Origem das referências
- https://github.com/study8677/open-gpt-live
- https://github.com/alitalari/webrtc-ai-voice-agent
- https://github.com/pipecat-ai/pipecat
- https://github.com/livekit/agents
- https://github.com/met4citizen/TalkingHead
- https://github.com/PunithVT/ai-avatar-system

Licenças e dependências precisam ser auditadas no commit específico antes de qualquer código de terceiro entrar no Pegasus. Nenhum código desses projetos foi copiado nesta entrega.
