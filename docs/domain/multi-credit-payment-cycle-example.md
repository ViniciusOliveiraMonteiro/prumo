# Dois créditos e dois pagamentos no mesmo ciclo

**Status:** estudo da Sprint 1 antes do ERD, com invariantes revisadas. Valores fictícios em BRL. As baixas totais, o período econômico, o tratamento de conflito, a revisão de destinos e a origem apresentada dos saldos aplicam ADR-008 e ADR-019 a ADR-024. As duas distribuições por fatura abaixo são **cenários condicionais**, não atribuições automáticas nem fatos do emissor.

## Premissas e fatos comprovados

Há duas faturas abertas do mesmo cartão e household: antiga de R$ 100 e nova de R$ 120. Caixa inicial R$ 500 e dívida total R$ 220. Os créditos A (R$ 30, categoria Alimentação) e B (R$ 20, categoria Casa) são elegíveis como estornos de compras antigas já pagas e têm fontes distintas; neste exemplo o emissor comprova a aplicação integral de cada um ao cartão, mas não informa a fatura de destino. O emissor comprova dois pagamentos da conta, P1 de R$ 30 e P2 de R$ 40, sem discriminar a fatura. Os quatro fatos ocorrem nesta ordem no mesmo mês; não há encargos ou outros movimentos.

| Etapa | Evento comprovado | Caixa | Dívida total | Despesa do mês pelos créditos | Situação entre faturas |
|---|---|---:|---:|---|---|
| Inicial | Faturas antiga R$ 100 e nova R$ 120 | R$ 500 | R$ 220 | R$ 0 | R$ 100/R$ 120 conhecidos antes dos fatos. |
| 1 | Crédito A aplicado: R$ 30 | R$ 500 | R$ 190 | Alimentação −R$ 30 | Destino de A em revisão. |
| 2 | Pagamento P1: R$ 30 | R$ 470 | R$ 160 | Sem nova despesa | Alocação de P1 em revisão pela ADR-023. |
| 3 | Crédito B aplicado: R$ 20 | R$ 470 | R$ 140 | Casa −R$ 20, além de A | Destino de B em revisão. |
| 4 | Pagamento P2: R$ 40 | R$ 430 | R$ 100 | Sem nova despesa | Alocação de P2 em revisão pela ADR-023. |

Conferência independente das faturas: dívida total = R$ 220 − R$ 30 − R$ 30 − R$ 20 − R$ 40 = **R$ 100**; caixa = R$ 500 − R$ 30 − R$ 40 = **R$ 430**. Os créditos geram R$ −50 de despesa no mês, em suas categorias originais, e os pagamentos não a repetem. Cada aplicação e cada pagamento existe **uma vez**; suas possíveis distribuições não são novos fatos financeiros.

## Dois destinos possíveis, com pagamento pela ordem da ADR-008 depois de cada destino conhecido

| Etapa | A e B abatidos da fatura antiga | A e B abatidos da fatura nova |
|---|---|---|
| Inicial | Antiga R$ 100; nova R$ 120 | Antiga R$ 100; nova R$ 120 |
| Após A | R$ 70/R$ 120 | R$ 100/R$ 90 |
| Após P1 | R$ 40/R$ 120; P1 = R$ 30/R$ 0 | R$ 70/R$ 90; P1 = R$ 30/R$ 0 |
| Após B | R$ 20/R$ 120 | R$ 70/R$ 70 |
| Após P2 | **R$ 0/R$ 100**; P2 = R$ 20/R$ 20 | **R$ 30/R$ 70**; P2 = R$ 40/R$ 0 |

Os dois resultados finais somam **R$ 100** e são compatíveis com os totais confirmados. Antes da prova do destino de A e B, a ADR-023 não aloca automaticamente P1/P2 por fatura. Se o usuário escolher o primeiro cenário como atribuição provisória, mostrar R$ 0/R$ 100 apenas como **estimativa**. Se o emissor comprovar depois o segundo destino, revisar os mesmos créditos e pagamentos para R$ 30/R$ 70, com fonte e trilha; caixa R$ 430, dívida total R$ 100 e despesa −R$ 50 não mudam. A confirmação do destino dos créditos, sozinha, não prova como o emissor alocou os pagamentos: a ordem da ADR-008 é uma proposta corrigível para os pagamentos históricos em revisão.

