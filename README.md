# Prumo

**Inteligência financeira para colocar sua casa no eixo.**

Prumo é uma plataforma de inteligência financeira doméstica em desenvolvimento. Pretende consolidar dados de uma residência e explicar saldos, despesas, orçamento e indicadores com regras rastreáveis. Hoje o repositório contém o bootstrap técnico e uma API local com login privado, households, contas, receita manual, movimentos e saldo diário, com testes no PostgreSQL. A web ainda não tem formulário de login nem telas financeiras.

Leia o [Guia da aplicação](docs/application/GUIA_DA_APLICACAO.md) para propósito, tecnologias, regras aprovadas, estado de implementação, execução local e verificações. O [Plano de desenvolvimento](docs/planning/PLANO_DE_DESENVOLVIMENTO.md) mostra o andamento e a próxima ação.

## Início rápido

Use Node.js `>=24.21.0 <25`, pnpm `12.8.1` e Docker integrado à distro. Na raiz do repositório, execute `cp .env.example .env` e edite `.env`: use uma senha local para `PRUMO_DB_PASSWORD` e a URL migradora, e outra para `PRUMO_APP_DATABASE_URL`. Depois execute:

```bash
pnpm install --frozen-lockfile
docker compose up -d --wait postgres
pnpm --filter prumo-api build
pnpm --filter prumo-api db:migrate
pnpm --filter prumo-api db:prepare-app
```

Inicie `pnpm dev:api` e `pnpm dev:web` em terminais separados. Acesse `http://localhost:3000` e `http://localhost:3000/api/health`. Para os checks disponíveis e solução de problemas, consulte o [guia](docs/application/GUIA_DA_APLICACAO.md#verificações-e-contrato).

## Reproduzir o bootstrap em um clone novo

Para reproduzir o bootstrap do projeto, parta de um ambiente que já tenha os pré-requisitos do **Início rápido** e acesso ao repositório privado. No sistema de arquivos Linux, faça um clone novo e registre o SHA:

```bash
mkdir -p ~/workspace
cd ~/workspace
git clone git@github.com:ViniciusOliveiraMonteiro/prumo.git
cd prumo
git rev-parse --short HEAD
```

Siga o **Início rápido** acima para criar `.env` com senhas locais novas, instalar dependências e preparar o banco. Não copie o `.env` de outro ambiente. Registre as versões com `node --version` e `pnpm --version`.

Depois de preparar o banco, execute cada check na raiz, interrompendo e registrando qualquer falha:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm --filter prumo-api test:e2e
pnpm --filter prumo-api test:db
pnpm contract:check
pnpm build
```

Por fim, inicie `pnpm dev:api` e `pnpm dev:web` em terminais separados e confira `/` e `/api/health` em `http://localhost:3000`. Registre quem executou, SHA, versões, resultado de cada comando, respostas das duas URLs, lacunas do guia e qualquer ajuda necessária. Não inclua senhas nem conteúdo de `.env`. O [fechamento da Sprint 3](docs/planning/PLANO_DE_DESENVOLVIMENTO.md#sprint-3--bootstrap-de-engenharia) aceitou o ensaio feito pelo próprio usuário; uma reprodução por outra pessoa pode ser feita depois como verificação adicional.

## Repositório

- [`prumo-web/`](prumo-web/README.md): interface Next.js e encaminhamento de `/api`.
- [`prumo-api/`](prumo-api/README.md): API NestJS, contrato OpenAPI, migrações e testes de banco.
- [`docs/`](docs/README.md): índice de aplicação, decisões, domínio, segurança, execução e aprendizado.

O [Plano Mestre](PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) orienta o produto; as ADRs registram decisões; código e testes descrevem o comportamento implementado. As instruções de trabalho ficam em [AGENTS.md](AGENTS.md).
