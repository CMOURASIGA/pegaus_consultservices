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

## Diagnóstico do primeiro teste real

O primeiro teste do Preview, no commit `4a3d26cb`, chegou ao provider e terminou como `provider_error`, produzindo HTTP 503 na API do Pegasus. O adapter fazia HTTP direto para `POST /v1/responses`, mas tentava ler `output_text` no JSON bruto. Esse campo é uma conveniência de SDK; a resposta REST expõe texto dentro do array `output`. Assim, uma resposta válida da OpenAI era classificada como vazia e convertida no erro genérico.

O commit `f76eb047` passou a percorrer com segurança os itens `message/output_text` do array `output`. Com a mesma configuração de provider, modelo e credencial, a chamada real seguinte retornou conteúdo, comprovando a causa sem troca de chave, modelo, endpoint ou fallback.

O log original não preservou o status HTTP upstream nem o request ID, portanto esses dois campos históricos são desconhecidos e não devem ser inventados. A telemetria posterior registra status HTTP e request ID sanitizados tanto em falhas quanto em sucessos, além de provider, modelo, duração, usage, custo estimado, status e fallback. Prompt, contexto, memória, resposta e credenciais permanecem excluídos.

## Identidade e precedência

A identidade permanente pertence ao `PegasusCore`, não ao adapter OpenAI. O assembly mantém camadas separadas nesta ordem:

1. identidade estável do Pegasus;
2. política de confiança e não execução;
3. memória recuperada como contexto não executivo;
4. conteúdo externo como dado não confiável;
5. mensagem atual autenticada do usuário.

O adapter continua apenas traduzindo o contrato neutro do Router para a API do provider. A saída do modelo continua `untrusted` e com `executionAuthorization: none`.

O teste em que Christian escreveu o próprio nome no prompt não valida recuperação de memória. `Memory E2E` permanece pendente de um teste que não forneça o fato na própria mensagem.
