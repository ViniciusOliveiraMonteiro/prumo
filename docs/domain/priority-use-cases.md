# Casos de uso financeiros prioritários — esboço conceitual

**Status:** em estudo na Sprint 1. Complementa UC-002, UC-003 e UC-005 do Plano Mestre e `event-effects-proposal.md`. Os passos descrevem resultados observáveis, não contrato de API nem tabelas. Onde a data ou a classificação ainda não foi aprovada, está escrito **HIPÓTESE**.

## Limite conceitual de Household e Transaction

`User` participa de um ou mais `Household` por `Membership`; o household é o limite de acesso dos dados financeiros (Plano Mestre §7). Uma `Transaction` pertence a um household e vincula movimentos de conta quando o evento altera seus saldos (ADR-007). Contas, cartão e obrigação referidos por um caso de uso devem pertencer ao household autorizado. Como o passivo se liga ao evento continua pendente. Papéis finais, privacidade por conta, chaves físicas e escolha de RLS também permanecem em aberto; este esboço não concede permissões por nome de papel.

## Abrir conta com marco inicial (UC-002)

1. Membro autorizado escolhe uma conta do seu household e informa data, BRL e saldo inicial.
2. O sistema registra o marco datado; não cria receita por esse valor (ADR-016).
3. A consulta de saldo após o marco soma somente os movimentos conhecidos a partir dele.

**Aceite:** marco de R$ 5.000, entrada de R$ 200 e saída de R$ 80 produzem R$ 5.120; receita do período é apenas R$ 200. Se uma fonte externa informa R$ 5.110 na mesma data, a divergência de R$ 10 aparece para revisão e não gera ajuste automático. Correção do marco e movimento anterior seguem a ADR-016; representação física da pendência continua aberta.

## Registrar receita recebida ou despesa à vista (UC-003)

1. Membro autorizado seleciona conta do household, data, descrição, valor positivo em centavos de BRL e classificação proposta como receita ou despesa.
2. O registro cria um evento `Transaction` e um movimento vinculado nessa conta: `+valor` para receita recebida, `−valor` para despesa paga (ADR-017).
3. O evento entra uma vez no indicador econômico aplicável; a classificação não é inferida apenas do sinal do movimento. Receita recebida entra no mês em que o dinheiro chega; despesa paga diretamente entra no mês em que sai da conta (ADR-017).

**Aceite candidato:** partindo de R$ 0, salário de R$ 3.000 e compra paga diretamente de R$ 80 resultam em saldo R$ 2.920, receita R$ 3.000 e despesa R$ 80 para os eventos. Se o salário se refere a maio e chega em junho, os R$ 3.000 são receita de junho. Se a compra ocorre em 31/05 e o débito da conta em 01/06, os R$ 80 são despesa de junho. Conta de outro household é rejeitada, sem efeito parcial. Datas divergentes ou incompletas da fonte seguem a ADR-025; despesa ainda não paga e receita a receber exigem regra própria.

**Reembolso de compra paga diretamente (ADR-017):** compra de R$ 80 em Mercado debitada em maio, seguida por reembolso de R$ 20 recebido em junho. Registrar novo evento vinculado à compra e movimento de entrada de R$ 20. Maio mantém R$ 80 de despesa em Mercado e orçamento inalterado por causa do recebimento; junho recebe efeito de R$ −20 sobre despesa de Mercado e nenhuma receita por esse reembolso. A soma líquida dos dois eventos é R$ 60. Com orçamento de Mercado em junho de R$ 200 e consumo anterior de R$ 60 nessa categoria, o reembolso libera R$ 20 e deixa R$ 160 disponíveis. Reembolsos parciais acumulados não superam R$ 80: após R$ 50 recebidos, outros R$ 30 são aceitos, mas R$ 31 não pode ser vinculado como reembolso da compra.

**Correção posterior da categoria da compra paga diretamente (ADR-017):** se em julho a compra de R$ 80 acima mudar de Mercado para Farmácia, reclassificar em maio a compra e em junho o reembolso de R$ −20 para Farmácia, recalculando os orçamentos afetados. Preservar despesa total de cada mês, saldos da conta, valor e data do reembolso e trilha da correção. Valor externo excedente continua pendente.