Se o emissor confirmar só A, B ainda pode ter abatido qualquer fatura aberta do mesmo cartão. P1 e P2 permanecem em revisão na parte que depender de B; não apresentar a fatura individual como exigível confirmada. O total R$ 100 continua confirmado. Se o destino de ambos os créditos for comprovado, mas nenhum pagamento tiver destino informado, a aplicação retroativa da ordem da ADR-008 aos pagamentos históricos exige a revisão rastreável da ADR-023 e não transforma, por si, a distribuição em informação confirmada pelo emissor.

## Correção posterior de valor

Suponha que outra fonte informe que a aplicação B foi de R$ 15, e não R$ 20. A ADR-022 mantém inicialmente o cálculo de **R$ 100 contestado**, mostrando **R$ 105** como resultado da nova alegação; não soma R$ 15 nem substitui B automaticamente. Se a correção da **mesma aplicação** for comprovada, dívida total passa a R$ 105, caixa permanece R$ 430 e o efeito de B em Casa passa de R$ −20 a R$ −15 no mês da aplicação. Se B era crédito confirmado de R$ 20, R$ 5 voltam a utilizar. A e os dois pagamentos conservam valores e datas. As atribuições individuais anteriores precisam ser revalidadas; não se convertem silenciosamente em saldos confirmados.

Sob a hipótese adicional de destinos conhecidos e pagamentos pela ordem da ADR-008, B = R$ 15 produziria R$ 0/R$ 105 se A e B tivessem ido à antiga, ou R$ 30/R$ 75 se ambos tivessem ido à nova. Ambos somam R$ 105; nenhum desses pares é automaticamente confirmado apenas pela correção do valor.

## Variação de ordem

Se P1 de R$ 30 ocorrer **antes** de qualquer crédito sem destino, as faturas ainda têm abertos conhecidos de R$ 100/R$ 120 naquele instante: a ADR-008 pode alocar P1 automaticamente à antiga, deixando R$ 70/R$ 120. Uma aplicação posterior de A sem destino não reescreve P1 por si. Um pagamento seguinte, feito enquanto o destino de A continuar desconhecido e afetar os abertos individuais, entra em revisão pela ADR-023. A ordem e a data de cada fato precisam ser preservadas para reconstruir posições históricas.

## Origem dos saldos individuais após revisão

Os totais de caixa e dívida, as partes econômicas e a necessidade de revisão já estão definidos. Pela ADR-024 aceita, quando o emissor confirma o destino de A e B, mas não informa o destino de P1/P2, a revisão rastreável pela ordem da ADR-008 produz saldo **calculado pela regra**. O par R$ 30/R$ 70 no segundo cenário só é **confirmado pelo emissor** se houver fonte também para os destinos dos pagamentos. Se o usuário atribuir destinos provisórios, o saldo afetado é **estimado pelo usuário**. Sem atribuição necessária, não há saldo individual pontual; mostrar a dívida total separada.

## Revisão das invariantes do ciclo

| Conferência | Antes da correção | Após comprovar B = R$ 15 |
|---|---:|---:|
| Caixa final: R$ 500 − P1 − P2 | R$ 430 | R$ 430 |
| Dívida total: R$ 220 − A − P1 − B − P2 | R$ 100 | R$ 105 |
| Crédito B: confirmado = aplicado + a utilizar | R$ 20 = R$ 20 + R$ 0 | R$ 20 = R$ 15 + R$ 5 |
| Efeito econômico elegível: A + B aplicados | R$ 50 de redução de despesa | R$ 45 de redução de despesa |
| Soma das faturas em cada cenário completo | R$ 0 + R$ 100 = R$ 30 + R$ 70 = R$ 100 | R$ 0 + R$ 105 = R$ 30 + R$ 75 = R$ 105 |

As igualdades usam os mesmos fatos nos dois destinos possíveis; a soma por fatura só vale quando todos os destinos necessários estiverem atribuídos na mesma data e cartão. Durante o conflito de B, os R$ 100 anteriores seguem **contestados** pela ADR-022, e R$ 105 é apenas o resultado alegado pela nova fonte até revisão. Pagamentos não geram despesa adicional, e mudar a origem apresentada do saldo não altera caixa, dívida nem efeito econômico. Releitura das mesmas fontes não cria novos fatos. A correspondência operacional entre arquivos ainda depende de contrato por formato.
