# prumo-api

Diretório da API no monorepo Prumo.

NestJS com TypeScript e PostgreSQL foram escolhidos na ADR-030; Drizzle para acesso ao banco foi escolhido na ADR-031. A ADR-033 aceitou sessões revogáveis sob autoridade da API para o primeiro acesso web privado. A ADR-034 aceitou origem única no navegador, com `/api` roteado para o NestJS. O bootstrap operacional e seus limites estão em `../docs/BOOTSTRAP_SPRINT_3.md`. O endpoint `GET /api/health` usa porta de aplicação e adapter injetado. `migrations/0001_bootstrap.sql` cria somente uma tabela de verificação; `pnpm db:migrate` aplica migrações versionadas com checksum em transação. `pnpm test:db` exercita a role restrita e uma estrutura de laboratório descartável. Autenticação, esquema financeiro e decisão final de RLS seguem pendentes.

As instruções gerais estão em `../AGENTS.md` e os documentos de produto na pasta pai. Mudanças no contrato com o frontend exigem validação dos dois lados.
