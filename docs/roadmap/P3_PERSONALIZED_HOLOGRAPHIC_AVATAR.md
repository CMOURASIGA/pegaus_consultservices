# P3.1 — Avatar holográfico personalizado do proprietário

Atualizado em 2026-10-20.

## Decisão de produto

O objetivo do Pegasus passa a incluir uma presença visual exclusiva, inspirada na aparência do proprietário e apresentada como um avatar digital holográfico. A referência visual fornecida pelo proprietário é usada para orientar uma representação estilizada e autorizada; ela não deve ser tratada como mecanismo de autenticação nem como cópia fotográfica automática.

O avatar representa o **Pegasus com a identidade visual do proprietário**, e não deve sugerir que o sistema é uma pessoa humana, um deepfake ou uma gravação do proprietário. A aparência deve ser claramente digital, holográfica e estilizada, preservando os elementos autorizados de identidade visual sem armazenar ou inferir biometria facial para o funcionamento normal do produto.

Esta especificação substitui a restrição anterior de que a presença final não poderia representar Christian. A restrição contra reconhecimento facial, biometria e autorização baseada em rosto permanece válida.

## Escopo

### Incluído

- avatar 2D ou 3D com traços visuais inspirados na referência aprovada pelo proprietário;
- composição holográfica em azul/ciano, com partículas, profundidade, brilho e estados de presença;
- integração com `DigitalPresenceAsset` sem acoplar o Core a um formato visual específico;
- estados `ready`, `listening`, `processing`, `speaking`, `error` e, quando implementados, `working` e `approval_required`;
- versões responsivas para desktop, smartphone/PWA e telas menores;
- fallback visual funcional quando o asset não puder ser carregado;
- consentimento, versionamento, origem, licença e auditoria do asset.

### Fora de escopo neste checkpoint

- reconhecimento facial do usuário ou de terceiros;
- liveness, face match ou qualquer autorização baseada na aparência;
- criação automática de um clone fotorrealista do proprietário;
- captura contínua de câmera;
- lip-sync realista ou geração de vídeo em tempo real;
- uso da imagem em publicidade, publicação pública ou treinamento de modelo sem autorização separada;
- armazenamento de foto original, embedding facial ou template biométrico no runtime do produto.

## Princípios de segurança e privacidade

1. A aparência do avatar é um asset de apresentação. Ela nunca concede identidade, sessão, permissão ou autorização.
2. Login, passkey/WebAuthn, TOTP, aprovação e Decision Guard continuam sendo as fontes de autoridade.
3. A foto de referência e qualquer derivação devem permanecer fora do Git e dos logs. O repositório guarda apenas o asset final aprovado, sua licença/origem e um manifesto não sensível.
4. O proprietário deve poder revogar uma versão do avatar e selecionar uma versão anterior ou o fallback abstrato.
5. O sistema deve informar quando está usando o avatar personalizado e permitir desativá-lo sem perder chat, voz, memória ou tarefas.
6. Assets gerados por terceiros devem ser revisados antes de entrar no produto. Não aceitar automaticamente uma saída que introduza marca, pessoa ou propriedade visual não autorizada.
7. Acessibilidade e `prefers-reduced-motion` são requisitos. A presença visual não pode ser necessária para compreender uma resposta.

## Arquitetura proposta

O frontend recebe um manifesto versionado, por exemplo:

```json
{
  "id": "pegasus-avatar-owner-v1",
  "kind": "stylized_holographic_likeness",
  "version": 1,
  "source": "owner-approved-asset",
  "origin": "generated-or-commissioned",
  "status": "approved",
  "width": 1024,
  "height": 1024,
  "alt": "Presença holográfica digital do Pegasus",
  "states": ["ready", "listening", "processing", "speaking", "error"],
  "license": "owner-authorized-internal-use",
  "approvedAt": "2026-10-20T00:00:00Z",
  "revokedAt": null
}
```

O contrato deve evoluir para suportar `src`, `poster`, sprites ou um modelo 3D, mas a aplicação deve continuar funcionando com uma imagem estática e com o placeholder atual. A seleção do asset ocorre por configuração controlada, nunca por conteúdo retornado pelo modelo.

A composição visual deve seguir esta ordem:

`asset aprovado -> profundidade/glow/partículas -> estado real da aplicação -> acessibilidade/fallback`

O estado visual deve ser derivado do estado real do chat/voz/orquestração. Não criar botões demonstrativos que simulem processamento, fala ou aprovação.

## Plano de implementação

### P3.1 — contrato e governança

- formalizar o manifesto do asset;
- adicionar validação de dimensões, tipo, tamanho, status e origem;
- impedir caminhos externos não permitidos e conteúdo não aprovado;
- documentar revogação, rollback e fallback;
- criar testes de contrato e acessibilidade.

### P3.2 — asset inicial aprovado

- produzir uma representação estilizada baseada exclusivamente na referência autorizada;
- revisar aparência, legibilidade, proporções e comportamento em fundo claro/escuro;
- publicar somente o derivado aprovado, sem a foto de referência;
- registrar a decisão no checkpoint de Human Validation.

### P3.3 — integração visual

- conectar o manifesto ao `DigitalPresence` existente;
- validar carregamento, responsividade, performance e reduced motion;
- garantir que Home, Chat e Voice usem a mesma identidade visual;
- manter o fallback atual para erro, rede lenta ou dispositivo de baixo desempenho.

### P3.4 — evolução opcional

Somente após a validação do asset inicial, avaliar animações mais ricas, voz sincronizada e modelo 3D. Cada evolução exige orçamento de performance, revisão de privacidade e critérios de desligamento próprios.

## Critérios de aceite

- o avatar aprovado é visualmente reconhecível como uma representação estilizada autorizada pelo proprietário;
- fica evidente que é uma presença digital do Pegasus, não uma transmissão ou deepfake do proprietário;
- nenhuma rota de autenticação ou autorização depende do avatar;
- a foto de referência não aparece no repositório, nos logs, no HTML público ou em prompts de runtime;
- a troca, revogação e remoção do asset funcionam sem migration destrutiva;
- Home, Chat e Voice exibem a mesma presença e preservam o `conversationId`;
- os estados visuais são ligados a estados reais e têm teste de regressão;
- o produto funciona sem o asset, sem câmera e com reduced motion;
- a validação manual cobre desktop, mobile/PWA, light/dark, carregamento lento, falha de asset e logout/login;
- Human Validation do proprietário aprova aparência, linguagem visual e limites de uso antes de qualquer publicação pública.

## Dependências e bloqueios

Este trabalho depende da Human Validation do P2.1 e não deve desbloquear Gmail, Calendar, Device Agent, Web Search geral ou ações consequenciais. A aprovação do avatar não substitui a validação de memória, continuidade de conversa, voz, segurança ou autorização.

## Estado

**Spec criada; implementação do asset personalizado ainda não iniciada.** O código atual já possui o ponto de extensão `DigitalPresenceAsset` e deve ser reaproveitado, evitando uma reescrita do shell.
