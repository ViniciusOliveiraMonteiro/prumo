# ADR-026: retificação de movimentos de conta e transferências

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto e escopo

O primeiro fluxo da Sprint 5 registra receita recebida, despesa de consumo paga diretamente e transferência entre contas do mesmo household. As ADRs 007, 016, 017 e 025 definem a identidade conceitual do evento, os movimentos vinculados, o marco inicial, o período econômico e a revisão de datas conflitantes. Esta ADR define o que acontece quando valor, conta ou dia efetivo de um desses fatos foi registrado incorretamente, ou quando o fato nunca ocorreu. Uma correção tardia pode alterar saldos e relatórios passados; um reembolso ou transferência posterior é um fato novo, com data própria.

Esta decisão trata apenas dos três tipos acima e do débito de transferência em revisão da ADR-007. Correção de marco inicial segue a ADR-016; correção de categoria de compra e seus reembolsos segue a ADR-017; compras, pagamentos e créditos de cartão seguem suas ADRs específicas. Não decide correção de tipo econômico, importação por formato, estrutura física ou contrato da API.

## Alternativas

1. **Alterar o registro atual sem versão.** Simplifica a projeção, mas perde o valor anterior e não explica por que saldos e períodos mudaram.
2. **Sempre criar um evento compensatório na data da revisão.** Deixa visível o ajuste de caixa no dia da correção, mas descreve como novo movimento uma entrada ou saída que nunca ocorreu naquele dia e pode deslocar receita/despesa para o mês errado.
3. **Manter a identidade do fato e versões auditáveis dos seus efeitos** (escolhida). A versão aceita mais recente explica o saldo e o período econômico; versões anteriores e evidências explicam a revisão. Exige recálculo histórico e controle de alterações concorrentes.

## Decisão

Uma **retificação** corrige a descrição de um fato anterior; mantém a identidade do evento e de seus efeitos vinculados. Cada revisão aceita guarda versão anterior e nova, autor, instante da revisão, motivo e evidência ou afirmação da pessoa. Somente a versão aceita vigente contribui para saldos, receita/despesa e posições em trânsito. Versões anteriores permanecem consultáveis como trilha, sem efeito financeiro adicional. A revisão pode mudar valor positivo, conta autorizada do mesmo household e moeda, ou dia efetivo, respeitando a ADR-025. Alterar texto descritivo ou categoria não muda caixa; correção de categoria da compra paga diretamente já segue a ADR-017.

**Valor, conta e data.** Ao aceitar uma correção, recalcular os saldos das contas e os períodos econômicos afetados a partir dos dias anteriores e novos; reavaliar reconciliações datadas, mostrando diferenças sem ajuste automático. O dia da revisão não é data de efeito. Uma receita de R$ 200 alterada para R$ 180 contribui com R$ 180 uma vez, sem uma segunda entrada de R$ −20. Mover sua data de maio para junho remove o efeito de maio e o coloca em junho. Mudar a conta remove o efeito da conta antiga e o atribui à nova, em uma única revisão íntegra. Não mudar a classificação econômica automaticamente ao trocar conta, data ou valor.

**Transferência confirmada.** Valor, conta de origem/destino e data de cada lado são revistos como **um único par**: duas contas distintas do mesmo household, mesma moeda e valores opostos. A revisão é aceita inteira ou não altera nenhum dos lados. A posição em trânsito entre as datas é recalculada, sem receita ou despesa. Se a evidência mostrar que a chegada antes vinculada não ocorreu, preservar o débito de origem comprovado como movimento único em revisão, conforme a ADR-007; retirar o crédito e o trânsito confirmados sem converter o débito em despesa. A forma física dessa transição fica pendente.

**Cancelamento.** Usar cancelamento somente quando o fato registrado **não ocorreu** ou foi atribuído por engano ao household. A versão vigente deixa de produzir efeitos, mas evento, fontes e motivo continuam na trilha. Se dinheiro realmente saiu e depois voltou, registrar o fato posterior vinculado sob sua regra própria, como reembolso da ADR-017; não apagar o fato original nem chamar o retorno de correção. Para transferência, cancelar um par afirmado como inexistente remove os dois efeitos juntos. Se apenas um lado permanecer comprovado, seguir o estado de débito em revisão acima, em vez de cancelar essa saída real.

**Pré-condições e vínculos.** A revisão não pode produzir movimento anterior ao marco da conta: manter a proposta de correção pendente e o último efeito sustentado visível como contestado até a correção justificada do marco, conforme ADR-016/025. A revisão de uma compra com reembolsos vinculados não pode deixar a soma reembolsada acima do novo valor elegível nem quebrar a conservação de uma entrada já recebida; exigir resolução vinculada e íntegra antes de aceitá-la. Conflito com fonte externa não altera sozinho a versão aceita: a ADR-025 mantém o último efeito sustentado contestado até revisão. Operação e revisão devem verificar autorização do household e recursos envolvidos.

## Exemplos e critérios de verificação

- Com conta A em R$ 2.000, despesa direta de R$ 80 em 01/02 deixa A em R$ 1.920 e despesa de fevereiro em R$ 80. Corrigir o valor para R$ 70 faz A = R$ 1.930 e despesa = R$ 70. A trilha mostra R$ 80 → R$ 70; não existe segundo movimento de R$ 10.
- Se a despesa real de R$ 80 ocorreu em 01/02 e houve reembolso real de R$ 10 em 05/02, manter dois eventos vinculados, saída e entrada em suas datas, segundo a ADR-017. O saldo final também pode ser R$ 1.930, mas o histórico explica dois fatos diferentes.
- Transferência de R$ 300 sai de A = R$ 2.000 em 01/02 e chega a B = R$ 500 em 03/02. Corrigir ambos os valores para R$ 250 mantém A = R$ 1.750, B = R$ 750 e R$ 250 em trânsito entre as datas; receita/despesa permanecem zero. Uma falha no crédito corrigido deixa ambos os lados na versão anterior, sem par misto.
- Se a chegada acima for desmentida mas a saída de R$ 300 continuar comprovada, A = R$ 1.700, B = R$ 500, débito de R$ 300 em revisão e patrimônio afetado incompleto; não há trânsito confirmado nem segundo débito. Se ambos os lados nunca ocorreram, o cancelamento conserva A = R$ 2.000 e B = R$ 500, com a trilha do registro cancelado.
- Compra paga diretamente de R$ 80 com R$ 50 já reembolsados não pode ser reduzida para R$ 40 sem resolver os R$ 10 de excesso; a tentativa não cria saldo ou despesa parcial. Uma data corrigida para antes do marco também não entra na projeção enquanto o marco não for revisto.

## Consequências e pendências

O modelo precisa distinguir identidade do evento, versão vigente, histórico de revisão e efeitos derivados. Esta escolha **não exige event sourcing** nem define tabelas; a estrutura física ainda precisa de desenho. A ADR-027 define identidade persistente do pedido, versão esperada e confirmação íntegra para revisões concorrentes do primeiro fluxo. A ADR-028 permite saldo negativo após retificação, com alerta e recálculo histórico. Permanecem pendentes: mecanismo físico de concorrência, correção de tipo econômico, dependências mais complexas, origem/importação por formato e interface da revisão. A semântica de ajustes de reconciliação sem causa permanece fora do MVP, conforme ADR-016/008.

## Conceitos para estudo

Retificação versus fato posterior, versão vigente, trilha de auditoria, projeção histórica, invariantes de transferência, reconciliação e controle de concorrência.
