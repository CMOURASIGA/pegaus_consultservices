# Authentication and Sessions

## Princípio
Pegasus deve utilizar autenticação moderna baseada em Passkeys/WebAuthn como mecanismo preferencial. A biometria de autenticação deve ser validada pelo autenticador nativo do smartphone ou dispositivo, nunca armazenada ou processada diretamente pelo servidor Pegasus como credencial primária.

A percepção visual definida em `docs/07-voice/VISION_IDENTITY_PRESENCE.md` pode contribuir para identificação contextual, presença contínua e avaliação de risco, mas não substitui autenticação criptográfica para ações sensíveis.

## Biometria nativa
O fluxo deve aproveitar recursos já existentes no dispositivo, como Face ID, impressão digital ou PIN seguro do sistema operacional. O dispositivo realiza a verificação local e entrega ao Pegasus uma prova criptográfica WebAuthn.

A V1 não deve criar autenticação própria baseada em banco facial. Qualquer reconhecimento visual persistente futuro é um sinal de identidade/presença e requer controles específicos de privacidade e segurança.

## Dispositivo raiz de confiança
O smartphone de Christian será o principal dispositivo confiável para autenticação cross-device, aprovação de novas sessões e step-up authentication de ações críticas.

## Login em dispositivo novo ou público
Fluxo forte conceitual:
1. acessar Pegasus no navegador;
2. dispositivo pode solicitar câmera para percepção/identificação contextual, se o usuário consentir;
3. identificação visual, quando disponível, produz apenas hipótese/confiança;
4. exibir QR Code temporário, de uso único e curta validade ou iniciar fluxo WebAuthn cross-device equivalente;
5. Christian utiliza smartphone confiável;
6. smartphone apresenta contexto da solicitação;
7. autenticador nativo solicita biometria/PIN;
8. aprovação criptográfica é enviada;
9. Pegasus cria sessão temporária no navegador solicitante.

O QR Code não deve conter segredo reutilizável nem credencial permanente.

## Continuous Identity & Presence
Após autenticação, sessão não deve presumir que a mesma pessoa continuará diante do dispositivo indefinidamente. Quando câmera estiver autorizada, Presence Engine pode detectar ausência/troca de pessoa e elevar risco.

A política pode ocultar conteúdo, pausar voz privada, limitar capabilities, solicitar step-up ou bloquear a sessão. Essa percepção é complementar aos controles tradicionais de sessão.

## Dispositivo público
Sessões em dispositivo não confiável devem:
- possuir duração e idle timeout reduzidos;
- nunca oferecer confiança permanente/lembrar dispositivo;
- minimizar persistência local;
- destruir/revogar tokens de sessão ao encerrar;
- exigir step-up para ações críticas conforme política;
- permitir encerramento remoto imediato;
- utilizar privacy lock quando Presence Engine detectar troca relevante de pessoa, se câmera estiver autorizada.

Valor inicial sugerido para idle timeout: 30 a 60 minutos, configurável após validação de UX e risco.

## Dispositivo confiável
Dispositivos explicitamente registrados poderão usar Passkey diretamente para login, ainda sujeitos às políticas de sessão, presença e revogação.

## Step-up authentication
Login válido ou reconhecimento visual não equivalem a autorização ilimitada. Ações críticas podem exigir nova aprovação pelo smartphone e autenticação biométrica nativa imediatamente antes da execução.

## Autenticação adaptativa
O nível de autenticação requerido pode considerar risco da ação, classificação do dado, confiança do dispositivo, sessão, anomalias e sinais de presença/identidade. Sinais visuais podem aumentar ou reduzir confiança contextual, mas não devem criar privilégio novo.

## Aprovação contextual
Pedidos de aprovação devem informar claramente o que está sendo autorizado. Exemplo: integração, recurso afetado, ação, escopo, quantidade de itens e impacto conhecido.

Aprovação genérica como apenas "Autorizar?" deve ser evitada em ações relevantes.

## Authenticator / TOTP
TOTP compatível com Google Authenticator, Microsoft Authenticator ou equivalente poderá ser mantido como fator de contingência/recuperação, não como experiência principal cotidiana.

## Recovery Codes
Devem existir códigos de recuperação de uso controlado para evitar perda definitiva de acesso caso o smartphone seja perdido, trocado ou fique indisponível. Códigos devem ser armazenados de forma segura, com hash no servidor e possibilidade de revogação/regeneração.

## Kill Switch
Christian deve poder encerrar todas as demais sessões pelo Control Center ou por comando autenticado ao Pegasus. O servidor deve revogar as sessões imediatamente e registrar auditoria.

## Segurança de sessão
A implementação deve prever cookies seguros/HttpOnly quando aplicável, proteção CSRF, rotação/revogação de sessão, expiração server-side, proteção contra replay no fluxo QR e trilha de auditoria de autenticações.

## Auditoria
Registrar, sem armazenar biometria de autenticação: início/fim de sessão, método de autenticação, dispositivo/navegador quando disponível, confiança do dispositivo, aprovações, revogações, falhas, eventos de recuperação e privacy locks/presence changes relevantes.
