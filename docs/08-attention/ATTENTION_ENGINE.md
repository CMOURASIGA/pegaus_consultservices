# Pegasus Attention Engine

## Objetivo
Definir quando Pegasus deve procurar Christian proativamente, quando deve permanecer silencioso e quando deve tentar resolver uma situação autonomamente antes de interrompê-lo.

## Princípio
Atenção é determinada por relevância e impacto, não por volume. Pegasus não deve notificar apenas porque existem muitos eventos. Deve identificar quais eventos realmente merecem atenção.

## Níveis
### INFORMATIVE
Não interrompe. Registra em Activity Timeline e pode entrar em briefing.

### ATTENTION
Pode gerar Decision Inbox e notificação conforme contexto, prazo e rotina.

### IMPORTANT
Notificação direta. Se ignorada e continuar relevante, pode ser repetida de forma controlada.

### CRITICAL
Notificação imediata, inclusive durante período de descanso, com repetição controlada até reconhecimento ou mudança do estado.

## Avaliação contextual
Antes de notificar, Pegasus deve tentar entender:
- por que o evento importa;
- projeto, pessoa, cliente ou assunto relacionado;
- risco e impacto;
- prazo;
- necessidade real de ação humana;
- possibilidade de resolver autonomamente dentro das permissões existentes;
- possibilidade de agrupar eventos relacionados.

## Resolver antes de interromper
Quando estiver autorizado e a ação for segura, especialmente durante descanso, Pegasus deve preferir resolver o problema e registrar o resultado em vez de interromper Christian.

A autonomia executiva continua limitada por Tools, permissões, Decision Guard e políticas de aprovação.

## Rotina e sono adaptativos
Pegasus deve aprender padrões de rotina e provável período de sono/descanso a partir de sinais autorizados e comportamento observado, sem depender exclusivamente de horário silencioso fixo.

O modelo é adaptativo e corrigível por Christian. Inferência de sono não deve ser tratada como certeza absoluta.

Durante provável descanso:
- baixa relevância: guardar para briefing;
- resolvível autonomamente: resolver e registrar;
- importante: notificar para que Christian veja quando possível;
- crítico: notificar imediatamente e repetir de forma controlada.

## Agrupamento
Eventos relacionados devem ser consolidados quando isso reduzir ruído sem esconder urgência. Cinco alertas do mesmo problema podem resultar em uma única notificação contextualizada.

## Aprendizado de relevância
Pegasus pode aprender com comportamento e feedback de Christian quais alertas costumam merecer interrupção. Esse aprendizado é inferido, deve possuir confiança e permanecer corrigível.

## Repetição
Notificações importantes e críticas podem ser repetidas quando ignoradas, mas com limites, backoff e deduplicação para evitar spam. A repetição deve cessar quando o evento for reconhecido, resolvido, perder relevância ou atingir limite de política.

## Auditoria
Registrar classificação, motivo, contexto, canal, envio, reconhecimento, repetição, resolução e aprendizado derivado, sem duplicar conteúdo sensível desnecessariamente.
