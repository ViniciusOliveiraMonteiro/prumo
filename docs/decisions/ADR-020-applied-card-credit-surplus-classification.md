# ADR-020: classificação econômica do excedente de crédito aplicado no cartão

- **Status:** aceito para o excedente já aplicado no cartão na Sprint 1
- **Data:** 2026-10-06

## Contexto

As ADR-018 e ADR-019 conservam o valor integral do crédito que o emissor comprovou ter aplicado ao cartão. Somente a parte ainda estornável da compra vinculada reduz sua despesa. O excedente aplicado baixa a dívida, mas permanece sem classificação econômica até revisão manual autorizada, justificada e auditável. O efeito de uma classificação posterior pertence ao mês da aplicação do crédito. Esta ADR decide as naturezas econômicas permitidas; a reconciliação conceitual está em `docs/domain/card-credit-reconciliation-proposal.md`, e a prova operacional da aplicação segue a ADR-021 aceita.

A ADR-017 cobre receita comum recebida em conta. Esta ADR acrescenta o caso de receita reconhecida por baixa comprovada de dívida, sem entrada na conta.

## Alternativas

| Alternativa | Benefício | Custo |
|---|---|---|
| A. Permitir somente receita para todo excedente aplicado | Lista curta de escolhas. | Pode inflar receita quando o crédito corrige outra despesa comprovada. |
| B. Permitir receita e redução de outra despesa comprovada, mantendo o restante pendente (escolhida) | Explica a natureza do benefício e preserva a despesa original corrigida. | Exige vínculo e limite para a outra despesa; relatórios precisam distinguir receita sem entrada de conta. |
| C. Manter todo excedente aplicado permanentemente sem classificação | Não presume natureza econômica. | Deixa relatórios incompletos mesmo após revisão documentada. |

## Decisão

Permitir ao usuário autorizado classificar cada parte positiva do **excedente já aplicado** em um dos seguintes tipos, com justificativa e indicação de que a classificação foi manual:

1. **Receita por crédito aplicado à dívida:** benefício recebido mediante baixa comprovada de obrigação do cartão, sem entrada de dinheiro em conta. Aumenta a receita do mês da aplicação; não libera orçamento de despesa. Uma categoria de receita, se exigida no produto, deve ser escolhida pelo usuário, sem categoria automática baseada no lojista.
2. **Redução de outra despesa documentada:** vincular a parte a um evento de despesa do mesmo household e reduzir a despesa e o consumo do orçamento da categoria desse evento no mês da aplicação. A nova redução não pode ultrapassar o saldo ainda redutível do evento, calculado após reduções e reembolsos anteriores. Corrigir posteriormente sua categoria reclassifica o efeito no mês da aplicação, conforme a lógica das ADR-017 a ADR-019.

Uma parte sem natureza suficiente continua **sem classificação econômica**, inclusive depois de revisão parcial. Corrigir o vínculo com outra compra elegível pode transformar parte antes excedente em estorno dessa compra, desde que respeite seu limite; é correção do vínculo e da classificação do mesmo crédito, não novo crédito. Transferência entre contas próprias, pagamento de fatura, saldo credor e aumento do estorno da compra original além do seu limite não são tipos econômicos para essa ação. A devolução à conta de uma parte excedente ainda exige regra própria.

Para cada fonte confirmada, conservar `total confirmado = total aplicado ao cartão + total devolvido à conta + total ainda a utilizar`; a natureza econômica de uma eventual devolução do excedente continua pendente. Para cada aplicação, conservar `total aplicado = estorno da compra original + redução de outras despesas + receita por baixa de dívida + parte aplicada sem classificação`. Somente o **total aplicado** reduz a obrigação do cartão; a classificação distribui seu significado econômico e não cria movimento de conta. Cada parte classificada aponta para a aplicação, a fonte e, quando houver redução de despesa, o evento de despesa afetado. O total atribuído a faturas, confirmado ou estimado, reconcilia separadamente o mesmo total aplicado e não deve ser somado a ele como outra baixa.

Uma revisão conserva o identificador e o valor da aplicação. Registra valor anterior e novo de cada parte, justificativa, autor e data da revisão; recalcula receita, despesa e orçamento do mês da aplicação e preserva a trilha. Se a data efetiva de aplicação for corrigida, os mesmos efeitos mudam de período conforme ADR-019. Diferença sem fonte suficiente fica pendente, sem ajuste automático de dívida, conta ou receita. A estrutura física, o contrato da API e o mecanismo de idempotência seguem para o ERD e a fase de implementação.

## Exemplo de reconciliação

Compra original de R$ 80 já paga; crédito confirmado de R$ 100, sendo R$ 80 elegíveis como estorno e R$ 20 excedentes. O emissor aplica R$ 50 a uma dívida aberta em março sem discriminar partes. Pela inferência da ADR-019: aplicação de R$ 50 = estorno R$ 50 + excedente aplicado R$ 0; a dívida cai R$ 50, a despesa de março cai R$ 50 e restam R$ 30 elegíveis e R$ 20 excedentes a utilizar.

O emissor depois comprova que aplicou R$ 30 elegíveis e R$ 20 excedentes. A **mesma** aplicação de R$ 50 passa a ser estorno R$ 30 + excedente aplicado R$ 20; restam R$ 50 elegíveis e nenhum excedente a utilizar. A dívida continua R$ 50 menor. Até a classificação manual, março mostra despesa −R$ 30 e R$ 20 aplicados sem classificação. Se o usuário classificar R$ 12 como redução de outra despesa documentada e R$ 8 como receita por baixa de dívida, março passa a mostrar despesa −R$ 42 e receita +R$ 8; a dívida continua R$ 50 menor e a conta não muda. A revisão feita em abril aparece na trilha, sem efeito econômico novo em abril. As partes da aplicação somam R$ 30 + R$ 12 + R$ 8 = R$ 50; os R$ 50 elegíveis restantes continuam a utilizar.

## Critérios de aceite

- Classificar parcialmente o excedente preserva o total da fonte, o total aplicado, o saldo atual da dívida e a ausência de movimento de conta.
- Uma redução de outra despesa exige vínculo do mesmo household e saldo redutível suficiente; não ultrapassa o limite acumulado do evento vinculado.
- Receita por baixa de dívida aparece no mês da aplicação e é identificada como classificação manual sem entrada em conta; revisão posterior substitui o mesmo efeito.
- Reimportar a aplicação ou repetir a revisão não duplica baixa, receita ou redução de despesa.
- Os quatro destinos econômicos da aplicação somam exatamente o valor aplicado. A distribuição entre faturas é uma dimensão distinta e também soma o valor aplicado, sem multiplicá-lo.

## Pendências e conceitos para estudo

A devolução do excedente à conta, a classificação de crédito do emissor sem relação confiável com compra, categorias de receita, apresentação de receita sem caixa na interface e o contrato físico de reconciliação precisam de decisões ou detalhamento posterior. Estudar diferença entre benefício econômico, entrada de caixa, baixa de passivo e correção de despesa; a mesma linha de crédito pode afetar uma posição patrimonial uma vez e distribuir seu resultado entre categorias distintas.
