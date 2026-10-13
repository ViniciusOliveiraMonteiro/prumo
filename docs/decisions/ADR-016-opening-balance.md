# ADR-016: saldo inicial e reconciliação de contas

- **Status:** aceito
- **Data:** 2026-10-05
- **Complementos aprovados:** 2026-10-08 — movimento anterior ao marco, correção do valor inicial, marco no início do dia, ordem de registro sem horário confiável, consulta por data no fim do dia, correção da data do marco, ausência de saldo calculável antes do marco e distinção entre data efetiva e data de registro

## Contexto

O histórico importado para uma conta pode começar depois da abertura real da conta. Sem um marco inicial, somar apenas os movimentos conhecidos não reproduz o saldo; tratar o marco como receita distorce o relatório mensal.

## Drivers

- Explicar saldos mesmo com histórico parcial.
- Distinguir patrimônio já existente de receita do período.
- Mostrar divergências com fonte externa sem apagá-las silenciosamente.

## Alternativas

### Marco datado e saldo derivado

O saldo posterior é reproduzível a partir do marco e dos movimentos. Mudanças no passado e ajustes exigem regras de auditoria.

### Saldo editável como fonte principal

Permite reproduzir rapidamente o número mostrado pelo banco, mas uma edição pode esconder lançamentos ausentes ou duplicados.

## Decisão

Cada conta começa com um **saldo inicial datado**. O saldo posterior é derivado desse marco e dos movimentos conhecidos desde então. O saldo inicial não é receita nem despesa do período. A reconciliação compara o saldo calculado com um saldo externo datado e apresenta a diferença para revisão. Correções devem manter motivo e trilha de auditoria; não podem alterar o saldo silenciosamente.

Esta ADR não define a estrutura de `Transaction`, persistência de snapshots nem a semântica financeira de um ajuste aprovado. A ADR-007 define o modelo conceitual de transações; regras de reconciliação mais detalhadas seguem necessárias antes da implementação.

### Movimento anterior ao marco — complemento

Um movimento cuja data efetiva seja anterior à data do saldo inicial **não entra no histórico calculado nem altera o saldo posterior enquanto o marco permanecer nessa data**. A tentativa fica pendente para revisão, sem inclusão financeira parcial. Para incluí-lo, a pessoa deve corrigir o marco para uma data anterior ao movimento e informar o saldo correspondente naquela nova data, com motivo e histórico da alteração. O Prumo não presume esse saldo anterior a partir do marco antigo: podem existir outros movimentos desconhecidos no intervalo. Depois da correção, o saldo posterior é recalculado a partir do novo marco e dos movimentos conhecidos desde ele. O marco antigo e a justificativa continuam rastreáveis.

Alternativa considerada: aceitar movimentos anteriores mantendo o marco intacto. Isso deixaria o evento visível sem explicar se ele compõe o saldo posterior ou poderia contá-lo duas vezes; a revisão explícita mantém um único ponto de partida para o saldo derivado.

Exemplo: conta com marco em 01/02 de R$ 5.000. Surge entrada de R$ 200 em 31/01; ela fica pendente e o saldo desde 01/02 permanece R$ 5.000. Se a pessoa comprovar e informar um novo marco de R$ 4.800 em 30/01, com justificativa, a entrada de 31/01 passa a compor o histórico e o saldo em 01/02 volta a R$ 5.000, na ausência de outros movimentos. O sistema não calcula R$ 4.800 automaticamente. O marco não gera receita; a classificação e o período da entrada seguem as regras do seu evento.

### Correção do valor inicial após movimentos — complemento

Se o valor do marco foi informado incorretamente, a pessoa autorizada pode corrigi-lo mesmo depois de registrar movimentos posteriores. A correção exige justificativa e histórico do valor anterior, do novo valor, da autoria e da data da revisão. O Prumo recalcula os saldos derivados a partir do marco corrigido e volta a comparar as reconciliações afetadas com as posições externas correspondentes, mostrando divergências novas ou alteradas para revisão. A correção do marco não cria `Transaction`, receita, despesa nem movimento de conta; os eventos posteriores conservam seus valores, datas e classificações.

Alternativa considerada: congelar o valor do marco após o primeiro movimento. Simplifica o cálculo, mas obrigaria manter um ponto de partida sabidamente incorreto ou inventar um ajuste econômico para compensá-lo. A revisão auditável conserva a origem da mudança e permite explicar os saldos recalculados.

