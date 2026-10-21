# ADR-041: fronteira de autorização por household

- **Status:** aceita em 2026-10-21 para o primeiro recorte de household; matriz financeira, gestão pública de membros e RLS pendentes
- **Data:** 2026-10-20
- **Aprovação:** o usuário aprovou o primeiro recorte e a matriz mínima em 2026-10-21
- **Decisões relacionadas:** a [ADR-029](ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo) define a baseline de isolamento; a [ADR-036](ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final) mantém RLS em avaliação; a [ADR-037](ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos) implementou identidade e sessão privadas

## Contexto

Antes deste incremento, o Prumo autenticava uma conta privada e mantinha sessão revogável no PostgreSQL, sem `households`, `memberships`, permissão por ação ou recurso financeiro. O Plano Mestre define household como limite de isolamento e sugere `OWNER`, `MEMBER` e `VIEWER`, mas deixa a granularidade final `NÃO DEFINIDO`. A sessão identifica o usuário; ela não autoriza acesso a um household. Esta ADR aprova somente a fronteira do primeiro recorte abaixo.

## Alternativas

| Opção | Benefício | Limite |
|---|---|---|
| Verificar o papel no controller e passar `householdId` livre aos serviços | Implementação inicial curta | Outro caminho de serviço pode omitir a verificação; a revogação concorre com escritas já autorizadas |
| Resolver membership e ação em um serviço de autorização, passar contexto tipado e escopar repositórios | Uma fronteira reutilizável e testes claros | Exige contrato de ações, transações e disciplina em todos os caminhos |
| Confiar apenas em RLS e em um valor de household na conexão | Filtra consultas SQL comuns | A própria role pode definir o valor; RLS não sabe qual usuário HTTP ou ação foi autorizada, como mostrou a ADR-036 |

**Escolha para o primeiro recorte:** a segunda opção, combinada com a baseline da ADR-029. O serviço avalia a ação e usa consultas escopadas; a escrita verifica a membership na mesma transação. Isso exige manter o escopo em cada caminho. RLS continua possível como defesa adicional, sujeita a decisão separada.

## Fluxo proposto para validação

1. A sessão fornece um `userId` ativo. O `householdId` de URL/corpo seleciona o contexto desejado; não prova acesso. Sem usuário, household, membership ativa ou permissão, a operação falha antes de ler ou escrever dados financeiros.
2. Um serviço de autorização consulta a membership daquele par usuário/household e avalia uma **ação explícita**. Ele devolve um contexto interno com ator, household e ação autorizada. Serviços e repositórios financeiros recebem esse contexto, escopam consultas, agregações e vínculos por household e rejeitam IDs de outro household. Não propagar apenas o ID informado pelo cliente.
3. Para **escritas**, verificar a membership dentro da mesma transação PostgreSQL da mudança financeira, antes de qualquer mutação. `SELECT ... FOR SHARE` na linha de membership é um mecanismo candidato: ele impede `UPDATE`/`DELETE` concorrente da linha até o fim da transação. A revogação deve alterar ou excluir essa mesma linha. Assim, se a escrita obtiver o bloqueio primeiro, a revogação espera e a escrita confirma antes dela; se a revogação confirmar primeiro, a leitura bloqueada encontra o estado revogado e a escrita falha. Demonstrar as duas ordens em testes com conexões separadas. Não assumir que uma checagem feita anteriormente no controller satisfaz essa garantia. [A documentação do PostgreSQL descreve os conflitos de bloqueios de linha](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS).
4. Para **leituras**, consultar membership ativa por operação, sem cache de permissão que sobreviva à revogação. Uma leitura já iniciada pode terminar; a próxima operação após o commit da revogação deve falhar. Se uma leitura produzir exportação, trabalho assíncrono ou outro efeito persistente, tratá-la como escrita para o limite transacional.
5. Se RLS for aprovada, definir `prumo.household_id` somente depois da autorização, no escopo da mesma transação/conexão com a role restrita. O contexto SQL é uma barreira adicional; não substitui o contexto da API nem as constraints de vínculo. Jobs precisarão de ator/escopo próprio antes de acessar dados financeiros.

## Matriz inicial a decidir

