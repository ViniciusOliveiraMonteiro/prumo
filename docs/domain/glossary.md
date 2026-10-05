# Glossário inicial do domínio

**Status:** em estudo na Sprint 1. Termos alinhados às seções 7–10 do Plano Mestre. Quando a estrutura de dados ou a data de reconhecimento estiver pendente, a definição abaixo descreve o conceito, não uma entidade implementada.

| Termo | Significado no Prumo | Limite ou pendência |
|---|---|---|
| Household | Unidade que reúne pessoas e dados financeiros sob um limite comum de acesso. | Papéis e eventual privacidade por conta ainda não definidos. |
| Account (conta) | Lugar ou instrumento em que o household acompanha um saldo, como corrente, poupança ou carteira. | Tipos, saldo inicial, reconciliação e visibilidade aguardam modelagem. |
| Saldo inicial | Valor conhecido de uma conta em uma data de partida para o histórico no Prumo. | Não é receita desse período; forma de persistir e corrigir aguarda decisão. |
| Transaction (transação) | Registro de um evento financeiro com valor, data, origem e contexto suficientes para explicar seu efeito. | Ainda não foi decidido se transferência terá um ou dois registros nem se parcelas futuras serão transações. |
| Income (receita) | Entrada econômica atribuível ao household. | Data de reconhecimento e receitas extraordinárias ainda exigem regra. |
| Expense (despesa) | Saída econômica atribuível ao household. | A competência de cartão e parcelas ainda exige regra; pagamento de fatura não deve duplicá-la. |
| Transfer (transferência) | Deslocamento de valor entre contas do mesmo household, sem alterar sua receita ou despesa total. | Movimentações entre households e a representação dos dois lados aguardam decisão. |
| Credit Card Purchase (compra no cartão) | Compra que cria obrigação perante o emissor do cartão. | Mês de despesa e relação entre compra, parcelas e fatura aguardam ADR. |
| Installment (parcela) | Fração de uma obrigação parcelada com valor e vencimento previstos. | O cronograma precisa conservar exatamente o total da compra; representação e rateio aguardam ADR. |
| Statement (fatura) | Agrupamento de obrigações de um ciclo do cartão, com fechamento e vencimento. | Fechamento não cria gasto adicional; regras de pagamento parcial, juros e estorno estão pendentes. |
| Statement Payment (pagamento de fatura) | Saída de uma conta que reduz a obrigação do cartão. | Não cria segunda despesa das compras já reconhecidas. |
| Refund (reembolso) | Devolução de valor ao household relacionada a um gasto anterior. | Relação com período e categoria originais ainda precisa de decisão. |
| Reversal (estorno) | Cancelamento total ou parcial de lançamento, preservando rastreabilidade do evento original. | Efeitos após pagamento de fatura e apresentação histórica ainda precisam de decisão. |
| Reconciliation (reconciliação) | Comparação, em uma data, entre saldo calculado no Prumo e saldo informado por fonte externa. | Divergências devem ser examinadas; política de ajuste está pendente. |
| Currency (moeda) | Unidade monetária de um valor. | BRL exclusivo no MVP é proposta, não decisão. |
| Money (valor monetário) | Quantia associada a moeda e regra explícita de precisão. | Representação em centavos inteiros ou decimal apropriado aguarda ADR; ponto flutuante binário não atende BR-003. |

Os cenários de conferência estão em `financial-examples.md`. As alternativas para as decisões abertas estão em `model-proposals.md`.
