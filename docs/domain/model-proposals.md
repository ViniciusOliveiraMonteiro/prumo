# Propostas para revisão do modelo financeiro

**Status:** propostas, sem decisão aprovada. Complementa os cenários de `financial-examples.md` e as regras BR-001 a BR-003 do Plano Mestre. Nenhuma opção abaixo autoriza código de produto; registrar as escolhas em ADRs antes de implementar.

## 1. Valor monetário (DB-002, futura ADR-006)

| Opção | Benefício | Custo e limite |
|---|---|---|
| Inteiro na menor unidade da moeda | Soma e rateio exatos; exemplos de centavos ficam simples de testar. | A escala depende da moeda; conversão, câmbio e valores fracionários menores que um centavo precisam de regras próprias. |
| Decimal exato com escala definida | Pode representar moedas e cálculos intermediários com escalas diferentes. | Exige biblioteca decimal no domínio, política de quantização e cuidado para não converter para `Number` binário na API ou na interface. |

**Proposta para o MVP:** usar BRL e valor inteiro em centavos nas operações de conta, cartão e orçamento; transportar o valor como inteiro ou string decimal conforme contrato ainda a definir. Carregar `currency` explicitamente e rejeitar operações entre moedas diferentes até existir conversão definida. Para taxas e projeções, calcular com precisão decimal e quantizar apenas no ponto documentado. A alternativa decimal em todo o domínio continua válida se a necessidade de múltiplas moedas ou frações subcentavo for confirmada.

**Decisões necessárias:** moedas aceitas no MVP; intervalo máximo de valores; formato da API; regra para divisão, arredondamento e rateio; tratamento de valores negativos e zero. Testes futuros: R$ 0,01, R$ 100/3, R$ 10/6, limites e rejeição de moeda incompatível.

## 2. Saldo inicial e reconciliação (DOM-002)

| Opção | Benefício | Custo e limite |
|---|---|---|
| Saldo derivado desde um marco inicial, somando movimentos | Cada diferença pode ser investigada e reproduzida. | Importações parciais exigem marco inicial explícito; históricos longos podem exigir projeções de leitura. |
| Saldo editável como fonte principal | Aproxima rapidamente o número mostrado pelo banco. | Uma edição pode esconder movimento ausente ou duplicado, prejudicando auditoria e métricas. |

**Proposta:** registrar saldo e data de abertura como marco, sem classificá-lo como receita. Derivar o saldo posterior dos movimentos conhecidos. Reconciliação compara o saldo calculado com um saldo externo datado e mostra a diferença. Se houver correção, vinculá-la à reconciliação com motivo e trilha de auditoria, sem chamá-la automaticamente de receita ou despesa. A forma de persistir projeções e ajustes depende do modelo de transações e do banco aprovados depois.

**Decisões necessárias:** se o usuário pode alterar o marco após registrar movimentos; quando ajustes afetam patrimônio e indicadores; política para movimentos anteriores ao marco; tolerância e fluxo de aprovação de divergências.

## 3. Compra no cartão, parcelas e fatura (DOM-004/005, futura ADR-008)

| Visão possível para o relatório mensal | O que mostra | Consequência |
|---|---|---|
| Despesa integral na data da compra | Custo da decisão de compra no mês em que ocorreu. | Mês da compra pode ter pico grande; parcelas futuras devem aparecer separadamente como compromissos, sem nova despesa. |
| Despesa de cada parcela no mês da fatura | Pressão mensal das parcelas sobre o orçamento. | A obrigação total criada pela compra não coincide com a soma de despesas já reconhecidas; é preciso distinguir obrigação, gasto do período e caixa. |
| Despesa no pagamento da fatura | Saída de caixa no mês do pagamento. | Se também contar compra ou parcela como despesa, viola BR-002; atrasos deslocam o gasto entre meses. |

**Proposta para discussão:** oferecer duas visões nomeadas: gasto econômico na data da compra e compromissos/saídas de caixa por fatura. A compra gera obrigação pelo total e o pagamento reduz obrigação e caixa, sem nova despesa. Para orçamento mensal, falta escolher se o consumo do limite será atribuído ao mês da compra ou às parcelas de cada fatura; essa escolha deve aparecer na interface e nas fórmulas, sem misturar as duas visões em um total.

**Decisões necessárias:** regra oficial do relatório mensal e do orçamento; tratamento de compra após fechamento, pagamento parcial, juros, tarifas, estorno após pagamento e cronograma de meses com dia inexistente. Validar com os cenários de janeiro/fevereiro e R$ 100/3 de `financial-examples.md` antes de aprovar a ADR.

## Perguntas para a revisão

1. O MVP começará apenas com BRL e centavos inteiros, deixando conversão de moedas para depois?
2. O saldo inicial será um marco datado e os saldos posteriores serão derivados dos movimentos?
3. No relatório mensal principal, uma compra parcelada contará integralmente no mês da compra ou por parcela na fatura? Uma segunda visão pode mostrar o fluxo de caixa sem somá-lo novamente à despesa.

As respostas podem aprovar ou alterar as propostas. Registrar a opção escolhida, motivo, alternativas e efeitos em ADR antes de iniciar código financeiro.
