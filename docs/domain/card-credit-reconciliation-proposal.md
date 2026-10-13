# Reconciliação conceitual do crédito de cartão

**Status:** estudo da Sprint 1, anterior ao ERD. As igualdades e os exemplos aplicam ADR-006, ADR-008 e ADR-017 a ADR-024. A ADR-024 define a origem apresentada dos saldos individuais. Nomes de registros, chaves, estados técnicos e correspondência de linhas importadas são **HIPÓTESES**, não escolhas de persistência.

## O que deve ser explicado

Uma confirmação de crédito, sua aplicação à dívida, a classificação econômica e a distribuição entre faturas respondem a perguntas diferentes. A primeira informa o valor que o emissor reconheceu; a segunda comprova a baixa da dívida; a terceira explica o efeito em receita, despesa e orçamento; a quarta mostra qual fatura recebeu o abatimento. Nenhuma das três últimas é outra entrada de dinheiro ou outra baixa da dívida. A devolução à conta da parte elegível é um caminho alternativo à aplicação no cartão; a devolução do excedente ainda exige decisão.

| Dimensão | Evidência necessária | Total que deve conservar | Situação sem detalhe da fonte |
|---|---|---|---|
| Crédito confirmado | Identificação, valor, cartão e data de confirmação pelo emissor; vínculo com compra quando conhecido | Valor confirmado da fonte | Sem vínculo confiável com compra, não inferir estorno elegível. |
| Aplicação à dívida | Valor efetivamente aplicado ao cartão e data efetiva ou estimada conforme ADR-019 | Uma baixa da dívida total igual ao valor aplicado | Sem comprovação de aplicação, manter apenas crédito a utilizar. |
| Origem da aplicação | Crédito confirmado que forneceu cada parcela aplicada | Parcelas com origem atribuída mais parcela com origem em revisão igual ao aplicado | Para parcelas elegíveis, usar créditos mais antigos primeiro como inferência corrigível (ADR-019); origem do excedente não explicada fica em revisão. |
| Natureza econômica | Estorno de compra, redução de outra despesa documentada, receita por baixa ou parte sem classificação | Soma das partes econômicas igual ao aplicado | Não criar receita nem novo estorno por inferência. A ADR-020 permite classificação manual parcial do excedente já aplicado. |
| Destino entre faturas | Fatura abatida e valor, se o emissor os identificar | Soma de destinos mais parcela sem destino igual ao aplicado | Distribuição manual é provisória; dívida total é confirmada, saldos individuais são estimados (ADR-019). |
| Devolução à conta | Entrada efetiva identificada e vinculada ao crédito | Parte devolvida não pode continuar a utilizar nem ser aplicada ao cartão | Parte excedente devolvida ainda não tem classificação econômica decidida. |

Uma linha de fatura pode ser a evidência da **aplicação** e do **destino**, mas sua presença não a transforma em novo crédito confirmado. Uma linha de confirmação pode anteceder a aplicação. Uma aplicação pode consumir parte de um crédito ou parcelas de vários créditos. A correspondência entre linhas externas e esses fatos deve ficar visível, inclusive quando ainda for inferida ou não identificada.

## Igualdades e limites verificáveis

No modelo, os valores das partes são centavos inteiros não negativos de uma mesma moeda; os exemplos abaixo os exibem em reais. Para um crédito confirmado cuja origem das utilizações esteja atribuída, em uma posição de leitura: `C = A + D + U`, onde `C` é o valor confirmado, `A` o total aplicado ao cartão, `D` o total devolvido à conta e `U` o total ainda a utilizar. Aplicação e devolução da mesma parcela são mutuamente exclusivas. Se uma aplicação agregada ainda tiver origem não atribuída, a igualdade por crédito e seu saldo individual a utilizar ficam **em reconciliação**, sem apresentar um número individual como confirmado. O valor total aplicado e a baixa da dívida permanecem identificados pela evidência do emissor. Enquanto a natureza de uma devolução excedente estiver pendente, a igualdade controla quantidade, sem lhe atribuir receita ou despesa.

Para cada aplicação comprovada: `a = Eo + Ed + R + P`. `Eo` soma os estornos elegíveis das compras vinculadas aos créditos de origem; `Ed` é redução de outra despesa documentada; `R`, receita por baixa da dívida; `P`, parte aplicada sem classificação econômica. A classificação pode mudar `Ed`, `R` e `P` sem mudar `a`. Uma correção comprovada do vínculo de compra também pode mudar `Eo`, respeitando o limite ainda redutível de cada compra afetada. A dívida total diminui **uma vez por `a`**, nunca pela soma dessa baixa com suas partes econômicas.

Em outra dimensão, `a = Fc + Fe + Fu`: `Fc` é o valor atribuído a faturas com confirmação do emissor, `Fe` é a atribuição manual estimada e `Fu` não tem destino. Cada parcela vai a uma única dessas situações. Nenhuma atribuição supera o valor aberto da fatura, nem cruza cartão ou household. Essa igualdade não se soma à igualdade econômica; ambas descrevem os **mesmos** `a` centavos. As parcelas atribuídas aos créditos de origem mais a parcela com origem ainda não identificada também somam `a`; a parcela não identificada fica em revisão, sem vínculo inventado.

O total de estornos e devoluções classificados como relativos a uma compra não supera seu valor original, descontadas correções e valores já reconhecidos. A redução de outra despesa usa seu saldo ainda redutível após reduções e reembolsos anteriores. Receita por baixa de dívida não cria movimento de conta nem libera orçamento de despesa. Atribuição entre faturas não altera classificação econômica, mês de efeito ou dívida total.

