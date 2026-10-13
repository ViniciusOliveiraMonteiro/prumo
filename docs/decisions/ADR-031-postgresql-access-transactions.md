# ADR-031: acesso ao PostgreSQL e transações

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

A ADR-030 escolheu NestJS, PostgreSQL e pnpm. O primeiro fluxo financeiro exige confirmação atômica dos efeitos e da identidade do pedido (ADR-027), revisão por versão esperada, autorização e consultas escopadas por household (ADR-029) e valores finais em centavos inteiros (ADR-006). O Plano Mestre ainda não escolhia ORM. O esquema físico, o tipo SQL de dinheiro e RLS continuam pendentes.

Esta decisão escolhe a camada de acesso para `prumo-api/` sem definir tabelas. A escolha precisa permitir SQL explícito e transações que levem o mesmo contexto de autorização por toda a operação. O laboratório de RLS continua obrigatório e separado.

## Alternativas

| Opção | Vantagem | Custo ou risco para este projeto |
|---|---|---|
| Prisma | Modelo declarativo, cliente tipado e migrações integradas | A superfície de transações e SQL varia entre versões; precisa ser comprovada com a role, o pool e os padrões de consulta do Prumo. |
| Drizzle + driver PostgreSQL | Consultas próximas de SQL, transações explícitas e migrações versionadas | Maior responsabilidade por filtros, mapeamento e revisão do SQL; tipos TypeScript não substituem constraints nem testes no banco. |
| TypeORM | Integração conhecida com NestJS, entidades e transações | Entidades e carregamento de relações podem ocultar consultas e escopo; exigiria disciplina adicional para evitar leitura global por ID. |
| Driver SQL sem ORM | Controle total sobre SQL e transações | Mais código repetitivo de mapeamento, migrações e tipos para o primeiro fluxo. |

## Decisão

Usar **Drizzle ORM com driver PostgreSQL** em `prumo-api/`, com migrações SQL versionadas e revisadas. `prumo-web/` não acessa o banco. A API concentra acesso em repositórios ou funções de consulta que exigem contexto autorizado de household para dados financeiros. Toda operação composta recebe um objeto de transação explícito; suas consultas, verificações e escritas usam a mesma transação, inclusive pedido idempotente, evento, movimentos e revisão. Não abrir uma segunda conexão ou transação dentro de uma operação composta.

Consultar e alterar por `household_id` junto com o ID do recurso, inclusive listas e agregados; confirmar pertença de cada vínculo. Usar constraints e operações condicionais no banco para impedir duplicação do pedido, versões concorrentes e vínculos cruzados. O modelo físico dessas constraints, o nível de isolamento, locks e política de retry exigem laboratório com PostgreSQL real. Não confiar em tipos do ORM, filtros voluntários ou guard da API como prova única de isolamento. Se RLS for adotada após DB-008, propagar o contexto no escopo seguro da transação e testar reuso de conexões com a role da aplicação.

Não converter valores de dinheiro em `Number` durante leitura, cálculo ou escrita. Testar o mapeamento de inteiros e seu limite antes de escolher o tipo SQL e a representação no contrato da API. A decisão sobre `bigint` versus outra representação fica em ADR ou contrato de esquema específico, coerente com a ADR-006.

## Gate de validação para o bootstrap

Antes de considerar a integração pronta, demonstrar num teste com PostgreSQL real e role de aplicação: (1) rollback integral de uma transferência quando a segunda escrita falha; (2) dez comandos simultâneos com a mesma chave produzindo um efeito; (3) duas revisões da mesma versão com uma vencedora; (4) consulta e vínculo cruzado A/B negados; (5) mapeamento monetário sem perda de centavos em valor acima de `Number.MAX_SAFE_INTEGER` se esse intervalo for permitido pelo modelo; (6) migração reprodutível do zero. Esses testes verificam a decisão e podem revelar necessidade de revisá-la antes do esquema definitivo. Não declaram que esses comportamentos já estejam implementados.

## Consequências e pendências

A proximidade com SQL facilita auditar filtros e transações do primeiro fluxo, ao custo de mais SQL e revisão cuidadosa. A escolha não decide autenticação, sessão, contrato HTTP, schema físico, limites numéricos, RLS nem política final de concorrência. A próxima decisão da Sprint 2 deve definir o contrato da API entre web e NestJS; a autenticação e a matriz de permissões exigem estudo próprio antes do fluxo de identidade. O laboratório de RLS com pool e role reais antecede dados financeiros de usuários externos.

## Fontes técnicas consultadas

- [Drizzle: transações](https://orm.drizzle.team/docs/transactions), [migrações](https://orm.drizzle.team/docs/migrations), [SQL parametrizado](https://orm.drizzle.team/docs/sql) e [RLS](https://orm.drizzle.team/docs/rls).
- [Prisma: transações](https://www.prisma.io/docs/orm/fundamentals/transactions) e [migrações](https://www.prisma.io/docs/orm/migrations/how-migrations-work).
- [TypeORM: transações](https://typeorm.io/docs/advanced-topics/transactions/).
- [PostgreSQL: isolamento de transações](https://www.postgresql.org/docs/current/transaction-iso.html) e [tipos numéricos](https://www.postgresql.org/docs/current/datatype-numeric.html).

## Conceitos para estudo

ORM versus query builder, migrações, atomicidade, isolamento transacional, operação condicional, constraint, escopo de tenant, pool de conexões e representação monetária.
