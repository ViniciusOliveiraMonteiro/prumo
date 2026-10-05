# Plano de desenvolvimento

## Como usar

Este é o quadro de execução do Prumo, não uma segunda especificação. Produto e regras de negócio vêm do `PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md`; a trilha de aprendizado vem do `PLANO_DE_ESTUDOS_APLICADO.md` e do `CADERNO_DE_ESTUDOS_APLICADO.md`; decisões arquiteturais aprovadas ficam em `docs/decisions/`.

Cadência inicial: sprints de **duas semanas**, ajustável após a primeira retrospectiva. Cada sprint tem um objetivo demonstrável e um gate de saída. Trabalho não concluído volta ao backlog, sem marcar como pronto por calendário. Manter no máximo uma entrega principal em andamento por vez; usar subagentes quando agregarem valor real.

Fluxo por sprint: planejar e definir critérios → estudar/prototipar o conceito necessário → implementar → testar → demonstrar → revisar riscos e aprendizado → atualizar a documentação no ponto correspondente. Toda decisão ou etapa concluída deve atualizar este quadro e, quando aplicável, Plano Mestre, ADR, documentação de domínio ou guia operacional na mesma mudança.

Manter apenas a documentação Markdown durante o desenvolvimento; gerar PDF somente mediante pedido explícito.

**Definição de pronto:** comportamento demonstrável; verificações relevantes passando; contratos e riscos revisados; decisão e trade-offs documentados; conceitos aprendidos registrados; nenhuma pendência apresentada como concluída. Uma sprint de estudo é pronta quando seus exemplos e decisões podem ser explicados e verificados, mesmo sem código.

Status: `a fazer`, `em andamento`, `bloqueado`, `concluído`. O plano usa ordem de dependência; número de sprint não é promessa de data.

## Estado atual

- **Concluído:** Sprint 0, preparação do workspace; a integração Docker Desktop ↔ WSL 2 foi validada.
- **Em andamento:** Sprint 1, modelo financeiro e segurança inicial.
- **Concluído:** `prumo-web/` e `prumo-api/` criados; decisão pelo monorepo registrada em `docs/decisions/ADR-001-monorepo.md`; inventário básico de ferramentas realizado.
- **Concluído:** Git inicializado pelo usuário na raiz, branch `main`; os dois diretórios de aplicação pertencem ao mesmo repositório. README da raiz, `.gitignore` básico e commit inicial criados.
- **Concluído:** `main` publicada em `git@github.com:ViniciusOliveiraMonteiro/prumo.git` e acompanhando `origin/main`. Em 2026-10-05, o teste `ssh -T` autenticou no GitHub com `SSH_AUTH_SOCK` explícito; `git ls-remote` confirmou acesso ao repositório e a API pública do GitHub retornou `404`, evidência de que ele não está público. A variável não está definida por padrão nesta sessão.
- **Ferramentas encontradas em 2026-10-05:** Git 2.43.0, Node 24.21.0, npm 11.19.0, Corepack 0.36.0 e pnpm 12.8.1. `psql` não está instalado nesta distro WSL 2. A presença de pnpm não constitui decisão de gerenciador de pacotes.
- **Serviços locais:** o usuário já usa Docker Desktop no Windows. Em 2026-10-05, `docker info` nesta distro WSL 2 respondeu com servidor 29.8.1 após ativar a integração WSL. Não foi instalado outro Docker Engine/CLI na distro.
- **Código de produto:** ainda não iniciado. A fase A do Plano de Estudos exige definição de domínio, segurança e arquitetura antes do bootstrap.
- **Sprint 1 em estudo:** exemplos reproduzíveis de transferência, saldo inicial, compra/pagamento de cartão, parcelas, reembolso e estorno em `docs/domain/financial-examples.md`. A regra principal de competência da compra no cartão foi aprovada; rateio, ajustes e casos detalhados ainda são pendências.
- **Decisões aprovadas:** BRL em centavos inteiros com moeda explícita (ADR-006); saldo inicial datado e posterior derivado (ADR-016); compra de consumo integralmente no mês da compra, com parcelas/caixa em visão separada (ADR-008); `Transaction` como evento e transferência com dois movimentos opostos e atômicos (ADR-007). Alternativas e pendências estão em `docs/domain/model-proposals.md` e `docs/domain/transaction-model-proposal.md`.
- **Glossário inicial:** conceitos centrais e limites ainda pendentes em `docs/domain/glossary.md`.
- **ADR-007 aceita para o núcleo:** alternativas e exemplo de `Transaction`/transferência em `docs/domain/transaction-model-proposal.md`; estrutura física e demais eventos ainda pendentes.
- **Segurança em estudo:** threat model inicial com fronteiras, ameaças e verificações candidatas em `docs/security/threat-model.md`; controles ainda não implementados.

