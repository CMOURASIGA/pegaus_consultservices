# Pegasus

Assistente pessoal e profissional privado da Consult Services. O objetivo é evoluir para uma IA pessoal operacional, com texto, voz, memória, contexto, capabilities autorizadas e uma presença holográfica visual personalizada. Este repositório é spec-driven. Leia [DEV_START_HERE.md](DEV_START_HERE.md) antes de implementar funcionalidades.

## Estado atual

O `main` contém o estado implementado mais avançado do projeto: fundação, autenticação, Core/AI Router, Web/PWA, chat, voz, memória/contexto, Home, Capability Routing e o E2E de Weather com continuidade multi-turn. O checkpoint P2.1 ainda requer validação humana no Preview.

O avatar inspirado na aparência do proprietário é uma etapa posterior e foi especificado em [P3 — Avatar holográfico personalizado](docs/roadmap/P3_PERSONALIZED_HOLOGRAPHIC_AVATAR.md). A aparência não será usada para autenticação, autorização ou reconhecimento facial.

## Requisitos locais

- Node.js 22 LTS ou superior
- npm 10 ou superior

## Executar

```bash
cp .env.example .env.local
npm ci
npm run dev
```

A aplicação abre em `http://localhost:3000`. O healthcheck fica em `http://localhost:3000/api/health`.

Sem configuração do Supabase, o ambiente de desenvolvimento sobe em estado `degraded`. Em produção, as variáveis públicas obrigatórias ausentes fazem a inicialização falhar de forma explícita.

## Autenticação

A área privada começa em `/login` e utiliza Supabase Auth com sessão SSR em cookies. Para testar login, sessão Pegasus, revogação e TOTP, configure também `SUPABASE_SERVICE_ROLE_KEY` somente no servidor. Consulte [AUTH_SESSION_IMPLEMENTATION.md](docs/02-design/AUTH_SESSION_IMPLEMENTATION.md) para os fluxos, limites e validações externas.

Não use uma conta pessoal em testes automatizados. Senha, token, seed TOTP e códigos temporários nunca devem ser gravados em fixtures, logs ou commits.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Estrutura

```text
apps/web         Web/PWA e API HTTP inicial
packages/core    contratos do Pegasus Core
packages/config  validação de ambiente
packages/logging logs estruturados e redaction
packages/shared  erros e contratos compartilhados
supabase         migrations versionadas
docs             especificações e decisões
```

## Segurança

- nunca adicione `.env`, tokens, senhas ou chaves ao GitHub;
- variáveis `NEXT_PUBLIC_*` são públicas por definição;
- `SUPABASE_SERVICE_ROLE_KEY` é exclusivamente server-side;
- `user_metadata` nunca é usado como fonte de autorização;
- páginas protegidas validam claims, perfil ativo e revogação da sessão Pegasus;
- conteúdo sensível não deve ser registrado em logs;
- migrations automatizadas permanecem desabilitadas até a reconciliação descrita no checklist Supabase.
- referências fotográficas, embeddings faciais e dados biométricos não devem ser commitados, logados ou enviados ao runtime;
- o avatar é apenas apresentação visual e nunca substitui passkey, TOTP, aprovação ou Decision Guard.

## Direcionamento e specs principais

- [Direção de produto — Assistente Pessoal Operacional](docs/roadmap/PRODUCT_DIRECTION_PERSONAL_OPERATING_ASSISTANT.md)
- [P2.1 — Conversation Intelligence + Research Routing](docs/roadmap/P2_1_CONVERSATION_INTELLIGENCE_AND_RESEARCH_ROUTING.md)
- [P3.1 — Avatar holográfico personalizado](docs/roadmap/P3_PERSONALIZED_HOLOGRAPHIC_AVATAR.md)
- [Pipeline seguro de assets do avatar](docs/architecture/PERSONALIZED_AVATAR_ASSET_PIPELINE.md)

## Docker

```bash
docker build -t pegasus .
docker run --rm -p 3000:3000 --env-file .env.local pegasus
```

O build usa a saída standalone do Next.js e executa com usuário não-root.
IA da Consult Services
