# Exemplos financeiros para discussão do modelo

**Status:** em estudo (Sprint 1). Valores fictícios em BRL. Este documento testa BR-001 a BR-003 e as decisões de ADR-006, ADR-008, ADR-016, ADR-017, ADR-018, ADR-019, ADR-020, ADR-021, ADR-022 e ADR-023. Trechos marcados **HIPÓTESE** permanecem propostas, não contratos de implementação.

## Vocabulário das contas abaixo

- **Caixa:** soma das contas com dinheiro disponível. A conta de investimento é mostrada separadamente, mas continua sendo um ativo do household.
- **Passivo do cartão:** valor devido ao emissor. Um aumento do passivo reduz o patrimônio líquido.
- **Receita/despesa:** eventos econômicos do household. Compra de consumo no cartão é despesa integral na data da compra e consome o orçamento mensal nesse mês (ADR-008). Orçamento acima do planejado gera alerta com o excedente, sem bloquear o registro.
- **Patrimônio líquido neste exemplo:** caixa + investimento − passivo do cartão. Outros ativos e passivos foram omitidos.

Os exemplos são independentes entre si. Cada tabela parte do estado inicial indicado; os números não devem ser somados entre tabelas.

## 1. Salário, transferência e investimento (DOM-001/003)

Estado inicial: conta corrente R$ 0, poupança R$ 0, investimento R$ 0, passivos R$ 0.

| Evento | Corrente | Poupança | Investimento | Receita acumulada | Despesa acumulada | Patrimônio líquido |
|---|---:|---:|---:|---:|---:|---:|
| Salário de R$ 3.000 na corrente | 3.000 | 0 | 0 | 3.000 | 0 | 3.000 |
| Transferir R$ 1.000 da corrente para poupança | 2.000 | 1.000 | 0 | 3.000 | 0 | 3.000 |
| Transferir R$ 500 da poupança para investimento próprio | 2.000 | 500 | 500 | 3.000 | 0 | 3.000 |

**Invariante BR-001/ADR-007:** um evento de transferência liga dois movimentos opostos e atômicos; cada transferência reduz uma conta e aumenta outra pelo mesmo valor. Receita e despesa permanecem iguais. Depois dos dois efeitos, a soma das contas também permanece igual; se as datas efetivas diferirem, a soma das contas entre os dias cai temporariamente e uma posição separada em trânsito conserva o consolidado patrimonial para o par confirmado. Uma transferência para corretora só preserva a invariante patrimonial após os efeitos se o ativo de destino pertencer ao mesmo household e estiver incluído na visão. Movimentações entre households requerem outra regra.

**Datas distintas na transferência (ADR-007):** em cenário independente, A = R$ 2.000 e B = R$ 500 em 31/01. R$ 300 saem de A em 01/02, quando seus saldos ao fim do dia são A = R$ 1.700 e B = R$ 500. Os mesmos R$ 300 chegam a B em 03/02, quando os saldos são A = R$ 1.700 e B = R$ 800. O evento único continua com dois movimentos opostos e receita/despesa zero; a soma das contas é R$ 2.200 entre os dias e R$ 2.500 após a chegada. Em 01/02 e 02/02, mostrar R$ 300 em trânsito separadamente: consolidado patrimonial R$ 1.700 + R$ 500 + R$ 300 = R$ 2.500. Em 03/02, trânsito zera e o consolidado é R$ 1.700 + R$ 800 = R$ 2.500. Esse valor não é saldo disponível de nenhuma conta nem nova receita ou despesa. O caso de saída comprovada ainda sem par segue o exemplo abaixo.

**Saída comprovada sem chegada confirmada (ADR-007):** no mesmo cenário, suponha que em 01/02 só a saída de R$ 300 de A esteja comprovada. A mostra R$ 1.700 e B R$ 500; a soma conhecida das contas é R$ 2.200, mostrada como subtotal, com R$ 300 de débito em revisão em separado. O patrimônio afetado fica identificado como incompleto, sem número definitivo. O débito não é despesa, transferência confirmada nem R$ 300 em trânsito. Ao comprovar em 03/02 a entrada de R$ 300 em B e vincular o par, não criar segundo débito em A: B passa a R$ 800 e o consolidado histórico de 01/02 e 02/02 passa a mostrar R$ 300 em trânsito e R$ 2.500 de patrimônio explicado pelo par.

**Reconhecimento de salário (ADR-017):** se os R$ 3.000 remuneram trabalho de maio, mas chegam à conta em 05/06, o relatório principal mostra R$ 0 dessa receita em maio e R$ 3.000 em junho. O mês de referência pode constar na descrição sem deslocar o reconhecimento; receita ainda não recebida requer regra futura.

**Reconhecimento de despesa paga diretamente (ADR-017):** se uma compra de consumo de R$ 80 ocorre em 31/05 e o dinheiro sai da conta em 01/06, o relatório principal mostra R$ 0 dessa despesa em maio e R$ 80 em junho; a conta também diminui R$ 80 em junho. A data da compra pode ser preservada para contexto. Essa regra não se aplica à compra no cartão, que é despesa na data da compra (ADR-008).

