# Live Information Foundation

## Escopo inicial

Live Information fornece evidência externa atual e read-only ao Core. Weather é a primeira capability, implementada por um adapter Open-Meteo atrás de um contrato genérico. A consulta não autoriza ações e não modifica Decision Guard, permissions ou execution authorization.

## Fluxo

1. O Chat persiste a mensagem original do usuário.
2. O selector interpreta semanticamente a solicitação contra o catálogo explícito de capabilities e retorna apenas JSON estruturado.
3. O Capability Registry valida identificador, input schema, categoria, read-only, approval, provider e health.
4. Sem localidade ou período válido, o Pegasus pede a informação em vez de inferi-la.
5. O provider consulta endpoints fixos de geocoding e forecast com timeout, `no-store` e sem credenciais.
6. O Registry valida output, provenance e freshness, rejeitando resultados expirados.
7. O resultado entra no Core como evidência efêmera `untrusted_external`, com fonte, observação, consulta e validade.
8. O prompt exige fonte e atualidade. O Core mantém `executionAuthorization: none`.
9. A resposta persiste no histórico com metadata de provenance/freshness, usando a coluna JSON já existente.

## Boundary de memória

Quando Live Information é aplicável, a curadoria automática de Memory não é chamada. Evidências possuem `retention: ephemeral` e nunca são inseridas em Memory ou Knowledge. A metadata no histórico existe somente para auditoria e apresentação de provenance.

## Falha segura

Localidade ambígua, ausência de resultado, timeout, payload inválido ou falha da fonte produzem resposta determinística de limitação. Esses casos não são encaminhados ao modelo, impedindo que ele preencha lacunas por inferência.

## Extensão

Novas capabilities devem registrar um `CapabilityDescriptor`, schemas, provider e validators no `CapabilityRegistry`. O selector não conhece APIs específicas e o provider não interpreta texto livre. Toda extensão deve preservar allowlist de endpoints, read-only, timeout, provenance, freshness, retenção efêmera e falha segura. Capabilities consequenciais permanecem recusadas neste checkpoint e exigirão Policy, Decision Guard, grants e Approval em etapa autorizada.

## Digital Presence

`DigitalPresence` aceita um `DigitalPresenceAsset` com origem, dimensões, texto alternativo e prioridade. O asset oficial ocupa a camada central; partículas, glow, profundidade, materialização e estados permanecem desacoplados. Até a entrega da arte oficial, o humanoide atual é somente fallback e não deve receber novos refinamentos artísticos.
