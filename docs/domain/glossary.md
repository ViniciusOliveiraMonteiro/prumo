# Glossário inicial do domínio

**Status:** em estudo na Sprint 1. Termos alinhados às seções 7–10 do Plano Mestre. Quando a estrutura de dados ou a data de reconhecimento estiver pendente, a definição abaixo descreve o conceito, não uma entidade implementada.

| Termo | Significado no Prumo | Limite ou pendência |
|---|---|---|
| Household | Unidade que reúne pessoas e dados financeiros sob um limite comum de acesso. | Papéis e eventual privacidade por conta ainda não definidos. |
| Account (conta) | Lugar ou instrumento em que o household acompanha um saldo, como corrente, poupança ou carteira. | Marco inicial datado e saldo derivado definidos (ADR-016); tipos, ajustes e visibilidade ainda aguardam modelagem. |
| Saldo inicial | Valor conhecido de uma conta em uma data de partida para o histórico no Prumo. | Não é receita desse período; o saldo posterior é derivado (ADR-016). Persistência e correção detalhadas ainda aguardam decisão. |
| Transaction (transação) | Evento financeiro do household com efeitos de saldo em movimentos vinculados (ADR-007). | Estrutura física e representação de cartão/parcelas futuras ainda aguardam decisão. |
| Income (receita) | Entrada econômica atribuível ao household. | Data de reconhecimento e receitas extraordinárias ainda exigem regra. |
| Expense (despesa) | Saída econômica atribuível ao household. | Compra de consumo no cartão é reconhecida integralmente na compra (ADR-008); outras competências ainda exigem regra. |
| Transfer (transferência) | Evento com dois movimentos de saldo opostos e vinculados entre contas distintas do mesmo household, sem alterar receita ou despesa total (ADR-007). | Movimentações entre households, reversão e importação de um lado sem par aguardam decisão. |
| Credit Card Purchase (compra no cartão) | Compra que cria obrigação perante o emissor do cartão. | Compra de consumo é despesa integral na data da compra (ADR-008); estrutura de compra, parcelas e fatura ainda aguarda decisão. |
| Installment (parcela) | Fração de uma obrigação parcelada com valor e vencimento previstos. | O cronograma precisa conservar exatamente o total da compra; representação e rateio aguardam ADR. |
| Statement (fatura) | Agrupamento de obrigações de um ciclo do cartão, com fechamento e vencimento. | Fechamento não cria gasto adicional; regras de pagamento parcial, juros e estorno estão pendentes. |
| Statement Payment (pagamento de fatura) | Saída de uma conta que reduz a obrigação do cartão. | Não cria segunda despesa das compras já reconhecidas. |
| Refund (reembolso) | Devolução de valor ao household relacionada a um gasto anterior. | Relação com período e categoria originais ainda precisa de decisão. |
| Reversal (estorno) | Cancelamento total ou parcial de lançamento, preservando rastreabilidade do evento original. | Efeitos após pagamento de fatura e apresentação histórica ainda precisam de decisão. |
| Reconciliation (reconciliação) | Comparação, em uma data, entre saldo calculado no Prumo e saldo informado por fonte externa. | Divergências devem ser examinadas; política de ajuste está pendente. |
| Currency (moeda) | Unidade monetária de um valor. | BRL é a moeda do MVP; conversão entre moedas fica para decisão futura (ADR-006). |
| Money (valor monetário) | Quantia associada a moeda e regra explícita de precisão. | Valores finais do MVP usam centavos inteiros de BRL (ADR-006); tipo técnico, limite e contrato ainda aguardam decisão. |

Os cenários de conferência estão em `financial-examples.md`. As alternativas e pendências estão em `model-proposals.md`.
