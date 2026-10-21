# ADR-042: gestão mínima de memberships existentes

- **Status:** aceita em 2026-10-21 para listagem e revogação de memberships existentes; implementação local validada
- **Data:** 2026-10-21
- **Aprovação:** o usuário escolheu o incremento menor recomendado em 2026-10-21
- **Decisões relacionadas:** [ADR-029, isolamento](ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo); [ADR-036, RLS proposta](ADR-036-row-level-security-proposal.md#gates-antes-da-decisão-final); [ADR-041, primeiro recorte aprovado](ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado)

## Contexto e limite da decisão

O primeiro recorte da ADR-041 criou household e membership `OWNER`, consulta própria e alteração de nome. Antes deste incremento, outros papéis existiam apenas no esquema e em fixtures; não havia entrada de outro usuário, listagem de membros nem revogação pública. O Plano Mestre sugere `OWNER`, `MEMBER` e `VIEWER` e mantém a granularidade final `NÃO DEFINIDO`. Este recorte comprova uma revogação feita pela API sem transformar convite, troca de papéis ou remoção do último `OWNER` em decisões implícitas.

O esquema anterior a este incremento preserva a linha de membership com `active`; eventos de household registram apenas criação e alteração de nome. A role `prumo_app` já tem `UPDATE` em memberships porque PostgreSQL o exige para `SELECT ... FOR SHARE`. Esse grant, por si só, não autoriza gestão de membros. RLS permanece em proposta, e ainda não existem recursos financeiros para comprovar seu isolamento.

## Alternativas para o próximo incremento

| Alternativa | Ganho | Custo ou limite |
|---|---|---|
| Listar e revogar apenas `MEMBER`/`VIEWER` existentes | Exercita gestão, autorização e revogação reais com pequena superfície | Depende de fixtures para admitir outra conta; não entrega colaboração completa |
| Incluir convite, aceite e revogação no mesmo incremento | Permite duas contas colaborarem pelo produto | Exige identidade do destinatário, ciclo de vida do convite, proteção contra abuso e entrega/compartilhamento seguro |
| Adicionar usuário por ID ou e-mail sem aceite | Poucas etapas | Associação sem consentimento e possível enumeração de contas; não recomendada |

**Decisão:** o usuário escolheu a primeira alternativa como incremento local de segurança. O custo é explícito: o produto ainda não oferecerá admissão de membros. A segunda alternativa permanece para uma decisão futura sobre colaboração completa entre duas contas sem fixtures.

## Matriz mínima aprovada

| Ação | `OWNER` ativo | `MEMBER`/`VIEWER` ativo | Sem membership ativa |
|---|---|---|---|
| Listar memberships ativas do household selecionado | permitir | negar | negar sem expor o household |
| Revogar outro `MEMBER`/`VIEWER` ativo | permitir | negar | negar sem efeito |
| Revogar a própria membership ou qualquer `OWNER` | negar | negar | negar |
| Convidar, admitir, reativar ou trocar papel | pendente | pendente | pendente |

Listar apenas `userId` e papel, sem e-mail ou perfil. O `householdId` da URL seleciona o recurso e não prova acesso. A sessão fornece o ator, e a autorização deve consultar sua membership ativa em cada operação. A lista não inclui memberships inativas. Nenhuma operação deste incremento modifica uma linha `OWNER`, inclusive quando há mais de um; isso protege o último `OWNER` sem presumir uma política definitiva de transferência de ownership.

## Fluxo HTTP e transacional aprovado

- `GET /api/households/{id}/memberships` retorna apenas membros ativos ao `OWNER` autorizado, com `Cache-Control: no-store`.
- `POST /api/households/{id}/memberships/{userId}/revoke` é um comando explícito. `OWNER` revoga outro `MEMBER`/`VIEWER` ao atualizar `active=false` na linha existente e inserir um evento de auditoria na **mesma transação**. Não excluir fisicamente a linha nem expor um `PATCH` genérico de papel e atividade.
- Sessão inválida responde `401`; household inexistente ou sem acesso e alvo fora do household respondem `404` sem detalhes do alvo; ator ativo sem permissão responde `403`. Tentar revogar `OWNER` responde conflito de política (`409`) ao ator autorizado. Revogação bem-sucedida, inclusive repetida para membro já inativo, responde `204` sem novo evento.
- A auditoria mínima registra household, ator, alvo, papel anterior e momento da revogação, sem e-mail, token ou payload bruto. Uma falha na inserção do evento desfaz a revogação. A migração `0007_membership_revocation.sql` acrescenta o tipo e o vínculo do alvo. A role da API continua sem `DELETE` em memberships e sem `SELECT` nos eventos.

Para revogar, verificar `OWNER` ativo e bloquear sua membership na transação; bloquear também a linha do alvo antes de conferir papel e atividade. A revogação atualiza **a mesma linha** que uma futura escrita protegida do alvo deverá bloquear com `FOR SHARE`. Leituras iniciadas antes do commit podem terminar, mas a próxima operação deve falhar. Hoje `MEMBER`/`VIEWER` não têm escrita de produto autorizada: `rename` exige `OWNER`, que este recorte proíbe revogar. Portanto, as duas ordens de concorrência entre revogação pela API e escrita de produto do alvo continuam pendentes até existir essa escrita. Um laboratório com transação sintética pode verificar o mecanismo de bloqueio da revogação, sem ser apresentado como prova do fluxo de produto. Não adicionar bloqueio do household antes das memberships sem revisar a ordem dos caminhos existentes: `rename` já bloqueia membership antes de atualizar household, e inverter a ordem pode criar deadlock.

## Convite e papéis fora do recorte

Convite precisa de decisão própria sobre destinatário, aceite, entrega, prazo, cancelamento, replay, enumeração e revogação do emissor. Para o acesso privado atual, a candidata futura é convidar uma conta já provisionada para o papel inicial `VIEWER`, com aceite autenticado e token de uso único guardado como hash. A existência de `email_normalized` não prova controle verificado do e-mail. Link aceito por qualquer conta pode ser encaminhado; adicionar por e-mail sem aceite associa alguém sem consentimento. Nenhuma dessas candidatas está aprovada.

Promoção, downgrade, saída voluntária, reativação e remoção de `OWNER` também ficam pendentes. Antes de permitir duas remoções ou reduções concorrentes de `OWNER`, a regra de manter pelo menos um `OWNER` ativo precisa de serialização no nível do household; contar owners em transações separadas não basta. A futura decisão deve incluir recuperação quando o único owner perde acesso.

## Critério de aceite do incremento

- Dois usuários e dois households no PostgreSQL real com `prumo_app`: apenas `OWNER` lista e revoga membros do household selecionado; `MEMBER` e `VIEWER` não gerem membros, e ID de outro household não revela nem altera o alvo.
- `OWNER` não revoga a si nem outro `OWNER`; revogação repetida não duplica o evento. Falha injetada na auditoria reverte `active=false`.
- A sessão do alvo permanece válida, mas sua próxima consulta no household revogado falha. Uma transação sintética com `prumo_app` pode exercitar as duas ordens de bloqueio contra a revogação pela API, com limite de evidência explícito. A corrida entre alteração de nome por `OWNER` e revogação de outro membro não gera deadlock. A prova integral de escrita de produto do alvo versus revogação pela API fica para o incremento que autorizar uma escrita de `MEMBER`.
- OpenAPI, tipos da web, proteção de origem, respostas privadas, grants e auditoria são conferidos. O `reviewer` examina o diff e os testes após a implementação; o principal resolve achados antes de concluir o recorte.

## Próxima decisão: convite e aceite

**Evidência local em 2026-10-21:** migração `0007` aplicada no PostgreSQL local; os seis E2E de memberships passaram com a role da aplicação. O teste de rollback injeta uma falha de auditoria e espera `500`, sem desativar a membership; esse erro esperado aparece no log da execução. O build da API passou. O `reviewer` examinou migração, serviço, rotas, contrato e testes por leitura e não apontou defeito concreto. A revisão não executou os testes; a prova de escrita de produto por `MEMBER` permanece pendente pelo limite descrito acima.

O usuário aprovou o incremento pequeno de listagem/revogação com fixtures. Esta aprovação autoriza apenas suas migrações, rotas e testes locais; não aprova convites, mudança de papéis, RLS, recursos financeiros ou implantação externa. A próxima decisão de produto deve detalhar convite e aceite antes de implementar admissão de membros.

O `architect` analisou as alternativas em 2026-10-21. Na revisão independente da proposta, o `reviewer` identificou que não existe escrita de produto permitida a um alvo revogável neste recorte; o gate foi corrigido para separar o laboratório sintético da prova futura. Uma segunda leitura confirmou a correção, sem apontar inconsistências remanescentes. Essa revisão da proposta não substitui a revisão independente da implementação.

Conceitos para estudo: autorização por recurso, bloqueio de linha, ordem de locks, idempotência, trilha de auditoria, regra do último proprietário e enumeração de usuários. Ver [SEC-005](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-005---least-privilege-rbac-e-autorização-por-recurso) e [SEC-006](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-006---isolamento-entre-households-e-defense-in-depth).
