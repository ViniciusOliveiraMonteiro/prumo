# Exemplos financeiros para discussão do modelo

**Status:** em estudo (Sprint 1). Valores fictícios em BRL. Este documento testa BR-001 a BR-003 e as decisões de ADR-006, ADR-008 e ADR-016. Apenas trechos marcados **HIPÓTESE** permanecem propostas, não contratos de implementação.

## Vocabulário das contas abaixo

- **Caixa:** soma das contas com dinheiro disponível. A conta de investimento é mostrada separadamente, mas continua sendo um ativo do household.
- **Passivo do cartão:** valor devido ao emissor. Um aumento do passivo reduz o patrimônio líquido.
- **Receita/despesa:** eventos econômicos do household. Compra de consumo no cartão é despesa integral na data da compra (ADR-008); a regra do orçamento mensal ainda está pendente.
- **Patrimônio líquido neste exemplo:** caixa + investimento − passivo do cartão. Outros ativos e passivos foram omitidos.

Os exemplos são independentes entre si. Cada tabela parte do estado inicial indicado; os números não devem ser somados entre tabelas.

## 1. Salário, transferência e investimento (DOM-001/003)

Estado inicial: conta corrente R$ 0, poupança R$ 0, investimento R$ 0, passivos R$ 0.

| Evento | Corrente | Poupança | Investimento | Receita acumulada | Despesa acumulada | Patrimônio líquido |
|---|---:|---:|---:|---:|---:|---:|
| Salário de R$ 3.000 na corrente | 3.000 | 0 | 0 | 3.000 | 0 | 3.000 |
| Transferir R$ 1.000 da corrente para poupança | 2.000 | 1.000 | 0 | 3.000 | 0 | 3.000 |
| Transferir R$ 500 da poupança para investimento próprio | 2.000 | 500 | 500 | 3.000 | 0 | 3.000 |

**Invariante BR-001:** cada transferência reduz uma conta e aumenta outra pelo mesmo valor; receita, despesa e patrimônio total permanecem iguais. Uma transferência para corretora só preserva essa invariante se o ativo de destino pertencer ao mesmo household e estiver incluído na visão patrimonial. Movimentações entre households requerem outra regra.

## 2. Saldo inicial e reconciliação (DOM-002)

Conta corrente criada em 01/02 com saldo informado de R$ 5.000; o histórico anterior não será importado neste exercício. Em fevereiro entram R$ 200 de receita e saem R$ 80 de despesa. O saldo calculável desde o ponto de partida é `5.000 + 200 − 80 = R$ 5.120`. O saldo inicial de R$ 5.000 **não é receita de fevereiro**.

Se o extrato externo mostrar R$ 5.110, há divergência de R$ 10. Pela ADR-016, o sistema expõe a divergência para revisão; não cria ajuste automático. Persistência de snapshots, movimentos anteriores ao marco e semântica de um ajuste aprovado ainda estão pendentes.

## 3. Compra no cartão, fechamento e pagamento (DOM-001/004)

Estado inicial: corrente R$ 500, passivo do cartão R$ 0, patrimônio líquido R$ 500. Compra de R$ 120 em 31/01; fatura fecha em 05/02; pagamento integral em 12/02.

| Evento | Corrente | Passivo do cartão | Patrimônio líquido | Despesa acumulada |
|---|---:|---:|---:|---:|
| Antes da compra | 500 | 0 | 500 | 0 |
| Compra de 31/01 | 500 | 120 | 380 | 120 |
| Fechamento de 05/02 | 500 | 120 | 380 | 120 |
| Pagamento de 12/02 | 380 | 0 | 380 | 120 |

**Decisão ADR-008:** os R$ 120 entram no relatório principal de despesas de janeiro. Em visão de caixa, a saída de R$ 120 ocorre em fevereiro. Fechar a fatura apenas agrupa obrigações; pagá-la reduz caixa e passivo no mesmo valor. A regra do orçamento mensal, pagamento parcial e tratamento de juros/tarifas continuam pendentes.

## 4. Parcelas e conservação dos centavos (DOM-005/DB-002)

Uma compra de R$ 100,00 em três parcelas não pode gerar três parcelas de R$ 33,33: isso totalizaria R$ 99,99. **HIPÓTESE para exercitar o rateio:** dividir em unidades mínimas inteiras, distribuir o resto às primeiras parcelas e guardar o total original.

| Compra | Parcelas propostas | Conferência |
|---|---|---:|
| R$ 100,00 / 3 | R$ 33,34 + R$ 33,33 + R$ 33,33 | R$ 100,00 |
| R$ 10,00 / 6 | R$ 1,67 + R$ 1,67 + R$ 1,67 + R$ 1,67 + R$ 1,66 + R$ 1,66 | R$ 10,00 |

O cronograma é compromisso futuro; sua soma deve ser exatamente o valor da compra. Se a compra de R$ 100 ocorrer em janeiro, o relatório principal terá R$ 100 de despesa em janeiro; as parcelas aparecem em compromissos dos meses correspondentes, sem nova despesa. **Pendente:** definir em qual mês cada parcela entra, como avançar datas inexistentes (por exemplo, dia 31) e como tratar alterações do emissor. A ADR-006 fixou centavos inteiros de BRL para valores finais; a distribuição dos centavos acima ainda é hipótese de rateio.

## 5. Reembolso de compra paga (DOM-006, antecipação de caso)

Compra à vista de R$ 80 reduz a corrente de R$ 200 para R$ 120 e registra R$ 80 de despesa. Reembolso posterior de R$ 20 eleva a corrente para R$ 140. **HIPÓTESE:** relacionar o reembolso à compra e mostrar despesa líquida de R$ 60, preservando os dois movimentos para auditoria. **Pendente:** decidir se relatórios históricos são reprocessados no mês da compra ou se o reembolso afeta apenas o mês em que foi recebido; diferenciar reembolso de uma receita independente.

## 6. Estorno de compra no cartão (DOM-006, antecipação de caso)

Partindo de passivo R$ 0, compra de R$ 50 cria passivo R$ 50. Estorno integral antes de pagar a fatura reduz o passivo novamente a R$ 0. **HIPÓTESE:** manter compra e estorno vinculados, com despesa líquida zero no escopo da compra. Se o estorno vier após pagamento, pode surgir crédito no cartão ou devolução à conta; esse fluxo e sua competência ficam pendentes para a ADR de cartão/fatura.

## Critérios de conferência e decisões pendentes

1. Uma transferência interna altera duas posições patrimoniais em sentidos opostos e não altera receita/despesa do household.
2. Saldo inicial é ponto de partida documentado, não receita do período importado.
3. Compra no cartão e pagamento de fatura não produzem duas despesas; pagamento baixa caixa e obrigação juntos.
4. Soma das parcelas em unidades mínimas é igual ao total original, inclusive quando há resto.
5. Reembolso e estorno mantêm vínculo com o evento original, sujeito à decisão sobre período e apresentação.

ADR-006 definiu a representação central de Money, ADR-008 definiu o reconhecimento principal de compras de consumo no cartão e ADR-016 definiu o marco de saldo inicial. Permanecem pendentes limites e contrato de Money, algoritmo de rateio, estrutura de `Transaction`, detalhes de fatura e regra de ajustes/reembolsos/estornos. As tabelas são critérios candidatos para testes dessas partes quando forem implementadas.
