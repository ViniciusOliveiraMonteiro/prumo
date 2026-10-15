# Guia da aplicação

**Estado em 2026-10-15:** Prumo está no bootstrap de engenharia. A web mostra uma página inicial estática; a API oferece `GET /api/health`. PostgreSQL, migração inicial, geração do contrato OpenAPI e laboratórios técnicos estão disponíveis. Ainda não há login, households persistidos, contas, transações ou indicadores financeiros utilizáveis. As regras abaixo são decisões de produto e domínio para orientar a implementação, não funcionalidades prontas.

## Propósito

Prumo pretende reunir os dados financeiros de uma residência para explicar receitas, despesas, contas, cartões, compromissos, orçamento e evolução patrimonial. O público inicial é pessoal e familiar. Indicadores e projeções devem ter cálculo e origem rastreáveis; IA não é fonte de verdade financeira nem consultora autônoma. O escopo do MVP está em [Objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#51-objetivos-do-mvp); seus limites estão em [Não objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#52-não-objetivos-do-mvp).

## O que existe hoje

| Parte | Responsabilidade atual | Situação |
|---|---|---|
| `prumo-web/` | Página inicial Next.js; encaminha `/api` e `/api/*` à API local. | Bootstrap funcional, sem telas financeiras. |
| `prumo-api/` | Endpoint de saúde, proteção de origem para mutações e geração de OpenAPI. | Bootstrap funcional, sem autenticação ou endpoints financeiros. |
| PostgreSQL local | Migração de verificação e laboratório descartável de transações/RLS. | Não contém esquema financeiro de produto. |
| `contracts/openapi.json` e tipos gerados na web | Contrato HTTP derivado da API. | Contém apenas o contrato implementado; mudanças exigem geração e check. |

O [estado atual da sprint](../planning/PLANO_DE_DESENVOLVIMENTO.md#sprint-3--bootstrap-de-engenharia) registra status, critério de aceite e próxima ação. A seção [Criação e integração](../operations/BOOTSTRAP_SPRINT_3.md#criação-e-integração) guarda evidências e limites dos testes técnicos.

## Tecnologias e limites

| Camada | Escolha | Referência |
|---|---|---|
| Interface | Next.js App Router, React e TypeScript | [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão) |
| API | NestJS e TypeScript, organizada por capacidade | [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão), [ADR-035, decisão](../decisions/ADR-035-code-organization.md#decisão) |
| Banco | PostgreSQL; acesso por `pg` e Drizzle, migrações SQL versionadas | [ADR-031, decisão](../decisions/ADR-031-postgresql-access-transactions.md#decisão) |
| Monorepo | pnpm workspaces, lockfile único na raiz | [ADR-001, decisão](../decisions/ADR-001-monorepo.md#decisão), [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão) |
| Contrato | OpenAPI gerado pela API e tipos derivados para a web | [ADR-032, decisão](../decisions/ADR-032-web-api-contract.md#decisão) |
| Navegador | Uma origem: páginas na web e `/api` na API | [ADR-034, decisão](../decisions/ADR-034-browser-api-origin-proposal.md#decisão) |

Sessões revogáveis em PostgreSQL sob autoridade da API foram **decididas**, mas ainda não implementadas; a biblioteca candidata precisa de validação ([ADR-033, decisão](../decisions/ADR-033-authentication-session.md#decisão)). A API já rejeita mutações de origem hostil conforme os cabeçalhos de navegador, mas isso não autentica nem autoriza usuários. A baseline de isolamento por household está na [ADR-029, decisão](../decisions/ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo). RLS é uma [proposta com gates pendentes](../decisions/ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final), sem aprovação para uso de produto.

## Regras de negócio aprovadas

Este resumo orienta a leitura; a redação completa, os exemplos e as exceções estão nas ADRs e nos [cenários financeiros](../domain/financial-examples.md#1-salário-transferência-e-investimento-dom-001003).

| Assunto | Regra central | Decisão |
|---|---|---|
| Dinheiro | Valores finais em BRL usam centavos inteiros e moeda explícita; operações não misturam moedas. | [ADR-006, decisão](../decisions/ADR-006-money-representation.md#decisão) |
| Saldo de conta | Parte de um saldo inicial datado e dos movimentos conhecidos. O marco inicial não é receita; divergências com fonte externa ficam visíveis para revisão. | [ADR-016, decisão](../decisions/ADR-016-opening-balance.md#decisão) |
| Receita e despesa paga diretamente | Receita recebida pertence ao mês em que o dinheiro chega; despesa de consumo paga diretamente, ao mês em que sai. | [ADR-017, decisão](../decisions/ADR-017-income-expense-card-liability.md#decisão) |
| Transferência interna | Um evento vincula saída e entrada em contas do mesmo household, com valores opostos e confirmação íntegra; não é receita nem despesa. | [ADR-007, decisão](../decisions/ADR-007-transaction-transfer-model.md#decisão) |
| Compra no cartão | A despesa de consumo integral pertence ao mês da compra; parcelas e pagamentos futuros aparecem na visão de obrigação e caixa sem repetir a despesa. | [ADR-008, decisão](../decisions/ADR-008-credit-card-recognition.md#decisão) |
| Orçamento de compra no cartão | O valor integral consome o orçamento no mês da compra; exceder o planejado gera alerta, sem impedir o registro. | [ADR-008, decisão](../decisions/ADR-008-credit-card-recognition.md#decisão) |
| Reembolso e estorno | O efeito econômico segue o fato de recebimento ou de aplicação do crédito, com vínculo à compra original e sem duplicar entrada ou baixa. Casos de cartão têm regras específicas. | [ADR-017, decisão](../decisions/ADR-017-income-expense-card-liability.md#decisão), [ADR-018, decisão](../decisions/ADR-018-card-purchase-reversal-before-payment.md#decisão), [ADR-019, decisão](../decisions/ADR-019-card-reversal-after-payment-without-open-debt.md#decisão) |
| Isolamento | Sessão não basta: a API deve confirmar membership e permissão atual para cada ação e escopar cada recurso ao household autorizado. | [ADR-029, decisão](../decisions/ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo) |

O [recorte de contas e transações](../domain/accounts-transactions-conceptual-slice.md#limite-do-primeiro-fluxo) distingue regras aceitas de contratos ainda pendentes. Cartão, reconciliação, datas, correções e concorrência têm ADRs próprias em `docs/decisions/`. Nenhuma regra deve ser implementada a partir deste resumo se a ADR correspondente indicar uma pendência.

## Executar localmente

Requisitos: Linux/WSL 2, Node.js `24.21.0` ou versão compatível com `>=24.21.0 <25`, pnpm `12.8.1` e Docker com integração à distro ativa. Use as dependências do workspace; os comandos abaixo partem da raiz do repositório.

1. Copie `.env.example` para `.env` e substitua **as duas ocorrências** da senha de exemplo pela mesma senha exclusiva de desenvolvimento. `.env` é local e não deve ser versionado.
2. Instale as dependências e prepare o banco:

   ```bash
   pnpm install --frozen-lockfile
   docker compose up -d --wait postgres
   pnpm --filter prumo-api build
   pnpm --filter prumo-api db:migrate
   ```

3. Inicie cada processo em um terminal, sempre na raiz:

   ```bash
   pnpm dev:api
   ```

   ```bash
   pnpm dev:web
   ```

4. Abra `http://localhost:3000`. `http://localhost:3000/api/health` deve responder `{"status":"ok"}` pelo encaminhamento à API. A API escuta localmente em `127.0.0.1:3001`; a porta `54329` do PostgreSQL fica vinculada a `127.0.0.1`.

Se o teste de banco retornar `ECONNREFUSED` em `127.0.0.1:54329`, confira `docker compose ps` e inicie `postgres` com o comando acima. O laboratório `test:db` usa o banco local e cria e remove schema e roles próprios; não o aponte para outro banco.

## Verificações e contrato

| Comando na raiz | O que verifica |
|---|---|
| `pnpm lint` | Lint das duas aplicações. |
| `pnpm format:check` | Formatação dos arquivos de código cobertos pelo script. |
| `pnpm typecheck` | Tipos das duas aplicações. |
| `pnpm test` | Testes unitários configurados nas aplicações. |
| `pnpm --filter prumo-api test:e2e` | Rotas da API e proteção de origem em teste HTTP. |
| `pnpm --filter prumo-api test:db` | Laboratório com PostgreSQL local ativo. |
| `pnpm contract:check` | OpenAPI e tipos gerados sincronizados. |
| `pnpm build` | Builds da web e da API. |

Após mudar o contrato HTTP da API, execute `pnpm contract:generate` na raiz e valide também a web com `pnpm contract:check` e `pnpm typecheck`. A API é a fonte do OpenAPI; a web consome os tipos gerados.

## Referências por assunto

| Para consultar | Vá diretamente para |
|---|---|
| Problema e proposta de valor | [Plano Mestre, proposta de valor](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#42-proposta-de-valor) e [objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#51-objetivos-do-mvp). |
| O que está em andamento | [Plano de desenvolvimento, Sprint 3](../planning/PLANO_DE_DESENVOLVIMENTO.md#sprint-3--bootstrap-de-engenharia). |
| Preparação e validação local | [Bootstrap, criação e integração](../operations/BOOTSTRAP_SPRINT_3.md#criação-e-integração) e [checks de saída](../operations/BOOTSTRAP_SPRINT_3.md#checks-de-saída). |
| Exemplos de regras financeiras | [Transferência e investimento](../domain/financial-examples.md#1-salário-transferência-e-investimento-dom-001003), [saldo inicial](../domain/financial-examples.md#2-saldo-inicial-e-reconciliação-dom-002) e [compra no cartão](../domain/financial-examples.md#3-compra-no-cartão-fechamento-e-pagamento-dom-001004). |
| Acesso e isolamento | [ADR-029, decisão](../decisions/ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo), [threat model, ameaças](../security/threat-model.md#ameaças-controles-candidatos-e-evidência-exigida) e [ADR-036, gates de RLS](../decisions/ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final). |
| Estudos aplicados | [Plano de Estudos](../../PLANO_DE_ESTUDOS_APLICADO.md) e [Caderno](../../CADERNO_DE_ESTUDOS_APLICADO.md). |
| Como registrar mudanças | [Guia de manutenção, responsabilidades por mudança](../documentation/GUIA_DE_MANUTENCAO.md#o-que-atualizar-em-cada-mudança) e [revisão antes de concluir](../documentation/GUIA_DE_MANUTENCAO.md#revisão-antes-de-concluir). |

O [índice de `docs/`](../README.md) lista todas as categorias. As [ADRs](../decisions/) registram decisões e alternativas; `proposta` não equivale a decisão aceita.

Ao concluir uma etapa, siga o [guia de manutenção](../documentation/GUIA_DE_MANUTENCAO.md) para atualizar as fontes pertinentes, conferir os links e registrar pendências. Mantenha somente Markdown como fonte editável; PDFs são gerados apenas sob pedido explícito.
