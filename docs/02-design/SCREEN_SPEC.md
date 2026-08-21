# Screen Spec - Pegasus

## Objetivo

Registrar o mapa inicial de telas para que nenhuma função de frontend discutida seja esquecida.

## Telas obrigatórias V1

### /login
- identidade Pegasus;
- QR Code temporário;
- opção `Este dispositivo não é meu`;
- acesso a método alternativo de autenticação;
- estados de espera, expiração, erro e sucesso.

### /auth/approve
- confirmação no celular;
- informações da tentativa de login;
- autorizar ou negar;
- autenticação forte/biometria.

### /chat
- conversa principal;
- histórico recente;
- composer;
- anexos/referência a Drive;
- indicação de ferramentas, memória e contexto utilizados.

### /history
- busca;
- filtros;
- retomar conversa;
- arquivar;
- excluir com confirmação.

### /memory
- fatos persistentes;
- documentos indexados;
- origem da memória;
- status de indexação;
- possibilidade futura de correção/remoção controlada.

### /agents
- agentes disponíveis;
- status;
- tarefas em execução;
- histórico de execuções;
- cancelar quando suportado.

### /integrations
- Google Drive;
- Gmail;
- Calendar;
- GitHub;
- provedores de IA;
- demais integrações futuras;
- status conectado/desconectado/erro.

### /sessions
- sessões ativas;
- dispositivo;
- horário;
- modo público/confiável;
- encerramento remoto.

### /admin
- overview do Control Center.

### /admin/ai-costs
- tokens;
- custo;
- orçamento;
- custo por modelo/agente;
- alertas.

### /admin/infrastructure
- CPU;
- RAM;
- disco;
- uptime;
- status de serviços;
- alertas.

### /admin/backups
- status e histórico de backup;
- último pg_dump;
- Cloud Storage;
- falhas.

### /admin/logs
- logs operacionais;
- filtros;
- pesquisa;
- correlação por componente.

### /settings
- preferências;
- autenticação;
- privacidade;
- comportamento do Pegasus;
- métodos de recuperação.

## Regra

Nenhuma tela deve ser implementada somente com base nesta lista. Antes do desenvolvimento de cada módulo, fluxos, regras, permissões, estados e contratos de API devem ser especificados em detalhe.