## 2. Saldo inicial e reconciliação (DOM-002)

Conta corrente criada em 01/02 com saldo informado de R$ 5.000; o histórico anterior não será importado neste exercício. Em fevereiro entram R$ 200 de receita e saem R$ 80 de despesa. O saldo calculável desde o ponto de partida é `5.000 + 200 − 80 = R$ 5.120`. O saldo inicial de R$ 5.000 **não é receita de fevereiro**.

Se o extrato externo mostrar R$ 5.110, há divergência de R$ 10. Pela ADR-016, o sistema expõe a divergência para revisão; não cria ajuste automático. Persistência de snapshots e semântica de um ajuste aprovado ainda estão pendentes.

**Movimento anterior ao marco (ADR-016):** em outro cenário, a conta começa em 01/02 com R$ 5.000 e aparece entrada de R$ 200 em 31/01. Ela fica pendente e não altera o saldo derivado. Para incluí-la, a pessoa informa e justifica um novo marco anterior, por exemplo R$ 4.800 em 30/01, com trilha da correção. Na ausência de outros movimentos, 30/01 R$ 4.800 + 31/01 R$ 200 = 01/02 R$ 5.000. O Prumo não presume que o saldo anterior era R$ 4.800; esse valor precisa ser informado.

**Valor inicial incorreto após movimentos (ADR-016):** se o marco de 01/02 era R$ 4.990, mas foi digitado como R$ 5.000, corrigir com justificativa e trilha após os movimentos de +R$ 200 e −R$ 80 muda o saldo derivado de R$ 5.120 para R$ 5.110. Receita e despesa continuam R$ 200 e R$ 80. Uma posição externa de R$ 5.120 antes conciliada passa a mostrar divergência de R$ 10 para revisão; não há ajuste automático nem transação criada pela correção do marco.

**Movimento no dia do marco (ADR-016):** marco de R$ 5.000 em 01/02 representa o saldo no início de 01/02. Uma entrada efetiva de R$ 200 nessa mesma data integra o histórico e leva o saldo a R$ 5.200 após o movimento; somente os R$ 200 são receita, se o evento for classificado assim. Se uma saída de R$ 80 com a mesma data e sem horário confiável foi registrada depois, o histórico mostra entrada e saída nessa ordem de registro estável, sem afirmá-la como cronologia real. Após ambas, o saldo é R$ 5.120 em qualquer ordem. Um saldo intermediário da apresentação não prova a ordem efetiva dos acontecimentos.

**Consulta diária (ADR-016):** com os mesmos fatos, consultar o saldo em 01/02 sem horário retorna R$ 5.120, o saldo ao fim do dia após a entrada e a saída. O marco de R$ 5.000 é o saldo no início de 01/02; ele não é a resposta à consulta diária. A ordem de registro não altera o resultado.

**Marco corrigido para data posterior (ADR-016):** marco inicialmente registrado em 01/02 com R$ 5.000, entrada de R$ 200 em 02/02 e saída de R$ 80 em 04/02 resultam em R$ 5.120 no fim de 04/02. Com prova de que o ponto de partida correto é 03/02, a pessoa informa R$ 5.200 como saldo no início de 03/02 e justifica a correção. A entrada de 02/02 fica visível e pendente, fora do novo cálculo; a saída de 04/02 continua e o saldo no fim de 04/02 é R$ 5.120. Os R$ 5.200 precisam ser informados, não calculados automaticamente a partir da entrada anterior.

**Consulta anterior ao marco (ADR-016):** com marco de R$ 5.000 no início de 01/02, consultar saldo em 31/01 mostra “saldo não calculável antes do marco” e a data 01/02. R$ 0 e R$ 5.000 seriam valores incorretos para 31/01; um movimento anterior pendente não cria saldo calculável para essa data.

**Marco corrigido para data anterior sem movimento pendente (ADR-016):** se a data de início foi informada como 01/02 com R$ 5.000, mas a correta era 30/01, a pessoa informa e justifica o saldo de R$ 5.000 no início de 30/01. Sem movimentos em 30/01 e 31/01, a consulta ao fim de 31/01 passa a R$ 5.000 e a de 01/02 continua R$ 5.000. O mesmo valor nas duas datas decorre da informação fornecida e da ausência de movimentos conhecidos, não de cópia automática do marco antigo.

**Registro tardio (ADRs 016/017):** com marco de R$ 5.000 no início de 01/02, entrada de salário de R$ 200 efetiva em 01/02 e registrada no Prumo em 05/02, o saldo ao fim de 01/02 é R$ 5.200 e fevereiro recebe R$ 200 de receita. A data 05/02 permanece na trilha como registro; não cria segunda entrada nem desloca o efeito. Se o registro ocorrer em março, saldo e receita continuam atribuídos a fevereiro, com recálculo das consultas afetadas.

