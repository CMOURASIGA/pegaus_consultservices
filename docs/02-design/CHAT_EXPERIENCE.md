# Chat Experience - Pegasus

## Objetivo

Definir a experiência central do Pegasus. O chat é a interface principal entre o proprietário, a memória, os agentes, as ferramentas e os modelos de IA.

## Estrutura da tela

```text
Header
├── identidade Pegasus
├── status
└── sessão/perfil

Sidebar
├── nova conversa
├── histórico recente
└── navegação

Área principal
├── mensagens
├── contexto utilizado
├── ações executadas
└── composer
```

## Composer

Deve suportar inicialmente:
- texto;
- anexos;
- referência a arquivos do Google Drive;
- cancelamento de geração;
- envio por Enter e quebra de linha por combinação adequada.

Voz poderá ser incorporada posteriormente sem redesenhar a tela.

## Transparência

Quando o Pegasus utilizar recursos externos, a interface deve conseguir indicar de forma não intrusiva:
- memória consultada;
- documentos utilizados;
- ferramenta executada;
- agente acionado;
- modelo de IA utilizado quando relevante;
- falha parcial de alguma integração.

Não expor raciocínio interno privado do modelo.

## Contexto e memória

A interface deve permitir diferenciar:
- conversa atual;
- memória persistente;
- documento recuperado;
- informação externa;
- resultado de ferramenta.

O usuário deve poder abrir detalhes das fontes/contextos quando disponíveis.

## Histórico

- Conversas devem possuir título automático editável.
- Permitir busca.
- Permitir retomar contexto.
- Permitir arquivar e excluir com confirmação.
- Conversas sensíveis devem aceitar tratamento de privacidade específico no futuro.

## Execuções longas

Para research, indexação ou agentes:
- mostrar progresso;
- permitir acompanhar status;
- não travar o chat;
- permitir cancelamento quando tecnicamente possível.

## Estados

- pronto;
- pensando/processando;
- executando ferramenta;
- aguardando confirmação;
- concluído;
- parcialmente concluído;
- erro;
- cancelado.
