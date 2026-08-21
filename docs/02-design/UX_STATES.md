# UX States - Pegasus

## Objetivo

Padronizar os estados visuais e comportamentais do frontend.

## Estados obrigatórios

### Loading
- usar skeleton ou indicador contextual;
- evitar bloquear a página inteira sem necessidade;
- informar quando a operação puder demorar.

### Empty
- explicar por que não há dados;
- oferecer próxima ação útil quando aplicável.

### Success
- feedback claro e curto;
- não depender apenas de cor.

### Warning
- destacar risco sem impedir ação quando não for crítico.

### Error
- mensagem compreensível;
- ação de tentar novamente quando aplicável;
- código técnico pode existir em detalhes, não como mensagem principal.

### Offline / Serviço indisponível
- identificar componente indisponível;
- preservar acesso ao restante do sistema quando possível.

### Permission denied
- explicar que a ação não está autorizada;
- não revelar dados protegidos.

### Processing / Agent running
- mostrar status;
- indicar atividade atual em linguagem objetiva;
- permitir cancelar quando suportado.

### Confirmation required
- modal central;
- ação principal e ação de cancelamento claras;
- ações destrutivas devem informar impacto.

## Regra geral

Nenhuma falha deve resultar em tela branca, erro técnico bruto ou estado sem explicação ao usuário.