## 3. Compra no cartão, fechamento e pagamento (DOM-001/004)

Estado inicial: corrente R$ 500, passivo do cartão R$ 0, patrimônio líquido R$ 500. Compra de R$ 120 em 31/01; fatura fecha em 05/02; pagamento integral em 12/02.

| Evento | Corrente | Passivo do cartão | Patrimônio líquido | Despesa acumulada |
|---|---:|---:|---:|---:|
| Antes da compra | 500 | 0 | 500 | 0 |
| Compra de 31/01 | 500 | 120 | 380 | 120 |
| Fechamento de 05/02 | 500 | 120 | 380 | 120 |
| Pagamento de 12/02 | 380 | 0 | 380 | 120 |

**Decisão ADR-008:** os R$ 120 entram no relatório principal de despesas de janeiro e consomem R$ 120 do orçamento desse mês ao qual forem atribuídos. Em visão de caixa, a saída de R$ 120 ocorre em fevereiro, sem novo consumo do orçamento de janeiro ou fevereiro. Fechar a fatura apenas agrupa obrigações; pagá-la reduz caixa e passivo no mesmo valor. O MVP permite pagamento parcial, distribui automaticamente o valor pago a partir da fatura mais antiga com correção possível e registra juros/tarifas informados como novas despesas; detalhes de classificação/correção dos encargos continuam pendentes.

## 4. Parcelas e conservação dos centavos (DOM-005/DB-002)

Uma compra de R$ 100,00 em três parcelas não pode gerar três parcelas de R$ 33,33: isso totalizaria R$ 99,99. **Decisão ADR-008:** dividir o total em centavos inteiros pelo número de parcelas e distribuir os centavos restantes às primeiras parcelas, conservando o total original.

| Compra | Parcelas pelo rateio padrão | Conferência |
|---|---|---:|
| R$ 100,00 / 3 | R$ 33,34 + R$ 33,33 + R$ 33,33 | R$ 100,00 |
| R$ 10,00 / 6 | R$ 1,67 + R$ 1,67 + R$ 1,67 + R$ 1,67 + R$ 1,66 + R$ 1,66 | R$ 10,00 |

**Limite (ADR-008):** R$ 0,02 dividido em três parcelas é recusado por gerar R$ 0,00 em uma delas; a operação não cria compra nem cronograma. R$ 0,03 dividido em três gera três parcelas de R$ 0,01. Correções de valores também preservam parcelas positivas e a soma original.

O cronograma é compromisso futuro; sua soma deve ser exatamente o valor da compra. Se a compra de R$ 100 ocorrer em janeiro, o relatório principal terá R$ 100 de despesa em janeiro; as parcelas aparecem em compromissos dos ciclos correspondentes, sem nova despesa. A primeira entra no ciclo atribuído à compra, e as demais nos ciclos mensais consecutivos (ADR-008). Se o emissor distribuir valores ou ciclos de outro modo, o usuário pode corrigi-los, preservando o total, o vínculo com a compra e a trilha da correção, sem nova despesa.

**Ciclo da fatura (ADR-008):** com fechamento configurado no dia 5, compras em 05/02 e 06/02 são atribuídas automaticamente ao ciclo que fecha em 05/03. Se o dia configurado for 31, o fechamento previsto de fevereiro cai em 28/02, ou 29/02 em ano bissexto. Compra em 27/02 de ano comum fica no ciclo de fevereiro; compra em 28/02 vai ao ciclo de 31/03. O relatório principal mantém todas as despesas de fevereiro em fevereiro. Se o emissor mostrar outro ciclo, o usuário corrige a atribuição sem mudar esse reconhecimento.

**Parcelas nos ciclos (ADR-008):** compra de R$ 100,00 em 06/02, em três parcelas, com fechamento no dia 5: R$ 33,34 na fatura que fecha em 05/03, R$ 33,33 na de 05/04 e R$ 33,33 na de 05/05. A despesa de R$ 100,00 fica em fevereiro. Atribuição divergente na fatura real pode ser corrigida sem alterar essa despesa.

**Orçamento mensal (ADR-008):** com orçamento de R$ 200 em fevereiro, atribuir a ele a compra acima consome R$ 100 em fevereiro e deixa R$ 100 disponíveis. As três parcelas são compromissos nas faturas de março, abril e maio; não consomem novamente orçamentos desses meses. O pagamento da fatura também não repete esse consumo.

**Orçamento excedido (ADR-008):** com orçamento de R$ 200 e consumo anterior de R$ 180 no mesmo mês, uma compra de R$ 50 é registrada. O consumo chega a R$ 230; o Prumo mostra alerta e excedente de R$ 30. O orçamento não impede a compra nem altera despesa, dívida ou parcelas.

**Vencimento previsto (ADR-008):** com fechamento em 31/01 e vencimento configurado no dia 31, a primeira data candidata posterior ao fechamento é 28/02 em ano comum ou 29/02 em ano bissexto. O emissor pode informar outra data; a previsão é corrigível e não altera a despesa da compra.

