# Auditoria do repositório e direcionamento

Atualizado em 2026-10-20.

## Conclusão

O projeto está no caminho correto para uma IA pessoal operacional privada. A base já implementa Core/AI Router, autenticação, Web/PWA, texto, voz, multimodalidade, memória/contexto, Home, Capability Routing e Weather com continuidade multi-turn. O maior problema encontrado não era ausência de arquitetura, mas o fato de o `main` publicado conter somente um README enquanto o estado funcional estava espalhado em branches remotas.

A direção foi ajustada para o objetivo informado pelo proprietário: o Pegasus terá uma presença holográfica visualmente inspirada no rosto do proprietário. Isso será feito como asset digital aprovado, sem reconhecimento facial, biometria ou autorização por aparência.

## O que foi consolidado

- o estado mais avançado de `feat/p2-pegasus-digital-presence`, incluindo o trabalho de P2.1, foi promovido para `main`;
- o README passou a explicar o estado real, os limites de segurança e o próximo checkpoint;
- a regra de continuidade multi-turn foi mantida como requisito central;
- um teste que expirava conforme o relógio real foi tornado determinístico, evitando falso vermelho na validação do P2.1;
- a documentação foi indexada e passou a distinguir implementação, validação humana e roadmap futuro.

## Gaps que permanecem

### Prioridade 0 — validação do que já existe

1. Publicar Preview e executar a Human Validation de P2.1 na mesma Conversation: pergunta sem localidade, resposta com localidade, follow-up de data, troca de localidade e `Nova conversa`.
2. Executar a cerimônia real de TOTP antes do go-live.
3. Validar Supabase, OAuth do Drive e documento real somente quando houver autorização específica.
4. Manter P3, integrações consequenciais e Device Agent bloqueados até os checkpoints correspondentes.

### Prioridade 1 — identidade visual personalizada

1. Aprovar a linguagem visual do avatar e seus limites: estilizado, holográfico, reconhecível como Pegasus e não um deepfake.
2. Produzir um asset 2D ou composição pré-renderizada a partir da referência autorizada.
3. Implementar manifesto, validação, hash, revogação, rollback e fallback.
4. Integrar o asset ao `DigitalPresence` já existente e validar desktop, mobile/PWA, light/dark, reduced motion e falhas de carregamento.

A spec completa está em `docs/roadmap/P3_PERSONALIZED_HOLOGRAPHIC_AVATAR.md`, e o contrato técnico em `docs/architecture/PERSONALIZED_AVATAR_ASSET_PIPELINE.md`.

### Prioridade 2 — capacidades operacionais

Depois da validação cognitiva e visual, avançar em blocos verticais e independentes: briefing/Attention, Notification Gateway, Tasks, Decision Guard, Device Agent e integrações externas. Cada ação de impacto deve continuar exigindo capability grant, política, approval quando aplicável, execução idempotente e auditoria.

## Decisões que não devem ser revertidas

- Memory não substitui Conversation Working Context;
- conteúdo externo e saída do modelo são não confiáveis e não elevam autoridade;
- Live Information permanece efêmera e com provenance/freshness;
- não iniciar microfone ou câmera silenciosamente;
- não usar aparência, face match ou liveness como autenticação crítica;
- não colocar foto de referência, embedding, token ou segredo no GitHub;
- não avançar para uma coleção de integrações desconectadas antes de consolidar o Capability Registry.

## Evidência local da validação

- `npm run lint` passou;
- `npm run typecheck` passou;
- `npm test` passou: 34 arquivos e 167 testes;
- `npm run build` passou;
- `npm run security:secrets` passou.
