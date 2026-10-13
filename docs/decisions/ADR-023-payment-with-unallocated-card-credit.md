# ADR-023: pagamento parcial com crédito aplicado sem fatura de destino

- **Status:** aceito para pagamento com crédito aplicado sem fatura de destino na Sprint 1
- **Data:** 2026-10-06

## Contexto

A ADR-008 aloca pagamento parcial da fatura aberta mais antiga para a mais recente, com correção rastreável. A ADR-019 reconhece crédito aplicado ao **cartão** mesmo quando o emissor omite a fatura abatida: a dívida total cai, mas saldos individuais continuam estimados ou sem destino. A ADR-022 preserva a diferença entre distribuição provisória e confirmada. Esta ADR define a exceção para a alocação do **pagamento** quando esses saldos são incertos.

O pagamento comprovado continua reduzindo caixa e dívida total pelo valor pago e não cria despesa (ADR-008). A dúvida afeta somente qual fatura aparece como paga e qual saldo individual ainda é exigível.

## Exemplo que expõe a diferença

Fatura antiga de R$ 70 e nova de R$ 100: dívida total R$ 170. O emissor comprova R$ 40 de crédito **aplicado ao cartão**, sem indicar fatura: dívida total R$ 130. Depois, há pagamento comprovado de R$ 50, dentro da dívida aberta: caixa −R$ 50 e dívida total R$ 80, sem nova despesa. A fatura do crédito ainda não foi identificada.

| Distribuição que o emissor pode confirmar depois | Após crédito de R$ 40 | Pagamento de R$ 50 pela ordem da ADR-008, com saldos conhecidos | Após pagamento |
|---|---|---|---|
| Crédito na antiga | Antiga R$ 30; nova R$ 100 | R$ 30 à antiga; R$ 20 à nova | Antiga R$ 0; nova R$ 80 |
| Crédito na nova | Antiga R$ 70; nova R$ 60 | R$ 50 à antiga; R$ 0 à nova | Antiga R$ 20; nova R$ 60 |

Ambos os caminhos conservam R$ 170 − R$ 40 − R$ 50 = R$ 80 de dívida total, mas dão saldos individuais diferentes. Alocar R$ 50 usando o valor **original** da fatura antiga ou uma distribuição **provisória** do crédito escolheria um dos caminhos sem prova de que o emissor fez isso.

## Alternativas

| Alternativa | Vantagem | Custo |
|---|---|---|
| A. Usar a distribuição provisória do crédito para alocar o pagamento automaticamente | Produz saldos por fatura imediatamente. | Encadeia duas inferências; correção posterior do destino do crédito exigiria alterar a alocação do pagamento e poderia mostrar saldo exigível falso. |
| B. Registrar caixa e dívida total, manter a alocação por fatura do pagamento em revisão (escolhida) | Preserva os totais confirmados e explicita o que falta para calcular cada fatura. | Saldos individuais e sugestões de pagamento continuam indisponíveis até revisão. |
| C. Alocar pela ordem da ADR-008 usando valores originais das faturas | Aplica a regra automática sem depender da estimativa do usuário. | Pode atribuir pagamento acima do aberto real da fatura que já recebeu crédito; o total de saldos individuais não explicaria a dívida confirmada. |

## Decisão

Se houver crédito aplicado ao cartão com **destino entre faturas ainda não confirmado** e isso tornar incerto o valor aberto usado pela regra da ADR-008, registrar o pagamento comprovado integralmente uma vez: saída da conta e baixa da dívida total, limitado à dívida total aberta. Manter **em revisão** sua alocação entre faturas; não aplicar automaticamente a ordem da mais antiga usando saldo original ou estimativa do usuário. Mostrar valor do pagamento, crédito global sem destino, dívida total após ambos e motivo da pendência. Saldos individuais permanecem estimados ou indisponíveis, sem recomendação de pagamento baseada neles. Essa é uma exceção delimitada à alocação automática da ADR-008; quando os saldos individuais estiverem confirmados, a ordem normal volta a valer para **novos pagamentos**. A alocação do pagamento histórico pendente exige revisão rastreável.

O usuário autorizado pode informar uma alocação **provisória** do crédito e do pagamento para análise, com base da escolha e trilha. As partes de cada fato somam separadamente seu valor comprovado: crédito R$ 40, pagamento R$ 50. A mesma parte não pode ser atribuída duas vezes e nenhuma atribuição pode exceder o aberto **estimado** do cenário provisório; a interface rotula todos esses saldos por fatura como estimativas, sem valor exigível confirmado. A atribuição manual não altera caixa, dívida total, despesas ou data de qualquer fato.

Se o emissor indicar diretamente a distribuição do pagamento, guardar essa evidência. Se ela não puder ser conferida contra as obrigações conhecidas porque o destino do crédito ainda é incerto, manter o saldo individual em revisão e mostrar a divergência, sem apagar o pagamento total comprovado. Quando o emissor confirmar o destino do crédito, recalcular os saldos individuais **antes do pagamento** a partir dos mesmos fatos e **propor** a alocação mais antiga primeiro para o pagamento histórico cujo destino permaneça desconhecido. Revisar e registrar a atribuição com fonte, base e histórico; não redistribuir silenciosamente pagamento já registrado. Se o emissor confirmar também o destino do pagamento, essa prova prevalece sobre a proposta automática, preservando a trilha. Divergência entre documentos segue a ADR-022.

## Critérios de aceite

- No exemplo, crédito de R$ 40 e pagamento de R$ 50 reduzem a dívida de R$ 170 para R$ 80; apenas o pagamento reduz caixa em R$ 50, sem despesa adicional. Antes de confirmar os destinos, nenhum dos dois pares de saldos por fatura aparece como confirmado.
- Uma atribuição provisória do crédito à fatura antiga e do pagamento em R$ 30/R$ 20 pode mostrar R$ 0/R$ 80 **estimados**. Prova posterior de crédito na nova e pagamento R$ 50/R$ 0 corrige os saldos para R$ 20/R$ 60 sem segunda baixa, segunda saída de caixa ou nova despesa.
- Corrigir apenas o destino do crédito sem ainda saber o destino do pagamento deixa a alocação deste em revisão; oferecer a ordem da ADR-008 como proposta rastreável, sem alterar silenciosamente os registros anteriores.
- Pagamento acima da dívida total aberta é recusado no registro comum; linha importada acima desse limite fica para revisão conforme ADR-008. Não criar saldo credor por causa da incerteza entre faturas.
- Fatura ou conta de outro cartão/household é rejeitada. Valor, fonte, status de confirmação e alterações de cada atribuição permanecem auditáveis.

## Consequências e pendências

A alternativa B conserva o caixa e a dívida total comprovados enquanto evita apresentar uma alocação por fatura como fato do emissor. Ela exige uma visão de revisão para pagamento e crédito com distribuição pendente. O ERD deve permitir duas distribuições independentes sobre os mesmos fatos financeiros, sem criar pagamentos ou créditos adicionais.

Antes de implementar, ainda é preciso definir o contrato físico das atribuições, a concorrência de revisões, os campos de fonte por formato e a interface do estado estimado. `docs/domain/multi-credit-payment-cycle-example.md` demonstra dois créditos, dois pagamentos e uma correção; a distinção entre saldo confirmado pela fonte, calculado pela regra e estimado manualmente segue a ADR-024 aceita. Ciclos mais complexos e critérios de confirmação por fonte agregada ainda exigem exemplos. A regra desta ADR cobre apenas pagamento com crédito já aplicado cuja fatura de destino permaneça desconhecida.
