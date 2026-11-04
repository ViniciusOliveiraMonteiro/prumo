# Guia da aplicação

**Estado em 2026-11-04:** Prumo mantém o bootstrap privado: a web mostra página inicial e `/conta` com a identidade da sessão; a API oferece identidade, household e convite privado. O ciclo de e-mail verificado tem captura apenas em testes e retorna `503` no runtime normal. O primeiro recurso de conta com marco inicial foi implementado e passou em E2E no PostgreSQL local; a revisão independente e os checks finais constam na [ADR-046](../decisions/ADR-046-first-financial-account-proposal.md#implementação-local-em-2026-11-03). Ainda não há formulário de login nem tela financeira na web, envio ou aceite por e-mail, nem indicadores financeiros utilizáveis; a API local já oferece receita manual, despesa direta, categorias mínimas, primeiro par de transferência, movimentos, saldo diário, posição em trânsito e revisão auditável do valor do marco na mesma data. A [ADR-049](../decisions/ADR-049-first-manual-transfer-proposal.md#implementação-local-em-2026-11-04) registra a transferência; a [ADR-050](../decisions/ADR-050-first-opening-balance-revision-proposal.md#implementação-local-em-2026-11-04) registra a revisão do marco.

A [ADR-047](../decisions/ADR-047-first-manual-income-and-balance-proposal.md#decisão-delimitada) aprovou o primeiro recorte de receita manual, movimento aplicado ou pendente antes do marco e saldo diário exato. A migração e as rotas locais foram implementadas; o E2E financeiro e o contrato gerado passaram. A revisão independente foi concluída; a lacuna de teste de rollback foi corrigida e revisada novamente.

A [ADR-048](../decisions/ADR-048-first-manual-expense-proposal.md#implementação-local-em-2026-11-03) aprovou categoria mínima por household e despesa paga diretamente. Migrações, rotas locais e contrato foram criados; 17 E2E de despesa e regressão da receita passaram no PostgreSQL local. A revisão independente encontrou duas lacunas materiais, corrigidas e relidas sem novo defeito material. RLS nas tabelas reais e uso externo continuam pendentes.

## Propósito

Prumo pretende reunir os dados financeiros de uma residência para explicar receitas, despesas, contas, cartões, compromissos, orçamento e evolução patrimonial. O público inicial é pessoal e familiar. Indicadores e projeções devem ter cálculo e origem rastreáveis; IA não é fonte de verdade financeira nem consultora autônoma. O escopo do MVP está em [Objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#51-objetivos-do-mvp); seus limites estão em [Não objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#52-não-objetivos-do-mvp).

## O que existe hoje

| Parte | Responsabilidade atual | Situação |
|---|---|---|
| `prumo-web/` | Página inicial Next.js e `/conta` com identidade da sessão; encaminha `/api` e `/api/*` à API local. | Bootstrap funcional, sem formulário de login ou telas financeiras. |
| `prumo-api/` | Saúde, identidade privada, household, gestão mínima de memberships, convite privado, conta com marco inicial, receita manual, despesa direta, categorias, transferência confirmada, movimentos, saldo diário, trânsito, proteção de origem e OpenAPI. | Conta, receita, despesa e transferência validadas e revisadas localmente sob a matriz da ADR-041. |
| PostgreSQL local | Migrações de identidade, household, conta, receita manual, despesa e transferência; laboratório de RLS. | Contém contas, categorias, eventos, versões, movimentos e pedidos idempotentes; a decisão final de RLS continua pendente. |
| `contracts/openapi.json` e tipos gerados na web | Contrato HTTP derivado da API. | Contém apenas o contrato implementado; mudanças exigem geração e check. |

O [estado da Sprint 5](../planning/PLANO_DE_DESENVOLVIMENTO.md#sprint-5--contas-e-transações) registra status, critério de aceite e próxima ação dos recortes financeiros. A seção [Criação e integração](../operations/BOOTSTRAP_SPRINT_3.md#criação-e-integração) guarda evidências e limites do bootstrap técnico.

## Tecnologias e limites

| Camada | Escolha | Referência |
|---|---|---|
| Interface | Next.js App Router, React e TypeScript | [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão) |
| API | NestJS e TypeScript, organizada por capacidade | [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão), [ADR-035, decisão](../decisions/ADR-035-code-organization.md#decisão) |
| Banco | PostgreSQL; acesso por `pg` e Drizzle, migrações SQL versionadas | [ADR-031, decisão](../decisions/ADR-031-postgresql-access-transactions.md#decisão) |
| Monorepo | pnpm workspaces, lockfile único na raiz | [ADR-001, decisão](../decisions/ADR-001-monorepo.md#decisão), [ADR-030, decisão](../decisions/ADR-030-foundation-stack.md#decisão) |
| Contrato | OpenAPI gerado pela API e tipos derivados para a web | [ADR-032, decisão](../decisions/ADR-032-web-api-contract.md#decisão) |
| Navegador | Uma origem: páginas na web e `/api` na API | [ADR-034, decisão](../decisions/ADR-034-browser-api-origin-proposal.md#decisão) |

Sessões revogáveis em PostgreSQL sob autoridade da API e o [modelo mínimo de identidade](../decisions/ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos) foram aprovados e implementados para o primeiro acesso privado. Os testes locais cobrem login, logout, cookie e renderização da página `/conta` pelo proxy HTTPS local; [ADR-033](../decisions/ADR-033-authentication-session.md#consequências-e-pendências) registra os gates restantes. A [ADR-038](../decisions/ADR-038-private-sign-in-attempt-limit-proposal.md#alternativas-e-proposta) aprovou contar falhas e limpar após login válido. O acesso privado responde `429` com `Retry-After` após dez falhas por e-mail em 15 minutos; os parâmetros foram aceitos para esse recorte e serão revistos antes de usuários externos. A [ADR-039](../decisions/ADR-039-private-credential-change-recovery-proposal.md#implementação-e-gates-pendentes) aprovou troca autenticada e códigos de recuperação offline pré-MVP, implementados na API com revogação global; recuperação por e-mail e notificação independente continuam pendentes. O [primeiro recorte da ADR-041](../decisions/ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado), a [gestão mínima da ADR-042](../decisions/ADR-042-minimal-membership-management-proposal.md#matriz-mínima-aprovada) e o [convite privado da ADR-043](../decisions/ADR-043-household-invitation-acceptance-proposal.md#recorte-privado-aprovado) foram aprovados e validados no PostgreSQL local. A [direção de aceite por e-mail da ADR-044](../decisions/ADR-044-email-invitation-acceptance-proposal.md#direção-aprovada) foi aprovada para contas existentes, e a [ADR-045](../decisions/ADR-045-verified-email-lifecycle-proposal.md#problema-e-decisões-delimitadas) aprova primeira verificação por código na sessão, troca de endereço nunca verificado com senha e prova do novo, confirmação dos dois endereços ao trocar um já verificado e bloqueio quando o antigo verificado foi perdido; protocolo e parâmetros foram aprovados e implementados no incremento local com captura em testes; transporte externo e eventual exceção continuam pendentes. A API rejeita mutações de origem hostil, mas sessão não concede acesso financeiro. A baseline de isolamento por household está na [ADR-029](../decisions/ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo). RLS é uma [proposta com gates pendentes](../decisions/ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final), sem aprovação para uso de produto.

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

1. Copie `.env.example` para `.env`. Use a mesma senha local em `PRUMO_DB_PASSWORD` e `PRUMO_DATABASE_URL`; use outra senha em `PRUMO_APP_DATABASE_URL`. `PRUMO_PUBLIC_ORIGIN` deve conter a origem da web (`http://localhost:3000` no desenvolvimento). `.env` é local e não deve ser versionado.
2. Instale as dependências e prepare o banco:

   ```bash
   pnpm install --frozen-lockfile
   docker compose up -d --wait postgres
   pnpm --filter prumo-api build
   pnpm --filter prumo-api db:migrate
   pnpm --filter prumo-api db:prepare-app
   ```

3. Inicie cada processo em um terminal, sempre na raiz:

   ```bash
   pnpm dev:api
   ```

   ```bash
   pnpm dev:web
   ```

4. Abra `http://localhost:3000`. `http://localhost:3000/api/health` deve responder `{"status":"ok"}` pelo encaminhamento à API. Para criar a conta privada inicial, use `pnpm --filter prumo-api db:provision-user seu-email@exemplo.com` em um terminal; a senha será solicitada sem eco. A web ainda não oferece formulário: o contrato HTTP inclui as rotas de `/api/auth/*`, household, listagem/revogação de memberships e convite privado; o [README da API](../../prumo-api/README.md) detalha seus corpos e permissões. A emissão dos códigos exige sessão e senha atual; o consumo de um código troca a senha, revoga sessões e retorna códigos substitutos para guardar offline. O recorte é privado pré-MVP. O ciclo de verificação/troca de e-mail existe somente em testes com captura local; no runtime normal, suas rotas retornam `503`. Não há envio nem aceite por e-mail externo ou notificação independente de recuperação de senha. A API escuta localmente em `127.0.0.1:3001`; o PostgreSQL em `127.0.0.1:54329`.

Se o teste de banco retornar `ECONNREFUSED` em `127.0.0.1:54329`, confira `docker compose ps` e inicie `postgres` com o comando acima. O laboratório `test:db` usa o banco local e cria e remove schema e roles próprios; não o aponte para outro banco.

Para remover sessões vencidas e contadores de autenticação com mais de 24 horas no acesso privado, execute `pnpm --filter prumo-api db:prune-identity` na raiz depois de `build` e `db:prepare-app`. O comando exige `prumo_app` no banco local `prumo_dev`, informa apenas contagens, descarta payload de e-mail vencido e exclui metadados da outbox com mais de sete dias e tentativas de emissão de e-mail com mais de 48 horas. A execução diária antes do piloto externo ainda depende da hospedagem. Os critérios estão na [ADR-037](../decisions/ADR-037-private-identity-bootstrap-proposal.md#pendências-e-conceitos-para-estudo).

## Verificações e contrato

| Comando na raiz | O que verifica |
|---|---|
| `pnpm lint` | Lint das duas aplicações. |
| `pnpm format:check` | Formatação dos arquivos de código cobertos pelo script. |
| `pnpm typecheck` | Tipos das duas aplicações. |
| `pnpm test` | Testes unitários configurados nas aplicações. |
| `pnpm --filter prumo-api test:e2e` | Rotas da API, identidade, household, memberships, convite e primeira conta; requer migração e role local. O arquivo direcionado de conta passou com seis casos em 2026-11-03. |
| `pnpm --filter prumo-api test:db` | Laboratórios e grants com PostgreSQL local ativo. |
| `pnpm contract:check` | OpenAPI e tipos gerados sincronizados. |
| `pnpm build` | Builds da web e da API. |

Após mudar o contrato HTTP da API, execute `pnpm contract:generate` na raiz e valide também a web com `pnpm contract:check` e `pnpm typecheck`. A API é a fonte do OpenAPI; a web consome os tipos gerados.

## Referências por assunto

| Para consultar | Vá diretamente para |
|---|---|
| Problema e proposta de valor | [Plano Mestre, proposta de valor](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#42-proposta-de-valor) e [objetivos do MVP](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#51-objetivos-do-mvp). |
| O que está em andamento | [Plano de desenvolvimento, Sprint 5](../planning/PLANO_DE_DESENVOLVIMENTO.md#sprint-5--contas-e-transações). |
| Preparação e validação local | [Bootstrap, criação e integração](../operations/BOOTSTRAP_SPRINT_3.md#criação-e-integração) e [checks de saída](../operations/BOOTSTRAP_SPRINT_3.md#checks-de-saída). |
| Exemplos de regras financeiras | [Transferência e investimento](../domain/financial-examples.md#1-salário-transferência-e-investimento-dom-001003), [saldo inicial](../domain/financial-examples.md#2-saldo-inicial-e-reconciliação-dom-002) e [compra no cartão](../domain/financial-examples.md#3-compra-no-cartão-fechamento-e-pagamento-dom-001004). |
| Acesso e isolamento | [ADR-037, identidade privada](../decisions/ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos), [ADR-038, limite de login](../decisions/ADR-038-private-sign-in-attempt-limit-proposal.md#alternativas-e-proposta), [ADR-039, troca e códigos pré-MVP](../decisions/ADR-039-private-credential-change-recovery-proposal.md#implementação-e-gates-pendentes), [ADR-041, primeiro recorte de household](../decisions/ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado), [ADR-042, gestão mínima](../decisions/ADR-042-minimal-membership-management-proposal.md#matriz-mínima-aprovada), [ADR-043, convite privado e requisito de e-mail final](../decisions/ADR-043-household-invitation-acceptance-proposal.md#recorte-privado-aprovado), [ADR-029, isolamento](../decisions/ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo), [threat model](../security/threat-model.md#ameaças-controles-candidatos-e-evidência-exigida) e [ADR-036, gates de RLS](../decisions/ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final). |
| Estudos aplicados | [Plano de Estudos](../../PLANO_DE_ESTUDOS_APLICADO.md) e [Caderno](../../CADERNO_DE_ESTUDOS_APLICADO.md). |
| Como registrar mudanças | [Guia de manutenção, responsabilidades por mudança](../documentation/GUIA_DE_MANUTENCAO.md#o-que-atualizar-em-cada-mudança) e [revisão antes de concluir](../documentation/GUIA_DE_MANUTENCAO.md#revisão-antes-de-concluir). |

O [índice de `docs/`](../README.md) lista todas as categorias. As [ADRs](../decisions/) registram decisões e alternativas; `proposta` não equivale a decisão aceita.

Ao concluir uma etapa, siga o [guia de manutenção](../documentation/GUIA_DE_MANUTENCAO.md) para atualizar as fontes pertinentes, conferir os links e registrar pendências. Mantenha somente Markdown como fonte editável; PDFs são gerados apenas sob pedido explícito.
