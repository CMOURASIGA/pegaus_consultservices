# Pegasus Notification Gateway

## Objetivo
Desacoplar o Attention Engine dos canais de entrega e permitir múltiplos meios de notificação com fallback, rastreabilidade e evolução futura.

## Canais iniciais e futuros
Prioridade inicial prevista:
1. Push/PWA/mobile quando disponível;
2. notificações dentro do Pegasus;
3. e-mail como fallback.

Canais futuros podem incluir WhatsApp, Telegram, SMS ou outros serviços, sujeitos a custo, segurança, disponibilidade e autorização.

## Contrato
Attention Engine decide se algo merece atenção e sua prioridade. Notification Gateway decide como entregar de acordo com canais disponíveis, preferências, contexto e política de fallback.

## Estado de entrega
Cada notificação deve permitir estados como queued, sent, delivered quando suportado, seen/acknowledged, failed, retried, resolved e expired.

## Repetição
Eventos IMPORTANT e CRITICAL podem gerar novas tentativas conforme política do Attention Engine. Gateway deve suportar deduplicação e evitar multiplicar mensagens por falhas técnicas.

## Contexto
Notificações devem explicar o suficiente para Christian entender por que está sendo procurado e qual ação é necessária. Conteúdo sensível exibido em lock screen deve ser minimizado conforme configuração e classificação de dados.

## Ações
Quando tecnicamente suportado, notificação pode oferecer ações como abrir Pegasus, revisar Decision Inbox, aprovar/rejeitar ou reconhecer. Ações críticas exigem autenticação/step-up apropriado.

## Falhas
Falha de um canal pode acionar fallback autorizado. Se todos os canais relevantes falharem para evento crítico, registrar incidente operacional e manter tentativa conforme limites definidos.

## Auditoria
Registrar canal, timestamps, resultado, retries e reconhecimento. Não armazenar credenciais de provedores no domínio de notificações.