**Orçamento com consumo negativo por reembolso direto (ADR-017):** orçamento de Mercado de R$ 100 e nenhum gasto nessa categoria em junho, com reembolso recebido de R$ 20 de compra anterior, mostram despesa e consumo líquido de R$ −20, R$ 100 disponíveis e R$ 20 de excedente informativo em separado. Nova compra de R$ 15 no mesmo mês deixa consumo de R$ −5 e excedente de R$ 5; compra de R$ 30 deixa consumo de R$ 10, disponível de R$ 90 e nenhum excedente. O valor não é transferido automaticamente para outro mês.

**Entrada superior ao saldo reembolsável (ADR-017):** compra paga diretamente de R$ 80 em Mercado e entrada comprovada de R$ 100 do lojista ligada à compra geram uma única entrada de R$ 100 na conta, R$ −80 de efeito na despesa de Mercado do mês do recebimento e R$ 20 recebidos sem classificação econômica definida para revisão. A linha externa deve reconciliar R$ 80 + R$ 20, sem segundo movimento de conta, receita presumida ou reembolso acima do valor elegível. Com R$ 30 já reembolsados, apenas R$ 50 da nova entrada podem ser atribuídos à compra.

## Transferir entre contas próprias (UC-003/BR-001)

1. Membro autorizado seleciona duas contas distintas do mesmo household e valor em BRL.
2. Um evento de transferência e seus dois movimentos `−valor`/`+valor` são confirmados juntos (ADR-007).
3. Cada conta mostra seu movimento vinculado ao mesmo evento; relatório do household mantém receita e despesa inalteradas.

**Aceite:** A = R$ 2.000, B = R$ 500, transferência de R$ 300 → A = R$ 1.700, B = R$ 800 e total R$ 2.500. Falha ao registrar um lado desfaz tudo. Retificação e cancelamento do fato seguem a ADR-026; idempotência e concorrência dos comandos e revisões seguem a ADR-027.

## Registrar compra de consumo no cartão e pagar fatura (UC-005/BR-002)

**Categoria no MVP:** uma compra no mercado recebe uma categoria para o valor inteiro, mesmo que a cesta contenha tipos diferentes de item. Por exemplo, R$ 120 em Mercado geram R$ 120 de despesa e consumo do orçamento de Mercado e uma obrigação de R$ 120 no cartão. Fast food pode receber outra categoria escolhida pelo usuário. Dividir a compra entre categorias fica fora do MVP.

1. Membro autorizado informa compra de consumo de R$ 120 em 31/01 no cartão do household.
2. O relatório principal registra despesa de janeiro de R$ 120 e consome R$ 120 do orçamento mensal ao qual a compra for atribuída; a obrigação aumenta R$ 120; o caixa não muda (ADR-008).
3. O Prumo atribui a compra automaticamente ao ciclo que fecha em 05/02, considerando fechamento configurado no dia 5. Também prevê o vencimento a partir do dia configurado no cartão; o usuário corrige ciclo ou vencimento quando a fatura do emissor divergir, sem alterar a despesa de janeiro (ADR-008). O fechamento agrupa obrigações sem nova despesa ou dívida.
4. Pagamento integral em 12/02 reduz conta de caixa e obrigação em R$ 120; a despesa já reconhecida não reaparece em fevereiro.
5. **Como alternativa ao passo 4**, pagamento parcial de R$ 50 também é permitido no MVP: reduz caixa e obrigação em R$ 50, mantendo R$ 70 em aberto no cenário sem outros efeitos (ADR-008).
6. Se fatura posterior informar R$ 5 de juros, registrar novo evento de despesa de R$ 5 vinculado ao cartão, elevando a obrigação de R$ 70 para R$ 75. Esse passo só se aplica ao ramo do pagamento parcial.
7. **Em cenário independente com duas faturas abertas**, de R$ 70 e R$ 100, pagar R$ 80 aloca R$ 70 à mais antiga e R$ 10 à mais nova por padrão. O usuário pode corrigir a distribuição sem alterar caixa ou dívida total.
8. **Em outro cenário independente**, dívida total de R$ 70 e tentativa de pagamento comum de R$ 100: rejeitar sem efeito parcial. Se o valor vier de importação, manter a linha sinalizada para revisão.

