# Frontend Architecture - Pegasus

## Objetivo

Definir como o frontend do Pegasus deverá ser estruturado antes do desenvolvimento, evitando decisões improvisadas de UX, navegação e componentes durante a implementação.

## Princípios

- Aplicação web responsiva, acessível por navegador em desktop, tablet e celular.
- Nenhuma instalação local deve ser requisito.
- Interface orientada a conversa, contexto, memória, agentes e operação.
- A experiência deve priorizar clareza, baixa fricção e leitura rápida.
- O frontend não deve ficar acoplado ao OpenJarvis. O Pegasus consumirá uma camada própria de API/orquestração.
- Componentes reutilizáveis e estados visuais padronizados.
- Nenhuma informação sensível deve ser exibida integralmente por padrão.

## Estrutura sugerida

```text
Frontend Pegasus
├── App Shell
│   ├── Sidebar
│   ├── Header
│   └── Content Area
├── Chat Experience
├── Memory
├── Agents
├── Integrations
├── Sessions
├── Control Center
└── Settings
```

## App Shell

Desktop:
- Sidebar persistente ou recolhível.
- Header com identidade do Pegasus, status resumido e acesso ao perfil.
- Área principal com largura adaptativa.

Mobile:
- Sidebar convertida em drawer.
- Ações principais acessíveis sem excesso de menus.
- Chat ocupa a maior parte da viewport.

## Padrão de componentes

### Modal central
Usar para:
- confirmações;
- avisos importantes;
- ações críticas;
- autorização;
- encerramento de sessão;
- exclusão;
- decisões que exigem foco.

### Drawer
Usar para:
- configurações curtas;
- filtros;
- edição simples;
- detalhes auxiliares;
- cadastro pequeno.

### Página completa
Usar para:
- configurações extensas;
- administração;
- relatórios;
- integrações complexas;
- fluxos com múltiplas etapas.

## Estados obrigatórios

Toda tela ou componente assíncrono deve considerar:
- loading;
- empty state;
- success;
- warning;
- error;
- unavailable/offline;
- permission denied.

## Segurança de frontend

- Tokens sensíveis nunca devem ser persistidos em localStorage se houver alternativa mais segura.
- Sessões públicas devem ser claramente identificadas.
- Informações sensíveis devem aceitar mascaramento.
- Ações destrutivas exigem confirmação explícita.
- O frontend deve permitir encerramento imediato da sessão atual e de sessões remotas.

## Responsividade

O frontend deve ser validado em:
- desktop >= 1280 px;
- notebook 1024-1279 px;
- tablet 768-1023 px;
- mobile < 768 px.

## Fora de escopo desta versão da spec

- identidade visual final;
- paleta definitiva;
- tipografia final;
- animações avançadas;
- implementação técnica final do framework.

Esses pontos deverão ser refinados antes do início do desenvolvimento visual definitivo.
