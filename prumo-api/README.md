# prumo-api

Diretório da API no monorepo Prumo.

NestJS com TypeScript e PostgreSQL foram escolhidos na ADR-030; Drizzle para acesso ao banco foi escolhido na ADR-031. A ADR-033 aceitou sessões revogáveis sob autoridade da API para o primeiro acesso web privado, ainda sem implementação. A ADR-034 aceitou origem única no navegador, com `/api` roteado para o NestJS. O endpoint implementado `GET /api/health` usa porta de aplicação e adapter injetado. A API ativa proteção de origem para requisições mutáveis, mas ainda não tem login, autorização ou endpoints financeiros.

O candidato `@nestjs/authentication` está instalado. `test/authentication.db-spec.ts` valida apenas o contrato de `SessionStore` em um schema PostgreSQL descartável com Drizzle; ainda não há store registrado na aplicação nem migração de identidade.

Da raiz do repositório, execute `pnpm dev:api` após instalar as dependências; a API atende em `127.0.0.1:3001`. Para o banco local, copie `.env.example` para `.env`, defina a mesma senha local em `PRUMO_DB_PASSWORD` e `PRUMO_DATABASE_URL`, execute `docker compose up -d --wait postgres`, `pnpm --filter prumo-api build` e `pnpm --filter prumo-api db:migrate`. A migração `migrations/0001_bootstrap.sql` cria apenas uma tabela de verificação; o runner aplica SQL versionado com checksum em transação. `pnpm --filter prumo-api test:db` usa PostgreSQL local e uma estrutura descartável com role restrita. Não aponte o laboratório para outro banco.

Da raiz, `pnpm --filter prumo-api lint`, `typecheck`, `test`, `test:e2e`, `test:db` e `build` são verificações direcionadas. Após alterar respostas HTTP, gere o contrato com `pnpm contract:generate` e valide `pnpm contract:check` e a web. O esquema financeiro e a decisão final de RLS seguem pendentes.

Propósito, regras e execução completa estão no [Guia da aplicação](../docs/application/GUIA_DA_APLICACAO.md). O bootstrap está em [BOOTSTRAP_SPRINT_3](../docs/operations/BOOTSTRAP_SPRINT_3.md) e as instruções de trabalho em `../AGENTS.md`.