**Aceite:** caixa inicial R$ 500, passivo inicial R$ 0 → após compra R$ 500/R$ 120; após pagamento integral R$ 380/R$ 0, ou após pagamento parcial de R$ 50, R$ 450/R$ 70. Despesa da compra R$ 120 apenas em janeiro; encargo informado de R$ 5 gera despesa adicional no mês da fatura que o contém. Compras em 05/02 e 06/02 com fechamento dia 5 vão para ciclo de 05/03, mas são despesas de fevereiro. Com fechamento dia 31, o ciclo de fevereiro fecha em seu último dia (28 ou 29), e compra nesse dia vai ao próximo ciclo. Fechamento em 05/02 com vencimento configurado no dia 12 prevê 12/02; com dia 3 prevê 03/03. Fechamento em 31/01 com vencimento dia 31 prevê 28 ou 29/02. Para compra parcelada, o total entra na data da compra; cronograma futuro conserva o total e é exibido como compromisso separado. R$ 100,00 em três parcelas gera R$ 33,34 + R$ 33,33 + R$ 33,33; uma correção para valores do emissor deve conservar R$ 100,00 e não criar despesa. A obrigação própria vinculada foi aprovada conceitualmente na ADR-017; estrutura física, saldo credor explícito futuro, categoria/correção de encargos e detalhes de interface e importação da revisão do destino entre faturas seguem pendentes (ADR-019).

**Estorno antes do pagamento (ADR-018, cenário independente):** após compra de R$ 120 em 31/01 e fechamento da fatura em 05/02, crédito parcial de R$ 40 confirmado e aplicado pelo emissor em 08/02 à mesma obrigação e fatura reduz o valor exigível e a dívida para R$ 80. Janeiro conserva R$ 120 de despesa e consumo de orçamento; fevereiro registra R$ −40 de despesa e libera R$ 40 no orçamento correspondente. Caixa permanece R$ 500 até pagamento de R$ 80 em 12/02, quando cai para R$ 420 e a dívida zera, sem nova despesa. Se o crédito estiver pendente ou for destinado a outro ciclo, este caso não se aplica.

**Crédito destinado a ciclo futuro (ADR-018):** estorno de R$ 40 confirmado em fevereiro, mas destinado pelo emissor a março, fica visível como crédito a utilizar. A fatura de fevereiro permanece exigível por R$ 120, sem efeito de despesa ou orçamento em fevereiro. A aplicação efetiva em março registra R$ −40 de despesa e libera R$ 40 do orçamento de março. Aplicação integral ou parcial após pagar a compra original e atribuição manual provisória entre faturas sem destino confirmado seguem a ADR-019; detalhes de interface e importação da revisão ainda exigem regra.

**Após pagamento, sem dívida aberta (ADR-019):** compra de R$ 120 paga integralmente em fevereiro deixa caixa R$ 380 e dívida R$ 0 no cenário com caixa inicial de R$ 500. Estorno de R$ 40 confirmado em março fica visível a utilizar, sem efeito econômico ou saldo credor patrimonial. Se devolvido à conta em abril, caixa chega a R$ 420 e abril registra R$ −40 de despesa e libera R$ 40 do orçamento. Como alternativa, compra nova de R$ 60 em abril cria despesa e dívida de R$ 60; aplicação confirmada dos R$ 40 à nova obrigação deixa dívida R$ 20 e despesa líquida de abril R$ 20. A compra de janeiro preserva R$ 120 de despesa histórica em ambos os caminhos.

**Crédito aplicado superior ao estornável (ADR-018/019):** compra original de R$ 80, outra dívida de R$ 20 e crédito de R$ 100 comprovadamente aplicado ao cartão deixam dívida total zero. Classificar R$ 80 como estorno da compra na sua categoria e mês da aplicação; manter R$ 20 como crédito aplicado sem classificação econômica definida para revisão. Uma única baixa de R$ 100 conserva a dívida total, sem caixa, receita ou despesa negativa adicionais. Se o emissor não informar a fatura de destino, apenas saldos individuais estimados podem vir de atribuição manual provisória.

**Revisão do excedente aplicado (ADR-019):** usuário autorizado classifica manualmente os R$ 20 acima, com justificativa e histórico de correções. Mostrar que a classificação veio do usuário; os R$ 80 de estorno, a baixa de R$ 100 e o caixa não mudam nessa revisão. Se o crédito foi aplicado em março e a classificação ocorreu em abril, eventual efeito econômico ou orçamentário pertence a março; abril conserva o registro da revisão. A ADR-020 admite receita por baixa de dívida e redução de outra despesa documentada, inclusive em revisão parcial, mantendo a baixa única.

