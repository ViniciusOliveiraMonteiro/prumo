# ADR-043: convite e aceite de membro para acesso privado

- **Status:** proposta; **não aprovada nem implementada**
- **Data:** 2026-10-21
- **Decisão necessária:** aprovar ou ajustar este recorte antes de criar migração, endpoints ou interface de admissão
- **Relacionadas:** [ADR-037](ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos), [ADR-041](ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado) e [ADR-042](ADR-042-minimal-membership-management-proposal.md#convite-e-papéis-fora-do-recorte)

## Proposta resumida

Para o **acesso privado com contas previamente provisionadas**, propor que um `OWNER` ativo convide uma conta ativa pelo UUID que o próprio destinatário compartilhou. O convite aparece somente na caixa de entrada autenticada dessa conta. Aceitar exige sua sessão ativa e ação explícita; o servidor vincula o aceite ao `userId` da sessão, nunca a um ID enviado no corpo. O papel inicial é apenas `VIEWER`. A conta convidada não recebe acesso até o commit do aceite. O fluxo não envia e-mail nem usa link portador de segredo.

Este é um recorte candidato de admissão consentida, não uma aprovação para cadastro público, verificação de e-mail, papéis financeiros ou reativação de membership revogada. A [ADR-042](ADR-042-minimal-membership-management-proposal.md#convite-e-papéis-fora-do-recorte) mantém esses pontos pendentes. O [Plano Mestre](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#73-membership) sugere os papéis, mas deixa a granularidade final `NÃO DEFINIDO`.

## Contexto e alternativas

Hoje `/api/auth/me` devolve o UUID da conta autenticada; a identidade privada é criada por comando local. `identity.users.email_normalized` indica unicidade de login, **não comprova controle verificado da caixa postal**. `household.memberships` tem chave `(household_id, user_id)`, papel e `active`; a [ADR-042](ADR-042-minimal-membership-management-proposal.md#fluxo-http-e-transacional-aprovado) revoga ao marcar essa linha inativa e registra evento na mesma transação. A role da API não tem acesso de leitura aos eventos. Ainda não existe serviço de entrega de e-mail nem cadastro externo.

| Alternativa | Benefício | Custo e risco |
|---|---|---|
| Adicionar por e-mail ou UUID sem aceite | Menos etapas | Cria associação sem consentimento; e-mail pode enumerar contas. |
| Link com token de uso único entregue fora da aplicação | Funciona sem caixa de entrada | Exige canal seguro de entrega; encaminhamento e vazamento do link criam risco de aceite pela conta errada. Mesmo vinculando o token ao usuário, seria necessário confirmar a identidade autenticada. |
| E-mail com link ou código | Familiar para usuários externos | Precisa de posse de e-mail verificada, serviço de entrega, política de envio, abuso e recuperação ainda não decididos. |
| **UUID compartilhado e caixa de entrada autenticada** | Usa identidade e sessão já existentes; nenhum segredo circula por link | Compartilhar UUID fora do produto gera atrito; exige descoberta e notificação manual entre pessoas e não demonstra posse do e-mail. |

**Recomendação para este recorte:** quarta alternativa. O destinatário consulta seu UUID em `/api/auth/me` e o fornece voluntariamente ao `OWNER` por canal escolhido entre eles. UUID é identificador, não credencial; conhecer o UUID não autoriza nenhuma operação. O convite é entregue por `GET` autenticado, sem push ou e-mail. A pessoa precisa entrar no Prumo para vê-lo; a interface deve deixar claro esse limite. Futuro cadastro externo ou entrega por e-mail exige outra decisão e revisão do threat model.

## Política e modelo candidatos

- Só `OWNER` ativo pode criar ou cancelar convite no próprio household. Apenas conta ativa já provisionada, sem qualquer linha de membership nesse household, pode ser convidada. Membership inativa **não é reativada** por convite; retorno após revogação exige decisão própria. Não convidar o próprio ator. `MEMBER` e `VIEWER` não convidam.
- Criar `household.invitations` com UUID opaco, `household_id`, `inviter_user_id`, `invitee_user_id`, papel fixo `VIEWER`, estado `pending|accepted|cancelled|expired`, criação, expiração, aceite e cancelamento. FKs para household e usuários; índice para caixa de entrada do destinatário; no máximo um convite `pending` por par household/destinatário. Histórico não contém e-mail ou token. A duração candidata é **7 dias** a partir do relógio do banco. Validade é verificada em toda leitura/aceite; uma limpeza posterior pode materializar `expired` sem alterar a semântica. A expiração é determinada pelo prazo persistido, mesmo antes dessa limpeza. Retenção e limpeza do histórico continuam pendentes.
- O UUID do convite identifica a linha, mas não é prova de posse: não há token de aceite. O servidor resolve o destinatário pela sessão e compara com `invitee_user_id`. A lista de convites do usuário mostra apenas pendentes válidos, nome do household, papel e expiração necessários à decisão. Não incluir membros, e-mails ou dados financeiros antes do aceite.
- Aceite explícito cria membership `VIEWER` ativa e evento de auditoria na mesma transação. Criação, cancelamento e aceite devem registrar eventos mínimos com ator humano, destinatário, household, tipo e momento, sem payload bruto ou segredo. O prazo persistido permite reconstruir a expiração; a limpeza automática não insere evento com ator humano, pois o esquema atual exige que esse ator tenha membership no household. Uma futura auditoria de sistema exige modelo próprio. Definir constraints de evento e grants da role `prumo_app` na migração; a API segue sem `SELECT` nos eventos e sem `DELETE` em memberships.
- Um convite pendente deixa de ser aceitável se o emissor não for mais `OWNER` ativo, se a conta destinatária ficar inativa, se passar o prazo ou se houver membership para o par. Como remover/downgrade de `OWNER` não existe hoje, este requisito fica como proteção para evolução; sua concorrência deve ser testada quando essa capacidade for criada.

## Contrato HTTP proposto

| Operação | Resposta candidata | Limite de informação |
|---|---|---|
| `POST /api/households/{id}/invitations` com `inviteeUserId` UUID | `202` com `requestId` opaco | Para `OWNER` autorizado, mesma forma de resposta e trabalho semelhante para UUID existente, inexistente, inativo, já membro ou convite pendente. `requestId` pode corresponder ao convite efetivo ou a pedido sem entrega; não informa qual. |
| `GET /api/auth/invitations` | `200` com convites pendentes válidos da própria conta | Não aceita `userId` arbitrário nem expõe convites de outra conta. |
| `POST /api/auth/invitations/{invitationId}/accept` | `204` na primeira aceitação e em repetição pela mesma conta se a membership produzida ainda estiver ativa; `404` para ID alheio/inexistente/expirado/cancelado | Uma repetição não recria membership nem evento. Se a membership foi revogada depois do aceite, não reativar: `409` para a antiga destinatária, sem alterar estado. |
| `POST /api/households/{id}/invitations/{requestId}/cancel` | `204` para pedido conhecido ou desconhecido por `OWNER` autorizado | Cancelamento idempotente; não informa se conta ou convite existiu, nem muda membership aceita. |

Sessão ausente ou inválida recebe `401`. Household ausente ou sem membership ativa recebe `404`; ator com membership mas sem ação recebe `403`. Entradas malformadas recebem `400`. As respostas são privadas com `Cache-Control: no-store`, proteção de origem das mutações e contrato OpenAPI/tipos web conforme [ADR-032](ADR-032-web-api-contract.md#decisão). Não expor endpoint de consulta de usuário por UUID ou e-mail. Limitar solicitações e convites pendentes por ator/household com valores definidos antes de uso externo; registrar métricas agregadas de abuso sem identificadores sensíveis. O `requestId` não é bearer token, mas deve ser aleatório e difícil de adivinhar para reduzir correlação.

## Transação, concorrência e replay

Na criação, conferir e bloquear a membership do `OWNER` dentro da transação, consultar destinatário ativo e ausência de membership, inserir convite pendente e evento atomicamente. Concorrência para o mesmo par precisa de índice único parcial e tratamento de conflito que mantenha `202`; convites vencidos devem ser encerrados antes de inserir outro. A consulta de identidade nunca altera a resposta observável do emissor. O cancelamento verifica `OWNER` atual e altera apenas convite pendente do próprio household, com evento na mesma transação.

No aceite, bloquear de modo consistente a membership do emissor e o convite, confirmar destinatário pela sessão, estado e prazo pelo relógio do banco, e inserir a membership somente se ainda não existir. O índice único da membership é a última barreira contra dois aceites simultâneos. Marcar `accepted` e auditar na mesma transação; erro em qualquer passo desfaz todos. Aceite e cancelamento concorrentes são serializados no convite: vence o primeiro commit válido. Uma aceitação após cancelamento confirmado falha. Uma aceitação confirmada não é desfeita por cancelamento posterior; revogação usa a rota já aprovada na ADR-042. Definir e testar a ordem global de locks junto com `rename` e `revokeMembership` antes de implementar, para evitar deadlocks. Erros de conflito transitório podem exigir retry transacional limitado, sem duplicar evento.

O estado `accepted` e a membership resultante permitem repetir a requisição com a **mesma conta** sem segundo evento. Outro usuário sempre recebe `404`, mesmo que conheça o ID. Repetir a criação enquanto houver convite pendente para o mesmo par ou repetir o cancelamento não deve gerar convite ou evento extra; uma nova solicitação após expiração é novo convite e novo evento. A sessão do destinatário continua válida após revogação, mas a próxima operação no household falha conforme [ADR-041](ADR-041-household-authorization-boundary-proposal.md#fluxo-proposto-para-validação).

## Critérios antes de aceitar e implementar

1. Revisar esta política e aprovar explicitamente o uso de UUID compartilhado, caixa de entrada autenticada, `VIEWER`, prazo e respostas uniformes. Atualizar o quadro da Sprint 4 e threat model na mesma mudança da decisão. Sem essa aprovação, não criar migração nem endpoint.
2. Validar no PostgreSQL real com `prumo_app`: duas contas e dois households; convite só por `OWNER` ativo; destino correto; nenhuma leitura ou associação cruzada; conta inativa, membership revogada e UUID inválido sem admissão; dados de household ocultos antes do aceite. Verificar grants e ausência de `SELECT` em eventos.
3. Testar respostas uniformes de criação/cancelamento, ausência de enumeração por corpo, status, tempo grosseiro e logs; limite de abuso e `no-store` pelo rewrite web/API. A uniformidade absoluta de tempo não é prometida, mas diferenças sistemáticas precisam ser corrigidas.
4. Controlar as duas ordens de aceite versus cancelamento e aceites simultâneos, expiração no limite do prazo, replay antes/depois de revogação, rollback por falha de auditoria e ordem de locks com `rename`/revogação. Conferir que só um aceite e um evento confirmam.
5. Atualizar OpenAPI e tipos da web; revisar a implementação independentemente após testes, conforme [guia de agentes](../collaboration/agents.md). Registrar evidência local separada de CI/staging. O gate de autorização financeira e a decisão de RLS continuam separados.

## Pendências e trade-offs

A recomendação reduz a superfície de entrega de segredo, mas sacrifica descoberta e notificação automática. A prova de identidade é **sessão autenticada da conta alvo**, não e-mail verificado nem identidade civil. O UUID compartilhado pode ser copiado por terceiros; no máximo permite solicitar convite, jamais aceitá-lo por outra conta. A caixa de entrada pode receber convites indesejados; é necessário limite de abuso e, antes de abrir acesso externo, considerar recusa/bloqueio do remetente. A política de rejeição voluntária, notificação fora do app, endereço internacional, recuperação do único `OWNER`, transferência de ownership, retenção de convite/evento e aceite por conta recém-criada permanecem **pendentes**. Não inferir aprovação dessas capacidades a partir desta ADR.

O Plano de Estudos coloca Identity + Household na [Fase C](../../PLANO_DE_ESTUDOS_APLICADO.md#fase-c---identity--household). Para estudo: [SEC-005, privilégio mínimo e autorização por recurso](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-005---least-privilege-rbac-e-autorização-por-recurso) e [SEC-006, isolamento entre households](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-006---isolamento-entre-households-e-defense-in-depth).
