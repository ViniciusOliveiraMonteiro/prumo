# ADR-025: datas divergentes ou incompletas de movimentos de conta

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

As ADRs 007, 016 e 017 já definem que cada movimento altera sua conta na data em que o dinheiro efetivamente entrou ou saiu; receita recebida e despesa paga diretamente usam essa data também para o mês econômico. Elas não dizem como estabelecer o dia quando um comprovante mostra, por exemplo, data da operação e data da compensação, quando duas fontes discordam ou quando falta o dia. Escolher por conveniência pode deslocar saldo e indicadores entre meses. A ADR-021 trata de crédito aplicado **ao cartão**, com regra própria de data estimada pelo fechamento; essa estimativa não se estende automaticamente a contas.

## Alternativas

1. **Primeira data disponível.** Simplifica entrada, mas confunde compra, ordem, lançamento, compensação e registro. Pode antecipar um efeito que ainda não atingiu a conta.
2. **Última data disponível.** Evita parte das antecipações, mas uma data de emissão de extrato ou de importação pode ser posterior ao débito real.
3. **Interpretar o papel de cada data e manter revisão onde falta prova** (escolhida). Preserva o significado financeiro e a origem de cada alegação; exige revisão e pode deixar fatos sem efeito calculado até haver dia suficiente.

## Decisão

Para um movimento de conta, usar como data efetiva o **dia em que o saldo daquela conta foi afetado**. A fonte ou a pessoa deve identificar esse dia com precisão diária. Se a fonte distinguir claramente data da ordem/compra e data da compensação ou do débito/crédito efetivo, guardar ambas e usar a segunda para saldo e, nos casos das ADRs 016/017, para o mês econômico. A data de registro no Prumo permanece separada. Uma data rotulada apenas como “lançamento”, sem definição do seu efeito no saldo, não prova sozinha a data efetiva. Uma posição externa datada pode ajudar a conferir o dia, mas diferença de saldo isolada não cria movimento nem determina sua data.

No registro manual do primeiro fluxo, a pessoa informa explicitamente o dia em que afirma que a conta foi afetada; o Prumo identifica a origem como **informação da pessoa**, não como confirmação bancária. Se uma fonte posterior trouxer outro dia para o **mesmo** movimento, vincular a evidência ao fato existente e abrir revisão. Enquanto o conflito não for resolvido, manter o último dia sustentado que já produzia efeito, marcado como **contestado**, sem criar segundo movimento nem substituir o dia automaticamente. Se ainda não houver dia sustentado, manter o fato candidato visível e pendente, sem efeito no saldo ou no mês econômico. Resolver exige escolher o dia e registrar fonte ou justificativa, pessoa responsável, dia da revisão e valores anteriores; o mesmo movimento é recalculado nos períodos afetados, sem duplicação. Isto define somente a semântica da data; a mecânica geral de retificação ainda será decidida.

Se a fonte trouxer somente mês, intervalo, uma data ilegível ou datas com papéis indistinguíveis, não inferir um dia a partir do fechamento do mês, da importação ou do registro. Solicitar que a pessoa informe o dia efetivo, identificando a afirmação como manual, ou manter o candidato pendente. Para transferência, cada lado precisa do próprio dia efetivo para confirmar o par e calcular o trânsito conforme a ADR-007; um lado comprovado sem chegada segue como débito em revisão, sem inventar o dia da chegada. A análise da fonte deve sempre identificar a conta e o movimento a que a data pertence; correspondência automática entre linhas e formatos continua pendente para a Sprint 7.

## Exemplos e critérios de verificação

- Compra em 31/05, débito efetivo de R$ 80 na conta em 01/06 e registro em 03/06: o saldo e a despesa de consumo mudam em **01/06**; as três datas preservam seus papéis. Uma linha que só diga “31/05” sem especificar se esse foi o dia do débito requer confirmação, sem antecipar o efeito.
- Pessoa registra entrada de R$ 200 com dia efetivo informado como 01/06. Um extrato posterior atribui ao mesmo crédito o dia efetivo de 02/06: até a revisão, há uma entrada de R$ 200 em 01/06 marcada como contestada, com a alegação de 02/06 visível. Se a revisão confirmar 02/06, o saldo de 01/06 cai R$ 200 e o de 02/06 volta a incluí-los; a receita de junho continua R$ 200 e não surge outra entrada.
- Fonte informa apenas “maio” para débito de R$ 80: candidato pendente não altera saldo, despesa ou orçamento. Se a pessoa informar e justificar 31/05 como dia efetivo, o mesmo candidato passa a produzir um movimento nessa data, sujeito ao marco da ADR-016.
- Saída de R$ 300 em 01/02 com chegada indicada apenas como “fevereiro”: a origem reflete o débito comprovado; sem dia efetivo e confirmação da chegada, não há crédito presumido em B nem trânsito confirmado.

## Consequências e pendências

A decisão dá uma regra verificável ao primeiro fluxo manual e evita transformar datas incompletas em fatos precisos. A revisão precisa mostrar o efeito contestado e a alegação nova sem contá-los duas vezes. Permanecem pendentes: critérios por formato para reconhecer rótulos e correspondência entre linhas; horário confiável e fuso quando houver timestamps; retificação de valor, conta, tipo ou cancelamento; idempotência, concorrência e estrutura física da pendência. Nenhum desses pontos é aprovado por esta ADR.

## Conceitos para estudo

Data do fato versus data do registro, proveniência da evidência, fato contestado, projeção temporal, correção auditável e idempotência.
