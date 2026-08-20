# Pegasus

## Visão inicial

Pegasus é um assistente pessoal de inteligência artificial, privado e acessível pela nuvem, projetado para manter memória persistente, consultar conhecimento pessoal, utilizar diferentes modelos de IA e executar ferramentas e ações autorizadas pelo proprietário.

## Objetivo desta fase

Esta etapa documenta exclusivamente as decisões de infraestrutura já definidas. Produto, UX, agentes, memória detalhada, skills, integrações e automações serão especificados em fases posteriores.

## Princípios já definidos

- O Pegasus deve ser acessível de qualquer dispositivo com navegador.
- Nenhuma instalação local deve ser requisito para uso.
- O acesso principal deverá evoluir para autenticação via QR Code com autorização pelo celular e biometria.
- Google Authenticator ou outro TOTP será mecanismo secundário/contingencial.
- O motor inicial será baseado em OpenJarvis, preservando independência arquitetural para futura substituição do engine.
- O processamento pesado de LLM não será executado na VM da V1.
- Google Drive será o repositório documental e Knowledge Store, com preferência por Markdown quando aplicável.
- GitHub será a fonte oficial de código, documentação técnica, specs e histórico de desenvolvimento.
- PostgreSQL ficará externo à VM na V1, inicialmente via Supabase.
- O projeto deve iniciar com infraestrutura econômica e permitir scale-up vertical sem redesenho arquitetural.
