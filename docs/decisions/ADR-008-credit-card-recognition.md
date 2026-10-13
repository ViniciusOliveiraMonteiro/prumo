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

Para compra parcelada em centavos inteiros de BRL, o cronograma conserva o total original: dividir o total de centavos igualmente pelo número de parcelas e distribuir os centavos restantes, um por vez, às **primeiras parcelas**. Em compra de valor positivo, a quantidade de parcelas deve ser positiva e **não pode exceder o total em centavos**; rejeitar a solicitação inteira se alguma parcela padrão ficaria em R$ 0,00. Cada parcela corrigida para refletir o emissor também deve permanecer positiva. Se a fatura do emissor usar outra distribuição, o usuário pode corrigir os valores das parcelas, preservando a soma igual ao total da compra e a trilha da correção. A alteração do cronograma não cria nova despesa nem muda a despesa integral já reconhecida na compra.

O MVP admite **pagamento parcial**: cada pagamento reduz caixa e obrigação apenas pelo valor efetivamente pago; o restante permanece como dívida em aberto. Quando houver mais de uma fatura em aberto do mesmo cartão, o Prumo distribui automaticamente o valor pago da **fatura mais antiga para a mais recente**, ordenadas pela data de fechamento. O usuário pode corrigir a distribuição se o emissor a aplicar de outro modo; a distribuição original e a correção ficam rastreáveis. A correção não altera o valor total pago, o movimento de caixa, a dívida total nem cria despesa. O pagamento comum deve ser positivo e **não exceder a dívida total aberta**. Valor acima dela é recusado sem gravar efeito parcial; uma linha importada com esse valor permanece sinalizada para revisão, sem ser descartada ou convertida em saldo credor automaticamente. Saldo credor do cartão fica fora do MVP.

**Exceção delimitada (ADR-023):** se um crédito já aplicado ao cartão ainda não tem fatura de destino confirmada e por isso o aberto individual é incerto, o pagamento comprovado reduz caixa e dívida total, mas sua distribuição entre faturas fica em revisão. Não usar valores originais nem uma atribuição provisória do crédito para aplicar automaticamente a ordem acima. Uma atribuição manual de pagamento nesse estado é apenas estimativa; não fundamenta saldo exigível ou recomendação de pagamento. A ordem da fatura mais antiga volta a valer para novos pagamentos quando os abertos individuais estiverem confirmados. O pagamento histórico pendente é revisado com trilha, sem nova saída de caixa ou baixa.

Se a fatura apresentar juros ou tarifas, o MVP registra cada encargo pelo valor informado pelo emissor como novo evento de despesa vinculado ao cartão, no mês em que consta na fatura; o encargo aumenta a obrigação. O Prumo não calcula encargos automaticamente a partir do saldo não pago e não presume cobrança apenas porque houve pagamento parcial.

Para organizar compromissos, o Prumo atribui automaticamente cada compra ao ciclo da fatura usando a **data da compra e o dia de fechamento configurado** do cartão. Se o dia configurado não existe em um mês, o fechamento previsto é o **último dia desse mês** (por exemplo, dia 31 configurado → 28 ou 29 de fevereiro). Compra no próprio dia do fechamento previsto ou depois dele entra no ciclo seguinte: sem o horário de corte do emissor, o dia de fechamento não é tratado como pertencente ao ciclo que se encerra. O usuário pode corrigir a atribuição quando a fatura real do emissor divergir; a correção mantém rastreável o ciclo inferido e não desloca a despesa do mês da compra. Esta é uma regra de atribuição de fatura, separada do reconhecimento da despesa.

Em compra parcelada, a **primeira parcela entra no ciclo atribuído à compra** e cada parcela seguinte entra no próximo ciclo mensal do cartão, em ordem. Se o emissor usar outros ciclos, o usuário pode corrigir a atribuição das parcelas, preservando o vínculo com a compra, os valores totais e a trilha da correção. Cada ciclo usa sua própria data de fechamento prevista, inclusive o último dia quando o dia configurado não existir naquele mês. A atribuição das parcelas não desloca a despesa integral da data da compra.

