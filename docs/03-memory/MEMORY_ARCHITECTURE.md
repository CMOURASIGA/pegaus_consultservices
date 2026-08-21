# Pegasus Memory Architecture

## Objetivo
A memória do Pegasus deve permitir aprendizado contínuo, recuperação contextual e continuidade da relação com Christian sem transformar todo conteúdo recebido em memória permanente nem enviar todo o histórico aos modelos generativos.

Pegasus possui autonomia para avaliar o que merece ser lembrado. Instruções explícitas de Christian para guardar uma informação têm prioridade de persistência.

## Princípio de relevância
Uma informação deve ser avaliada pela sua relevância futura e pela sua utilidade para objetivos, decisões e entregas. Relevância não é sinônimo de volume ou novidade.

Quando Pegasus aprende algo novo com Christian porque não possuía conhecimento suficiente, deve avaliar se esse aprendizado é circunstancial ou reutilizável no futuro.

## Tipos conceituais de memória
- Working Memory: contexto temporário da interação atual.
- Episodic Memory: acontecimentos e contexto temporal.
- Semantic Memory: fatos, conceitos e conhecimentos consolidados.
- Decision Memory: decisões, justificativas, alternativas e resultados.
- Working Profile: padrões de trabalho, preferências operacionais e critérios de Christian.
- Project Memory: contexto específico de projetos.
- Relationship Memory: pessoas, organizações e relações relevantes.
- Knowledge Store: documentos e materiais extensos de referência.

## Memory Curator
Camada responsável por avaliar novas informações e definir seu destino.

Fluxo conceitual:
1. receber informação;
2. verificar se existe ordem explícita para lembrar;
3. avaliar relevância futura e reutilização;
4. identificar tipo de memória;
5. registrar origem, contexto e confiança;
6. detectar conflitos com memórias existentes;
7. persistir, atualizar, manter temporariamente ou descartar.

## Memória explícita
Expressões como "guarde isso", "lembre disso" ou equivalentes devem ser interpretadas como intenção explícita de persistência, salvo impossibilidade técnica, segurança ou política aplicável.

## Memória inferida
Pegasus pode inferir padrões e preferências, mas deve distinguir claramente inferência de informação explicitamente ensinada por Christian.

Exemplo:
- "Christian disse que prefere fechar as SPECS antes do desenvolvimento" possui alta autoridade de origem.
- "Pegasus inferiu que Christian provavelmente prefere X" deve possuir confiança menor e permanecer corrigível.

## Metadados mínimos de memória
Cada memória persistente deve prever, conforme aplicável:
- conteúdo;
- tipo;
- origem;
- data/hora;
- contexto;
- escopo pessoal/profissional/projeto/cliente;
- confiança;
- relevância;
- relações com outras memórias;
- última utilização;
- status;
- histórico de revisão.

## Evolução e conflito
Memórias não são verdades imutáveis. Quando uma informação nova contradizer uma memória existente, o sistema deve avaliar origem, autoridade, recência e contexto.

Mudanças relevantes devem atualizar o estado atual sem necessariamente apagar o histórico anterior, permitindo compreender evolução de decisões e preferências.

## Recuperação orientada ao objetivo
Memória persistente não deve ser enviada integralmente ao LLM. O Core primeiro identifica intenção e objetivo e recupera apenas as memórias potencialmente relevantes.

Fluxo:
Demanda -> objetivo -> Memory Retrieval -> Knowledge Retrieval quando necessário -> seleção/ranking -> montagem de contexto -> modelo generativo.

Esse princípio reduz ruído, exposição desnecessária de informação e consumo de tokens.

## Separação entre Memory Store e Knowledge Store
O desenho inicial prevê:

### Supabase / Memory Store
- fatos;
- decisões;
- preferências;
- aprendizados;
- relações;
- contextos;
- metadados e índices de documentos;
- vetores/embeddings quando definidos tecnicamente.

### Google Drive / Knowledge Store
- Markdown;
- PDFs;
- documentos;
- planilhas;
- referências;
- materiais extensos fornecidos ou autorizados por Christian.

O Drive não substitui o banco de memória e o banco de memória não deve duplicar desnecessariamente documentos completos do Drive.

## Correção pelo usuário
Christian deve poder corrigir uma memória ou interpretação. A correção deve ter alta autoridade e provocar reavaliação das inferências dependentes quando aplicável.

## Princípio de aprendizado
Pegasus parte de uma base de conhecimento ampla fornecida pelos modelos e fontes autorizadas, mas desenvolve conhecimento específico sobre Christian por convivência, instruções, decisões, correções e experiências acumuladas.
