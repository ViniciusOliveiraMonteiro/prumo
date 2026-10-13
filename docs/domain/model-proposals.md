# Decisões e alternativas do modelo financeiro

**Status:** as três direções centrais foram aprovadas em ADR-006, ADR-016 e ADR-008. As alternativas abaixo preservam o motivo das escolhas e as pendências de implementação. Complementa `financial-examples.md` e as regras BR-001 a BR-003 do Plano Mestre.

## 1. Valor monetário (DB-002, ADR-006)

| Opção | Benefício | Custo e limite |
|---|---|---|
| Inteiro na menor unidade da moeda | Soma e rateio exatos; exemplos de centavos ficam simples de testar. | A escala depende da moeda; conversão, câmbio e valores fracionários menores que um centavo precisam de regras próprias. |
| Decimal exato com escala definida | Pode representar moedas e cálculos intermediários com escalas diferentes. | Exige biblioteca decimal no domínio, política de quantização e cuidado para não converter para `Number` binário na API ou na interface. |

**Decisão aprovada:** usar BRL e valor inteiro em centavos nas operações de conta, cartão e orçamento; carregar `currency` explicitamente e rejeitar operações entre moedas diferentes. Para taxas e projeções, calcular com precisão decimal exata e quantizar em ponto documentado. O contrato da API ainda decidirá como transportar o valor. A alternativa decimal em todo o domínio poderá ser revisitada se houver necessidade de múltiplas moedas ou frações subcentavo.

**Pendências:** intervalo máximo de valores; formato da API; regras de divisão, arredondamento e rateio fora das compras parceladas no cartão; tratamento de valores negativos e zero. O rateio dessas compras foi definido na ADR-008. Testes futuros: R$ 0,01, R$ 100/3, R$ 10/6, limites e rejeição de moeda incompatível.

## 2. Saldo inicial e reconciliação (DOM-002)

| Opção | Benefício | Custo e limite |
|---|---|---|
| Saldo derivado desde um marco inicial, somando movimentos | Cada diferença pode ser investigada e reproduzida. | Importações parciais exigem marco inicial explícito; históricos longos podem exigir projeções de leitura. |
| Saldo editável como fonte principal | Aproxima rapidamente o número mostrado pelo banco. | Uma edição pode esconder movimento ausente ou duplicado, prejudicando auditoria e métricas. |

**Decisão aprovada (ADR-016):** registrar saldo e data de abertura como marco, sem classificá-lo como receita. Derivar o saldo posterior dos movimentos conhecidos. Reconciliação compara o saldo calculado com um saldo externo datado e mostra a diferença. Se houver correção, vinculá-la à reconciliação com motivo e trilha de auditoria, sem chamá-la automaticamente de receita ou despesa. A forma de persistir projeções e ajustes depende do modelo de transações e do banco aprovados depois.

**Pendências:** se o usuário pode alterar o marco após registrar movimentos; quando ajustes afetam patrimônio e indicadores; política para movimentos anteriores ao marco; tolerância e fluxo de aprovação de divergências.

## 3. Compra no cartão, parcelas e fatura (DOM-004/005, ADR-008)

| Visão possível para o relatório mensal | O que mostra | Consequência |
|---|---|---|
| Despesa integral na data da compra | Custo da decisão de compra no mês em que ocorreu. | Mês da compra pode ter pico grande; parcelas futuras devem aparecer separadamente como compromissos, sem nova despesa. |
| Despesa de cada parcela no mês da fatura | Pressão mensal das parcelas sobre o orçamento. | A obrigação total criada pela compra não coincide com a soma de despesas já reconhecidas; é preciso distinguir obrigação, gasto do período e caixa. |
| Despesa no pagamento da fatura | Saída de caixa no mês do pagamento. | Se também contar compra ou parcela como despesa, viola BR-002; atrasos deslocam o gasto entre meses. |

**Decisão aprovada:** oferecer duas visões nomeadas: gasto econômico integral na data da compra e compromissos/saídas de caixa por fatura. A compra gera obrigação pelo total e o pagamento reduz obrigação e caixa, sem nova despesa. O orçamento mensal consome o valor integral da compra no mês da compra; parcelas e pagamentos futuros aparecem em outra visão e não consomem novamente esse orçamento (ADR-008). Essa semântica deve aparecer na interface e nas fórmulas, sem misturar as duas visões em um total.

