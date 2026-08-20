# Backup and Recovery Specification - Pegasus

## 1. Objetivo

Definir a proteção mínima dos dados e serviços do Pegasus sem elevar desnecessariamente o custo da V1.

## 2. Camadas de proteção

A estratégia deve separar recuperação de infraestrutura, banco e conhecimento.

```text
Compute Engine
  -> snapshot periódico

Supabase PostgreSQL
  -> pg_dump automatizado
  -> Google Cloud Storage

Google Drive
  -> fonte documental principal

GitHub
  -> código e specs versionados
```

## 3. Banco de dados

Mesmo que o provedor ofereça backup, a V1 deverá manter backup lógico independente quando tecnicamente viável.

Requisitos:

- `pg_dump` automatizado;
- armazenamento fora do banco de origem;
- destino inicial: Google Cloud Storage;
- retenção inicial sugerida: 7 backups diários + 4 semanais;
- criptografia em trânsito e em repouso;
- job de backup deve registrar sucesso, falha, tamanho e horário;
- falha deve aparecer no Control Center.

## 4. VM

Snapshots da VM deverão ser usados como recuperação de infraestrutura, não como substituto do backup do banco.

Snapshot deve proteger:

- sistema operacional;
- configuração de containers;
- artefatos locais necessários;
- configuração operacional não regenerável automaticamente.

Sempre que possível, configuração reproduzível deve permanecer versionada no GitHub para reduzir dependência de snapshot.

## 5. Google Drive

Google Drive é a fonte oficial do conhecimento documental e não deverá depender da VM para existir.

A integração deverá manter metadados suficientes para detectar alterações e reconstruir o índice de conhecimento após perda total da VM.

## 6. Disaster Recovery

A recuperação completa deve ser possível a partir de:

1. código/specs no GitHub;
2. segredos no Secret Manager;
3. documentos no Google Drive;
4. banco restaurado a partir do Supabase ou dump no Cloud Storage;
5. infraestrutura recriada no Google Cloud.

## 7. Meta inicial de recuperação

Como projeto pessoal V1:

- RPO inicial: até 24 horas para dados estruturados;
- RTO inicial: até algumas horas, sem compromisso de alta disponibilidade empresarial.

Essas metas deverão ser revistas se o Pegasus se tornar operacionalmente crítico.

## 8. Teste de restauração

Backup sem teste de restauração não deve ser considerado proteção comprovada.

A especificação de operação futura deverá prever teste periódico de restauração de banco e validação de integridade.
