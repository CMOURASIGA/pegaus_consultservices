# Pegasus Context Budget

## Objetivo
Controlar quantidade e qualidade de informação enviada aos modelos para reduzir custo, latência, ruído e risco de exposição desnecessária sem prejudicar a capacidade de raciocínio.

## Princípio
Janela disponível do modelo não é meta de consumo. Pegasus deve utilizar apenas o contexto necessário para a tarefa e reservar capacidade suficiente para resposta, raciocínio e Tool results.

## Componentes do orçamento
O budget pode conter cotas dinâmicas para:
- políticas e instruções essenciais;
- conversa atual;
- memórias relevantes;
- entidades e relações;
- objetivos/restrições;
- documentos;
- Tool results;
- contexto temporal;
- espaço reservado para saída/raciocínio conforme modelo.

As cotas não precisam ser fixas. O Context Engine adapta distribuição ao tipo de tarefa.

## Seleção
Priorizar informação por relevância, autoridade, recência quando aplicável, confiança, necessidade para o objetivo e classificação de dados. Similaridade semântica é apenas um dos sinais.

## Compressão de conversas
Conversas extensas podem ser comprimidas em resumo estruturado preservando:
- decisões;
- restrições;
- fatos relevantes;
- pendências;
- entidades;
- mudanças de direção;
- últimos turnos necessários à continuidade.

Compressão não deve inventar informação. Histórico original pode permanecer disponível conforme política de retenção.

## Documentos
Preferir chunks/trechos necessários em vez de documento integral. Preservar proveniência para que Pegasus possa aprofundar a recuperação se necessário.

## Contexto progressivo
Se o primeiro budget não for suficiente, Context Engine pode expandir retrieval e reconstruir o contexto. A estratégia deve evitar enviar preventivamente grandes volumes apenas por possibilidade de uso.

## Modelos e tiers
AI Router pode considerar tamanho/complexidade do contexto na escolha do modelo, mas modelo maior não substitui seleção cuidadosa de contexto.

## Segurança e privacidade
Context Budget deve aplicar minimização antes do envio a provedores externos. Dados não relacionados, especialmente CONFIDENTIAL/SENSITIVE, não devem entrar no prompt apenas porque estão disponíveis.

SECRET nunca entra no contexto do modelo.

## Observabilidade
Registrar métricas agregadas de contexto, como volume/tokens recuperados e utilizados, fontes e taxa de expansão, para otimizar custo e qualidade sem registrar conteúdo sensível integralmente.
