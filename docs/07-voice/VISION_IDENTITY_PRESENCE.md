# Pegasus Vision, Identity & Continuous Presence

## Objetivo
Permitir que Pegasus utilize, mediante autorização, a câmera disponível no gadget/navegador em uso como canal de percepção visual. A visão deve apoiar identificação contextual de pessoas, compreensão do ambiente, continuidade de sessão, reuniões e aplicação dinâmica de políticas de interação.

A câmera não substitui autenticação criptográfica para ações sensíveis.

## Princípio
Pegasus é cloud-first e pode ser acessado de dispositivos diferentes. O dispositivo atual deve ser tratado como interface temporária. Ao acessar Pegasus em uma máquina com câmera, o navegador pode solicitar consentimento para uso da câmera e oferecer percepção visual durante a sessão.

Fluxo conceitual:

Dispositivo -> Camera Permission -> Vision Gateway -> Person Detection -> Identity Resolver -> Presence Engine -> Context Engine -> Authorization Policy -> Pegasus Core

## Vision Gateway
Criar abstração independente do hardware. Fontes futuras podem incluir:
- câmera de notebook/desktop;
- smartphone;
- tablet;
- webcam externa;
- câmera 360;
- smart glasses;
- outros gadgets autorizados.

O Core não deve depender diretamente de API específica de câmera.

## Identificação visual
Quando existir pessoa previamente cadastrada e base legal/consentimento aplicável, o Identity Resolver poderá produzir hipótese de identidade com score de confiança.

Exemplo interno:
- candidate_person_id;
- confidence;
- source=camera;
- liveness_status;
- timestamp;
- device/session;
- evidence metadata.

Reconhecimento é probabilístico. Resultado visual não deve ser persistido como fato absoluto quando a confiança for insuficiente.

## Continuous Identity & Presence Engine
Durante sessão autorizada, Pegasus poderá avaliar periodicamente presença e possível mudança de usuário.

Perguntas centrais:
1. Quem provavelmente está diante do dispositivo?
2. Existe evidência de presença real?
3. A pessoa que iniciou a sessão continua presente?
4. Houve troca de pessoa?
5. Qual informação pode ser exibida ou discutida no contexto atual?
6. A ação solicitada exige autenticação adicional?

## Mudança de pessoa
Se a sessão pertence a Christian e outra pessoa assume fisicamente o dispositivo, o sistema deve poder elevar risco e, conforme política:
- ocultar conteúdo sensível;
- pausar saída de voz contendo informação privada;
- reduzir capacidades;
- bloquear consulta privada;
- solicitar reautenticação;
- encerrar/bloquear sessão em cenário de risco.

Não assumir que login realizado anteriormente garante identidade contínua.

## Identificação não é autenticação
Separar obrigatoriamente:
- `visual_identity`: hipótese de quem é;
- `presence`: evidência de que a pessoa está presente;
- `liveness`: evidência anti-spoofing;
- `authentication`: prova criptográfica de identidade;
- `authorization`: permissão para acessar/executar recurso.

Face match, mesmo com liveness, não deve autorizar sozinho ação crítica.

## Autenticação adaptativa
O Risk/Authorization Engine deve considerar, entre outros:
- sessão atual;
- confiança do dispositivo;
- identidade visual provável;
- liveness;
- continuidade de presença;
- sensibilidade do dado;
- risco/reversibilidade da ação;
- anomalias;
- necessidade de step-up.

Para ações críticas, usar Passkey/WebAuthn e, quando aplicável, smartphone raiz de confiança conforme AUTHENTICATION_SESSIONS.md.

## Pessoas diferentes
Pegasus pode futuramente reconhecer pessoas autorizadas e aplicar relacionamento/permissões específicos. Uma pessoa conhecida não herda permissões de Christian.

Pessoa não reconhecida deve receber experiência pública/limitada ou solicitação de identificação/autorização conforme política. Nunca revelar memória, agenda, documentos, mensagens ou dados privados apenas porque alguém consegue conversar com Pegasus.

## Percepção do ambiente
Vision Gateway pode produzir contexto observável, por exemplo:
- quantidade aproximada de pessoas;
- objetos relevantes;
- tela/apresentação visível;
- quadro branco;
- documento apontado;
- mudança significativa no ambiente;
- pessoa entrando/saindo do enquadramento.

Inferências devem preservar distinção entre observação e hipótese.

## Privacidade e minimização
Câmera deve possuir indicação clara de uso. A arquitetura deve favorecer processamento temporário e extração de eventos/metadados necessários, evitando armazenamento indiscriminado de vídeo bruto.

Gravação persistente exige finalidade, política de retenção e consentimento adequados. Desligar câmera deve ser sempre possível.

## Dados biométricos
A V1 não deve criar autenticação própria baseada em banco biométrico facial. Qualquer evolução de reconhecimento persistente de terceiros exige avaliação específica de privacidade, segurança, consentimento, retenção e legislação aplicável antes de produção.

Templates/embeddings visuais, se futuramente aprovados, devem possuir controles mais fortes que memória comum, criptografia, finalidade explícita, retenção, exclusão e acesso auditado.

## Anti-spoofing
Quando identidade visual influenciar política de sessão, prever liveness/anti-spoofing. Fotografias, vídeos, telas e outros ataques de apresentação não podem ser tratados como presença confiável.

Liveness reduz risco, mas não transforma reconhecimento facial em autenticação forte.

## Auditoria
Registrar eventos relevantes sem armazenar vídeo desnecessariamente:
- camera_permission_granted/denied/revoked;
- presence_started/ended;
- identity_candidate_detected;
- identity_confidence_changed;
- person_change_detected;
- privacy_lock_triggered;
- step_up_requested;
- visual_context_used_for_decision.

## V1
Implementar/preparar na V1:
- contrato Vision Gateway;
- acesso à câmera mediante consentimento;
- percepção visual sob demanda;
- detecção de presença/pessoa;
- integração com Context Engine;
- estrutura do Presence Engine;
- mudança de presença capaz de acionar privacy lock;
- separação formal entre identificação, autenticação e autorização;
- hooks para liveness e Identity Resolver;
- telemetria/auditoria.

Reconhecimento facial persistente de terceiros pode permanecer feature-flagged/preparado até aprovação específica dos controles biométricos.

## Critérios de aceite
- câmera nunca inicia silenciosamente sem permissão;
- Pegasus funciona sem câmera, com capacidades reduzidas quando necessário;
- desligar/revogar câmera interrompe processamento visual;
- troca de pessoa pode gerar privacy lock;
- reconhecimento visual não concede autorização crítica;
- conteúdo visual não pode alterar políticas do Core;
- processamento e retenção são minimizados;
- sistema distingue observação, hipótese e identidade confirmada;
- fluxo funciona em dispositivo não confiável sem persistir dados sensíveis localmente além do necessário.
