# Authentication and Sessions

## Princípio
Pegasus deve utilizar autenticação moderna baseada em Passkeys/WebAuthn como mecanismo preferencial. A biometria deve ser validada pelo autenticador nativo do smartphone ou dispositivo, nunca armazenada ou processada diretamente pelo servidor Pegasus.

## Biometria nativa
O fluxo deve aproveitar recursos já existentes no dispositivo, como Face ID, impressão digital ou PIN seguro do sistema operacional. O dispositivo realiza a verificação local e entrega ao Pegasus uma prova criptográfica WebAuthn.

Pegasus não deve criar banco de dados de rosto, impressão digital ou template biométrico.

## Dispositivo raiz de confiança
O smartphone de Christian será o principal dispositivo confiável para autenticação cross-device, aprovação de novas sessões e step-up authentication de ações críticas.

## Login em dispositivo novo ou público
Fluxo conceitual:
1. acessar Pegasus no navegador;
2. exibir QR Code temporário, de uso único e curta validade;
3. Christian lê o QR Code com smartphone confiável;
4. smartphone apresenta contexto da solicitação;
5. autenticador nativo solicita biometria/PIN;
6. aprovação criptográfica é enviada;
7. Pegasus cria sessão temporária no navegador solicitante.

O QR Code não deve conter segredo reutilizável nem credencial permanente.

## Dispositivo público
Sessões em dispositivo não confiável devem:
- possuir duração e idle timeout reduzidos;
- nunca oferecer confiança permanente/lembrar dispositivo;
- minimizar persistência local;
- destruir/revogar tokens de sessão ao encerrar;
- exigir step-up para ações críticas conforme política;
- permitir encerramento remoto imediato.

Valor inicial sugerido para idle timeout: 30 a 60 minutos, configurável após validação de UX e risco.

## Dispositivo confiável
Dispositivos explicitamente registrados poderão usar Passkey diretamente para login, ainda sujeitos às políticas de sessão e revogação.

## Step-up authentication
Login válido não equivale a autorização ilimitada. Ações críticas podem exigir nova aprovação pelo smartphone e autenticação biométrica nativa imediatamente antes da execução.

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
Registrar, sem armazenar biometria: início/fim de sessão, método de autenticação, dispositivo/navegador quando disponível, confiança do dispositivo, aprovações, revogações, falhas e eventos de recuperação.
