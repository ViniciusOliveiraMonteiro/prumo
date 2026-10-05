# ADR-008: reconhecimento de compras no cartão e visões de fatura

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

Uma compra no cartão cria gasto e obrigação em data anterior ao pagamento. Sem separar gasto, compromisso e caixa, os relatórios podem duplicar despesas ou esconder dívidas. O Plano Mestre já estabelece em BR-002 que pagar a fatura não duplica despesa.

## Drivers

- O relatório mensal principal precisa ter um período de reconhecimento único e explicável.
- Parcelas futuras precisam ser visíveis sem inflar a despesa econômica.
- Saldo de caixa, dívida do cartão e despesa devem poder ser conciliados por evento.

## Alternativas

### Reconhecer integralmente na compra

Mostra o custo no mês da decisão de compra e a obrigação total desde então. Pode produzir um pico de despesa no mês da compra, mesmo com pagamentos distribuídos.

### Reconhecer por parcela na fatura

Aproxima a despesa exibida da pressão mensal de pagamento. Exige distinguir a obrigação total já criada da parte reconhecida como despesa e pode obscurecer o custo da compra original.

### Reconhecer no pagamento

Retrata saída de caixa. Atrasos deslocam o gasto entre meses e, se compras também entrarem no relatório, violam BR-002.

## Decisão

Para compras de consumo no cartão, o **relatório mensal principal de despesas reconhece o valor integral na data da compra**. A compra cria obrigação pelo total. Parcelas e faturas aparecem em uma visão separada de compromissos e fluxo de caixa, sem gerar novamente a despesa da compra. Fechar a fatura agrupa obrigações; pagar a fatura reduz caixa e obrigação no valor pago, sem criar nova despesa das compras já reconhecidas.

Cada visão deve identificar período e significado. Não se deve somar gasto na compra, parcela prevista e pagamento como se fossem três despesas. O uso das parcelas no cálculo de orçamento mensal, o modelo persistido de compra/parcela/transação e as regras detalhadas do emissor ainda não estão decididos.

## Consequências

- Uma compra de R$ 120 em 31/01 é despesa de janeiro; pagamento em 12/02 é saída de caixa de fevereiro, sem despesa adicional.
- Uma compra de R$ 100 em três parcelas é despesa de R$ 100 no mês da compra; o cronograma futuro conserva R$ 100 no total e não alimenta novamente o total de despesas.
- O modelo deve permitir relacionar compra, cronograma, fatura e pagamento para explicar cada número.
- Relatórios históricos e métricas devem declarar qual visão usam. A taxa de poupança da seção 12 do Plano Mestre requer revisão explícita dessa semântica antes de virar indicador de produto.

## Pendências

Definir ciclo de fechamento, compra após fechamento, vencimento, pagamento parcial, juros e tarifas, estorno após pagamento, data mensal de parcelas e regra de consumo do orçamento. Reembolso e estorno precisam de regra própria de competência. Essas pendências não alteram a regra de não duplicar a compra.

## Gatilhos para revisitar

Uso real demonstrar que o relatório principal por data da compra impede a leitura mensal do household; novos tipos de operação que exijam reconhecimento diferente, como aquisição de ativo ou juros.

## Conceitos para estudo

Competência simplificada, fluxo de caixa, passivo, ciclo de fatura, compromisso futuro e conciliação entre visões.
