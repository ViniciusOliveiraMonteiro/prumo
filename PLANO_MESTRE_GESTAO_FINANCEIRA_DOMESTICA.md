---
title: "Plano Mestre de Produto, Arquitetura e Desenvolvimento"
subtitle: "Plataforma de Inteligência Financeira Doméstica"
author: "Documento de projeto"
date: "05 de outubro de 2026"
lang: pt-BR
geometry: margin=2.1cm
fontsize: 10.5pt
---

# Mapa do documento

Este plano está organizado para acompanhar a evolução real do produto:

1. **Produto e domínio** - visão, objetivos, atores, household, regras financeiras, casos de uso e indicadores.
2. **Arquitetura de aplicação** - frontend, backend, banco, contratos, isolamento, jobs, eventos e storage.
3. **Dados e inteligência** - importação, analytics, insights, IA, projeções e integrações futuras.
4. **Segurança e operação** - autenticação, autorização, threat model, privacidade e observabilidade.
5. **Engenharia** - testes, ambiente local, migrations, dados de demonstração e design system.
6. **Codex e documentação viva** - regras de atuação, AGENTS.md, tarefas e ADRs.
7. **Entrega** - CI, CD, ambientes, containers, infraestrutura, backups e releases.
8. **Escala e custos** - performance, testes de carga, evolução e controle de custo.
9. **Roadmap** - sequência completa da modelagem ao dogfooding em produção.
10. **Decisões abertas** - backlog explícito de assuntos ainda não definidos para debate.

# 1. Propósito deste documento

Este documento define como o projeto deve ser pensado, modelado, implementado, testado, documentado, implantado e operado. A intenção é tratar a aplicação como um produto real, utilizado no dia a dia, e simultaneamente como evidência de capacidade fullstack.

O projeto será uma **plataforma de inteligência financeira doméstica**: um sistema capaz de consolidar receitas, despesas, contas, cartões, compromissos recorrentes, metas e patrimônio de uma residência; calcular indicadores e projeções; detectar tendências e anomalias; e produzir insights explicáveis sobre a situação financeira do household.

A implementação **não começa pelo código**. Ela começa por definição de produto, vocabulário, regras de negócio, modelos, limites, segurança e arquitetura. O código deve ser consequência dessas decisões. Isto reduz o risco de construir rapidamente a solução errada, uma habilidade que a indústria já domina sem nossa ajuda.

## 1.1 Objetivo profissional

Ao final, o projeto deve demonstrar experiência prática em:

- descoberta e modelagem de produto;
- modelagem de domínio financeiro;
- Next.js e arquitetura frontend;
- NestJS e arquitetura backend;
- APIs e contratos;
- PostgreSQL e modelagem relacional;
- autenticação e autorização;
- isolamento entre households;
- processamento assíncrono;
- importação e normalização de dados;
- cálculos, agregações e analytics;
- arquitetura orientada a eventos quando houver motivo;
- uso controlado de IA e agentes;
- segurança e privacidade de dados financeiros;
- testes unitários, integração e E2E;
- observabilidade;
- CI/CD;
- deploy e operação em produção;
- documentação viva;
- colaboração com Codex orientada por especificação.


## 1.2 Ecossistema de documentação e aprendizado

Este Plano Mestre orienta produto, domínio, requisitos e roadmap. As decisões delimitadas ficam em ADRs; código e testes mostram o comportamento implementado. O repositório mantém também:

```text
docs/
  README.md              # índice da documentação
  application/           # guia e estado da aplicação
  planning/              # sprints e critérios de aceite
  operations/            # execução e evidências técnicas
  decisions/             # ADRs aceitas e propostas
  domain/                # exemplos e modelos conceituais
  security/              # ameaças e controles
  collaboration/         # organização de agentes
  documentation/         # regras de manutenção dos documentos
```

A regra de uso é:

```text
requisito/risco identificado
        -> tópico de estudo
        -> laboratório
        -> discussão de alternativas
        -> ADR quando houver decisão
        -> implementação
        -> testes
        -> observabilidade/runbook quando aplicável
```

IDs como `SEC-*`, `DB-*`, `BACK-*`, `DEV-*`, `OBS-*`, `ARCH-*`, `AI-*`, `TEST-*` e `DOM-*` apontam para o Plano de Estudos Aplicado. O objetivo é evitar que termos técnicos apareçam neste documento como se já fossem conhecimento implícito.

O [índice de `docs/`](docs/README.md) aponta para os documentos atuais. O [guia de manutenção](docs/documentation/GUIA_DE_MANUTENCAO.md) define a fonte principal por assunto, a atualização na mesma mudança e a revisão de referências. O Plano de Estudos Aplicado e o Caderno de Estudos Aplicado permanecem na raiz.

# 2. Convenção de status das decisões

Nenhuma decisão pendente deve ficar escondida em texto ambíguo. Todos os pontos arquiteturais relevantes devem receber um status.

| Status | Significado |
|---|---|
| **DEFINIDO** | Já existe decisão suficientemente madura para orientar implementação. |
| **NÃO DEFINIDO** | A decisão precisa ser discutida antes de a área correspondente ser implementada. |
| **HIPÓTESE** | Existe uma direção recomendada, mas ela ainda precisa ser validada. |
| **EXPERIMENTO** | Será criada uma prova técnica antes da decisão definitiva. |
| **FUTURO** | Está fora do escopo atual, mas foi registrado para não ser esquecido. |

Quando uma decisão mudar, o documento e o ADR correspondente devem ser atualizados no mesmo pull request.

# 3. Resumo das decisões atuais