## 5. Reembolso de compra paga (DOM-006, antecipação de caso)

Compra de consumo de R$ 80 em Mercado paga diretamente em maio reduz a corrente de R$ 200 para R$ 120 e registra R$ 80 de despesa em Mercado em maio. Reembolso de R$ 20 recebido em junho eleva a corrente para R$ 140 e reduz a despesa de **Mercado** em junho em R$ 20, sem criar receita. O relatório histórico e o orçamento de maio continuam como estavam por causa do recebimento; o gasto líquido dos dois eventos vinculados é R$ 60 (ADR-017). Ambos os movimentos permanecem para auditoria. A soma dos reembolsos dessa compra não pode superar R$ 80: após receber R$ 50, outro reembolso de R$ 30 cabe, mas R$ 31 não é aceito como reembolso vinculado à compra. Com orçamento de Mercado em junho de R$ 200 e R$ 60 já consumidos nessa categoria, o reembolso de R$ 20 reduz o consumo líquido de Mercado para R$ 40 e deixa R$ 160 disponíveis nesse orçamento.

**Correção posterior da categoria (ADR-017):** se em julho a compra de R$ 80 acima mudar de Mercado para Farmácia, maio passa a mostrar os R$ 80 em Farmácia e junho passa a mostrar o mesmo reembolso de R$ −20 em Farmácia. Os orçamentos de Mercado e Farmácia de maio e junho são recalculados; a despesa total de cada mês, os saldos da conta, o valor e a data do reembolso permanecem iguais. A correção fica rastreável. Entrada acima do saldo reembolsável segue o exemplo abaixo; demais reembolsos no cartão seguem ADR-018/019.

**Consumo negativo por reembolso direto (ADR-017):** orçamento de Mercado de R$ 100 em junho, nenhuma compra em Mercado nesse mês e reembolso recebido de R$ 20 de compra anterior. A despesa e o consumo líquido de junho em Mercado são R$ −20; o disponível mostrado é R$ 100, com R$ 20 de excedente de reembolsos em separado. O excedente não cria nova entrada na conta nem orçamento de julho. Se houver depois compra de R$ 15 em Mercado em junho, o consumo líquido fica R$ −5, o disponível permanece R$ 100 e o excedente cai para R$ 5. Compra de R$ 30 deixaria consumo de R$ 10, disponível de R$ 90 e nenhum excedente.

**Entrada acima do reembolsável (ADR-017):** compra de R$ 80 em Mercado paga diretamente deixa R$ 80 ainda reembolsáveis. O extrato comprova uma entrada única de R$ 100 do lojista ligada à compra. O saldo da conta cresce R$ 100 uma vez; R$ 80 entram como reembolso e geram R$ −80 na despesa de Mercado do mês do recebimento. Os R$ 20 restantes ficam visíveis como entrada recebida sem classificação econômica definida, sem receita presumida nem segunda entrada na conta. R$ 80 + R$ 20 explicam a linha de R$ 100. Se já houver R$ 30 reembolsados dessa compra, só R$ 50 da nova entrada podem ser atribuídos a ela; o restante fica em revisão.

## 6. Estorno de compra no cartão (DOM-006, antecipação de caso)

**Categoria no MVP:** uma compra de R$ 120 no mercado pode ficar inteiramente em Mercado, mesmo quando inclui alimentos e itens de higiene. O orçamento de Mercado recebe R$ 120 no mês da compra; o cartão cria uma obrigação de R$ 120. Fast food pode ser classificado separadamente pelo usuário. O MVP não divide uma compra entre categorias; os exemplos de compra dividida abaixo são apenas regras condicionais para eventual fase futura.

**Decisão ADR-018, no caso delimitado:** caixa R$ 500 e passivo R$ 0 antes da compra. Compra de R$ 120 em 31/01 cria passivo R$ 120 e despesa e consumo de orçamento de R$ 120 em janeiro; caixa permanece R$ 500. A fatura fecha em 05/02. Crédito de estorno parcial de R$ 40 confirmado pelo emissor e aplicado em 08/02 à obrigação da compra e à fatura fechada reduz passivo e valor exigível a R$ 80; caixa permanece R$ 500. Fevereiro registra R$ −40 de efeito na despesa e no orçamento correspondente; janeiro mantém R$ 120, e o custo líquido da compra vinculada é R$ 80. Pagamento de R$ 80 em 12/02 deixa caixa R$ 420 e passivo R$ 0, sem nova despesa. Crédito ainda pendente não produz esses efeitos.

Estorno integral de compra de R$ 50 ainda não paga e aplicado à obrigação aberta reduz o passivo em R$ 50 e deixa custo líquido zero para a compra, preservando compra e estorno. Estornos parciais de R$ 30 e R$ 20 consomem todo o valor elegível; um novo centavo é recusado sem efeito parcial.

