# Emergency Control

## Objetivo
Permitir contenção rápida caso Christian suspeite de comprometimento, comportamento inesperado, credencial exposta ou automação inadequada.

## Emergency Lock
O Control Center deve possuir mecanismo de bloqueio emergencial claramente identificável.

Ao ser acionado, o estado padrão deve:
- revogar sessões ativas;
- bloquear novas execuções de Tools externas;
- pausar automações e monitoramentos executivos;
- pausar jobs que possam produzir efeitos externos;
- impedir novas ações de escrita/publicação/exclusão;
- preservar memória, banco, documentos e evidências de auditoria;
- registrar evento crítico.

## Fail Closed
Em dúvida sobre o estado de segurança durante Emergency Lock, o sistema deve bloquear execução externa em vez de presumir autorização.

## Recuperação
Reativação não deve ser automática. Christian deve autenticar-se fortemente, revisar o motivo do bloqueio e reativar conscientemente as capacidades necessárias.

## Revogação seletiva
Além do bloqueio global, deve ser possível revogar integração, Tool, Skill, automação, dispositivo ou sessão individual.

## Comando conversacional
Quando autenticado por canal confiável, Christian poderá solicitar ao Pegasus o bloqueio emergencial ou revogação de acessos. Operações críticas de desbloqueio podem exigir step-up authentication.

## Evidências
O bloqueio deve preservar logs e estados necessários à investigação, respeitando minimização de dados e proteção de secrets.

## Continuidade
Emergency Lock não deve apagar dados. Backup e recuperação permanecem disponíveis conforme política de Disaster Recovery.
