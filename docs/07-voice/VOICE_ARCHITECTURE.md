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

## Implementação inicial da Sprint 4C

A primeira implementação usa contratos independentes para captura, STT e TTS. No ambiente de validação:

- `BrowserVoiceCapture` solicita permissão somente após ação explícita e captura com `MediaRecorder`;
- o áudio permanece em memória, não é persistido e é descartado ao final do turno;
- `FakeSpeechToText` produz uma transcrição determinística, sem credencial ou serviço externo;
- `BrowserTextToSpeech` usa a síntese disponível no navegador e mantém fallback visual quando indisponível;
- interrupção cancela a fala sintetizada antes de iniciar uma nova captura;
- o texto resultante percorre o mesmo fluxo autenticado do Chat e do Pegasus Core;
- nenhuma resposta por voz autoriza ação consequencial.

Essa implementação valida UX, estados e boundaries. STT/TTS de produção, streaming full-duplex real, VAD e vozes de fornecedor permanecem dependentes de decisão explícita de provider, privacidade e custo.

## Validação controlada de transcrição real

Após autorização explícita do proprietário, o Preview pode usar `OpenAiSpeechToText` somente no backend. O áudio concluído é enviado por uma rota autenticada, limitado a 10 MB e 60 segundos, transcrito com `gpt-transcribe` e descartado após a requisição. A chave `OPENAI_API_KEY` permanece server-side.

A transcrição é inserida automaticamente como mensagem do usuário no Chat após o encerramento explícito da gravação. O balão `Você` preserva o texto reconhecido para conferência no histórico. Ela não autoriza ações e não ativa um modelo de linguagem pago. A resposta do Chat continua usando o provider fake até nova decisão explícita.

O encerramento pode ocorrer pelo segundo toque ou automaticamente após aproximadamente 1,5 segundo de silêncio posterior à detecção de fala. O VAD local usa apenas o nível do sinal no navegador, não envia áudio adicional e mantém limite absoluto de 60 segundos. O controle manual permanece disponível para ruído ambiente ou falha de detecção.