**Crédito para ciclo futuro (ADR-018):** em cenário independente, o emissor confirma em 08/02 estorno de R$ 40 sobre a compra de R$ 120, mas o destina ao ciclo de março. A fatura de fevereiro continua exigindo R$ 120; o Prumo mostra o crédito futuro sem reduzir despesa ou orçamento em fevereiro. Se o emissor aplicar o crédito em 08/03, março recebe R$ −40 de despesa e libera R$ 40 do orçamento correspondente. A aplicação integral ou parcial após pagamento da compra original e o destino entre faturas ainda não identificado seguem a ADR-019. Crédito acima do elegível ou sem aplicação confirmada não gera saldo credor por inferência.

**Após pagamento, sem dívida aberta (ADR-019):** no cenário da compra de R$ 120 em janeiro, a fatura é paga integralmente em fevereiro; caixa inicial de R$ 500 passa a R$ 380 e dívida a zero. O emissor confirma em março um estorno de R$ 40 no cartão. O Prumo mostra R$ 40 a utilizar, sem reduzir despesa ou orçamento de março. Se devolver R$ 40 à conta em abril, o caixa passa a R$ 420; abril registra R$ −40 de despesa e libera R$ 40 do orçamento, sem receita nem alteração de janeiro. Alternativamente, nova compra de R$ 60 em abril cria despesa e dívida de R$ 60; se o emissor aplicar os R$ 40 a ela, a dívida fica R$ 20 e abril tem R$ 60 − R$ 40 = R$ 20 de despesa líquida. Destino entre faturas não identificado segue a regra de revisão da ADR-019.

**Crédito aplicado acima do estornável (ADR-018/019):** compra original de R$ 80 e outra dívida de R$ 20 deixam dívida total de R$ 100. O emissor comprova crédito de R$ 100 relacionado à compra original e já aplicado ao cartão. A dívida total cai de R$ 100 para zero uma vez; R$ 80 reduzem a despesa na categoria da compra original no mês da aplicação, e R$ 20 aparecem como crédito aplicado sem classificação econômica definida. Não há receita, movimento de conta ou segunda redução de despesa presumidos. Os R$ 80 e R$ 20 conservam o total aplicado de R$ 100. Se a compra original já estiver paga, o mesmo limite de R$ 80 para o estorno vale quando o crédito for aplicado a nova dívida aberta de R$ 100 (ADR-019). A distribuição entre faturas sem destino comprovado continua provisória.

**Classificação manual do excedente aplicado (ADR-019):** no exemplo acima, se o crédito de R$ 100 foi aplicado em março e o usuário autorizado classifica os R$ 20 em abril, eventual efeito econômico ou orçamentário dessa classificação aparece em março. Abril guarda a data, a justificativa e a trilha da revisão. A fonte do crédito, os R$ 80 de estorno e a baixa de R$ 100 da dívida permanecem; a classificação não cria nova entrada em conta nem é apresentada como confirmação do emissor. A ADR-020 permite receita por baixa de dívida ou redução de outra despesa documentada, com eventual restante pendente; a classificação conserva a baixa única.

**Dois tipos econômicos no excedente aplicado (ADR-020):** suponha que os R$ 20 acima sejam classificados manualmente como R$ 12 de redução de outra despesa documentada em Casa e R$ 8 de receita por baixa de dívida. Março mostra R$ −80 de estorno na categoria da compra original, R$ −12 de despesa em Casa e R$ +8 de receita sem entrada na conta. A dívida continua R$ 100 menor pelo único crédito aplicado, e a soma R$ 80 + R$ 12 + R$ 8 conserva os R$ 100. A redução em Casa exige vínculo com despesa do mesmo household que ainda admita ao menos R$ 12 de redução. Se apenas R$ 12 forem classificados, os R$ 8 restantes continuam aplicados sem classificação; não viram receita automaticamente.

**Excedente confirmado para uso futuro (ADR-018/019):** compra original já paga de R$ 80, sem dívida aberta. O emissor confirma R$ 100 de crédito ligado à compra para uso em ciclo futuro. Mostrar R$ 80 elegíveis como estorno a utilizar e R$ 20 confirmados a utilizar sem classificação econômica definida, em revisão. A soma visível é R$ 100; a confirmação não altera dívida, conta, despesa ou orçamento. Se os R$ 100 forem aplicados integralmente depois a uma obrigação aberta suficiente, a dívida diminui R$ 100 uma vez, a despesa diminui R$ 80 no mês dessa aplicação e os R$ 20 passam ao estado de crédito aplicado sem classificação. Se o emissor aplicar R$ 50 sem discriminar as partes, inferir consumo primeiro da parte elegível: dívida e despesa caem R$ 50 no mês da aplicação; R$ 30 elegíveis e R$ 20 sem classificação continuam a utilizar. Se a fonte provar depois que apenas R$ 30 aplicados eram elegíveis, corrigir a despesa do mesmo mês para R$ −30 e mostrar R$ 50 elegíveis ainda a utilizar, mantendo a baixa da dívida em R$ 50 e preservando a trilha.

