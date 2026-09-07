# Execution Subcheckpoint 4C: VOICE INTERACTION READY

## Unidade concluída tecnicamente

Sprint 4C: experiência inicial de voz no Chat com captura explícita, providers desacoplados e funcionamento sem API paga.

## Origem

- branch: `develop`;
- checkpoint anterior: `MULTIMODAL INPUT READY`;
- commit de origem: `563c50dd8f2a784e3649689fc6ba9a2e90c2d4d3`;
- aprovação para continuidade recebida do proprietário;
- Issue: #5.

## Funcionalidades

- botão de voz integrado ao composer;
- solicitação explícita de permissão do microfone;
- captura por `MediaRecorder` atrás de `VoiceCaptureAdapter`;
- estados idle, requesting permission, listening, processing, speaking, cancelled e error;
- mensagens acessíveis para cada estado;
- conclusão e cancelamento manual da gravação;
- interrupção da fala do Pegasus ao iniciar novo turno;
- fake STT determinístico, sem credencial e sem custo;
- TTS do navegador quando disponível;
- fallback para resposta visual quando TTS estiver indisponível;
- transcrição enviada pelo mesmo fluxo autenticado do Chat;
- integração com conversas e persistência textual já existentes;
- experiência preparada para desktop e mobile.

## Privacidade e segurança

- o áudio fica somente em memória durante o turno;
- o áudio não é persistido em Storage, banco, logs ou fixtures;
- nenhuma chamada externa de STT foi adicionada;
- nenhuma API key ou service role chega ao navegador;
- permissão de microfone limitada a `self`;
- câmera e geolocalização continuam bloqueadas;
- comandos por voz não contornam Permission, Policy, Decision Guard ou Approval;
- saída do modelo continua não confiável;
- wake word, biometria vocal e captura contínua não foram implementados.

## Providers de validação

- captura: `browser-media-recorder`;
- STT: `pegasus-fake-stt`;
- TTS: `browser-speech-synthesis`;
- IA: `pegasus-fake`.

Nenhum provider pago foi ativado. O fake STT confirma o fluxo técnico e não afirma reconhecer o conteúdo real falado.

### Extensão autorizada para validação humana

O proprietário cadastrou uma chave exclusivamente no ambiente Preview e autorizou a validação da compreensão do áudio. A implementação passou a oferecer transcrição real server-side com `gpt-transcribe`, limitada a 60 segundos por turno e sem retry automático. Após o usuário encerrar a gravação, o texto reconhecido é enviado automaticamente e permanece visível no balão `Você`. O AI Router continua usando `pegasus-fake`, portanto somente a transcrição pode gerar consumo.

Após nova validação humana apontar a dependência do segundo toque, a Issue #5 foi reaberta e o VAD local foi incorporado: depois de detectar fala seguida de aproximadamente 1,5 segundo de silêncio, a captura termina e segue automaticamente para transcrição e envio. O segundo toque permanece como alternativa manual.

## Validações automatizadas

- contracts independentes de captura, STT e TTS;
- transcrição fake determinística e sem credencial;
- cancelamento antes da transcrição;
- microfone ausente;
- permissão negada sanitizada;
- TTS indisponível com fallback visual;
- Permissions Policy restrita;
- estados e labels críticos no componente;
- todos os testes anteriores contra regressão;
- lint, typecheck, build, dependency audit e secret scan.

## Validação humana pendente

No Preview HTTPS, o proprietário deve testar:

1. permissão concedida e negada;
2. início e fim da captura;
3. envio da transcrição fake;
4. resposta visual e falada quando suportada;
5. interrupção da fala;
6. cancelamento;
7. desktop e smartphone.

Esses testes reais de hardware não são declarados como aprovados antes da execução humana.

## Pendências de go-live

- selecionar providers reais de STT/TTS com análise de custo e privacidade;
- streaming e VAD para full-duplex natural;
- cerimônia real de login e enrollment/challenge/verify TOTP;
- política definitiva de retenção de áudio, caso gravação futura seja autorizada.

## Estado e próxima decisão

A Issue #5 permanece aberta até a validação humana do 4C e o checkpoint final da Sprint 4. Nenhuma unidade posterior deve ser iniciada antes dessa validação.
