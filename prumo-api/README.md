# prumo-api

Diretório da API no monorepo Prumo.

NestJS com TypeScript e PostgreSQL foram escolhidos na ADR-030; Drizzle para acesso ao banco foi escolhido na ADR-031. A ADR-033 aceitou sessões revogáveis sob autoridade da API; a ADR-037 aprovou o esquema mínimo de identidade. A ADR-034 aceitou origem única no navegador, com `/api` roteado para o NestJS. A API implementa login privado, identidade corrente e logout; ainda não há membership, autorização financeira ou endpoints financeiros.

`@nestjs/authentication` está integrado com `DrizzleSessionStore` nas tabelas `identity.users` e `identity.sessions`. `test/authentication.db-spec.ts` continua sendo um laboratório descartável do contrato oficial; a repetição desse contrato nas tabelas migradas permanece pendente.

Da raiz do repositório, execute `pnpm dev:api` após instalar as dependências; a API atende em `127.0.0.1:3001`. Para o banco local, copie `.env.example` para `.env`, defina a mesma senha local em `PRUMO_DB_PASSWORD` e `PRUMO_DATABASE_URL`, e outra senha em `PRUMO_APP_DATABASE_URL`. Execute `docker compose up -d --wait postgres`, `pnpm --filter prumo-api build`, `pnpm --filter prumo-api db:migrate` e `pnpm --filter prumo-api db:prepare-app`. A primeira migração cria uma tabela de verificação; as seguintes criam identidade e corrigem o formato do hash de sessão. O runner aplica SQL versionado com checksum em transação. `pnpm --filter prumo-api test:db` usa PostgreSQL local; não aponte o laboratório para outro banco.

Para a primeira conta privada, execute `pnpm --filter prumo-api db:provision-user seu-email@exemplo.com` em um terminal local; a senha é lida em prompt sem eco, sem argumento ou variável de ambiente. O comando exige o banco local `prumo_dev` e a role migradora. `POST /api/auth/sign-in`, `GET /api/auth/me`, `POST /api/auth/sign-out` e `POST /api/auth/sign-out-all` compõem o fluxo HTTP inicial. `PRUMO_PUBLIC_ORIGIN` deve ser a origem pública da web, como `http://localhost:3000` no desenvolvimento; sem ela, a aplicação só assume essa origem fora de produção. Login em ambiente público ainda exige os gates de abuso, recuperação e HTTPS descritos na ADR-033/037.

Da raiz, `pnpm --filter prumo-api lint`, `typecheck`, `test`, `test:e2e`, `test:db` e `build` são verificações direcionadas. Após alterar respostas HTTP, gere o contrato com `pnpm contract:generate` e valide `pnpm contract:check` e a web. O esquema financeiro e a decisão final de RLS seguem pendentes.

Propósito, regras e execução completa estão no [Guia da aplicação](../docs/application/GUIA_DA_APLICACAO.md). O bootstrap está em [BOOTSTRAP_SPRINT_3](../docs/operations/BOOTSTRAP_SPRINT_3.md) e as instruções de trabalho em `../AGENTS.md`.
