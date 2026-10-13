# ADR-006: representação de valores monetários no MVP

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

Contas, cartões, orçamentos e parcelas precisam conservar centavos exatamente. BR-003 proíbe ponto flutuante binário para valores monetários. A representação do domínio e as moedas aceitas estavam pendentes.

## Drivers

- Somas, diferenças e rateios precisam ser reproduzíveis e auditáveis.
- O MVP tem escopo inicial doméstico em BRL; conversão cambial não foi definida.
- A moeda deve acompanhar o valor para impedir operações acidentais entre unidades incompatíveis.

## Alternativas

### Inteiro na menor unidade da moeda

Facilita operações exatas para BRL e testes de conservação do total. Exige limite numérico explícito, cuidado com a escala de cada moeda e política separada para cálculos intermediários com frações de centavo.

### Decimal exato como representação principal

Suporta escalas diferentes e valores intermediários. Exige biblioteca decimal, regras de quantização e disciplina em todas as camadas para evitar conversão implícita em ponto flutuante binário.

## Decisão

No MVP, valores monetários finais de conta, cartão e orçamento são quantias inteiras em **centavos de BRL**, acompanhadas de `currency = BRL`. Não há conversão entre moedas no MVP; uma operação que tente misturar moedas deve ser rejeitada. Taxas e cálculos intermediários que produzam frações de centavo exigem aritmética decimal exata e quantização em um ponto documentado antes de gerar um valor monetário final.

O tipo técnico do inteiro, o limite máximo e o formato do contrato da API ainda dependem de projeto e testes. O rateio de **compras parceladas no cartão** foi definido posteriormente na ADR-008: dividir centavos inteiros de modo tão uniforme quanto possível e entregar centavos restantes às primeiras parcelas. Rateio para outros usos ainda requer regra própria. A decisão não autoriza o uso de `Number` binário para representar dinheiro nem decide o tipo SQL antes da escolha do banco.

## Consequências

- Os cenários R$ 100/3 e R$ 10/6 devem somar exatamente o total em centavos.
- A interface pode formatar BRL para leitura, mas não deve fazer cálculos monetários em ponto flutuante binário.
- Suporte a outras moedas ou câmbio exigirá nova decisão de escala, persistência, conversão e apresentação.
- O contrato entre `prumo-web/` e `prumo-api/` deve explicitar unidade e moeda quando for definido.

## Gatilhos para revisitar

Entrada de outra moeda, operações cambiais, exigência de frações subcentavo persistidas ou limite numérico insuficiente para os valores reais do produto.

## Conceitos para estudo

Unidade mínima de moeda, precisão decimal, quantização, conservação de total e limites de inteiro em JavaScript e no banco.
