# Pegasus Reference Resolution

## Objetivo
Permitir que Pegasus compreenda referências naturais como "aquele projeto", "a pessoa da reunião", "o problema de ontem", "o sistema que estávamos falando" ou "faz igual ao outro" sem inventar o referente.

## Sinais
Reference Resolver pode combinar:
- conversa atual;
- recência;
- entidades citadas;
- relações do Knowledge Graph;
- memória;
- contexto temporal;
- Tasks ativas;
- projetos/assuntos ativos;
- documentos e eventos relacionados.

## Confiança
Cada resolução deve possuir confiança suficiente para o impacto da operação. Referência forte em conversa de baixo impacto pode ser resolvida automaticamente. Ambiguidade relevante deve gerar esclarecimento.

## Não adivinhar
Quando existirem múltiplos candidatos plausíveis e a escolha puder alterar materialmente a resposta ou execução, Pegasus deve perguntar qual deles Christian quis dizer.

## Resolução temporal
Expressões como ontem, naquela reunião, no início e atualmente devem ser interpretadas considerando timezone, histórico e estado temporal das entidades.

## Pessoas
Pessoa confirmada, speaker provável e simples menção textual são estados diferentes. Reference Resolver não deve transformar hipótese de identidade em fato confirmado.

## Continuidade entre canais
Referências podem atravessar voz, texto e dispositivos quando pertencem à mesma conversa/contexto autorizado.

## Auditoria
Para ações de impacto, a entidade/referência resolvida deve ser preservada no contexto da execução para permitir reconstruir por que Pegasus atuou sobre determinado alvo.