O cartão também possui um **dia de vencimento configurado**. Para cada mês a partir do mês do fechamento, o Prumo calcula a data candidata usando o dia configurado; se ele não existir naquele mês, usa o **último dia do mês**. A data prevista é a primeira candidata **estritamente posterior ao fechamento previsto** da fatura. O usuário pode corrigir a data quando o emissor informar outra; a previsão original e a correção ficam rastreáveis. O dia configurado é uma regra de previsão, não uma afirmação sobre o calendário real do emissor.

Na reconciliação do cartão, o Prumo compara dívida calculada com posição informada pelo emissor somente quando data de corte e escopo são comparáveis. Se houver divergência, mostra os dois valores, a diferença e suas fontes para revisão. **A diferença não cria automaticamente despesa, encargo, crédito nem ajuste de dívida.** Quando a causa for identificada, o evento correspondente pode ser registrado com origem rastreável. Se ela permanecer desconhecida, a divergência continua visível: o MVP **não permite ajuste manual genérico** para igualar os saldos. O tratamento de ajustes excepcionais sem causa fica fora do MVP.

Cada visão deve identificar período e significado. Não se deve somar gasto na compra, parcela prevista e pagamento como se fossem três despesas. **O orçamento mensal consome o valor integral da compra no mês da compra**, acompanhando a despesa reconhecida; parcelas em faturas futuras e pagamento não consomem novamente esse orçamento. O orçamento é referência visual no MVP: quando o consumo ultrapassa o valor planejado, o Prumo mostra o excedente e um alerta, sem bloquear o registro da compra. A visão de compromissos e caixa continua separada. O modelo persistido de compra/parcela/transação e as regras detalhadas do emissor ainda não estão decididos.

## Consequências

