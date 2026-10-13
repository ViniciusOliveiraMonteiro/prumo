# ADR-024: origem do saldo individual de fatura após revisão

- **Status:** aceita na Sprint 1; alternativa B aprovada
- **Data:** 2026-10-06

## Contexto

As ADR-019 e ADR-022 distinguem dívida total do cartão comprovada e saldos individuais de faturas com destino de crédito provisório ou confirmado. A ADR-008 calcula por padrão a distribuição de pagamentos da fatura mais antiga para a mais recente; a ADR-023 mantém pagamentos históricos em revisão quando um crédito sem fatura de destino torna incertos os abertos individuais. O exemplo em `docs/domain/multi-credit-payment-cycle-example.md` mostra que, após o emissor informar o destino dos créditos, a ordem padrão pode calcular uma distribuição de pagamento **sem provar** que o emissor a usou. Falta nomear corretamente o saldo individual que resulta desse cálculo.

## Alternativas

| Alternativa | Vantagem | Custo |
|---|---|---|
| A. Chamar de confirmado todo saldo derivado de uma regra aprovada | Interface com poucos estados. | Faz a regra interna parecer prova do emissor e pode induzir pagamento incorreto. |
| B. Distinguir confirmado pela fonte, calculado pela regra e estimado manualmente (aceita) | Mostra a origem de cada número e permite revisar apenas o que falta. | Exige rastrear a base de cada atribuição e explicar a diferença na interface. |
| C. Chamar de estimado qualquer saldo sem confirmação completa do emissor | Conservador e simples. | Esconde a diferença entre cálculo reproduzível da ADR-008 e escolha provisória do usuário. |

## Decisão

Apresentar o saldo individual de cada fatura com uma base explícita:

1. **Confirmado pelo emissor:** valor original da fatura e todos os abatimentos de créditos e pagamentos que afetam aquele saldo têm destino e valor confirmados por fonte do emissor, sem conflito aberto. Se houver saldo exigível explícito do emissor, comparar em data e escopo compatíveis antes de chamá-lo reconciliado.
2. **Calculado pela regra:** os valores totais dos fatos e os destinos dos créditos necessários estão confirmados, mas ao menos uma distribuição de pagamento foi atribuída pela ordem aprovada na ADR-008, sem confirmação de destino pelo emissor. Mostrar a regra e permitir correção rastreável; não chamar esse saldo de exigível confirmado pelo emissor.
3. **Estimado pelo usuário:** ao menos uma distribuição que afeta o saldo é provisória e foi informada manualmente. Mostrar base e autor da estimativa; não recomendar pagamento calculado a partir dela, conforme ADR-019/023.

Se faltar atribuição necessária, **não exibir saldo individual pontual** como se fosse conhecido: mostrar a fatura original, as parcelas sem destino e a dívida total do cartão em campos separados. Se houver evidências conflitantes, marcar o saldo afetado como **contestado** conforme ADR-022, mantendo visível a base do cálculo atual e a divergência. Esses estados são qualificadores da leitura; a escolha de tabelas ou enumerações físicas fica para o ERD.

Uma revisão da estimativa para o cálculo pela ADR-008 não a transforma em prova do emissor. Só evidência externa de destino permite a passagem para “confirmado pelo emissor”. Correção de categoria econômica do estorno não muda por si a base do saldo da fatura. A dívida total do cartão e o caixa conservam seus próprios valores e fontes; a mudança de qualificador não cria crédito, pagamento, despesa ou nova baixa.

## Exemplo e critérios de aceite

- No exemplo de duas faturas R$ 100/R$ 120, créditos A = R$ 30 e B = R$ 20 e pagamentos P1 = R$ 30 e P2 = R$ 40, caixa final R$ 430 e dívida total R$ 100 não dependem do destino entre faturas. Antes de conhecer os destinos dos créditos, os pares R$ 0/R$ 100 e R$ 30/R$ 70 são apenas cenários ou estimativas, nunca saldos individuais confirmados.
- Se o emissor provar que A e B foram à fatura nova, mas não informar o destino dos pagamentos históricos, a ADR-023 mantém P1/P2 em revisão. Após revisão rastreável que use a ordem da ADR-008, os saldos R$ 30/R$ 70 são **calculados pela regra**. A fonte dos créditos e a regra dos pagamentos devem ser consultáveis separadamente.
- Se o emissor comprovar também P1 e P2 nos destinos usados no cálculo, R$ 30/R$ 70 podem aparecer como **confirmados pelo emissor**, sujeito à comparação de posição na mesma data e escopo. Uma fonte que contradiga o valor ou destino marca o resultado afetado como contestado.
- Se a pessoa atribuir provisoriamente A e B à antiga e P1/P2 pela ordem da ADR-008 sobre essa hipótese, R$ 0/R$ 100 são **estimados pelo usuário**. Corrigir a hipótese depois não muda caixa, dívida total ou efeito econômico dos créditos.
- Quando todos os saldos individuais forem calculáveis para a mesma data e cartão, sua soma reconcilia com a dívida total. Se houver parcela sem destino que impeça esse cálculo, mostrar a dívida total separadamente e não somar estimativas como se fossem saldos confirmados. A soma não mistura datas ou cartões.

## Consequências e limites

A alternativa B evita que “calculado” seja confundido com “confirmado”. Requer guardar a origem de cada parcela que compõe uma fatura e recalcular o qualificador quando uma evidência, correção ou revisão chega. A relação entre qualificador, pagamento sugerido e telas de revisão precisa ser detalhada antes da interface. Correspondência por formato de importação, concorrência de revisões e critérios de confirmação quando o emissor fornece apenas posição agregada permanecem pendentes. Esta ADR não escolhe estrutura física nem tecnologia.