| Ação candidata | `OWNER` | `MEMBER` | `VIEWER` |
|---|---|---|---|
| Ler dados financeiros do próprio household | permitir | permitir | permitir |
| Criar/editar dados financeiros | permitir | permitir | negar |
| Gerir membros e papéis | permitir | negar | negar |
| Exportar, excluir definitivamente ou operar outro household | **pendente** | **pendente** | **pendente** |

A matriz é hipótese de trabalho derivada dos papéis sugeridos no Plano Mestre; não autoriza implementação nem presume que `OWNER` pode apagar definitivamente o household. Definir também quem cria o primeiro household, quem pode convidar/remover membros, como impedir a remoção do último `OWNER`, se o próprio usuário pode sair e como auditar mudanças de papel. Essas escolhas afetam o esquema e o contrato HTTP.

## Primeiro recorte aprovado

O usuário autenticado cria um household com nome; a criação do household, sua membership `OWNER` e o registro mínimo de auditoria confirmam na mesma transação. Um erro desfaz os três. O usuário lista apenas os households de que tem membership ativa e consulta o nome e o próprio papel em um household selecionado. Uma alteração do nome do household exige `OWNER` ativo. IDs enviados pelo cliente são seletores e todas as operações são escopadas pelo usuário da sessão.

| Ação do primeiro recorte | `OWNER` | `MEMBER` | `VIEWER` | Sem membership ativa |
|---|---|---|---|---|
| Criar household próprio | permitir para usuário autenticado | não se aplica | não se aplica | não se aplica |
| Listar memberships próprias e consultar household selecionado | permitir | permitir | permitir | negar |
| Alterar nome do household | permitir | negar | negar | negar |

O contrato usa ações internas explícitas para leitura e alteração de nome; a criação exige sessão ativa. A listagem parte do `userId` da sessão, sem aceitar um usuário arbitrário. Para consulta por ID e alteração, a autorização verifica membership na mesma operação; a alteração faz a verificação e o `UPDATE` na mesma transação com a role `prumo_app`. Household inexistente e household sem acesso recebem `404` sem nome ou papel; `MEMBER`/`VIEWER` ativos recebem `403` ao tentar alterar o nome. O contrato OpenAPI registra `POST /api/households`, `GET /api/households`, `GET /api/households/{id}` e `PATCH /api/households/{id}`. O PostgreSQL exige privilégio `UPDATE` sobre `household.memberships` para executar `SELECT ... FOR SHARE`; esse grant amplia o poder SQL da role da aplicação. A API não oferece rota de mudança de membership neste recorte, o E2E confirma ausência de `DELETE` e de leitura dos eventos, e a decisão de RLS continua pendente como defesa adicional.

Para provar `MEMBER`, `VIEWER` e revogação neste primeiro recorte, os testes podem preparar memberships sintéticas no banco isolado. A revogação concorrente deve modificar a **mesma linha** que a escrita bloqueia; o teste atravessa sessão → API → serviço → transação com `prumo_app`, enquanto outra conexão revoga a membership. Testar também redução de `OWNER` para `VIEWER`, as duas ordens de commit, a próxima leitura após a revogação e um usuário que pertence a dois households. Isso valida o limite técnico sem oferecer ainda uma rota pública de convite ou revogação. O ensaio atual de `membership_probe` continua separado dessas tabelas e não satisfaz esse gate.

**Fora da primeira decisão:** convites, remoção e troca de papel por usuários, saída voluntária, exclusão de household, exportação, dados financeiros e uma seleção de household persistida na sessão. A escolha do household ocorre por operação; uma futura interface pode guardar preferência de navegação sem transformá-la em autoridade. Antes de abrir gestão pública de membros, decidir política do último `OWNER`, aceite de convite, auditoria e respostas a enumeração. Antes de dados financeiros, repetir a autorização para leitura, agregação, vínculo e escrita de recursos reais conforme a ADR-029 e concluir o gate de RLS da ADR-036.

**Decisão registrada:** o usuário aprovou esse recorte, a matriz mínima e o uso de fixtures de teste para os papéis ainda sem fluxo público. A aprovação delimita migrações, endpoints e testes locais desse incremento; não aprova a matriz completa nem RLS ou implantação externa.

## Gates de aceite para a Sprint 4

