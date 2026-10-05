# ADR-007: evento Transaction e movimentos de transferência

- **Status:** aceito
- **Data:** 2026-10-05

## Contexto

O Prumo precisa explicar cada mudança no saldo de uma conta sem tratar transferência interna como receita ou despesa. Uma transferência afeta duas contas; persistir somente um lado ou contar ambos nos indicadores quebra BR-001 e o saldo derivado da ADR-016.

## Drivers

- Cada conta precisa mostrar sua própria movimentação para consulta e reconciliação.
- O household precisa enxergar uma operação de transferência única, com origem e destino ligados.
- O total da transferência deve ser conservado em centavos de BRL (ADR-006) e gravado atomicamente.
- O modelo deve permitir isolamento entre households e rastreabilidade para correções futuras.

## Alternativas

### Uma Transaction com origem e destino

Guarda o par em um registro, mas cada consulta por conta e extrato precisa interpretar os dois lados do mesmo registro.

### Duas Transactions independentes ligadas por TransferLink

Cada lado se parece com uma linha do extrato, mas edição e falha parcial podem separar o par; relatórios precisam reconstruir a operação única a partir do vínculo.

### Evento Transaction com movimentos vinculados (escolhida)

Separa a identidade da operação dos efeitos de saldo em cada conta. Exige mais registros, consultas e integridade transacional. É uma modelagem inspirada em lançamentos contábeis, sem exigir contabilidade geral completa.

## Decisão

`Transaction` representa um **evento financeiro do household**. Efeitos sobre saldos de contas são **movimentos vinculados** ao evento. Uma transferência interna confirmada possui exatamente dois movimentos em contas distintas do mesmo household: saída e entrada de igual magnitude e moeda, com soma zero. O evento é classificado como transferência, portanto não entra nos totais de receita nem despesa do household.

Evento e movimentos são confirmados juntos em uma transação de banco de dados. Falha em qualquer parte desfaz a operação inteira. O backend deve resolver a autorização e verificar que ambas as contas pertencem ao household autorizado; um `householdId` fornecido pelo cliente não prova acesso. Edição ou cancelamento não pode alterar somente um lado sem preservar a consistência e a rastreabilidade da transferência.

Esta ADR define o contrato conceitual, não nomes de tabelas, chaves, ORM ou payload da API. A forma de registrar compras no cartão, pagamentos, splits e outros eventos dentro desse modelo será detalhada antes da implementação correspondente.

## Consequências e critérios de verificação

- De A = R$ 2.000 e B = R$ 500, transferir R$ 300 resulta em A = R$ 1.700, B = R$ 800, total R$ 2.500, receita = R$ 0 e despesa = R$ 0.
- Injetar falha ao gravar o movimento de destino deve deixar ambos os saldos e o evento sem alteração.
- Tentativas de usar conta de outro household ou moeda diferente são rejeitadas.
- Consultas por conta mostram o movimento correspondente e podem chegar ao mesmo evento de transferência.
- O ERD e as constraints precisarão preservar a relação entre evento e movimentos; testes devem cobrir exatamente dois efeitos, valores opostos e ausência de duplicação em indicadores.

## Pendências

Definir estrutura física, data efetiva versus data informada, política de saldo negativo, idempotência de comandos, concorrência, reversão/correção, importação de um lado ainda sem par e transferências entre households. Isolamento por RLS versus filtros de aplicação segue em ADR própria. Nenhuma destas regras foi aprovada por esta ADR.

## Gatilhos para revisitar

Evidência de que a separação evento/movimentos impede a conciliação com extratos reais, aumenta complexidade sem benefício para os casos do MVP ou não acomoda operações de cartão e estorno de forma explicável.

## Conceitos para estudo

Evento versus efeito em saldo, atomicidade de banco de dados, invariantes de conservação, isolamento de tenant e rastreabilidade de correções.
