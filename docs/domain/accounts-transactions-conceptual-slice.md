# Recorte conceitual de contas e transações

**Status:** proposta de estudo da Sprint 1 para preparar a Sprint 5. Reúne decisões já aceitas; perguntas marcadas **PENDENTE** não são regras de produto, contrato de API, esquema físico nem autorização de implementação.

## Limite do primeiro fluxo

O fluxo mínimo mostra o saldo de duas contas de um household, registra uma receita recebida, uma despesa de consumo paga diretamente e uma transferência entre elas, e consulta os eventos e movimentos que explicam cada saldo. Conta tem marco inicial datado; `Transaction` identifica o evento; movimentos vinculados explicam efeitos em conta. Cada recurso referenciado deve pertencer ao household autorizado, resolvido no backend (ADRs 007 e 016). BRL em centavos inteiros e moeda explícita seguem a ADR-006.

Reembolso direto e correção de categoria já têm semântica aprovada na ADR-017, mas não são necessários para demonstrar o primeiro fluxo. Cartão, fatura, importação e operações sem liquidação imediata ficam fora deste recorte. Este limite não retira essas capacidades do plano das Sprints 5–7.

## Comandos conceituais e resultados observáveis

| Comando candidato | Dados de domínio necessários | Resultado e regra já aceita | Decisão exigida antes de implementar |
|---|---|---|---|
| Abrir conta | Household autorizado, identificação da conta, BRL, data e valor do marco inicial | Marco representa o início do dia e não gera receita; movimentos efetivos nessa data integram o saldo derivado. Movimento anterior fica pendente até correção justificada do marco para data anterior, com saldo informado nessa data. Valor inicial incorreto pode ser corrigido com justificativa e recálculo mesmo após movimentos. Marco informado cedo demais pode avançar com novo saldo informado e movimentos anteriores pendentes; marco informado tarde demais pode recuar mesmo sem movimento a incluir, com saldo informado para a nova data (ADR-016). | Tipos/estado e unicidade da conta, distinção de horário confiável. |
| Registrar receita recebida | Conta autorizada, valor positivo em centavos, data em que o dinheiro chegou, descrição e classificação | Um evento, um movimento `+valor` e uma receita no mês do recebimento; data de registro posterior fica na trilha, sem deslocar o efeito (ADRs 007, 016 e 017). Data informada pela pessoa e evidência conflitante seguem a ADR-025. | Correção geral de valor/data/conta, idempotência e interpretação de fontes por formato. |
| Registrar despesa de consumo paga diretamente | Conta autorizada, valor positivo em centavos, data em que saiu da conta, descrição e uma categoria | Um evento, um movimento `−valor` e uma despesa no mês do débito; data de registro posterior fica na trilha (ADRs 007, 016 e 017); uma categoria por compra no MVP. | Política de saldo negativo, correção de valor/data/conta e tratamento de débito ainda não confirmado. |
| Transferir entre contas | Duas contas distintas e autorizadas do mesmo household, mesmo BRL, valor positivo e data efetiva de cada lado | Um evento sem receita/despesa e exatamente dois movimentos opostos, confirmados juntos. Cada conta muda na própria data efetiva; com par confirmado, o valor em trânsito separado conserva o consolidado patrimonial entre as datas e zera na chegada (ADR-007). Cada lado exige dia efetivo próprio (ADR-025). | Critérios de correspondência dos lados e interpretação por formato, idempotência, concorrência, saldo negativo, correção/cancelamento. |
| Registrar saída comprovada com chegada ainda não confirmada | Conta de origem autorizada, débito comprovado, valor e data efetiva | Origem diminui uma vez; débito fica visível em revisão, sem despesa, transferência confirmada ou valor em trânsito. Mostrar subtotal das contas e débito pendente separados, com patrimônio afetado marcado incompleto. Ao comprovar e vincular a chegada, reutilizar o débito sem repeti-lo (ADR-007). | Forma física da revisão e correspondência da chegada. |
| Consultar saldo e histórico | Conta autorizada e data de consulta | Saldo na data sem horário é o do fim do dia, incluindo os movimentos efetivos nessa data desde o marco; antes do marco, mostrar saldo não calculável e a data do marco, sem valor presumido. Cada movimento alcança seu evento. Sem horário confiável, movimentos da mesma data aparecem em sequência de registro estável, identificada como tal. Diferença com saldo externo datado fica visível sem ajuste automático (ADRs 007 e 016). | Tratamento de horários confiáveis. |

Os campos acima são necessidades conceituais, não um payload. A autorização do ator e dos recursos deve ser resolvida a cada leitura ou escrita; IDs recebidos do cliente não provam acesso. Uma falha em qualquer parte de um evento com seus movimentos não deixa efeito parcial.

## Datas e períodos

