---
title: "Caderno de Estudos Aplicado"
subtitle: "Plataforma de Inteligência Financeira Doméstica"
author: "Documento de estudo do projeto"
date: "05 de outubro de 2026"
lang: pt-BR
geometry: margin=2.0cm
fontsize: 10.5pt
---

# Caderno de Estudos Aplicado

Este caderno reúne explicações, exercícios, perguntas de revisão e critérios de conclusão dos tópicos de estudo do Prumo. Consulte o [Plano de Estudos](PLANO_DE_ESTUDOS_APLICADO.md) para a ordem das fases, os pré-requisitos e os checkpoints. O andamento das sprints fica no [Plano de Desenvolvimento](docs/planning/PLANO_DE_DESENVOLVIMENTO.md).

Os exemplos deste caderno servem ao aprendizado. Regras de produto e domínio vêm do [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) e das decisões aceitas em [`docs/decisions/`](docs/decisions/); o comportamento implementado é descrito pelo código e pelos testes.

# Trilha de Estudos - Backend

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase B](PLANO_DE_ESTUDOS_APLICADO.md#fase-b---bootstrap-de-engenharia), [fase C](PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household), [fase D](PLANO_DE_ESTUDOS_APLICADO.md#fase-d---accounts--transactions), [fase F](PLANO_DE_ESTUDOS_APLICADO.md#fase-f---import-pipeline), [fase G](PLANO_DE_ESTUDOS_APLICADO.md#fase-g---analytics--insights-determinísticos).

Objetivo: entender o ciclo completo de uma operação backend, do HTTP à persistência, e ser capaz de implementar regras de negócio sem transformar o framework em uma caixa-preta.

| ID | Tema | Momento |
|---|---|---|
| BACK-001 | HTTP e ciclo da request | antes da API real |
| BACK-002 | REST e contratos | antes dos endpoints |
| BACK-003 | NestJS, módulos e DI | bootstrap |
| BACK-004 | DTOs e validação | primeiras APIs |
| BACK-005 | Erros | primeiras APIs |
| BACK-006 | AuthN/AuthZ | Household |
| BACK-007 | Transactions de banco | Transactions |
| BACK-008 | Idempotência | Imports |
| BACK-009 | Concorrência | Transactions/Imports |
| BACK-010 | Jobs/workers | Import Pipeline |
| BACK-011 | Upload/streaming | Import Pipeline |
| BACK-012 | Cache | após medir |
| BACK-013 | Paginação/filtros | listagens |
| BACK-014 | Compatibilidade de API | evolução |
| BACK-015 | Integration testing | desde persistência |

## BACK-001 - HTTP e ciclo de vida de uma request

**Nível:** Fundamental  
**Quando estudar:** Antes de controllers reais  
**Pré-requisitos:** Web/TypeScript

### O que é
HTTP define requests e responses por método, URL, headers, body e status. No servidor, uma request atravessa proxy, middleware, autenticação, validação, autorização, controller, caso de uso, banco e serialização.

### Qual problema resolve
Sem esse mapa mental, CORS, cookies, proxies, status HTTP e exceções parecem magia do framework.

### Como aparece neste projeto
Next.js consumirá NestJS; login poderá usar cookie, imports multipart, listagens query params e erros contratos estáveis.

### O que estudar
- GET/POST/PUT/PATCH/DELETE; 2xx/4xx/5xx; headers/cookies; Content-Type/Accept; CORS; proxies; X-Forwarded-*; timeout.

### Exercício aplicado
Criar `/debug/request` que devolve somente metadados não sensíveis. Chamar via curl e browser variando headers, query e body.

### Como validar/testar
Testar 200, 400, 404, 415 e garantir que input inválido não chega ao domínio.

### Erros comuns
- usar GET para alterar estado; - devolver 200 para erro; - achar que CORS é autorização; - confiar cegamente em headers do cliente.

### Perguntas que você deve conseguir responder
- 401 e 403 diferem como? - cookie e Authorization diferem como? - o que o proxy muda?

### Critério de conclusão
Desenhar o caminho browser -> API -> domínio -> DB e localizar cada controle.

### Referências recomendadas
- https://developer.mozilla.org/en-US/docs/Web/HTTP

---

## BACK-002 - REST, recursos e contratos

**Nível:** Fundamental  
**Quando estudar:** Antes da API de Accounts/Transactions  
**Pré-requisitos:** BACK-001

### O que é
REST é um estilo de modelagem. Aqui importa criar recursos previsíveis, usar semântica HTTP coerente e separar contrato público de detalhes internos.

### Qual problema resolve
Contratos ruins acoplam frontend ao ORM e tornam evolução/erros inconsistentes.

### Como aparece neste projeto
`/accounts`, `/transactions`, `/imports` e ações explícitas de domínio terão DTOs, status e erros documentados.

### O que estudar
- recurso x comando; DTO request/response; OpenAPI; paginação; error schema; mudanças compatíveis.

### Exercício aplicado
Desenhar o contrato completo de criar/listar/editar uma Transaction sem implementar.

### Como validar/testar
Criar contract test para um endpoint e validar schema.

### Erros comuns
- retornar entidade do ORM; - endpoints `/doSomething`; - erros sem code estável.

### Perguntas que você deve conseguir responder
- quando PATCH > PUT? - quando uma ação explícita > CRUD? - por que ORM entity não é API?

### Critério de conclusão
Revisar uma API e apontar acoplamento, segurança e breaking changes.

---

## BACK-003 - NestJS, módulos e Dependency Injection

**Nível:** Fundamental  
**Quando estudar:** Bootstrap  
**Pré-requisitos:** TypeScript, BACK-001

### O que é
NestJS organiza código em Modules, Controllers e Providers. DI permite receber dependências em vez de instanciá-las diretamente.

### Qual problema resolve
Evita services gigantes, melhora testes e permite substituir infra sem espalhar mudanças.

### Como aparece neste projeto
Módulos: Identity, Households, Accounts, Transactions, Imports, Analytics, Insights.

### O que estudar
- modules/imports/exports; providers; tokens; scopes; circular dependencies; composição por domínio.

### Exercício aplicado
Criar módulos `health` e `clock`; injetar um relógio substituível em testes.

### Como validar/testar
Trocar provider por fake e provar tempo determinístico.

### Erros comuns
- `new Repository()` dentro de service; - `SharedModule` infinito; - `forwardRef` como curativo.

### Perguntas que você deve conseguir responder
- o que DI resolve além de mock? - quando usar token? - por que módulo por domínio?

### Critério de conclusão
Criar um módulo isolado e explicar suas dependências.

### Referências recomendadas
- https://docs.nestjs.com/modules
- https://docs.nestjs.com/fundamentals/custom-providers

---

## BACK-004 - DTOs, parsing e validação

**Nível:** Fundamental  
**Quando estudar:** Primeiros endpoints  
**Pré-requisitos:** BACK-002/003

### O que é
DTO descreve entrada/saída. Validação estrutural impede formato inválido antes da regra de negócio; validação semântica pertence ao domínio/aplicação.

### Qual problema resolve
Entrada externa nunca é confiável. Sem fronteira clara, valores impossíveis chegam ao core.

### Como aparece neste projeto
Money, datas, IDs, filtros e imports terão schemas; `accountId pertence ao household` continua sendo regra semântica.

### O que estudar
- schema validation; coercion; whitelist; unknown fields; datas; money; mensagens de erro.

### Exercício aplicado
Criar DTO de Transaction e ao menos dez inputs inválidos.

### Como validar/testar
Testes parametrizados para zero, negativo, extremo, datas ruins e campos extras.

### Erros comuns
- validar só no frontend; - DTO = entity; - converter money para float.

### Perguntas que você deve conseguir responder
- o que é estrutural vs regra de negócio?

### Critério de conclusão
Implementar as duas camadas de validação e explicar a diferença.

---

## BACK-005 - Taxonomia de erros e falhas

**Nível:** Fundamental  
**Quando estudar:** Primeiras APIs  
**Pré-requisitos:** BACK-001/004

### O que é
Erros esperados de domínio, validação, auth e conflito precisam ser diferentes de falhas inesperadas de infraestrutura.

### Qual problema resolve
Sem taxonomia, frontend não sabe reagir e respostas podem vazar SQL/stack/secrets.

### Como aparece neste projeto
Casos como `TRANSACTION_NOT_FOUND`, `IMPORT_ALREADY_CONFIRMED`, `HOUSEHOLD_FORBIDDEN` terão codes estáveis.

### O que estudar
- exception filter; domain error; retryable/non-retryable; 409; sanitização; requestId.

### Exercício aplicado
Definir catálogo inicial de errors para Accounts/Transactions.

### Como validar/testar
Provar que stack trace não sai na response e falha inesperada possui requestId.

### Erros comuns
- usar message textual como contrato; - 500 para validação; - logar erro esperado como incidente crítico.

### Perguntas que você deve conseguir responder
- 400/404/409? - quando retry faz sentido?

### Critério de conclusão
Ter error contract estável e observável.

---

## BACK-006 - Autenticação e autorização no backend

**Nível:** Fundamental  
**Quando estudar:** Identity + Household  
**Pré-requisitos:** SEC-003/004

### O que é
Autenticação identifica o principal; autorização decide ação sobre recurso. Um usuário logado não recebe acesso automático a tudo.

### Qual problema resolve
IDOR/BOLA nasce quando API consulta por ID sem validar household/ownership.

### Como aparece neste projeto
Todo comando financeiro verifica membership/permissão antes de ler ou mutar.

### O que estudar
- Guards; principal context; RBAC; resource policies; 401/403; RLS como defesa extra.

### Exercício aplicado
Implementar `GetTransaction(actor, household, id)` e bloquear recurso de Household B.

### Como validar/testar
Suite negativa A/B tanto na aplicação quanto no banco, se RLS adotado.

### Erros comuns
- autorização só no controller; - householdId do body como autoridade; - esconder botão como segurança.

### Perguntas que você deve conseguir responder
- role e permission diferem como? - por que `WHERE id=?` é insuficiente?

### Critério de conclusão
Provar por teste que login válido não permite acesso cross-household.

---

## BACK-007 - Transactions de banco e atomicidade

**Nível:** Fundamental  
**Quando estudar:** Accounts + Transactions  
**Pré-requisitos:** DB-005

### O que é
Uma transaction de banco agrupa escritas que confirmam/revertem juntas. Não confundir com Transaction financeira do domínio.

### Qual problema resolve
Operação parcial pode corromper transferência, split e import.

### Como aparece neste projeto
Transferência interna pode persistir movimentos vinculados; falha no segundo não pode deixar o primeiro.

### O que estudar
- BEGIN/COMMIT/ROLLBACK; ACID; boundary; side effects externos; retry.

### Exercício aplicado
Injetar falha entre débito e crédito.

### Como validar/testar
Após rollback, consultar banco e provar ausência de estado parcial.

### Erros comuns
- chamada de rede dentro de transaction longa; - publicar evento antes do commit.

### Perguntas que você deve conseguir responder
- e-mail dentro da transaction é ruim por quê? - onde publicar evento?

### Critério de conclusão
Desenhar boundary transacional por caso de uso.

---

## BACK-008 - Idempotência

**Nível:** Intermediário  
**Quando estudar:** Imports e comandos críticos  
**Pré-requisitos:** HTTP + constraints

### O que é
Operação idempotente tolera repetição sem criar efeitos duplicados adicionais.

### Qual problema resolve
Timeouts, retries e delivery at-least-once fazem a mesma operação chegar mais de uma vez.

### Como aparece neste projeto
Mesmo CSV/OFX, confirmação de import e jobs repetidos não podem duplicar transações.

### O que estudar
- Idempotency-Key; dedup key; UNIQUE; estados PROCESSING/COMPLETED; retenção da key.

### Exercício aplicado
Disparar dez requests concorrentes com mesma chave e persistir um efeito.

### Como validar/testar
Repetir após timeout simulado e reboot.

### Erros comuns
- chave só em memória; - hash frágil; - idempotência sem constraint persistente.

### Perguntas que você deve conseguir responder
- idempotência HTTP e deduplicação de negócio diferem como?

### Critério de conclusão
Implementar garantia persistente e explicar janela/limites.

---

## BACK-009 - Concorrência e race conditions

**Nível:** Intermediário  
**Quando estudar:** Transactions/Imports  
**Pré-requisitos:** DB-005/006

### O que é
Race condition ocorre quando resultado depende da ordem concorrente. Locks, versões, constraints e isolation levels são ferramentas.

### Qual problema resolve
Dois requests podem atualizar budget/import ao mesmo tempo e perder dados.

### Como aparece neste projeto
Imports paralelos e alterações de budget serão laboratórios.

### O que estudar
- lost update; optimistic/pessimistic locking; FOR UPDATE; version column; retries.

### Exercício aplicado
Criar duas atualizações simultâneas no mesmo budget e reproduzir lost update.

### Como validar/testar
Rodar repetidamente até a correção ser determinística.

### Erros comuns
- mutex em memória em sistema com múltiplas instâncias; - serializable para tudo.

### Perguntas que você deve conseguir responder
- quando optimistic locking? - por que mutex Node não protege réplicas?

### Critério de conclusão
Reproduzir e corrigir uma race de forma explicável.

---

## BACK-010 - Jobs, filas e workers

**Nível:** Intermediário  
**Quando estudar:** Import Pipeline  
**Pré-requisitos:** ARCH-004/008

### O que é
Fila desacopla request HTTP de trabalho lento/retriável. Worker consome jobs com política de retry, timeout e concorrência.

### Qual problema resolve
Parsing, categorização e recomputação podem exceder request e falhar transitoriamente.

### Como aparece neste projeto
Upload cria ImportJob; worker processa staging e atualiza progresso.

### O que estudar
- producer/consumer; ack; retry/backoff; dead-letter; job idempotency; graceful shutdown.

### Exercício aplicado
Worker que falha duas vezes e conclui na terceira.

### Como validar/testar
Testar morte após persistir, retry e poison job.

### Erros comuns
- acreditar em exactly-once; - retry infinito; - payload financeiro gigante.

### Perguntas que você deve conseguir responder
- o que ocorre se morrer após persistir antes do ACK?

### Critério de conclusão
Explicar delivery semantics da solução escolhida.

### Referências recomendadas
- https://docs.nestjs.com/techniques/queues

---

## BACK-011 - Upload, streaming e arquivos não confiáveis

**Nível:** Intermediário  
**Quando estudar:** Import Pipeline  
**Pré-requisitos:** SEC-017

### O que é
Uploads são input binário externo e precisam limites de tamanho, validação de formato, storage seguro e processamento controlado.

### Qual problema resolve
Arquivo grande/malformado pode consumir memória, explorar parser ou expor dados.

### Como aparece neste projeto
CSV/OFX terão retenção explícita e chave de storage gerada pelo servidor.

### O que estudar
- multipart; streaming; MIME x extensão; checksum; signed URL; timeout; retention.

### Exercício aplicado
Enviar extensão `.csv` com conteúdo inválido, arquivo grande e filename malicioso.

### Como validar/testar
Validar limite antes de bufferizar tudo e nenhuma path usa filename cru.

### Erros comuns
- confiar em extensão; - guardar original para sempre; - path traversal.

### Perguntas que você deve conseguir responder
- quando streaming importa? - por que filename do usuário não vira chave?

### Critério de conclusão
Implementar upload com limites e lifecycle.

---

## BACK-012 - Cache e invalidação

**Nível:** Intermediário  
**Quando estudar:** Só após medir  
**Pré-requisitos:** DB-004/OBS-004

### O que é
Cache guarda cópia derivada para reduzir custo/latência; o problema central é invalidação e staleness.

### Qual problema resolve
Redis sem requisito cria estado duplicado e bugs.

### Como aparece neste projeto
Candidatos futuros: config do household e aggregates de dashboard.

### O que estudar
- cache-aside; TTL; invalidation; stampede; namespace por household.

### Exercício aplicado
Medir query real, aplicar cache e comparar.

### Como validar/testar
Mutation deve invalidar e Household B nunca compartilhar key.

### Erros comuns
- cachear tudo; - TTL como consistência; - key sem household.

### Perguntas que você deve conseguir responder
- qual source of truth? - quanto stale é aceitável?

### Critério de conclusão
Justificar cache com benchmark.

---

## BACK-013 - Paginação, filtros e ordenação

**Nível:** Fundamental  
**Quando estudar:** Listagens reais  
**Pré-requisitos:** DB-004

### O que é
Paginação limita volume; filtros/ordenação precisam allowlist e índices adequados.

### Qual problema resolve
Carregar todas as transações degrada e expõe endpoints a consultas caras.

### Como aparece neste projeto
Transactions filtrará período, conta, categoria, tipo e texto.

### O que estudar
- offset x cursor; stable ordering; allowlist; índices compostos; N+1.

### Exercício aplicado
Gerar 100k rows e comparar paginação profunda.

### Como validar/testar
Testar inserções concorrentes sem duplicação/omissão indevida.

### Erros comuns
- ORDER BY arbitrário; - cursor não determinístico.

### Perguntas que você deve conseguir responder
- quando cursor supera offset?

### Critério de conclusão
Projetar listagem previsível e eficiente.

---

## BACK-014 - Compatibilidade e versionamento de API

**Nível:** Intermediário  
**Quando estudar:** Evolução  
**Pré-requisitos:** BACK-002

### O que é
Compatibilidade permite backend/frontend de versões próximas coexistirem; versionamento é uma ferramenta, não reflexo automático.

### Qual problema resolve
Deploys não são realmente atômicos e abas antigas continuam abertas.

### Como aparece neste projeto
Enums, DTOs e errors devem evoluir de forma aditiva quando possível.

### O que estudar
- additive changes; deprecation; expand/contract; contract testing; v2.

### Exercício aplicado
Simular frontend N-1 contra backend N.

### Como validar/testar
Contract test com schema anterior.

### Erros comuns
- versionar qualquer detalhe; - remover campo abruptamente.

### Perguntas que você deve conseguir responder
- quando mudança exige v2?

### Critério de conclusão
Planejar breaking change sem downtime.

---

## BACK-015 - Testes de integração do backend

**Nível:** Fundamental  
**Quando estudar:** Desde persistência  
**Pré-requisitos:** TEST-003/007

### O que é
Integration test exercita DB/Redis/queue reais quando o comportamento depende da infraestrutura.

### Qual problema resolve
Mocks não provam FK, RLS, SQL, locks ou migrations.

### Como aparece neste projeto
Isolamento A/B, atomicidade, idempotência e jobs precisam infra real.

### O que estudar
- Testcontainers; migrations; fixtures; cleanup; fake clock.

### Exercício aplicado
Subir PostgreSQL efêmero e executar suite de isolamento.

### Como validar/testar
O teste deve falhar se constraint/policy for removida.

### Erros comuns
- mockar tudo; - DB manual compartilhado.

### Perguntas que você deve conseguir responder
- o que unit test não consegue provar?

### Critério de conclusão
Suite reproduzível local/CI.

---


\newpage

---
date: "05 de outubro de 2026"
lang: pt-BR
---
# Trilha de Estudos - Banco de Dados e Persistência

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase C](PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household), [fase D](PLANO_DE_ESTUDOS_APLICADO.md#fase-d---accounts--transactions), [fase E](PLANO_DE_ESTUDOS_APLICADO.md#fase-e---credit-cards--installments), [fase G](PLANO_DE_ESTUDOS_APLICADO.md#fase-g---analytics--insights-determinísticos), [fase I](PLANO_DE_ESTUDOS_APLICADO.md#fase-i---staging-e-produção).

PostgreSQL é hipótese principal. A meta é aprender o comportamento do banco, não somente APIs do ORM.

| ID | Tema |
|---|---|
| DB-001 | Modelagem relacional |
| DB-002 | Dinheiro e precisão |
| DB-003 | Constraints |
| DB-004 | Índices/query plans |
| DB-005 | ACID/isolation |
| DB-006 | Locks/deadlocks |
| DB-007 | Migrations |
| DB-008 | RLS |
| DB-009 | Connection pooling |
| DB-010 | Backup/restore/RPO/RTO |
| DB-011 | Retenção/exclusão |
| DB-012 | Agregações/snapshots |

## DB-001 - Modelagem relacional e normalização

**Nível:** Fundamental  
**Quando estudar:** Antes do ERD final  
**Pré-requisitos:** SQL básico

### O que é
Modelagem relacional representa fatos em tabelas com chaves e relacionamentos. Normalização reduz redundância; desnormalização só entra por motivo mensurável.

### Qual problema resolve
Modelo ruim espalha ambiguidade entre contas, cartões, parcelas, transferências e histórico.

### Como aparece neste projeto
Precisaremos modelar Accounts, Transactions, Transfer links, CreditCardPurchase/Installments e splits.

### O que estudar
- PK/FK; 1:1/1:N/N:N; normal forms práticas; source of truth; histórico vs estado.

### Exercício aplicado
Desenhar três alternativas para cartão e comparar.

### Como validar/testar
Fixtures de salário, transfer, compra, estorno, parcelamento e split devem caber no modelo.

### Erros comuns
- tabela genérica com dezenas de nulos; - JSON para tudo; - duplicar derivados sem sincronização.

### Perguntas que você deve conseguir responder
- qual fonte de verdade do saldo? - quando denormalizar?

### Critério de conclusão
Defender ERD por regras do domínio.

---

## DB-002 - Representação de dinheiro e precisão

**Nível:** Fundamental  
**Quando estudar:** Antes de persistir amount  
**Pré-requisitos:** DB-001

### O que é
Valores financeiros não devem depender de ponto flutuante binário. Alternativas comuns: integer de menor unidade ou NUMERIC/DECIMAL.

### Qual problema resolve
Centavos inconsistentes quebram reconciliação, splits e totals.

### Como aparece neste projeto
Amounts, budgets, balances e patrimônio precisam uma estratégia única e regra de arredondamento.

### O que estudar
- integer cents; NUMERIC(p,s); decimal libs; ISO currency; rounding.

### Exercício aplicado
Somar milhares de valores com JS Number e com a estratégia candidata; ratear R$10 entre 3 splits.

### Como validar/testar
Testes para 0,01; negativos; máximos; divisão; resto.

### Erros comuns
- float/double; - arredondar só na UI; - assumir BRL sem currency.

### Perguntas que você deve conseguir responder
- integer cents vs DECIMAL? - como distribuir resto?

### Critério de conclusão
Registrar ADR de Money Representation e testes de rounding.

---

## DB-003 - Constraints e integridade

**Nível:** Fundamental  
**Quando estudar:** Modelo de dados  
**Pré-requisitos:** DB-001

### O que é
Constraints fazem o banco rejeitar estados inválidos independentemente do caminho de escrita.

### Qual problema resolve
Regra só na aplicação pode ser esquecida por import, script ou endpoint futuro.

### Como aparece neste projeto
UNIQUE membership, fingerprints de import, FKs, CHECKs de estado e NOT NULL serão avaliados.

### O que estudar
- NOT NULL; UNIQUE; CHECK; FK; ON DELETE; deferrable.

### Exercício aplicado
Listar invariantes e marcar: banco, aplicação ou ambos.

### Como validar/testar
Tentar inserir estados inválidos diretamente no DB.

### Erros comuns
- remover FK “por performance” sem medir; - cascade delete impensado.

### Perguntas que você deve conseguir responder
- quando regra pertence ao DB? - quando CASCADE é perigoso?

### Critério de conclusão
Ter matriz de invariantes x enforcement.

---

## DB-004 - Índices e query plans

**Nível:** Intermediário  
**Quando estudar:** Listagens/analytics com volume  
**Pré-requisitos:** SQL

### O que é
Índice acelera certos acessos com custo de escrita/espaço. Planner escolhe estratégia conforme dados/estatísticas.

### Qual problema resolve
Base pequena mascara scans caros; índice demais também custa.

### Como aparece neste projeto
Queries por household/date/account/category são prováveis.

### O que estudar
- B-tree; composto; ordem; partial index; selectivity; EXPLAIN ANALYZE.

### Exercício aplicado
Gerar 1M transactions sintéticas e comparar plans antes/depois.

### Como validar/testar
Guardar plan/latência de benchmark.

### Erros comuns
- índice para toda coluna; - otimizar tabela vazia.

### Perguntas que você deve conseguir responder
- `(household_id,date)` e `(date,household_id)` diferem como?

### Critério de conclusão
Ler um plan simples e justificar índice.

---

## DB-005 - ACID e isolation levels

**Nível:** Intermediário  
**Quando estudar:** Transactions  
**Pré-requisitos:** SQL transactions

### O que é
ACID descreve atomicidade, consistência, isolamento e durabilidade. Isolation level define fenômenos concorrentes observáveis.

### Qual problema resolve
COMMIT/ROLLBACK sozinho não evita todas anomalies.

### Como aparece neste projeto
Transfers, dedup e snapshots podem exigir guarantees diferentes.

### O que estudar
- Read Committed; Repeatable Read; Serializable; lost update; retry.

### Exercício aplicado
Usar duas sessões SQL para reproduzir comportamento concorrente.

### Como validar/testar
Automatizar cenário e testar retry quando aplicável.

### Erros comuns
- Serializable global sem medir; - achar que transaction resolve race automaticamente.

### Perguntas que você deve conseguir responder
- qual isolation default? - quando retry faz parte da solução?

### Critério de conclusão
Escolher nível por caso de uso.

### Referências recomendadas
- https://www.postgresql.org/docs/current/transaction-iso.html

---

## DB-006 - Locks, blocking e deadlocks

**Nível:** Avançado  
**Quando estudar:** Após reproduzir races  
**Pré-requisitos:** DB-005

### O que é
Locks coordenam concorrência; deadlock é espera cíclica e o banco aborta uma transaction.

### Qual problema resolve
Workers paralelos podem bloquear e falhar de modo invisível em desenvolvimento serial.

### Como aparece neste projeto
Imports e budget updates serão laboratórios.

### O que estudar
- row/table locks; FOR UPDATE; lock order; pg_locks; lock timeout.

### Exercício aplicado
Criar deadlock intencional e corrigi-lo por ordering.

### Como validar/testar
Testar retry de deadlock/serialization.

### Erros comuns
- lock amplo; - transaction aberta durante rede.

### Perguntas que você deve conseguir responder
- como detectar blocking query?

### Critério de conclusão
Diagnosticar lock no PostgreSQL.

---

## DB-007 - Migrations seguras

**Nível:** Fundamental  
**Quando estudar:** Desde o primeiro schema  
**Pré-requisitos:** DB-001

### O que é
Migration versiona mudanças de schema. Em produção precisa considerar dados e versões antigas da aplicação.

### Qual problema resolve
Uma coluna NOT NULL ou drop pode bloquear/quebrar rollout.

### Como aparece neste projeto
Vamos usar expand-and-contract para mudanças incompatíveis.

### O que estudar
- nullable -> backfill -> constraint; index concurrently; data migration; owner da migration.

### Exercício aplicado
Planejar evolução de campo opcional para obrigatório sem downtime.

### Como validar/testar
Executar sobre dataset grande sintético e medir.

### Erros comuns
- migration destrutiva no mesmo deploy; - cada réplica executando migration.

### Perguntas que você deve conseguir responder
- quem roda migration? - rollback de schema sempre é possível?

### Critério de conclusão
Escrever plano expand/contract.

---

## DB-008 - PostgreSQL Row-Level Security (RLS)

**Nível:** Intermediário/Avançado  
**Quando estudar:** Identity + Household  
**Pré-requisitos:** DB-003 + SEC-006

### O que é
RLS permite policies por linha no PostgreSQL. Com row security habilitada, queries normais precisam satisfazer policies; owners/bypass exigem cuidado.

### Qual problema resolve
Uma query esquecendo household pode vazar histórico financeiro; RLS pode ser defesa em profundidade.

### Como aparece neste projeto
Experimento usará `household_id` e contexto seguro por sessão/transaction, validando ORM e pooling.

### O que estudar
- ENABLE ROW LEVEL SECURITY; CREATE POLICY; USING; WITH CHECK; roles; bypass; pooling; session state.

### Exercício aplicado
Criar Household A/B e bloquear SELECT/INSERT/UPDATE cruzados pela mesma role da aplicação.

### Como validar/testar
Teste não pode rodar como owner/superuser.

### Erros comuns
- testar como owner; - devolver conexão ao pool com contexto antigo; - achar que RLS substitui autorização.

### Perguntas que você deve conseguir responder
- quem ignora RLS? - USING vs WITH CHECK? - como pooling afeta contexto?

### Critério de conclusão
Produzir ADR com PoC e limitações antes de decidir.

### Referências recomendadas
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.postgresql.org/docs/current/sql-createpolicy.html

---

## DB-009 - Connection pooling

**Nível:** Intermediário  
**Quando estudar:** Staging/produção  
**Pré-requisitos:** PostgreSQL

### O que é
Pool compartilha número controlado de conexões entre requests.

### Qual problema resolve
Múltiplas réplicas podem multiplicar conexões até saturar DB; session state do RLS aumenta risco.

### Como aparece neste projeto
Definiremos pool por instance e possível proxy/PgBouncer conforme plataforma.

### O que estudar
- pool size; acquisition timeout; transaction vs session pooling; leaks; serverless pressure.

### Exercício aplicado
Load test com diferentes réplicas/pools.

### Como validar/testar
Monitorar conexões e limpar session state.

### Erros comuns
- pool enorme; - connection leak; - contexto RLS vazando.

### Perguntas que você deve conseguir responder
- qual budget total de conexões?

### Critério de conclusão
Documentar connection budget.

---

## DB-010 - Backup, restore, RPO e RTO

**Nível:** Fundamental para produção  
**Quando estudar:** Antes de dados reais relevantes  
**Pré-requisitos:** DEV-013

### O que é
Backup só é útil se restaurável. RPO define perda máxima de dados; RTO tempo alvo de recuperação.

### Qual problema resolve
Perda de histórico financeiro e backups expostos têm alto impacto.

### Como aparece neste projeto
Banco e object storage terão retenção, encryption e restore drill.

### O que estudar
- snapshot; PITR; retention; encryption; restore; RPO/RTO.

### Exercício aplicado
Restaurar backup em ambiente descartável e executar smoke tests.

### Como validar/testar
Medir duração e dados perdidos.

### Erros comuns
- backup nunca restaurado; - mesma credencial; - retenção indefinida.

### Perguntas que você deve conseguir responder
- qual RPO/RTO aceitável?

### Critério de conclusão
Runbook executado pelo menos uma vez.

---

## DB-011 - Retenção, exclusão e ciclo de vida

**Nível:** Intermediário  
**Quando estudar:** Antes de abrir a terceiros  
**Pré-requisitos:** SEC-013

### O que é
Lifecycle define por quanto tempo cada dado existe e como é apagado em DB, storage, logs e backups.

### Qual problema resolve
Guardar tudo eternamente amplia blast radius e dificulta exclusão.

### Como aparece neste projeto
OFX/CSV raw, normalized transactions, logs, audit e snapshots terão políticas diferentes.

### O que estudar
- retention schedule; hard/soft delete; tombstone; backup expiry; export.

### Exercício aplicado
Montar data inventory com finalidade/local/retenção/exclusão.

### Como validar/testar
Executar job de expurgo em staging sintético.

### Erros comuns
- soft delete eterno; - esquecer storage/logs.

### Perguntas que você deve conseguir responder
- o que significa apagar quando há backup?

### Critério de conclusão
Ter retention policy implementável.

---

## DB-012 - Agregações, snapshots e dados derivados

**Nível:** Intermediário  
**Quando estudar:** Analytics  
**Pré-requisitos:** DB-004

### O que é
Dados derivados podem ser calculados on-demand ou materializados. Snapshot também ajuda reproduzir métricas históricas.

### Qual problema resolve
Dashboard caro e fórmulas que mudam podem alterar o passado sem rastreabilidade.

### Como aparece neste projeto
MonthlySnapshot poderá guardar formulaVersion e inputs agregados.

### O que estudar
- GROUP BY; window functions; materialized view; snapshot; lineage; recompute.

### Exercício aplicado
Comparar query on-demand com snapshot de 24 meses.

### Como validar/testar
Gerar snapshot duas vezes com mesma entrada e obter mesmo resultado.

### Erros comuns
- snapshot como source of truth sem lineage; - fórmula sem versionamento.

### Perguntas que você deve conseguir responder
- como reproduzir número de 6 meses atrás?

### Critério de conclusão
Explicar lineage até transactions de origem.

---


\newpage

# Trilha 03 - Segurança e Privacidade

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase B](PLANO_DE_ESTUDOS_APLICADO.md#fase-b---bootstrap-de-engenharia), [fase C](PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household), [fase F](PLANO_DE_ESTUDOS_APLICADO.md#fase-f---import-pipeline), [fase H](PLANO_DE_ESTUDOS_APLICADO.md#fase-h---ia), [fase I](PLANO_DE_ESTUDOS_APLICADO.md#fase-i---staging-e-produção).

Esta trilha existe porque o produto manipula histórico financeiro de pessoas reais. Segurança e privacidade são requisitos de arquitetura desde a Fase 0, não uma etapa de “hardening” no final.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## SEC-001 - Classificação de dados e noções de LGPD

**Nível:** Fundamental  
**Quando estudar:** Fase 0, antes do ERD definitivo.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Classificação de dados é a prática de identificar o nível de criticidade das informações e definir controles proporcionais. A classificação interna do projeto não substitui categorias jurídicas da LGPD. Neste sistema, histórico financeiro, saldos, patrimônio, descrições de transações e extratos serão tratados como **Financeiro Confidencial**, ainda que “dado financeiro” não seja automaticamente “dado pessoal sensível” na definição legal.

### Qual problema resolve

Sem uma classificação explícita, logs, backups, ferramentas de analytics, ambientes de teste e integrações podem receber informação demais. A classificação cria uma linguagem comum para decidir o que pode ser armazenado, compartilhado, retido e observado.

### Como aparece neste projeto

- Criar a taxonomia Pública / Interna / Pessoal / Financeiro Confidencial / Sensível LGPD / Credencial.
- Classificar entidades e campos do modelo antes de produção.
- Proibir dados financeiros reais em fixtures, screenshots, logs e ambientes de teste não autorizados.
- Registrar dúvidas jurídicas como NÃO DEFINIDAS e não inventar base legal.

### O que estudar

- conceitos de dado pessoal, dado pessoal sensível, titular, controlador e operador;
- princípios de finalidade, necessidade/minimização, segurança e prevenção;
- diferença entre requisito jurídico e política interna de segurança;
- ciclo de vida do dado: coleta, uso, compartilhamento, retenção, exportação e eliminação.

### Exercício aplicado

Monte uma tabela de classificação para User, Household, Account, Transaction, ImportFile, FinancialInsight, AuditLog e credenciais. Para cada item, indique quem acessa, onde fica armazenado, se pode ir para logs, se pode ir para IA e qual retenção ainda precisa ser definida.

### Como validar / testar

- Revisar a tabela com o threat model.
- Criar testes ou linters para impedir logging acidental de campos críticos quando possível.
- Verificar se documentação distingue “sensível pela LGPD” de “confidencial para nosso sistema”.

### Erros comuns

- Chamar todo dado financeiro de “sensível LGPD” sem precisão jurídica.
- Concluir que, por não ser automaticamente sensível, o dado financeiro merece proteção baixa.
- Copiar produção para desenvolvimento sem anonimização.

### Perguntas que você deve conseguir responder

- Por que uma compra em hospital pode revelar mais do que um valor financeiro?
- Qual a diferença entre classificação interna e categoria legal?
- Por que minimização reduz impacto de incidentes?

### Critério de conclusão

Você consegue classificar cada dado do MVP, explicar o risco de exposição e apontar quais decisões ainda precisam de validação jurídica/privacidade.

### Referências iniciais

- ANPD - Perguntas frequentes sobre LGPD: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
- ANPD - materiais de segurança da informação: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes

## SEC-002 - Threat modeling

**Nível:** Intermediário  
**Quando estudar:** Fase 0 e em toda feature com nova superfície de ataque.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Threat modeling é um processo estruturado para perguntar “o que pode dar errado?”, quem poderia causar o problema, por qual caminho e com qual impacto. Ele transforma segurança de uma lista genérica em riscos concretos do nosso produto.

### Qual problema resolve

Uma aplicação financeira tem ativos óbvios: contas, transações, extratos, credenciais, sessões e exportações. Sem modelar ameaças, é fácil proteger o login e esquecer IDOR entre households, vazamento por logs, CSV malicioso, link de exportação exposto ou abuso de IA.

### Como aparece neste projeto

- Modelar fluxos de login, importação, consulta de transações, convites, exportação, exclusão e tools de IA.
- Mapear trust boundaries entre browser, Next.js, API NestJS, DB, Redis, storage e provedores externos.
- Gerar backlog SEC-* priorizado por impacto/probabilidade.

### O que estudar

- ativos, atores, superfícies de ataque e trust boundaries;
- STRIDE como ferramenta de brainstorm, sem virar ritual burocrático;
- abuse cases;
- risco = impacto x probabilidade, como heurística, não verdade matemática.

### Exercício aplicado

Desenhe o fluxo “usuário importa extrato CSV” e identifique pelo menos dez ameaças: arquivo enorme, arquivo com fórmula, parser vulnerável, household incorreto, storage público, replay, duplicação, dados em log, worker lendo objeto de outro household e falha de limpeza.

### Como validar / testar

- Cada ameaça deve ter mitigação ou aceitação explícita.
- Transformar ameaças de alto risco em requisitos/testes.
- Revisar quando novo componente externo for adicionado.

### Erros comuns

- Fazer threat model uma única vez e nunca atualizar.
- Listar “hacker” como ameaça sem descrever caminho técnico.
- Tratar controles como garantias absolutas.

### Perguntas que você deve conseguir responder

- Qual é nosso ativo mais crítico?
- Onde estão as trust boundaries?
- Qual ameaça aumenta quando adicionamos um provedor de IA?

### Critério de conclusão

Você consegue conduzir uma revisão simples de ameaça de uma feature e converter riscos relevantes em requisitos técnicos verificáveis.

## SEC-003 - Autenticação, autorização e identidade

**Nível:** Fundamental  
**Quando estudar:** Antes de implementar autenticação e primeiro recurso financeiro.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Autenticação responde “quem é você?”. Autorização responde “o que você pode fazer neste recurso?”. Identidade é o conjunto de atributos que permite ao sistema representar usuário, sessão, memberships e contexto de household.

### Qual problema resolve

Confundir autenticação com autorização produz falhas clássicas: um usuário autenticado troca um ID e acessa conta de outro household. Em dados financeiros isso é um incidente grave.

### Como aparece neste projeto

- AuthGuard valida sessão/token.
- Authorization/Policy valida membership, role e ownership/contexto do recurso.
- Nunca aceitar householdId do cliente como autoridade suficiente.
- Toda consulta de recurso financeiro é household-scoped.

### O que estudar

- sessions vs JWT;
- cookies HttpOnly/Secure/SameSite;
- RBAC, ABAC e resource-based authorization;
- IDOR/BOLA;
- revogação, expiração e rotação.

### Exercício aplicado

Crie casos de autorização para OWNER, MEMBER e VIEWER. Inclua tentativas de acessar transactionId existente pertencente a outro household e prove que a resposta não vaza detalhes úteis.

### Como validar / testar

- E2E com dois households e usuários distintos.
- Testar read e write cross-household.
- Testar membership removida durante sessão existente.

### Erros comuns

- Checar role somente no frontend.
- Usar householdId do body/query sem cruzar com a identidade autenticada.
- Retornar diferença de erro que permita enumerar recursos privados.

### Perguntas que você deve conseguir responder

- Por que estar logado não autoriza acessar uma Transaction?
- Quando RBAC sozinho é insuficiente?
- Qual diferença entre 401 e 403?

### Critério de conclusão

Você consegue desenhar o fluxo completo da request e apontar onde identidade, membership, permissão e resource scope são verificados.

## SEC-004 - Senhas, sessões, MFA e passkeys

**Nível:** Intermediário  
**Quando estudar:** Antes de produção com usuários externos.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Gestão de credenciais inclui armazenamento seguro de senha, criação e revogação de sessões, recuperação de conta e fatores adicionais. MFA adiciona um fator independente; passkeys usam criptografia de chave pública e reduzem dependência de senhas.

### Qual problema resolve

Tomada de conta expõe todo o histórico financeiro. Uma arquitetura que protege o banco mas permite sessões eternas ou reset de senha fraco continua vulnerável.

### Como aparece neste projeto

- Decidir provedor/biblioteca de auth em ADR.
- Nunca armazenar senha em texto; se a aplicação gerenciar senha, usar algoritmo apropriado e configuração revisada.
- Planejar MFA/passkeys antes de abertura pública.
- Revogar sessões em eventos críticos.

### O que estudar

- password hashing e salting;
- session fixation, session rotation e revocation;
- MFA TOTP/WebAuthn/passkeys;
- account recovery;
- cookies seguros e proteção contra roubo de sessão.

### Exercício aplicado

Modele login, logout, “logout de todos os dispositivos”, recuperação e remoção de membro. Documente o que acontece com sessões existentes em cada caso.

### Como validar / testar

- Testar cookie flags em produção/staging.
- Testar revogação.
- Verificar que segredos/tokens não aparecem em logs.

### Erros comuns

- Inventar algoritmo de hash.
- JWT longo sem estratégia de revogação só porque “é stateless”.
- MFA sem recovery seguro.

### Perguntas que você deve conseguir responder

- Quando sessão server-side é mais simples que JWT?
- Por que expiração curta não substitui revogação?
- Qual risco um reset de senha mal implementado cria?

### Critério de conclusão

Você consegue justificar a estratégia escolhida e demonstrar os controles de sessão em testes de integração/E2E.

## SEC-005 - Least privilege, RBAC e autorização por recurso

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Least privilege significa conceder somente os privilégios necessários, pelo tempo necessário. RBAC associa permissões a papéis; autorização por recurso adiciona contexto do objeto específico e do household.

### Qual problema resolve

Mesmo dentro de uma família podem existir visões somente leitura, proprietário da casa e acessos temporários. No backend e na infraestrutura, workers e CI também não precisam de privilégios administrativos universais.

### Como aparece neste projeto

- Definir OWNER/MEMBER/VIEWER inicialmente.
- Separar ações como household:manage, transaction:write, export:create.
- Credenciais de runtime devem ter permissões mínimas.

### O que estudar

- RBAC vs ABAC;
- service accounts;
- database roles;
- princípio deny-by-default.

### Exercício aplicado

Construa uma matriz ação x papel x recurso e implemente uma policy reutilizável em uma pequena feature antes de espalhar if(role) pela base inteira.

### Como validar / testar

- Testes de negação são obrigatórios, não só happy path.
- Tentar acesso após downgrade de papel.

### Erros comuns

- Papel ADMIN virando “pode tudo” sem limites.
- Permissões divergentes entre controller e service.

### Perguntas que você deve conseguir responder

- Qual diferença entre papel e permissão?
- Por que negar por padrão é mais seguro?

### Critério de conclusão

Você consegue adicionar uma nova ação sem duplicar lógica de autorização e consegue provar que caminhos não autorizados falham.

## SEC-006 - Isolamento entre households e defense in depth

**Nível:** Intermediário  
**Quando estudar:** Antes da modelagem final de acesso a dados.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Isolamento garante que dados de um household não sejam lidos ou alterados por outro. Defense in depth usa múltiplas barreiras independentes: aplicação, ORM/repository, banco, storage e testes.

### Qual problema resolve

Um único WHERE esquecido pode causar vazamento entre famílias. Como o impacto é alto, este projeto deve tratar isolamento como invariante de sistema.

### Como aparece neste projeto

- Todas as entidades financeiras carregam householdId quando fizer sentido.
- Queries e comandos recebem HouseholdContext, não householdId arbitrário.
- RLS é HIPÓTESE FORTE a avaliar, não decisão automática.
- Storage paths e signed URLs também devem ser household-scoped.

### O que estudar

- multi-tenancy shared schema;
- PostgreSQL RLS;
- connection pooling e session/transaction-local settings;
- composite keys/constraints que reforçam ownership;
- testes de isolamento.

### Exercício aplicado

Crie uma suíte de “tenant isolation tests” que popula Household A e B e tenta ler/alterar IDs cruzados via API e repository. Depois faça uma prova de conceito de RLS em tabela de laboratório.

### Como validar / testar

- Cross-household deve falhar em API e, se RLS adotado, também em acesso SQL contextualizado.
- Verificar comportamento de admin/jobs.

### Erros comuns

- Usar apenas filtro no frontend.
- Adicionar RLS sem entender bypass do owner/service role.
- Setar contexto RLS em conexão pooled de forma que vaze entre requests.

### Perguntas que você deve conseguir responder

- Qual ameaça RLS reduz?
- Que complexidade RLS adiciona com connection pools?
- Por que householdId em URL não define autorização?

### Critério de conclusão

Você consegue demonstrar, com testes automatizados, que a invariante de isolamento é preservada em CRUD, imports, jobs e exportações.

### Referências iniciais

- PostgreSQL Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## SEC-007 - Criptografia em trânsito, em repouso e por campo

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Criptografia em trânsito protege dados durante comunicação (TLS). Criptografia em repouso protege volumes, bancos, objetos e backups quando o meio físico/storage é comprometido. Criptografia por campo ocorre na aplicação e protege valores específicos antes de chegarem ao storage.

### Qual problema resolve

As três camadas resolvem ameaças diferentes. “Banco criptografado” não impede um usuário da aplicação com acesso autorizado de consultar o campo; field encryption pode impedir consultas/indexes e aumentar complexidade operacional.

### Como aparece neste projeto

- TLS obrigatório em produção.
- Criptografia at-rest do provedor para DB/storage/backups.
- Field-level encryption = NÃO DEFINIDO; avaliar só para campos que justifiquem custo.

### O que estudar

- TLS/certificados;
- envelope encryption e KMS em nível conceitual;
- key rotation;
- o que field encryption quebra em busca/ordenação/agregação;
- gestão de chaves.

### Exercício aplicado

Classifique campos candidatos a field encryption, descreva ameaça específica e impacto funcional. Evite decidir pelo reflexo “criptografar tudo”.

### Como validar / testar

- Checar HTTPS e redirect/HSTS quando aplicável.
- Documentar encryption settings do provedor.
- Testar restore de backup sem expor chave em pipeline.

### Erros comuns

- Confundir hashing com encryption.
- Guardar chave ao lado do ciphertext.
- Criptografar amount e depois descobrir que dashboard não consegue agregar.

### Perguntas que você deve conseguir responder

- Que ameaça TLS resolve?
- Por que field encryption não é substituto para autorização?
- Quem tem acesso à chave?

### Critério de conclusão

Você consegue escolher a camada de criptografia com base em uma ameaça concreta e explicar os trade-offs.

## SEC-008 - Secrets management

**Nível:** Fundamental  
**Quando estudar:** Desde o bootstrap do repositório.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Secrets são credenciais não públicas: senhas de banco, chaves de API, signing keys e tokens. Secrets management define geração, armazenamento, distribuição, rotação e revogação.

### Qual problema resolve

Um segredo commitado pode continuar recuperável no histórico mesmo após apagar o arquivo. CI e containers multiplicam locais onde credenciais podem vazar.

### Como aparece neste projeto

- .env apenas para desenvolvimento, nunca como artefato versionado.
- Produção usa secret store/variáveis protegidas do provedor.
- Codex nunca deve inventar ou imprimir secrets.

### O que estudar

- 12-factor config;
- secret stores;
- rotation;
- OIDC para CI quando disponível;
- scanning de secrets.

### Exercício aplicado

Crie o catálogo de secrets esperados e owner/rotação. Configure um scanner de secrets no CI ou pre-commit e simule vazamento de uma chave fake.

### Como validar / testar

- Garantir que logs de CI não imprimem valores.
- Rotacionar secret de laboratório e confirmar deploy continua funcionando.

### Erros comuns

- Colocar segredo no Dockerfile/ARG e publicar na imagem.
- Compartilhar .env por chat.

### Perguntas que você deve conseguir responder

- Por que variável de ambiente não é automaticamente um secret manager?
- Como revogar uma credencial comprometida?

### Critério de conclusão

Você consegue mapear todo secret do sistema e explicar onde ele existe em local, CI, staging e produção.

## SEC-009 - OWASP: XSS, CSRF, injection, SSRF e validação

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

OWASP reúne classes de vulnerabilidade recorrentes. Para este projeto, XSS afeta frontend, CSRF pode afetar autenticação baseada em cookie, injection ameaça parsers/SQL/comandos e SSRF aparece se o backend buscar URLs controladas pelo usuário.

### Qual problema resolve

Frameworks reduzem parte do risco, não eliminam lógica insegura. Importações e integrações externas ampliam a superfície.

### Como aparece neste projeto

- Validar input no boundary.
- Não construir SQL dinâmico inseguro.
- Evitar renderização de HTML não confiável.
- Definir política de CSRF conforme estratégia de auth.
- Não buscar URLs arbitrárias sem allowlist/validação.

### O que estudar

- OWASP Top 10;
- OWASP ASVS;
- output encoding;
- CSRF tokens/SameSite;
- parameterized queries;
- SSRF e egress controls.

### Exercício aplicado

Crie testes de payloads maliciosos em descrição de transação, nomes de categoria e importação. Documente quais proteções vêm do framework e quais dependem de nós.

### Como validar / testar

- Security regression tests.
- DAST simples em staging quando aplicável.

### Erros comuns

- Confiar que React/Nest “resolvem segurança”.
- Desabilitar validação para aceitar CSV “flexível”.

### Perguntas que você deve conseguir responder

- Quando CSRF é relevante?
- Qual diferença entre validação e sanitização?
- Como SSRF poderia surgir numa feature de import por URL?

### Critério de conclusão

Você reconhece as classes relevantes e sabe apontar controle preventivo e teste correspondente.

### Referências iniciais

- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/

## SEC-010 - Rate limiting, quotas e abuso

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Rate limiting limita frequência de requisições; quotas limitam consumo acumulado. Controles de abuso consideram identidade, IP, household, custo e endpoint.

### Qual problema resolve

Login, importação e IA podem ser explorados para brute force, negação de serviço ou geração de custos.

### Como aparece neste projeto

- Rate limit em login/reset.
- Quota de imports/tamanho.
- Quota/custo de IA por household.
- Limites diferentes para endpoints baratos e caros.

### O que estudar

- token bucket/sliding window em nível conceitual;
- 429 e Retry-After;
- limites distribuídos;
- proteção contra abuso sem bloquear uso legítimo.

Ao detalhar o ensaio de e-mail da [ADR-045](docs/decisions/ADR-045-verified-email-lifecycle-proposal.md#limites-por-origem-de-rede--parâmetro-de-ensaio-aprovado-em-2026-10-26), distinguir a janela móvel exata **aprovada** de 30 pedidos em cinco minutos da taxa média de seis pedidos por minuto com rajadas. O [`limit_req` do Nginx](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) usa a segunda semântica; os dois controles podem aceitar quantidades diferentes perto do limite. A chave por IP só representa a conexão de entrada observada por uma borda confiável; `Origin` e `X-Forwarded-For` enviados pelo cliente não provam a origem de rede. Testar também pessoas distintas atrás do mesmo NAT, concorrência, reinício e recuperação da janela.

### Exercício aplicado

Simule 100 requests de login e 20 imports simultâneos; defina comportamento desejado e métricas.

### Como validar / testar

- Teste 429 e recuperação após janela.
- Observe métricas de rejeição.

### Erros comuns

- Um limite global que pune todos os usuários.
- Rate limit somente no frontend.

### Perguntas que você deve conseguir responder

- Rate limit resolve DDoS sozinho?
- Qual chave deve limitar uma tool de IA?

### Critério de conclusão

Você consegue definir limites por risco/custo e observá-los em produção.

## SEC-011 - Logging seguro e redaction

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Logging seguro registra contexto operacional suficiente sem copiar conteúdo financeiro. Redaction remove/mascara campos proibidos antes de enviar eventos para stdout ou terceiros.

### Qual problema resolve

Logs costumam ter retenção longa e acesso amplo. Um log com merchant, amount, e-mail ou token pode duplicar o incidente para outra plataforma.

### Como aparece neste projeto

- Logar IDs, tipo de evento, duração, status e traceId.
- Não logar body completo de Transaction/Import por padrão.
- Redigir Authorization, cookies, secrets e PII.

### O que estudar

- structured logging;
- allowlist vs denylist de campos;
- PII redaction;
- log levels e sampling.

### Exercício aplicado

Implemente logger de laboratório com serializer/redaction e escreva testes que falham se token, merchant ou descrição sensível aparecerem.

### Como validar / testar

- Testes unitários de redaction.
- Revisão de logs gerados por E2E.

### Erros comuns

- console.log(req.body).
- Achar que log privado pode conter qualquer coisa.

### Perguntas que você deve conseguir responder

- Que informação é suficiente para depurar transaction.created?
- Por que ID interno costuma ser melhor que conteúdo?

### Critério de conclusão

Você consegue investigar uma falha sem expor o conteúdo financeiro nos logs.

## SEC-012 - Privacy by design e data minimization

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Privacy by design incorpora privacidade na arquitetura desde o início. Minimização coleta/processa somente o necessário para finalidade declarada.

### Qual problema resolve

Cada cópia de dado aumenta superfície de exposição. IA, analytics, observabilidade e backups tendem a criar cópias invisíveis.

### Como aparece neste projeto

- Questionar cada campo novo: precisamos dele? por quanto tempo?
- Enviar à IA métricas agregadas quando o detalhe não é necessário.
- Evitar analytics de terceiros em telas financeiras sem avaliação.

### O que estudar

- data flow mapping;
- purpose limitation;
- pseudonymization vs anonymization;
- privacy-friendly defaults.

### Exercício aplicado

Pegue o fluxo de insight por IA e reduza o payload progressivamente até o mínimo que ainda produz a resposta desejada.

### Como validar / testar

- Comparar payload antes/depois.
- Registrar no AI Data Policy.

### Erros comuns

- “Podemos armazenar porque talvez seja útil”.
- Anonimizar apenas removendo nome enquanto mantém combinação identificável.

### Perguntas que você deve conseguir responder

- Qual finalidade justifica cada campo?
- Qual dado a IA realmente precisa?

### Critério de conclusão

Você consegue reduzir um fluxo sem perder funcionalidade central e justificar o dado restante.

## SEC-013 - Retenção, exportação e eliminação

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Retenção define por quanto tempo cada classe de dado permanece. Exportação e eliminação tratam ciclo de vida e direitos do usuário. Backups e logs exigem regras específicas porque apagar da tabela principal não remove todas as cópias imediatamente.

### Qual problema resolve

Sem política, extratos crus, arquivos importados e snapshots podem sobreviver indefinidamente. Exclusão “DELETE users” pode deixar órfãos financeiros em storage e caches.

### Como aparece neste projeto

- Data Retention Policy = NÃO DEFINIDA e obrigatória antes de produção pública.
- Definir retenção de arquivo original de import, dados normalizados, audit, logs e backups.
- Fluxo de exportação e account/household deletion.

### O que estudar

- soft delete vs hard delete;
- legal/operational retention;
- backup expiry;
- asynchronous deletion workflows;
- export security.

### Exercício aplicado

Desenhe uma matriz de retenção e um state machine de deleção. Inclua DB, object storage, Redis, logs, provider AI e backups.

### Como validar / testar

- Teste deleção em staging com dados sintéticos.
- Verificar que signed export expira.

### Erros comuns

- Prometer eliminação instantânea de backups sem arquitetura para isso.
- Exportar dados em URL pública.

### Perguntas que você deve conseguir responder

- O que acontece com shared household quando um único membro sai?
- Como documentar dados que permanecem em backup até expiração?

### Critério de conclusão

Você consegue descrever o ciclo de vida de cada dado do MVP do nascimento à eliminação.

## SEC-014 - Incident response

**Nível:** Intermediário  
**Quando estudar:** Antes de produção pública.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Incident response é o processo para detectar, conter, investigar, comunicar quando aplicável, remediar e aprender com incidentes.

### Qual problema resolve

Quando terceiros usam a aplicação, a pergunta deixa de ser “e se houver incidente?” e passa a ser “como reagiremos sem improvisar sob pressão?”.

### Como aparece neste projeto

- Criar runbook antes de abertura pública.
- Preservar evidências sem copiar conteúdo além do necessário.
- Ter contatos, owner e critérios de severidade.
- Avaliação regulatória/jurídica deve ser explicitamente encaminhada, não inventada pelo time técnico.

### O que estudar

- incident lifecycle;
- severity;
- containment;
- forensics básica;
- postmortem sem culpabilização;
- obrigações de comunicação devem ser validadas conforme contexto real.

### Exercício aplicado

Faça tabletop exercise: “um bug permitiu Household A visualizar 20 transações do Household B”. Documente primeiras 60 minutos, evidências, contenção, comunicação interna e correção.

### Como validar / testar

- Runbook executável.
- Postmortem gera ações com owner.

### Erros comuns

- Apagar logs para “resolver” vazamento.
- Comunicar publicamente antes de entender fatos.

### Perguntas que você deve conseguir responder

- Qual primeiro passo técnico?
- Como saber quais usuários foram afetados?
- Que logs precisamos ter previamente?

### Critério de conclusão

Você consegue executar um tabletop e identificar lacunas observacionais/operacionais antes de um incidente real.

## SEC-015 - Audit logging

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Audit log registra ações de segurança/negócio relevantes de forma separada de logs operacionais: quem fez o quê, quando, em qual recurso e com qual resultado.

### Qual problema resolve

Precisamos reconstruir eventos como convite, mudança de papel, exportação e exclusão sem armazenar desnecessariamente o conteúdo financeiro.

### Como aparece neste projeto

- Auditar membership changes, exports, delete requests, auth-sensitive events e config.
- Imutabilidade lógica e acesso restrito.
- Metadata mínima.

### O que estudar

- audit vs application logs;
- actor/resource/action/outcome;
- tamper resistance;
- retention.

### Exercício aplicado

Defina schema de AuditEvent e gere eventos para membership.role.changed e data.export.requested.

### Como validar / testar

- Testar emissão e autorização de leitura.
- Verificar ausência de payload financeiro.

### Erros comuns

- Usar audit log como debug dump.
- Permitir edição normal de eventos.

### Perguntas que você deve conseguir responder

- O que deve ser auditado?
- Quem pode ler auditoria?

### Critério de conclusão

Você consegue reconstruir uma ação crítica sem revelar informações que não eram necessárias.

## SEC-016 - Terceiros e política de dados para IA

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Qualquer provedor externo vira parte do fluxo de dados. AI Data Policy define quais classes podem sair, sob quais condições e com quais transformações.

### Qual problema resolve

Enviar descrições bancárias completas a um LLM ou analytics pode expor mais dados do que a funcionalidade exige.

### Como aparece neste projeto

- Preferir métricas agregadas para insights.
- Sanitização central antes de tool/provider.
- Inventário de subprocessadores/provedores quando o produto evoluir.
- Configuração de retenção do provedor deve ser avaliada no momento da escolha.

### O que estudar

- data minimization;
- vendor risk;
- data residency em nível conceitual;
- prompt/data logging do provedor;
- DPA/termos como assunto a validar se houver operação real.

### Exercício aplicado

Crie dois payloads para o mesmo insight: bruto e minimizado. Prove que a resposta útil pode ser obtida com o minimizado.

### Como validar / testar

- Testes de serializer AI-safe.
- Tracing não deve reintroduzir dados removidos.

### Erros comuns

- Redigir no prompt, mas mandar o objeto bruto no trace.
- Assumir política de provedor sem verificar configuração vigente.

### Perguntas que você deve conseguir responder

- Que campos podem sair do nosso boundary?
- Como invalidar uma tool que retorna dados demais?

### Critério de conclusão

Você consegue definir e aplicar um contrato de dados por tool/provider.

## SEC-017 - Uploads e parsing seguro

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Uploads são conteúdo não confiável. O sistema precisa limitar tipo/tamanho, armazenar com chave controlada, processar isoladamente e tratar CSV/OFX como input hostil.

### Qual problema resolve

Arquivos podem causar exaustão de memória, parser bombs, path traversal, CSV formula injection ou transportar dados de outro usuário.

### Como aparece neste projeto

- Upload por signed URL ou endpoint com limites.
- Objeto privado e chave gerada pelo servidor.
- Worker faz parsing com limites e validação.
- Política de retenção do original.

### O que estudar

- MIME vs extensão;
- streaming;
- size limits;
- CSV formula injection;
- malware scanning como FUTURO conforme risco.

### Exercício aplicado

Teste arquivo gigante, extensão enganosa, colunas extras, encoding inválido, fórmula =HYPERLINK(...) e OFX malformado.

### Como validar / testar

- Falhas não deixam job travado nem arquivo público.
- Métricas e cleanup funcionam.

### Erros comuns

- Confiar no Content-Type do cliente.
- Salvar pelo filename original.

### Perguntas que você deve conseguir responder

- Por que CSV pode ser perigoso mesmo sem executar no servidor?
- Quando streaming evita DoS de memória?

### Critério de conclusão

Você consegue descrever e testar o pipeline seguro do upload ao cleanup.

## SEC-018 - Supply chain e dependências

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Supply-chain security considera risco introduzido por pacotes, imagens, actions e ferramentas de build.

### Qual problema resolve

Uma aplicação moderna executa muito código que não escrevemos. Dependência comprometida pode acessar secrets e dados.

### Como aparece neste projeto

- Lockfile versionado.
- Dependabot/renovate ou processo equivalente a definir.
- Actions pinadas/revisadas.
- Imagens base mínimas e atualizadas.

### O que estudar

- SCA;
- SBOM em nível conceitual;
- package provenance;
- CVE e patching.

### Exercício aplicado

Adicione auditoria de dependências ao CI e documente processo para vulnerabilidade crítica.

### Como validar / testar

- Falha ou alerta conforme severidade definida.
- Revisar update com testes.

### Erros comuns

- Atualização automática direto em produção.
- Ignorar vulnerabilidade porque “é dependência transitiva”.

### Perguntas que você deve conseguir responder

- Quem é responsável por patching?
- Qual janela aceitável para crítico?

### Critério de conclusão

Você consegue identificar dependência vulnerável, avaliar exposição e executar atualização com rollback.

## SEC-019 - Security testing e OWASP ASVS

**Nível:** Intermediário  
**Quando estudar:** Desde o MVP e reforçar antes de produção pública.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Security testing combina testes automatizados, revisão de arquitetura e checklist verificável. OWASP ASVS fornece requisitos de segurança de aplicação que podem servir como referência, sem necessidade de implementar tudo de uma vez.

### Qual problema resolve

Pentest no fim não substitui controles testáveis durante desenvolvimento.

### Como aparece neste projeto

- Criar security regression suite.
- Mapear requisitos ASVS relevantes do MVP.
- SAST/SCA/secret scan no CI conforme ferramentas escolhidas.

### O que estudar

- SAST, DAST, SCA, secret scanning;
- ASVS;
- abuse-case tests;
- testes de autorização.

### Exercício aplicado

Escolha 15 controles ASVS relevantes ao MVP, marque implementado/não aplicável/pendente e conecte cada um a evidência.

### Como validar / testar

- Evidência = teste/config/documento, não “acho que sim”.

### Erros comuns

- Tratar scanner como prova de segurança.
- Copiar checklist sem contexto.

### Perguntas que você deve conseguir responder

- Que riscos só teste de integração detecta?
- O que scanner não entende sobre household isolation?

### Critério de conclusão

Você consegue produzir uma pequena matriz de controles com evidências reais.

### Referências iniciais

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/


\newpage

# Trilha 04 - DevOps e Infraestrutura

**No Plano de Estudos:** [fase B](PLANO_DE_ESTUDOS_APLICADO.md#fase-b---bootstrap-de-engenharia), [fase I](PLANO_DE_ESTUDOS_APLICADO.md#fase-i---staging-e-produção), [fase J](PLANO_DE_ESTUDOS_APLICADO.md#fase-j---evolução-e-escala).

Esta trilha acompanha o projeto do ambiente local ao deploy reproduzível, observável e recuperável. A meta não é decorar ferramentas, mas entender o caminho completo de um commit até um processo saudável em produção.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## DEV-001 - Processos, rede, portas e DNS

**Nível:** Fundamental  
**Quando estudar:** Antes do primeiro Docker Compose.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Um deploy é um conjunto de processos que escutam portas, resolvem nomes e dependem de rede. Entender esses fundamentos evita tratar Docker/cloud como magia.

### Qual problema resolve

Sem esse modelo mental fica difícil diagnosticar “funciona local, falha no container”, timeout, DNS e bind incorreto.

### Como aparece neste projeto

- Mapear web, API, worker, PostgreSQL, Redis e storage.
- Documentar portas apenas em local; produção usa service discovery/URLs.

### O que estudar

- processo, PID, socket, TCP, localhost vs 0.0.0.0;
- DNS, hostname, porta, HTTP/HTTPS;
- egress/ingress em nível conceitual.

### Exercício aplicado

Suba um servidor simples em localhost e depois em container; explique por que bind em 127.0.0.1 pode impedir acesso externo.

### Como validar / testar

- curl entre host/container;
- nslookup/dig de laboratório.

### Erros comuns

- Usar localhost para referir outro container.

### Perguntas que você deve conseguir responder

- O que localhost significa dentro de um container?
- O que DNS resolve?

### Critério de conclusão

Você consegue desenhar o caminho de rede Browser -> Web -> API -> DB e diagnosticar falha básica.

## DEV-002 - Configuração por ambiente

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Configuração por ambiente separa código de valores operacionais como URLs, timeouts e feature flags.

### Qual problema resolve

Hardcode de produção no código torna deploy inseguro e irreproduzível.

### Como aparece neste projeto

- Definir schema de env e validação no startup.
- Separar config de secret.

### O que estudar

- 12-factor config;
- env vars;
- config validation;
- defaults seguros.

### Exercício aplicado

Crie um ConfigModule tipado que falha no startup quando DATABASE_URL está ausente.

### Como validar / testar

- Testar startup inválido.

### Erros comuns

- Default silencioso apontando para produção.

### Perguntas que você deve conseguir responder

- Config é secret? sempre?

### Critério de conclusão

Você consegue listar config vs secrets e explicar onde cada um vive.

## DEV-003 - Containers, images e Dockerfile

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Imagem é artefato imutável; container é execução isolada dessa imagem. Dockerfile descreve build.

### Qual problema resolve

Permite ambiente reprodutível e artifact promotion.

### Como aparece neste projeto

- Dockerfiles para web/api/worker quando chegar a fase.
- Multi-stage build e usuário não-root como hipótese forte.

### O que estudar

- layers;
- build context;
- .dockerignore;
- multi-stage;
- non-root;
- healthcheck.

### Exercício aplicado

Containerize a API com build multi-stage, inspecione tamanho e execute como usuário não-root.

### Como validar / testar

- docker run;
- scan básico de imagem se disponível.

### Erros comuns

- Copiar node_modules local.
- Executar como root sem necessidade.

### Perguntas que você deve conseguir responder

- Por que imagem deve ser imutável?
- Por que multi-stage ajuda?

### Critério de conclusão

Você consegue construir e executar uma imagem determinística.

### Referências iniciais

- Docker docs - Images: https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/

## DEV-004 - Docker Compose para ambiente local

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Compose descreve múltiplos serviços locais e redes/volumes.

### Qual problema resolve

Reduz setup manual de Postgres/Redis/storage e aproxima integração do ambiente real.

### Como aparece neste projeto

- Compose para dependências; apps podem rodar host inicialmente.
- Volumes e health checks.

### O que estudar

- services;
- networks;
- volumes;
- depends_on e limitações;
- healthcheck.

### Exercício aplicado

Crie Compose com Postgres e Redis, healthchecks e volumes nomeados.

### Como validar / testar

- derrubar/subir preservando volume;
- testar serviço indisponível.

### Erros comuns

- Achar que depends_on significa “aplicação pronta”.

### Perguntas que você deve conseguir responder

- Qual diferença entre processo iniciado e ready?

### Critério de conclusão

Você consegue recriar ambiente local em máquina limpa.

### Referências iniciais

- Docker Compose docs: https://docs.docker.com/compose/

## DEV-005 - CI com GitHub Actions

**Nível:** Fundamental  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Continuous Integration valida cada mudança automaticamente em ambiente limpo.

### Qual problema resolve

Evita depender da máquina do desenvolvedor e pega integração quebrada antes do merge.

### Como aparece neste projeto

- Pipeline: install frozen -> lint -> typecheck -> unit -> integration -> build.
- Cache só como otimização.

### O que estudar

- workflow, job, step, runner;
- artifacts/cache;
- matrix;
- branch protection.

### Exercício aplicado

Implemente CI mínimo e faça commit propositalmente quebrado para provar gate.

### Como validar / testar

- PR bloqueado quando teste falha.

### Erros comuns

- Pipeline que passa sem executar integração.
- Secrets em echo.

### Perguntas que você deve conseguir responder

- CI e CD são a mesma coisa?

### Critério de conclusão

Você consegue explicar cada gate e reproduzir localmente.

### Referências iniciais

- GitHub Actions docs: https://docs.github.com/actions

## DEV-006 - CD e promoção de artefatos

**Nível:** Intermediário  
**Quando estudar:** Após CI estável.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Continuous Delivery/Deployment automatiza levar um artefato validado a ambientes. Promoção significa usar o mesmo artefato, não reconstruir código diferente por ambiente.

### Qual problema resolve

Reduz drift e deploy manual não auditável.

### Como aparece neste projeto

- staging antes de prod;
- deploy production protegido;
- smoke tests;
- rollback.

### O que estudar

- artifact promotion;
- deployment environments;
- approval gates;
- release metadata.

### Exercício aplicado

Desenhe pipeline de main -> build image -> registry -> staging -> smoke -> prod.

### Como validar / testar

- Registrar SHA da versão.

### Erros comuns

- Rebuild separado em produção.

### Perguntas que você deve conseguir responder

- Como saber exatamente qual commit está rodando?

### Critério de conclusão

Você consegue apontar artefato e commit de cada deploy.

## DEV-007 - Health, liveness e readiness

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Liveness indica processo vivo; readiness indica aptidão para receber tráfego; dependency checks precisam ser usados com cuidado para não amplificar falhas.

### Qual problema resolve

Orquestradores/load balancers precisam decidir quando enviar tráfego ou reiniciar.

### Como aparece neste projeto

- /health/live barato.
- /health/ready verifica dependências essenciais com timeout.

### O que estudar

- health endpoints;
- timeouts;
- startup probe em conceito.

### Exercício aplicado

Implemente endpoints separados e simule DB indisponível.

### Como validar / testar

- live continua 200 se processo saudável; ready falha quando DB essencial cai.

### Erros comuns

- Liveness depender do DB e causar restart storm.

### Perguntas que você deve conseguir responder

- Quando dependência deve afetar readiness?

### Critério de conclusão

Você consegue definir semântica de cada probe.

## DEV-008 - Registry e artefatos imutáveis

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Registry armazena imagens/artefatos versionados. Imutabilidade permite reproduzir e fazer rollback.

### Qual problema resolve

Tag latest sozinha não identifica versão.

### Como aparece neste projeto

- Tag por SHA e versão.
- Proteger registry.

### O que estudar

- digest;
- tags;
- retention;
- provenance em conceito.

### Exercício aplicado

Build e tag local com git SHA fictício; documente promoção.

### Como validar / testar

- Comparar digest.

### Erros comuns

- Sobrescrever tag de release.

### Perguntas que você deve conseguir responder

- Tag e digest são iguais?

### Critério de conclusão

Você consegue recuperar exatamente o artefato de uma versão.

## DEV-009 - Ambientes e dados sintéticos

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Dev, test, staging e prod têm finalidades diferentes. Dados reais não devem ser copiados casualmente.

### Qual problema resolve

Staging com produção clonada vira novo vazamento potencial.

### Como aparece neste projeto

- Fixtures sintéticas realistas.
- Credenciais e serviços separados.

### O que estudar

- environment parity;
- seed;
- anonymization vs synthetic data.

### Exercício aplicado

Crie seed financeiro fictício que cubra cartão, parcelamento, estorno e split.

### Como validar / testar

- E2E funciona sem dados reais.

### Erros comuns

- Usar export pessoal em staging compartilhado.

### Perguntas que você deve conseguir responder

- O que staging precisa imitar e o que não precisa?

### Critério de conclusão

Você consegue testar fluxos complexos com dados artificiais.

## DEV-010 - Release, rollback e migrations

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Deploy de app e mudança de schema precisam ser compatíveis durante transição. Rollback de código pode falhar se schema já mudou de forma destrutiva.

### Qual problema resolve

Migrations são uma das maiores fontes de risco operacional.

### Como aparece neste projeto

- Expand/contract para mudanças críticas.
- Migration job único.
- Backup/restore não substitui compatibilidade.

### O que estudar

- backward-compatible migrations;
- expand-contract;
- feature flags;
- rollback vs roll-forward.

### Exercício aplicado

Simule renomear coluna em duas releases sem downtime.

### Como validar / testar

- Versão N e N+1 funcionam durante janela.

### Erros comuns

- DROP/RENAME destrutivo na mesma release.

### Perguntas que você deve conseguir responder

- Por que rollback de migration é difícil?

### Critério de conclusão

Você consegue planejar mudança compatível e estratégia de recuperação.

## DEV-011 - DNS, TLS e domínio de produção

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

DNS mapeia nome a destino; TLS autentica endpoint e cifra transporte.

### Qual problema resolve

Produção precisa HTTPS correto, renovação e redirects.

### Como aparece neste projeto

- Domínio e cloud = NÃO DEFINIDO.
- Certificados gerenciados pelo provedor são preferência provável.

### O que estudar

- A/AAAA/CNAME;
- certificate chain;
- TLS termination;
- HSTS em conceito.

### Exercício aplicado

Use um domínio de laboratório apenas quando deploy existir; documente cadeia DNS -> LB/platform -> app.

### Como validar / testar

- curl -v/openssl em ambiente de teste.

### Erros comuns

- Certificado manual sem renovação.

### Perguntas que você deve conseguir responder

- Onde TLS termina?

### Critério de conclusão

Você consegue explicar a rota DNS/TLS completa.

## DEV-012 - Primitivas de cloud e escolha de plataforma

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Cloud oferece compute, managed DB, cache, object storage, networking e secret management. Plataforma gerenciada troca controle por operação mais simples.

### Qual problema resolve

Escolher provedor antes dos requisitos cria lock-in sem benefício.

### Como aparece neste projeto

- Cloud/provider = NÃO DEFINIDO.
- Comparar custo, operação, regiões, managed Postgres/Redis/storage e deploy.

### O que estudar

- PaaS vs IaaS;
- managed services;
- region;
- autoscaling;
- egress.

### Exercício aplicado

Crie matriz de decisão para 2-3 opções quando chegarmos ao deploy.

### Como validar / testar

- Decisão vira ADR com custo estimado.

### Erros comuns

- Escolher AWS só porque “é enterprise”.

### Perguntas que você deve conseguir responder

- Qual serviço realmente precisamos operar?

### Critério de conclusão

Você consegue justificar plataforma em função do projeto.

## DEV-013 - Backup, restore, RPO e RTO

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

RPO é quanto dado podemos perder; RTO é quanto tempo podemos ficar indisponíveis. Backup só é útil se restaurável.

### Qual problema resolve

Aplicação financeira precisa recuperar dados após erro operacional ou falha.

### Como aparece neste projeto

- Backups automáticos do DB.
- Restore testado.
- Object storage/versioning a avaliar.

### O que estudar

- full/PITR;
- retention;
- RPO/RTO;
- restore drill.

### Exercício aplicado

Defina RPO/RTO iniciais de estudo e execute restore de DB de desenvolvimento.

### Como validar / testar

- Comparar contagens/checksums e invariantes após restore.

### Erros comuns

- Nunca testar restore.

### Perguntas que você deve conseguir responder

- Backup e alta disponibilidade são iguais?

### Critério de conclusão

Você consegue executar restore e medir tempo.

## DEV-014 - Infrastructure as Code

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

IaC descreve infraestrutura em código declarativo/versionado.

### Qual problema resolve

Reduz configuração manual, mas adiciona ferramenta e estado.

### Como aparece neste projeto

- IaC = NÃO DEFINIDO/FUTURO.
- Adotar quando infraestrutura tiver complexidade/repetição que justifique.

### O que estudar

- Terraform/OpenTofu conceitos;
- state;
- plan/apply;
- drift.

### Exercício aplicado

Modele apenas arquitetura hipotética e identifique gatilho objetivo para adotar IaC.

### Como validar / testar

- Não implementar ferramenta antes do gate.

### Erros comuns

- Terraform para criar um único serviço simples só por currículo.

### Perguntas que você deve conseguir responder

- Qual problema concreto IaC resolve aqui?

### Critério de conclusão

Você sabe quando não usar e quais riscos de state existem.

## DEV-015 - Secrets no CI e identidade de workload

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Pipelines precisam autenticar em registry/cloud. O ideal é reduzir chaves long-lived e usar identidade federada quando suportada.

### Qual problema resolve

Secret permanente em GitHub aumenta impacto de vazamento.

### Como aparece neste projeto

- OIDC/workload identity = hipótese a avaliar conforme cloud.
- Least privilege por environment.

### O que estudar

- OIDC;
- short-lived credentials;
- environment protection.

### Exercício aplicado

Quando provedor for escolhido, faça PoC sem chave estática se suportado.

### Como validar / testar

- Revogue acesso e prove que job falha.

### Erros comuns

- Credencial admin global no CI.

### Perguntas que você deve conseguir responder

- Por que credencial curta reduz risco?

### Critério de conclusão

Você consegue mapear identidade usada por cada job.

## DEV-016 - Custos e capacidade

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Operação também é engenharia econômica: DB, cache, storage, egress, logs e IA custam.

### Qual problema resolve

Arquitetura sofisticada pode ficar cara para um projeto pessoal.

### Como aparece neste projeto

- Cost budget mensal.
- Alertas de custo quando possível.
- Medir custo de AI/import/logs.

### O que estudar

- fixed vs variable cost;
- egress;
- retention;
- right-sizing.

### Exercício aplicado

Monte planilha simples de custo mínimo e crescimento para 1, 10 e 100 households ativos.

### Como validar / testar

- Revisar após escolher cloud.

### Erros comuns

- Ignorar custo de logs/IA.

### Perguntas que você deve conseguir responder

- Qual componente cresce com uso?

### Critério de conclusão

Você consegue apontar top 3 drivers de custo.


\newpage

# Trilha 05 - Observabilidade e Operação

**No Plano de Estudos:** [fase F](PLANO_DE_ESTUDOS_APLICADO.md#fase-f---import-pipeline), [fase G](PLANO_DE_ESTUDOS_APLICADO.md#fase-g---analytics--insights-determinísticos), [fase H](PLANO_DE_ESTUDOS_APLICADO.md#fase-h---ia), [fase I](PLANO_DE_ESTUDOS_APLICADO.md#fase-i---staging-e-produção).

Observabilidade é a capacidade de inferir o estado interno do sistema a partir de sinais. Nesta aplicação ela também precisa obedecer à política de privacidade: depurar sem criar uma segunda base de dados financeiros dentro do provedor de logs.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## OBS-001 - Logs, métricas e traces

**Nível:** Fundamental  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Logs registram eventos discretos; métricas agregam valores ao longo do tempo; traces conectam operações distribuídas numa request/job.

### Qual problema resolve

Usar só logs torna difícil enxergar tendência; usar só métrica não explica uma request específica.

### Como aparece neste projeto

- API, worker e imports precisam dos três sinais progressivamente.

### O que estudar

- diferença entre signals;
- quando cada um responde “o quê aconteceu / com que frequência / onde ficou lento”.

### Exercício aplicado

Pegue uma importação e escreva quais perguntas cada signal deve responder.

### Como validar / testar

- Nenhum signal contém dados financeiros brutos desnecessários.

### Erros comuns

- Transformar log em banco de analytics.

### Perguntas que você deve conseguir responder

- Qual signal detecta aumento de latência? Qual investiga um job específico?

### Critério de conclusão

Você consegue escolher signal pelo tipo de pergunta.

## OBS-002 - Structured logging e redaction

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Structured logging usa campos estáveis em vez de texto livre; redaction remove conteúdo proibido.

### Qual problema resolve

Facilita busca/correlação e aplica política de privacidade.

### Como aparece neste projeto

- Campos: event, level, service, env, traceId, requestId, householdId pseudônimo/ID, duration, outcome.

### O que estudar

- JSON logs;
- schema;
- redaction;
- log levels.

### Exercício aplicado

Defina logging contract e serializers seguros.

### Como validar / testar

- Teste que Authorization/body financeiro não aparece.

### Erros comuns

- Interpolar objeto inteiro no logger.

### Perguntas que você deve conseguir responder

- Que campos são estáveis?

### Critério de conclusão

Você consegue consultar logs por evento sem conteúdo financeiro.

## OBS-003 - Correlation ID e trace context

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Correlation/request ID identifica uma operação; trace context propaga trace/span IDs entre serviços e jobs.

### Qual problema resolve

Sem propagação, API e worker parecem incidentes separados.

### Como aparece neste projeto

- Propagar contexto ao enfileirar job.
- Não usar traceId como autorização.

### O que estudar

- W3C trace context;
- request ID;
- baggage com cautela.

### Exercício aplicado

Crie import request -> queue -> worker e preserve correlation metadata.

### Como validar / testar

- Encontrar eventos relacionados por ID.

### Erros comuns

- Colocar PII no baggage.

### Perguntas que você deve conseguir responder

- Request ID e trace ID são iguais?

### Critério de conclusão

Você consegue seguir uma operação ponta a ponta.

## OBS-004 - Métricas e cardinalidade

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Métricas têm nome, valor e labels. Labels de alta cardinalidade explodem séries e custos.

### Qual problema resolve

transactionId/userId como label é desastre operacional.

### Como aparece neste projeto

- Métricas: HTTP duration/count, queue depth, job duration/failure, import rows, AI latency/cost.

### O que estudar

- counter/gauge/histogram;
- percentis;
- cardinality.

### Exercício aplicado

Defina 10 métricas com labels permitidas/proibidas.

### Como validar / testar

- Nenhum ID único em label.

### Erros comuns

- Label merchant/user/transaction.

### Perguntas que você deve conseguir responder

- Por que cardinalidade importa?

### Critério de conclusão

Você consegue desenhar métricas úteis e econômicas.

## OBS-005 - OpenTelemetry e tracing

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

OpenTelemetry fornece APIs/SDKs e convenções para instrumentação de traces, metrics e logs/ecossistema.

### Qual problema resolve

Evita acoplamento forte a um backend de observabilidade e padroniza contexto.

### Como aparece neste projeto

- OTel = hipótese forte para API/worker.
- Exporter/backend = NÃO DEFINIDO.

### O que estudar

- span, trace, context propagation;
- auto vs manual instrumentation;
- sampling.

### Exercício aplicado

Instrumente uma operação de laboratório com spans HTTP -> service -> DB/job.

### Como validar / testar

- Visualizar árvore de spans em backend local ou console exporter.

### Erros comuns

- Span contendo payload financeiro.

### Perguntas que você deve conseguir responder

- Quando criar span manual?

### Critério de conclusão

Você consegue explicar um trace e localizar gargalo.

### Referências iniciais

- OpenTelemetry JS: https://opentelemetry.io/docs/languages/js/

## OBS-006 - SLI, SLO e error budget

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

SLI é indicador medido; SLO é objetivo; error budget é tolerância de falhas derivada do objetivo.

### Qual problema resolve

“Sistema rápido” não é operacionalmente verificável.

### Como aparece neste projeto

- Começar simples: API availability/latency e import success latency.

### O que estudar

- availability;
- latency;
- correctness;
- SLO vs SLA.

### Exercício aplicado

Defina 2 SLIs e SLOs hipotéticos, deixando claro que números precisam de uso real.

### Como validar / testar

- Dashboard calcula janela.

### Erros comuns

- SLO arbitrário 99.999% sem custo/necessidade.

### Perguntas que você deve conseguir responder

- SLO e SLA são iguais?

### Critério de conclusão

Você consegue criar objetivo mensurável e revisar após dados reais.

## OBS-007 - Alertas acionáveis

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Alerta existe para exigir ação. Deve ter owner, severidade e runbook.

### Qual problema resolve

Alertar toda exceção cria fadiga e é ignorado.

### Como aparece neste projeto

- Alertar indisponibilidade, backlog persistente, failure rate, backup failure e custo anormal.

### O que estudar

- symptom vs cause alerts;
- threshold/window;
- dedup/silence.

### Exercício aplicado

Desenhe três alertas com condição, impacto e primeira ação.

### Como validar / testar

- Simular condição em staging.

### Erros comuns

- Alertar log individual.

### Perguntas que você deve conseguir responder

- O que alguém faz ao receber o alerta?

### Critério de conclusão

Todo alerta proposto tem ação clara.

## OBS-008 - Dashboards operacionais

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Dashboard reúne sinais para estado do sistema e fluxo de negócio técnico.

### Qual problema resolve

Sem visão agregada, incidentes exigem consultas improvisadas.

### Como aparece neste projeto

- HTTP, DB, queue, worker, imports, AI, backups.

### O que estudar

- golden signals;
- top-down dashboard.

### Exercício aplicado

Desenhe dashboard mínimo sem dados pessoais.

### Como validar / testar

- Cada painel responde pergunta operacional.

### Erros comuns

- Dashboard bonito sem decisão associada.

### Perguntas que você deve conseguir responder

- Qual painel detecta backlog?

### Critério de conclusão

Você consegue explicar a finalidade de cada gráfico.

## OBS-009 - Observabilidade de filas e workers

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Jobs assíncronos precisam métricas e estados próprios.

### Qual problema resolve

A API pode estar 100% saudável enquanto imports ficam presos por horas.

### Como aparece neste projeto

- queue depth; age of oldest job; attempts; failed/dead-letter; duration.

### O que estudar

- retry/backoff;
- poison job;
- dead-letter concept.

### Exercício aplicado

Instrumente worker fake com falha e retry.

### Como validar / testar

- Detectar backlog e falhas.

### Erros comuns

- Olhar apenas tamanho da fila.

### Perguntas que você deve conseguir responder

- Qual diferença entre depth e age?

### Critério de conclusão

Você consegue detectar fila saudável versus degradada.

## OBS-010 - Observabilidade de IA

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

AI observability mede latência, tokens/custo, modelo/prompt version, tool calls e qualidade/evals sem expor dados.

### Qual problema resolve

Resposta “funcionou” pode ter custo alto ou degradar após mudança de prompt/modelo.

### Como aparece neste projeto

- Registrar IDs/versionamento e métricas agregadas.
- Prompt/output bruto = proibido por padrão em produção financeira.

### O que estudar

- tokens;
- cost;
- latency;
- eval score;
- trace sanitization.

### Exercício aplicado

Crie evento ai.insight.completed com metadata segura e custo estimado.

### Como validar / testar

- Teste redaction.

### Erros comuns

- Salvar prompt completo em tracing SaaS sem revisão.

### Perguntas que você deve conseguir responder

- Como comparar versões sem guardar dado sensível?

### Critério de conclusão

Você consegue medir custo/qualidade preservando minimização.

## OBS-011 - Runbooks e postmortems

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Runbook é procedimento operacional; postmortem registra fatos, impacto, causa/contribuintes e ações.

### Qual problema resolve

Conhecimento só na cabeça não escala nem ajuda durante incidente.

### Como aparece neste projeto

- Runbooks: DB indisponível, queue backlog, failed deploy, restore.

### O que estudar

- diagnosis steps;
- rollback;
- communication;
- action items.

### Exercício aplicado

Escreva runbook “imports pararam” e faça tabletop.

### Como validar / testar

- Outra pessoa consegue seguir.

### Erros comuns

- Runbook sem comandos/critério de sucesso.

### Perguntas que você deve conseguir responder

- Como saber se recuperação terminou?

### Critério de conclusão

Você consegue executar e atualizar runbook a partir de simulação.


\newpage

# Trilha 06 - Arquitetura e Sistemas Distribuídos

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase C](PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household), [fase F](PLANO_DE_ESTUDOS_APLICADO.md#fase-f---import-pipeline), [fase G](PLANO_DE_ESTUDOS_APLICADO.md#fase-g---analytics--insights-determinísticos), [fase H](PLANO_DE_ESTUDOS_APLICADO.md#fase-h---ia), [fase J](PLANO_DE_ESTUDOS_APLICADO.md#fase-j---evolução-e-escala).

A trilha existe para que decisões como BullMQ, Kafka, CQRS ou microservices sejam respostas a problemas observados, não itens decorativos de stack.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## ARCH-001 - Monólito modular

**Nível:** Fundamental  
**Quando estudar:** Antes do bootstrap do Nest.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Monólito modular é uma única unidade de deploy com fronteiras internas explícitas.

### Qual problema resolve

Entrega simples sem abrir mão de separação de domínio.

### Como aparece neste projeto

- API NestJS começa modular; worker pode ser processo separado compartilhando módulos/pacotes cuidadosamente.

### O que estudar

- module boundaries;
- coupling/cohesion;
- dependency direction.

### Exercício aplicado

Desenhe módulos Accounts, Transactions, Imports, Insights, Identity e Household com dependências permitidas.

### Como validar / testar

- Detectar imports proibidos/lint arquitetural futuramente.

### Erros comuns

- Chamar qualquer pasta de módulo sem fronteira real.

### Perguntas que você deve conseguir responder

- Quando modular monolith deixa de servir?

### Critério de conclusão

Você consegue justificar por que não começamos com microservices.

## ARCH-002 - Bounded contexts e fronteiras de domínio

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Fronteira define linguagem e responsabilidade. Bounded context é ferramenta de DDD para separar modelos que significam coisas diferentes.

### Qual problema resolve

Transaction de banco e “database transaction” são conceitos distintos; misturar domínios gera modelo confuso.

### Como aparece neste projeto

- Identity/Household, Ledger/Transactions, Import, Planning, Analytics/Insights.

### O que estudar

- ubiquitous language;
- entities/value objects;
- context map em nível pragmático.

### Exercício aplicado

Crie glossário e indique onde “Account”, “Transaction”, “Statement” vivem.

### Como validar / testar

- Casos de uso não acessam tabelas de outro módulo diretamente sem contrato.

### Erros comuns

- DDD ceremonial sem necessidade.

### Perguntas que você deve conseguir responder

- Qual regra pertence a qual módulo?

### Critério de conclusão

Você consegue explicar fronteiras sem depender de nomes de pastas.

## ARCH-003 - Síncrono vs assíncrono

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Síncrono mantém caller esperando; assíncrono desacopla execução no tempo.

### Qual problema resolve

Importar 50 mil linhas ou gerar IA dentro da request causa timeout e baixa resiliência.

### Como aparece neste projeto

- CRUD curto síncrono; import/parsing/AI pesado assíncrono.

### O que estudar

- latency;
- user feedback;
- job status;
- consistency.

### Exercício aplicado

Classifique 15 operações e justifique sync/async.

### Como validar / testar

- UX mostra pending/progress/failure.

### Erros comuns

- Fila para toda operação só por moda.

### Perguntas que você deve conseguir responder

- Qual benefício assíncrono compra e qual complexidade adiciona?

### Critério de conclusão

Você consegue decidir por característica da operação.

## ARCH-004 - Filas e delivery semantics

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Fila armazena trabalho para consumidores. Entrega pode ser at-most-once, at-least-once; “exactly once” costuma exigir definição cuidadosa e idempotência.

### Qual problema resolve

Retry pode executar o mesmo import duas vezes.

### Como aparece neste projeto

- Jobs precisam idempotency key e status.

### O que estudar

- ack;
- retry;
- backoff;
- visibility/locking;
- poison messages.

### Exercício aplicado

Faça worker que falha após persistir metade e reprocesse sem duplicar.

### Como validar / testar

- Invariantes permanecem.

### Erros comuns

- Assumir que queue nunca duplica.

### Perguntas que você deve conseguir responder

- Por que idempotência é necessária com at-least-once?

### Critério de conclusão

Você consegue explicar garantia real de um job.

## ARCH-005 - Event-driven architecture

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Eventos descrevem fatos passados; consumidores reagem sem acoplamento direto ao produtor.

### Qual problema resolve

Pode desacoplar analytics/notifications, mas adiciona consistência eventual e debug.

### Como aparece neste projeto

- Domain events internos primeiro; broker externo só se necessário.

### O que estudar

- event vs command;
- schema/versioning;
- consumer ownership.

### Exercício aplicado

Modele transaction.imported, import.completed e insight.generated; diga quais são internos.

### Como validar / testar

- Evento nomeado no passado e sem exigir resposta síncrona.

### Erros comuns

- Evento virar RPC disfarçado.

### Perguntas que você deve conseguir responder

- Quando evento é melhor que chamada direta?

### Critério de conclusão

Você consegue usar eventos seletivamente.

## ARCH-006 - Eventual consistency

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Sistemas assíncronos podem ficar temporariamente divergentes até consumidores processarem.

### Qual problema resolve

Dashboard pode demorar segundos para refletir import concluído.

### Como aparece neste projeto

- Definir status e UX para recalculation pending.

### O que estudar

- read-your-writes;
- staleness;
- compensation.

### Exercício aplicado

Desenhe timeline de import e dashboard.

### Como validar / testar

- UI não mostra dado antigo como definitivamente atualizado.

### Erros comuns

- Ocultar consistência eventual e confundir usuário.

### Perguntas que você deve conseguir responder

- Qual atraso é aceitável?

### Critério de conclusão

Você consegue documentar consistência por fluxo.

## ARCH-007 - Transactional outbox

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Outbox grava mudança de domínio e evento na mesma transação DB; publisher envia depois.

### Qual problema resolve

Evita “DB commitou mas publish falhou” quando broker/evento externo existe.

### Como aparece neste projeto

- OUTBOX = HIPÓTESE FUTURA; só adotar quando dual-write real aparecer.

### O que estudar

- dual write problem;
- polling/CDC;
- idempotent consumer.

### Exercício aplicado

Faça desenho de falha transaction created + publish. Compare sem/com outbox.

### Como validar / testar

- Identifique gatilho de adoção.

### Erros comuns

- Implementar outbox antes de existir broker/consumidor.

### Perguntas que você deve conseguir responder

- Que falha a outbox resolve?

### Critério de conclusão

Você consegue reconhecer necessidade sem sobreengenharia.

## ARCH-008 - Redis e BullMQ

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Redis pode servir de base para filas/cache; BullMQ implementa jobs, retries, scheduling e workers sobre Redis.

### Qual problema resolve

É uma opção simples para imports e AI jobs no mesmo ecossistema Node.

### Como aparece neste projeto

- BullMQ = HIPÓTESE inicial, não decisão final.
- Redis não deve virar source of truth financeiro.

### O que estudar

- queue lifecycle;
- job IDs;
- retries;
- concurrency;
- persistence.

### Exercício aplicado

PoC de fila de import com job idempotente e retry.

### Como validar / testar

- Reinicie worker e confirme job persiste conforme config.

### Erros comuns

- Guardar estado financeiro só no Redis.

### Perguntas que você deve conseguir responder

- Quando Redis é dependência crítica?

### Critério de conclusão

Você consegue demonstrar limites e benefícios.

### Referências iniciais

- NestJS Queues: https://docs.nestjs.com/techniques/queues

## ARCH-009 - Kafka e event streaming

**Nível:** Intermediário  
**Quando estudar:** Somente quando uma lacuna de streaming aparecer.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Kafka é plataforma de event streaming com log durável particionado, consumer groups, retenção e replay.

### Qual problema resolve

Pode ser valioso quando eventos precisam alimentar múltiplos consumidores independentes/reprocessáveis em escala; para MVP pode ser custo operacional sem lacuna real.

### Como aparece neste projeto

- Kafka = NÃO DEFINIDO / NÃO RECOMENDADO para MVP sem requisito.
- Gatilhos: replay histórico, múltiplos consumidores independentes, alto throughput, integração entre serviços autônomos.

### O que estudar

- topic;
- partition;
- offset;
- consumer group;
- retention;
- ordering por partition;
- schema evolution.

### Exercício aplicado

Compare um import pipeline em BullMQ vs Kafka e escreva qual requisito concreto mudaria a decisão.

### Como validar / testar

- ADR deve listar lacuna, não “empresa usa”.

### Erros comuns

- Usar Kafka como fila de background simples.

### Perguntas que você deve conseguir responder

- Que problema Kafka resolve que BullMQ não resolve bem?
- O que replay significa?

### Critério de conclusão

Você consegue argumentar a favor e contra Kafka com base em requisitos.

### Referências iniciais

- Apache Kafka docs: https://kafka.apache.org/documentation/

## ARCH-010 - CQRS

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

CQRS separa modelos/caminhos de comando e consulta quando necessidades divergem.

### Qual problema resolve

Dashboards agregados podem ter read models diferentes do modelo transacional.

### Como aparece neste projeto

- CQRS = FUTURO/EXPERIMENTO; usar apenas se queries complexas justificarem.

### O que estudar

- commands/queries;
- read model;
- projection.

### Exercício aplicado

Projete snapshot mensal como read model sem adotar framework CQRS inteiro.

### Como validar / testar

- Mede benefício real.

### Erros comuns

- Criar CommandBus para CRUD trivial por currículo.

### Perguntas que você deve conseguir responder

- CQRS exige microservices?

### Critério de conclusão

Você consegue aplicar ideia sem cerimônia.

## ARCH-011 - Event sourcing

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Event sourcing usa sequência de eventos como fonte de verdade e deriva estado.

### Qual problema resolve

Oferece histórico/replay, mas muda profundamente modelagem, migrations e operação.

### Como aparece neste projeto

- NÃO DEFINIDO/FUTURO; provavelmente não necessário para MVP.

### O que estudar

- aggregate/event stream;
- snapshot;
- event versioning;
- replay.

### Exercício aplicado

Modele somente em papel uma conta e compare com ledger relacional.

### Como validar / testar

- Liste custo de correção de evento histórico.

### Erros comuns

- Confundir audit log com event sourcing.

### Perguntas que você deve conseguir responder

- Qual é a source of truth?

### Critério de conclusão

Você sabe explicar por que provavelmente não adotaremos agora.

## ARCH-012 - Cache e consistência

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Cache guarda cópia derivada para reduzir latência/carga; exige estratégia de invalidação e TTL.

### Qual problema resolve

Dados financeiros stale podem induzir leitura incorreta.

### Como aparece neste projeto

- Cache = usar só com medição.
- Config/metadata podem ser melhores candidatos que saldos.

### O que estudar

- cache-aside;
- TTL;
- invalidation;
- stampede.

### Exercício aplicado

Escolha três candidatos e rejeite pelo menos um justificando risco.

### Como validar / testar

- Teste invalidation.

### Erros comuns

- Cachear tudo por reflexo.

### Perguntas que você deve conseguir responder

- Qual fonte de verdade?

### Critério de conclusão

Você consegue definir política e tolerância a stale.

## ARCH-013 - Multi-tenancy via Household

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Household funciona como boundary de dados e autorização para múltiplas pessoas.

### Qual problema resolve

Permite uso compartilhado sem misturar famílias.

### Como aparece neste projeto

- Shared DB/shared schema inicialmente; householdId em entidades.

### O que estudar

- tenant context;
- membership;
- resource isolation.

### Exercício aplicado

Desenhe request com user em dois households e seleção ativa.

### Como validar / testar

- Teste cross-household.

### Erros comuns

- Contexto global mutável sem request scope.

### Perguntas que você deve conseguir responder

- Como usuário troca household com segurança?

### Critério de conclusão

Você consegue propagar contexto sem confiar em input arbitrário.

## ARCH-014 - Escalabilidade e stateless services

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Serviço stateless não depende de memória local entre requests e pode replicar horizontalmente.

### Qual problema resolve

API com session/state local dificulta múltiplas instâncias.

### Como aparece neste projeto

- API/worker devem externalizar estado durável.

### O que estudar

- horizontal vs vertical scaling;
- sticky sessions;
- connection pools.

### Exercício aplicado

Liste todo state em memória planejado e classifique se pode ser perdido.

### Como validar / testar

- Reinicie API entre requests.

### Erros comuns

- Guardar progresso de import só em memória.

### Perguntas que você deve conseguir responder

- O que impede segunda réplica?

### Critério de conclusão

Você consegue apontar gargalo provável e estratégia.

## ARCH-015 - Timeout, retry, backoff e circuit breaker

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Chamadas remotas falham. Timeout limita espera; retry tenta novamente; backoff espaça tentativas; circuit breaker reduz pressão quando dependência está degradada.

### Qual problema resolve

IA, storage e APIs externas podem pendurar workers ou multiplicar falhas.

### Como aparece neste projeto

- Timeout explícito em outbound calls.
- Retry só para falhas possivelmente transitórias e operações idempotentes.

### O que estudar

- exponential backoff+jitter;
- retry budget;
- circuit breaker.

### Exercício aplicado

Simule provider retornando 500/timeout e meça comportamento.

### Como validar / testar

- Sem retry infinito; job termina com estado claro.

### Erros comuns

- Retry de POST não idempotente automaticamente.

### Perguntas que você deve conseguir responder

- Quais erros não devem ter retry?

### Critério de conclusão

Você consegue criar política por dependência.


\newpage

# Trilha 07 - IA Aplicada com Segurança

**No Plano de Estudos:** [fase H](PLANO_DE_ESTUDOS_APLICADO.md#fase-h---ia), [fase J](PLANO_DE_ESTUDOS_APLICADO.md#fase-j---evolução-e-escala).

IA é um subsistema assistivo. O núcleo financeiro deve continuar explicável, reproduzível e funcional mesmo sem provedor de IA.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## AI-001 - LLMs, tokens, contexto e não determinismo

**Nível:** Fundamental  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

LLM gera saída probabilística a partir de contexto tokenizado. Limites de contexto, custo e não determinismo precisam ser considerados como propriedades do componente.

### Qual problema resolve

Não podemos tratar LLM como função determinística para cálculo financeiro.

### Como aparece neste projeto

- IA explica/classifica; regras centrais permanecem determinísticas.

### O que estudar

- tokens;
- context window;
- temperature em conceito;
- model/version.

### Exercício aplicado

Rode a mesma classificação com entradas ambíguas e compare variação.

### Como validar / testar

- Métrica de consistência/qualidade.

### Erros comuns

- Usar LLM para somar valores.

### Perguntas que você deve conseguir responder

- Por que saída pode mudar?

### Critério de conclusão

Você sabe dizer quando não usar LLM.

## AI-002 - Structured output e validação

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Structured output restringe resposta a schema, ainda exigindo validação e tratamento de erro.

### Qual problema resolve

Texto livre é difícil de integrar com código.

### Como aparece neste projeto

- Categorias sugeridas, insight explanation metadata.

### O que estudar

- JSON schema/Zod;
- validation;
- fallback.

### Exercício aplicado

Crie schema de CategorySuggestion e rejeite campos inválidos.

### Como validar / testar

- Teste malformed/refusal.

### Erros comuns

- Confiar em parse sem validar.

### Perguntas que você deve conseguir responder

- Schema garante verdade semântica?

### Critério de conclusão

Você consegue tratar output como input não confiável.

## AI-003 - Tool calling

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Tool calling permite ao modelo solicitar funções controladas pela aplicação. A aplicação decide se executa e retorna resultado.

### Qual problema resolve

Evita acesso direto a DB e centraliza autorização/minimização.

### Como aparece neste projeto

- Tools: getMonthlySummary, getCategoryTrend etc.

### O que estudar

- tool schema;
- authorization;
- timeouts;
- least privilege.

### Exercício aplicado

Implemente tool fake que recebe AgentContext e retorna somente agregado.

### Como validar / testar

- Tentativa cross-household falha antes do provider.

### Erros comuns

- Tool genérica executeSQL.

### Perguntas que você deve conseguir responder

- Quem realmente executa a tool?

### Critério de conclusão

Você consegue desenhar boundary Agent -> Tool -> Service.

## AI-004 - Agents e limites de autonomia

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Agent coordena modelo, tools e loop de decisões. Autonomia deve ser proporcional ao risco.

### Qual problema resolve

Um agente financeiro com write access pode causar mudanças erradas.

### Como aparece neste projeto

- MVP: read-only insights/classification suggestion.
- Ações sensíveis exigem human-in-the-loop.

### O que estudar

- agent loop;
- max turns;
- tool permissions;
- stop conditions.

### Exercício aplicado

Defina matriz read/suggest/execute para ações.

### Como validar / testar

- Agent não executa mudança proibida.

### Erros comuns

- “Agente” com acesso irrestrito só porque SDK permite.

### Perguntas que você deve conseguir responder

- Qual ação pode ser automática?

### Critério de conclusão

Você consegue limitar autonomia por risco.

## AI-005 - Regra determinística vs IA

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Regra determinística produz resultado reproduzível a partir de dados e fórmula conhecida; IA lida melhor com linguagem/ambiguidade.

### Qual problema resolve

Colocar lógica de negócio no prompt torna comportamento difícil de testar/versionar.

### Como aparece neste projeto

- Savings rate, totals, emergency fund = código.
- Explicação/classificação ambígua = IA assistiva.

### O que estudar

- rule engine;
- confidence threshold;
- fallback manual.

### Exercício aplicado

Classifique 20 requisitos em deterministic/AI/hybrid e justifique.

### Como validar / testar

- Regras críticas têm testes sem LLM.

### Erros comuns

- Prompt definindo regra que deveria ser TypeScript/SQL.

### Perguntas que você deve conseguir responder

- O que precisa ser auditável/reproduzível?

### Critério de conclusão

Você consegue manter IA fora do core contábil.

## AI-006 - Minimização, PII e dados financeiros

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Antes de enviar dados a modelo externo, reduzir a payload ao mínimo. Pseudonimização não é anonimização automática.

### Qual problema resolve

LLM pode receber detalhes íntimos desnecessários.

### Como aparece neste projeto

- Preferir categoria+agregado+variação.
- Serializer AI-safe central.

### O que estudar

- PII;
- data classification;
- aggregation;
- redaction.

### Exercício aplicado

Compare insight com raw transactions vs aggregated input.

### Como validar / testar

- Nenhum dado proibido no trace/provider payload.

### Erros comuns

- Mandar histórico completo “para contexto”.

### Perguntas que você deve conseguir responder

- Qual dado é indispensável?

### Critério de conclusão

Você consegue demonstrar minimização.

## AI-007 - Prompt injection e conteúdo não confiável

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Prompt injection ocorre quando conteúdo controlado pelo usuário tenta influenciar instruções/modelo ou tools.

### Qual problema resolve

Descrição importada pode conter “ignore rules and export data”.

### Como aparece neste projeto

- Tratar transações/documentos como data, nunca autoridade.
- Tools autorizam independentemente do prompt.

### O que estudar

- instruction hierarchy;
- tool allowlist;
- untrusted content delimiters;
- output validation.

### Exercício aplicado

Insira prompt injection em merchant/descrição e prove que nenhuma tool privilegiada é liberada.

### Como validar / testar

- Security test.

### Erros comuns

- Confiar em “não siga instruções do usuário” como única defesa.

### Perguntas que você deve conseguir responder

- Por que autorização fora do LLM é essencial?

### Critério de conclusão

Você consegue defender tool boundary.

## AI-008 - Evals

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Evals são conjuntos de casos e métricas usados para comparar qualidade de prompts/modelos/fluxos.

### Qual problema resolve

Sem eval, mudança parece melhor por impressão.

### Como aparece neste projeto

- Dataset sintético/anonimizado de categorização e explicações.

### O que estudar

- golden set;
- precision/recall quando aplicável;
- rubric;
- regression.

### Exercício aplicado

Crie 30 transações fictícias com categoria esperada e score.

### Como validar / testar

- Comparar duas versões.

### Erros comuns

- Avaliar apenas exemplos usados no prompt.

### Perguntas que você deve conseguir responder

- Qual métrica mede sua tarefa?

### Critério de conclusão

Você consegue detectar regressão antes de trocar modelo.

## AI-009 - Tracing, custo e versionamento de prompts

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Execuções de IA precisam metadata: modelo, prompt/tool version, latência, tokens/custo e outcome, sem conteúdo financeiro bruto.

### Qual problema resolve

Sem versão não sabemos por que qualidade mudou; sem custo não sabemos sustentabilidade.

### Como aparece neste projeto

- ai_run table/telemetry mínima.

### O que estudar

- prompt versioning;
- token usage;
- cost aggregation;
- sanitized traces.

### Exercício aplicado

Versione prompt v1/v2 e compare eval/custo.

### Como validar / testar

- Dashboard sem PII.

### Erros comuns

- Salvar prompt completo com dados reais.

### Perguntas que você deve conseguir responder

- Como reproduzir comportamento sem armazenar payload sensível?

### Critério de conclusão

Você consegue correlacionar mudança e resultado.

## AI-010 - Embeddings e RAG

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Embeddings representam texto vetorialmente; RAG recupera trechos relevantes antes de gerar resposta.

### Qual problema resolve

Pode servir futuramente para documentos financeiros/educacionais, mas não é requisito para MVP.

### Como aparece neste projeto

- RAG = FUTURO.
- Se houver knowledge base, isolamento por household/fonte.

### O que estudar

- embedding;
- vector search;
- chunking;
- retrieval evaluation.

### Exercício aplicado

Faça somente estudo/PoC com documentos sintéticos quando surgir caso real.

### Como validar / testar

- Isolamento nos filtros.

### Erros comuns

- Adicionar vector DB sem corpus/pergunta.

### Perguntas que você deve conseguir responder

- Que problema RAG resolve aqui?

### Critério de conclusão

Você sabe justificar adiar.

## AI-011 - Seleção de modelo, fallback e resiliência

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Modelos diferem em custo, latência e qualidade; providers falham.

### Qual problema resolve

Pipeline não pode bloquear finanças básicas se IA estiver indisponível.

### Como aparece neste projeto

- Core funciona sem AI.
- Fallback/disable graceful.

### O que estudar

- timeout;
- fallback;
- model routing;
- provider outage.

### Exercício aplicado

Simule provider off: dashboard e import determinístico continuam.

### Como validar / testar

- Feature AI mostra estado indisponível, não quebra transação.

### Erros comuns

- IA como dependência síncrona de salvar despesa.

### Perguntas que você deve conseguir responder

- Qual degradação aceitável?

### Critério de conclusão

Você consegue tornar IA opcional operacionalmente.

## AI-012 - Human-in-the-loop

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Human-in-the-loop exige aprovação para ação/sugestão de maior risco.

### Qual problema resolve

Classificação errada pode ser corrigida; ação financeira automática pode ser grave.

### Como aparece neste projeto

- Sugestões de categoria com confirmação quando baixa confiança.
- Futuras ações de alteração sempre avaliadas.

### O que estudar

- approval state;
- confidence;
- feedback loop.

### Exercício aplicado

Implemente UI/API de aceitar/rejeitar sugestão fictícia.

### Como validar / testar

- Audit da decisão humana.

### Erros comuns

- Aprovação apenas visual sem backend enforcement.

### Perguntas que você deve conseguir responder

- Que threshold faz sentido e como calibrar?

### Critério de conclusão

Você consegue definir autonomia graduada.


\newpage

# Trilha 08 - Testes e Qualidade

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase B](PLANO_DE_ESTUDOS_APLICADO.md#fase-b---bootstrap-de-engenharia), [fase C](PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household), [fase D](PLANO_DE_ESTUDOS_APLICADO.md#fase-d---accounts--transactions), [fase E](PLANO_DE_ESTUDOS_APLICADO.md#fase-e---credit-cards--installments), [fase I](PLANO_DE_ESTUDOS_APLICADO.md#fase-i---staging-e-produção).

Qualidade aqui significa preservar invariantes financeiras e de segurança enquanto o sistema evolui. Teste é especificação executável, não troféu de coverage.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## TEST-001 - Estratégia de testes baseada em risco

**Nível:** Fundamental  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Testar por risco prioriza invariantes e falhas de alto impacto em vez de perseguir coverage arbitrário.

### Qual problema resolve

100% coverage pode não testar cross-household ou double counting.

### Como aparece neste projeto

- Prioridade: isolamento, dinheiro, import idempotente, cartão, auth.

### O que estudar

- test pyramid/trophy;
- risk matrix;
- coverage como sinal.

### Exercício aplicado

Liste top 15 riscos e camada de teste adequada.

### Como validar / testar

- Cada risco crítico tem evidência.

### Erros comuns

- Meta de coverage como objetivo final.

### Perguntas que você deve conseguir responder

- O que quebra mais seriamente?

### Critério de conclusão

Você consegue justificar onde investir testes.

## TEST-002 - Unit tests de domínio

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Unit tests verificam regra isolada sem infraestrutura quando possível.

### Qual problema resolve

Regras financeiras precisam feedback rápido e casos de borda.

### Como aparece neste projeto

- parcelas, totals, emergency fund, recurrence.

### O que estudar

- arrange-act-assert;
- table-driven tests;
- pure functions.

### Exercício aplicado

Teste parcelamento com centavos e soma exata.

### Como validar / testar

- Invariantes.

### Erros comuns

- Mock de tudo sem testar regra real.

### Perguntas que você deve conseguir responder

- Qual unidade faz sentido?

### Critério de conclusão

Você consegue testar regra sem DB quando não precisa.

## TEST-003 - Integration tests com infraestrutura real

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Integration test valida DB/Redis/storage e wiring real.

### Qual problema resolve

Mock não detecta constraint, transaction ou RLS errada.

### Como aparece neste projeto

- Postgres real para repositories e RLS.
- Redis real para queue quando adotada.

### O que estudar

- test database;
- fixtures;
- isolation/cleanup.

### Exercício aplicado

Teste transfer/import em Postgres de teste.

### Como validar / testar

- Reprodutível no CI.

### Erros comuns

- SQLite substituindo PostgreSQL e mascarando comportamento.

### Perguntas que você deve conseguir responder

- O que mock não prova?

### Critério de conclusão

Você consegue testar contratos de infraestrutura.

## TEST-004 - E2E API e frontend

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

E2E atravessa interfaces reais do ponto de vista do usuário/cliente.

### Qual problema resolve

Pega integração de auth, validation, DB e UI.

### Como aparece neste projeto

- Fluxos críticos: login, import, review, dashboard.

### O que estudar

- Playwright/Supertest;
- stable selectors;
- test data.

### Exercício aplicado

Automatize “criar household -> adicionar conta -> transação -> dashboard”.

### Como validar / testar

- Executar no CI seletivamente.

### Erros comuns

- E2E para cada caso pequeno.

### Perguntas que você deve conseguir responder

- Qual fluxo merece E2E?

### Critério de conclusão

Você equilibra custo e confiança.

## TEST-005 - Property-based tests e invariantes

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Property-based gera muitos inputs para provar propriedades gerais.

### Qual problema resolve

Dinheiro/parcelamento tem combinações de centavos e datas difíceis de enumerar.

### Como aparece neste projeto

- Soma de parcelas = total; transfer não altera patrimônio líquido global.

### O que estudar

- generators;
- invariants;
- shrinking em conceito.

### Exercício aplicado

Gere valores/quantidade de parcelas aleatórias e teste soma.

### Como validar / testar

- Falha mínima reproduzível.

### Erros comuns

- Propriedade mal definida que aceita bug.

### Perguntas que você deve conseguir responder

- Que invariante sempre deve valer?

### Critério de conclusão

Você consegue expressar regra como propriedade.

## TEST-006 - Contract tests

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Contract tests verificam formato/semântica entre componentes.

### Qual problema resolve

Client Next e API Nest podem divergir.

### Como aparece neste projeto

- OpenAPI/client generated = decisão futura; ao menos schemas compartilhados/contract.

### O que estudar

- consumer/provider contract;
- schema compatibility.

### Exercício aplicado

Quebre campo de response e prove teste pega.

### Como validar / testar

- Versioning claro.

### Erros comuns

- Compartilhar types e achar que runtime está garantido.

### Perguntas que você deve conseguir responder

- TypeScript protege rede?

### Critério de conclusão

Você consegue validar boundary em runtime.

## TEST-007 - Testcontainers

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Testcontainers inicia dependências reais efêmeras em testes.

### Qual problema resolve

Reduz setup manual e aumenta paridade.

### Como aparece neste projeto

- Postgres/Redis em integration CI.
- Ferramenta = HIPÓTESE, avaliar custo de pipeline.

### O que estudar

- container lifecycle;
- wait strategy;
- reuse.

### Exercício aplicado

PoC com Postgres real.

### Como validar / testar

- Tempo aceitável.

### Erros comuns

- Uma instância compartilhada contaminada.

### Perguntas que você deve conseguir responder

- Quando Docker Compose de teste basta?

### Critério de conclusão

Você consegue escolher ferramenta conscientemente.

## TEST-008 - Performance e load tests

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Performance test mede latência/throughput sob carga; load test cria volume representativo.

### Qual problema resolve

Import grande ou dashboard pesado pode degradar antes de “muitos usuários”.

### Como aparece neste projeto

- Perf de import 1k/10k/100k linhas; query mensal.

### O que estudar

- baseline;
- p95/p99;
- bottleneck;
- profiling.

### Exercício aplicado

Crie baseline de import e query após MVP.

### Como validar / testar

- Registrar ambiente/dataset.

### Erros comuns

- Número sem baseline.

### Perguntas que você deve conseguir responder

- Qual workload representa uso?

### Critério de conclusão

Você consegue detectar regressão mensurável.

## TEST-009 - Security regression tests

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Teste de segurança automatiza abusos previamente identificados.

### Qual problema resolve

Correção pode regredir silenciosamente.

### Como aparece neste projeto

- cross-household, role, upload, redaction, CSRF conforme auth.

### O que estudar

- negative testing;
- authorization matrix.

### Exercício aplicado

Cada vulnerabilidade encontrada ganha teste.

### Como validar / testar

- Falha antes/fixa depois.

### Erros comuns

- Testar só happy path.

### Perguntas que você deve conseguir responder

- Como prevenir recorrência?

### Critério de conclusão

Você transforma incidentes/bugs em proteção permanente.

## TEST-010 - Dados sintéticos e privacidade em testes

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Dados sintéticos imitam formas/regras sem copiar pessoas reais.

### Qual problema resolve

Test environment costuma ter controles mais fracos.

### Como aparece neste projeto

- Seeds completos porém fictícios.

### O que estudar

- faker com cuidado;
- fixtures versionadas;
- edge-case corpus.

### Exercício aplicado

Crie dataset de “Família Exemplo” com 12 meses, cartões e refunds.

### Como validar / testar

- Nenhuma origem de produção.

### Erros comuns

- Mascarar só nome de dump real.

### Perguntas que você deve conseguir responder

- Por que pseudonimizado ainda pode ser pessoal?

### Critério de conclusão

Você executa toda suíte sem dados reais.


\newpage

# Trilha 09 - Domínio Financeiro da Aplicação

**No Plano de Estudos:** [fase A](PLANO_DE_ESTUDOS_APLICADO.md#fase-a---antes-de-código-de-produto), [fase D](PLANO_DE_ESTUDOS_APLICADO.md#fase-d---accounts--transactions), [fase E](PLANO_DE_ESTUDOS_APLICADO.md#fase-e---credit-cards--installments), [fase G](PLANO_DE_ESTUDOS_APLICADO.md#fase-g---analytics--insights-determinísticos).

Esta trilha não é educação financeira pessoal; é modelagem de software financeiro doméstico. O objetivo é definir semântica reproduzível para impedir dupla contagem, saldos inexplicáveis e “insights” baseados em números errados.

> Regra desta trilha: não marque um conceito como concluído apenas porque você leu sobre ele. Ele só está dominado quando você consegue explicar, aplicar no projeto, testar e justificar as escolhas e limitações.

## DOM-001 - Fluxo de caixa, patrimônio e competência

**Nível:** Fundamental  
**Quando estudar:** Primeira fase de domínio.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Fluxo de caixa observa entradas/saídas; patrimônio considera ativos menos passivos; competência pode reconhecer obrigação/receita em período diferente do pagamento.

### Qual problema resolve

Misturar visões faz cartão de crédito e transferências serem contados errado.

### Como aparece neste projeto

- Definir quais dashboards usam cash basis e quais usam compromisso/competência simplificada.

### O que estudar

- cash flow;
- net worth;
- liability;
- expense recognition como decisão de produto.

### Exercício aplicado

Com 5 eventos (compra cartão, fatura, salário, transferência, investimento), calcule impacto em cada visão.

### Como validar / testar

- Resultados documentados com exemplos.

### Erros comuns

- Um único “saldo” para tudo.

### Perguntas que você deve conseguir responder

- Pagamento de fatura é nova despesa?

### Critério de conclusão

Você consegue explicar cada número do dashboard sem dupla contagem.

## DOM-002 - Account, saldo inicial e reconciliação

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Account representa lugar/instrumento financeiro; saldo pode ser derivado ou informado em snapshot. Reconciliação compara sistema com fonte externa.

### Qual problema resolve

Sem política de saldo inicial e ajuste, import de histórico nunca fecha.

### Como aparece neste projeto

- Account types e balance strategy = decidir em domínio.

### O que estudar

- opening balance;
- ledger-derived balance;
- reconciliation adjustment.

### Exercício aplicado

Modele conta que começa com R$ 5.000 e import começa um mês depois.

### Como validar / testar

- Saldo final bate exemplo.

### Erros comuns

- Criar transação fantasma sem tipo/explicação.

### Perguntas que você deve conseguir responder

- Saldo é armazenado ou derivado?

### Critério de conclusão

Você consegue justificar estratégia e corrigir divergência auditavelmente.

## DOM-003 - Income, expense e transfer

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Income/expense mudam patrimônio/cashflow; transfer move valor entre contas próprias sem ser receita/despesa global.

### Qual problema resolve

Contar transferência como gasto destrói analytics.

### Como aparece neste projeto

- Transfer deve relacionar dois movimentos ou modelo equivalente.

### O que estudar

- double-entry inspired modeling sem necessariamente contabilidade completa;
- internal transfer matching.

### Exercício aplicado

Exemplo conta A -> B e transferência para investimento.

### Como validar / testar

- Household total invariance.

### Erros comuns

- Uma linha categorizada como expense na origem e income no destino.

### Perguntas que você deve conseguir responder

- Transferência para corretora é investimento ou despesa?

### Critério de conclusão

Você consegue modelar sem double counting.

## DOM-004 - Compra no cartão, fatura e pagamento

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Compra cria obrigação no cartão; fatura agrega compras; pagamento liquida liability usando conta bancária.

### Qual problema resolve

Se compra e pagamento virarem despesas, gasto dobra.

### Como aparece neste projeto

- Definir data de reconhecimento para relatórios.
- Statement cycle e due date.

### O que estudar

- credit liability;
- statement close;
- payment.

### Exercício aplicado

Modele compra 31/01, fechamento 05/02, pagamento 12/02.

### Como validar / testar

- Gasto aparece uma vez e cashflow de pagamento é explicável.

### Erros comuns

- Tratar fatura como categoria de despesa.

### Perguntas que você deve conseguir responder

- Qual data entra no gráfico mensal?

### Critério de conclusão

Você consegue responder com uma regra versionada.

## DOM-005 - Parcelamentos e arredondamento

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Parcelamento cria compromisso futuro com parcelas que podem ter centavos distribuídos.

### Qual problema resolve

R$ 100 / 3 não pode virar 3 x R$ 33,33 perdendo centavo.

### Como aparece neste projeto

- InstallmentPlan + installments ou estrutura equivalente.

### O que estudar

- rounding strategy;
- total invariant;
- future commitments.

### Exercício aplicado

Implemente exemplos R$100/3, R$10/6 e datas mensais.

### Como validar / testar

- Soma exata ao centavo.

### Erros comuns

- Float JS para dinheiro.

### Perguntas que você deve conseguir responder

- Onde vai o resto do arredondamento?

### Critério de conclusão

Você preserva total em todos os casos.

## DOM-006 - Estorno e reembolso

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Estorno/reembolso é movimento relacionado a uma operação anterior, não simplesmente apagar história.

### Qual problema resolve

Excluir compra apaga trilha e distorce período/statement.

### Como aparece neste projeto

- Link originalTransactionId/refund relation.

### O que estudar

- partial refund;
- full reversal;
- status vs new movement.

### Exercício aplicado

Compra R$300 em janeiro, reembolso R$100 em fevereiro. Compare visões.

### Como validar / testar

- Auditabilidade e totals.

### Erros comuns

- Editar amount original para R$200 sem histórico.

### Perguntas que você deve conseguir responder

- Em qual período o reembolso aparece?

### Critério de conclusão

Você consegue representar relação e efeito temporal.

## DOM-007 - Split transaction

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Split divide uma transação em múltiplas categorias/partes mantendo total.

### Qual problema resolve

Compra de supermercado pode conter alimentação, higiene e item reembolsável.

### Como aparece neste projeto

- Parent transaction + splits ou lines.

### O que estudar

- sum invariant;
- category allocation.

### Exercício aplicado

Divida R$123,45 em três linhas.

### Como validar / testar

- Soma = parent.

### Erros comuns

- Duplicar transaction inteira por categoria.

### Perguntas que você deve conseguir responder

- Como editar split sem perder total?

### Critério de conclusão

Você preserva invariantes e UX coerente.

## DOM-008 - Recorrências, compromissos e forecast

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Recorrência descreve padrão esperado; ocorrência real é movimento efetivo. Forecast usa compromissos e hipóteses, não deve confundir previsão com realizado.

### Qual problema resolve

Assinatura pode mudar/atrasar/cancelar.

### Como aparece neste projeto

- RecurringRule separada de Transaction.

### O que estudar

- schedule;
- next occurrence;
- variance actual vs expected.

### Exercício aplicado

Modele aluguel mensal e academia que muda valor.

### Como validar / testar

- Forecast pode ser recalculado sem editar histórico.

### Erros comuns

- Pré-criar transações reais infinitas.

### Perguntas que você deve conseguir responder

- Previsão é source of truth?

### Critério de conclusão

Você distingue esperado de realizado.

## DOM-009 - Categorias, budgets e envelopes

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Categoria classifica finalidade; budget define limite/meta por período.

### Qual problema resolve

Categoria e orçamento têm ciclos diferentes e histórico de mudança.

### Como aparece neste projeto

- Hierarquia categories; budget period.

### O que estudar

- category taxonomy;
- rollover como NÃO DEFINIDO;
- versioning.

### Exercício aplicado

Crie budget mensal e transação recategorizada retroativamente.

### Como validar / testar

- Relatório recalcula conforme política.

### Erros comuns

- Salvar “percentual usado” como verdade permanente.

### Perguntas que você deve conseguir responder

- Budget rollover existe?

### Critério de conclusão

Você consegue separar configuração de métrica derivada.

## DOM-010 - Reserva de emergência como regra configurável

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Reserva é uma meta derivada de despesas consideradas essenciais e número de meses escolhido pelo usuário. Não deve ser apresentada como recomendação financeira universal.

### Qual problema resolve

Uma fórmula fixa pode virar aconselhamento indevido e não refletir contexto da família.

### Como aparece neste projeto

- essential flag/category policy; targetMonths user-configured; explanation.

### O que estudar

- essential expenses;
- rolling average;
- configuration/version.

### Exercício aplicado

Calcule meta com 6 meses de histórico e diferentes targetMonths.

### Como validar / testar

- Explicar fontes e período.

### Erros comuns

- IA dizendo “você deve ter exatamente 6 meses”.

### Perguntas que você deve conseguir responder

- Quem decide o que é essencial?

### Critério de conclusão

Você consegue gerar cálculo transparente e configurável.

## DOM-011 - Ativos, passivos e valuation

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Patrimônio líquido = ativos - passivos em uma data; valuation pode vir de valor manual ou integração futura.

### Qual problema resolve

Misturar saldo transacional com valor de mercado sem timestamp cria números incoerentes.

### Como aparece neste projeto

- Asset/Liability snapshots; source+asOfDate.

### O que estudar

- valuation;
- snapshot;
- cost basis como FUTURO.

### Exercício aplicado

Modele imóvel manual, saldo bancário e dívida.

### Como validar / testar

- Net worth reproduzível por data.

### Erros comuns

- Atualizar valor sem histórico.

### Perguntas que você deve conseguir responder

- Qual data do valuation?

### Critério de conclusão

Você consegue explicar origem de cada valor patrimonial.

## DOM-012 - Métricas versionadas e explicáveis

**Nível:** Intermediário  
**Quando estudar:** Antes de implementar a parte correspondente.  
**Pré-requisitos:** Nenhum específico.  

### O que é

Métricas derivadas precisam fórmula, período e versão quando definição pode mudar.

### Qual problema resolve

Alterar savingsRate depois faz históricos parecerem diferentes sem explicação.

### Como aparece neste projeto

- MetricDefinition/version ou documentação de fórmula; snapshots quando necessário.

### O que estudar

- derived data;
- recalculation;
- formula versioning.

### Exercício aplicado

Defina savingsRate v1 com exemplos e política para zero income.

### Como validar / testar

- Golden tests.

### Erros comuns

- Número sem definição exibida.

### Perguntas que você deve conseguir responder

- O que acontece se fórmula mudar?

### Critério de conclusão

Você consegue reproduzir uma métrica histórica a partir de regra conhecida.