**Decisões posteriores (ADR-008):** o MVP aceita pagamento parcial, aloca-o da fatura aberta mais antiga à mais recente com correção possível, registra juros/tarifas pelo valor informado na fatura como novas despesas e atribui compras automaticamente pelo fechamento configurado, com correção. Compra no próprio dia do fechamento ou depois vai por padrão ao ciclo seguinte. Se o dia configurado de fechamento ou vencimento não existir no mês, a data candidata é o último dia. Cada fatura prevê a primeira data candidata de vencimento após o fechamento, com correção possível.

**Rateio e ciclos das parcelas (ADR-008):** dividir o total em centavos inteiros igualmente e atribuir o resto às primeiras parcelas. Em compra positiva, exigir número positivo de parcelas não superior ao total em centavos, recusando qualquer parcelamento que geraria parcela zero. A primeira entra no ciclo atribuído à compra e as seguintes nos ciclos mensais consecutivos. Permitir correção de valores e ciclos para refletir o emissor, desde que cada parcela continue positiva, a soma continue igual à compra, o vínculo seja preservado e não haja nova despesa.

**Limite posterior (ADR-008):** pagamento comum acima da dívida aberta é recusado no MVP sem efeito parcial; importação desse valor fica sinalizada para revisão. Saldo credor requer regra futura.

**Orçamento no MVP (ADR-008):** referência visual; compra acima do valor planejado é registrada e mostra alerta com o excedente. Categorias e alertas adicionais ainda exigem detalhamento.

**Pendências:** calendário efetivo do emissor, saldo credor explícito futuro, categoria/correção de encargos e detalhes de interface e importação para revisar o destino entre faturas quando o emissor omitir essa informação. Estorno após pagamento sem dívida aberta, aplicação parcial e atribuição entre créditos mais antigos primeiro para total aplicado ao cartão seguem a ADR-019; sem fatura identificada, a dívida total é reduzida e uma atribuição manual provisória pode mostrar saldos individuais estimados até confirmação do emissor. O fechamento previsto em dia inexistente segue a regra do último dia do mês (ADR-008). Uma categoria por compra vale no MVP; divisão entre categorias fica fora dele (Plano Mestre, seção 11.2). Validar os casos ainda abertos antes da implementação.

Para entrada externa acima do saldo reembolsável de compra paga diretamente, a ADR-017 exige **uma única entrada de conta** e partes de classificação que somam exatamente essa entrada: reembolso até o limite da compra e restante recebido sem classificação econômica definida. O ERD e a importação ainda precisam definir os vínculos físicos entre linha externa, movimento e partes; classificar depois o restante não deve repetir o movimento de caixa.

Para crédito externo comprovadamente aplicado ao cartão acima do valor ainda estornável da compra, as ADR-018/019 exigem **uma única baixa da dívida total** e partes que somam essa baixa: estorno elegível até o limite da compra e restante aplicado sem classificação econômica definida. O contrato físico deve ligar fonte, baixa e partes sem obrigar que toda baixa seja despesa negativa; classificar depois o restante conforme a ADR-020 não deve repetir a baixa.

`card-credit-reconciliation-proposal.md` detalha as igualdades de crédito confirmado, aplicação, partes econômicas e destino entre faturas com um exemplo de correções independentes. O ERD deve permitir conferir essas dimensões sem multiplicar a baixa; a correspondência de linhas externas e a origem de excedentes em aplicação agregada seguem pendentes.

## Respostas da revisão

1. **Sim:** BRL em centavos inteiros, moeda explícita e conversão futura (ADR-006).
2. **Sim:** saldo inicial como marco datado e saldos posteriores derivados dos movimentos (ADR-016).
3. **Integralmente no mês da compra:** parcelas e caixa em visão separada, sem somá-los novamente à despesa (ADR-008).

As pendências de cada seção continuam abertas e devem ser resolvidas antes da área correspondente ser implementada.
