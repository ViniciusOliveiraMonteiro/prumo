---
date: "05 de outubro de 2026"
lang: pt-BR
---

# Plano de Estudos Aplicado ao Projeto

## 1. Objetivo

Este documento transforma o desenvolvimento da Plataforma de Inteligência Financeira Doméstica em uma trilha prática de aprendizado fullstack. Ele complementa o Plano Mestre:

- **Plano Mestre**: define produto, domínio, requisitos, arquitetura, decisões e roadmap.
- **Plano de Estudos**: define o que aprender para tomar, implementar, testar e defender essas decisões.

O [Caderno de Estudos](CADERNO_DE_ESTUDOS_APLICADO.md) desenvolve os tópicos com explicações, exercícios, perguntas de revisão e critérios de conclusão. Este plano é a fonte para a ordem de estudo, as fases e os checkpoints; o [Plano de Desenvolvimento](docs/planning/PLANO_DE_DESENVOLVIMENTO.md) registra o andamento das sprints.

O objetivo não é colecionar tecnologias. Para cada conceito, você deve conseguir responder:

1. qual problema ele resolve;
2. quais alternativas existem;
3. quais trade-offs ele introduz;
4. como aparece no projeto;
5. como provar seu funcionamento por teste ou telemetria;
6. em que condição a decisão deve ser revisitada.

## 2. Como os documentos se relacionam

```text
Plano Mestre
    |
    | referencia IDs de estudo
    v
Plano de Estudos Aplicado
    |
    +-- Backend
    +-- Banco de Dados
    +-- Segurança e Privacidade
    +-- DevOps e Infraestrutura
    +-- Observabilidade
    +-- Arquitetura e Sistemas Distribuídos
    +-- IA e Agentes
    +-- Testes e Qualidade
    +-- Domínio Financeiro
    |
    v
Laboratórios -> ADRs -> Implementação -> Testes -> Operação
```

### Fonte de verdade

- regras de produto e negócio: [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) e exemplos em [`docs/domain/`](docs/domain/);
- decisão arquitetural: ADR em [`docs/decisions/`](docs/decisions/);
- conteúdo didático: este plano e o [Caderno](CADERNO_DE_ESTUDOS_APLICADO.md);
- comportamento executável: código e testes;
- operação: [`docs/operations/`](docs/operations/) e documentação de infraestrutura.

Se um estudo sugerir uma alternativa diferente da arquitetura atual, ele **não muda o projeto sozinho**. A mudança precisa de discussão e ADR.

## 3. Critério de domínio

Um tópico passa para **DOMINADO** somente quando você consegue:

- explicar com suas palavras;
- apontar o risco/problema que resolve;
- aplicar em exemplo do projeto;
- fazer laboratório ou implementação mínima, quando aplicável;
- escrever ou entender o teste que comprova o comportamento;
- apontar pelo menos uma limitação;
- responder às perguntas de revisão;
- registrar ADR quando houver decisão de arquitetura.

Ler documentação ou assistir aula vale como **ESTUDADO**, não como **DOMINADO**.

## 4. Status sugeridos

| Status | Significado |
|---|---|
| NÃO INICIADO | ainda não entrou na trilha |
| EM ESTUDO | leitura/laboratório em andamento |
| APLICADO | conceito já foi usado no projeto |
| DOMINADO | critério de domínio atendido |
| REVISITAR | mudança técnica exige revisão |

## 5. Ordem de estudo por fase

### Fase A - Antes de código de produto

