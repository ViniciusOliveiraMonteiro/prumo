# Prumo

**Inteligência financeira para colocar sua casa no eixo.**

Prumo é uma plataforma de inteligência financeira doméstica em desenvolvimento. Pretende consolidar dados de uma residência e explicar saldos, despesas, orçamento e indicadores com regras rastreáveis. Hoje o repositório contém o bootstrap técnico: página inicial, endpoint de saúde, PostgreSQL local, migração de verificação e testes; fluxos financeiros e login ainda não estão disponíveis.

Leia o [Guia da aplicação](docs/application/GUIA_DA_APLICACAO.md) para propósito, tecnologias, regras aprovadas, estado de implementação, execução local e verificações. O [Plano de desenvolvimento](docs/planning/PLANO_DE_DESENVOLVIMENTO.md) mostra o andamento e a próxima ação.

## Início rápido

Use Node.js `>=24.21.0 <25`, pnpm `12.8.1` e Docker integrado à distro. Na raiz do repositório, copie `.env.example` para `.env` e substitua as duas ocorrências da senha de exemplo pela mesma senha local. Depois execute:

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait postgres
pnpm --filter prumo-api build
pnpm --filter prumo-api db:migrate
```

Inicie `pnpm dev:api` e `pnpm dev:web` em terminais separados. Acesse `http://localhost:3000` e `http://localhost:3000/api/health`. Para os checks disponíveis e solução de problemas, consulte o [guia](docs/application/GUIA_DA_APLICACAO.md#verificações-e-contrato).

## Repositório

- [`prumo-web/`](prumo-web/README.md): interface Next.js e encaminhamento de `/api`.
- [`prumo-api/`](prumo-api/README.md): API NestJS, contrato OpenAPI, migrações e testes de banco.
- [`docs/`](docs/README.md): índice de aplicação, decisões, domínio, segurança, execução e aprendizado.

O [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) orienta o produto; as ADRs registram decisões; código e testes descrevem o comportamento implementado. As instruções de trabalho ficam em [AGENTS.md](AGENTS.md).
