# Navigation - Pegasus

## Objetivo

Definir a navegação principal do Pegasus e garantir consistência entre desktop e mobile.

## Menu principal proposto

```text
Pegasus
├── Chat
├── Histórico
├── Memória
├── Agentes
├── Integrações
├── Sessões
├── Control Center
└── Configurações
```

## Regras

- Chat é a página inicial após autenticação.
- Histórico deve permitir retomar conversas anteriores.
- Memória apresenta fatos, documentos e contexto recuperável, respeitando permissões e sensibilidade.
- Agentes apresenta agentes ativos, tarefas, status e execuções.
- Integrações concentra conexões autorizadas com serviços externos.
- Sessões mostra dispositivos e sessões autenticadas.
- Control Center é área administrativa e operacional.
- Configurações reúne preferências pessoais, autenticação, privacidade e comportamento do Pegasus.

## Rotas iniciais

- `/login`
- `/auth/approve`
- `/chat`
- `/history`
- `/memory`
- `/agents`
- `/integrations`
- `/sessions`
- `/admin`
- `/admin/ai-costs`
- `/admin/infrastructure`
- `/admin/backups`
- `/admin/logs`
- `/settings`

## Desktop

- Sidebar à esquerda.
- Possibilidade de recolher a sidebar.
- Item atual claramente destacado.
- Área de contexto secundário pode ser exibida à direita no Chat quando necessário.

## Mobile

- Navegação principal por drawer.
- Chat deve manter acesso rápido ao histórico e nova conversa.
- Control Center pode usar navegação interna por tabs ou lista de seções.

## Breadcrumbs

Usar apenas em páginas administrativas profundas. Não usar no Chat principal.
