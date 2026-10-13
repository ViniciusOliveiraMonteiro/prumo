# Prumo

**Inteligência financeira para colocar sua casa no eixo.**

Prumo é uma plataforma de inteligência financeira doméstica em início de desenvolvimento. `prumo-web/` contém a interface Next.js e `prumo-api/` a API NestJS. As ADRs 030–035 definem a arquitetura base e a organização do código; o andamento do bootstrap está em [docs/BOOTSTRAP_SPRINT_3.md](docs/BOOTSTRAP_SPRINT_3.md).

Para executar localmente, use Node 24.21.0 e pnpm 12.8.1. Copie `.env.example` para `.env` e substitua a senha de desenvolvimento; `.env` não entra no Git. Na raiz, rode `pnpm install --frozen-lockfile`, `docker compose up -d --wait postgres`, `pnpm --filter prumo-api build`, `pnpm --filter prumo-api db:migrate`, `pnpm dev:api` e `pnpm dev:web` em terminais separados. A web atende em `http://localhost:3000`; `/api/health` é encaminhado à API na porta 3001. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm --filter prumo-api test:e2e`, `pnpm --filter prumo-api test:db`, `pnpm contract:check` e `pnpm build` são os checks. O teste de banco requer PostgreSQL local ativo.

Comece por [Plano de desenvolvimento](docs/PLANO_DE_DESENVOLVIMENTO.md) para acompanhar sprints e próximos passos. O [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) define produto e domínio; o [Plano de Estudos](PLANO_DE_ESTUDOS_APLICADO.md) e o [Caderno](CADERNO_DE_ESTUDOS_APLICADO.md) orientam o aprendizado. Decisões aprovadas ficam em `docs/decisions/` e instruções para o Codex em `AGENTS.md`.

O Git foi inicializado na raiz. A implementação de produto começa após os gates de domínio, segurança e arquitetura descritos no plano.