## Sprint 0 — Ambiente e organização

**Objetivo:** deixar o workspace e o fluxo de trabalho prontos, sem escolher stack por acidente.

| Item | Status | Aceite |
|---|---|---|
| Criar `prumo-web/` e `prumo-api/` na pasta pai | concluído | Diretórios e READMEs existem. |
| Registrar estratégia de monorepo | concluído | ADR-001 e Plano Mestre coerentes. |
| Inventariar ferramentas locais | concluído | Versões e ausências registradas acima. |
| Inicializar um único Git na raiz | concluído | `git rev-parse --show-toplevel` aponta para a pasta pai a partir da raiz, de `prumo-web/` e de `prumo-api/`. |
| Escolher estratégia de serviços locais | concluído | Usar Docker Desktop existente, sem instalação na distro. |
| Validar integração Docker Desktop ↔ esta distro WSL 2 | concluído | `docker info` retornou a versão 29.8.1 do servidor nesta distro WSL 2. |
| Preparar baseline do repositório | concluído | README, `.gitignore` e commit inicial criados; PDFs de referência da raiz ficam locais, com Markdown como fonte mantida. |
| Publicar repositório privado no GitHub | concluído | `main` publicada em `origin` e sem acesso pela API pública; o push funcionou com `SSH_AUTH_SOCK` explícito. |

**Demo/gate:** mostrar a estrutura, a ADR e o inventário; comprovar Git da raiz e caminho para serviços locais antes de seguir para bootstrap. As decisões de domínio podem avançar enquanto o ambiente de serviços locais é definido.

## Sprint 1 — Modelo financeiro e segurança inicial

**Objetivo:** explicar com exemplos como o sistema representa dinheiro e evita dupla contagem.

**Backlog:** DOM-001 a DOM-005, DB-002, SEC-001 e SEC-002; glossário e casos de uso prioritários; exemplos de transferência, compra no cartão, pagamento da fatura, parcelas, saldo inicial, reembolso e estorno; esboço de Household/Transaction; ADRs de Money e cartão/fatura; threat model inicial.

**Gate:** regras e exemplos reproduzíveis, dúvidas explicitadas, ADRs necessárias aprovadas e nenhuma regra financeira crítica decidida só pelo código. Referências: Plano Mestre, seções 7–10 e 66; Plano de Estudos, fase A.

**Aceite parcial:** exemplos aritméticos e invariantes de BR-001 a BR-003 em `docs/domain/financial-examples.md`; ADR-006, ADR-007, ADR-008 e ADR-016 aceitas para o núcleo acordado, com limites de escopo explícitos. Ainda falta converter os exemplos em testes quando houver código e fechar as regras pendentes.

**Outro artefato em estudo:** glossário inicial em `docs/domain/glossary.md`, com a estrutura física de `Transaction` e regras de competência ainda pendentes.

**Próxima ação da Sprint 1:** detalhar os eventos de receita/despesa e sua relação com movimentos, aprofundar regras de fatura e reconciliação, preparar casos de uso e revisar o threat model inicial. Desenhar ERD só após resolver os limites necessários de cada operação.

## Sprint 2 — Arquitetura e escolhas tecnológicas

**Objetivo:** selecionar a stack mínima necessária para construir o primeiro fluxo completo.

**Backlog:** avaliar frontend, backend, banco, ORM, autenticação, contrato da API e gerenciador de pacotes; desenhar arquitetura de alto nível e limites entre `prumo-web/` e `prumo-api/`; registrar ADRs das escolhas e das alternativas rejeitadas; definir como os documentos e contratos serão validados no monorepo.

