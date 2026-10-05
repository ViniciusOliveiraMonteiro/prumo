# ADR-001: monorepo para frontend e backend

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

O Plano Mestre considerava um monorepo como hipótese. O Codex trabalha na pasta pai, enquanto frontend e backend terão pastas próprias. Após distinguir pastas de repositórios Git, o usuário escolheu um monorepo.

## Decisão

Usar um único repositório Git na pasta pai, com `prumo-web/` e `prumo-api/` como diretórios internos. Instruções do Codex e documentos compartilhados ficam no mesmo repositório. A estrutura e o Git da raiz foram criados; `main` foi publicada no `origin`. O acesso remoto usa um socket SSH explícito nesta sessão.

## Alternativa considerada

Dois repositórios independentes dariam históricos e pipelines separados. O monorepo escolhido facilita mudanças atômicas nos dois lados, validação integrada e versionamento conjunto de contratos e documentos.

## Consequências e pendências

- Mudanças de contrato entre frontend e backend ainda exigirão validação dos dois lados.
- O mecanismo de publicação/geração do contrato da API permanece não definido; OpenAPI é uma direção sugerida no Plano Mestre, não uma decisão desta ADR.
- Os documentos compartilhados seguem no mesmo histórico Git das duas aplicações.
- A decisão de monorepo não aprova Next.js, NestJS, banco ou gerenciador de pacotes.

## Conceitos para estudo

Workspaces, validação integrada, versionamento de API, limites entre aplicações e rastreabilidade de decisões.