| Tema | Status | Direção atual |
|---|---|---|
| Nome do projeto | DEFINIDO | Prumo. |
| Marca | DEFINIDO | “Inteligência financeira para colocar sua casa no eixo.” |
| Aplicações | DEFINIDO | Interface em `prumo-web/` e API em `prumo-api/`. |
| Produto | DEFINIDO | Gestão e inteligência financeira de um household. |
| Público inicial | DEFINIDO | Uso pessoal/familiar; não produto B2B no MVP. |
| Frontend | DEFINIDO | Next.js com App Router + TypeScript; ver ADR-030. |
| Backend | DEFINIDO | NestJS + TypeScript em monólito modular; ver ADR-030. |
| Banco | DEFINIDO | PostgreSQL; RLS ainda pendente; ver ADR-030. |
| Gerenciador de pacotes | DEFINIDO | pnpm workspaces na raiz, lockfile único; ver ADR-030. |
| ORM | DEFINIDO | Drizzle com driver PostgreSQL, migrações SQL versionadas e transações explícitas; ver ADR-031. |
| Custo inicial | DIRETRIZ | Priorizar software livre e serviços sem cobrança obrigatória; estimar hospedagem e operação antes de abrir usuários externos. |
| Monorepo | DEFINIDO | Um repositório na pasta pai, com `prumo-web/` e `prumo-api/`; ver ADR-001. |
| Money no MVP | DEFINIDO | BRL em centavos inteiros com moeda explícita, sem conversão cambial; ver ADR-006. |
| Saldo de conta | DEFINIDO para o núcleo | Marco inicial datado e saldo posterior derivado; reconciliação mostra diferenças; ver ADR-016. |
| Cartão no relatório principal | DEFINIDO para compras de consumo | Despesa integral na data da compra; atribuição automática ao ciclo pelo fechamento configurado, corrigível sem alterar o mês da despesa; pagamento parcial admitido no MVP; ver ADR-008. |
| Transaction/transferência | DEFINIDO para o núcleo | `Transaction` é evento do household; transferência interna tem dois movimentos vinculados, opostos e atômicos; ver ADR-007. |
| Receita/despesa comum e passivo do cartão | DEFINIDO para o núcleo | Classificação econômica pelo evento; receita recebida entra no mês em que o dinheiro chega; despesa de consumo paga diretamente entra no mês em que o dinheiro sai da conta; obrigação própria do cartão vinculada aos eventos; ver ADR-017. Operações não liquidadas e estrutura física pendentes. |
| Cache | NÃO DEFINIDO | Redis apenas quando existir caso real. |
| Jobs | HIPÓTESE | BullMQ + Redis para imports, recalculações e tarefas assíncronas. |
| Event streaming | NÃO DEFINIDO | Kafka não entra inicialmente; avaliar somente mediante lacuna concreta. |
| Autenticação | DEFINIDO para primeiro acesso web privado | ADR-033 aceita autoridade no NestJS e sessão revogável em PostgreSQL; ADR-037 aprova identidade mínima e provisionamento local. Login básico foi implementado, com gates de segurança ainda pendentes. |
| Topologia web/API no navegador | DEFINIDO para primeiro acesso web privado | ADR-034 aceita origem única, com páginas no Next.js e `/api` na API NestJS; hospedagem e proxy de implantação seguem pendentes. |
| Multi-user | DEFINIDO conceitualmente; recortes locais aprovados | Household + memberships. A [ADR-041](docs/decisions/ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado) aprova criação, leitura de membership própria e alteração de nome por `OWNER`; a [ADR-042](docs/decisions/ADR-042-minimal-membership-management-proposal.md#matriz-mínima-aprovada) aprova listagem e revogação de membros existentes por `OWNER`, ambos validados no PostgreSQL local. A [ADR-043](docs/decisions/ADR-043-household-invitation-acceptance-proposal.md#recorte-privado-aprovado) aprova convite privado por UUID e aceite autenticado para `VIEWER`; a [ADR-044](docs/decisions/ADR-044-email-invitation-acceptance-proposal.md#direção-aprovada) aprova a direção de aceite por código enviado ao e-mail verificado de uma conta existente. A [ADR-045](docs/decisions/ADR-045-verified-email-lifecycle-proposal.md#problema-e-decisões-delimitadas) aprova primeira verificação por código na sessão, troca de endereço nunca verificado com senha e prova do novo, confirmação dos dois endereços ao trocar um já verificado e bloqueio da troca quando o antigo verificado foi perdido. Protocolo e parâmetros da ADR-045 foram aprovados; transporte externo, esquema físico e exceção para perda do canal seguem pendentes. Troca de papéis e papéis financeiros também permanecem pendentes. |
| Infra cloud | NÃO DEFINIDO | Comparar Vercel + provedor backend vs cloud unificada para produção. A [ADR-040](docs/decisions/ADR-040-staging-gate-infrastructure-proposal.md#alternativas) propõe opções apenas para um futuro gate de staging, sem implantar ou definir provedor. |
| Observabilidade | HIPÓTESE | OpenTelemetry + error tracking + logs estruturados. |
| IA | DEFINIDO conceitualmente | Não é fonte de verdade; opera sobre tools e dados calculados. |
| Open Finance | FUTURO | Integração posterior, após MVP e validação de requisitos/regulação. |
| Mobile nativo | FUTURO | Web responsiva/PWA primeiro. |

# 4. Visão do produto

**Marca:** Prumo — “Inteligência financeira para colocar sua casa no eixo.”

## 4.1 Problema

Dados financeiros de uma casa costumam ficar fragmentados entre bancos, cartões, planilhas, aplicativos, faturas, investimentos e memória humana. Mesmo quando os dados estão disponíveis, compreender tendências, capacidade de poupança, compromissos futuros, nível da reserva de emergência e categorias que pressionam o orçamento exige trabalho manual.

O produto pretende transformar movimentações financeiras em uma visão coerente da residência.

## 4.2 Proposta de valor

A aplicação deve responder perguntas como:

- Quanto a casa custa por mês?
- Qual a média das despesas essenciais?
- Quais categorias mais cresceram?
- Quanto da renda está comprometido com custos recorrentes?
- Qual a taxa de poupança atual?
- Qual seria uma meta de reserva de emergência baseada nos critérios configurados pelo usuário?
- Qual o efeito das compras parceladas nos próximos meses?
- Quais assinaturas representam maior custo anual?
- O orçamento está sendo respeitado?
- Há transações incomuns?
- Como a distribuição patrimonial atual se compara às metas definidas pelo próprio usuário?
- O fluxo de caixa projetado para os próximos meses é positivo ou negativo?

## 4.3 Princípio fundamental

A aplicação **não deve se posicionar como consultor financeiro autônomo**. Indicadores, simulações e comparações serão baseados em regras explícitas e parâmetros do usuário. Recomendações de alocação de investimento não devem ser inventadas pela IA.

Quando houver sugestão, o sistema deve distinguir claramente:

- fato observado;
- cálculo determinístico;
- projeção;
- hipótese;
- explicação gerada por IA;
- preferência configurada pelo usuário.

# 5. Objetivos e não objetivos

## 5.1 Objetivos do MVP

O MVP deve permitir uso real mensal.

Deve incluir:

- criação de household;
- membros do household;
- contas financeiras;
- cartões de crédito;
- categorias e subcategorias;
- lançamento manual de transações;
- importação CSV/OFX ou formato equivalente selecionado;
- normalização e deduplicação;
- receitas e despesas;
- transferências internas;
- transações recorrentes;
- compras parceladas;
- orçamento por categoria;
- visão mensal;
- indicadores de receitas, despesas e poupança;
- cálculo configurável de reserva de emergência;
- insights determinísticos básicos;
- auditoria mínima;
- exportação dos próprios dados;
- ambiente de staging e produção;
- CI/CD básico.

## 5.2 Não objetivos do MVP

Não fazem parte do MVP:

- executar pagamentos;
- movimentar dinheiro;
- recomendar ativos específicos;
- corretora integrada;
- conciliação bancária automática em tempo real;
- marketplace;
- contabilidade fiscal completa;
- folha de pagamento;
- integração oficial com Open Finance Brasil;
- microservices;
- Kafka;
- Kubernetes;
- aplicação mobile nativa.

Esses itens podem virar fases futuras somente se houver justificativa.

# 6. Métricas de sucesso do produto

Como o usuário inicial será o próprio desenvolvedor/household, métricas devem medir utilidade real, não vaidade.

## 6.1 Métricas de produto sugeridas

- tempo necessário para fechar o mês;
- percentual de transações classificadas corretamente sem intervenção;
- percentual de transações importadas sem duplicidade;
- quantidade de correções manuais de categoria;
- tempo entre importação e dashboard atualizado;
- número de insights considerados úteis;
- frequência mensal de uso;
- diferença entre projeção e realizado;
- capacidade de explicar de onde cada indicador veio.

## 6.2 Métricas técnicas

- disponibilidade;
- P95 de endpoints principais;
- taxa de erro;
- duração de imports;
- profundidade de filas;
- falhas e retries de jobs;
- custo de infraestrutura;
- custo de IA por household/mês;
- cobertura dos fluxos críticos por testes.

# 7. Atores e modelo de household

## 7.1 User

Pessoa com identidade na plataforma.

Um usuário pode participar de um ou mais households.

## 7.2 Household

Unidade financeira principal do sistema.

Exemplos:

- uma pessoa morando sozinha;
- casal;
- família;
- residência compartilhada;
- household adicional utilizado para ajudar familiares.

O household funciona conceitualmente como o limite de isolamento dos dados.

## 7.3 Membership

Relaciona User e Household.

Papéis iniciais sugeridos:

- `OWNER`: controla configurações, membros e dados;
- `MEMBER`: cria e edita informações financeiras;
- `VIEWER`: somente leitura.

**Status: NÃO DEFINIDO** para granularidade final de permissões.

A [ADR-042](docs/decisions/ADR-042-minimal-membership-management-proposal.md#matriz-mínima-aprovada) aprova listagem e revogação de memberships existentes por `OWNER`; o recorte passou na validação local. A [ADR-043](docs/decisions/ADR-043-household-invitation-acceptance-proposal.md#recorte-privado-aprovado) aprovou convite e aceite privados por UUID para o papel inicial `VIEWER`. O usuário determinou [aceite por e-mail para a versão final](docs/decisions/ADR-043-household-invitation-acceptance-proposal.md#requisito-para-a-versão-final-aceite-por-e-mail), aprovou a [direção da ADR-044](docs/decisions/ADR-044-email-invitation-acceptance-proposal.md#direção-aprovada) para contas existentes e as [políticas da ADR-045](docs/decisions/ADR-045-verified-email-lifecycle-proposal.md#problema-e-decisões-delimitadas) para verificação, troca e bloqueio quando o endereço verificado foi perdido. Protocolo e parâmetros da ADR-045 foram aprovados; transporte externo, esquema físico e eventual exceção para perda do canal seguem pendentes. Troca de papéis e a matriz financeira não foram decididas.

Perguntas:

- O OWNER pode apagar definitivamente o household?
- Membros podem esconder contas pessoais de outros membros?
- Precisamos de contas privadas dentro de um household?
- Um futuro contador terá papel específico somente leitura?

Sugestão: começar simples com dados compartilhados dentro do household; privacidade por conta só deve ser adicionada se houver caso real.

# 8. Mapa de domínio

Contextos iniciais:

```text
Identity & Access
Household Management
Accounts
Transactions
Credit Cards
Categorization
Budgets
Recurring Commitments
Financial Goals
Emergency Fund
Assets & Investments
Liabilities
Imports
Insights & Analytics
AI Assistance
Audit
Notifications
Integrations
```

## 8.1 Glossário mínimo

### Account

Origem ou destino financeiro: conta corrente, poupança, carteira, dinheiro, conta de investimento etc.

### Transaction

Evento financeiro registrado para um household. Seus efeitos sobre saldos de contas ficam em movimentos vinculados; para transferência interna são exatamente dois movimentos opostos, conforme ADR-007. Receita/despesa comum é classificada pelo evento, e a obrigação do cartão é própria e vinculada aos eventos (ADR-017). A estrutura física ainda não foi definida.

### Expense

Saída econômica atribuível ao household.

**DEFINIDO para consumo pago diretamente por conta:** entra no relatório principal no mês em que o dinheiro sai da conta, mesmo que a compra tenha ocorrido no mês anterior (ADR-017). Compra de consumo no cartão segue a data da compra (ADR-008); seu pagamento não gera segunda despesa.

### Income

Entrada econômica atribuível ao household.

**DEFINIDO para receita comum recebida:** entra no relatório principal no mês em que o dinheiro chega, mesmo quando se refere a trabalho de mês anterior (ADR-017). Datas divergentes ou incompletas de movimentos de conta seguem a ADR-025; receita ainda não recebida e interpretação de rótulos por formato exigem regra futura.

**DEFINIDO para registro tardio de movimento de conta:** a data efetiva em que o dinheiro entrou ou saiu determina o saldo histórico e, para receita recebida ou despesa paga diretamente, o mês econômico. A data em que o fato foi registrado no Prumo permanece separada na trilha e não desloca o efeito nem o duplica (ADRs 016/017). A ADR-025 define o tratamento conceitual de datas divergentes ou incompletas; interpretação por formato continua pendente.

### Transfer

Evento que move valor entre duas contas distintas do mesmo household por dois movimentos vinculados, de mesma moeda e magnitude e sinais opostos. Não infla receitas nem despesas (ADR-007).

### Credit Card Purchase

Compra realizada por cartão. Precisa ser distinguida do pagamento da fatura para evitar contabilização dupla.

### Installment

Parcela de uma obrigação parcelada.

### Recurring Commitment

Despesa ou receita que tende a reaparecer segundo determinada frequência.

### Budget

Limite ou meta de gasto por período e categoria.

### Financial Goal

Objetivo financeiro definido pelo usuário.

### Emergency Fund

Conjunto de ativos marcado pelo usuário como reserva, comparado com uma meta calculada segundo parâmetros explícitos.

### Insight

Observação produzida a partir de regras ou análises do sistema.

# 9. Regras financeiras fundamentais

Antes do ERD, precisamos registrar invariantes.

## BR-001 - Transferência interna não é receita/despesa

Transferir R$ 1.000 da conta corrente para uma conta de investimento não significa gastar R$ 1.000 nem ganhar R$ 1.000.

**DEFINIDO no núcleo:** um evento `Transaction` de transferência confirmado liga dois movimentos de saldo que se anulam, com vínculo atômico e sem entrar em receita/despesa. Se a saída e a chegada ocorrerem em datas diferentes, cada conta reflete o movimento na própria data efetiva; a soma das contas diminui temporariamente entre elas e volta ao total após ambos os efeitos. Quando o par está confirmado, mostrar o valor em trânsito separadamente dos saldos das contas para conservar o consolidado patrimonial entre as datas, zerando-o na chegada, sem terceiro movimento de conta. Saída comprovada ainda sem chegada reduz o saldo da origem e fica visível em revisão, sem despesa, transferência confirmada ou posição em trânsito; mostrar subtotal das contas e débito pendente separados, com patrimônio afetado marcado incompleto, sem número definitivo. A confirmação posterior do par reutiliza o mesmo débito sem duplicá-lo (ADR-007). Correspondência operacional ainda exige regra.

## BR-002 - Pagamento de fatura não duplica despesa

Para compras de consumo, o relatório principal reconhece a despesa integral na data da compra (ADR-008). O pagamento da fatura representa redução de caixa e passivo, não nova despesa dessas compras. Parcelas e fluxo de caixa são visões separadas.

**DEFINIDO para o MVP:** pagamento parcial reduz caixa e passivo apenas pelo valor pago; o restante da obrigação continua em aberto. Entre faturas abertas do mesmo cartão com saldos individuais conhecidos, distribuir automaticamente o pagamento da mais antiga para a mais recente, pela data de fechamento, com correção rastreável sem alterar caixa, dívida total ou despesa. Se crédito aplicado não tiver fatura de destino confirmada e tornar incertos esses saldos, a ADR-023 mantém a alocação por fatura do pagamento em revisão, preservando a saída de caixa e a baixa da dívida total. Pagamento comum acima da dívida total aberta é recusado sem efeito parcial; se vier de importação, a linha fica sinalizada para revisão, sem gerar saldo credor automaticamente. Juros e tarifas são registrados somente pelo valor informado na fatura, como novos eventos de despesa que aumentam a obrigação no mês em que constam na fatura; o Prumo não calcula encargos automaticamente a partir do saldo aberto. Saldo credor futuro e categoria/correção dos encargos exigem regras próprias (ADR-008).

## BR-003 - Valores monetários não usam ponto flutuante binário

**DEFINIDO para o MVP:** valores monetários finais de conta, cartão e orçamento usam inteiros em centavos de BRL e carregam `currency = BRL` (ADR-006). Conversão entre moedas fica fora do MVP; cálculos intermediários com frações de centavo exigem precisão decimal exata e quantização documentada. O rateio das compras parceladas no cartão segue a ADR-008; outros rateios, tipo SQL, limite máximo e formato da API ainda serão definidos. Ponto flutuante binário não representa dinheiro no domínio.

## BR-004 - Categoria é dado de negócio

Alterar a categoria de uma transação pode alterar dashboards, budgets e insights. A alteração deve ser auditável quando relevante.

## BR-005 - Métricas precisam ser reproduzíveis

Todo indicador exibido deve ter fórmula documentada e dados de origem rastreáveis.

## BR-006 - Insight por IA não substitui cálculo

A IA pode explicar um cálculo, sugerir classificação ou resumir tendências. Não deve fabricar saldos, percentuais ou dados.

## BR-007 - Reserva de emergência é configurável

O produto não deve impor uma única fórmula universal.

Parâmetros possíveis:

- meses-alvo;
- período usado para média;
- quais categorias contam como essenciais;
- quais ativos contam como reserva.

## BR-008 - Investimentos são patrimônio, não recomendação

O sistema pode registrar classes de ativos e comparar distribuição real com metas do usuário, sem indicar ativos específicos como recomendação personalizada no MVP.

# 10. Casos de uso prioritários

## UC-001 - Criar household

```text
Usuário autenticado
  -> informa nome
  -> household criado
  -> membership OWNER criada
  -> categorias padrão opcionais criadas
  -> configurações iniciais criadas
  -> audit log registrado
```

## UC-002 - Criar conta

Dados mínimos propostos:

- nome;
- tipo;
- instituição opcional;
- moeda;
- saldo inicial e data de início;
- visibilidade/estado.

**DEFINIDO para saldo:** usar marco inicial no início da data informada e derivar o saldo dos movimentos conhecidos nessa data ou depois; reconciliação mostra diferenças sem ajuste automático. Movimento anterior ao marco fica pendente e só integra o histórico após a pessoa informar e justificar um marco anterior com saldo nessa data, preservando a trilha; o Prumo não presume o saldo anterior. Valor inicial errado pode ser corrigido após movimentos, com justificativa, trilha, recálculo dos saldos e revisão das divergências afetadas, sem criar receita, despesa ou transação. Data do marco informada cedo ou tarde demais pode ser corrigida para outra data com saldo informado nessa nova data, motivo e trilha, mesmo sem movimento anterior a incluir; movimentos que ficarem anteriores permanecem visíveis e pendentes, e os saldos são recalculados. Sem horário confiável, movimentos na mesma data são mostrados por sequência de registro estável e identificada, sem alegar cronologia real; o saldo final do dia independe da ordem. Consulta por data sem horário retorna o saldo ao fim do dia após todos os movimentos efetivos nessa data; antes do marco, mostra saldo não calculável e a data do marco, sem valor presumido (ADR-016). Distinção operacional entre datas dos movimentos e estrutura de persistência permanecem pendentes.

**DEFINIDO para datas da fonte em movimentos de conta:** a ADR-025 usa o dia em que o saldo da conta foi efetivamente afetado, guarda separadamente datas de ordem/compra, compensação e registro, e mantém em revisão alegações conflitantes ou sem dia suficiente, sem fabricar data ou duplicar movimento. Registro manual identifica a data informada pela pessoa; conflito posterior preserva o último efeito sustentado como contestado até revisão. Retificação financeira delimitada segue a ADR-026; correspondência por formato e horário confiável continuam pendentes.

**DEFINIDO para retificação financeira de movimentos de conta no primeiro fluxo:** a ADR-026 escolhe versões auditáveis do mesmo fato para correção de valor, conta, data e cancelamento. Somente a versão aceita vigente compõe saldo e período econômico; fontes, motivo e autoria permanecem na trilha. Transferência preserva o par íntegro ou o débito comprovado em revisão, sem duplicação. Idempotência e concorrência desse fluxo seguem a ADR-027; baseline de isolamento segue a ADR-029. Estrutura física e decisão de RLS continuam pendentes.

**DEFINIDO para idempotência e concorrência do primeiro fluxo:** a ADR-027 exige identidade persistente do pedido para retries, distinta da identidade do fato, e versão esperada para revisões concorrentes. Evento e efeitos são confirmados integralmente, com validações refeitas em estado coerente; pedido repetido não cria segundo efeito, e revisão baseada em versão vencida não é aplicada automaticamente. Saldo negativo de conta segue a ADR-028; tecnologia de lock, contrato físico e importação por formato continuam pendentes.

**DEFINIDO para saldo negativo de conta no primeiro fluxo:** a ADR-028 aceita fatos válidos mesmo quando o saldo derivado fica negativo, mostrando valor assinado, dias afetados e alerta de revisão sem presumir cheque especial, empréstimo, juros ou ajuste. Transferência confirmada conserva o par; saída sem chegada mantém patrimônio afetado incompleto conforme ADR-007. Saldo disponível bancário e obrigação de crédito ainda exigem regra própria.

**DEFINIDO para a baseline de isolamento técnico no primeiro fluxo:** a ADR-029 exige autorização do ator e membership ativa por operação, consultas e vínculos escopados ao household autorizado, confirmação íntegra e testes negativos A/B. RLS permanece hipótese a decidir em ADR após laboratório com banco, role e pool escolhidos, antes de dados financeiros de usuários externos. A decisão não define autenticação, papéis, stack ou esquema físico.

## UC-003 - Registrar transação manual

```text
selecionar conta
  -> informar data
  -> descrição
  -> valor
  -> tipo
  -> categoria
  -> merchant opcional
  -> tags/notas opcionais
  -> persistir
  -> atualizar agregados necessários
  -> avaliar insights derivados
```

## UC-004 - Importar extrato

```text
upload
  -> armazenar arquivo original
  -> criar ImportJob
  -> validar formato
  -> parsear
  -> normalizar
  -> detectar duplicidade
  -> sugerir categorias
  -> persistir staging
  -> revisão do usuário quando necessária
  -> confirmar import
  -> recalcular métricas
  -> registrar resultado
```

## UC-005 - Registrar compra parcelada

```text
compra total
  -> quantidade de parcelas
  -> cartão/conta
  -> data da compra
  -> regra de vencimento
  -> gerar cronograma
  -> refletir compromissos futuros
```

**NÃO DEFINIDO:** se cada parcela será uma `Transaction` futura, uma entidade `Installment`, ou projeção materializada separadamente.

## UC-006 - Fechar análise mensal

```text
selecionar mês
  -> receitas
  -> despesas
  -> categorias
  -> recorrências
  -> taxa de poupança
  -> comparação histórica
  -> reserva de emergência
  -> projeção futura
  -> insights
```

## UC-007 - Corrigir classificação

Correções manuais devem poder alimentar regras futuras de categorização.

## UC-008 - Exportar dados

O usuário deve conseguir exportar seus dados em formato documentado.

# 11. Módulos funcionais

## 11.1 Dashboard

Deve responder rapidamente:

- saldo consolidado selecionado;
- receitas do período;
- despesas do período;
- taxa de poupança;
- despesas essenciais;
- comprometimento recorrente;
- categorias principais;
- reserva de emergência;
- projeção curta;
- alertas/insights recentes.

## 11.2 Transações

Funcionalidades:

- listar;
- filtrar;
- buscar;
- criar;
- editar;
- dividir transação em categorias (fora do MVP; possibilidade futura sem compromisso de implementação);
- marcar transferência;
- marcar reembolso;
- anexar nota;
- associar merchant;
- visualizar origem do import.

**DEFINIDO para reembolso de compra de consumo paga diretamente:** criar evento vinculado à compra original e movimento de entrada na conta quando o dinheiro voltar. O valor atribuído como reembolso reduz a despesa na **categoria da compra original** e libera disponibilidade no orçamento dessa categoria no mês do recebimento, sem ser receita e sem reescrever despesa ou orçamento do mês da compra pelo recebimento. Compra de R$ 80 em Mercado reembolsada em R$ 20 mantém os R$ 80 no mês da compra e registra R$ −20 em Mercado no mês do recebimento. Se a categoria original for corrigida depois para Farmácia, reclassificar a compra em seu mês e o mesmo reembolso no mês do recebimento para Farmácia, recalculando os orçamentos sem alterar valores, datas, saldos ou totais mensais. A soma dos reembolsos parciais vinculados não pode superar o valor original pago (ADR-017). Demais reembolsos de compra no cartão ainda exigem decisão.

**DEFINIDO para entrada externa acima do saldo reembolsável de compra paga diretamente:** se a entrada de R$ 100 está comprovadamente ligada a compra ainda reembolsável em R$ 80, a conta aumenta R$ 100 uma vez; R$ 80 reduzem a despesa no mês do recebimento e R$ 20 ficam como entrada recebida sem classificação econômica definida para revisão. A parte excedente não vira receita automaticamente nem outro reembolso; a soma das partes deve igualar a entrada comprovada. Classificação posterior não repete o movimento de caixa. Sem vínculo confiável com a compra, a atribuição como reembolso fica em revisão; contrato físico e reconciliação dessa distribuição exigem detalhamento (ADR-017).

**DEFINIDO para consumo líquido negativo por reembolso direto:** manter a despesa e o consumo negativos visíveis, limitar o disponível ao orçamento mensal configurado e mostrar a parte negativa excedente em separado. Com orçamento `B` e consumo líquido `C`, disponível = `B − max(C, 0)` e, se `C < 0`, excedente = `−C`. Esse valor informativo não cria outra entrada na conta nem orçamento transportado automaticamente a outro mês. A regra acompanha o critério para estorno no cartão da ADR-018 (ADR-017).

**DEFINIDO para o MVP:** cada compra de consumo recebe uma única categoria, sem divisão do valor entre categorias. Uma compra de R$ 120 no mercado, mesmo com alimentos e itens de higiene, pode ser classificada integralmente como **Mercado**; fast food pode receber outra categoria. A escolha ou correção da categoria é do usuário; este exemplo não define a lista completa de categorias nem classificação automática pelo estabelecimento. Divisão por itens ou categorias fica fora do MVP, sem compromisso de implementação futura.

## 11.3 Categorias

Hierarquia sugerida:

```text
Saúde
  Farmácia
  Consultas
  Plano de saúde

Moradia
  Aluguel
  Condomínio
  Energia
```

Perguntas:

- categorias são exclusivas do household?
- existem categorias padrão imutáveis?
- exclusão é permitida se houver histórico?

Sugestão: household possui categorias próprias, podendo nascer de um template.

## 11.4 Orçamentos

Permitir metas por:

- categoria;
- mês;
- eventualmente recorrência.

**DEFINIDO para o MVP:** orçamento é referência visual com alerta, sem bloquear registro de compra que ultrapasse o valor planejado. Mostrar o consumo e o excedente ao usuário. Regras de categorias e eventuais alertas adicionais ainda exigem detalhamento.

**DEFINIDO para compra de consumo no cartão:** o valor integral consome o orçamento mensal do mês da compra, acompanhando a despesa reconhecida. Parcelas em faturas futuras e pagamento não consomem o mesmo orçamento novamente; compromissos e caixa aparecem em visão separada (ADR-008).

## 11.5 Recorrências

O sistema poderá detectar ou cadastrar explicitamente:

- salário;
- aluguel;
- escola;
- academia;
- streaming;
- seguros;
- assinaturas anuais.

## 11.6 Cartões

Precisamos modelar:

- cartão;
- limite opcional;
- dia de fechamento;
- dia de vencimento;
- compras;
- parcelas;
- fatura;
- pagamento.

**DEFINIDO para reconhecimento:** compra de consumo entra integralmente no relatório principal na data da compra; parcelas/faturas são compromissos e saídas de caixa em visão separada, sem duplicar despesa (ADR-008).

**DEFINIDO para rateio e ciclos das parcelas:** dividir o total da compra em centavos inteiros igualmente entre as parcelas e atribuir os centavos restantes às primeiras. Em compra positiva, a quantidade de parcelas deve ser positiva e não pode superar o total em centavos; rejeitar parcelamento que geraria R$ 0,00 em alguma parcela. A primeira parcela entra no ciclo atribuído à compra; as demais, nos ciclos mensais consecutivos. O usuário pode corrigir valores e ciclos para refletir o emissor, preservando parcelas positivas, a soma, o vínculo com a compra, o histórico da correção e a despesa original (ADR-008).

**DEFINIDO para pagamento parcial:** o MVP permite registrar valor pago inferior à obrigação; reduz caixa e dívida por esse valor, sem repetir a despesa da compra (ADR-008).

**DEFINIDO para encargos:** juros e tarifas informados na fatura entram como novos eventos de despesa no mês dessa fatura e aumentam a dívida; não há cálculo automático de encargos sobre o saldo em aberto (ADR-008).

**DEFINIDO para atribuição de compras:** usar automaticamente a data da compra e o dia de fechamento configurado do cartão para escolher o ciclo da fatura. Quando o dia configurado não existir no mês, usar o último dia desse mês como fechamento previsto (dia 31 → 28 ou 29 de fevereiro). Compra no próprio dia de fechamento previsto ou depois dele entra no ciclo seguinte, pois o horário de corte do emissor não é conhecido. O usuário pode corrigir a atribuição quando a fatura real divergir, preservando rastreabilidade e sem alterar o mês da despesa (ADR-008).

**DEFINIDO para vencimento previsto:** configurar um dia de vencimento por cartão. Em cada mês candidato, se esse dia não existir, usar o último dia do mês; escolher a primeira data candidata estritamente após o fechamento previsto e permitir correção rastreável quando o emissor informar outra data (ADR-008). Fechamento em 05/02 com dia de vencimento 12 prevê 12/02; com dia 3 prevê 03/03. Fechamento em 31/01 com dia de vencimento 31 prevê 28 ou 29/02.

**DEFINIDO para reconciliação do cartão:** comparar dívida calculada e posição do emissor em data de corte e escopo compatíveis; mostrar valores, diferença e fontes para revisão. Divergência sozinha não cria encargo, crédito ou ajuste automático. Sem causa identificada, ela permanece visível e o MVP não oferece ajuste manual genérico para igualar os saldos. A causa identificada pode ser registrada como evento rastreável (ADR-008).

**DEFINIDO para estorno de compra de consumo no cartão ainda não paga:** quando o emissor confirma e aplica o crédito à obrigação aberta da própria compra, um novo evento vinculado reduz dívida e despesa no mês da aplicação e libera o orçamento desse mês. A compra e o orçamento de seu mês original permanecem registrados; não há movimento de conta nem receita. A soma dos estornos não supera o valor original nem a obrigação aberta associada. Crédito pendente não produz efeito; compensação parcial em ciclo futuro e valor excedente ainda exigem regras complementares (ADR-018). O caso após pagamento sem dívida aberta segue a ADR-019.

**DEFINIDO para o período de crédito destinado a ciclo futuro:** após confirmação pelo emissor, mostrar o crédito a utilizar sem diminuir a fatura atual, a dívida exigível, a despesa ou o orçamento. Reconhecer a redução de despesa e a liberação do orçamento somente no mês em que o emissor aplicar o crédito. Aplicação integral ou parcial a obrigação futura identificada após pagamento da compra original e atribuição manual provisória entre faturas sem destino externo informado seguem a ADR-019; detalhes de interface e importação da revisão ainda estão pendentes (ADR-018/019).

**DEFINIDO para crédito confirmado para uso futuro acima do valor estornável:** se a compra original já paga ainda permite estorno de R$ 80 e o emissor confirma crédito ligado a ela de R$ 100 para ciclo futuro, mostrar R$ 80 elegíveis como estorno a utilizar e R$ 20 confirmados a utilizar sem classificação econômica definida, em revisão. As partes somam R$ 100 da mesma fonte. A confirmação não reduz dívida, despesa ou orçamento, não movimenta conta nem cria saldo credor patrimonial. A aplicação integral segue a separação do crédito aplicado abaixo. Em aplicação parcial sem discriminação das partes, consumir primeiro o valor elegível por inferência marcada e corrigível: se R$ 50 forem aplicados, reduzir dívida e despesa em R$ 50 no mês da aplicação, restando R$ 30 elegíveis e R$ 20 sem classificação a utilizar. Prova posterior de outra distribuição corrige a despesa e o orçamento do mês e os saldos a utilizar, preservando a baixa total, o caixa e a trilha (ADR-018/019).

**DEFINIDO para estorno no cartão após pagamento sem dívida aberta:** mostrar crédito confirmado a utilizar separadamente, sem criar saldo credor patrimonial nem reduzir despesa e orçamento na confirmação. Se o emissor aplicar todo ou parte ao mesmo cartão, reduzir a dívida total pelo valor efetivamente aplicado e a despesa apenas pela parte elegível como estorno, no mês da aplicação; a parte elegível restante fica a utilizar. Se devolver à conta, registrar entrada na conta e redução da despesa no mês do recebimento, sem receita. Quando o emissor confirma o total aplicado sem detalhar a origem, atribuir a parte elegível entre créditos confirmados do mais antigo para o mais recente. Empate na data de confirmação usa a sequência de registro persistida no Prumo, marcada como inferência corrigível; novo crédito importado depois não redistribui silenciosamente aplicações anteriores. A correção preserva o total aplicado e pode reclassificar efeitos por categoria no mês da aplicação. Se não identificar a fatura de destino, reduzir a dívida total e permitir atribuição manual provisória entre faturas abertas do mesmo cartão e household. Mostrar saldos individuais estimados, separados do total confirmado e sem recomendar pagamento com base neles; confirmar ou corrigir quando o emissor informar o destino, preservando trilha e total. A compra original mantém seu mês. Detalhes de interface e reconciliação do crédito ainda não utilizado seguem pendentes (ADR-019).

**DEFINIDO para crédito do emissor aplicado acima do valor estornável da compra:** com compra original ainda estornável em R$ 80, outra dívida no cartão de R$ 20 e crédito de R$ 100 comprovadamente aplicado, reduzir a dívida total em R$ 100 uma vez. Somente R$ 80 são estorno vinculado à compra e reduzem a despesa e o orçamento no mês da aplicação; R$ 20 são crédito aplicado sem classificação econômica definida, para revisão, sem receita ou segunda redução de despesa presumidas. As partes conservam o total aplicado, sem movimento de conta ou saldo credor inferido. Atribuição entre faturas sem destino comprovado continua provisória; a revisão manual da parcela excedente segue a decisão abaixo (ADR-018/019).

**DEFINIDO para revisão do excedente já aplicado no cartão:** quando o emissor confirmar a aplicação, mas não explicar a natureza econômica dos R$ 20 excedentes, permitir que usuário autorizado do household os classifique manualmente com justificativa obrigatória. Os tipos admitidos são **receita por crédito aplicado à dívida**, sem entrada em conta nem liberação de orçamento de despesa, e **redução de outra despesa documentada**, vinculada a evento do mesmo household e limitada ao valor ainda redutível desse evento. É possível classificar parcialmente e manter o restante pendente. Manter fonte, valor, classificação escolhida e histórico de correções, identificando a escolha como manual. O efeito econômico ou orçamentário pertence ao mês da aplicação efetiva do crédito, ainda que a revisão ocorra depois; recalcular esse mês com trilha e manter a data da revisão. Correção posterior da data de aplicação move o mesmo efeito para o mês correto. Não presumir receita nem outro estorno, não aumentar o limite estornável da compra e não repetir a baixa da dívida ou criar movimento de conta. A soma de estorno da compra original, redução de outras despesas, receita por baixa da dívida e parte ainda sem classificação conserva o total aplicado; a atribuição entre faturas reconcilia separadamente o mesmo total (ADR-019/020).

O estudo `docs/domain/card-credit-reconciliation-proposal.md` demonstra a conservação do crédito confirmado, da aplicação, das partes econômicas e do destino entre faturas como dimensões distintas. A ADR-021 **define** compensação explícita ou fatura fechada com abatimento demonstrável como prova da aplicação; diferença isolada de saldo não basta. Colisões de linhas externas sem correspondência confiável ficam em revisão. O fluxo de conflitos, a correspondência por formato e a origem de excedentes em aplicação agregada continuam pendentes antes do ERD; o estudo não define estrutura física.

A ADR-022 **define** manter o último efeito sustentado por fonte como contestado quando um documento novo divergir no valor, até resolução rastreável; também detalha a revisão da atribuição provisória entre faturas. A baixa total comprovada e os saldos individuais estimados seguem as decisões já aprovadas nas ADR-019/021. Pagamentos posteriores e fontes conflitantes ainda exigem validação no fluxo de revisão antes do ERD.

A ADR-023 **define** uma exceção à alocação automática da ADR-008: se crédito aplicado ao cartão não tiver fatura de destino confirmada e isso tornar incertos os saldos individuais, o pagamento comprovado baixa caixa e dívida total, mas sua distribuição entre faturas fica em revisão. O exemplo de faturas R$ 70/R$ 100, crédito R$ 40 e pagamento R$ 50 mantém dívida total de R$ 80, com dois resultados individuais possíveis; não apresentar nenhum como exigível confirmado antes da revisão.

O estudo `docs/domain/multi-credit-payment-cycle-example.md` demonstra dois créditos e dois pagamentos no mesmo ciclo, além de correção posterior de valor: os totais de caixa, dívida, crédito a utilizar e efeitos econômicos se conservam. A ADR-024 **define** distinguir saldo individual confirmado pelo emissor, calculado pela ordem da ADR-008 e estimado pelo usuário; sem atribuição necessária, não há saldo individual pontual. Conflitos seguem a ADR-022. A estrutura física dessa origem ainda precisa ser detalhada no ERD.

A proposta `docs/domain/card-credit-conceptual-erd-proposal.md` relaciona evento, movimento de conta, efeito na dívida, crédito confirmado, partes econômicas, atribuições entre créditos e faturas, evidências e revisões. Suas invariantes I1–I7 devem ser verificadas antes de escolher esquema físico. Correspondência de fontes por formato, concorrência de revisões, origem do excedente agregado e estratégia técnica de isolamento do household continuam pendentes; o diagrama não aprova tabelas nem stack.

A revisão conceitual de I1–I7 no mesmo documento cobre releitura identificada, fonte conflitante e correção de B de R$ 20 para R$ 15 sem segunda baixa. Ela distingue a primeira entrega de contas e transações das fases posteriores de cartão e importação: os contratos físicos e de segurança necessários a cada fluxo são definidos quando esse fluxo entrar no trabalho, mantendo as pendências restantes explícitas.

**DEFINIDO para data estimada do crédito aplicado:** se a fatura confirmar aplicação mas não trouxer o dia do crédito, usar o fechamento da fatura como data estimada e identificá-la como tal. A data real posterior corrige o mesmo efeito nos relatórios, orçamento e posição histórica por data, sem criar outro estorno ou mudar a compra original. Crédito apenas confirmado a utilizar, sem prova de aplicação, não recebe data estimada de efeito (ADR-019).

**DEFINIDO quando lançamento e compensação têm datas diferentes:** guardar ambas as datas e reconhecer redução de dívida, despesa e consumo do orçamento na data em que a compensação efetivamente reduz a obrigação, não na mera data do lançamento. Se o emissor comprovar posteriormente data efetiva anterior, corrigir a data do mesmo estorno e recalcular os meses e posições históricas afetados, sem duplicar baixa ou mudar saldo atual. Quando a aplicação está comprovada, mas o dia individual falta, vale a estimativa pelo fechamento acima (ADR-018/019).

**DEFINIDO para categoria de estorno de compra com categoria única:** o efeito negativo da despesa usa a categoria da compra original no mês da aplicação do crédito ou do recebimento da devolução à conta. Esse mesmo valor libera o orçamento dessa categoria no mês do efeito. Uma compra futura que absorva o crédito conserva a própria categoria e a despesa integral; o crédito continua vinculado à compra antiga (ADR-018/019).

**DEFINIDO somente como regra eventual para estorno de compra dividida entre categorias:** compras divididas estão fora do MVP. Se forem suportadas em fase futura, o estorno parcial exige atribuição informada pelo usuário à categoria ou às partes efetivamente afetadas, sem rateio proporcional presumido. Enquanto a atribuição faltar, a despesa total e a dívida ou conta refletem o crédito aplicado ou recebido no mês correto, mas a distribuição por categoria e a disponibilidade dos orçamentos dessas categorias ficam pendentes. A soma atribuída deve igualar o crédito efetivo sem superar o valor elegível de cada parte. Se a categoria de uma parte for corrigida depois, reclassificar essa parte no mês da compra e os estornos atribuídos a ela nos meses em que tiveram efeito; recalcular os orçamentos afetados, preservando valores, datas, totais, dívida, caixa e trilha (ADR-018/019).

**DEFINIDO para correção posterior da categoria de compra com categoria única:** quando a categoria original for corrigida, reclassificar os estornos vinculados à categoria corrigida nos respectivos meses em que o crédito foi aplicado ou a devolução recebida. Recalcular os orçamentos dessas categorias nesses meses, preservando valor e data de cada efeito, totais mensais, caixa, dívida e trilha da correção. A compra original também recebe a correção de categoria em seu próprio mês, sem mudança de data; a categoria de compra futura que absorveu o crédito não muda (ADR-018/019).

**DEFINIDO para orçamento com consumo líquido negativo por estorno:** preservar a despesa e o consumo negativo no mês do efeito, mas limitar o valor mostrado como disponível ao orçamento mensal configurado. Exibir o excedente de estornos em separado, apenas como informação; ele não vira verba adicional, saldo de caixa, crédito do emissor ainda a utilizar nem saldo transportado automaticamente para outro mês. Com orçamento `B` e consumo líquido `C`, disponível = `B − max(C, 0)` e, quando `C < 0`, excedente = `−C`. Novas despesas e correções recalculam esses valores (ADR-018/019).

**Status: NÃO DEFINIDO** para os demais detalhes de fidelidade da fatura no MVP, incluindo calendário efetivo do emissor, saldo credor explícito futuro, escopo exato de posições externas, categoria/correção de encargos e detalhes de interface e correspondência de linhas importadas no fluxo de revisão do crédito sem destino entre faturas. Aplicação parcial, ordem entre créditos confirmados e atribuição manual provisória do destino seguem a ADR-019; outros casos ainda precisam de decisão. Eventual ajuste excepcional sem causa fica para fase futura.

Sugestão: primeira versão suporta compras e parcelamentos, sem tentar replicar integralmente toda semântica de um emissor bancário.

## 11.7 Metas

Exemplos:

- reserva de emergência;
- viagem;
- entrada de imóvel;
- educação;
- compra específica.

## 11.8 Patrimônio

Registrar ativos e passivos quando útil.

Fase inicial pode limitar-se a saldos de contas e investimentos manuais.

# 12. Indicadores e fórmulas

Toda fórmula deve existir em documentação versionada.

## 12.1 Taxa de poupança

Hipótese inicial:

```text
(receitas - despesas) / receitas
```

**NÃO DEFINIDO:** tratamento de receitas extraordinárias, aportes e vendas de ativos.

## 12.2 Custo mensal

Pode haver três visões:

- custo total;
- custo essencial;
- custo recorrente.

Não misturar as três.

## 12.3 Reserva de emergência

Hipótese:

```text
média mensal das despesas essenciais em N meses * meses-alvo
```

Todos os parâmetros configuráveis.

## 12.4 Comprometimento recorrente

```text
soma das despesas recorrentes previstas / renda recorrente prevista
```

**NÃO DEFINIDO:** como tratar renda irregular.

## 12.5 Projeção de fluxo

Primeira versão pode combinar:

- receitas recorrentes conhecidas;
- despesas recorrentes;
- parcelas futuras;
- média de despesas variáveis.

Projeção deve informar método e nível de confiança. Não apresentar uma média simples como profecia inevitável.

# 13. Insight Engine

Insights devem preferencialmente nascer de regras determinísticas.

Tipos iniciais:

```text
CATEGORY_SPEND_INCREASE
CATEGORY_SPEND_DECREASE
MONTHLY_SPEND_ABOVE_AVERAGE
SAVINGS_RATE_DROP
SAVINGS_RATE_INCREASE
RECURRING_COST_INCREASE
EMERGENCY_FUND_BELOW_TARGET
BUDGET_THRESHOLD_REACHED
UNUSUAL_TRANSACTION
SUBSCRIPTION_ANNUAL_COST
CASH_FLOW_RISK
```

Cada insight deve registrar:

- tipo;
- versão da regra;
- período;
- dados utilizados;
- valor observado;
- baseline;
- severidade;
- texto calculável ou template;
- explicação opcional por IA.

# 14. Arquitetura de IA

## 14.1 Papel da IA

Casos adequados:

- sugerir categoria para descrição desconhecida;
- normalizar merchant;
- explicar tendências já calculadas;
- resumir o mês;
- ajudar o usuário a consultar seus próprios dados via tools controladas;
- sugerir perguntas úteis;
- auxiliar na criação de regras de classificação.

Casos inadequados no MVP:

- executar SQL arbitrário;
- decidir movimentação de dinheiro;
- alterar dados sem autorização explícita;
- inventar valores ausentes;
- recomendar ativos específicos como aconselhamento personalizado;
- acessar dados fora do household corrente.

## 14.2 Arquitetura sugerida

```text
Usuário
  -> AI endpoint/use case
  -> Agent/LLM
  -> Tool autorizada
  -> Application service
  -> Repository/Analytics service
  -> dados estruturados
  -> resposta explicável
```

Contexto mínimo:

```text
userId
householdId
permissions
traceId
locale
currency
```

## 14.3 Categorização híbrida

Ordem recomendada:

```text
1. regra explícita do usuário
2. regra por merchant/descrição
3. histórico semelhante
4. modelo/LLM
5. confirmação humana quando confiança insuficiente
```

A correção humana pode gerar uma nova regra sugerida.

# 15. Requisitos não funcionais

## 15.1 Segurança

Alta prioridade porque os dados são financeiros.

Requisitos mínimos:

- isolamento por household;
- autorização server-side;
- criptografia em trânsito;
- secrets fora do repositório;
- proteção contra IDOR;
- rate limiting nos pontos expostos;
- validação estrita de inputs;
- upload seguro;
- política de sessão;
- trilha de auditoria;
- backup;
- exportação e exclusão de dados;
- princípio de menor privilégio.

## 15.2 Privacidade

**NÃO DEFINIDO:** política formal de retenção, remoção, anonimização e tratamento de dados.

Deve ser resolvida antes de qualquer abertura a usuários externos.

## 15.3 Performance inicial

Metas candidatas, a validar:

- endpoints de leitura comum P95 abaixo de 500 ms em staging;
- criação/edição comum P95 abaixo de 700 ms;
- importação processada assíncronamente;
- primeira atualização de status de import em poucos segundos;
- dashboard não deve depender de dezenas de queries sequenciais.

Essas metas são ponto de partida, não contrato comercial.

## 15.4 Disponibilidade

**NÃO DEFINIDO:** SLO formal.

Para uso pessoal, disponibilidade pode inicialmente ser best effort, desde que dados permaneçam seguros e recuperáveis.

# 16. Arquitetura de alto nível

Hipótese inicial:

```text
Browser/PWA
    |
    v
Next.js Web
    |
    v
NestJS API
   / | \
  /  |  \
 v   v   v
PostgreSQL Redis Object Storage
             |
             v
           Queue
             |
             v
           Worker
        /     |      \
       v      v       v
    Import  Insights   AI Providers
```

## 16.1 Princípio: monólito modular primeiro

**DEFINIDO para a API:** NestJS em monólito modular (ADR-030). Worker separado continua hipótese para quando houver trabalho assíncrono justificado.

Justificativa:

- domínio ainda evolui;
- deploy simples;
- transações locais simples;
- menor custo operacional;
- módulos podem ser extraídos no futuro.

Não usar microservices somente para produzir um diagrama mais ocupado.

# 17. Módulos do backend

Estrutura conceitual:

```text
identity
households
memberships
accounts
transactions
categories
credit-cards
recurrences
budgets
goals
assets
imports
analytics
insights
ai
audit
notifications
integrations
```

## 17.1 Organização interna sugerida

```text
module/
  application/
  domain/
  infrastructure/
  presentation/
```

**Status: NÃO DEFINIDO** para nível exato de Clean Architecture/DDD.

Pergunta:

> Precisamos de camadas formais em todos os módulos ou apenas nos domínios com regras relevantes?

Sugestão: evitar tanto o `Service` de 4.000 linhas quanto a cerimônia de 14 interfaces para salvar uma categoria.

# 18. Arquitetura frontend

**DEFINIDO:** Next.js com App Router para a web (ADR-030). O padrão detalhado de fetching segue pendente.

Responsabilidades:

- autenticação e bootstrap da sessão;
- layout e navegação;
- dashboard;
- formulários;
- tabelas e filtros;
- gráficos;
- importação;
- estado de jobs;
- telas de configuração;
- interface da IA.

## 18.1 Server vs Client

**NÃO DEFINIDO** como padrão detalhado de fetching.

Perguntas:

- Server Components para dashboard inicial?
- TanStack Query para telas muito interativas?
- BFF no Next ou acesso direto ao Nest?

Sugestão inicial:

- NestJS permanece fonte principal da API;
- Server Components podem buscar dados do Nest em páginas apropriadas;
- TanStack Query em interfaces com filtros, mutations, polling/status de jobs e cache interativo;
- evitar duplicar regras de negócio no Next.

# 19. Repositório e monorepo

**DEFINIDO:** um monorepo na pasta pai, com `prumo-web/` e `prumo-api/` como diretórios internos e os documentos compartilhados na raiz/`docs/`. Ver `docs/decisions/ADR-001-monorepo.md`.

O Git foi inicializado na raiz pelo usuário, na branch `main`, e o commit inicial foi criado. `origin` aponta para `git@github.com:ViniciusOliveiraMonteiro/prumo.git`; `main` já foi publicada com um socket SSH explícito. As duas aplicações não têm repositórios Git próprios. O bootstrap local de dependências, verificações e CI está registrado em `docs/operations/BOOTSTRAP_SPRINT_3.md`; o usuário confirmou a aprovação de uma execução remota anterior da CI, sem conferência dos logs e do SHA nesta sessão, e as alterações posteriores ainda exigem validação remota.

## 19.1 Ferramentas

O monorepo da ADR-001 não definia ferramentas. A ADR-030 escolheu Next.js, NestJS, PostgreSQL e pnpm workspaces na raiz, com lockfile único. Turborepo não foi incluído; versões e verificações locais estão registradas no bootstrap. A ADR-035 exige portas e adapters substituíveis na API, além de hooks dedicados para componentes e páginas web com lógica; componentes estáticos não exigem hooks vazios.

ORM, autenticação, contrato da API e RLS exigem decisões próprias. A escolha da stack não aprova essas opções nem o esquema físico.

**DEFINIDO pela ADR-032:** OpenAPI gerado localmente pela API como contrato versionado no repositório, com tipos derivados para a web. Compartilhar DTOs internos diretamente e escrever OpenAPI manualmente foram alternativas comparadas. A estratégia exata de cliente HTTP permanece pendente.

# 20. API e contratos

A ADR-032 definiu geração local de OpenAPI e tipos para a web, sem serviço externo ou licença paga obrigatórios, além de convenções mínimas para dinheiro, datas, idempotência e erros. **Status: aceito.** Tempo de desenvolvimento, execução local/CI e hospedagem são custos distintos; rotas, autenticação, paginação e política completa de compatibilidade continuam pendentes.

## 20.1 Convenções

Definir antes dos controllers:

- prefixo e versionamento;
- autenticação;
- paginação;
- filtros;
- ordenação;
- formato de data/hora;
- money representation;
- error envelope;
- idempotência;
- correlation/request ID.

## 20.2 Erro padrão candidato

```json
{
  "code": "TRANSACTION_NOT_FOUND",
  "message": "Transaction not found",
  "requestId": "req_...",
  "details": null
}
```

## 20.3 Idempotência

Necessária especialmente em:

- confirmação de import;
- processamento de jobs;
- sincronizações futuras;
- webhooks futuros.

# 21. Banco de dados e modelagem

**DEFINIDO:** PostgreSQL como banco relacional (ADR-030); esquema físico e RLS continuam pendentes.

## 21.1 Entidades candidatas

```text
User
Household
Membership
Account
CreditCard
Category
Merchant
Transaction
TransactionSplit
TransferLink
RecurringRule
InstallmentPlan
Installment
Budget
BudgetItem
FinancialGoal
Asset
Liability
Import
ImportRow
CategorizationRule
MonthlySnapshot
Insight
AuditLog
```

A lista é candidata, não autorização para criar tudo no primeiro migration.

## 21.2 Processo de modelagem

Para cada entidade:

1. definir conceito no glossário;
2. listar invariantes;
3. listar relações;
4. definir ciclo de vida;
5. definir ownership pelo household;
6. definir índices;
7. definir constraints;
8. definir estratégia de exclusão;
9. definir auditoria;
10. só então criar schema.

## 21.3 Índices esperados

Quase todas as queries financeiras serão escopadas por household e tempo.

Índices candidatos:

```text
household_id + occurred_at
household_id + category_id + occurred_at
household_id + account_id + occurred_at
household_id + merchant_id
household_id + status
```

Os índices reais devem nascer de query patterns e `EXPLAIN`, não de decoração do schema.

# 22. Isolamento de dados

Mesmo sendo inicialmente uma aplicação de uso pessoal, o modelo multi-household cria disciplina de isolamento.

Toda entidade relevante deve carregar ou ser inequivocamente resolvida a `householdId`.

## 22.1 Estratégias possíveis

### Opção A - validação na aplicação

Todas as queries incluem household.

Vantagem: simples.

Risco: erro de programação pode produzir acesso indevido.

### Opção B - application + PostgreSQL RLS

Segunda camada de proteção no banco.

**Status: NÃO DEFINIDO.**

Pergunta:

> Vale introduzir Row Level Security como exercício real de defesa em profundidade?

Sugestão: avaliar após modelo estabilizar, antes de abrir o produto a terceiros.

# 23. ORM

**Status: DEFINIDO pela ADR-031.**

Drizzle com driver PostgreSQL, transações explícitas e migrações SQL versionadas foi escolhido. Tipo SQL monetário, nível de isolamento, RLS e esquema físico permanecem pendentes. O gate exige testes com PostgreSQL real para atomicidade, concorrência, escopo A/B e migrações.

Candidatos:

- Prisma;
- Drizzle;
- TypeORM.

Critérios:

- migrations;
- transações;
- suporte a SQL quando necessário;
- ergonomia com Nest;
- controle de tipos monetários;
- capacidade de usar recursos PostgreSQL;
- performance e observabilidade das queries.

Pergunta para ADR:

> Queremos maximizar produtividade ou controle explícito sobre SQL e recursos PostgreSQL?

# 24. Jobs, filas e processamento assíncrono

Use cases claros:

- parsing de arquivos grandes;
- normalização;
- categorização em lote;
- geração de embeddings futura;
- recalcular snapshots;
- geração de insights;
- envio de notificações;
- sincronizações futuras.

## 24.1 BullMQ

**HIPÓTESE:** BullMQ + Redis como solução inicial.

Motivos:

- boa integração no ecossistema Node/Nest;
- jobs persistentes;
- retries;
- concorrência;
- workers separados;
- operação proporcional ao porte inicial.

## 24.2 Kafka

**Status: NÃO DEFINIDO / NÃO NECESSÁRIO INICIALMENTE.**

Pergunta explícita:

> E se usássemos Kafka para tratar eventos financeiros e criar múltiplos consumidores independentes?

Kafka começaria a fazer sentido se surgirem requisitos como:

- alto volume contínuo de eventos;
- necessidade de retenção e replay do stream;
- múltiplos consumidores independentes;
- pipelines de dados em tempo real;
- integração entre vários serviços autônomos;
- reconstrução de projeções a partir de eventos;
- forte desacoplamento temporal entre domínios.

Lacuna que Kafka poderia atender:

```text
transactions.created
       |\
       | +-> analytics consumer
       | +-> anomaly consumer
       | +-> categorization consumer
       | +-> notifications consumer
       +---> data lake consumer
```

Mas, no início, BullMQ ou até eventos internos + outbox podem resolver o problema com menos operação.

Experimento futuro possível:

- criar branch/prova técnica com Redpanda/Kafka;
- publicar eventos via outbox;
- reconstruir um agregado analítico;
- comparar complexidade, observabilidade, throughput e ergonomia com BullMQ.

A decisão será baseada em lacuna concreta, não em prestígio do logo.

# 25. Estratégia de eventos

Mesmo sem Kafka, o domínio pode emitir eventos.

Exemplos:

```text
transaction.created
transaction.updated
transaction.categorized
import.completed
budget.threshold_reached
monthly_snapshot.generated
insight.created
```

## 25.1 Outbox pattern

**NÃO DEFINIDO.**

Pergunta:

> Precisamos garantir publicação confiável entre commit de banco e processamento assíncrono?

Caso sim, avaliar transactional outbox.

Isso é particularmente relevante quando efeitos assíncronos se tornarem críticos.

# 26. Importação de dados

## 26.1 Formatos

MVP:

- manual;
- CSV;
- OFX se biblioteca/parsing estiverem suficientemente confiáveis.

**NÃO DEFINIDO:** padrões específicos de CSV e bancos suportados inicialmente.

Sugestão: criar sistema de adapters/parsers.

```text
RawFile
  -> FormatDetector
  -> Parser
  -> NormalizedImportRow
  -> Deduplicator
  -> Categorizer
  -> Reviewer
  -> Transaction writer
```

## 26.2 Staging

Não gravar imediatamente toda linha importada como transação final.

Uma área de staging facilita:

- revisão;
- rejeição;
- duplicidade;
- correção;
- retry seguro.

## 26.3 Deduplicação

Estratégia **NÃO DEFINIDA**.

Candidatos:

- hash de campos normalizados;
- external ID quando disponível;
- janela de data/valor/descrição;
- heurística com confidence.

Não remover automaticamente uma transação suspeita sem rastreabilidade.

# 27. Object Storage

Arquivos importados e futuros anexos devem ir para object storage, não banco relacional.

**NÃO DEFINIDO:** provedor.

Candidatos:

- S3;
- Cloudflare R2;
- storage do provedor escolhido;
- MinIO local.

Regras:

- nome físico não deve depender diretamente do filename do usuário;
- validar MIME e tamanho;
- URLs assinadas quando aplicável;
- definir retenção;
- criptografia adequada;
- household no metadata/path lógico.

# 28. Cache

**NÃO DEFINIDO.**

Redis não deve virar dependência porque “aplicação séria usa Redis”.

Candidatos reais a cache:

- configurações de household;
- categorias muito consultadas;
- dashboards pré-calculados;
- rate limiting;
- sessões, dependendo da autenticação;
- locks de jobs.

Perguntas:

- qual dado está caro de calcular?
- qual tolerância a stale data?
- como invalidar?
- cache está resolvendo problema medido?

# 29. Snapshots e analytics

Dashboard pode começar com SQL direto bem projetado.

Quando consultas históricas ficarem caras, avaliar:

- `MonthlySnapshot`;
- tabelas agregadas;
- materialized views;
- jobs de recomputação incremental.

**NÃO DEFINIDO:** abordagem inicial.

Sugestão: SQL direto no MVP, snapshots apenas para métricas que realmente precisem.

# 30. Autenticação e sessão

**DEFINIDO para a estratégia do primeiro acesso web privado pela ADR-033.**

NestJS é a autoridade de identidade e sessão, com sessões revogáveis em PostgreSQL e sem serviço pago obrigatório. O módulo oficial `@nestjs/authentication` é candidato sujeito a gate de compatibilidade e segurança. Store, cookie/CSRF, recuperação, abertura pública e custo operacional exigem validação própria.

**Implementado localmente desde 2026-10-15:** a ADR-037 aprovou users e sessions separados dos dados de household, role restrita da API e provisionamento local da primeira conta. Login, leitura da identidade e logout foram demonstrados com cookie revogável pelo rewrite. A ADR-038 aprovou em 2026-10-19 contar falhas de login por e-mail em PostgreSQL e limpar a contagem após login válido; o protótipo passou nos testes locais, mas seus parâmetros de bloqueio seguem provisórios. A ADR-039 aprovou troca autenticada de senha e códigos de recuperação pré-MVP para acesso privado; emissão, consumo de uso único e revogação global passaram em E2E local. A direção do fluxo por e-mail para o MVP foi aceita, mas entrega, notificação independente, parâmetros finais e interface web seguem pendentes. Permanecem pendentes HTTPS/staging, membership e autorização financeira; essa implementação não libera dados de household nem acesso externo.

A ADR-034 aceita uma origem única para o navegador, com `/api` e `/api/*` roteados ao NestJS e páginas no Next.js. **Status: definido para o primeiro acesso web privado.** A página `/conta` renderiza localmente apenas a identidade da sessão consultada na API, com resposta sem cache compartilhado; formulário de login e telas financeiras continuam pendentes. O roteamento local e o proxy de implantação devem preservar cookies, origem, status e proteção CSRF; a validação em staging, fornecedor, domínio e custo de hospedagem continuam pendentes.

Alternativas:

1. autenticação própria com credentials/passkeys;
2. Auth.js;
3. provedor gerenciado como Clerk/Auth0 equivalente.

Critérios:

- aprendizado desejado;
- segurança;
- custo;
- OAuth/passkeys;
- tempo de implementação;
- integração com Nest;
- sessões server-side vs tokens;
- facilidade para revogação.

Pergunta:

> O projeto precisa demonstrar implementação de auth ou precisa demonstrar um sistema seguro que usa auth?

Não são o mesmo objetivo.

# 31. Autorização

Backend deve validar:

```text
user -> membership -> household -> permission -> resource
```

Nunca aceitar `householdId` do cliente como prova de autorização.

Casos de teste obrigatórios:

- membro do Household A não acessa recurso do Household B;
- viewer não muta dados;
- membership revogada invalida acesso;
- IDs enumeráveis não permitem IDOR.

# 32. Arquitetura de segurança e privacidade

Segurança e privacidade são requisitos transversais e começam **antes** do ERD definitivo, da autenticação e do primeiro deploy com dados reais. A aplicação poderá armazenar renda, saldos, patrimônio, estabelecimentos, despesas médicas, educação, localização indireta, hábitos e outros sinais capazes de revelar muito sobre a vida de uma pessoa.

Do ponto de vista jurídico, dado financeiro não deve ser tratado automaticamente como sinônimo da categoria legal de "dado pessoal sensível". Do ponto de vista de engenharia, porém, o projeto adotará uma classificação interna conservadora e tratará histórico financeiro como **Financeiro Confidencial**.

**Estudo relacionado:** `SEC-001` a `SEC-019`, especialmente `SEC-001`, `SEC-002`, `SEC-003`, `SEC-006`, `SEC-007`, `SEC-010`, `SEC-011`, `SEC-012`, `SEC-013`, `SEC-014`, `SEC-016`, `SEC-017`, `SEC-018` e `SEC-019`.

## 32.1 Classificação interna de dados

A classificação candidata é:

| Classe | Exemplos | Expectativa de proteção |
|---|---|---|
| Público | documentação pública, landing page | controles comuns |
| Interno | IDs técnicos, configurações não secretas | acesso restrito à operação |
| Pessoal | nome, e-mail, preferências | proteção de dados pessoais |
| **Financeiro Confidencial** | transações, renda, saldo, patrimônio, faturas, extratos | proteção elevada, minimização e acesso estrito |
| Sensível/Inferível | informação de saúde, religião ou outros atributos que uma transação possa revelar | proteção máxima e revisão de finalidade |
| Credencial/Segredo | senha, token, API key, recovery code | nunca logar; secret management; rotação |

A classificação deve existir também para dados derivados. Um `FinancialInsight`, por exemplo, pode revelar tanto quanto a transação original.

**Saída esperada:** `docs/security/data-classification.md`.

## 32.2 Threat modeling

Antes de produção externa, e sempre que uma feature introduzir nova superfície relevante, produzir/revisar threat model.

Ameaças mínimas a considerar:

- IDOR/BOLA entre households;
- credential stuffing e tomada de conta;
- session theft/fixation;
- convites ou recovery flows abusáveis;
- upload malicioso;
- CSV formula injection em exportações;
- parser de OFX/CSV consumindo arquivo hostil;
- objeto de storage acessível por household incorreto;
- prompt injection em descrições/documentos;
- exfiltração por tool de IA;
- abuso de endpoints caros;
- vazamento em logs, traces ou error tracking;
- secrets em CI/CD;
- dependência comprometida;
- backup exposto ou restore sem controle;
- enumeração de IDs privados;
- race conditions que gerem inconsistência financeira;
- falha de deduplicação/import replay.

**Saída esperada:** `docs/security/threat-model.md` com ativos, trust boundaries, ameaças, mitigação, risco residual e testes associados.

## 32.3 Autenticação, sessão e MFA

**Status: DEFINIDO para a estratégia do primeiro acesso web privado pela ADR-033; implementação pendente.** A validação segue os estudos `SEC-003` e `SEC-004`.

Requisitos mínimos para produção externa:

- sessão/token com expiração e estratégia de revogação;
- cookies `HttpOnly`, `Secure` e `SameSite` quando aplicável;
- recuperação de conta segura;
- logout da sessão atual e de todas as sessões;
- revogação/revalidação em eventos críticos;
- política de senha segura se a aplicação armazenar credenciais;
- MFA ou passkeys avaliados antes da abertura pública.

Perguntas de decisão:

- sessão server-side simplifica revogação e segurança para nosso cenário?
- JWT realmente resolve uma necessidade ou só adiciona fluxo de refresh/revogação?
- vale usar provedor gerenciado para reduzir risco operacional?
- passkeys entram no primeiro release público ou na fase seguinte?

## 32.4 Autorização e isolamento entre households

O backend deve validar:

```text
user -> sessão -> membership -> household -> permission -> resource
```

Nunca aceitar `householdId` enviado pelo cliente como prova suficiente de autorização.

Toda entidade financeira deve ser household-scoped direta ou inequivocamente. Testes negativos entre Household A e B são obrigatórios.

**DEFINIDO para a baseline do primeiro fluxo:** a ADR-029 exige contexto autorizado no backend, escopo de toda consulta e vínculo, falha fechada e testes A/B. A escolha de RLS continua separada e depende de laboratório com a stack real; esta decisão não a resolve.

### Defense in depth

Camadas candidatas:

```text
policy/guard no backend
        +
repository/query scoping
        +
constraints relacionais
        +
PostgreSQL RLS (se aprovado)
        +
storage scoped/signed URLs
        +
testes de isolamento
```

### PostgreSQL Row Level Security

**Status: HIPÓTESE FORTE A AVALIAR ANTES DE USUÁRIOS EXTERNOS.**

RLS pode reduzir o blast radius de um `WHERE household_id` esquecido, mas cria complexidade envolvendo roles, owners, `BYPASSRLS`, connection pooling, jobs administrativos e contexto por transação/conexão.

Pergunta para ADR:

> O ganho de defesa em profundidade compensa a complexidade operacional no nosso stack e conseguimos testá-lo corretamente?

Não adotar RLS apenas porque a sigla parece profissional. Também não descartá-lo porque filtros na aplicação são mais fáceis.

## 32.5 Criptografia

### Em trânsito

**DEFINIDO para produção:** todo tráfego externo deve usar TLS/HTTPS. Conexões internas/gerenciadas devem seguir os mecanismos seguros oferecidos pelo provedor.

### Em repouso

**HIPÓTESE:** utilizar criptografia de volume/database/storage/backups oferecida pelo provedor como baseline.

### Field-level/application encryption

**NÃO DEFINIDO.** Avaliar apenas para campos cujo risco justifique o custo. Criptografar indiscriminadamente valores e descrições pode impedir índices, busca, agregações e analytics.

Candidatos a avaliação:

- identificadores bancários externos;
- payloads brutos temporários;
- credenciais/tokens de integrações futuras;
- dados que não precisam participar de pesquisa/agregação.

Segredos nunca devem ser "criptografados no código"; devem usar secret management adequado.

**Saída esperada:** `docs/security/encryption.md`.

## 32.6 Política de logs, traces e error tracking

Observabilidade não pode virar uma segunda base financeira por acidente.

Nunca registrar em plaintext sem necessidade explícita:

- senha, token, cookie ou recovery code;
- arquivo financeiro integral;
- payload completo de importação;
- descrição/merchant/valor de uma transação quando IDs e metadados bastam;
- prompts/respostas de IA contendo dados pessoais sem política aprovada;
- número completo de conta/cartão ou identificador equivalente.

Preferir eventos como:

```json
{
  "event": "transaction.created",
  "transactionId": "txn_123",
  "householdId": "hsh_456",
  "traceId": "trc_789"
}
```

em vez de replicar o conteúdo financeiro no log.

**Saída esperada:** `docs/security/logging-policy.md`.

## 32.7 Retenção, exclusão e exportação

**Status: NÃO DEFINIDO antes de usuários externos.**

Precisamos definir ciclo de vida para:

- usuários e memberships;
- households;
- transações;
- arquivos importados;
- exports;
- insights;
- histórico de IA;
- logs/audit logs;
- backups.

Questões obrigatórias:

- por quanto tempo o arquivo CSV/OFX original permanece após processamento?
- exclusão de household é imediata, agendada ou possui grace period?
- como dados eliminados desaparecem dos backups conforme a janela de retenção?
- o que precisa ser preservado por segurança/auditoria e por quanto tempo?
- como o usuário exporta seus próprios dados?

Um fluxo candidato de exclusão:

```text
request deletion
 -> bloquear operações conflitantes
 -> revogar acessos/sessões aplicáveis
 -> excluir/anonimizar dados primários conforme política
 -> limpar object storage e artefatos derivados
 -> registrar evento mínimo de auditoria permitido
 -> expirar cópias em backup segundo retenção documentada
```

**Saídas esperadas:** `docs/security/data-retention.md` e casos de uso de exportação/exclusão.

## 32.8 Uploads e arquivos financeiros

Arquivos CSV/OFX podem conter dados financeiros e identificadores. O pipeline deve considerar:

- limite de tamanho;
- content type e extensão não como única validação;
- parsing robusto;
- storage privado;
- chave não baseada diretamente no nome fornecido pelo usuário;
- signed URLs de curta duração quando necessárias;
- household ownership;
- antivírus/malware scanning se o risco/formato justificar;
- retenção explícita;
- limpeza após sucesso/fracasso;
- proteção contra CSV formula injection quando exportarmos dados.

**HIPÓTESE inicial:** manter o arquivo bruto apenas pelo período necessário para processamento/retry, depois eliminá-lo. A duração precisa de ADR/política.

## 32.9 Backup, restore e disaster recovery

Backups são dados de produção e recebem a mesma classificação de segurança do conteúdo original.

Antes de confiar dados reais:

- backup automático de PostgreSQL;
- criptografia;
- acesso restrito;
- retenção documentada;
- restore testado;
- procedimento de recuperação;
- object storage considerado separadamente;
- RPO/RTO definidos mesmo que inicialmente modestos.

Backup que nunca foi restaurado é apenas esperança armazenada.

**Saída esperada:** `docs/security/backup-policy.md` e `docs/runbooks/database-restore.md`.

## 32.10 Incident response

Antes de usuários externos, existir um plano mínimo de resposta a incidentes:

```text
detectar
 -> conter
 -> preservar evidências necessárias
 -> investigar
 -> identificar dados/usuários afetados
 -> avaliar obrigações de comunicação
 -> comunicar quando aplicável
 -> remediar
 -> restaurar/monitorar
 -> postmortem e ações corretivas
```

O runbook deve definir contatos/owners, fontes de evidência, como revogar secrets/sessões, como bloquear features perigosas e como preservar privacidade durante a investigação.

**Saída esperada:** `docs/security/incident-response.md` + exercício/tabletop antes da abertura pública.

## 32.11 Least privilege e segredos

Aplicar menor privilégio em múltiplas camadas:

- usuários/roles do produto;
- database roles;
- credenciais do worker;
- CI/CD;
- object storage;
- observability providers;
- provedores de IA;
- cloud IAM.

Secrets devem ficar fora do Git e possuir processo de rotação. `.env` local é mecanismo de desenvolvimento, não estratégia de secret management em produção.

## 32.12 Gate de segurança antes de produção externa

Não liberar usuários externos até que, no mínimo:

- [ ] threat model inicial revisado;
- [ ] autenticação/sessão definidas por ADR;
- [ ] isolamento A/B coberto por testes E2E/integration;
- [ ] decisão de RLS registrada;
- [ ] TLS e secret management configurados;
- [ ] política de logs aplicada;
- [ ] uploads privados e com retenção definida;
- [ ] exportação e exclusão possuam comportamento documentado;
- [ ] backup + restore drill concluído;
- [ ] incident response documentado;
- [ ] MFA/passkeys avaliados;
- [ ] AI Data Policy aprovada antes de usar dados financeiros com terceiro;
- [ ] staging não utilize dados pessoais reais sem necessidade/controle explícito.

# 33. IA, privacidade e minimização

IA é opcional para o funcionamento financeiro central. O sistema deve continuar calculando saldos, métricas, budgets e insights determinísticos mesmo que o provedor de IA esteja indisponível.

**Estudo relacionado:** `AI-001` a `AI-012`, `SEC-012`, `SEC-016` e `OBS-010`.

## 33.1 Regra de minimização

Antes de enviar qualquer dado a um provedor de IA:

1. definir finalidade;
2. perguntar se IA é necessária;
3. reduzir ao mínimo necessário;
4. preferir métricas agregadas a transações brutas;
5. remover identificadores irrelevantes;
6. limitar período/escopo;
7. validar autorização da tool;
8. observar custo/latência sem registrar conteúdo indevido;
9. possuir fallback sem IA.

Exemplo preferido:

```json
{
  "category": "health",
  "currentMonth": 2230,
  "sixMonthAverage": 870,
  "variationPct": 156
}
```

em vez de enviar ao modelo todos os estabelecimentos, datas, descrições e valores individuais se eles não forem necessários para a tarefa.

## 33.2 AI Data Policy

**Status: OBRIGATÓRIA ANTES DE IA COM DADOS REAIS.**

Criar `docs/security/ai-data-policy.md` definindo:

- quais classes de dados podem ser enviadas;
- quais são proibidas ou exigem transformação;
- provedores aprovados;
- configurações de retenção/treinamento disponíveis no provedor;
- logging/tracing permitido;
- masking/redaction;
- autorização das tools;
- prazo de retenção do histórico local;
- capacidade de o household desabilitar IA;
- tratamento de prompt injection e output não confiável.

Regra candidata:

```text
Permitido por padrão:
- métricas agregadas
- percentuais
- categorias normalizadas
- tendências e deltas

Evitar/negado por padrão:
- senha/token/segredo
- CPF/documento pessoal
- número completo de conta/cartão
- payload bancário bruto
- histórico inteiro quando uma agregação resolve
- dados de outro household/membro fora do escopo autorizado
```

## 33.3 Tools e autorização

O modelo nunca consulta o banco livremente.

```text
LLM/Agent
   -> tool com schema explícito
   -> policy/autorização
   -> application service
   -> analytics/repository
   -> resposta mínima estruturada
```

Tools devem receber contexto autenticado do sistema, não aceitar `householdId` inventado pelo modelo como autoridade.

## 33.4 Conteúdo gerado não é regra financeira

LLM não deve decidir sozinho:

- saldo;
- taxa de poupança;
- reserva de emergência;
- classificação contábil definitiva sem mecanismo de confiança/confirmação;
- recomendação de investimento personalizada;
- alteração destrutiva de dados.

O modelo pode explicar cálculos cuja origem é determinística e rastreável.

## 33.5 Prompt injection e dados não confiáveis

Descrições de transações, documentos e arquivos importados são entradas não confiáveis. Se algum conteúdo chegar a um agent, tratá-lo como **dados**, não como instrução privilegiada.

Qualquer tool com efeito de escrita deve possuir validação/autorização independente do texto produzido pelo LLM e, para ações sensíveis, considerar confirmação humana.

## 33.6 Retenção e provedor

**NÃO DEFINIDO:** provedor(es), configuração de retenção, localização/região quando aplicável, termos de processamento e política de histórico.

A decisão precisa ser registrada antes do primeiro uso de dados financeiros reais por IA.

# 34. Open Finance Brasil

**Status: FUTURO.**

O Open Finance Brasil possui APIs padronizadas e requisitos próprios de segurança, consentimento, versionamento e participação. Não deve ser tratado como simples endpoint público que qualquer aplicação chama com uma API key.

Antes de implementar, será necessário pesquisar:

- modelo de participação;
- consentimento;
- requisitos regulatórios;
- parceiros/agregadores autorizados;
- certificados e segurança;
- sandbox;
- custos;
- escopo das APIs de contas, cartões e investimentos.

Plano sugerido:

1. MVP manual/CSV/OFX;
2. adapter de integração genérico;
3. prova com sandbox/parceiro;
4. ADR legal/técnico;
5. somente então integração real.

# 35. Observabilidade

Observabilidade deve existir antes de a aplicação precisar dela desesperadamente.

## 35.1 Logs estruturados

Campos mínimos:

```text
requestId
traceId
userId
householdId
operation
module
jobId
```

Não incluir valores financeiros detalhados sem necessidade.

## 35.2 Métricas

HTTP:

- throughput;
- latência;
- taxa de erro.

Banco:

- query duration;
- pool;
- queries lentas.

Jobs:

- queue depth;
- processing time;
- success/failure;
- retries;
- dead-letter/falhas permanentes.

Imports:

- linhas lidas;
- linhas válidas;
- duplicadas;
- rejeitadas;
- tempo total.

IA:

- latência;
- tokens/custo;
- tool calls;
- erro;
- taxa de aceitação das sugestões.

## 35.3 Tracing

Hipótese: OpenTelemetry.

Fluxo desejado:

```text
web request
 -> Next
 -> Nest
 -> PostgreSQL
 -> Queue
 -> Worker
 -> AI Provider
```

# 36. Testes

## 36.1 Unidade

Priorizar regras:

- cálculo de reserva;
- taxa de poupança;
- transferências;
- fatura;
- parcelas;
- categorização;
- budget thresholds;
- insights.

## 36.2 Integração

Com PostgreSQL/Redis reais via containers quando possível.

Testar:

- repositories;
- migrations;
- constraints;
- filas;
- idempotência;
- isolamento.

## 36.3 E2E API

Fluxos críticos:

- criar household;
- criar conta;
- registrar despesa;
- registrar transferência;
- importar arquivo;
- corrigir categoria;
- visualizar dashboard.

## 36.4 E2E frontend

Playwright ou equivalente.

Fluxos:

- login;
- onboarding;
- lançamento;
- import;
- dashboard;
- budget;
- configuração de reserva.

## 36.5 Contract tests

Avaliar para API/client gerado.

## 36.6 Testes de IA

Não testar frase exata.

Testar:

- schema da resposta;
- tool autorizada;
- ausência de tool proibida;
- household isolation;
- fallback;
- entradas adversariais relevantes.

# 37. Ambiente de desenvolvimento

## 37.1 Pré-requisitos candidatos

- Node.js versão LTS definida no repositório;
- pnpm;
- Docker;
- Git;
- editor/IDE;
- cliente SQL opcional.

Versões exatas devem estar em:

```text
.node-version ou .nvmrc
packageManager no package.json
Dockerfiles
```

## 37.2 Bootstrap esperado

Meta:

```text
git clone
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

O README deve explicar qualquer passo adicional.

## 37.3 Serviços locais

Candidatos:

```text
PostgreSQL
Redis
MinIO
Mailpit opcional
OpenTelemetry Collector opcional
```

Não incluir serviços sem uso atual.

# 38. Configuração e secrets

Criar matriz por ambiente:

```text
local
test
staging
production
```

Regras:

- `.env.example` sem segredo;
- validação de env ao iniciar;
- secrets de produção em secret manager/provedor;
- rotação documentada;
- nenhuma configuração de negócio crítica escondida em env se deveria estar no banco.

# 39. Migrations e seed

## 39.1 Migrations

Devem ser versionadas e executadas por processo controlado.

**NÃO DEFINIDO:** quem executa migration em deploy.

Alternativas:

- job dedicado antes do rollout;
- release command;
- pipeline CI/CD.

Evitar múltiplas réplicas rodando migration simultaneamente.

## 39.2 Seed

Tipos:

- seed mínimo de desenvolvimento;
- fixtures de teste;
- demo dataset fictício.

Nunca usar dados financeiros pessoais reais em repositório.

# 40. Dados de demonstração

Criar household fictício rico o suficiente para mostrar o produto:

- dois membros;
- salário;
- aluguel;
- cartão;
- compra parcelada;
- assinaturas;
- despesas médicas;
- investimento;
- mês atípico;
- orçamento;
- reserva parcial.

Isso permite demos reproduzíveis sem expor a vida financeira real do desenvolvedor. Uma ideia surpreendentemente saudável.

# 41. Design system e UX

O frontend deve ser tratado como produto, não dashboard genérico.

Definir:

- tokens;
- tipografia;
- espaçamento;
- estados de loading;
- empty states;
- acessibilidade;
- visualização de valores;
- privacidade visual;
- responsividade.

## 41.1 Charts

Todo gráfico deve responder uma pergunta.

Evitar pizza para vinte categorias só porque a biblioteca oferece pizza.

## 41.2 Privacidade de tela

**FUTURO/OPCIONAL:** modo para esconder valores em ambientes públicos/screenshots.

# 42. Internacionalização

**NÃO DEFINIDO.**

MVP pode ser pt-BR/BRL, mas arquitetura deve avaliar:

- locale;
- timezone;
- currency;
- formatação;
- datas.

Pergunta:

> Vale modelar moeda desde o primeiro migration mesmo sem suportar conversão cambial?

Sugestão: sim para integridade semântica; conversão fica fora do MVP.

# 43. Estratégia com Codex

Codex deve atuar como implementador assistido por especificação, não arquiteto autônomo sem contexto.

## 43.1 Fonte de verdade

Ordem de prioridade:

1. documentos de produto;
2. regras de negócio;
3. ADRs aprovados;
4. contrato da API;
5. testes existentes;
6. código.

Se código e regra documentada divergirem, a tarefa deve parar e registrar a inconsistência em vez de escolher silenciosamente.

## 43.2 AGENTS.md

Criar na raiz do repositório.

Deve conter:

- visão do produto;
- estrutura do repositório;
- comandos;
- convenções;
- onde ficam regras;
- política para migrations;
- política de testes;
- política de documentação;
- regras de segurança;
- limites de atuação do agente.

## 43.3 Regra de alteração

Toda tarefa relevante deve dizer:

```text
Contexto
Objetivo
Escopo
Fora de escopo
Regras de negócio envolvidas
Decisões arquiteturais aplicáveis
Critérios de aceite
Testes esperados
Documentação a atualizar
```

## 43.4 Comportamentos proibidos ao agente

- inventar regra financeira;
- decidir tecnologia marcada NÃO DEFINIDO;
- alterar migration já aplicada sem instrução;
- enfraquecer teste para fazê-lo passar;
- remover autorização por conveniência;
- acessar outro household em teste/fixture sem contexto explícito;
- introduzir dependência grande sem ADR/tarefa;
- duplicar lógica entre web e API;
- implementar recomendação financeira não especificada.

# 44. Governança de documentação

A [estrutura atual](docs/README.md) organiza os documentos por finalidade. O [guia de manutenção](docs/documentation/GUIA_DE_MANUTENCAO.md) é a regra operacional para escolher a fonte principal, atualizar documentos na mesma mudança e conferir links, âncoras, comandos e status. O Plano Mestre orienta produto e domínio; uma ADR aceita registra uma decisão delimitada; código, testes e contrato gerado descrevem o que foi implementado; o plano de desenvolvimento registra execução e pendências. Resumos devem apontar para a fonte principal sem criar regras concorrentes.

Não apresentar proposta, hipótese ou laboratório isolado como capacidade pronta. Ao alterar títulos ou mover arquivos, atualize as referências e confira seus destinos. Mantenha Markdown como fonte editável; PDFs só mediante pedido explícito.

# 45. ADRs iniciais

Criar ADR somente quando houver decisão real.

Backlog sugerido:

```text
ADR-001 Estratégia de monorepo (aceito)
ADR-002 Frontend framework
ADR-003 Backend framework
ADR-004 ORM
ADR-005 Authentication
ADR-006 Money representation (aceito)
ADR-007 Transaction/transfer model (aceito para o núcleo; demais eventos pendentes)
ADR-008 Credit card/installment recognition (aceito para a regra de reconhecimento; detalhes do modelo pendentes)
ADR-009 Async jobs
ADR-010 Event publishing/outbox
ADR-011 Redis usage
ADR-012 Observability stack
ADR-013 Cloud/deployment strategy
ADR-014 AI provider and data minimization
ADR-015 Household isolation/RLS
ADR-016 Opening balance and reconciliation (aceito para o núcleo; detalhes dos ajustes pendentes)
ADR-017 Income/expense and card liability (aceito para o núcleo; estrutura física pendente)
ADR-018 Card reversal before payment and future-cycle timing (aceito para os casos delimitados)
ADR-019 Card reversal after payment without open debt (aceito para o caso delimitado)
ADR-020 Applied card credit surplus classification (aceito para o excedente já aplicado)
ADR-021 Card credit application evidence and matching (aceito para o limiar de prova; fluxo físico pendente)
ADR-022 Card credit conflict review and invoice destination (aceito para valor conflitante e revisão do destino; detalhes físicos pendentes)
ADR-023 Payment with unallocated card credit (aceito para o caso delimitado; múltiplos fatos em estudo)
ADR-024 Card invoice balance provenance (aceita; estrutura física e interface pendentes)
```

Kafka só merece ADR quando houver problema para avaliar.

# 46. CI

Pipeline de pull request:

```text
install
 -> lint
 -> formatting check
 -> typecheck
 -> unit tests
 -> integration tests
 -> API contract validation
 -> build web
 -> build api
 -> build worker
 -> security/dependency checks
```

**NÃO DEFINIDO:** ferramentas exatas de SAST/dependency scan.

# 47. CD

Fluxo candidato:

```text
merge main
 -> build immutable artifacts/images
 -> publish
 -> migration step
 -> deploy staging/production conforme política
 -> health checks
 -> smoke tests
 -> observability verification
```

## 47.1 Rollback

Deve ser desenhado antes do primeiro deploy sério.

Perguntas:

- rollback de aplicação é simples?
- migration é backward compatible?
- como reverter feature que escreveu dados em novo formato?

# 48. Ambientes

## 48.1 Local

Dados fictícios ou pessoais somente na máquina do usuário.

## 48.2 Test

Efêmero por pipeline/test suite.

## 48.3 Staging

Deve se aproximar de produção:

- banco separado;
- secrets separados;
- storage separado;
- observabilidade ativa;
- dados fictícios.

## 48.4 Production

Somente produção recebe dados reais de uso.

# 49. Deploy de produção

**Status: NÃO DEFINIDO.**

## 49.1 Opção A - frontend e backend separados

Exemplo conceitual:

```text
Vercel -> Next.js
Cloud Run/Fly/Railway/Render/AWS/etc -> API/Worker
Managed PostgreSQL
Managed Redis
Object Storage
```

Vantagens:

- ergonomia frontend;
- serviços gerenciados.

Desvantagens:

- múltiplos provedores;
- observabilidade/network/secrets mais fragmentados.

## 49.2 Opção B - cloud unificada

Todos os workloads em um provedor.

Vantagens:

- rede e operação centralizadas;
- aprendizado de cloud mais profundo.

Desvantagens:

- mais infraestrutura inicial.

## 49.3 Opção C - VPS/container host

Mais controle, maior responsabilidade operacional.

Pergunta para decisão:

> O objetivo principal do deploy é reduzir custo/tempo ou praticar infraestrutura cloud de forma mais profunda?

# 50. Containers

Mesmo que Next seja hospedado em plataforma gerenciada, API e worker devem possuir Dockerfiles reproduzíveis.

Requisitos:

- multi-stage build;
- usuário não-root;
- healthcheck quando apropriado;
- imagem enxuta;
- configuração externa;
- graceful shutdown.

# 51. Infra as Code

**NÃO DEFINIDO.**

Candidatos:

- Terraform;
- Pulumi;
- OpenTofu;
- configuração declarativa do próprio provedor.

Pergunta:

> Queremos que IaC faça parte da evidência de carreira ou seria complexidade sem retorno nesta fase?

Sugestão: começar sem IaC apenas se o provedor for simples; introduzir quando staging/production já exigirem recursos reproduzíveis.

# 52. Backups e disaster recovery

Obrigatório antes de confiar dados reais.

Definir:

- backup automático do PostgreSQL;
- retenção;
- criptografia;
- teste de restore;
- backup/retention do object storage;
- RPO/RTO aproximados.

**NÃO DEFINIDO:** valores de RPO/RTO.

Para uso pessoal, exemplo inicial para debate:

- RPO <= 24h pode ser aceitável no começo?
- RTO <= algumas horas é suficiente?

A resposta deve considerar possibilidade de reimportar extratos e trabalho manual perdido.

# 53. Feature flags

**NÃO DEFINIDO.**

Podem ser úteis para:

- IA;
- imports experimentais;
- nova dashboard;
- integração externa.

Não precisamos de plataforma de feature flags no primeiro commit. Um mecanismo simples pode bastar inicialmente.

# 54. Release strategy

Sugestão:

- trunk-based ou branches curtas;
- PR obrigatório;
- Conventional Commits opcional;
- changelog/release notes para mudanças relevantes;
- tags para releases de produção.

**NÃO DEFINIDO:** estratégia final de branching.

# 55. Performance e escalabilidade

Escalar somente após medir.

Possíveis gargalos futuros:

- dashboard com agregações históricas;
- imports grandes;
- IA;
- processamento de milhares de transações;
- múltiplas sincronizações externas.

Escalas prováveis:

```text
web -> horizontal
api -> horizontal
worker -> horizontal por fila
PostgreSQL -> otimização/vertical/read replicas quando necessário
Redis -> managed/cluster se necessário
```

# 56. Testes de carga

**FUTURO antes de abertura pública.**

Cenários:

- dashboard com anos de histórico;
- import com milhares de linhas;
- múltiplos imports concorrentes;
- geração de insights;
- picos de login.

Ferramenta **NÃO DEFINIDA**: k6, Artillery ou equivalente.

# 57. Custos

Manter planilha/documento de custo estimado mensal.

Itens:

- hosting web;
- API/worker;
- banco;
- Redis;
- object storage;
- observabilidade;
- IA;
- domínio;
- backup.

Uma arquitetura que custa R$ 1.500/mês para controlar as despesas da casa teria certo valor pedagógico, mas uma mensagem financeira peculiar.

# 58. Roadmap de execução

## Fase 0 - Replanejamento e documentação

Entregáveis:

- visão;
- escopo;
- personas;
- glossário;
- mapa de domínio;
- regras iniciais;
- backlog de decisões.

Gate:

> Conseguimos explicar o produto sem mencionar frameworks.

## Fase 1 - Modelagem dos fluxos financeiros

Entregáveis:

- casos de uso prioritários;
- regras de transações;
- transferências;
- cartão/fatura;
- parcelas;
- recorrências;
- fórmulas.

Gate:

> Conseguimos simular manualmente os fluxos sem contradição.

## Fase 2 - Arquitetura de software

Entregáveis:

- context diagram;
- container diagram;
- módulos;
- ADRs de stack;
- API conventions;
- strategy de auth;
- strategy de jobs.

Gate:

> Os componentes possuem responsabilidades claras.

## Fase 3 - Modelo de dados

Entregáveis:

- ERD;
- constraints;
- índices iniciais;
- estratégia de money;
- migration strategy.

Gate:

> Cada tabela existe por uma regra/caso de uso conhecido.

## Fase 4 - Bootstrap de engenharia

Entregáveis:

- monorepo com `prumo-web/` e `prumo-api/`;
- lint/format/typecheck;
- apps vazios executáveis;
- Docker Compose;
- banco;
- CI básico;
- `AGENTS.md`;
- docs index.

Gate:

> Novo clone sobe localmente de forma reproduzível.

## Fase 5 - Identity + Household

Implementar:

- auth;
- user;
- household;
- membership;
- autorização;
- testes de isolamento.

## Fase 6 - Accounts + Transactions

Implementar núcleo financeiro.

Gate:

> É possível controlar um mês manualmente com confiança.

## Fase 7 - Categories + Budget + Recurrence

Implementar organização e compromissos.

## Fase 8 - Credit Cards + Installments

Somente depois de fechar modelo.

## Fase 9 - Import Pipeline

Implementar:

- upload;
- storage;
- jobs;
- staging;
- parser;
- dedupe;
- review.

## Fase 10 - Analytics + Dashboard

Implementar indicadores documentados.

## Fase 11 - Insight Engine

Regras determinísticas e histórico.

## Fase 12 - AI Assistance

Categorização e explicação com tools.

## Fase 13 - Observabilidade completa

Tracing, métricas, dashboards e alertas.

## Fase 14 - Staging

Infra independente e smoke tests.

## Fase 15 - Produção pessoal

Usar dados reais de maneira controlada.

Gate:

- backup configurado;
- restore testado;
- segurança revisada;
- logs sem dados indevidos;
- rollback documentado.

## Fase 16 - Dogfooding

Usar por vários ciclos mensais.

Registrar problemas reais como produto:

- reembolsos;
- splits;
- rendas irregulares;
- cartões adicionais;
- refinamento de import;
- novas métricas.

## Fase 17 - Abertura para terceiros, se desejada

Antes disso:

- LGPD/privacy review;
- termos;
- isolamento reforçado;
- rate limiting;
- RLS avaliado;
- SLO;
- suporte;
- onboarding.

# 59. Passos futuros possíveis

## 59.1 Open Finance

Integração consentida com instituições/parceiros.

## 59.2 Aplicativo mobile

Somente se a web responsiva demonstrar limitação real.

## 59.3 Event streaming

Kafka/Redpanda caso o sistema desenvolva necessidades reais de replay e múltiplos consumers.

## 59.4 Data warehouse

Para analytics avançado e séries históricas em escala.

## 59.5 Forecasting avançado

Modelos estatísticos ou ML, comparados com baselines simples.

## 59.6 Detecção de anomalias

Começar com estatística simples, evoluir se houver valor.

## 59.7 Compartilhamento com contador

Role e escopo próprios.

## 59.8 Patrimônio completo

Imóveis, veículos, dívidas e ativos ilíquidos.

## 59.9 Metas colaborativas

Contribuições por membro e progresso.

## 59.10 Integrações de notificações

E-mail/push/WhatsApp somente após avaliar privacidade e necessidade.

# 60. Backlog de decisões para debate

Esta seção deve permanecer viva.

## D-001 - ORM

**Status: DEFINIDO pela ADR-031.**

Perguntas:

- Prisma acelera suficientemente sem limitar SQL avançado?
- Drizzle oferece melhor proximidade com SQL para objetivo de aprendizado?
- migrations são ergonomicamente confiáveis para nosso fluxo?

## D-002 - Money representation

**Status: NÃO DEFINIDO**

Perguntas:

- PostgreSQL `numeric` + decimal library?
- bigint em centavos?
- múltiplas moedas futuras alteram decisão?

## D-003 - Auth

**Status: NÃO DEFINIDO**

Pergunta central:

- implementar internamente agrega ao objetivo fullstack ou desvia tempo para uma área de alto risco já resolvida por provedores?

## D-004 - Cartão/fatura

**Status: NÃO DEFINIDO**

Precisamos modelar casos reais antes do schema.

## D-005 - BullMQ vs Kafka

**Status: HIPÓTESE BullMQ / Kafka FUTURO**

Critério: escolher pela semântica do problema, não por escala imaginária.

## D-006 - RLS

**Status: NÃO DEFINIDO**

Avaliar defesa em profundidade vs complexidade operacional.

## D-007 - Cloud

**Status: NÃO DEFINIDO**

Comparar custo, aprendizado, portabilidade e tempo operacional.

## D-008 - IaC

**Status: NÃO DEFINIDO**

Entrar quando infraestrutura deixar de ser trivial.

## D-009 - Web PWA

**Status: NÃO DEFINIDO**

Avaliar após experiência mobile responsiva.

## D-010 - Categorização por IA

**Status: NÃO DEFINIDO tecnicamente**

Definir modelo, confidence, custo e privacidade após baseline de regras.

# 61. Checklist de arquitetura por feature

Antes de implementar qualquer feature:

1. Qual problema resolve?
2. Qual caso de uso cobre?
3. Qual regra de negócio está envolvida?
4. Qual household possui o dado?
5. Quem pode executar?
6. Existe efeito financeiro?
7. Existe risco de dupla contabilização?
8. A operação precisa ser atômica?
9. Precisa de idempotência?
10. Deve gerar evento?
11. Deve virar job?
12. Precisa de audit log?
13. Afeta indicadores existentes?
14. Precisa recomputar histórico?
15. Quais testes protegem a regra?
16. Como observamos falha?
17. Como desfazer a operação?
18. A documentação foi atualizada?

# 62. Definition of Ready

Uma tarefa de domínio está pronta para implementação quando possui:

- objetivo;
- contexto;
- regra de negócio identificada;
- critérios de aceite;
- efeitos esperados;
- casos de erro;
- autorização;
- impacto de dados;
- dependências arquiteturais já definidas;
- testes esperados.

Se depende de decisão marcada **NÃO DEFINIDO**, não está pronta.

# 63. Definition of Done

Uma tarefa está concluída quando, quando aplicável:

- código implementado;
- testes adicionados;
- lint/typecheck passam;
- migrations revisadas;
- autorização validada;
- observabilidade adicionada;
- regra documentada;
- caso de uso atualizado;
- OpenAPI atualizado;
- ADR atualizado se houve decisão;
- não existem secrets/dados reais no commit;
- PR explica tradeoffs relevantes.

# 64. Template de tarefa para Codex

```markdown
# [TASK-ID] Título

## Contexto
Por que esta tarefa existe.

## Objetivo
Resultado observável esperado.

## Escopo
- item A
- item B

## Fora de escopo
- item X

## Regras de negócio
- BR-XXX

## Decisões arquiteturais
- ADR-XXX

## Critérios de aceite
1. ...
2. ...

## Casos de erro
- ...

## Testes obrigatórios
- unit
- integration
- e2e quando aplicável

## Documentação a atualizar
- arquivo X

## Restrições
- não introduzir dependência nova sem aprovação
- não alterar regra financeira
```

# 65. Template de ADR

```markdown
# ADR-XXX - Título

Status: Proposed | Accepted | Superseded | Rejected

## Contexto
Qual problema exige decisão?

## Drivers
- ...

## Alternativas
### A
Prós / contras

### B
Prós / contras

## Decisão
...

## Consequências
Positivas e negativas.

## Gatilhos para revisitar
Quando a decisão deixa de fazer sentido?
```

# 66. Plano imediato de trabalho

As pastas `prumo-web/` e `prumo-api/` e o Git na raiz já foram criados. Não iniciar código de produto antes das definições da fase anterior ao bootstrap.

O andamento por sprint, seus gates e o estado do ambiente estão em `docs/planning/PLANO_DE_DESENVOLVIMENTO.md`.

A sequência recomendada é:

```text
1. docs/product/vision.md
2. docs/product/scope.md
3. docs/product/personas.md
4. docs/domain/glossary.md
5. docs/domain/business-rules.md
6. modelar transação/transferência/cartão/parcelas
7. docs/use-cases principais
8. docs/domain/calculations.md
9. context diagram
10. container diagram
11. decisões de money + ORM + auth
12. ERD inicial
13. API conventions
14. strategy de async jobs
15. threat model inicial
16. só então bootstrap do repositório
```

## 66.1 Primeiro debate recomendado

A primeira discussão técnica deveria ser o **modelo financeiro central**, não Kafka, Redis ou cloud.

O primeiro debate usa exemplos concretos. Já foram definidos o saldo inicial (ADR-016), a despesa de compra de consumo no cartão e o pagamento da fatura (ADR-008), a separação entre gasto integral e compromissos futuros, e a transferência como evento com dois movimentos vinculados (ADR-007). Restam perguntas:

- como representar os outros tipos de evento `Transaction`?
- como classificar definitivamente o excedente de entrada externa acima do saldo reembolsável e tratar demais reembolsos de compra no cartão? Para compra paga diretamente, novo evento e movimento vinculados, limite de reembolso e separação do excedente recebido para revisão seguem a ADR-017.
- como tratar estornos fora do caso de crédito confirmado e aplicado à compra no cartão ainda não paga (ADR-018)?
- se e quando revisitar divisão de compra entre categorias, fora do MVP?
- como registrar e aprovar ajustes de reconciliação?
- como tratar calendário efetivo do emissor, saldo credor futuro e categoria/correção de encargos?

Money em centavos de BRL foi aprovado na ADR-006. A ADR-017 aprovou classificação econômica pelo evento para receita recebida e despesa de consumo paga diretamente, obrigação do cartão conceitualmente própria vinculada aos eventos, receita comum no mês em que o dinheiro chega, despesa comum paga diretamente no mês em que sai da conta e reembolso de compra paga diretamente como redução da despesa e liberação do orçamento no mês do recebimento, limitado ao valor original pago. Pagamento parcial, encargos informados, atribuição automática de compras ao ciclo configurado e divergência de reconciliação visível, sem ajuste automático ou manual genérico sem causa, estão no MVP (ADR-008). As ADR-018/019 cobrem os casos delimitados de estorno no cartão; uma categoria por compra foi aprovada para o MVP e divisão entre categorias ficou fora de seu escopo. Estrutura física, operações não liquidadas, demais tipos de `Transaction` e outros casos de reembolso e estorno continuam abertos. Os cenários em `docs/domain/financial-examples.md` exemplificam o núcleo aprovado e identificam esses limites.

Se esse modelo estiver errado, toda arquitetura tecnicamente impecável apenas calculará números errados com grande eficiência.

# 67. Resultado esperado do projeto

Ao final, o projeto deve poder ser apresentado como:

> Plataforma de inteligência financeira doméstica desenvolvida com arquitetura fullstack, modelagem explícita de domínio financeiro, processamento assíncrono de imports, analytics, regras de insights, isolamento multi-household, IA orientada por tools, observabilidade, testes e pipeline completo de CI/CD, utilizada em produção com dados reais de maneira controlada.

Mais importante que a frase é a capacidade de abrir qualquer parte e explicar:

- qual problema ela resolve;
- qual regra a sustenta;
- por que a tecnologia foi escolhida;
- quais alternativas foram recusadas;
- como é testada;
- como falha;
- como é observada;
- como pode evoluir.

Isso é o que transforma o projeto de um repositório com frameworks em evidência real de engenharia fullstack.

# 68. Referências técnicas para decisões futuras

Estas referências não transformam hipóteses em decisões. Elas servem como ponto de partida oficial quando cada ADR for discutido.

## 68.1 Next.js

Documentação oficial: https://nextjs.org/docs

Uso no projeto a avaliar: App Router, Server Components, rendering, cache e integração com a API NestJS.

## 68.2 NestJS e BullMQ

Documentação oficial de filas: https://docs.nestjs.com/techniques/queues

A documentação atual do Nest apresenta integração com BullMQ por `@nestjs/bullmq`; BullMQ usa Redis para persistir jobs e pode operar com producers/consumers distribuídos. Isso sustenta a hipótese de BullMQ como opção inicial para imports e processamento assíncrono, sem torná-la decisão automática.

## 68.3 Apache Kafka

Documentação oficial: https://kafka.apache.org/documentation/

Kafka deve ser avaliado quando houver necessidade concreta de event streaming durável, replay, pipelines com múltiplos estágios/consumidores ou desacoplamento entre serviços independentes.

## 68.4 OpenTelemetry

Documentação oficial JavaScript: https://opentelemetry.io/docs/languages/js/

A instrumentação pode ser avaliada para traces e métricas em Next/Nest/workers. O desenho final de logs, traces e exportadores permanece não definido.

## 68.5 Open Finance Brasil

Área oficial do desenvolvedor: https://openfinancebrasil.atlassian.net/wiki/spaces/OF/overview

O ecossistema possui especificações de APIs, requisitos técnicos, segurança, versionamento e regras próprias. Qualquer integração deve ser tratada como iniciativa separada do MVP e precedida de análise técnica, de participação, consentimento e conformidade.
