# Personalized Avatar Asset Pipeline

Atualizado em 2026-10-20.

## Objetivo

Definir como o Pegasus recebe, valida, publica, revoga e utiliza uma presença holográfica personalizada sem transformar semelhança visual em identidade autenticada.

## Boundary

O pipeline de avatar é uma capacidade de apresentação do frontend. Ele não participa de:

- autenticação ou reautenticação;
- seleção de modelo;
- memória, Knowledge ou contexto do usuário;
- Decision Guard, Policy, Approval ou execução;
- reconhecimento facial, liveness ou captura de câmera.

O Core conhece apenas o estado da presença e, no máximo, um identificador de asset aprovado. O conteúdo visual não entra no prompt do modelo.

## Fluxo

`referência autorizada -> produção/revisão -> manifesto -> validação de asset -> publicação privada -> frontend -> revogação/rollback`

A referência original é armazenada somente em local privado controlado durante a produção. O GitHub recebe o derivado final aprovado apenas quando a decisão de licenciamento e retenção permitir. Nenhum arquivo de origem, EXIF, embedding facial ou prompt privado deve ser commitado.

## Manifesto mínimo

```ts
type AvatarAssetManifest = {
  id: string
  version: number
  kind: 'stylized_holographic_likeness' | 'abstract_fallback'
  source: 'owner-approved-asset' | 'product-fallback'
  origin: 'generated-or-commissioned' | 'repository'
  status: 'draft' | 'approved' | 'revoked'
  src: string
  alt: string
  width: number
  height: number
  sha256?: string
  license: 'owner-authorized-internal-use' | 'project-owned'
  approvedAt?: string
  revokedAt?: string
}
```

## Regras de validação

- aceitar somente `https` controlado ou assets locais empacotados;
- rejeitar SVG com script, HTML embutido, URLs remotas não allowlisted e metadados executáveis;
- limitar tamanho, dimensões e formatos para proteger carregamento mobile;
- verificar hash quando o asset vier de storage;
- exigir `status=approved` para produção;
- rejeitar manifesto revogado;
- garantir texto alternativo ou marcar o asset como decorativo de forma explícita;
- disponibilizar fallback quando a validação, rede ou decodificação falhar.

## Observabilidade sem dados sensíveis

Registrar somente `avatar_asset_id`, `version`, `status`, `surface`, `fallback_used`, `duration_ms` e `correlation_id`. Não registrar foto, pixels, prompt de geração, embedding, conteúdo de câmera ou dados biométricos.

## Testes

1. manifesto aprovado carrega no `DigitalPresence`;
2. manifesto revogado cai para o fallback;
3. caminho não allowlisted é rejeitado;
4. asset acima do limite é rejeitado;
5. erro de rede não bloqueia Home/Chat/Voice;
6. `prefers-reduced-motion` desativa efeitos não essenciais;
7. light/dark e viewport mobile não cortam a presença;
8. estado `ready/listening/processing/speaking/error` acompanha a aplicação real;
9. nenhuma função de autorização recebe o asset como evidência;
10. foto de referência, EXIF e identificadores biométricos não aparecem no bundle, logs ou prompts.

## Decisão de evolução

O primeiro incremento deve usar asset 2D ou composição pré-renderizada. Modelo 3D, lip-sync e câmera só podem ser avaliados após performance, privacidade e Human Validation do asset inicial estarem aprovadas. A evolução não deve alterar a identidade de Conversation, Memory ou autorização.