**Aplicação parcial (ADR-019):** de R$ 40 confirmados a utilizar, o emissor aplica R$ 25 a nova obrigação de R$ 25. A obrigação zera, abril recebe R$ −25 de efeito na despesa e no orçamento e os R$ 15 restantes continuam a utilizar. Aplicar mais que a obrigação ou o crédito restante é recusado sem efeito parcial.

**Excedente confirmado a utilizar (ADR-018/019):** compra já paga de R$ 80, sem dívida aberta, recebe crédito confirmado de R$ 100 para ciclo futuro. Exibir R$ 80 elegíveis como estorno e R$ 20 sem classificação econômica definida, ambos a utilizar, com total R$ 100. Nenhuma parte altera dívida, conta, despesa ou orçamento na confirmação. Se os R$ 100 forem aplicados integralmente depois, somente os R$ 80 elegíveis reduzem a despesa; a dívida cai pelo total uma vez. Se apenas R$ 50 forem aplicados sem discriminação, atribuir por inferência os R$ 50 ao estorno, reduzir dívida e despesa em R$ 50 e manter R$ 30 elegíveis e R$ 20 sem classificação a utilizar; prova posterior de outra distribuição corrige o efeito econômico e os saldos a utilizar sem repetir a baixa.

**Créditos múltiplos (ADR-019):** com créditos confirmados A = R$ 30 e B = R$ 20, nessa ordem, aplicação agregada de R$ 40 a fatura identificada usa A = R$ 30 e B = R$ 10 por padrão. Correção para A = R$ 20 e B = R$ 20 altera os saldos ainda a utilizar para R$ 10 e R$ 0, sem alterar baixa total da fatura, caixa ou despesa total do mês; preservar inferência e correção.

**Fatura de destino desconhecida (ADR-019):** com faturas abertas de R$ 70 e R$ 100, aplicação confirmada de R$ 40 ao cartão reduz a dívida total de R$ 170 para R$ 130 e a despesa do mês em R$ 40, sem movimento de caixa. Os valores originais das faturas continuam visíveis, acompanhados de crédito global ainda não distribuído. O usuário pode atribuir provisoriamente os R$ 40 à fatura antiga, com base registrada: mostrar saldos estimados de R$ 30 e R$ 100, dívida total confirmada R$ 130 e nenhuma recomendação de pagamento baseada na estimativa. Se o emissor confirmar destino na fatura nova, corrigir para saldos confirmados de R$ 70 e R$ 60, preservando dívida total e despesa já reconhecida. Rejeitar atribuição acima do crédito aplicado, acima do valor aberto da fatura ou a outro cartão/household.

**Desempate de créditos na mesma data (ADR-019):** dois créditos A e B de R$ 30 foram confirmados no mesmo dia; A entrou antes de B na sequência persistida do Prumo. Aplicação agregada de R$ 40 usa R$ 30 de A e R$ 10 de B como origem inferida e corrigível. Correção comprovada para R$ 10 de A e R$ 30 de B mantém dívida e despesa total, mas recalcula efeitos por categoria e orçamentos no mês da aplicação. Nova importação não altera a inferência registrada sem correção rastreável.

**Data do crédito ausente na fatura (ADR-019):** fatura fechada em 05/03 confirma aplicação de R$ 40 sem dia individual. O Prumo marca 05/03 como estimativa, reconhece R$ −40 em março e libera R$ 40 de orçamento nesse mês. Se a data comprovada for 28/02, corrige o mesmo evento e move o efeito para fevereiro, sem duplicar estorno nem alterar o saldo atual da dívida.

**Lançamento antes da compensação (ADR-018/019):** crédito de R$ 40 lançado em 28/02 e compensado contra a obrigação em 05/03 tem as duas datas preservadas. Fevereiro apenas mostra o lançamento; março recebe a redução de dívida e despesa e a liberação de orçamento. Comprovação posterior de aplicação efetiva em 28/02 corrige o mesmo estorno e os relatórios por mês e posição por data, sem segunda baixa.

