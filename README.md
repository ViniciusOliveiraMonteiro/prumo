# Prumo

**Inteligência financeira para colocar sua casa no eixo.**

Prumo é uma plataforma de inteligência financeira doméstica em desenvolvimento. Pretende consolidar dados de uma residência e explicar saldos, despesas, orçamento e indicadores com regras rastreáveis. Hoje o repositório contém o bootstrap técnico, a API com login privado e sessões revogáveis, PostgreSQL local e testes. A web ainda não tem formulário de login nem fluxos financeiros.

Leia o [Guia da aplicação](docs/application/GUIA_DA_APLICACAO.md) para propósito, tecnologias, regras aprovadas, estado de implementação, execução local e verificações. O [Plano de desenvolvimento](docs/planning/PLANO_DE_DESENVOLVIMENTO.md) mostra o andamento e a próxima ação.

## Início rápido

Use Node.js `>=24.21.0 <25`, pnpm `12.8.1` e Docker integrado à distro. Na raiz do repositório, copie `.env.example` para `.env`; use uma senha local para `PRUMO_DB_PASSWORD` e a URL migradora, e outra para `PRUMO_APP_DATABASE_URL`. Depois execute:

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait postgres
pnpm --filter prumo-api build
pnpm --filter prumo-api db:migrate
pnpm --filter prumo-api db:prepare-app
```

Inicie `pnpm dev:api` e `pnpm dev:web` em terminais separados. Acesse `http://localhost:3000` e `http://localhost:3000/api/health`. Para os checks disponíveis e solução de problemas, consulte o [guia](docs/application/GUIA_DA_APLICACAO.md#verificações-e-contrato).

## Repositório

- [`prumo-web/`](prumo-web/README.md): interface Next.js e encaminhamento de `/api`.
- [`prumo-api/`](prumo-api/README.md): API NestJS, contrato OpenAPI, migrações e testes de banco.
- [`docs/`](docs/README.md): índice de aplicação, decisões, domínio, segurança, execução e aprendizado.

O [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) orienta o produto; as ADRs registram decisões; código e testes descrevem o comportamento implementado. As instruções de trabalho ficam em [AGENTS.md](AGENTS.md).
