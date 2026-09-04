# Human Validation Plan - WEB/PWA + CHAT READY

## Status

Checkpoint 4A aguardando validação visual e funcional do proprietário. A unidade 4B não deve ser iniciada antes do registro desse resultado.

## Estado confirmado

- branch: `develop`;
- checkpoint: `WEB/PWA + CHAT READY`;
- commit do checkpoint: `a73effec0c2855a7e71f5e86c6e01ae5a062a273`;
- CI do checkpoint: verde;
- provider: fake, determinístico, sem API paga;
- Issue #5: aberta.\n- preview HTTPS: projeto Vercel Hobby criado e aguardando deployment da branch `develop`.

## Opção imediata, execução local sem custo

Pré-requisitos:

- Git;
- Node.js 22 ou superior;
- npm 10 ou superior;
- acesso autorizado às três variáveis do ambiente Pegasus.

As variáveis devem ser gravadas somente em `.env.local`, que não é versionado:

```text
NEXT_PUBLIC_SUPABASE_URL=<URL do projeto Pegasus>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<chave privilegiada somente server-side>
```

Procedimento:

```bash
git clone https://github.com/CMOURASIGA/pegaus_consultservices.git
cd pegaus_consultservices
git switch develop
git pull --ff-only
cp .env.example .env.local
npm ci
npm run dev
```

Depois, acessar `http://localhost:3000/login`.

Para testar em um smartphone na mesma rede, iniciar o servidor expondo a interface local:

```bash
npm run dev -- --hostname 0.0.0.0
```

Em seguida, abrir `http://<IP-local-do-computador>:3000/login`. Essa alternativa permite validar responsividade e interação mobile, mas não comprova instalação PWA em todos os navegadores porque o endereço da rede local usa HTTP.

## Opção HTTPS para validar instalação PWA

O Vercel conectado ao proprietário está no plano Hobby, mas atualmente não possui projeto vinculado ao repositório `CMOURASIGA/pegaus_consultservices`.

Para disponibilizar um preview funcional será necessário:

1. criar um projeto Vercel apontando para o repositório e para a branch `develop`;
2. configurar o monorepo para executar o build a partir da raiz;
3. cadastrar no ambiente Preview as três variáveis listadas acima;
4. limitar o acesso ao preview enquanto a validação estiver em andamento;
5. adicionar a URL HTTPS do preview às URLs de redirecionamento autorizadas do Supabase, caso o fluxo utilizado passe a depender de callback absoluto;
6. remover ou manter protegido o preview após a validação.

A criação do projeto não foi realizada automaticamente porque o preview não funcionaria sem credenciais e porque a replicação da chave privilegiada para um novo runtime externo deve ser uma decisão explícita do proprietário. Nenhuma contratação ou alteração de DNS é necessária. O plano Hobby pode atender a esta validação dentro de sua franquia, mas os limites de uso da conta continuam aplicáveis.

## Checklist do proprietário

Registrar `APROVADO`, `REPROVADO` ou `NÃO TESTADO` para cada item:

| Item | Resultado | Observação |
| --- | --- | --- |
| Login com conta autorizada | NÃO TESTADO | |
| Redirecionamento para área autenticada | NÃO TESTADO | |
| Criação de nova conversa | NÃO TESTADO | |
| Envio de mensagem | NÃO TESTADO | |
| Resposta identificável do fake provider | NÃO TESTADO | |
| Histórico após recarregar a página | NÃO TESTADO | |
| Retomada de conversa existente | NÃO TESTADO | |
| Estado de processamento | NÃO TESTADO | |
| Cancelamento | NÃO TESTADO | |
| Retry após falha/cancelamento | NÃO TESTADO | |
| Logout e bloqueio da rota privada | NÃO TESTADO | |
| Layout desktop | NÃO TESTADO | |
| Layout mobile | NÃO TESTADO | |
| Manifesto e instalação PWA em HTTPS | NÃO TESTADO | |

## Evidências recomendadas

- navegador e versão;
- dispositivo e resolução aproximada;
- horário do teste;
- captura de tela somente quando não contiver mensagem sensível;
- passo exato, resultado esperado e resultado observado para cada falha;
- correlation ID exibido em eventual erro, sem copiar cookies, tokens ou credenciais.

## Restrições

- usar apenas conta autorizada;
- não compartilhar senha, TOTP, cookies ou conteúdo de `.env.local`;
- não inserir conteúdo sensível nas conversas de validação;
- não ativar provider real ou fallback pago;
- não marcar itens como aprovados sem execução real.

## Critério para liberar a 4B

A unidade 4B poderá começar somente após o proprietário devolver o checklist com o resultado da validação e os defeitos encontrados terem sido classificados. Aprovação parcial não deve ser tratada como validação completa.