**Categoria do estorno (ADR-018/019):** para compra original de categoria única Alimentação, R$ 40 de crédito aplicado em março reduzem em R$ 40 a despesa e o consumo do orçamento de Alimentação de março. Uma compra nova de R$ 60 em Transporte que receba esse crédito ainda registra R$ 60 em Transporte. O crédito continua vinculado à compra antiga; para compra dividida, vale a atribuição informada no caso abaixo.

**Compra dividida, se suportada (ADR-018/019):** compra original com R$ 80 em Alimentação e R$ 40 em Casa e crédito parcial de R$ 30 exigem que o usuário informe a parte afetada. Se informar Casa, reduzir R$ 30 da despesa e do orçamento de Casa no mês do efeito. Se não informar, reduzir despesa total e dívida ou registrar entrada na conta conforme a aplicação, mantendo distribuição por categoria e disponibilidade dos orçamentos das categorias originais pendentes. Não ratear R$ 20/R$ 10 automaticamente.

**Correção de parte da compra dividida, se suportada (ADR-018/019):** se a parte de R$ 40 em Casa do caso acima mudar para Eletrônicos depois de estorno de R$ 30 atribuído a ela, reclassificar a compra no mês original e o mesmo estorno no mês em que teve efeito. Recalcular os orçamentos de Casa e Eletrônicos, preservar totais, dívida, caixa, datas e trilha. Estorno ainda sem parte identificada permanece com categoria e orçamento pendentes.

**Correção posterior de categoria única (ADR-018/019):** se a compra original for corrigida em abril de Alimentação para Casa, reclassificar em março o efeito negativo do estorno já aplicado e sua liberação de orçamento para Casa. Preservar o total de despesa de março, a dívida, o caixa, a data do crédito e a categoria própria de eventual compra futura que tenha absorvido o crédito. Registrar a correção para auditoria.

**Orçamento com consumo líquido negativo (ADR-018/019):** orçamento de Alimentação de R$ 100, sem compras no mês, e estorno aplicado de R$ 40 de compra anterior resultam em R$ −40 de despesa e consumo, R$ 100 disponíveis e R$ 40 de excedente de estornos exibidos separadamente. Nova compra de R$ 30 reduz o excedente a R$ 10 e mantém R$ 100 disponíveis; compra de R$ 70 deixa consumo de R$ 30 e R$ 70 disponíveis. O excedente não se transporta automaticamente para outro mês nem representa crédito ainda a utilizar.

**Parcelas nos ciclos (ADR-008):** uma compra de R$ 100,00 em 06/02, parcelada em três vezes no cartão que fecha no dia 5, tem R$ 33,34 na fatura de 05/03 e R$ 33,33 nas de 05/04 e 05/05. Os R$ 100,00 são despesa de fevereiro. Correção para o emissor preserva parcelas positivas, soma, vínculo e trilha, sem nova despesa. R$ 0,02 em três parcelas é recusado por gerar parcela zero; R$ 0,03 em três gera R$ 0,01 em cada uma.

**Orçamento mensal (ADR-008):** se a compra parcelada de R$ 100,00 acima for atribuída a um orçamento de fevereiro de R$ 200, consome R$ 100 em fevereiro; restam R$ 100 neste cenário sem outros gastos. As parcelas das faturas de março, abril e maio e os pagamentos correspondentes não consomem de novo esse orçamento nem os orçamentos desses meses.

**Orçamento excedido (ADR-008):** com limite planejado de R$ 200 e consumo anterior de R$ 180 no mês, registrar compra de R$ 50 mantém a compra válida, leva o consumo a R$ 230 e mostra alerta com excedente de R$ 30. Não há bloqueio por orçamento.

**Reconciliação do cartão (ADR-008):** dívida calculada de R$ 70 e posição comparável do emissor de R$ 75 geram divergência de R$ 5 para revisão. Sem linha identificada que explique a diferença, a dívida calculada continua R$ 70 e nenhum encargo ou ajuste manual genérico é criado no MVP. A causa, quando encontrada, deve ser vinculada à origem.

## Limite comum e próximos refinamentos

Em todos os casos, a autorização para o household e para cada recurso é resolvida no backend; IDs enviados pelo cliente não provam acesso. A ADR-026 define correções rastreáveis no primeiro fluxo; a ADR-027 define idempotência e concorrência dos seus comandos e revisões. Importação e reconciliação precisam referenciar evento e efeito de saldo sem gerar um segundo fato econômico. Estas regras não autorizam ERD ou contrato de API antes das decisões pendentes.