**Aplicação parcial (ADR-019):** com R$ 40 confirmados a utilizar e nova compra de R$ 25, a compra cria despesa e dívida de R$ 25. Aplicação confirmada de R$ 25 zera a dívida dessa compra e gera R$ −25 de efeito sobre despesa e orçamento do mês; os R$ 15 restantes continuam visíveis a utilizar, sem efeito antecipado e sem saldo credor patrimonial. A compra original mantém seu mês. Se o emissor omitir o destino entre faturas, a distribuição fica em revisão.

**Origem agregada (ADR-019):** A foi confirmado antes, com R$ 30 a utilizar; B tem R$ 20. O emissor informa R$ 40 aplicados a uma fatura identificada, sem discriminar a origem. O padrão atribui R$ 30 de A e R$ 10 de B, restando R$ 10 de B. Se a fonte depois mostrar R$ 20 de cada, corrigir a atribuição deixa R$ 10 de A e R$ 0 de B, preservando os R$ 40 abatidos da fatura e da despesa total do mês. A trilha registra inferência e correção; sem destino da fatura, a distribuição segue a regra de revisão da ADR-019.

**Confirmação no mesmo dia (ADR-019):** A e B têm R$ 30 confirmados cada na mesma data, sem horário confiável; A foi registrado antes de B na sequência persistida. O emissor confirma R$ 40 aplicados sem indicar a origem. Atribuir por inferência R$ 30 de A e R$ 10 de B, restando R$ 20 de B. Se depois comprovar R$ 10 de A e R$ 30 de B, corrigir a origem sem alterar os R$ 40 de dívida baixada nem a despesa total do mês. Se A era Alimentação e B era Casa, mover R$ 20 do efeito negativo e da liberação de orçamento de Alimentação para Casa no mês da aplicação. A sequência de registro não é prova da ordem do emissor; importação posterior não muda automaticamente a atribuição já registrada.

**Destino entre faturas desconhecido (ADR-019):** fatura antiga R$ 70 e nova R$ 100, dívida total R$ 170. O emissor confirma em março que aplicou R$ 40 ao cartão, sem identificar a fatura. A dívida total passa a R$ 130, março registra R$ −40 de efeito na despesa e libera R$ 40 de orçamento; caixa não muda. Antes de atribuição manual, o Prumo mostra os valores originais de R$ 70 e R$ 100 e R$ 40 sem destino. Se o usuário atribuir provisoriamente os R$ 40 à antiga, mostrar R$ 30 e R$ 100 como saldos **estimados**, distintos da dívida total confirmada de R$ 130 e sem recomendação de pagamento. Se o emissor depois comprovar destino na nova, corrigir para R$ 70 e R$ 60 como saldos confirmados, preservando trilha e sem alterar dívida total ou despesa de março.

**Pagamento parcial com destino do crédito desconhecido (ADR-023):** no mesmo cenário, pagamento comprovado de R$ 50 reduz caixa em R$ 50 e a dívida total de R$ 130 para R$ 80, sem nova despesa. Se o crédito de R$ 40 foi à fatura antiga, a ordem da ADR-008 distribuiria o pagamento em R$ 30 à antiga e R$ 20 à nova, deixando R$ 0/R$ 80. Se o crédito foi à nova, distribuiria R$ 50 à antiga e R$ 0 à nova, deixando R$ 20/R$ 60. Até confirmar o destino do crédito, a alocação individual do pagamento fica em revisão; nenhuma dessas posições por fatura é exigível confirmada. Atribuição manual provisória produz apenas estimativas e não altera caixa, dívida total ou despesa. Prova posterior corrige as atribuições dos mesmos fatos com trilha, sem segunda baixa.

**Vários fatos no mesmo ciclo:** `docs/domain/multi-credit-payment-cycle-example.md` estende o caso a dois créditos, dois pagamentos e correção posterior de valor. Os totais de caixa e dívida se conservam em dois destinos possíveis; a ADR-024 aceita distingue a origem do saldo individual após revisar pagamentos históricos.

**Data individual ausente (ADR-019):** fatura fechada em 05/03 confirma crédito aplicado de R$ 40, mas não informa o dia. O Prumo usa 05/03 como data estimada, mostra R$ −40 de despesa e libera R$ 40 do orçamento de março. Se o emissor depois informar 28/02, uma correção rastreável move esse mesmo efeito e a liberação para fevereiro e recalcula posições históricas entre 28/02 e 05/03; saldo atual e valor total do estorno permanecem iguais. Sem confirmação da aplicação, a mera informação de crédito futuro não autoriza essa estimativa.

