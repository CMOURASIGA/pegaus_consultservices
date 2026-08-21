# Pegasus Voice Architecture

## Objetivo
Voz é requisito da V1 e deve funcionar como canal nativo do mesmo Pegasus Core, não como assistente separado.

## Conversação full-duplex
A experiência deve permitir conversa natural com interrupção. Enquanto Pegasus fala, Christian pode começar a falar. O sistema deve interromper/suspender a saída de voz, escutar, compreender a nova informação, incorporá-la ao contexto, reavaliar o raciocínio quando necessário e continuar a conversa.

Interrupção não equivale necessariamente a cancelar a tarefa. Pode representar correção, complemento, mudança de restrição ou nova pergunta.

## Turn-taking
Pegasus deve utilizar detecção de atividade de voz/silêncio para inferir término de fala sem exigir botão a cada turno, mantendo opção de controles explícitos quando úteis.

## Pipeline conceitual
Áudio -> detecção de fala -> speech-to-text/streaming understanding -> Core/Memory Retrieval/AI Router -> resposta -> text-to-speech streaming.

O pipeline deve suportar cancelamento rápido do áudio de saída quando o usuário interromper.

## Continuidade entre canais
Texto e voz compartilham a mesma conversa, contexto, memória, Tools, Decision Guard e políticas. Christian pode começar no smartphone por voz e continuar digitando no computador sem criar uma identidade paralela do Pegasus.

## Voz do Pegasus
A voz deve ser consistente e configurável dentro das capacidades do provedor escolhido. A arquitetura não deve acoplar o Core a um único fornecedor de STT/TTS/realtime.

## Wake word
Ativação por palavra como "Pegasus" pode ser considerada futuramente, especialmente em smartphone/dispositivo pessoal. Não é requisito obrigatório do primeiro backend e deve respeitar limitações de plataforma, bateria e privacidade.

## Segurança
Comandos por voz não eliminam autenticação, permissões ou step-up. Ações críticas continuam sujeitas ao Decision Guard e confirmação autenticada apropriada.