Exemplo: marco em 01/02 de R$ 5.000, entrada posterior de R$ 200 e saída de R$ 80 produzem R$ 5.120. Ao comprovar que o marco correto nessa data era R$ 4.990, a pessoa o corrige com justificativa; o saldo derivado passa a R$ 5.110, sem alterar a receita de R$ 200 nem a despesa de R$ 80. Uma posição externa de R$ 5.120 que antes coincidia agora gera divergência de R$ 10 visível, sem ajuste automático.

### Marco no início do dia — complemento

O saldo inicial datado representa o saldo **no início da data informada**, antes dos movimentos efetivos desse dia. Movimentos com data efetiva igual à data do marco entram no histórico derivado. Assim, marco de R$ 5.000 em 01/02 e entrada de R$ 200 efetiva em 01/02 produzem R$ 5.200 após essa entrada. O marco continua sem classificação de receita ou despesa; a entrada é classificada pelo próprio evento.

Alternativa considerada: interpretar o marco como saldo no fim do dia e excluir movimentos dessa data. Isso tornaria ambígua a inclusão de fatos conhecidos do primeiro dia. O limite no início do dia explicita quando a derivação começa.

### Ordem quando falta horário confiável — complemento

Para vários movimentos da mesma conta com a mesma data efetiva e **sem horário confiável**, o histórico usa uma sequência de registro persistida e estável. A apresentação a identifica como **ordem de registro**, sem afirmar que reproduz a ordem real dos acontecimentos. Uma leitura posterior não muda silenciosamente a sequência já atribuída. A soma e o saldo após todos os movimentos do dia independem dessa ordem; ela não comprova um saldo intradiário real.

Alternativa considerada: ordenar por valor, descrição ou uma suposição de horário. Essa ordenação pareceria cronológica sem evidência e poderia mudar após correções de texto ou valor. A sequência de registro preserva a explicação da apresentação, com o limite de não revelar a cronologia real.

Exemplo: marco de R$ 5.000 no início de 01/02, entrada de R$ 200 registrada antes de saída de R$ 80, ambas efetivas em 01/02 sem horário confiável. O histórico mostra entrada e depois saída como ordem de registro; o saldo ao fim do conjunto é R$ 5.120. Se a saída ocorreu primeiro na realidade, o saldo final continua R$ 5.120. Os saldos intermediários da apresentação não são prova da ordem real.

### Consulta de saldo por data — complemento

Quando a consulta informa uma data sem horário, o saldo dessa conta nessa data é o **saldo ao fim do dia**, após todos os movimentos efetivos nessa data. O cálculo parte do marco no início de sua data e inclui os movimentos conhecidos com data efetiva até a data consultada, inclusive. A sequência de registro sem horário confiável não altera esse resultado.

Alternativa considerada: tratar a data consultada como início do dia, antes dos movimentos dessa data. Isso faria “saldo em 01/02” omitir movimentos de 01/02 e exigiria consultar 02/02 para conhecer o fechamento do dia desejado. O fim do dia corresponde melhor à leitura diária do saldo; o marco inicial continua identificado separadamente como saldo no início do seu dia.

Exemplo: marco de R$ 5.000 no início de 01/02, entrada de R$ 200 e saída de R$ 80 efetivas em 01/02. Consultar saldo em 01/02, sem horário, retorna R$ 5.120. O valor de R$ 5.000 continua sendo o marco no início daquele dia, não a resposta à consulta diária.

### Correção do marco para data posterior — complemento

Se a data do marco foi informada cedo demais, a pessoa autorizada pode corrigi-la para uma data posterior, informando o saldo no início da nova data, motivo e histórico da alteração. Os movimentos que passam a ser anteriores ao marco ficam **visíveis e pendentes para revisão**, sem integrar o saldo derivado a partir do novo marco. Os movimentos na nova data ou depois permanecem no cálculo; os saldos derivados e as reconciliações afetadas são recalculados. A correção não apaga os movimentos nem cria uma transação de ajuste, receita ou despesa. O marco antigo, o novo e a autoria da revisão permanecem rastreáveis.

Alternativa considerada: impedir o avanço da data se já houver movimentos no intervalo. Isso conservaria uma data sabidamente errada ou exigiria cancelar fatos legítimos para corrigi-la. Permitir a revisão com movimentos anteriores pendentes mantém o limite do histórico conhecido explícito e preserva os fatos para análise.

