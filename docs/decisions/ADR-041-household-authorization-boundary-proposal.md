# ADR-041: fronteira proposta de autorização por household

- **Status:** proposta para a Sprint 4; sem esquema, endpoints ou política de papéis aprovados
- **Data:** 2026-10-20
- **Decisões relacionadas:** a [ADR-029](ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo) define a baseline de isolamento; a [ADR-036](ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final) mantém RLS em avaliação; a [ADR-037](ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos) implementou identidade e sessão privadas

## Contexto

Hoje o Prumo autentica uma conta privada e mantém sessão revogável no PostgreSQL. Não há `households`, `memberships`, permissão por ação ou recurso financeiro implementado. O Plano Mestre define household como limite de isolamento e sugere `OWNER`, `MEMBER` e `VIEWER`, mas deixa a granularidade final `NÃO DEFINIDO`. A sessão identifica o usuário; ela não autoriza acesso a um household. Esta proposta especifica a fronteira a validar antes de criar operações financeiras.

## Alternativas

| Opção | Benefício | Limite |
|---|---|---|
| Verificar o papel no controller e passar `householdId` livre aos serviços | Implementação inicial curta | Outro caminho de serviço pode omitir a verificação; a revogação concorre com escritas já autorizadas |
| Resolver membership e ação em um serviço de autorização, passar contexto tipado e escopar repositórios | Uma fronteira reutilizável e testes claros | Exige contrato de ações, transações e disciplina em todos os caminhos |
| Confiar apenas em RLS e em um valor de household na conexão | Filtra consultas SQL comuns | A própria role pode definir o valor; RLS não sabe qual usuário HTTP ou ação foi autorizada, como mostrou a ADR-036 |

**Candidata:** a segunda opção, combinada com a baseline da ADR-029. RLS continua possível como defesa adicional, sujeita a decisão separada. Nenhuma opção desta tabela é aprovada por esta ADR.

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

## Gates de aceite para a Sprint 4

- Aprovar a matriz mínima de ações e os fluxos de criação, convite, revogação e troca de household antes da migração e dos endpoints correspondentes.
- Demonstrar com duas contas e dois households que sessão válida de A não lê, soma, cria, corrige ou vincula recurso de B; `VIEWER` não escreve; quem participa de A e B continua restrito ao household selecionado por operação.
- Revogar ou reduzir o papel mantendo a sessão ativa: a próxima operação protegida falha. Executar as duas ordens de concorrência entre revogação e escrita; nenhuma escrita confirma **depois** de uma revogação já confirmada.
- Testar no PostgreSQL real com `prumo_app`, pool e transações; verificar falha fechada sem contexto, grants, integridade dos vínculos, resposta sem enumeração de recurso e ausência de permissões antigas em cache.
- Só depois conectar a decisão de RLS da ADR-036 ao primeiro esquema financeiro. Aprovação desta proposta, sozinha, não conclui os gates acima.

## Pendências e conceitos para estudo

Continuam pendentes esquema físico, formato do contexto interno, matriz final, fluxo de convites, auditoria, política de erros HTTP, desempenho e política de jobs. Não criar tabelas ou endpoints de household até revisar essas decisões. A implantação em homologação ou produção continua adiada e não é requisito para o laboratório local.

Estudar: autenticação versus autorização, RBAC e autorização por recurso, revogação, `SELECT FOR SHARE`, ordem de commits, escopo por household, IDOR/BOLA e RLS como defesa adicional. Ver [SEC-003](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-003---autenticação-autorização-e-identidade), [SEC-005](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-005---least-privilege-rbac-e-autorização-por-recurso) e [SEC-006](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-006---isolamento-entre-households-e-defense-in-depth).
