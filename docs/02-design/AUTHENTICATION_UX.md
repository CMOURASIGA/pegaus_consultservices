# Authentication UX - Pegasus

## Objetivo

Definir a experiência principal de autenticação do Pegasus, com foco em uso seguro em computadores próprios ou desconhecidos.

## Fluxo principal

O acesso preferencial deverá utilizar QR Code + autorização pelo celular.

```text
Navegador
   ↓
/login
   ↓
QR Code temporário
   ↓
Celular do proprietário
   ↓
Confirmação da tentativa
   ↓
Biometria / autenticação forte
   ↓
Sessão liberada no navegador
```

## Regras do QR Code

- QR Code representa uma solicitação temporária de sessão, nunca senha ou segredo permanente.
- Expiração curta, recomendação inicial: 60 segundos.
- Após expirar, o frontend deve gerar nova solicitação.
- O navegador deve exibir estado `Aguardando autorização`.
- A autorização deve mostrar no celular dados suficientes para reconhecimento da tentativa, como navegador, sistema, horário e localização aproximada quando disponível.

## Computador público

O login deve permitir marcar `Este dispositivo não é meu`.

Nesse modo:
- sessão curta por padrão;
- não lembrar dispositivo;
- evitar persistência local desnecessária;
- ocultar dados sensíveis quando possível;
- facilitar logout imediato;
- permitir encerramento remoto pelo celular ou Control Center.

## Autenticação secundária

Authenticator TOTP será mecanismo de contingência e segundo fator, não o fluxo principal.

Também devem ser previstos:
- recovery codes;
- passkey de recuperação;
- chave física FIDO2 opcional no futuro.

## Estados da tela

- aguardando leitura do QR Code;
- aguardando autorização;
- autorizado;
- negado;
- expirado;
- erro de comunicação;
- sessão encerrada.

## Segurança

- Nenhum segredo permanente deve ser incorporado ao QR Code.
- Tentativas devem ser registradas para auditoria.
- Aprovação deve estar vinculada à solicitação específica.
- Tokens de sessão devem ser revogáveis imediatamente.
