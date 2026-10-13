# ADR-017: eventos de receita/despesa e representação do passivo do cartão

- **Status:** aceito para o núcleo descrito em Decisão
- **Data:** 2026-10-05

## Contexto

A ADR-007 define `Transaction` como evento do household e movimentos para efeitos no saldo de contas; somente a transferência interna recebeu cardinalidade e invariantes completos. A ADR-008 determina que compra de consumo no cartão cria despesa integral na compra e obrigação pelo total, enquanto pagamento reduz caixa e obrigação sem segunda despesa. Faltava explicar como representar receitas e despesas comuns e como calcular a obrigação do cartão sem confundir evento, saldo e relatório.

## Drivers

- Reproduzir saldos de contas desde o marco inicial datado da ADR-016.
- Calcular receita e despesa a partir do significado econômico do evento, sem deduzir classificação do sinal do movimento.
- Explicar dívida do cartão a partir de compras e pagamentos, inclusive quando não há movimento de caixa na compra.
- Impedir efeito parcial, duplicação e vínculo entre recursos de households diferentes.
- Manter centavos inteiros de BRL e moeda explícita (ADR-006).

## Alternativas para receita/despesa comum

| Alternativa | Benefício | Custo |
|---|---|---|
| Classificar evento e vincular movimento da conta quando houver liquidação | Um evento alimenta uma vez o indicador; o movimento explica a conta. Admite gasto no cartão sem saída imediata de caixa. | Exige regras de classificação e data econômica distintas da data de liquidação. |
| Classificar cada movimento pelo seu sinal | Consulta simples para operações à vista. | Transferência e pagamento da fatura pareceriam receita/despesa; evento sem movimento de caixa não teria gasto. Incompatível com BR-001/002 sem exceções extensas. |
| Manter registros econômicos separados de `Transaction` | Permite regras de competência próprias. | Exige vínculo inequívoco entre fato, movimentos, correções e importações; pode criar duas identidades para a mesma operação. |

Para receita recebida e despesa de consumo paga diretamente por uma conta, a alternativa de classificar o evento e vincular um movimento da conta foi escolhida. A receita comum recebida foi posteriormente definida para o mês em que o dinheiro chega ao household; a despesa comum paga diretamente foi definida para o mês em que o dinheiro sai da conta. Receitas/despesas ainda não liquidadas e aquisições de ativos ainda precisam de decisão explícita.

## Alternativas para o passivo do cartão

| Alternativa | Benefício | Custo |
|---|---|---|
| A. Generalizar movimentos para posições de ativo e passivo | Uma trilha uniforme de efeitos por evento. | Amplia “movimento de conta” da ADR-007, exige convenção de sinais por tipo de posição e pode aproximar o modelo de uma contabilidade mais ampla sem necessidade demonstrada. |
| B. Obrigação própria do cartão vinculada aos eventos | Preserva o significado atual de movimento de conta; permite relacionar compra, cronograma, fatura e pagamento ao passivo. | Exige projeção e integridade próprias para a dívida, além de vínculo entre baixa da obrigação e saída de caixa. |
| C. Passivo calculado só por projeção dos eventos | Menos registros de efeito persistidos. | Reconciliação, correção retroativa e importação podem exigir reconstrução complexa; ainda precisa de regra para eventos do emissor. |

A alternativa B foi escolhida no nível conceitual. O modelo físico e a possibilidade de derivar parte dos dados permanecem para o ERD. Os vínculos e a integridade precisarão ser demonstrados com exemplos de falha, importação e reconciliação antes da implementação.

## Decisão

Receita recebida e despesa de consumo paga diretamente por uma conta são classificações do evento `Transaction`, não inferências feitas a partir do sinal do movimento. Cada caso tem um movimento vinculado na conta: entrada para receita recebida e saída para despesa paga. O evento contribui uma vez para o indicador econômico aplicável. **Receita comum recebida entra no relatório principal no mês em que o dinheiro chega ao household**, independentemente do mês a que o trabalho ou pagamento se refere. **Despesa comum paga diretamente entra no mês em que o dinheiro sai da conta**, ainda que a compra tenha ocorrido no mês anterior. A data da compra pode ser preservada para contexto, sem deslocar o reconhecimento. Compras de consumo no cartão seguem a regra específica da ADR-008: despesa integral na data da compra, sem segunda despesa quando a fatura é paga.

