# ADR-016: saldo inicial e reconciliação de contas

- **Status:** aceito
- **Data:** 2026-10-05

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

Esta ADR não define a estrutura de `Transaction`, persistência de snapshots, política de movimentos anteriores ao marco nem a semântica financeira de um ajuste aprovado. Essas escolhas exigem a ADR-007 de modelo de transações e regras de reconciliação mais detalhadas antes da implementação.

## Consequências

- Com marco de R$ 5.000, entrada de R$ 200 e saída de R$ 80, o saldo calculado é R$ 5.120; a receita do período é R$ 200.
- Um saldo externo de R$ 5.110 produz divergência de R$ 10, não uma transação automática de R$ 10.
- Importação e edição retroativa precisam preservar a possibilidade de recalcular e explicar o saldo.

## Gatilhos para revisitar

Contas cujo saldo não pode ser explicado por movimentos discretos, limites de desempenho da derivação ou necessidade comprovada de estratégia distinta para investimentos.

## Conceitos para estudo

Marco de abertura, saldo derivado, reconciliação, ajuste auditável e projeção de leitura.
