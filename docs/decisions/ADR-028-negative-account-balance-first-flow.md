# ADR-028: saldo negativo em conta no primeiro fluxo

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto e escopo

O Prumo acompanha fatos financeiros; não executa pagamentos nem autoriza transferências no banco. Um débito informado, uma transferência confirmada, uma entrada registrada tardiamente ou uma correção do marco podem produzir saldo calculado negativo em uma data, inclusive quando o saldo atual já é positivo. Bloquear a entrada para manter saldo não negativo pode esconder um fato real e impedir reconciliação. Aceitar o valor sem sinalização pode mascarar dado ausente, data errada ou uso de crédito bancário cuja natureza ainda não foi modelada.

Esta decisão cobre o saldo derivado de contas BRL do primeiro fluxo: receita recebida, despesa paga diretamente, transferência, débito comprovado em revisão e retificações das ADRs 016/026. Não decide cheque especial, empréstimo, juros, saldo disponível bancário, limites de crédito, contas em outras moedas ou autorização de pagamentos reais.

## Alternativas

1. **Rejeitar qualquer comando que crie saldo negativo em alguma data.** Impede esse resultado na projeção, mas esconde débitos efetivos e pode impedir correções retroativas verdadeiras.
2. **Permitir negativo somente com comprovante externo.** Reduz lançamentos manuais equivocados, mas impede o primeiro fluxo manual e trata a ausência de extrato como ausência do fato.
3. **Registrar fatos válidos e mostrar saldo assinado com alerta de revisão** (escolhida). Mantém a história reproduzível e facilita reconciliação; exige distinguir saldo calculado de disponibilidade bancária e não presumir a causa do negativo.

## Decisão

Saldo calculado de conta pode ser **negativo**. Um comando do primeiro fluxo que cumpre autorização, datas, vínculos, valor e demais invariantes não é rejeitado apenas porque o saldo derivado de uma conta fica abaixo de zero em um ou mais dias. Mostrar o valor assinado, as datas afetadas e alerta para revisão, inclusive quando o negativo existir só no histórico após inserção tardia ou retificação. Não truncar em R$ 0, esconder o movimento nem criar ajuste para zerá-lo. A origem da data e eventual condição contestada continuam identificadas conforme ADRs 016/025/026.

Um saldo negativo **não prova** cheque especial, dívida contratada, despesa adicional, juros, limite disponível ou erro específico. Não criar obrigação, receita, despesa, encargo ou empréstimo automaticamente. A reconciliação da ADR-016 compara a posição externa datada com o saldo calculado assinado e mostra a diferença; correção de fato ou marco exige a trilha das ADRs 016/026. A consulta anterior ao marco continua sem saldo calculável, não R$ 0 nem um negativo retroprojetado.

Transferência confirmada conserva dois movimentos opostos mesmo se a origem ficar negativa; não vira despesa. O valor em trânsito de par confirmado segue a ADR-007. Uma saída comprovada sem chegada reduz a origem mesmo se ela ficar negativa; o patrimônio afetado continua **incompleto/em revisão**, com subtotal conhecido das contas e débito pendente separados, sem tratar o débito como trânsito confirmado. A soma algébrica dos saldos assinados pode ser mostrada como subtotal conhecido das contas, identificada como tal, sem convertê-la automaticamente em patrimônio definitivo ou passivo bancário.

Comandos concorrentes seguem a ADR-027: cada efeito é confirmado uma vez e saldos são derivados de um estado íntegro; o alerta de negativo não autoriza duplicação nem efeito parcial. Orçamento mensal segue suas regras próprias: saldo negativo em conta não muda automaticamente limite, consumo ou classificação do orçamento. O Prumo não deve chamar o saldo calculado de “valor disponível para gastar”, pois isso exigiria regras de limite e liquidez ainda não definidas.

## Exemplos e critérios de verificação

- Conta com marco de R$ 100 no início de 01/02 e despesa paga diretamente de R$ 130 em 02/02 termina 02/02 em **R$ −30** e registra R$ 130 de despesa nessa data. Mostrar alerta e o movimento; não criar R$ 30 de empréstimo ou encargo. Entrada de R$ 50 em 03/02 leva o saldo a R$ 20, mas a consulta de 02/02 continua mostrando R$ −30.
- A = R$ 100 e B = R$ 50. Transferência confirmada de R$ 150, no mesmo dia, deixa A = R$ −50 e B = R$ 200, com soma de contas R$ 150 e receita/despesa R$ 0. Se apenas a saída em A estiver comprovada, A = R$ −50 e B = R$ 50 formam subtotal conhecido R$ 0; débito de R$ 150 fica em revisão e o patrimônio afetado permanece incompleto, conforme ADR-007.
- Retificar em março o valor de uma despesa de fevereiro de R$ 80 para R$ 130 pode fazer fevereiro passar de R$ 20 a R$ −30. A versão aceita única recalcula fevereiro, alerta para revisão e preserva março como data da retificação, sem novo débito em março (ADR-026).
- Duas saídas distintas de R$ 80 simultâneas numa conta com R$ 100 e chaves de pedido diferentes podem deixar R$ −60 após ambas, sem perda de movimento. Dez retries de uma das saídas com a mesma chave continuam representando apenas uma saída de R$ 80 (ADR-027).

## Consequências e pendências

Esta regra preserva fatos informados mesmo quando o histórico parece improvável; o alerta e a reconciliação deixam a causa para revisão. A implementação deve testar consultas históricas, recálculo e concorrência com valores assinados em centavos de BRL, sem usar saldo atual como único validador. Permanecem pendentes: modelagem de cheque especial/obrigações bancárias e saldo disponível; mecanismo físico de recálculo; formato e prioridade do alerta; isolamento técnico do household e contrato da API.

## Conceitos para estudo

Saldo assinado versus saldo disponível, reconciliação, fato observado versus interpretação econômica, projeção histórica, transferência conservativa e alerta sem bloqueio.