O complemento da ADR-016 distingue a data efetiva do movimento da data em que ele foi registrado no Prumo. Registro tardio conserva a data de registro para auditoria e recalcula saldo e período econômico pela data em que o dinheiro efetivamente entrou ou saiu; não cria outro evento econômico. A ADR-025 define como tratar datas divergentes ou incompletas em movimentos de conta; interpretação de rótulos por formato permanece pendente.

O **reembolso de uma compra de consumo paga diretamente** é um novo evento vinculado à compra original e a um movimento de entrada na conta quando o dinheiro volta. Ele reduz a despesa no relatório principal **no mês do recebimento do reembolso**, sem ser classificado como receita. No mesmo mês, o efeito negativo usa a **categoria da compra original** e libera disponibilidade no orçamento dessa categoria; o orçamento do mês da compra não é reprocessado pelo recebimento. O MVP usa uma categoria por compra (Plano Mestre, seção 11.2). Se a categoria da compra original for corrigida depois, reclassificar a compra em seu mês e **cada reembolso vinculado no respectivo mês de recebimento**, recalculando os orçamentos das categorias afetadas nesses meses. Preservar valores, datas, saldos de conta, despesa total de cada mês, vínculos e trilha da correção; não criar outro reembolso. O mês e o valor histórico da compra permanecem como foram registrados; a ligação entre compra e reembolso permite explicar o gasto líquido do conjunto sem apagar os dois movimentos. A soma dos reembolsos vinculados a uma mesma compra não pode superar o valor original pago; cada novo reembolso deve ser positivo e caber no saldo ainda reembolsável.

Se uma **única entrada comprovada na conta** for maior que o saldo ainda reembolsável da compra vinculada, registrar a entrada integral uma vez no caixa. Atribuir à compra somente o menor entre o valor recebido e o saldo ainda reembolsável, como redução de despesa na categoria original e mês do recebimento; manter o restante como **entrada recebida sem classificação econômica definida**, destacada para revisão e vinculada à mesma fonte. Não classificar automaticamente o restante como receita, outro reembolso ou saldo credor. A soma das partes classificadas e pendentes deve igualar a entrada comprovada, sem duplicar movimento de conta; a classificação posterior do restante não repete a entrada de caixa. Se o vínculo da entrada com a compra não for confiável, manter a atribuição do reembolso em revisão. O contrato físico e a reconciliação dessa distribuição exigem detalhamento antes da implementação.

Se reembolsos deixarem o **consumo líquido mensal da categoria negativo**, manter a despesa e o consumo negativos visíveis, mas limitar o campo **disponível no orçamento** ao valor mensal configurado. Mostrar o excedente negativo separadamente como efeito informativo de reembolsos, sem adicioná-lo ao orçamento do mês ou transportá-lo automaticamente para outro período. O reembolso já produziu sua única entrada na conta; o excedente exibido não cria outro movimento. Com orçamento positivo `B` e consumo líquido `C`, disponível = `B − max(C, 0)` e, se `C < 0`, excedente de reembolsos = `−C`. Novas despesas e correções recalculam esses valores. Esta apresentação segue o mesmo critério da ADR-018 para estornos do cartão, sem alterar a despesa líquida ou o saldo da conta.

O passivo do cartão é uma **obrigação conceitualmente própria**, vinculada aos eventos financeiros. A compra de consumo cria a obrigação pelo total e é despesa integral na data da compra (ADR-008). O fechamento agrupa obrigações sem criar outra dívida ou despesa. O pagamento, inclusive parcial no MVP, registra saída da conta e baixa da obrigação somente pelo valor pago, vinculadas à mesma operação e confirmadas de modo íntegro; o saldo remanescente continua em aberto e não há nova despesa da compra. Juros e tarifas informados na fatura são novos eventos de despesa vinculados ao cartão e aumentam a obrigação no mês em que constam na fatura (ADR-008). Movimentos de conta mantêm o significado da ADR-007, sem generalizá-los para todo tipo de passivo.

