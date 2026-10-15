# Preparação do bootstrap da Sprint 3

**Status:** scaffold, roteamento, contrato, PostgreSQL e laboratório técnico executados localmente; CI remota aprovada conforme evidência informada pelo usuário em 2026-10-14; laboratório RLS ampliado para dez testes; reprodução por outra pessoa, autenticação e decisão final de RLS pendentes.

**Pendente para validação futura (2026-10-14):** o usuário decidiu seguir com os próximos gates sem executar agora o preparo do ambiente por outra pessoa. Antes de concluir a Sprint 3, uma segunda pessoa deve partir de um clone novo, seguir o `README.md` sem ajuda, executar instalação, banco, migração, checks, API e web, e registrar resultado e lacunas do guia. Repetir no mesmo WSL com novo clone serve como ensaio, mas a validação por outra pessoa continua pendente. Esta pendência não bloqueia o estudo técnico de RLS e sessão.

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

Em 2026-10-14, o usuário configurou uma conexão gráfica local e confirmou com `SELECT current_database(), current_user;` os resultados `prumo_dev` e `prumo_migrator`. Isso valida acesso ao banco do Compose pela interface gráfica; a role migradora usada nessa verificação não representa a role restrita prevista para operações da aplicação.

Em 2026-10-14, o laboratório local passou com dez testes. Os casos novos mostram o bypass padrão do owner, o efeito de `FORCE ROW LEVEL SECURITY`, o bypass persistente de uma role `BYPASSRLS`, o contexto de um job sintético no pool e o limite de confiar no contexto SQL como autorização. A [ADR-036](../decisions/ADR-036-row-level-security-proposal.md) registra a proposta e os gates ainda pendentes para decisão de produção, inclusive jobs administrativos reais. O usuário também confirmou que a CI anterior passou no GitHub e forneceu o [link direto do job `checks`](https://github.com/ViniciusOliveiraMonteiro/prumo/actions/runs/38448012478/job/115471382793) da execução `38448012478`. Como o repositório é privado, os logs, a data da execução e o SHA associado não foram conferidos nesta sessão; essa execução não valida as mudanças posteriores do laboratório.

Em 2026-10-15, a API passou a ativar `enableCsrfProtection()` do NestJS 12.1.3 para métodos mutáveis, com lista vazia de origens externas confiáveis. O teste E2E confirmou que uma mutação da mesma origem funciona e que `Sec-Fetch-Site: cross-site` ou `Origin` estrangeira sem Fetch Metadata recebem `403` antes do handler. `pnpm --filter prumo-api test:e2e`, `typecheck` e `lint` passaram localmente. A proteção usa metadados de navegador e `Origin`; requests sem ambos os cabeçalhos são aceitos pelo NestJS, portanto autenticação e autorização continuam indispensáveis. O teste cobre a API diretamente; ainda faltam sessão real, store PostgreSQL, cookie, fluxo pelo rewrite da web, proxy HTTPS, cache de resposta autenticada e revalidação de membership. A primeira tentativa de repetir `test:db` encontrou `ECONNREFUSED` em `127.0.0.1:54329`; após `docker compose up -d --wait postgres`, o usuário executou novamente o comando e informou **10 testes aprovados** em 2026-10-15. O log fornecido mostra o contêiner `Healthy`, dez testes aprovados e nenhuma falha. Esta execução local revalida o laboratório ampliado, mas não substitui a CI das alterações atuais.

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
