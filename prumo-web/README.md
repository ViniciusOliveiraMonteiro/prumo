# prumo-web

Diretório da interface web no monorepo Prumo.

Next.js com App Router e TypeScript foram escolhidos na ADR-030. A ADR-034 definiu origem única com `/api` encaminhado ao NestJS. A página inicial é estática; `/conta` consulta a sessão na API durante a renderização no servidor e mostra apenas o e-mail da conta atual. A rota usa `private, no-store`; ainda não há telas financeiras nem formulário de login. Quando houver lógica de interação, componentes e páginas terão hooks dedicados conforme a ADR-035.

Da raiz do repositório, execute `pnpm dev:web` após instalar as dependências; a web atende em `http://localhost:3000`. `next.config.ts` encaminha `/api` e `/api/*` à API local em `http://127.0.0.1:3001` por padrão; `PRUMO_API_INTERNAL_ORIGIN` também é usado pela página `/conta` para consultar a identidade. Inicie `pnpm dev:api` em outro terminal para testar `http://localhost:3000/api/health`. O navegador deve usar caminhos relativos `/api`.

O contrato OpenAPI gerado pela API produz `src/lib/api/generated.ts`. Após mudanças no contrato, execute `pnpm contract:generate` e `pnpm contract:check` na raiz; valide os dois lados. Os comandos `pnpm --filter prumo-web lint`, `typecheck` e `build` verificam esta aplicação.

Propósito, regras e execução completa estão no [Guia da aplicação](../docs/application/GUIA_DA_APLICACAO.md). O bootstrap está em [BOOTSTRAP_SPRINT_3](../docs/operations/BOOTSTRAP_SPRINT_3.md) e as instruções de trabalho em `../AGENTS.md`.