Esta decisão não exige uma tabela por obrigação, nem define chaves, projeções persistidas ou formato da API. A alocação automática do pagamento da fatura mais antiga para a mais recente, corrigível pelo usuário, foi definida na ADR-008. O ERD deve escolher a representação física que preserve o vínculo e permita explicar o saldo da dívida.

## Invariantes do núcleo aprovado

1. Evento, movimentos de conta, cartão e obrigação referidos pertencem ao mesmo household autorizado. O backend não toma o `householdId` enviado pelo cliente como autorização.
2. Receita/despesa do relatório principal vem da classificação e regra de reconhecimento do evento; não da soma indiscriminada de movimentos. Transferência e pagamento de compras já reconhecidas contribuem zero.
3. Em compra de consumo no cartão, gasto e aumento da obrigação têm o mesmo valor integral em BRL na data da compra; nenhum saldo de conta de caixa muda por causa da compra (ADR-008).
4. Fechamento não altera despesa acumulada nem o total devido apenas por agrupar compras. Pagamento reduz caixa e obrigação pelo valor efetivamente pago, sem gasto duplicado.
5. A confirmação de efeitos vinculados é íntegra: falha ao registrar a baixa de obrigação não deixa débito de caixa confirmado. Retries precisam ter política de idempotência antes do comando real.
6. Saldo de conta permanece derivado do marco inicial e movimentos conhecidos; saldo do passivo precisa ser explicável pelos eventos e obrigações vinculados. Reconciliação do cartão mostra diferenças comparáveis com fonte externa para revisão, sem ajuste automático nem ajuste manual genérico sem causa no MVP (ADR-008).
7. Um salário referente a maio e recebido em junho é receita de junho no relatório principal, uma única vez. O mês de referência pode ser preservado como informação descritiva, mas não altera esse reconhecimento.
8. Uma compra de consumo paga diretamente, feita em 31/05 e debitada da conta em 01/06, é despesa de junho no relatório principal, uma única vez. A conta mantém seu saldo de maio até a saída do dinheiro. Esse caso não altera a regra de compras no cartão da ADR-008.
9. Com dívida de cartão de R$ 120 e caixa de R$ 500, pagamento parcial de R$ 50 resulta em dívida de R$ 70 e caixa de R$ 450, antes de outros encargos. A despesa da compra continua R$ 120 no mês da compra (ADR-008).
10. Encargo de R$ 5 informado em fatura posterior aumenta a dívida de R$ 70 para R$ 75 e gera R$ 5 de nova despesa no mês dessa fatura; nenhum encargo é criado automaticamente apenas pelo pagamento parcial (ADR-008).
11. Compra de consumo paga diretamente de R$ 80 em Mercado em maio e reembolso de R$ 20 recebido em junho deixam R$ 80 de despesa em Mercado em maio e R$ −20 de efeito sobre a despesa de Mercado em junho, sem R$ 20 de receita. A conta registra saída de R$ 80 e entrada de R$ 20 em eventos vinculados; o gasto líquido dos dois eventos é R$ 60.
12. Após reembolsar R$ 50 de compra paga diretamente de R$ 80, o máximo reembolsável nessa compra é R$ 30. Uma entrada posterior de R$ 31 do lojista comprovadamente ligada à compra registra R$ 31 na conta uma vez, com R$ 30 como reembolso vinculado e R$ 1 recebido sem classificação econômica definida para revisão; a compra nunca acumula mais de R$ 80 de reembolso.
13. Com orçamento de Mercado em junho de R$ 200 e R$ 60 já consumidos nessa categoria por despesas do mês, reembolso de R$ 20 recebido em junho reduz o consumo líquido de Mercado para R$ 40 e deixa R$ 160 disponíveis nesse orçamento. O orçamento de Mercado em maio, mês da compra original, não muda.
14. Se em julho a categoria da compra de R$ 80 for corrigida de Mercado para Farmácia, maio passa a mostrar R$ 80 em Farmácia e junho passa a mostrar o mesmo reembolso de R$ −20 em Farmácia. Os orçamentos das duas categorias em maio e junho são recalculados; despesa total de cada mês, saldos da conta, valor e data do reembolso permanecem iguais.
15. Com orçamento mensal de Mercado de R$ 100, nenhuma compra nessa categoria em junho e reembolso recebido de R$ 20 de compra anterior, junho mostra consumo líquido de R$ −20, R$ 100 disponíveis no orçamento e R$ 20 de excedente de reembolsos em separado. Se depois houver compra de R$ 15 em Mercado no mesmo mês, o consumo líquido passa a R$ −5, o disponível continua R$ 100 e o excedente cai para R$ 5. Compra de R$ 30 deixaria consumo de R$ 10, disponível de R$ 90 e nenhum excedente.
16. Compra paga diretamente de R$ 80 e entrada comprovada de R$ 100 do mesmo lojista ligada a ela aumentam o saldo da conta em R$ 100; R$ 80 reduzem a despesa na categoria original no mês do recebimento e os R$ 20 restantes aparecem como entrada recebida sem classificação econômica definida. Não há R$ 20 de receita presumida, segundo movimento de caixa nem R$ 100 de reembolso vinculado à compra. A soma R$ 80 + R$ 20 reconcilia a entrada de R$ 100.