**Lançamento e compensação em datas diferentes (ADR-018/019):** crédito de R$ 40 lançado em 28/02 e compensado contra a dívida do cartão em 05/03. Guardar as duas datas; o lançamento fica visível em fevereiro, mas somente março recebe R$ −40 de despesa, redução de dívida e liberação de orçamento. Se o emissor comprovar depois que a obrigação já estava reduzida em 28/02, corrigir a data efetiva do mesmo estorno e mover seus efeitos para fevereiro, recalculando posições históricas sem alterar o saldo atual. Este caso tem duas datas conhecidas; não usa o fechamento como estimativa.

**Categoria da compra original (ADR-018/019):** compra de R$ 120 em Alimentação em janeiro e crédito de R$ 40 aplicado em março deixam janeiro intacto; março registra R$ −40 em Alimentação e libera R$ 40 do orçamento dessa categoria. Se o orçamento de Alimentação em março é R$ 200 e R$ 60 já foram consumidos, o consumo líquido passa a R$ 20 e a disponibilidade a R$ 180. Uma nova compra de R$ 60 em Transporte que absorva o crédito registra seus R$ 60 de despesa em Transporte; o estorno permanece em Alimentação. Para compra dividida, vale a atribuição informada no caso abaixo.

**Compra dividida, caso venha a ser suportada (ADR-018/019):** compra original de R$ 120, sendo R$ 80 em Alimentação e R$ 40 em Casa. Crédito parcial de R$ 30 aplicado em março reduz a dívida e a despesa total de março em R$ 30. Se o usuário informar que o item devolvido era de Casa, os R$ 30 reduzem Casa e liberam R$ 30 de seu orçamento de março; Alimentação não muda. Sem essa informação, os R$ 30 continuam no total, mas a distribuição por categoria e a disponibilidade dos orçamentos de Alimentação e Casa ficam pendentes. Não presumir R$ 20 em Alimentação e R$ 10 em Casa. O mesmo critério vale se o crédito for devolvido à conta após pagamento: o total muda no mês do recebimento, e a categoria depende da atribuição informada.

**Correção de parte da compra dividida, se suportada (ADR-018/019):** no caso acima, o usuário corrige em abril a categoria da parte de R$ 40 de Casa para Eletrônicos. A compra de janeiro passa a mostrar R$ 80 em Alimentação e R$ 40 em Eletrônicos. O estorno de R$ 30 atribuído àquela parte passa de Casa para Eletrônicos em março, com recálculo dos dois orçamentos de março. Despesa total de janeiro e março, dívida, caixa e data do crédito permanecem iguais; a trilha registra a correção. Se a parte afetada ainda não tiver sido atribuída ao estorno, sua categoria e disponibilidade dos orçamentos continuam pendentes até a atribuição.

**Correção posterior da categoria única (ADR-018/019):** a compra de janeiro de R$ 120 inicialmente em Alimentação teve crédito de R$ 40 aplicado em março, com R$ −40 em Alimentação naquele mês. Em abril, o usuário corrige a compra original para Casa. Janeiro passa a mostrar a compra em Casa; o mesmo estorno de março passa a registrar R$ −40 em Casa e a liberar R$ 40 do orçamento de Casa de março. Alimentação deixa de receber essa liberação. Despesa total de janeiro e março, dívida, caixa e data de aplicação permanecem iguais; a correção fica rastreável.

**Consumo mensal negativo (ADR-018/019):** orçamento de Alimentação de R$ 100 em março, sem compras nessa categoria no mês, e estorno aplicado de R$ 40 referente a compra anterior. A despesa e o consumo líquido de março em Alimentação são R$ −40; o disponível mostrado é R$ 100, com R$ 40 de excedente de estornos em separado. O excedente não é dinheiro, crédito do emissor ainda a utilizar nem orçamento de abril. Se março receber depois uma compra de R$ 30 em Alimentação, o consumo líquido fica R$ −10, o disponível continua R$ 100 e o excedente cai para R$ 10. Se a compra for de R$ 70, o consumo líquido fica R$ 30, o disponível R$ 70 e não há excedente.

## 7. Pagamento parcial e ciclo de fatura (DOM-004)

**Cenário:** com fechamento configurado no dia 5, o Prumo atribui uma compra de consumo de R$ 120 feita em 31/01 ao ciclo que fecha em 05/02. O dia de vencimento configurado é 12; a primeira ocorrência após o fechamento é 12/02, que coincide com a data informada pelo emissor. Se divergir, o usuário pode corrigir a previsão. Há R$ 500 na conta e dívida inicial zero. O usuário paga R$ 50 em 12/02; ignoram-se juros, tarifas, créditos e outras compras apenas para conferir a aritmética.

| Ponto | Caixa | Obrigação total da compra ainda não baixada | Despesa econômica acumulada | Saída de caixa acumulada |
|---|---:|---:|---:|---:|
| Antes da compra | 500 | 0 | 0 | 0 |
| Compra em 31/01 | 500 | 120 | 120 | 0 |
| Fechamento em 05/02 | 500 | 120 | 120 | 0 |
| Pagamento de R$ 50 em 12/02 | 450 | 70 | 120 | 50 |

