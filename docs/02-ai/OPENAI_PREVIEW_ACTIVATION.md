# OpenAI no Preview

O chat pode usar o adapter OpenAI por configuração, sempre atrás do AI Router. O fake provider continua sendo o padrão para desenvolvimento, testes e CI.

## Configuração server-side no Vercel Preview

- `OPENAI_API_KEY`: credencial secreta, nunca exposta ao navegador.
- `PEGASUS_AI_PROVIDER=openai`: opt-in explícito para consumo pago.
- `PEGASUS_AI_MODEL=gpt-5.6-luna`: modelo inicial de custo controlado.
- `PEGASUS_AI_MAX_OUTPUT_TOKENS=800`: limite por resposta.

Nenhuma variável acima deve usar o prefixo `NEXT_PUBLIC_`. Depois de alterar variáveis no Vercel, um novo deployment é necessário.

## Controles

- chamadas usam a Responses API com `store: false`;
- timeout e cancelamento são controlados pelo Router;
- retry permanece zero por padrão;
- não existe fallback pago automático;
- testes e CI não fazem chamadas reais;
- logs registram provider, modelo, duração, usage e custo estimado, sem prompt ou chave;
- respostas continuam marcadas como não confiáveis e não autorizam ferramentas ou ações.

Anexos continuam no fluxo multimodal já definido e não são enviados ao adapter textual nesta ativação.
