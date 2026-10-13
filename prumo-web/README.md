# prumo-web

Diretório da interface web no monorepo Prumo.

Next.js com App Router e TypeScript foram escolhidos na ADR-030. A ADR-034 definiu origem única com `/api` encaminhado ao NestJS. O bootstrap está em andamento conforme `../docs/BOOTSTRAP_SPRINT_3.md`. A página inicial é estática; quando houver lógica de interação, componentes e páginas terão hooks dedicados conforme a ADR-035. O Next.js encaminha `/api` e `/api/*` à API local. O contrato OpenAPI gerado fica em `src/lib/api/generated.ts`; rode `pnpm contract:check` na raiz após mudanças no contrato.

As instruções gerais estão em `../AGENTS.md` e os documentos de produto na pasta pai. Mudanças no contrato com o backend exigem validação dos dois lados.
