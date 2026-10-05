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

Este Plano Mestre é a fonte de verdade de produto, arquitetura, requisitos e roadmap. Ele **não substitui** o material didático necessário para compreender as decisões. O repositório deve manter também:

```text
docs/
  project/
    master-plan.md

  study/
    study-plan.md
    01-backend.md
    02-database.md
    03-security-privacy.md
    04-devops-infra.md
    05-observability.md
    06-architecture-distributed-systems.md
    07-ai.md
    08-testing-quality.md
    09-domain-finance.md

  product/
  domain/
  architecture/
  security/
  adr/
  runbooks/
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
| Frontend | HIPÓTESE | Next.js + TypeScript. |
| Backend | HIPÓTESE | NestJS + TypeScript. |
| Banco | HIPÓTESE | PostgreSQL. |
| ORM | NÃO DEFINIDO | Prisma é candidato; avaliar Drizzle/TypeORM se houver motivo. |
| Monorepo | DEFINIDO | Um repositório na pasta pai, com `prumo-web/` e `prumo-api/`; ver ADR-001. |
| Cache | NÃO DEFINIDO | Redis apenas quando existir caso real. |
| Jobs | HIPÓTESE | BullMQ + Redis para imports, recalculações e tarefas assíncronas. |
| Event streaming | NÃO DEFINIDO | Kafka não entra inicialmente; avaliar somente mediante lacuna concreta. |
| Autenticação | NÃO DEFINIDO | Avaliar solução própria, Auth.js, Clerk ou provedor equivalente. |
| Multi-user | DEFINIDO conceitualmente | Household + memberships. Implementação detalhada pendente. |
| Infra cloud | NÃO DEFINIDO | Comparar Vercel + provedor backend vs cloud unificada. |
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

Movimentação financeira registrada no sistema.

### Expense

Saída econômica atribuível ao household.

### Income

Entrada econômica atribuível ao household.

### Transfer

Movimentação entre contas pertencentes ao mesmo household. Não deve inflar receitas nem despesas.

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

## BR-002 - Pagamento de fatura não duplica despesa

Se as compras do cartão já foram contabilizadas, o pagamento da fatura representa liquidação de passivo/transferência, não nova despesa.

## BR-003 - Valores monetários não usam ponto flutuante binário

Persistir dinheiro em tipo decimal apropriado ou unidade inteira mínima conforme decisão do modelo.

**Status: NÃO DEFINIDO** entre `numeric/decimal` e representação inteira em centavos na camada de domínio.

Perguntas:

- Precisamos suportar múltiplas moedas no MVP?
- Caso sim, valores monetários precisam sempre carregar moeda.

Sugestão: mesmo começando apenas com BRL, modelar `currency` explicitamente pode reduzir retrabalho futuro.

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
- saldo inicial ou data de início;
- visibilidade/estado.

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
- dividir transação em categorias;
- marcar transferência;
- marcar reembolso;
- anexar nota;
- associar merchant;
- visualizar origem do import.

**NÃO DEFINIDO:** suporte a split transactions no MVP. Sugestão: projetar modelo compatível, implementar depois do núcleo.

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

Decidir se orçamento é teto rígido, objetivo visual ou ambos.

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

**Status: NÃO DEFINIDO** para nível de fidelidade da fatura no MVP.

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

**HIPÓTESE:** API em monólito modular e worker separado.

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

**HIPÓTESE:** Next.js com App Router.

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

O Git foi inicializado na raiz pelo usuário, na branch `main`, e o commit inicial foi criado. `origin` aponta para `git@github.com:ViniciusOliveiraMonteiro/prumo.git`; o push ainda está pendente por falta de autenticação SSH funcional nesta distro. As duas aplicações não têm repositórios Git próprios. Dependências, verificações e pipelines serão definidos no bootstrap, após as decisões da fase inicial.

## 19.1 Ferramentas

O gerenciador de pacotes e as ferramentas de build seguem como hipótese até a decisão de stack. A escolha pelo monorepo não decide Next.js, NestJS, pnpm workspaces ou Turborepo.

**NÃO DEFINIDO:** se `contracts` será gerado por OpenAPI ou compartilhado manualmente.

Sugestão: API deve publicar contrato OpenAPI e gerar client/tipos, reduzindo acoplamento direto aos DTOs do backend.

# 20. API e contratos

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

**HIPÓTESE:** PostgreSQL.

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

**Status: NÃO DEFINIDO.**

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

**NÃO DEFINIDO.**

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

**Status: NÃO DEFINIDO.** A implementação deve ser decidida em ADR depois do estudo `SEC-003` e `SEC-004`.

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

Estrutura sugerida:

```text
docs/
  product/
    vision.md
    personas.md
    scope.md
    roadmap.md

  domain/
    glossary.md
    domain-map.md
    business-rules.md
    calculations.md

  use-cases/
    UC-001-create-household.md
    UC-002-create-account.md
    ...

  architecture/
    overview.md
    frontend.md
    backend.md
    async-processing.md
    ai.md
    observability.md

  database/
    erd.md
    indexes.md
    migrations.md

  api/
    conventions.md
    errors.md
    idempotency.md

  security/
    threat-model.md
    privacy.md
    household-isolation.md

  operations/
    environments.md
    deployment.md
    backup-restore.md
    incident-runbook.md

  decisions/
    ADR-001-...
```

# 45. ADRs iniciais

Criar ADR somente quando houver decisão real.

Backlog sugerido:

```text
ADR-001 Estratégia de monorepo (aceito)
ADR-002 Frontend framework
ADR-003 Backend framework
ADR-004 ORM
ADR-005 Authentication
ADR-006 Money representation
ADR-007 Transaction model
ADR-008 Credit card/installment model
ADR-009 Async jobs
ADR-010 Event publishing/outbox
ADR-011 Redis usage
ADR-012 Observability stack
ADR-013 Cloud/deployment strategy
ADR-014 AI provider and data minimization
ADR-015 Household isolation/RLS
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

**Status: NÃO DEFINIDO**

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

O andamento por sprint, seus gates e o estado do ambiente estão em `docs/PLANO_DE_DESENVOLVIMENTO.md`.

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

Precisamos responder com exemplos concretos:

- o que é uma Transaction?
- transferência usa uma ou duas transações?
- compra de cartão é despesa em qual data?
- pagamento da fatura é o quê?
- parcelamento representa gasto total na compra, compromisso futuro, ou ambos em visões diferentes?
- reembolso altera transação original ou cria movimento relacionado?
- como tratar estorno?
- como tratar split?
- como tratar saldo inicial?

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
