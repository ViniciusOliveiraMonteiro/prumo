# ADR-030: stack base para web, API e banco

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

A Sprint 2 precisa escolher a base do bootstrap. `prumo-web/` e `prumo-api/` contêm apenas READMEs; não há aplicações, manifesto de pacotes nem lockfile. O Plano Mestre indica Next.js, NestJS e PostgreSQL como hipóteses, e o Plano de Estudos pede integração com PostgreSQL real na fase B. A ADR-001 já fixa um único repositório com duas aplicações; a ADR-029 exige um laboratório de isolamento com a role e o pool efetivos antes de decidir RLS.

O objetivo desta decisão é escolher o mínimo para iniciar a Sprint 3 e preparar o primeiro fluxo completo, preservando decisões separadas sobre autenticação, ORM, contrato de API e esquema físico.

## Alternativas e critérios

| Parte | Escolha | Alternativa considerada | Motivo e custo da escolha |
|---|---|---|---|
| Web | Next.js com App Router e TypeScript | React com Vite | Rotas, renderização no servidor e formulários cabem numa aplicação web que pode consultar a API; há mais convenções e cuidados com cache e fronteira servidor/cliente. Não usar rotas do Next como segunda API de domínio. |
| API | NestJS com TypeScript em monólito modular | Fastify direto | Módulos, injeção de dependências e suporte a OpenAPI dão estrutura para autorização e regras financeiras; há mais cerimônia para casos simples. Regras permanecem na API. |
| Banco | PostgreSQL | SQLite no bootstrap | Transações, constraints e possibilidade de testar RLS atendem às invariantes e ao gate de isolamento; exige serviço local e testes de integração reais. RLS ainda não está aprovada. |
| Pacotes | pnpm com um workspace na raiz e lockfile único | npm workspaces | Um fluxo de instalação e versões para ambas as aplicações, já compatível com o monorepo; exige pinagem da versão e disciplina com filtros. Não adicionar Turborepo sem gargalo demonstrado. |

Critérios de verificação no bootstrap: as duas aplicações podem ser criadas e verificadas localmente sem dependências globais; a web consome um contrato explícito da API; a API confirma uma escrita atômica no PostgreSQL em teste; a role da aplicação pode ser usada no laboratório A/B; configuração e segredos ficam fora do repositório. O bootstrap deve fixar versões compatíveis de Node, pnpm, frameworks e PostgreSQL, com lockfile reproduzível, após conferir seus requisitos na data da implementação.

## Decisão

Adotar **Next.js + TypeScript** em `prumo-web/`, **NestJS + TypeScript** em `prumo-api/`, **PostgreSQL** como banco relacional e **pnpm workspaces** na raiz. A web cuida de interface e apresentação; a API é a fronteira de autorização, regras financeiras e persistência. Chamadas web → API terão contrato explícito e versionado no monorepo; a forma de publicação/geração do contrato ainda requer decisão própria. O banco será acessado pela API com role de aplicação de privilégio mínimo. O mecanismo concreto de contexto de household, transações e constraints será especificado após as decisões de ORM e autenticação, respeitando as ADRs 027 e 029.

Esta decisão não aprova provedor de hospedagem, Redis, filas, worker, ORM, autenticação, BFF, estratégia de sessão, cliente gerado, esquema físico ou RLS. Essas escolhas devem ter ADR ou contrato próprio antes de qualquer implementação que dependa delas. Os diretórios continuam sem bootstrap até resolver os bloqueios restantes da Sprint 2.

## Verificação e próxima ação

Em seguida, decidir ORM/transações e contrato da API, então autenticação/sessão e autorização por ação antes do fluxo de identidade. Definir comandos locais de criação e verificações da Sprint 3 sem instalar CLI global. Testar o laboratório DB-008 com PostgreSQL, role de aplicação e conexões reutilizadas; registrar a decisão complementar sobre RLS antes de dados financeiros de usuários externos e antes do esquema físico definitivo.

## Fontes técnicas consultadas

- [Next.js: instalação e TypeScript](https://nextjs.org/docs/app/getting-started/installation) e [self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
- [NestJS: fundamentos](https://docs.nestjs.com/first-steps), [módulos](https://docs.nestjs.com/modules) e [OpenAPI](https://docs.nestjs.com/openapi/introduction).
- [pnpm: workspaces](https://pnpm.io/workspaces).
- [PostgreSQL: transações](https://www.postgresql.org/docs/current/tutorial-transactions.html), [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) e [RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Conceitos para estudo

Renderização no servidor e no cliente, fronteira entre interface e API, monólito modular, transação, integridade referencial, workspace, lockfile, privilégio mínimo e defesa em profundidade.
