# FASE 01 - PEGASUS CORE V1

## 1. Objetivo
Entregar a primeira versão utilizável do Pegasus como assistente pessoal/profissional privado de Christian, executado em infraestrutura própria, com conversa por texto e voz, memória seletiva, contexto, documentos, integrações iniciais, tarefas persistentes, segurança, observabilidade, proatividade controlada, percepção visual autorizada e capacidade de atuar em máquinas previamente autorizadas por meio do Device Agent.

A V1 deve ser útil diariamente, mas não deve tentar implementar toda a visão futura já documentada.

## 2. Princípio de escopo
Tudo que não estiver marcado como requisito V1 nesta fase permanece arquitetura preparada ou roadmap futuro. O desenvolvedor não deve antecipar funcionalidades futuras sem aprovação.

## 3. V1 obrigatória
- Web App responsivo e PWA;
- experiência conversacional principal;
- voz streaming/full-duplex com interrupção quando suportada pela stack escolhida;
- Pegasus Core desacoplado de modelo específico;
- AI Router inicial com tiers FAST, BALANCED e REASONING;
- suporte multimodal para imagens, documentos e visão sob demanda;
- Vision Gateway e Presence Engine iniciais;
- câmera autorizada e Screen Context sob comando;
- Memory Curator e memória seletiva;
- Context Engine e Context Budget iniciais;
- PostgreSQL/Supabase conforme arquitetura;
- Knowledge Store baseado em Google Drive e indexação/retrieval;
- entidades básicas de pessoas, projetos, assuntos, objetivos e relações;
- Tasks persistentes e assíncronas;
- Decision Guard;
- Device Gateway básico;
- Device Agent Windows mínimo, explicitamente pareado/autorizado;
- capabilities locais granulares e auditáveis;
- filesystem restrito a diretórios autorizados;
- command runner controlado para diagnóstico/desenvolvimento;
- WAITING_DEVICE/retomada segura de Tasks dependentes de dispositivo;
- Meeting Mode com LISTENING e COPILOT MODE iniciais;
- integrações iniciais Google Drive, Gmail, Calendar e GitHub com prioridade para leitura/consulta;
- Attention Engine inicial;
- briefing proativo;
- Notification Gateway com pelo menos canal in-app/PWA e fallback viável;
- Control Center inicial;
- custos de IA e saúde básica;
- autenticação forte, sessões e Passkey/WebAuthn quando suportado;
- Continuous Identity & Presence preparado para privacy lock;
- auditoria;
- Emergency Lock;
- backup e restore documentados/testáveis;
- classificação e minimização de dados;
- proteção contra prompt injection em conteúdo externo.

## 4. Fora da V1
Não implementar na primeira entrega, salvo alteração formal de escopo:
- reconhecimento biométrico de terceiros por voz como identidade confiável;
- voz como fator de autenticação;
- autenticação facial própria baseada em banco biométrico;
- Participant Mode autônomo em reuniões;
- bot nativo completo para todas as plataformas de reunião;
- automação universal de qualquer aplicativo desktop;
- controle irrestrito do sistema operacional;
- shell/root/admin autônomo;
- captura silenciosa/contínua de tela;
- instalação automática do Agent em máquina de terceiros;
- criação autônoma avançada de Skills em produção;
- WhatsApp, SMS e múltiplos mensageiros;
- dezenas de integrações externas;
- autonomia irrestrita de escrita/exclusão em sistemas externos;
- execução financeira;
- compras/pagamentos;
- acesso administrativo amplo a terceiros;
- wake word always-on nativo;
- aplicativo mobile nativo dedicado, se PWA atender inicialmente;
- Knowledge Graph sofisticado além do necessário para V1;
- automações de longa duração sem limites/políticas definidos.

## 5. Sprints

### Sprint 1 - Foundation e infraestrutura
Entregar estrutura de projeto, ambientes, configuração segura, containers/processos, banco, migrations, logging, healthcheck, CI mínimo e documentação de execução.

Aceite:
- aplicação sobe em ambiente de desenvolvimento;
- backend e banco respondem healthcheck;
- secrets não estão no repositório;
- migrations são reproduzíveis;
- logs básicos disponíveis;
- README operacional atualizado.