Estudar:
- [DOM-001](CADERNO_DE_ESTUDOS_APLICADO.md#dom-001---fluxo-de-caixa-patrimônio-e-competência), [DOM-002](CADERNO_DE_ESTUDOS_APLICADO.md#dom-002---account-saldo-inicial-e-reconciliação), [DOM-003](CADERNO_DE_ESTUDOS_APLICADO.md#dom-003---income-expense-e-transfer), [DOM-004](CADERNO_DE_ESTUDOS_APLICADO.md#dom-004---compra-no-cartão-fatura-e-pagamento) e [DOM-005](CADERNO_DE_ESTUDOS_APLICADO.md#dom-005---parcelamentos-e-arredondamento);
- [DB-001](CADERNO_DE_ESTUDOS_APLICADO.md#db-001---modelagem-relacional-e-normalização), [DB-002](CADERNO_DE_ESTUDOS_APLICADO.md#db-002---representação-de-dinheiro-e-precisão) e [DB-003](CADERNO_DE_ESTUDOS_APLICADO.md#db-003---constraints-e-integridade);
- [BACK-001](CADERNO_DE_ESTUDOS_APLICADO.md#back-001---http-e-ciclo-de-vida-de-uma-request) e [BACK-002](CADERNO_DE_ESTUDOS_APLICADO.md#back-002---rest-recursos-e-contratos);
- [ARCH-001](CADERNO_DE_ESTUDOS_APLICADO.md#arch-001---monólito-modular), [ARCH-002](CADERNO_DE_ESTUDOS_APLICADO.md#arch-002---bounded-contexts-e-fronteiras-de-domínio) e [ARCH-003](CADERNO_DE_ESTUDOS_APLICADO.md#arch-003---síncrono-vs-assíncrono);
- [SEC-001](CADERNO_DE_ESTUDOS_APLICADO.md#sec-001---classificação-de-dados-e-noções-de-lgpd), [SEC-002](CADERNO_DE_ESTUDOS_APLICADO.md#sec-002---threat-modeling) e [SEC-003](CADERNO_DE_ESTUDOS_APLICADO.md#sec-003---autenticação-autorização-e-identidade);
- [TEST-001](CADERNO_DE_ESTUDOS_APLICADO.md#test-001---estratégia-de-testes-baseada-em-risco).

Saídas:
- glossário;
- casos de uso;
- business rules;
- ERD inicial;
- threat model inicial;
- ADR de representação monetária;
- arquitetura de alto nível.

### Fase B - Bootstrap de engenharia

Estudar:
- [BACK-003](CADERNO_DE_ESTUDOS_APLICADO.md#back-003---nestjs-módulos-e-dependency-injection), [BACK-004](CADERNO_DE_ESTUDOS_APLICADO.md#back-004---dtos-parsing-e-validação) e [BACK-005](CADERNO_DE_ESTUDOS_APLICADO.md#back-005---taxonomia-de-erros-e-falhas);
- [DEV-001](CADERNO_DE_ESTUDOS_APLICADO.md#dev-001---processos-rede-portas-e-dns), [DEV-002](CADERNO_DE_ESTUDOS_APLICADO.md#dev-002---configuração-por-ambiente), [DEV-003](CADERNO_DE_ESTUDOS_APLICADO.md#dev-003---containers-images-e-dockerfile), [DEV-004](CADERNO_DE_ESTUDOS_APLICADO.md#dev-004---docker-compose-para-ambiente-local) e [DEV-005](CADERNO_DE_ESTUDOS_APLICADO.md#dev-005---ci-com-github-actions);
- [TEST-002](CADERNO_DE_ESTUDOS_APLICADO.md#test-002---unit-tests-de-domínio), [TEST-003](CADERNO_DE_ESTUDOS_APLICADO.md#test-003---integration-tests-com-infraestrutura-real) e [TEST-007](CADERNO_DE_ESTUDOS_APLICADO.md#test-007---testcontainers);
- [SEC-008](CADERNO_DE_ESTUDOS_APLICADO.md#sec-008---secrets-management) e [SEC-018](CADERNO_DE_ESTUDOS_APLICADO.md#sec-018---supply-chain-e-dependências).

Saídas:
- diretórios `prumo-web/` e `prumo-api/` do monorepo preparados para o bootstrap;
- API e web mínimas;
- configuração validada;
- Docker Compose;
- CI;
- PostgreSQL real em testes de integração.

### Fase C - Identity + Household

Estudar:
- [BACK-006](CADERNO_DE_ESTUDOS_APLICADO.md#back-006---autenticação-e-autorização-no-backend);
- [SEC-003](CADERNO_DE_ESTUDOS_APLICADO.md#sec-003---autenticação-autorização-e-identidade), [SEC-004](CADERNO_DE_ESTUDOS_APLICADO.md#sec-004---senhas-sessões-mfa-e-passkeys), [SEC-005](CADERNO_DE_ESTUDOS_APLICADO.md#sec-005---least-privilege-rbac-e-autorização-por-recurso) e [SEC-006](CADERNO_DE_ESTUDOS_APLICADO.md#sec-006---isolamento-entre-households-e-defense-in-depth);
- [DB-008](CADERNO_DE_ESTUDOS_APLICADO.md#db-008---postgresql-row-level-security-rls);
- [TEST-009](CADERNO_DE_ESTUDOS_APLICADO.md#test-009---security-regression-tests);
- [ARCH-013](CADERNO_DE_ESTUDOS_APLICADO.md#arch-013---multi-tenancy-via-household).

Saídas:
- ADR de autenticação;
- matriz de permissões;
- suite de isolamento Household A/B;
- experimento de RLS;
- decisão sobre RLS.

### Fase D - Accounts + Transactions

Estudar:
- [DOM-002](CADERNO_DE_ESTUDOS_APLICADO.md#dom-002---account-saldo-inicial-e-reconciliação), [DOM-003](CADERNO_DE_ESTUDOS_APLICADO.md#dom-003---income-expense-e-transfer), [DOM-006](CADERNO_DE_ESTUDOS_APLICADO.md#dom-006---estorno-e-reembolso) e [DOM-007](CADERNO_DE_ESTUDOS_APLICADO.md#dom-007---split-transaction);
- [BACK-007](CADERNO_DE_ESTUDOS_APLICADO.md#back-007---transactions-de-banco-e-atomicidade), [BACK-008](CADERNO_DE_ESTUDOS_APLICADO.md#back-008---idempotência) e [BACK-009](CADERNO_DE_ESTUDOS_APLICADO.md#back-009---concorrência-e-race-conditions);
- [DB-005](CADERNO_DE_ESTUDOS_APLICADO.md#db-005---acid-e-isolation-levels) e [DB-006](CADERNO_DE_ESTUDOS_APLICADO.md#db-006---locks-blocking-e-deadlocks);
- [TEST-005](CADERNO_DE_ESTUDOS_APLICADO.md#test-005---property-based-tests-e-invariantes).

Saídas:
- regras de atomicidade;
- estratégia de idempotência;
- invariantes monetários;
- tratamento de concorrência.

### Fase E - Credit Cards + Installments

Estudar:
- [DOM-004](CADERNO_DE_ESTUDOS_APLICADO.md#dom-004---compra-no-cartão-fatura-e-pagamento) e [DOM-005](CADERNO_DE_ESTUDOS_APLICADO.md#dom-005---parcelamentos-e-arredondamento);
- [DB-003](CADERNO_DE_ESTUDOS_APLICADO.md#db-003---constraints-e-integridade) e [DB-005](CADERNO_DE_ESTUDOS_APLICADO.md#db-005---acid-e-isolation-levels);
- [TEST-005](CADERNO_DE_ESTUDOS_APLICADO.md#test-005---property-based-tests-e-invariantes).

Saída principal:
- ADR de compra, fatura, pagamento, competência e parcelamento.

### Fase F - Import Pipeline

Estudar:
- [BACK-008](CADERNO_DE_ESTUDOS_APLICADO.md#back-008---idempotência), [BACK-010](CADERNO_DE_ESTUDOS_APLICADO.md#back-010---jobs-filas-e-workers) e [BACK-011](CADERNO_DE_ESTUDOS_APLICADO.md#back-011---upload-streaming-e-arquivos-não-confiáveis);
- [ARCH-003](CADERNO_DE_ESTUDOS_APLICADO.md#arch-003---síncrono-vs-assíncrono), [ARCH-004](CADERNO_DE_ESTUDOS_APLICADO.md#arch-004---filas-e-delivery-semantics) e [ARCH-008](CADERNO_DE_ESTUDOS_APLICADO.md#arch-008---redis-e-bullmq);
- [SEC-017](CADERNO_DE_ESTUDOS_APLICADO.md#sec-017---uploads-e-parsing-seguro);
- [OBS-003](CADERNO_DE_ESTUDOS_APLICADO.md#obs-003---correlation-id-e-trace-context) e [OBS-009](CADERNO_DE_ESTUDOS_APLICADO.md#obs-009---observabilidade-de-filas-e-workers).

Saídas:
- upload policy;
- retenção de arquivo;
- idempotência;
- queue semantics;
- observabilidade do worker.

### Fase G - Analytics + Insights determinísticos

Estudar:
- [DB-004](CADERNO_DE_ESTUDOS_APLICADO.md#db-004---índices-e-query-plans) e [DB-012](CADERNO_DE_ESTUDOS_APLICADO.md#db-012---agregações-snapshots-e-dados-derivados);
- [DOM-008](CADERNO_DE_ESTUDOS_APLICADO.md#dom-008---recorrências-compromissos-e-forecast), [DOM-009](CADERNO_DE_ESTUDOS_APLICADO.md#dom-009---categorias-budgets-e-envelopes), [DOM-010](CADERNO_DE_ESTUDOS_APLICADO.md#dom-010---reserva-de-emergência-como-regra-configurável), [DOM-011](CADERNO_DE_ESTUDOS_APLICADO.md#dom-011---ativos-passivos-e-valuation) e [DOM-012](CADERNO_DE_ESTUDOS_APLICADO.md#dom-012---métricas-versionadas-e-explicáveis);
- [BACK-012](CADERNO_DE_ESTUDOS_APLICADO.md#back-012---cache-e-invalidação) e [BACK-013](CADERNO_DE_ESTUDOS_APLICADO.md#back-013---paginação-filtros-e-ordenação);
- [OBS-004](CADERNO_DE_ESTUDOS_APLICADO.md#obs-004---métricas-e-cardinalidade) e [OBS-008](CADERNO_DE_ESTUDOS_APLICADO.md#obs-008---dashboards-operacionais);
- [ARCH-012](CADERNO_DE_ESTUDOS_APLICADO.md#arch-012---cache-e-consistência) somente se houver caso real de cache.

Saídas:
- catálogo de métricas;
- fórmulas versionadas;
- snapshots;
- benchmark de queries;
- dashboards.

### Fase H - IA

Estudar:
- [AI-001](CADERNO_DE_ESTUDOS_APLICADO.md#ai-001---llms-tokens-contexto-e-não-determinismo), [AI-002](CADERNO_DE_ESTUDOS_APLICADO.md#ai-002---structured-output-e-validação), [AI-003](CADERNO_DE_ESTUDOS_APLICADO.md#ai-003---tool-calling), [AI-004](CADERNO_DE_ESTUDOS_APLICADO.md#ai-004---agents-e-limites-de-autonomia), [AI-005](CADERNO_DE_ESTUDOS_APLICADO.md#ai-005---regra-determinística-vs-ia), [AI-006](CADERNO_DE_ESTUDOS_APLICADO.md#ai-006---minimização-pii-e-dados-financeiros), [AI-007](CADERNO_DE_ESTUDOS_APLICADO.md#ai-007---prompt-injection-e-conteúdo-não-confiável), [AI-008](CADERNO_DE_ESTUDOS_APLICADO.md#ai-008---evals) e [AI-009](CADERNO_DE_ESTUDOS_APLICADO.md#ai-009---tracing-custo-e-versionamento-de-prompts), [AI-011](CADERNO_DE_ESTUDOS_APLICADO.md#ai-011---seleção-de-modelo-fallback-e-resiliência) e [AI-012](CADERNO_DE_ESTUDOS_APLICADO.md#ai-012---human-in-the-loop);
- [SEC-012](CADERNO_DE_ESTUDOS_APLICADO.md#sec-012---privacy-by-design-e-data-minimization) e [SEC-016](CADERNO_DE_ESTUDOS_APLICADO.md#sec-016---terceiros-e-política-de-dados-para-ia);
- [OBS-010](CADERNO_DE_ESTUDOS_APLICADO.md#obs-010---observabilidade-de-ia);
- [ARCH-015](CADERNO_DE_ESTUDOS_APLICADO.md#arch-015---timeout-retry-backoff-e-circuit-breaker).

Saídas:
- AI Data Policy;
- contratos das tools;
- eval dataset;
- budget de custo;
- fallback sem IA.

### Fase I - Staging e produção

Estudar:
- [DEV-006](CADERNO_DE_ESTUDOS_APLICADO.md#dev-006---cd-e-promoção-de-artefatos), [DEV-007](CADERNO_DE_ESTUDOS_APLICADO.md#dev-007---health-liveness-e-readiness), [DEV-008](CADERNO_DE_ESTUDOS_APLICADO.md#dev-008---registry-e-artefatos-imutáveis), [DEV-009](CADERNO_DE_ESTUDOS_APLICADO.md#dev-009---ambientes-e-dados-sintéticos), [DEV-010](CADERNO_DE_ESTUDOS_APLICADO.md#dev-010---release-rollback-e-migrations), [DEV-011](CADERNO_DE_ESTUDOS_APLICADO.md#dev-011---dns-tls-e-domínio-de-produção), [DEV-012](CADERNO_DE_ESTUDOS_APLICADO.md#dev-012---primitivas-de-cloud-e-escolha-de-plataforma) e [DEV-013](CADERNO_DE_ESTUDOS_APLICADO.md#dev-013---backup-restore-rpo-e-rto), [DEV-015](CADERNO_DE_ESTUDOS_APLICADO.md#dev-015---secrets-no-ci-e-identidade-de-workload) e [DEV-016](CADERNO_DE_ESTUDOS_APLICADO.md#dev-016---custos-e-capacidade);
- [DB-009](CADERNO_DE_ESTUDOS_APLICADO.md#db-009---connection-pooling) e [DB-010](CADERNO_DE_ESTUDOS_APLICADO.md#db-010---backup-restore-rpo-e-rto);
- [SEC-007](CADERNO_DE_ESTUDOS_APLICADO.md#sec-007---criptografia-em-trânsito-em-repouso-e-por-campo), [SEC-010](CADERNO_DE_ESTUDOS_APLICADO.md#sec-010---rate-limiting-quotas-e-abuso), [SEC-011](CADERNO_DE_ESTUDOS_APLICADO.md#sec-011---logging-seguro-e-redaction), [SEC-013](CADERNO_DE_ESTUDOS_APLICADO.md#sec-013---retenção-exportação-e-eliminação), [SEC-014](CADERNO_DE_ESTUDOS_APLICADO.md#sec-014---incident-response), [SEC-015](CADERNO_DE_ESTUDOS_APLICADO.md#sec-015---audit-logging), [SEC-016](CADERNO_DE_ESTUDOS_APLICADO.md#sec-016---terceiros-e-política-de-dados-para-ia), [SEC-017](CADERNO_DE_ESTUDOS_APLICADO.md#sec-017---uploads-e-parsing-seguro), [SEC-018](CADERNO_DE_ESTUDOS_APLICADO.md#sec-018---supply-chain-e-dependências) e [SEC-019](CADERNO_DE_ESTUDOS_APLICADO.md#sec-019---security-testing-e-owasp-asvs);
- [OBS-001](CADERNO_DE_ESTUDOS_APLICADO.md#obs-001---logs-métricas-e-traces), [OBS-002](CADERNO_DE_ESTUDOS_APLICADO.md#obs-002---structured-logging-e-redaction), [OBS-003](CADERNO_DE_ESTUDOS_APLICADO.md#obs-003---correlation-id-e-trace-context), [OBS-004](CADERNO_DE_ESTUDOS_APLICADO.md#obs-004---métricas-e-cardinalidade), [OBS-005](CADERNO_DE_ESTUDOS_APLICADO.md#obs-005---opentelemetry-e-tracing), [OBS-006](CADERNO_DE_ESTUDOS_APLICADO.md#obs-006---sli-slo-e-error-budget), [OBS-007](CADERNO_DE_ESTUDOS_APLICADO.md#obs-007---alertas-acionáveis), [OBS-008](CADERNO_DE_ESTUDOS_APLICADO.md#obs-008---dashboards-operacionais), [OBS-009](CADERNO_DE_ESTUDOS_APLICADO.md#obs-009---observabilidade-de-filas-e-workers), [OBS-010](CADERNO_DE_ESTUDOS_APLICADO.md#obs-010---observabilidade-de-ia) e [OBS-011](CADERNO_DE_ESTUDOS_APLICADO.md#obs-011---runbooks-e-postmortems);
- [TEST-004](CADERNO_DE_ESTUDOS_APLICADO.md#test-004---e2e-api-e-frontend), [TEST-008](CADERNO_DE_ESTUDOS_APLICADO.md#test-008---performance-e-load-tests), [TEST-009](CADERNO_DE_ESTUDOS_APLICADO.md#test-009---security-regression-tests) e [TEST-010](CADERNO_DE_ESTUDOS_APLICADO.md#test-010---dados-sintéticos-e-privacidade-em-testes).

Saídas:
- deployment runbook;
- restore drill;
- incident response;
- observabilidade;
- security acceptance checklist;
- staging sem dados pessoais reais.

### Fase J - Evolução e escala

Somente depois de requisito real ou laboratório deliberado:
- [ARCH-005](CADERNO_DE_ESTUDOS_APLICADO.md#arch-005---event-driven-architecture), [ARCH-006](CADERNO_DE_ESTUDOS_APLICADO.md#arch-006---eventual-consistency) e [ARCH-007](CADERNO_DE_ESTUDOS_APLICADO.md#arch-007---transactional-outbox);
- [ARCH-009 — Kafka](CADERNO_DE_ESTUDOS_APLICADO.md#arch-009---kafka-e-event-streaming);
- [ARCH-010 — CQRS](CADERNO_DE_ESTUDOS_APLICADO.md#arch-010---cqrs);
- [ARCH-011 — Event Sourcing](CADERNO_DE_ESTUDOS_APLICADO.md#arch-011---event-sourcing);
- [DEV-014 — IaC](CADERNO_DE_ESTUDOS_APLICADO.md#dev-014---infrastructure-as-code);
- [AI-010 — RAG](CADERNO_DE_ESTUDOS_APLICADO.md#ai-010---embeddings-e-rag);
- Open Finance.

## 6. Trilhas

| Trilha no Caderno | Prioridade |
|---|---|
| [Backend](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-de-estudos---backend) | Alta |
| [Banco de Dados](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-de-estudos---banco-de-dados-e-persistência) | Alta |
| [Segurança e Privacidade](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-03---segurança-e-privacidade) | Crítica |
| [DevOps e Infraestrutura](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-04---devops-e-infraestrutura) | Alta |
| [Observabilidade](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-05---observabilidade-e-operação) | Alta antes de produção |
| [Arquitetura/Sistemas Distribuídos](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-06---arquitetura-e-sistemas-distribuídos) | Alta; avançados sob demanda |
| [IA e Agentes](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-07---ia-aplicada-com-segurança) | Média até a fase de IA |
| [Testes e Qualidade](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-08---testes-e-qualidade) | Alta |
| [Domínio Financeiro](CADERNO_DE_ESTUDOS_APLICADO.md#trilha-09---domínio-financeiro-da-aplicação) | Crítica |

## 7. Rotina para cada tópico

1. Leia o tópico correspondente no [Caderno de Estudos](CADERNO_DE_ESTUDOS_APLICADO.md).
2. Consulte documentação oficial.
3. Escreva uma explicação curta com suas palavras.
4. Faça o laboratório sugerido.
5. Tente quebrar a solução.
6. Aplique ao projeto somente se o requisito existir.
7. Escreva testes negativos e positivos.
8. Compare alternativas.
9. Registre ADR quando houver decisão.
10. Só então delegue implementação mais extensa ao Codex.
11. Revise o código gerado até conseguir explicar cada parte relevante.

## 8. Uso do Codex durante o estudo

O Codex pode acelerar scaffolding, fixtures, testes, laboratórios, refactors e documentação.

Ele não deve decidir silenciosamente:
- estratégia de autenticação;
- regra financeira;
- isolamento de dados;
- política de retenção;
- tecnologia distribuída;
- comportamento de erro;
- uso de dados pela IA.

Exemplo:

```text
Implemente um laboratório para DB-008 (RLS).
Não altere a arquitetura do produto.
Crie Household A e B.
Inclua testes de SELECT, INSERT e UPDATE cruzados.
Use a mesma role da aplicação, não superuser.
Documente limitações encontradas com ORM e pooling.
Não marque RLS como decisão final.
```

## 9. Checkpoint antes de cada fase

Responda:
1. quais conceitos novos entram?
2. quais ainda não consigo explicar?
3. há risco novo de segurança ou privacidade?
4. existe decisão `NÃO DEFINIDO` bloqueando a fase?
5. qual laboratório barato reduz incerteza?
6. qual teste prova a regra mais importante?
7. como a feature será observada?
8. como ela falha?
9. como será recuperada?
10. o Codex recebeu especificação suficiente para não inventar regra?

## 10. Checkpoint fullstack esperado no MVP

Você deve conseguir explicar:
- ciclo de uma request Next -> Nest -> PostgreSQL;
- autenticação versus autorização;
- isolamento Household A/B;
- por que dinheiro não usa float;
- atomicidade de transferência;
- idempotência de import;
- queue/worker e retry;
- por que BullMQ pode bastar e Kafka ainda não;
- migrations compatíveis com produção;
- CI versus CD;
- image versus container;
- liveness versus readiness;
- log versus métrica versus trace;
- RPO versus RTO;
- restore de backup;
- quais dados podem ir para IA;
- como um incidente de vazamento seria detectado e contido;
- como uma release vai do PR à produção e como reverter.

## 11. Próxima etapa imediata

Antes de iniciar código de produto no monorepo, concluir em conjunto:
1. DOM-001 a DOM-005;
2. DB-002;
3. SEC-001;
4. SEC-002;
5. modelo de Household/Transaction;
6. ADRs de Money, cartão/fatura e arquitetura base.
