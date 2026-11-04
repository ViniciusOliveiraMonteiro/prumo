# ADR-050: primeira revisão auditável do valor do marco de conta

- **Status:** aceito e implementado no recorte local delimitado
- **Data:** 2026-11-04
- **Aprovação:** o usuário aprovou a proposta em 2026-11-04

## Contexto e decisões existentes

A [ADR-016](ADR-016-opening-balance.md#correção-do-valor-inicial-após-movimentos--complemento) já permite corrigir o valor inicial, inclusive depois de movimentos, com justificativa, autoria, histórico e recálculo dos saldos. A correção não cria evento, movimento, receita ou despesa. A [ADR-027](ADR-027-first-flow-idempotency-concurrency.md#decisão) exige identidade persistente do pedido, versão esperada e conflito entre revisões concorrentes. A [ADR-041](ADR-041-household-authorization-boundary-proposal.md#contexto-autorizado-para-o-primeiro-fluxo-financeiro--aprovado-em-2026-11-03) define `finance:write` para `OWNER` e `MEMBER` ativos e `finance:read` também para `VIEWER`. Dinheiro, saldo assinado e isolamento seguem as ADRs 006, 028 e 029.

Hoje `finance.accounts` guarda apenas `opening_date` e `opening_balance_cents`. As leituras de conta não expõem versão; o saldo diário deriva o valor atual e os movimentos `APPLIED`. Não há trilha nem comando de revisão. A transferência confirmada da [ADR-049](ADR-049-first-manual-transfer-proposal.md#proposta-delimitada-para-aprovação) exige dois movimentos aplicados, o que torna a mudança da *data* do marco um recorte distinto, especialmente se um lado passar a antecedê-lo.

## Alternativas

| Opção | Benefício | Custo |
|---|---|---|
| Sobrescrever o valor com campos `updated_at` e `updated_by` | Pouca estrutura | Perde valores intermediários, motivo e resultado de retries antigos; não atende à ADR-016/027. |
| Criar evento financeiro de ajuste | Usa o mecanismo de movimentos existente | Faz a correção parecer receita ou despesa e mistura ponto de partida com fato posterior. |
| Versionar o marco e guardar cada revisão em tabela própria | Preserva trilha, concorrência e saldo derivado | Exige migração, contrato e teste transacional. **Proposta.** |

## Proposta delimitada para decisão

**Alcance.** A primeira rota altera somente `openingBalanceCents`, mantendo `openingDate` e a identidade da conta. O valor novo é informado pela pessoa como string decimal canônica assinada, em BRL, entre `-9007199254740991` e `9007199254740991`. Aceitar zero e valor igual ao atual: este último ainda registra uma revisão intencional justificada, sem mudar o saldo. `reason` é texto não vazio normalizado, de 1 a 500 caracteres, sem NUL. O motivo é dado de auditoria, não prova bancária. Nenhum saldo anterior à data do marco passa a ser calculável e nenhum movimento muda de estado neste recorte.

**Contrato candidato.** `POST /api/households/{householdId}/accounts/{accountId}/opening-balance-revisions` recebe `{ expectedVersion, openingBalanceCents, reason }`, com `expectedVersion` inteiro positivo, e exige `Idempotency-Key` UUID. Retorna `201` com `revisionId`, `accountId`, `version`, `openingDate`, valores anterior e novo em centavos, motivo, autor e instante da revisão. A leitura da conta passa a expor `openingVersion`. `GET /api/households/{householdId}/accounts/{accountId}/opening-balance-revisions` apresenta as revisões em ordem de versão, com paginação e acesso `finance:read`; o registro inicial deve ser identificável como versão 1, com valor, data, autor e instante de criação, sem inventar um motivo de revisão. A forma exata de paginação segue os limites locais existentes e deve ser fixada no OpenAPI antes da implementação.

**Persistência e concorrência.** Adicionar versão vigente à conta, inicializada em 1 para contas existentes. Guardar revisões imutáveis vinculadas por `(household_id, account_id)`, com versão anterior/nova, valores anterior/novo, data do marco, motivo, autor e horário do servidor. A identidade `(household, 'account:opening-balance:revise', key)` conserva payload normalizado, autor e resposta da revisão. Sob transação, revalidar membership e conta, procurar primeiro o pedido idempotente e, se for um retry idêntico autorizado, devolver o resultado histórico da revisão. Para pedido novo, bloquear a conta, comparar `expectedVersion` à versão vigente e gravar nova versão, revisão e pedido como unidade. Chave repetida com outro autor ou payload, ou versão esperada ultrapassada em pedido novo, retorna `409` sem alteração. O retry de uma revisão já confirmada não se apresenta como estado atual caso outra revisão a tenha sucedido.

**Efeito e leitura.** O saldo diário passa a usar o valor vigente do marco, mais os mesmos movimentos aplicados; a diferença entre valor antigo e novo afeta todos os saldos calculáveis desde a data do marco. Receita, despesa, trânsito e estados dos movimentos ficam iguais. A resposta da conta e a consulta de saldo devem refletir o mesmo estado confirmado; caso uma leitura agregada atravesse uma revisão concorrente, ela deve usar um snapshot coerente. A correção preserva histórico para explicar diferenças de reconciliação; a reconciliação com fonte externa ainda não está implementada, portanto não criar ajuste automático nem afirmar que uma divergência foi processada.

**Autorização e erros.** Sessão ausente: `401`; `VIEWER` ativo na escrita: `403`; household ou conta fora do escopo: `404`, sem revelar existência; dados inválidos: `400`; versão ou chave em conflito: `409`. Revalidar autorização antes de devolver replay. Respostas autenticadas usam `Cache-Control: no-store`. Qualquer referência nova no banco inclui household; `prumo_app` recebe apenas os grants necessários. RLS nas tabelas reais permanece proposta na [ADR-036](ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final).

## Gate para implementação local

Com marco de R$ 5.000 em 01/02, receita de R$ 200 e despesa de R$ 80, saldo de R$ 5.120. Corrigir o marco para R$ 4.990, na mesma data, produz R$ 5.110 desde 01/02 sem mudar os R$ 200 de receita e R$ 80 de despesa, nem criar movimento. Consultar 31/01 continua sem saldo calculável. Testar valores extremos e zero; motivo vazio e entrada inválida; sequência de duas revisões e leitura da trilha; duas revisões concorrentes da mesma versão, com uma vencedora; retry concorrente, após reinício e após revisão posterior; chave com payload/autor diferente; revogação nas duas ordens; isolamento A/B; rollback entre atualização, trilha e pedido; role restrita e contrato web/API. A transferência existente deve continuar com seus dois movimentos íntegros e o trânsito inalterado. Executar E2E direcionados, checks de contrato/tipos/lint/formatação e revisão independente de banco, regra financeira e autorização antes de marcar o incremento local como concluído.

## Limites e próxima decisão

Esta aprovação cobre somente o valor do marco na mesma data. Mudar a data do marco, promover receitas/despesas pendentes, tornar aplicados movimentos antes do marco ou rebaixar movimentos que passem a antecedê-lo exigem outro recorte. Esse recorte deverá decidir explicitamente como uma transferência confirmada se comporta se apenas um lado ficar antes do novo marco, sem enfraquecer sua integridade. Retificação de eventos segue a ADR-026; reconciliação externa, RLS real e política de fuso continuam pendentes. Conceitos para estudo: marco versus evento, versão esperada, trilha append-only, idempotência durável e snapshot de leitura.

## Implementação local em 2026-11-04

As migrações `0018`–`0020` adicionam versão vigente, revisões imutáveis para a role da aplicação, pedidos duráveis, proteção contra alteração direta do valor sem revisão correspondente, vínculo composto por household e conta e resposta original persistida para o retry de criação da conta. A API implementa criação e listagem paginada das revisões; a resposta de conta inclui `openingVersion`. OpenAPI e tipos web foram regenerados. O saldo diário já derivava o valor vigente do marco; a revisão não altera movimentos nem classificação.

Os E2E direcionados passaram: **28 testes** de revisão, conta, receita e transferência juntos após as correções, e **11 testes** da revisão na última execução, com limites assinados, zero, rollback injetado após a atualização, duas ordens concorrentes de revogação e replay após nova instância. O último arquivo foi executado separadamente porque os testes adicionais foram acrescentados depois da regressão conjunta. `contract:check`, typecheck web/API, lint da API e conferência de links passaram; formatação foi corrigida após a última conferência. A revisão independente apontou três defeitos materiais: FK simples no pedido de revisão permitia referência cruzada via SQL direto; replay de criação de conta devolvia valor vigente após revisão; parâmetros de paginação não apareciam no OpenAPI. As correções foram feitas, cobertas por E2E e relidas sem novo defeito material. A migração e os testes ocorreram somente no PostgreSQL local; RLS real, CI e uso externo não foram demonstrados.