| Fato | Data que rege o efeito já decidido | Informação que precisa permanecer distinguível |
|---|---|---|
| Marco inicial | Início da data informada para o histórico conhecido da conta (ADR-016). | Data de registro ou de correção do marco não vira receita. Movimento anterior exige revisão e marco corrigido para data anterior, com saldo informado, motivo e trilha; movimento na própria data entra no histórico. |
| Receita recebida | Dia em que o dinheiro chega; saldo e receita seguem essa data mesmo se o registro no Prumo vier depois (ADRs 016 e 017). | Data do registro e mês a que a remuneração se refere ficam distintos; receita ainda a receber está pendente. |
| Despesa de consumo paga diretamente | Dia do débito da conta; saldo e despesa seguem essa data mesmo se o registro vier depois (ADRs 016 e 017). | Data do registro e dia da compra ficam distintos; obrigação ainda não debitada está pendente. |
| Transferência | Cada movimento altera sua conta na própria data efetiva, mesmo que as duas datas sejam diferentes (ADR-007). | Com par confirmado, o valor entre os dias aparece em trânsito separado das contas. Saída sem chegada comprovada altera somente a origem e permanece em revisão, sem posição em trânsito confirmada; comprovação de cada data, data informada pelo usuário e data de registro permanecem distintas. |
| Correção | **PENDENTE:** definir quais mudanças recalculam o histórico e em que data. | Data da revisão e identidade do autor devem ficar rastreáveis, separadas da data do efeito. |

## Correções e rejeições a decidir

A ADR-007 exige que correção ou cancelamento de transferência preserve os dois lados e a trilha, mas não escolhe entre editar com histórico, evento de reversão ou substituição vinculada. A ADR-016 permite corrigir o valor inicial com motivo e trilha mesmo após movimentos, recalculando saldos e divergências de reconciliação sem criar transação. A ADR-017 já estabelece que corrigir a categoria de uma compra paga diretamente reclassifica a compra no mês original e seus reembolsos vinculados nos respectivos meses, sem alterar caixa, valores ou datas.

Antes do esquema físico da Sprint 5, decidir e registrar em ADR ou complemento das ADRs existentes:

1. **Marco e histórico:** a ADR-016 já mantém movimento anterior pendente até correção justificada do marco para data anterior, com saldo informado e recálculo; permite corrigir valor inicial errado após movimentos; permite avançar ou recuar o marco com saldo informado para a nova data, mantendo movimentos anteriores visíveis e pendentes; inclui movimentos efetivos no dia do marco; usa ordem de registro estável quando falta horário confiável; interpreta consulta por data como saldo ao fim do dia e mostra ausência de saldo calculável antes do marco. Ainda decidir forma física da pendência.
2. **Data e identidade do fato:** a ADR-016 separa data efetiva de data de registro: a primeira determina saldo histórico e período econômico para os eventos delimitados; a segunda preserva a trilha. A ADR-007 permite datas efetivas distintas nos dois lados da transferência, mostra valor em trânsito no consolidado para o par confirmado e mantém saída comprovada sem chegada em revisão, com débito único na origem, subtotal conhecido e patrimônio afetado incompleto. A ADR-025 usa o dia do efeito na conta, preserva as datas alegadas pela fonte e mantém conflito ou dia insuficiente em revisão sem duplicação. Ainda definir estado físico, correspondência e rótulos por formato, e critério de horário confiável.
3. **Retificação financeira:** definir alteração de valor, conta, data e cancelamento de receita/despesa/transferência, incluindo ligação ao fato original. Atualizar o fato com versões facilita projeções; evento compensatório explicita cada efeito no histórico. Ambos exigem recomputar relatórios sem duplicar o evento econômico.
4. **Validade do comando:** política de saldo negativo, repetição do mesmo pedido e comandos concorrentes. Sem essas regras não há garantia de resultado único nem teste suficiente para o primeiro fluxo.
5. **Segurança:** autorização por membership e recurso, escopo das categorias e estratégia técnica de isolamento do household devem ser decididos antes de persistir o fluxo; RLS versus filtros de aplicação segue em aberto no threat model.

Reembolso direto com entrada externa superior ao saldo elegível exigirá partes que conservem uma única entrada, conforme ADR-017, quando esse comando entrar no trabalho. Correspondência e deduplicação de linhas importadas pertencem à Sprint 7.

## Conferência do recorte

Com A = R$ 2.000 e B = R$ 500 nos respectivos marcos, registrar receita recebida de R$ 200 em A, despesa paga de R$ 80 em A e transferência de R$ 300 de A para B. Os saldos derivados são A = R$ 1.820 e B = R$ 800; o total passa de R$ 2.500 para R$ 2.620 somente pelos R$ 200 de receita e R$ 80 de despesa. A transferência conserva R$ 2.620 e não entra nos indicadores. Se falhar o crédito em B, A continua R$ 2.120 e B R$ 500 no estado anterior à transferência. Uma tentativa com B de outro household ou outra moeda é rejeitada integralmente.

Para conferir períodos, salário referente a maio e recebido em junho pertence a junho; compra em 31/05 debitada em 01/06 pertence a junho. O saldo inicial não entra na receita de nenhum mês. Uma divergência externa de R$ 10 mostra diferença de R$ 10 sem criar transação. Datas divergentes ou incompletas seguem a ADR-025: registrar suas alegações não cria outro movimento, e candidato sem dia efetivo suficiente permanece sem efeito. Estes exemplos usam somente semânticas aprovadas nas ADRs 006, 007, 016, 017 e 025; os comandos de correção geral acima continuam pendentes.

## Próximo passo

A ADR-025 foi aceita para datas divergentes ou incompletas de movimentos de conta. Próxima decisão: retificação financeira de valor, conta, data e cancelamento de receita, despesa direta e transferência, preservando o fato original, as evidências e o recálculo sem duplicação. Depois, decidir idempotência/concorrência e isolamento. Só então desenhar esquema físico e contrato da API para contas e transações. Conceitos para estudo: marco de saldo, data efetiva, proveniência da evidência, evento e movimento, posição em trânsito, projeção histórica, atomicidade, idempotência e isolamento de tenant.
