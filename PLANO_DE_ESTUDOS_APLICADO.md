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
- DOM-001 a DOM-005;
- DB-001 a DB-003;
- BACK-001 e BACK-002;
- ARCH-001 a ARCH-003;
- SEC-001 a SEC-003;
- TEST-001.

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
- BACK-003 a BACK-005;
- DEV-001 a DEV-005;
- TEST-002, TEST-003 e TEST-007;
- SEC-008 e SEC-018.

Saídas:
- diretórios `prumo-web/` e `prumo-api/` do monorepo preparados para o bootstrap;
- API e web mínimas;
- configuração validada;
- Docker Compose;
- CI;
- PostgreSQL real em testes de integração.

### Fase C - Identity + Household

Estudar:
- BACK-006;
- SEC-003 a SEC-006;
- DB-008;
- TEST-009;
- ARCH-013.

Saídas:
- ADR de autenticação;
- matriz de permissões;
- suite de isolamento Household A/B;
- experimento de RLS;
- decisão sobre RLS.

### Fase D - Accounts + Transactions

Estudar:
- DOM-002, DOM-003, DOM-006 e DOM-007;
- BACK-007 a BACK-009;
- DB-005 e DB-006;
- TEST-005.

Saídas:
- regras de atomicidade;
- estratégia de idempotência;
- invariantes monetários;
- tratamento de concorrência.

### Fase E - Credit Cards + Installments

Estudar:
- DOM-004 e DOM-005;
- DB-003/005;
- TEST-005.

Saída principal:
- ADR de compra, fatura, pagamento, competência e parcelamento.

### Fase F - Import Pipeline

Estudar:
- BACK-008, BACK-010 e BACK-011;
- ARCH-003, ARCH-004 e ARCH-008;
- SEC-017;
- OBS-003 e OBS-009.

Saídas:
- upload policy;
- retenção de arquivo;
- idempotência;
- queue semantics;
- observabilidade do worker.

### Fase G - Analytics + Insights determinísticos

Estudar:
- DB-004 e DB-012;
- DOM-008 a DOM-012;
- BACK-012 e BACK-013;
- OBS-004 e OBS-008;
- ARCH-012 somente se houver caso real de cache.

Saídas:
- catálogo de métricas;
- fórmulas versionadas;
- snapshots;
- benchmark de queries;
- dashboards.

### Fase H - IA

Estudar:
- AI-001 a AI-009, AI-011 e AI-012;
- SEC-012 e SEC-016;
- OBS-010;
- ARCH-015.

Saídas:
- AI Data Policy;
- contratos das tools;
- eval dataset;
- budget de custo;
- fallback sem IA.

### Fase I - Staging e produção

Estudar:
- DEV-006 a DEV-013, DEV-015 e DEV-016;
- DB-009 e DB-010;
- SEC-007, SEC-010, SEC-011, SEC-013 a SEC-019;
- OBS-001 a OBS-011;
- TEST-004, TEST-008, TEST-009 e TEST-010.

Saídas:
- deployment runbook;
- restore drill;
- incident response;
- observabilidade;
- security acceptance checklist;
- staging sem dados pessoais reais.

### Fase J - Evolução e escala

Somente depois de requisito real ou laboratório deliberado:
- ARCH-005 a ARCH-007;
- ARCH-009 Kafka;
- ARCH-010 CQRS;
- ARCH-011 Event Sourcing;
- DEV-014 IaC;
- AI-010 RAG;
- Open Finance.

## 6. Trilhas

| Trilha | Arquivo | Prioridade |
|---|---|---|
| Backend | `study/01-backend.md` | Alta |
| Banco de Dados | `study/02-database.md` | Alta |
| Segurança e Privacidade | `study/03-security-privacy.md` | Crítica |
| DevOps e Infraestrutura | `study/04-devops-infra.md` | Alta |
| Observabilidade | `study/05-observability.md` | Alta antes de produção |
| Arquitetura/Sistemas Distribuídos | `study/06-architecture-distributed-systems.md` | Alta; avançados sob demanda |
| IA e Agentes | `study/07-ai.md` | Média até a fase de IA |
| Testes e Qualidade | `study/08-testing-quality.md` | Alta |
| Domínio Financeiro | `study/09-domain-finance.md` | Crítica |

## 7. Rotina para cada tópico

1. Leia o item no plano de estudo.
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
