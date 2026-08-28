# Pegasus Device Agent & Device Gateway

## Objetivo
Permitir que Pegasus não apenas seja acessado de qualquer máquina, mas também consiga trabalhar em dispositivos explicitamente autorizados, sempre sob menor privilégio, escopo de sessão, Decision Guard e auditoria.

Pegasus permanece cloud-first. O dispositivo local é uma extensão controlada de capacidades, não o local onde a identidade/memória principal do Pegasus reside.

## Arquitetura

```text
Pegasus Cloud
   |
   +-- Pegasus Core
   +-- Context/Memory
   +-- Tasks
   +-- Decision Guard
   +-- Device Gateway
          |
          +-- Web Client
          +-- Device Agent Windows
          +-- Mobile/PWA
          +-- future agents/devices
```

## Device Gateway
O Device Gateway é o serviço cloud responsável por mediar comunicação segura entre Pegasus Core e dispositivos autorizados.

Responsabilidades:
- registrar dispositivos;
- estabelecer sessão autenticada e criptografada;
- expor capabilities disponíveis;
- aplicar policy/authorization antes de encaminhar comandos;
- registrar heartbeat/online status;
- receber resultados estruturados;
- revogar acesso imediatamente;
- controlar versão mínima do Agent;
- impedir comandos fora do contrato;
- manter trilha de auditoria.

O Core não deve possuir acesso direto irrestrito ao sistema operacional.

## Device Agent
Aplicativo local leve, inicialmente priorizado para Windows, responsável por oferecer Tools locais ao Pegasus.

Capacidades possíveis:
- device/status;
- filesystem em diretórios autorizados;
- screen context sob comando;
- câmera/microfone conforme permissão;
- clipboard sob permissão;
- notificações locais;
- abertura de aplicação/arquivo quando autorizado;
- browser context/automation quando tecnicamente permitido;
- terminal/command runner restrito;
- informações de ambiente de desenvolvimento;
- futuro suporte a automação de aplicações específicas.

## Níveis de atuação
Toda sessão/dispositivo deve operar em nível explícito:

### OBSERVE
Pegasus pode receber contexto autorizado, sem modificar a máquina.

### ASSIST
Pegasus observa, analisa e recomenda, mas não executa mudanças locais relevantes.

### ACT
Pegasus pode executar Tools previamente autorizadas dentro de escopos definidos.

### ELEVATED
Ação sensível ou administrativa exige confirmação forte/step-up e nunca deve ser concedida implicitamente.

## Capabilities e menor privilégio
Permissões devem ser granulares. Exemplo conceitual:

```text
filesystem:
  Downloads: READ
  Documents: READ_WRITE
  Projects: READ_WRITE
  C:\Windows: DENY

screen:
  capture_on_request: ALLOW
  continuous_capture: DENY

terminal:
  safe_dev_commands: ALLOW
  package_install: APPROVAL
  admin/root: STRONG_APPROVAL
```

Permitir uma capability não implica todas as operações da mesma categoria.

## Screen Context
Usuário pode solicitar "Pegasus, olha minha tela". O Agent captura somente o contexto autorizado e envia ao Vision/Multimodal pipeline.

Fluxo:

```text
Screen -> Device Agent -> Screen Context Sanitizer -> Vision Gateway -> Context Engine -> Pegasus
```

O sistema deve minimizar captura, permitir seleção de monitor/janela quando possível e evitar armazenamento de screenshot salvo sem necessidade.

## Trabalho local
Exemplos de tarefas possíveis em máquina autorizada:
- localizar e ler arquivo;
- abrir projeto;
- executar testes;
- inspecionar logs;
- abrir aplicação;
- preparar alteração;
- executar comando permitido;
- acompanhar build;
- coletar contexto da tela;
- notificar resultado.

Ações irreversíveis, administrativas, destrutivas ou de impacto externo devem seguir Decision Guard e política de aprovação.

## Dispositivos não confiáveis
Em máquina desconhecida sem Device Agent, Pegasus continua funcional via Web/PWA, mas com capabilities locais reduzidas.

