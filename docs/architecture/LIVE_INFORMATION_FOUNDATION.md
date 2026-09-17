# Live Information Foundation

## Escopo inicial

Live Information fornece evidência externa atual e read-only ao Core. Weather é a primeira capability, implementada por um adapter Open-Meteo atrás de um contrato genérico. A consulta não autoriza ações e não modifica Decision Guard, permissions ou execution authorization.

## Fluxo

1. O Chat persiste a mensagem original do usuário.
2. O resolver identifica deterministicamente se a pergunta requer Weather e extrai a localidade explícita.
3. Sem localidade, o Pegasus pede a informação em vez de inferi-la.
4. O provider consulta endpoints fixos de geocoding e forecast com timeout, `no-store` e sem credenciais.
5. O resultado entra no Core como evidência efêmera `untrusted_external`, com fonte, observação, consulta e validade.
6. O prompt exige fonte e atualidade. O Core mantém `executionAuthorization: none`.
7. A resposta persiste no histórico com metadata de provenance/freshness, usando a coluna JSON já existente.

## Boundary de memória

Quando Live Information é aplicável, a curadoria automática de Memory não é chamada. Evidências possuem `retention: ephemeral` e nunca são inseridas em Memory ou Knowledge. A metadata no histórico existe somente para auditoria e apresentação de provenance.

## Falha segura

Localidade ambígua, ausência de resultado, timeout, payload inválido ou falha da fonte produzem resposta determinística de limitação. Esses casos não são encaminhados ao modelo, impedindo que ele preencha lacunas por inferência.

## Extensão

Novas capabilities devem implementar `LiveInformationPort`, retornar a mesma estrutura de evidência e preservar: allowlist de endpoints, read-only, timeout, provenance, freshness, retenção efêmera e falha segura. Nenhuma capability consequencial pertence a este boundary.

## Digital Presence

`DigitalPresence` aceita um `DigitalPresenceAsset` com origem, dimensões, texto alternativo e prioridade. O asset oficial ocupa a camada central; partículas, glow, profundidade, materialização e estados permanecem desacoplados. Até a entrega da arte oficial, o humanoide atual é somente fallback e não deve receber novos refinamentos artísticos.
