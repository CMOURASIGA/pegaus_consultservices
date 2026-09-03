# Pegasus

Assistente pessoal e profissional privado da Consult Services. Este repositório é spec-driven. Leia [DEV_START_HERE.md](DEV_START_HERE.md) antes de implementar funcionalidades.

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
- conteúdo sensível não deve ser registrado em logs;
- migrations automatizadas permanecem desabilitadas até a reconciliação descrita no checklist Supabase.

## Docker

```bash
docker build -t pegasus .
docker run --rm -p 3000:3000 --env-file .env.local pegasus
```

O build usa a saída standalone do Next.js e executa com usuário não-root.
IA da Consult Services