### Sprint 2 - Auth, sessões e Passkey
Entregar autenticação, sessão, proteção de rotas administrativas, WebAuthn/Passkey conforme compatibilidade e revogação de sessões.

Aceite:
- Christian consegue autenticar;
- sessão expira/revoga corretamente;
- área administrativa não é pública;
- ação sensível pode exigir step-up;
- nenhuma credencial sensível aparece no frontend/log.

### Sprint 3 - Pegasus Core e AI Router
Entregar contrato central de conversação, abstração de provedores/modelos e roteamento inicial por complexidade/custo.

Aceite:
- conversa textual funcional;
- Core não depende diretamente de um único modelo;
- Router registra tier/modelo selecionado;
- fallback controlado;
- consumo básico registrado;
- incerteza/falha não é mascarada como sucesso.

### Sprint 4 - Chat, multimodal, voz e visão sob demanda
Entregar UI principal, anexos, experiência de voz V1, câmera autorizada e Screen Context inicial.

Aceite:
- texto funciona em desktop/mobile;
- imagem/documento pode ser contextualizado;
- voz entra e resposta de voz sai;
- interrupção do usuário cancela/suspende fala do Pegasus rapidamente;
- nova informação é incorporada ao contexto;
- voz e texto compartilham a mesma conversa;
- câmera somente inicia mediante permissão;
- usuário pode solicitar análise de imagem/câmera/tela;
- desligar câmera interrompe processamento visual;
- observação visual é distinguida de hipótese/inferência.

### Sprint 5 - Memory Curator e Context Engine
Entregar memória seletiva, retrieval, contexto temporal básico, proveniência e budget.

Aceite:
- informação relevante pode ser persistida;
- comando explícito para guardar é respeitado;
- informação irrelevante não precisa virar memória;
- memória pode ser corrigida;
- estado atual e histórico são distinguíveis;
- contexto recuperado possui fonte/proveniência quando aplicável;
- prompts não recebem memória indiscriminadamente.

### Sprint 6 - Drive e documentos
Entregar Knowledge Store inicial e pipeline de ingestão/indexação.

Aceite:
- documento autorizado do Drive pode ser localizado e lido;
- conteúdo é indexado de forma incremental quando aplicável;
- fonte permanece rastreável;
- PDF/imagem/documento externo é tratado como conteúdo não confiável;
- instruções dentro de documento não ganham permissão para executar Tools.

### Sprint 7 - Integrações iniciais
Entregar Gmail, Calendar e GitHub inicialmente orientados a consulta/leitura, além do Drive.

Aceite:
- Pegasus consulta dados autorizados;
- tokens ficam fora do frontend;
- revogação é suportada;
- falha de autorização é detectada;
- leitura externa não implica autorização de escrita;
- operações são auditáveis.

### Sprint 8 - Tasks, Decision Guard e Device Gateway
Entregar tarefas persistentes, estados, retomada, subtasks, fronteiras de execução e mediação cloud para dispositivos.

Aceite:
- Task sobrevive a encerramento da conversa;
- progresso é persistido;
- WAITING_APPROVAL, WAITING_EXTERNAL e WAITING_DEVICE funcionam;
- falha recuperável não apaga progresso;
- cancelamento funciona;
- conclusão é validada antes de COMPLETED;
- ação não autorizada é bloqueada pelo Guard;
- dispositivo pode ser pareado/revogado;
- heartbeat/status do dispositivo é visível;
- command/tool local fora da capability concedida é negado.

### Sprint 9 - Device Agent Windows e Meeting Copilot
Entregar Device Agent Windows mínimo e Meeting Copilot V1.

Aceite:
- Agent pareado conecta ao Device Gateway de forma autenticada;
- Screen Context funciona sob comando;
- filesystem respeita diretórios autorizados;
- command runner é restrito e auditável;
- dispositivo offline coloca Task dependente em WAITING_DEVICE;
- retorno online permite retomada segura sem duplicar ação;
- câmera/microfone seguem permissões;
- Meeting Mode LISTENING registra contexto autorizado;
- COPILOT MODE produz orientações baseadas em evidências observáveis;
- Pegasus não afirma emoção/intenção como fato a partir de expressão corporal;
- reunião pode gerar resumo, decisões, pendências, responsáveis e recomendações de condução.