## Exemplos e critérios de verificação

`docs/domain/event-effects-proposal.md`, `docs/domain/priority-use-cases.md` e `docs/domain/financial-examples.md` trazem os números base. Uma compra de R$ 120 com caixa inicial R$ 500 e dívida R$ 0 leva a caixa R$ 500, dívida R$ 120 e despesa R$ 120. Fechamento mantém os três números. Pagamento integral de R$ 120 leva a caixa R$ 380, dívida R$ 0 e despesa acumulada R$ 120. Teste de falha deve preservar os números anteriores integralmente; teste entre households deve rejeitar qualquer conta/cartão de outra casa.

## Pendências fora desta decisão

- Data de recebimento/débito efetivo versus data de lançamento/compensação da fonte em casos excepcionais; operações a prazo, rendimentos e receitas ainda não recebidas.
- Calendário efetivo do emissor, saldo credor explícito futuro e tratamento definitivo de importação com valor acima da dívida, tipo/categoria e correção de encargos informados, fluxo para revisar destino entre faturas sem indicação externa e fidelidade ao emissor. O estorno após pagamento sem dívida aberta, sua aplicação parcial, a atribuição do crédito mais antigo primeiro para total aplicado ao cartão e o estado de distribuição desconhecida entre faturas seguem a ADR-019. O limite do pagamento comum à dívida aberta, atribuição automática por dia configurado, último dia quando não existir no mês, compra no dia de fechamento para o ciclo seguinte, vencimento previsto na primeira data candidata posterior ao fechamento e alocação da fatura mais antiga primeiro seguem a ADR-008.
- Estrutura física de obrigação, cronograma, fatura e vínculos; conciliação do cartão, origem de importações e deduplicação.
- Rateios não cobertos pela ADR-008, orçamento de outros tipos de evento, reembolso de compra no cartão fora das ADR-018/019, classificação definitiva do excedente recebido, outros estornos, correções, concorrência e saldo negativo. Reembolso de compra paga diretamente, seu limite, categoria original, correção posterior dessa categoria, apresentação de consumo líquido negativo e separação de entrada externa acima do saldo reembolsável seguem a decisão acima; estorno confirmado e aplicado a compra no cartão ainda não paga segue a ADR-018. Divisão de compra entre categorias fica fora do MVP.
- Isolamento por filtros de aplicação ou RLS; papéis e privacidade de contas.

## Consequências

O ERD e os contratos terão de distinguir classificação econômica, movimento de conta e obrigação, com vínculo auditável entre eles. Relatórios poderão responder separadamente gasto no período, caixa movimentado e dívida em aberto. A obrigação própria requer lógica para manter a dívida explicável; sua complexidade deve ser testada contra exemplos de fatura e conciliação antes da implementação.

## Conceitos para estudo

Evento econômico, liquidação, passivo, competência simplificada, projeção de saldo, integridade transacional e idempotência.