- Uma compra de R$ 120 em 31/01 é despesa de janeiro; pagamento em 12/02 é saída de caixa de fevereiro, sem despesa adicional.
- Uma compra de R$ 100 em três parcelas é despesa de R$ 100 no mês da compra; o cronograma futuro conserva R$ 100 no total e não alimenta novamente o total de despesas.
- Se o orçamento do mês da compra é R$ 200 e uma compra de consumo parcelada de R$ 120 é atribuída a ele, o consumo desse orçamento passa a R$ 120 e restam R$ 80; as parcelas posteriores não o consomem de novo.
- Se o orçamento do mês é R$ 200 e o consumo anterior é R$ 180, uma compra de R$ 50 é registrada normalmente: o consumo chega a R$ 230 e o Prumo mostra alerta com excedente de R$ 30.
- R$ 100,00 em três parcelas gera R$ 33,34 + R$ 33,33 + R$ 33,33; R$ 10,00 em seis gera quatro parcelas de R$ 1,67 e duas de R$ 1,66. Correção para valores do emissor mantém a soma exata e a despesa original.
- R$ 0,02 em três parcelas é recusado sem criar compra ou cronograma, pois uma parcela seria R$ 0,00. R$ 0,03 em três parcelas gera três parcelas de R$ 0,01.
- Com obrigação de R$ 120 e caixa de R$ 500, pagar R$ 50 deixa obrigação de R$ 70 e caixa de R$ 450, antes de quaisquer outros encargos. A despesa original permanece R$ 120.
- Se a fatura seguinte informar R$ 5 de juros sobre os R$ 70 em aberto, registrar R$ 5 de nova despesa no mês dessa fatura e dívida total de R$ 75. Os R$ 5 não alteram a despesa original de R$ 120.
- Com fechamento configurado no dia 5, uma compra em 06/02 é atribuída automaticamente ao ciclo que fecha em 05/03, mesmo que seja despesa de fevereiro. Se a fatura do emissor a colocar em outro ciclo, o usuário pode corrigir a atribuição sem mudar o mês da despesa.
- Se a compra de R$ 100,00 em 06/02 for parcelada em três vezes, com fechamento no dia 5, as parcelas padrão de R$ 33,34, R$ 33,33 e R$ 33,33 entram, respectivamente, nos ciclos de 05/03, 05/04 e 05/05. Os R$ 100,00 permanecem despesa de fevereiro.
- Compra em 05/02, no próprio dia configurado de fechamento, também vai por padrão ao ciclo de 05/03; uma divergência da fatura real pode ser corrigida. A despesa continua em fevereiro.
- Com fechamento configurado no dia 31, o fechamento previsto de fevereiro é 28/02 em ano comum ou 29/02 em ano bissexto. Compra nesse último dia vai por padrão ao ciclo que fecha em 31/03; uma compra no dia anterior pertence ao ciclo de fevereiro. Ambas continuam despesas de fevereiro.
- Com fechamento em 05/02 e dia de vencimento 12, a previsão é 12/02. Com fechamento em 05/02 e dia de vencimento 3, a previsão é 03/03. Ambas podem ser corrigidas se o emissor informar outra data.
- Com fechamento em 31/01 e dia de vencimento 31, a data candidata de janeiro não é posterior ao fechamento; a de fevereiro é 28/02 ou 29/02, conforme o ano, e vira o vencimento previsto. Se o emissor informar outra data, ela pode ser corrigida.
- Com fatura antiga de R$ 70 em aberto e nova de R$ 100, pagamento de R$ 80 quita os R$ 70 da antiga e abate R$ 10 da nova. Restam R$ 90 na nova e R$ 90 de dívida total; a saída de caixa é R$ 80 e a despesa das compras não muda. Se a distribuição real for outra, o usuário corrige somente a atribuição do pagamento.
- Com dívida total aberta de R$ 70, tentativa de registrar pagamento comum de R$ 100 é recusada sem saída de caixa ou baixa de dívida no Prumo. Se os R$ 100 vierem de extrato, a linha fica para revisão. O crédito potencial de R$ 30 exige regra futura.
- Se a dívida calculada é R$ 70 e uma posição comparável do emissor informa R$ 75 sem linha que explique R$ 5, exibir divergência de R$ 5 para revisão. Não criar encargo de R$ 5 apenas para igualar os saldos.
- Após revisão sem identificar a origem dos R$ 5, manter os R$ 70 calculados e a divergência visível. Não oferecer comando de ajuste genérico de R$ 5 no MVP.
- O modelo deve permitir relacionar compra, cronograma, fatura e pagamento para explicar cada número.
- Relatórios históricos e métricas devem declarar qual visão usam. A taxa de poupança da seção 12 do Plano Mestre requer revisão explícita dessa semântica antes de virar indicador de produto.

## Pendências

Definir calendário efetivo do emissor quando divergir do fechamento previsto, representação futura de saldo credor e tratamento definitivo de importação com pagamento acima da dívida, eventual fluxo futuro de ajuste excepcional, tipo/categoria de cada encargo e correção de valor informado pelo emissor. A ADR-018 define o estorno confirmado aplicado à obrigação aberta de compra ainda não paga e o mês de reconhecimento do crédito destinado a ciclo futuro. A ADR-019 define o crédito no cartão após pagamento sem dívida aberta, seus efeitos integrais ou parciais quando aplicado ou devolvido, a atribuição do crédito mais antigo primeiro para total aplicado confirmado e a atribuição manual provisória quando a fatura de destino não for identificada; detalhes de interface e importação dessa revisão e outros reembolsos no cartão ainda precisam de regra própria. A ADR-017 cobre apenas reembolso de compra paga diretamente. O MVP usa uma categoria por compra, sem divisão por categorias (Plano Mestre, seção 11.2). Essas pendências não alteram a regra de não duplicar a compra.

## Gatilhos para revisitar

Uso real demonstrar que o relatório principal por data da compra impede a leitura mensal do household; novos tipos de operação que exijam reconhecimento diferente, como aquisição de ativo ou juros.

## Conceitos para estudo

Competência simplificada, fluxo de caixa, passivo, ciclo de fatura, compromisso futuro e conciliação entre visões.
