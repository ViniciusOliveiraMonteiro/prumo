# prumo-web

Diretório da interface web no monorepo Prumo.

Next.js com App Router e TypeScript foram escolhidos na ADR-030. A ADR-034 definiu origem única com `/api` encaminhado ao NestJS. A página inicial é estática; `/conta` consulta a sessão na API durante a renderização no servidor. `/entrar` envia as credenciais à API pela origem do navegador. `/financas` lista households e contas da sessão e consulta saldo em uma data escolhida; a API continua responsável por autenticação, autorização e cálculo. A página financeira usa `private, no-store` e leitura dinâmica sem cache. Este é um recorte de leitura: criação e revisão de fatos financeiros ainda não têm interface.

Da raiz do repositório, execute `pnpm dev:web` após instalar as dependências; a web atende em `http://localhost:3000`. `next.config.ts` encaminha `/api` e `/api/*` à API local em `http://127.0.0.1:3001` por padrão; `PRUMO_API_INTERNAL_ORIGIN` também é usado pelas páginas `/conta` e `/financas` para consultar a API durante a renderização. Inicie `pnpm dev:api` em outro terminal para testar `http://localhost:3000/api/health`. O navegador deve usar caminhos relativos `/api`. Após provisionar uma conta privada e um household conforme o guia, entre por `/entrar`, escolha o household em `/financas` e informe uma data para consultar saldos; uma data anterior ao marco mostra saldo não calculável.

O contrato OpenAPI gerado pela API produz `src/lib/api/generated.ts`. Após mudanças no contrato, execute `pnpm contract:generate` e `pnpm contract:check` na raiz; valide os dois lados. Os comandos `pnpm --filter prumo-web lint`, `typecheck` e `build` verificam esta aplicação.

Propósito, regras e execução completa estão no [Guia da aplicação](../docs/application/GUIA_DA_APLICACAO.md). O bootstrap está em [BOOTSTRAP_SPRINT_3](../docs/operations/BOOTSTRAP_SPRINT_3.md) e as instruções de trabalho em `../AGENTS.md`.
