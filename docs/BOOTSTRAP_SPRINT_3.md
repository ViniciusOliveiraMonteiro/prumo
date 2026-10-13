# Preparação do bootstrap da Sprint 3

**Status:** scaffold, roteamento, contrato, PostgreSQL e laboratório técnico executados localmente; gate de CI remoto, autenticação e decisão final de RLS pendentes.

Este roteiro registra a execução das ADRs 030–035. Os geradores escreveram primeiro em `.bootstrap-drafts/`, dentro do repositório; os arquivos úteis foram integrados aos diretórios existentes sem criar outros repositórios Git ou instalar CLI global.

## Versões de partida

| Ferramenta | Versão planejada | Motivo e verificação |
|---|---|---|
| Node.js | 24.21.0 | Presente no ambiente em 2026-10-13; satisfaz o mínimo atual dos geradores NestJS. Registrar em `.node-version` e `engines` no bootstrap. |
| pnpm | 12.8.1 | Presente no ambiente em 2026-10-13; registrar no `packageManager` da raiz e usar lockfile único. |
| `create-next-app` | 16.3.6 | Versão estável publicada em 2026-10-13; confirmar o manifesto gerado e compatibilidade com Node antes de instalar. |
| `@nestjs/cli` | 12.0.5 | Versão estável publicada em 2026-10-13; conferir os prompts e o manifesto gerado. |
| PostgreSQL | 18.6 | Versão suportada em 2026-10-13; usar imagem oficial fixada para o teste local, sem alterar serviços Docker existentes. |

As versões efetivas das dependências estão nos manifestos e no lockfile único. Drizzle 0.44.6, `pg` 8.23.0 e a imagem `postgres:18.6` foram usados no laboratório local de 2026-10-13.

## Criação e integração

Comandos usados na raiz do repositório para gerar os rascunhos:

```bash
mkdir -p .bootstrap-drafts
pnpm create next-app@16.3.6 .bootstrap-drafts/prumo-web --ts --eslint --app --src-dir --use-pnpm --skip-install --disable-git --yes
pnpm dlx @nestjs/cli@12.0.5 new prumo-api --directory .bootstrap-drafts/prumo-api --package-manager pnpm --skip-install --skip-git --no-observe
```

O NestJS usa ESM e Vitest. Os arquivos gerados foram revisados e integrados preservando os READMEs e o `AGENTS.md` da raiz. O lockfile é único e não há observabilidade externa configurada.

O `package.json` privado da raiz fixa `packageManager`, `engines` e scripts para as duas aplicações. `pnpm-workspace.yaml`, `.node-version` e `pnpm-lock.yaml` pertencem à raiz. `pnpm install --frozen-lockfile` passou localmente. O pnpm permite scripts de instalação apenas para `esbuild` e `unrs-resolver`; o script de telemetria de `@scarf/scarf` está bloqueado.

Configurar a API para expor o prefixo público `/api` sem ambiguidade de remoção do prefixo no rewrite. A web encaminha `/api` e `/api/*` para a porta interna da API; o endereço interno vem de configuração de ambiente sem segredo. O navegador usa caminhos relativos `/api`. Configuração de sessão, CSRF, proxy confiável e cache deve cumprir os testes da ADR-034 antes de dados financeiros reais. Uma resposta simples e sem dados financeiros pode verificar roteamento no bootstrap; não apresentá-la como autenticação concluída.

Em 2026-10-13, a web respondeu 200 na raiz e `GET /api/health` respondeu 200 pelo rewrite do Next.js para o NestJS. OpenAPI foi gerado pela API e os tipos da web derivados de `contracts/openapi.json`; `pnpm contract:check` passou. O build do Next.js usa `experimental.useTypeScriptCli: false` porque a execução local com TypeScript 6 falhou ao interpretar `tsc --showConfig`; `pnpm typecheck` continua um check separado. Esse ajuste deve ser reavaliado ao atualizar Next.js/TypeScript.

Para o banco local, copie `.env.example` para `.env` e use uma senha exclusiva de desenvolvimento. `docker compose up -d --wait postgres` inicia apenas o PostgreSQL deste projeto, ligado a `127.0.0.1:54329`. Execute `pnpm --filter prumo-api build`, `pnpm --filter prumo-api db:migrate` e `pnpm --filter prumo-api test:db`. A migração cria somente `bootstrap.probe` e o ledger de migrações; o runner aplica SQL em transação, serializa execuções e recusa alteração de checksum. O laboratório cria e remove sua própria role e schema, usa uma conexão da role de aplicação e cobre rollback, dez pedidos concorrentes, revisão por versão, SELECT/INSERT/UPDATE/DELETE A/B por RLS, vínculo cruzado por FK e `bigint` acima de `Number.MAX_SAFE_INTEGER`. Sete testes passaram localmente. Isso demonstra mecanismos técnicos, não implementa transferência, idempotência ou autorização de produto.

O laboratório de RLS ainda precisa registrar comportamento do owner/bypass, jobs administrativos e uma ADR complementar antes de decidir se RLS compõe a arquitetura de produção. A CI inclui PostgreSQL e os checks, mas ainda não foi executada no GitHub.

## Checks de saída

1. `pnpm install --frozen-lockfile`, lint, typecheck, testes gerados e build passam para web e API pelos scripts da raiz.
2. As duas aplicações iniciam em portas diferentes; uma chamada do navegador a `/api` chega à API sem abrir uma segunda origem pública.
3. OpenAPI é gerado localmente pela API e os tipos da web são derivados de um único artefato versionado; check detecta artefato desatualizado.
4. PostgreSQL local e migração inicial funcionam com role de aplicação. Os testes reais da ADR-031 verificam rollback, concorrência, escopo A/B e representação monetária antes do esquema financeiro definitivo.
5. CI reproduz instalação e checks; configuração local e segredos não entram no Git. O laboratório de RLS da ADR-029 usa role e pool reais antes da decisão sobre RLS.
6. Fluxos de sessão, cookie, CSRF e cache da ADR-034 e a compatibilidade da biblioteca candidata da ADR-033 continuam gates de implementação próprios; o scaffold sozinho não os satisfaz.

## Fontes técnicas

- [Next.js: instalação](https://nextjs.org/docs/app/getting-started/installation) e [opções do gerador](https://github.com/vercel/next.js/blob/canary/packages/create-next-app/README.md).
- [NestJS: requisitos de Node](https://docs.nestjs.com/first-steps) e [opções do CLI](https://docs.nestjs.com/cli/usages).
- [pnpm: workspaces](https://pnpm.io/workspaces) e [PostgreSQL: versões suportadas](https://www.postgresql.org/support/versioning/).
