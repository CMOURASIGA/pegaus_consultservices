# Proatividade, Atenção e Aprovação

## Objetivo
Definir como Pegasus deve ser proativo sem ultrapassar a autoridade do proprietário.

## Attention Engine
Componente responsável por avaliar eventos observados e decidir se merecem atenção.

Fluxo conceitual:
1. detectar evento;
2. identificar origem e contexto;
3. avaliar relevância para Christian;
4. classificar urgência e impacto;
5. decidir entre ignorar, registrar, incluir em briefing ou notificar;
6. quando aplicável, preparar recomendação e encaminhar à Decision Inbox.

O Attention Engine deve evitar excesso de notificações. Volume não equivale a relevância.

## Decision Inbox
Fila persistente de assuntos que precisam de conhecimento ou decisão humana.

Categorias iniciais:
- crítico ou precisa de decisão;
- recomenda atenção;
- informativo.

Cada item deve guardar origem, contexto, motivo da relevância, recomendação do Pegasus, ação proposta, estado da aprovação e trilha de auditoria.

## Human Approval
Quando uma ação exigir autorização, Pegasus deve apresentar antes da execução:
- o que aconteceu;
- por que chamou atenção;
- o que pretende fazer;
- efeitos esperados;
- dados ou sistemas afetados quando aplicável.

Respostas previstas: aprovar, rejeitar, revisar/conversar e adiar.

## Notification Gateway
Camada desacoplada para entrega de notificações e pedidos de aprovação no smartphone. Canais poderão incluir PWA/Web Push, Telegram, WhatsApp, SMS, e-mail ou outros no futuro.

O Core não deve depender diretamente de um fornecedor de notificação.

## Regra de segurança
Ausência de resposta não significa aprovação. Timeout, falha do canal ou usuário indisponível deve manter a ação pendente ou expirar de forma segura.

## Auditoria
Toda aprovação, rejeição e execução deve registrar data/hora, ação, ferramenta, contexto, resultado e identidade/sessão que autorizou.
