# Responsive - Pegasus

## Objetivo

Garantir que o Pegasus possa ser utilizado em qualquer navegador moderno, incluindo computadores públicos, notebooks, tablets e celulares.

## Breakpoints de referência

- Desktop: >= 1280 px
- Notebook: 1024 a 1279 px
- Tablet: 768 a 1023 px
- Mobile: < 768 px

## Desktop

- Sidebar persistente ou recolhível.
- Chat com largura confortável de leitura.
- Painéis administrativos podem usar grids.
- Contexto secundário pode ocupar coluna lateral quando necessário.

## Notebook

- Sidebar recolhível por padrão quando o espaço for limitado.
- Priorizar conteúdo principal.
- Evitar dashboards com mais de 3 colunas.

## Tablet

- Sidebar como drawer.
- Cards reorganizados verticalmente ou em 2 colunas.
- Modais devem respeitar área útil e teclado virtual.

## Mobile

- Chat ocupa a maior parte da viewport.
- Navegação em drawer.
- Composer fixado de forma segura na parte inferior.
- Tabelas complexas devem virar listas/cards ou permitir rolagem horizontal controlada.
- Ações críticas devem permanecer acessíveis sem hover.

## Regras gerais

- Não depender de hover para revelar ação essencial.
- Alvos de toque devem ser confortáveis.
- Evitar texto excessivamente pequeno.
- Validar comportamento com teclado virtual aberto.
- Garantir que QR Code da tela de login permaneça legível em diferentes tamanhos.