- Aprovar a matriz mínima e o fluxo de criação antes das primeiras migrações e endpoints. Aprovar convite, revogação pública e troca de household antes das migrações e endpoints dessas capacidades; o laboratório de revogação pode usar fixtures isoladas.
- Demonstrar com duas contas e dois households que sessão válida de A não lê, soma, cria, corrige ou vincula recurso de B; `VIEWER` não escreve; quem participa de A e B continua restrito ao household selecionado por operação.
- Revogar ou reduzir o papel mantendo a sessão ativa: a próxima operação protegida falha. Executar as duas ordens de concorrência entre revogação e escrita; nenhuma escrita confirma **depois** de uma revogação já confirmada.
- Testar no PostgreSQL real com `prumo_app`, pool e transações; verificar falha fechada sem contexto, grants, integridade dos vínculos, resposta sem enumeração de recurso e ausência de permissões antigas em cache.
- Só depois conectar a decisão de RLS da ADR-036 ao primeiro esquema financeiro. Aprovação desta proposta, sozinha, não conclui os gates acima.

## Evidência técnica inicial

Em 2026-10-20, `prumo-api/test/database.db-spec.ts` ganhou um ensaio descartável com `membership_probe` e duas conexões da role de laboratório. Quando a escrita toma `FOR SHARE` primeiro, uma revogação concorrente recebe `lock_timeout`; após o commit da escrita, a revogação pode confirmar. Na ordem inversa, a revogação segura a linha, a leitura bloqueada não prossegue e, após o commit da revogação, encontra `active = false`. O arquivo completo passou localmente com **11 testes** no PostgreSQL. O usuário confirmou que a [execução `39491146796`](https://github.com/ViniciusOliveiraMonteiro/prumo/actions/runs/39491146796) mostra o commit `c628068` e o job `checks` verde; compartilhou resumos Vitest aprovados de 1 teste unitário, 20 E2E e 27 de banco. Os logs privados não foram acessados por esta sessão. O ensaio comprova o conflito de bloqueios no banco, sem validar a API de produto.

Em 2026-10-21, a migração `0006_households.sql` e os grants de `prumo_app` foram aplicados no PostgreSQL local após o usuário restabelecer o Docker. O primeiro E2E revelou que `FOR SHARE` falhava com `42501` quando `prumo_app` tinha apenas `SELECT, INSERT`; após acrescentar `UPDATE` e repetir o preparo da role, `test/household.e2e-spec.ts` passou. Uma revisão independente apontou nome com NUL gerando `500`, ausência de `400` no OpenAPI de consulta, espera não comprovada no teste de revogação e ausência de teste de rollback. As correções foram aplicadas; o E2E foi repetido e passou com **5 testes**. Os casos cobrem grants, rollback, entrada inválida, duas contas e dois households, papéis, resposta uniforme para recurso inexistente/sem acesso, downgrade, revogação com sessão ativa e as duas ordens de concorrência pela API. A segunda revisão independente não apontou defeitos remanescentes nas partes corrigidas. `pnpm test:db` passou com **27 testes em quatro arquivos**. Build, lint, tipos, formatação, teste unitário e `contract:check` passaram localmente. Essa evidência valida o primeiro recorte no banco local, sem validar autorização financeira, RLS, staging ou produção.

## Pendências e conceitos para estudo

Continuam pendentes o contexto autorizado reutilizável para recursos financeiros, a matriz final, troca de papéis, auditoria das mudanças futuras, desempenho e política de jobs. A [ADR-042](ADR-042-minimal-membership-management-proposal.md#matriz-mínima-aprovada) aprovou e validou localmente a listagem/revogação com auditoria; a [ADR-043](ADR-043-household-invitation-acceptance-proposal.md#recorte-privado-aprovado) aprovou separadamente convite e aceite privados, com requisito de aceite por e-mail na versão final ainda sem protocolo decidido. O esquema físico deste recorte é mínimo e não decide o esquema financeiro. O grant `UPDATE` de membership precisa ser reavaliado junto com RLS e com o contrato de gestão de membros. A implantação em homologação ou produção continua adiada e não é requisito para o laboratório local.

Estudar: autenticação versus autorização, RBAC e autorização por recurso, revogação, `SELECT FOR SHARE`, ordem de commits, escopo por household, IDOR/BOLA e RLS como defesa adicional. Ver [SEC-003](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-003---autenticação-autorização-e-identidade), [SEC-005](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-005---least-privilege-rbac-e-autorização-por-recurso) e [SEC-006](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-006---isolamento-entre-households-e-defense-in-depth).
