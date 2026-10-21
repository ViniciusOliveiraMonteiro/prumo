# ADR-036: RLS como defesa adicional para dados financeiros

- **Status:** proposta; adoção em produção não aprovada
- **Data:** 2026-10-14

## Contexto

A ADR-029 já exige autenticação, autorização por ação e recurso, consultas escopadas pelo household e vínculos íntegros no banco. Ela deixou RLS pendente até um laboratório com a role e o pool da aplicação. O primeiro laboratório cobriu operações A/B; esta revisão acrescentou owner, `BYPASSRLS`, reuso de conexão e um job sintético. Sessão revogável e role `prumo_app` existem no recorte privado local; **membership, tabelas financeiras e worker de produto ainda não existem**. Por isso, o laboratório não demonstra a passagem de um household autorizado da API até uma transação financeira.

## Alternativas e proposta

1. **Manter apenas a baseline da ADR-029.** Evita policies e contexto no pool, mas uma consulta nova sem filtro pode alcançar dados de outro household.
2. **Somar RLS à baseline (proposta).** Reduz o efeito de uma consulta que esqueça o filtro, desde que a role não contorne RLS e receba contexto autorizado em cada transação. Exige policies em todas as tabelas pertinentes, papéis separados, testes de conexão e cuidados com jobs.
3. **Confiar só em RLS.** Não resolve permissão por ação, revogação de membership nem integridade de vínculos. A role da aplicação consegue definir o próprio valor de `prumo.household_id`; portanto o contexto SQL sozinho não prova a identidade do ator.

Propõe-se a alternativa 2 para as futuras tabelas financeiras com `household_id`, sujeita aos gates abaixo. A API continuará responsável por validar sessão, membership e permissão antes de abrir a transação; repositórios continuarão escopados e vínculos continuarão protegidos por constraints. A role de aplicação deverá ser distinta da role proprietária/migradora, sem `BYPASSRLS` e sem capacidade de assumir uma role privilegiada. O contexto de household será definido apenas após autorização, no escopo da transação e na mesma conexão das consultas. Policies devem falhar fechadas sem contexto e distinguir `USING` de `WITH CHECK`. Avaliar `FORCE ROW LEVEL SECURITY` nas tabelas protegidas para reduzir o risco de uso acidental pelo owner; isso não afeta superuser nem `BYPASSRLS`.

Jobs comuns de um household devem usar contexto autorizado por household, transação própria e a role restrita. Operações administrativas que realmente cruzem households exigem identidade de execução separada, escopo explícito, auditoria e testes próprios; o laboratório não autoriza um bypass geral para workers. O mecanismo de autorização de jobs e os casos de manutenção ainda não estão definidos.

## Evidência do laboratório

Em PostgreSQL 18.6 local, `pnpm --filter prumo-api test:db` passou com **10 testes** em 2026-10-14. O laboratório em `prumo-api/test/database.db-spec.ts` confirmou:

- a role de aplicação sem contexto não vê linhas; com A não lê nem altera B, e uma inserção em B falha;
- o owner vê A e B sem contexto por padrão; após `FORCE ROW LEVEL SECURITY`, só vê o household da transação;
- uma role `BYPASSRLS` continua vendo A e B após `FORCE`;
- o pool de um job sintético reutiliza a mesma conexão sem conservar o contexto definido na transação anterior;
- a própria role de aplicação pode definir B e então ler B: RLS não substitui autorização da API.

O laboratório usa dados descartáveis e roles criadas pelo usuário migrador local. Ele não prova integração com sessão, revogação de membership, worker real, todas as tabelas futuras ou comportamento em produção. Em 2026-10-20, o usuário confirmou o job `checks` verde da [CI do commit `684c53d`](https://github.com/ViniciusOliveiraMonteiro/prumo/actions/runs/39483065072), que inclui o laboratório de banco; informou 26 testes de banco aprovados. Os logs privados não foram inspecionados nesta sessão. Essa CI confirma a execução do laboratório publicado, não os gates de autorização ainda ausentes.

Após essa CI, o laboratório recebeu um [teste de conflito entre bloqueio de membership e revogação](ADR-041-household-authorization-boundary-proposal.md#evidência-técnica-inicial), com 11 testes locais aprovados no arquivo em 2026-10-20. O usuário confirmou a [CI `39491146796`](https://github.com/ViniciusOliveiraMonteiro/prumo/actions/runs/39491146796) do commit `c628068` com `checks` verde e **27 testes de banco** aprovados; os logs privados não foram inspecionados. A nova evidência é do mecanismo PostgreSQL, não da autorização integrada.

## Gates antes da decisão final

- Na Sprint 4, validar no PostgreSQL real o [primeiro recorte aprovado da ADR-041](ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado), com membership e permissão por ação passando pela API até a **mesma transação e conexão** da escrita. Uma sessão válida sem membership ativa, uma revogação e uma falha de autorização devem impedir a operação. Para escrita concorrente à revogação, demonstrar a ordem transacional exigida pela [ADR-029](ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo). A matriz financeira e a decisão final de RLS continuam pendentes.

**Evidência em 2026-10-21:** o primeiro recorte passou com cinco E2E de household no PostgreSQL local com `prumo_app`, incluindo revogação nas duas ordens e rollback da criação. O teste exigiu conceder `UPDATE` em memberships à role da aplicação para usar `FOR SHARE`; o custo está registrado na ADR-041. Ainda falta repetir a defesa em recursos financeiros reais, com vínculos, agregações e esquema correspondente. RLS permanece proposta.
- Definir as roles de migração, aplicação e jobs sem conceder owner ou `BYPASSRLS` ao caminho comum; testar seus grants e a ausência de contexto no pool reutilizado.
- Desenhar policies e constraints do primeiro esquema financeiro, incluindo operações com vínculos e consultas agregadas; testar A/B por API e SQL.
- Especificar e testar jobs por household e exceções administrativas, com auditoria. Reavaliar custo operacional e desempenho no fluxo real.
- Aprovar ou rejeitar esta proposta em ADR após a evidência do primeiro fluxo financeiro e antes de expor dados financeiros a usuários externos, conforme ADR-029. O laboratório isolado não basta para marcar a proposta como aceita.

## Conceitos para estudo

RLS é um filtro aplicado pelo banco por linha. `USING` limita linhas existentes que podem ser vistas ou alteradas; `WITH CHECK` limita as novas versões de linhas em `INSERT` e `UPDATE`. O owner normalmente contorna o filtro; `FORCE ROW LEVEL SECURITY` o submete à policy. Superuser e `BYPASSRLS` continuam a contorná-la. `set_config(..., true)` dura apenas a transação, o que ajuda a evitar contexto residual em conexões reutilizadas. Nenhum desses mecanismos identifica sozinho o usuário HTTP.

## Referências

- [ADR-029: baseline de isolamento](ADR-029-first-flow-household-isolation.md).
- [PostgreSQL 18: Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).
- [PostgreSQL 18: CREATE POLICY](https://www.postgresql.org/docs/18/sql-createpolicy.html).
- [PostgreSQL 18: funções de configuração da sessão](https://www.postgresql.org/docs/18/functions-admin.html).