Disponível tipicamente:
- chat;
- voz;
- câmera mediante consentimento;
- upload/download controlado pelo navegador;
- integrações cloud;
- memória/contexto cloud;
- tarefas cloud.

Não disponível por padrão:
- filesystem amplo;
- terminal;
- controle do SO;
- abertura arbitrária de aplicações;
- privilégios administrativos.

## Registro e confiança do dispositivo
Device Agent deve possuir processo explícito de pairing/registro com conta Pegasus, preferencialmente aprovado por smartphone raiz de confiança/Passkey.

Registrar:
- device_id;
- nome amigável;
- OS/versão;
- Agent version;
- trust level;
- capabilities;
- escopos concedidos;
- última atividade;
- estado online;
- chaves/certificados públicos necessários;
- revogação.

Segredos privados nunca devem ser expostos ao modelo.

## Segurança do canal
Requisitos mínimos:
- TLS;
- autenticação mútua ou mecanismo equivalente por dispositivo;
- chaves rotacionáveis;
- comandos assinados/nonce/idempotency quando aplicável;
- proteção contra replay;
- expiração de comandos;
- allowlist de Tools;
- validação de argumentos no Agent;
- timeout;
- rate limiting;
- revogação imediata.

## Terminal
Terminal é capability de alto risco e deve ser restrito.

Implementação V1 deve priorizar comandos de desenvolvimento e diagnóstico explicitamente permitidos. Não fornecer shell administrativo genérico ao modelo.

Sempre registrar:
- comando normalizado;
- diretório de trabalho;
- usuário do SO;
- exit code;
- duração;
- saída sanitizada;
- aprovação associada quando exigida.

## Continuidade de Tasks
Tarefas do Pegasus pertencem ao backend, não à janela do navegador.

Se uma Task depender do dispositivo e este ficar offline, usar estado/subestado equivalente a `WAITING_DEVICE` sem perder progresso.

Quando o Device Agent retornar online e a policy continuar válida, a Task pode ser retomada de forma segura.

Nunca manter execução local indefinida sem lease/heartbeat e limites de segurança.

## Reuniões
Device Agent pode servir como fonte local para Meeting Mode, fornecendo câmera, microfone, screen context e notificações discretas ao condutor.

Integrações profundas com Teams/Meet/Zoom devem respeitar APIs/termos das plataformas e podem evoluir separadamente. A V1 pode operar pelo dispositivo sem exigir bot nativo de cada plataforma.

## V1
Implementar na V1:
- Device Gateway básico;
- Device Agent Windows mínimo;
- pairing/revogação;
- heartbeat/status;
- capabilities registry;
- Screen Context sob comando;
- filesystem restrito a diretórios autorizados;
- notificações locais;
- câmera/microfone integrados às políticas existentes;
- command runner restrito para diagnóstico/desenvolvimento;
- Device Tools integradas ao Decision Guard;
- auditoria;
- WAITING_DEVICE/retomada segura de Tasks.

Fora da primeira entrega:
- controle irrestrito do SO;
- shell/root autônomo;
- automação universal de qualquer aplicação;
- keylogging;
- captura contínua silenciosa de tela;
- instalação automática em máquina de terceiros;
- persistência oculta;
- bypass de controles corporativos/MDM/EDR;
- bot nativo completo para todas as plataformas de reunião.

## Critérios de aceite
- dispositivo só pode executar comando após pairing válido;
- capability não concedida é negada;
- revogação impede novas execuções;
- Device Agent não concede privilégio novo ao Pegasus por conta própria;
- tela é capturada apenas quando policy permitir;
- filesystem respeita escopos;
- terminal V1 não é shell administrativo irrestrito;
- cada execução relevante é auditável;
- Task aguarda e retoma quando dispositivo fica offline/online sem duplicar ação;
- Agent continua seguro quando backend está indisponível, falhando fechado para novas ações;
- dispositivo público sem Agent permanece utilizável via Web com capacidades locais limitadas.
