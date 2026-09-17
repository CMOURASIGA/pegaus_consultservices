# P2 - Digital Presence + Capability Routing Ready for Human Validation

Data: 2026-09-17.

## Checkpoint

`P2 - DIGITAL PRESENCE + CAPABILITY ROUTING READY FOR HUMAN VALIDATION`

## Digital Presence

- Home, Voice, Memória, Histórico e Knowledge preservam o shell unificado;
- presença central preparada para receber o asset oficial sem acoplar partículas, glow, profundidade e transições ao placeholder;
- estados reais `ready`, `listening`, `processing`, `speaking`, `error` e `offline`;
- estados `working` e `approval_required` reservados semanticamente, sem simulação;
- formação não bloqueia dados reais;
- light/dark, desktop, mobile/PWA e reduced motion preservados;
- Voice continua exigindo gesto explícito antes da primeira captura;
- TTS naturalizado e transcript original no histórico preservados.

## Capability Routing

- `CapabilityRegistry` genérico com descriptor, categoria, schemas, provider, TTL, provenance, read-only, approval, health e audit metadata;
- seleção semântica estruturada feita contra o catálogo disponível, sem roteamento por palavras-chave;
- output do selector tratado como não confiável e validado contra o Registry;
- capabilities desconhecidas ou consequenciais são recusadas;
- provider substituível por contrato;
- audit mantém correlation id para seleção, execução, rejeição e falha.

## Weather E2E

- Open-Meteo como primeiro provider de Live Information;
- condições atuais, amanhã e data explícita dentro da janela suportada;
- localidade explícita, com falha segura para inexistência e ambiguidade;
- provenance com fonte e URL;
- `observedAt`, `retrievedAt` e `validUntil`;
- resultado expirado ou estruturalmente inválido é recusado;
- informação externa permanece efêmera e não passa pela curadoria automática de Memory;
- falha do provider gera limitação explícita sem resposta inventada.

## Evidência técnica

- lint aprovado;
- typecheck aprovado;
- 158 testes aprovados;
- build Next.js aprovado;
- sem migration;
- sem alteração de RLS ou grants.

## Human Validation

1. Abrir `/` sem sessão e confirmar redirecionamento para `/login`.
2. Autenticar e confirmar entrada em `/app`.
3. Validar Home e navegação para Memória, Histórico e Knowledge, incluindo retorno à Home.
4. Validar Voice: abrir em pronto, iniciar explicitamente, falar, aguardar processamento/TTS e confirmar transcript no histórico.
5. No Chat perguntar: `Qual é a previsão do tempo amanhã no Rio de Janeiro?`.
6. Confirmar resposta atual com fonte e horário de consulta.
7. Perguntar por uma localidade inexistente e confirmar limitação explícita.
8. Confirmar que a consulta meteorológica não aparece como nova memória.
9. Repetir Home e Voice em desktop e mobile/PWA, light/dark e reduced motion quando disponível.

Parar após Human Validation. Não iniciar P3 ou integrações futuras.