### Sprint 10 - Attention Engine e Briefing
Entregar proatividade inicial, relevância, agrupamento e briefing.

Aceite:
- eventos informativos não geram spam;
- alertas importantes podem repetir de forma controlada;
- eventos relacionados são agrupáveis;
- briefing diferencia decisão, resolvido, conhecimento, agenda e risco;
- rotina/descanso adaptativos começam como inferência corrigível;
- Pegasus não amplia autonomia para resolver um alerta.

### Sprint 11 - Control Center e observabilidade
Entregar painel administrativo mínimo operacional.

Aceite:
- saúde de componentes visível;
- custos/consumo de IA visíveis;
- Activity Timeline disponível;
- integrações exibem status;
- Tasks e execuções consultáveis;
- dispositivos/Agents exibem status, trust level, capabilities e possibilidade de revogação;
- sessões consultáveis/revogáveis;
- secrets nunca são exibidos.

### Sprint 12 - Segurança, backup e recuperação
Aplicar hardening, backups, Emergency Lock, auditoria e testes de recuperação.

Aceite:
- backup executado e evidenciado;
- procedimento de restore documentado e testado em ambiente seguro;
- Emergency Lock impede novas ações externas conforme política;
- auditoria cobre ações críticas e Device Tools;
- dados SECRET não entram em prompts;
- prompt injection possui testes mínimos;
- Device Agent falha fechado quando policy/backend não puder validar nova ação;
- revogação de dispositivo impede novas execuções.

### Sprint 13 - Hardening, testes e produção
Consolidar V1, corrigir falhas, testar mobile/PWA, Agent Windows, desempenho, segurança e implantação.

Aceite:
- fluxos críticos possuem testes;
- nenhum erro crítico conhecido aberto;
- produção possui healthcheck e observabilidade;
- rollback está documentado;
- custo inicial pode ser acompanhado;
- documentação corresponde ao sistema entregue;
- fluxo completo Web + Device Agent + Task + Meeting Copilot foi validado.

## 6. Definition of Done global
Uma funcionalidade só está pronta quando:
1. atende a SPEC relacionada;
2. possui tratamento de erro;
3. respeita autorização e classificação de dados;
4. possui logs/auditoria proporcionais ao risco;
5. possui teste do caminho principal e falhas críticas;
6. funciona em layout responsivo quando possuir UI;
7. não expõe secrets;
8. possui documentação atualizada;
9. foi validada por Christian quando fizer parte de fluxo de usuário.

## 7. Ordem de implementação
O desenvolvedor deve respeitar dependências. Não iniciar automação/autonomia antes de Auth, Core, Context, segurança e Decision Guard estarem suficientemente estabelecidos.

Device Agent não deve receber poder irrestrito na primeira implementação. Priorizar leitura/contexto, capabilities explícitas e execução controlada antes de expandir automação local.

## 8. Estratégia de custos
Durante desenvolvimento:
- utilizar modelos econômicos para testes repetitivos;
- mocks/fakes para integrações quando possível;
- limitar voz/vídeo contínuos em testes automatizados;
- registrar consumo desde Sprint 3;
- evitar enviar documentos, telas ou vídeo integrais aos modelos quando eventos/amostras forem suficientes;
- utilizar Context Budget;
- definir teto operacional e alertas antes de produção.

## 9. Critério para liberação V1
A V1 pode ser considerada pronta para uso real quando Sprints 1-13 atenderem aos critérios críticos, segurança e restore tiverem sido validados e Christian conseguir executar um fluxo completo: autenticar -> conversar por texto/voz -> fornecer documento -> usar câmera/tela sob comando -> recuperar memória/contexto -> consultar integração -> parear máquina autorizada -> executar Tool local restrita -> criar/acompanhar Task -> colocar Task em WAITING_DEVICE e retomar -> usar Meeting Copilot -> receber briefing/notificação -> revisar execução no Control Center.