Exemplo: marco de R$ 5.000 no início de 01/02, entrada de R$ 200 em 02/02 e saída de R$ 80 em 04/02 produzem R$ 5.120 em 04/02. Se o marco correto for 03/02 com saldo informado de R$ 5.200 no início desse dia, a entrada de 02/02 fica pendente, a saída de 04/02 continua ativa e o saldo de 04/02 é R$ 5.120. O valor de R$ 5.200 não é inferido automaticamente da entrada; foi informado para a nova data. A entrada de 02/02 continua visível, sem ser somada novamente ao novo marco.

### Consulta anterior ao marco — complemento

Uma consulta de saldo com data anterior à data do marco retorna **saldo não calculável antes do marco**, acompanhado da data do marco conhecido. Ela não retorna R$ 0, o valor do marco nem um saldo presumido para o passado. Movimentos anteriores que estejam pendentes continuam visíveis para revisão em seu contexto, sem fornecer um saldo derivado anterior ao ponto de partida.

Alternativa considerada: devolver zero ou repetir o primeiro saldo conhecido. Zero parece uma posição real e repetir o marco desloca para o passado uma observação que só vale em sua data. A indicação de ausência de base evita os dois erros.

Exemplo: com marco de R$ 5.000 no início de 01/02, consultar 31/01 mostra “saldo não calculável antes do marco” e “marco em 01/02”; não mostra R$ 0 nem R$ 5.000 como saldo de 31/01.

### Correção do marco para data anterior sem movimento a incluir — complemento

Se a data do marco foi informada tarde demais, a pessoa autorizada pode antecipá-la mesmo sem haver movimento anterior a incluir. Deve informar o saldo correspondente **no início da nova data** e justificar a correção; data, valor, autoria e motivo anteriores e novos permanecem rastreáveis. O Prumo recalcula saldos posteriores e revisa reconciliações afetadas a partir do novo marco. O valor antigo não é copiado automaticamente para a data anterior nem se torna um segundo marco ativo. A correção não cria receita, despesa, movimento de conta ou ajuste automático.

Alternativa considerada: permitir recuo apenas para incluir um movimento pendente. Isso impediria corrigir uma data errada quando o intervalo não contém movimentos conhecidos. Exigir saldo informado na nova data evita projetar o valor anterior para trás sem base.

Exemplo: marco informado como R$ 5.000 no início de 01/02, sem movimentos em 30/01 e 31/01. Se a data correta era 30/01, a pessoa informa e justifica R$ 5.000 no início de 30/01. O saldo no fim de 31/01 passa de não calculável a R$ 5.000; o de 01/02 permanece R$ 5.000. O valor igual neste exemplo foi informado, não presumido pelo sistema.

### Data efetiva distinta da data de registro — complemento

A data em que o movimento afetou a conta é sua **data efetiva** e determina a posição histórica do saldo. A data em que a pessoa o registrou no Prumo é preservada separadamente para auditoria e não desloca o movimento para esse dia. Para receita recebida, a data efetiva também determina o mês da receita; para despesa de consumo paga diretamente, determina o mês da despesa (ADR-017). O momento do registro não cria novo efeito financeiro. Uma inserção tardia recalcula os saldos e períodos afetados, preservando a data do registro.

Alternativa considerada: usar a data do registro como data do saldo e dos indicadores. Isso deslocaria fatos registrados com atraso e faria saldos históricos dependerem de quando a pessoa usou o aplicativo, não de quando o dinheiro entrou ou saiu.

Exemplo: entrada efetiva de R$ 200 em 01/02, registrada em 05/02. Com marco de R$ 5.000 no início de 01/02, o saldo no fim de 01/02 é R$ 5.200 e a receita pertence a fevereiro; 05/02 permanece na trilha como data do registro, sem segunda entrada.

A ADR-025 define como estabelecer a data efetiva quando a fonte mostra datas diferentes ou incompletas, preservando as alegações e a revisão sem duplicar movimento. Permanecem pendentes: distinção operacional de horário confiável, interpretação de rótulos por formato, forma física da pendência, correção/cancelamento de movimentos e semântica de um ajuste de reconciliação aprovado.

## Consequências

- Com marco de R$ 5.000, entrada de R$ 200 e saída de R$ 80, o saldo calculado é R$ 5.120; a receita do período é R$ 200.
- Um saldo externo de R$ 5.110 produz divergência de R$ 10, não uma transação automática de R$ 10.
- Importação e edição retroativa precisam preservar a possibilidade de recalcular e explicar o saldo.

## Gatilhos para revisitar

Contas cujo saldo não pode ser explicado por movimentos discretos, limites de desempenho da derivação ou necessidade comprovada de estratégia distinta para investimentos.

## Conceitos para estudo

Marco de abertura, saldo derivado, reconciliação, ajuste auditável e projeção de leitura.
