# ADR-022: revisão de conflitos e destino entre faturas de crédito aplicado

- **Status:** aceito para valor conflitante e revisão do destino entre faturas na Sprint 1
- **Data:** 2026-10-06

## Contexto

A ADR-021 exige prova do emissor para reconhecer a aplicação e mantém linhas ambíguas em revisão. A ADR-019 já permite reduzir a dívida **total** pelo crédito aplicado mesmo sem saber qual fatura recebeu o abatimento; o usuário pode distribuir provisoriamente o valor entre faturas do mesmo cartão, com saldos individuais **estimados**, e corrigir quando o emissor informar o destino. Esta ADR define o tratamento de uma nova evidência que contradiga uma aplicação já registrada, por exemplo R$ 30 onde a fonte anterior mostrava R$ 40.

Esse conflito é diferente de corrigir apenas a **data** ou o **destino** do mesmo valor. Uma mudança de valor altera dívida atual, crédito ainda a utilizar e possivelmente receita, despesa e orçamento; não deve virar segunda aplicação. Também não é seguro tratar duas linhas iguais sem identificador estável como uma só, conforme ADR-021.

## Alternativas para valor conflitante

| Alternativa | Vantagem | Custo |
|---|---|---|
| A. Substituir automaticamente pelo valor da fonte mais recente | Atualiza o relatório rapidamente. | Fonte mais recente pode ser parcial ou de outro escopo; pode desfazer efeitos válidos e reescrever históricos sem revisão. |
| B. Manter o último efeito sustentado por fonte, marcá-lo como contestado e exigir resolução rastreável (escolhida) | Evita segunda baixa e preserva o histórico enquanto o conflito é investigado. | Totais exibidos podem estar desatualizados até a resolução; precisam de aviso claro e não podem ser apresentados como plenamente reconciliados. |
| C. Suspender automaticamente todo o efeito anterior | Evita mostrar um total possivelmente incorreto como confirmado. | A suspensão também muda dívida e relatórios sem provar que o crédito deixou de existir; pode distorcer pagamentos posteriores. |

## Decisão

Ao chegar evidência incompatível com aplicação já reconhecida, manter o **mesmo fato financeiro** e seu último valor respaldado por fonte nos cálculos enquanto se investiga. Marcar aplicação, dívida calculada e efeitos econômicos afetados como **contestados** e mostrar lado a lado o valor atual, o novo valor alegado, as fontes, as datas e a diferença. Não criar aplicação adicional, não alterar silenciosamente classificação, crédito a utilizar ou destino, e não chamar o total afetado de plenamente reconciliado. Uma divergência entre saldos sem linha de crédito aplicada continua sem efeito, conforme ADR-021.

A revisão por usuário autorizado do mesmo household pode terminar em: (1) **mesmo fato corrigido**, com prova de que a nova fonte substitui a anterior; (2) **aplicações distintas**, se houver prova de dois abatimentos separados, cada um respeitando crédito e dívida abertos; ou (3) **evidência não correspondente**, com motivo registrado. Sem prova suficiente, o conflito permanece aberto. Cada resolução registra autor, justificativa, fonte, valor e vínculo anteriores e novos. Se corrigir o valor do mesmo fato, recalcular dívida, crédito ainda a utilizar, receita, despesa e orçamento dos períodos afetados, conservando a aplicação única e revalidando limites e eventos posteriores. Se a correção for apenas de data, seguir a ADR-019; se for apenas de origem ou classificação, seguir as ADR-019/020.

Para linhas **ainda sem aplicação reconhecida**, colisão de valor, data ou possível duplicidade permanece em revisão sem criar baixa. Linha já vinculada ao mesmo fato e relida com os mesmos dados acrescenta evidência, sem segundo efeito (ADR-021). Estados como “em revisão”, “contestado” e “resolvido” são nomes conceituais; API, transições físicas e política de importação ficam pendentes.

## Distribuição entre faturas

Aplicação comprovada com destino desconhecido segue a ADR-019: a dívida total baixa pelo valor aplicado; o valor ainda sem destino fica visível. O usuário pode atribuir provisoriamente parcelas a faturas abertas do **mesmo cartão e household**, registrando a base da escolha. A soma das parcelas estimadas, das confirmadas e da parcela sem destino deve ser igual ao total aplicado; a mesma parcela não pode ocupar dois estados. Nenhuma parcela supera o valor aberto da fatura. O saldo individual calculado a partir de atribuição manual é exibido como **estimado**, separado da dívida total confirmada; não serve para recomendar pagamento.

Quando o emissor comprovar destino diferente, revisar a **mesma distribuição**: substituir a estimativa pela atribuição confirmada, manter as versões e fontes e recalcular somente os saldos individuais. A dívida total, a data da aplicação, o caixa e a classificação econômica não mudam por troca de destino. Se os documentos do emissor discordarem entre si sobre a fatura de destino, marcar a distribuição como contestada até revisão; não apresentar nenhuma das versões conflitantes como saldo individual confirmado.

## Cenários de conferência

1. Dívida de R$ 100, crédito aplicado de R$ 40, sem outros eventos: dívida calculada R$ 60. Novo documento diz R$ 30 para a **mesma linha**. Pela alternativa B, mostrar R$ 60 como cálculo atual **contestado** e R$ 70 como posição que resultaria da nova alegação; não somar nem subtrair R$ 30 automaticamente. Se a correção for comprovada, o mesmo fato passa a R$ 30, dívida a R$ 70 e, se o crédito confirmado era R$ 40, R$ 10 voltam a utilizar. O efeito econômico do crédito cai R$ 10 no mês da aplicação; eventos posteriores devem ser revalidados antes de confirmar a correção.
2. Faturas abertas de R$ 70 e R$ 100; emissor comprova aplicação global de R$ 40, sem destino. Dívida total R$ 130, com R$ 40 sem destino. Usuário atribui provisoriamente R$ 40 à antiga: saldos **estimados** R$ 30 e R$ 100. Emissor comprova destino na nova: saldos **confirmados** R$ 70 e R$ 60; a dívida total continua R$ 130 e não há segunda redução de despesa.
3. Duas linhas de R$ 20 no mesmo dia, sem identificador estável, aparecem em arquivos diferentes. Até comprovar se representam um ou dois abatimentos, nenhuma segunda baixa é criada por correspondência sugerida; manter o caso para revisão com as duas fontes.
4. Uma fatura comprova destino de R$ 20 à fatura antiga e outra fonte o atribui à nova. A dívida total e o valor aplicado seguem R$ 20; os saldos das duas faturas ficam contestados até resolver a divergência, sem recomendação de pagamento por fatura.

## Limites antes do ERD

O fluxo acima não escolhe como persistir versões, como bloquear concorrência de revisões, como emitir comandos de correção ou como deduplicar um formato específico de extrato. A interação de um crédito sem fatura de destino com pagamento parcial segue a exceção delimitada da ADR-023; `docs/domain/multi-credit-payment-cycle-example.md` demonstra dois créditos, dois pagamentos e uma correção no mesmo ciclo. Situações mais complexas ainda precisam de estudo. A origem de excedentes em aplicações agregadas, devolução do excedente à conta e crédito sem compra confiável continuam fora desta decisão.