A ADR-008 permite pagamento parcial no MVP: o valor **pago** reduz caixa e obrigação sem criar nova despesa; o saldo aritmético de R$ 70 permanece em aberto neste cenário sem outros efeitos. Se uma fatura posterior informar R$ 5 de juros, registrar novo evento de despesa de R$ 5 no mês dessa fatura e aumentar a obrigação de R$ 70 para R$ 75; caixa permanece R$ 450 até novo pagamento. O Prumo não calcula juros ou tarifas automaticamente nem presume valor a partir do saldo aberto. **Pendente:** definir categoria/correção de encargos, relação entre saldo de fatura e dívida total e reconciliação.

**Duas faturas em aberto (ADR-008):** fatura antiga com R$ 70 e nova com R$ 100, total devido R$ 170. Pagamento de R$ 80 reduz dívida total para R$ 90 e caixa em R$ 80. Por padrão, quita R$ 70 da antiga e abate R$ 10 da nova; restam R$ 90 na nova. Se o emissor tiver distribuído de outra forma, o usuário corrige essa atribuição sem alterar pagamento, caixa, dívida total ou despesa original.

**Pagamento acima da dívida (ADR-008):** partindo de dívida total de R$ 70, comando de pagamento comum de R$ 100 é recusado sem alterar caixa ou dívida no Prumo. Se uma linha de extrato externo mostrar saída real de R$ 100, ela permanece para revisão; o sistema não descarta a linha nem cria automaticamente saldo credor de R$ 30. Esse caso requer regra futura fora do MVP.

## 8. Reconciliação de conta e cartão (DOM-002/004, exercício para decisão)

Partindo do cenário 7, um extrato da conta na data do pagamento informa R$ 450: coincide com o saldo calculado. Se informar R$ 440, a diferença é R$ −10 e deve aparecer para revisão, sem ajuste automático (ADR-016). **HIPÓTESE:** uma posição externa de dívida de R$ 75 para o cartão, na mesma data e com o mesmo escopo de compras, diverge R$ +5 dos R$ 70 calculados. O sistema deve apresentar a diferença e suas fontes, não inventar despesa ou crédito de R$ 5.

**Decisão ADR-008:** para posições comparáveis em data e escopo, mostrar os R$ 70 calculados, os R$ 75 informados, a diferença de R$ 5 e as fontes para revisão. Uma diferença pode ser explicada por encargo **somente se** ele constar na fonte na mesma data de corte; a divergência não autoriza inventá-lo. Sem causa identificada, ela permanece visível e não pode ser apagada por ajuste manual genérico no MVP. **Pendente:** definir o escopo exato da posição externa (lançamentos pendentes, encargos, outras faturas) e a correspondência entre linhas importadas e eventos já registrados. A ADR-016 cobre reconciliação de contas; a ADR-008 define este núcleo para o cartão.

## Critérios de conferência e decisões pendentes

1. Uma transferência interna altera duas contas em sentidos opostos e não altera receita/despesa do household. Com datas distintas e par confirmado, a soma das contas se conserva após ambos os efeitos e o valor em trânsito conserva o consolidado entre as datas.
2. Saldo inicial é ponto de partida documentado, não receita do período importado.
3. Compra no cartão e pagamento de fatura não produzem duas despesas; pagamento baixa caixa e obrigação juntos.
4. Soma das parcelas em unidades mínimas é igual ao total original, inclusive quando há resto.
5. Reembolso de compra paga diretamente mantém vínculo com a compra, reduz despesa no mês do recebimento e não altera o mês original; estorno de cartão confirmado e aplicado antes do pagamento segue a ADR-018, com os demais estornos pendentes.

ADR-006 definiu a representação central de Money, ADR-008 definiu o reconhecimento principal de compras de consumo no cartão, o rateio dos centavos, o limite de parcelas, seus ciclos, o consumo do orçamento mensal e alerta sem bloqueio ao excedê-lo, ADR-016 definiu o marco de saldo inicial e ADR-017 definiu classificação pelo evento para receita recebida/despesa de consumo paga diretamente, receita comum no mês em que o dinheiro chega, despesa comum paga diretamente no mês em que o dinheiro sai, reembolso de compra paga diretamente no mês do recebimento como redução de despesa na categoria original limitada ao valor pago e liberação do orçamento dessa categoria nesse mês, correção posterior da categoria da compra com reclassificação dos reembolsos vinculados, apresentação do consumo líquido negativo com disponível limitado ao orçamento e obrigação própria do cartão vinculada aos eventos. A ADR-018 definiu o estorno confirmado e aplicado à obrigação aberta de compra no cartão ainda não paga. Permanecem pendentes limites e contrato de Money, operações não liquidadas, rateios para outros usos fora do MVP, estrutura física, outros detalhes de categorias e alertas, detalhes de fatura e regras dos demais ajustes e estornos. As tabelas são critérios candidatos para testes dessas partes quando forem implementadas.