## Exemplo de uma aplicação e duas revisões

1. Compra antiga paga de R$ 80; emissor confirma crédito `C = 100` reais no cartão, dos quais R$ 80 são elegíveis como estorno e R$ 20 excedentes. Sem aplicação, `A = 0`, `D = 0`, `U = 100`; dívida, caixa, despesa e orçamento não mudam pela confirmação.
2. Com dívida aberta suficiente, o emissor comprova aplicação de R$ 50 em março, sem discriminar as partes. A ADR-019 infere `Eo = 50`, `P = 0`. Logo `A = 50`, `U = 50`, dívida −R$ 50, despesa de março −R$ 50; ficam R$ 30 elegíveis e R$ 20 excedentes a utilizar. A inferência fica marcada e corrigível.
3. Documento posterior comprova que a **mesma** aplicação consumiu R$ 30 elegíveis e R$ 20 excedentes. Corrigir para `Eo = 30`, `P = 20`, `U = 50` elegíveis. A dívida continua R$ 50 menor e o caixa não muda; a despesa de março passa a R$ −30. Preservar a divisão anterior e a fonte da correção.
4. Em abril, usuário autorizado justifica classificar os R$ 20 aplicados: R$ 12 como redução de outra despesa documentada em Casa e R$ 8 como receita por baixa de dívida. A aplicação de março passa a `50 = 30 + 12 + 8 + 0`. Março mostra despesa −R$ 30 na categoria da compra antiga, despesa −R$ 12 em Casa e receita +R$ 8; abril registra apenas a revisão. A dívida segue R$ 50 menor, o crédito a utilizar segue R$ 50 e nenhuma conta recebe movimento.

Se a aplicação de R$ 50 também não identificar a fatura, o valor fica inicialmente em `Fu = 50`. Uma atribuição manual de R$ 50 a fatura antiga muda para `Fe = 50` e mostra o saldo dessa fatura como **estimado**. Comprovação posterior de destino na fatura nova muda para `Fc = 50`, preservando o total aplicado e todos os efeitos econômicos já descritos. A revisão do destino e a revisão econômica são independentes.

## Conferências ao revisar ou importar

- Localizar a fonte e a aplicação já registradas antes de criar efeito. Releitura da mesma evidência não acrescenta crédito, baixa, parte econômica ou devolução. O identificador físico e a regra de correspondência ainda serão definidos.
- Conferir a igualdade do crédito após cada aplicação, devolução ou correção. Não permitir total aplicado ou devolvido acima do crédito confirmado, nem aplicação acima da dívida total aberta; quando a obrigação de destino for conhecida, respeitar também seu valor aberto.
- Conferir a igualdade econômica **por aplicação**, inclusive a parcela pendente, e os limites de cada despesa vinculada. Uma classificação manual exige autor autorizado, justificativa e trilha; fonte do emissor e escolha do usuário continuam distinguíveis.
- Conferir a igualdade de destino **por aplicação** e o escopo do cartão e household. Se o destino não for comprovado, não apresentar saldo exigível individual como confirmado nem recomendar pagamento baseado apenas na estimativa.
- Preservar a aplicação e sua baixa ao corrigir origem, parte econômica, destino ou data. Correção de data move os mesmos efeitos entre períodos conforme ADR-019; correção de categoria reclassifica o mês do efeito. Não recalcular silenciosamente atribuições já registradas quando chegar crédito antigo em importação posterior.
- Mostrar divergências entre posição calculada e fonte externa com data, escopo e valores comparáveis. Uma diferença não autoriza crédito, encargo, ajuste genérico nem receita automática (ADR-008/016).

## Pendências antes do ERD ou contrato de importação

1. **Comprovação operacional:** a ADR-021 aceita compensação explícita ou fatura fechada com abatimento demonstrável; diferença isolada de saldo não prova aplicação. A data estimada por fechamento só vale se a fatura comprovar aplicação naquele ciclo (ADR-019).
2. **Correspondência externa:** a ADR-021 exige reconhecer leituras repetidas do mesmo fato e revisar colisões sem identificador estável. A ADR-022 define como exibir e resolver valor conflitante já aplicado, mantendo o efeito anterior contestado até revisão rastreável. Identificar a mesma confirmação ou aplicação em arquivos distintos, inclusive linha agregada que reúne vários créditos, ainda exige contrato por formato e estados de revisão.
3. **Origem do excedente em aplicação agregada:** a ADR-019 define ordem para parcelas elegíveis, mas não define rateio automático das parcelas excedentes entre créditos diferentes. Mantê-las em revisão até haver regra ou evidência.
4. **Distribuição entre faturas:** a ADR-022 detalha a substituição da estimativa pela confirmação do emissor; a ADR-023 mantém em revisão a alocação de pagamento parcial histórico quando o destino do crédito torna incertos os saldos individuais. `multi-credit-payment-cycle-example.md` demonstra dois créditos, dois pagamentos e correção de valor. A ADR-024 distingue saldo confirmado pela fonte, calculado pela regra e estimado manualmente; múltiplas fontes conflitantes e critérios de confirmação em ciclos mais complexos ainda exigem detalhamento.
5. **Devolução do excedente e crédito sem compra confiável:** a classificação econômica desses casos não foi decidida. Não estender a ADR-020 a eles por analogia.

O ERD poderá escolher tabelas e vínculos depois de demonstrar essas igualdades com casos de aplicação parcial, múltiplas fontes, correção posterior, fatura desconhecida e releitura da mesma evidência. Este documento não escolhe armazenamento, API ou tecnologia de importação.