**Gate:** decisões `NÃO DEFINIDO` que bloqueiam o bootstrap resolvidas; arquitetura base, segurança e contratos explicáveis; comandos de criação dos projetos definidos. Next.js, NestJS, PostgreSQL e pnpm continuam hipóteses até este gate.

## Sprint 3 — Bootstrap de engenharia

**Objetivo:** executar frontend e backend mínimos com verificações reproduzíveis.

**Backlog:** scaffolding conforme ADRs; lint, format, typecheck e testes; configuração local sem segredos no repositório; banco e migração inicial; CI; Docker Compose se aprovado/viável; teste de integração com PostgreSQL real. Referência: Plano de Estudos, fase B.

**Gate:** outra pessoa consegue preparar o ambiente e rodar os checks documentados; pipeline valida ambos os diretórios; nenhuma feature financeira foi simulada como pronta.

## Sprint 4 — Identity e Household

**Objetivo:** autenticar usuário e impor limites de acesso a um household.

**Backlog:** identidade, sessão, membership, autorização no backend e testes de isolamento entre households; política mínima de dados e auditoria. Referência: Plano de Estudos, fase C.

**Gate:** operações cruzadas entre households são negadas em testes e a estratégia de autenticação está documentada.

## Sprint 5 — Contas e transações

**Objetivo:** registrar e consultar entradas, saídas e transferências sem distorcer saldos.

**Backlog:** contas, saldo inicial, transações manuais, categorias básicas, transferência interna, API e telas correspondentes; testes de regras financeiras e integração. Referência: Plano de Estudos, fase D.

**Gate:** fluxo completo front → API → banco; transferência não aparece como renda ou despesa; saldo e filtros batem exemplos documentados.

## Sprint 6 — Cartões e parcelamentos

**Objetivo:** representar compra, parcelas, fatura e pagamento sem dupla contagem.

**Backlog:** modelo e API de cartão, fechamento/visualização de fatura, compras parceladas e interface; cenários de arredondamento, vencimento e estorno. Referência: Plano de Estudos, fase E.

**Gate:** exemplos da ADR de cartão/fatura passam em testes e são demonstráveis na interface.

## Sprint 7 — Importação de dados

**Objetivo:** importar extratos com revisão e deduplicação verificável.

**Backlog:** formatos do MVP, staging, normalização, prévia, confirmação, idempotência, tratamento de erros e processamento assíncrono apenas se houver caso real. Referência: Plano de Estudos, fase F.

**Gate:** reimportar o mesmo arquivo não duplica lançamentos; falhas são recuperáveis e a origem de cada dado é rastreável.

## Sprint 8 — Análises e fechamento do MVP

**Objetivo:** fechar um mês de uso real com números explicáveis.

**Backlog:** dashboard e indicadores determinísticos, orçamentos e metas do escopo MVP, exportação, acessibilidade/responsividade, revisão de segurança e desempenho. Referência: Plano de Estudos, fase G e Plano Mestre, objetivos do MVP.

**Gate:** usuário consegue executar o ciclo mensal prioritário; cada métrica remete a fórmula, período e dados de origem; testes de regressão passam.

## Sprint 9 — Operação e IA controlada

**Objetivo:** preparar operação segura; introduzir IA somente após os cálculos determinísticos e a política de dados estarem validados.

**Backlog:** staging, observabilidade, backup/restore, deploy e rollback; depois, avaliar caso de uso de IA sobre tools e dados calculados, com consentimento e limites documentados. Referência: Plano de Estudos, fases H e I.

**Gate:** ambiente de staging e recuperação testados; qualquer recurso de IA tem fonte de dados, restrições e avaliação documentadas. Dividir esta sprint se o trabalho exceder sua capacidade.

## Próxima ação

Na Sprint 1, detalhar os eventos de receita/despesa e os efeitos de cartão sobre o modelo da ADR-007; preparar casos de uso e esboço conceitual de Household/Transaction, além de revisar `docs/security/threat-model.md`. Tratar rateio, orçamento mensal, detalhes de fatura e reconciliação como pendências. Configurar `SSH_AUTH_SOCK` de modo persistente se forem necessários novos comandos Git remotos.
