# ADR-029: isolamento técnico de households no primeiro fluxo

- **Status:** aceito para a baseline do primeiro fluxo; RLS pendente
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto e escopo

O primeiro fluxo da Sprint 5 consulta e altera contas, marcos, eventos financeiros, movimentos, revisões e saldos. Um usuário pode participar de mais de um household; IDs de contas, eventos ou categorias recebidos do cliente não demonstram acesso. As ADRs 007/017 exigem recursos do mesmo household, e o threat model identifica leitura ou escrita cruzada em TM-01/02/03. O Plano Mestre exige avaliar RLS, mas a stack, o banco e os papéis de autenticação ainda não foram escolhidos.

Esta decisão define a barreira mínima de isolamento para o primeiro fluxo e um gate para decidir a defesa adicional no banco. Não escolhe provedor de identidade, tipo de sessão, matriz de papéis, banco, ORM, esquema físico, storage de extratos ou desenho de jobs futuros.

## Alternativas

1. **Confiar no household selecionado pelo cliente ou num guard apenas na entrada da API.** Pouca repetição no código, mas um ID trocado ou uma consulta interna sem filtro pode alcançar outro household.
2. **Autorizar no backend, escopar todas as consultas e reforçar vínculos no banco** (baseline escolhida). Funciona sem depender de RLS, mas exige disciplina de repositório, integridade relacional e testes negativos amplos.
3. **Adicionar RLS imediatamente como única barreira.** Pode bloquear consulta sem filtro, mas depende da escolha de PostgreSQL, roles e contexto seguro no pool; não substitui permissão por ação nem autorização dos recursos.

## Decisão para o primeiro fluxo

Toda leitura ou mutação financeira parte de um **ator autenticado** e de um household para o qual o backend confirma membership ativa e permissão para a ação. O cliente pode indicar qual household deseja usar; essa indicação é somente um seletor, não prova de autoridade. O backend cria contexto autorizado para a operação e verifica, no momento da leitura ou confirmação da escrita, que **cada recurso** referenciado pertence àquele household. Falta de contexto, membership revogada, permissão insuficiente ou recurso de outro household falha de modo fechado, sem dados financeiros nem efeito parcial. A política exata de papéis e o mecanismo de sessão continuam pendentes; nenhum papel é presumido por esta ADR.

Consultas de contas, eventos, movimentos, saldo, histórico, reconciliação e revisões são escopadas pelo household autorizado **junto com** o ID ou filtro do recurso. Não oferecer uma leitura financeira por ID global sem escopo. Listas, agregações, contagens e resultados de busca também usam o mesmo contexto. Transferência exige origem e destino do mesmo household e moeda; retificação, vínculo de evidência e reembolso exigem escopo para todos os lados. Chave de idempotência e resultado de replay da ADR-027 pertencem ao mesmo contexto e não permitem consultar resultado de outro household.

A persistência do primeiro fluxo deve permitir verificar e reforçar a pertença dos vínculos financeiros ao household, com constraints ou mecanismo equivalente quando o banco for escolhido. Uma falha na autorização ou no vínculo invalida a confirmação inteira. Consultas e escritas usam a identidade de execução da aplicação, sem confiar em privilégio administrativo como caminho comum. A implementação deve documentar como o contexto autorizado passa da API ao repositório e como operações internas evitam perdê-lo; a representação física e os tipos de constraint dependem da stack.

Se uma membership for revogada, a próxima operação protegida não pode usar permissão antiga apenas por existir sessão ou cache. Escritas concorrentes à revogação precisam ter ordem de autorização verificável: a escrita só pode confirmar se ainda havia permissão no seu ponto de confirmação; não se pressupõe que uma checagem antiga no controller basta. A estratégia de sessão, cache, transação e bloqueio será detalhada com autenticação e banco. A resposta a acesso negado não deve revelar saldo, descrição ou existência de recurso de outro household; código HTTP e mensagem final ficam para o contrato da API.

## Gate para RLS e stack

Esta ADR **não aprova nem rejeita RLS**. Quando o banco e o modo de conexão forem escolhidos, executar o laboratório DB-008 do Plano de Estudos com a mesma role usada pela aplicação, dados A/B e pool real ou equivalente. Verificar SELECT, INSERT, UPDATE e DELETE cruzados; comportamento de owner/bypass, contexto por conexão/transação, reuso de conexão e jobs administrativos. Registrar em ADR complementar a escolha de adotar RLS ou não, seus limites e a evidência dos testes **antes de abrir dados financeiros a usuários externos**. Se a stack escolhida não oferecer RLS equivalente, documentar a defesa alternativa e seus testes. A aprovação desta baseline não dispensa esse gate.

## Exemplos e critérios de verificação

- Ator com acesso somente a A tenta consultar ou corrigir conta, transação, histórico ou revisão de B usando seus IDs: nenhum dado de B é retornado e nenhuma escrita é confirmada. Listagem e soma de saldos de A não incluem B.
- Transferência usa origem de A e destino de B: a operação inteira falha. A origem não sofre débito; B não recebe crédito; nenhuma chave de idempotência de A autoriza recurso de B.
- Ator com membership em A e B seleciona A: só recursos de A podem compor aquela operação. Selecionar B exige novo contexto autorizado; o fato de pertencer a ambas não permite transferência entre households pela ADR-007.
- Membership de A é revogada enquanto a sessão continua válida: a próxima leitura e a próxima escrita em A são negadas. Uma escrita concorrente à revogação só confirma se a ordem transacional demonstra autorização ainda válida no momento da confirmação.
- Um teste de repositório com a role de execução da aplicação tenta vincular um movimento de A a evento ou conta de B: o vínculo é rejeitado. Se RLS for aprovado depois, a suíte repetirá leituras e escritas A/B no banco com contexto de tenant e conexões reutilizadas.

## Consequências e pendências

A baseline exige escopo em cada caminho de dados e testes de integração com dois households, inclusive leituras agregadas, revisão e replay de pedidos. O ganho é reduzir acesso cruzado sem depender de tecnologia ainda não escolhida; o custo é manter política, repositórios e constraints coerentes. Permanecem pendentes: autenticação, papéis e permissões por ação; escolha da stack e do banco; resultado do laboratório e ADR de RLS; mecanismo de revogação e concorrência; esquema físico, contratos da API e isolamento de arquivos/jobs das fases futuras. Nenhum controle fica marcado como implementado apenas pela aprovação documental.

## Conceitos para estudo

Autenticação versus autorização, membership, contexto de tenant, IDOR/BOLA, escopo de consulta, integridade referencial, falha fechada, revogação e RLS como defesa em profundidade.
