# ADR-007: evento Transaction e movimentos de transferência

- **Status:** aceito
- **Data:** 2026-10-05
- **Complementos aprovados:** 2026-10-08 — datas efetivas distintas, valor em trânsito, saída comprovada ainda sem chegada e apresentação patrimonial em revisão

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

Uma **transferência confirmada** vincula evento e dois movimentos em uma operação íntegra de banco de dados. Falha na confirmação do par desfaz essa confirmação inteira. O complemento sobre saída sem chegada distingue o débito comprovado ainda em revisão do evento final de transferência; sua posterior vinculação não repete o débito. O backend deve resolver a autorização e verificar que ambas as contas pertencem ao household autorizado; um `householdId` fornecido pelo cliente não prova acesso. Edição ou cancelamento não pode alterar somente um lado sem preservar a consistência e a rastreabilidade da transferência.

Esta ADR define o contrato conceitual, não nomes de tabelas, chaves, ORM ou payload da API. A forma de registrar compras no cartão, pagamentos, splits e outros eventos dentro desse modelo será detalhada antes da implementação correspondente.

### Datas efetivas distintas — complemento

Quando a saída da conta de origem e a entrada na conta de destino ocorrem em dias diferentes, **cada movimento afeta o saldo de sua conta na própria data efetiva**. Os dois permanecem vinculados ao mesmo evento de transferência, com valor e moeda opostos, e a confirmação conjunta continua atômica. Nenhum deles é receita ou despesa do household. Essa regra se aplica quando ambos os efeitos e suas datas são conhecidos; saída ainda sem par segue o complemento abaixo.

Alternativa considerada: forçar os dois movimentos a uma data única. Isso conservaria a soma das contas em todo corte diário, mas faria ao menos uma conta divergir do dia em que seu dinheiro efetivamente saiu ou chegou. Datas por conta preservam os saldos históricos individuais; a apresentação do valor entre os dias exige decisão separada.

Exemplo: A = R$ 2.000 e B = R$ 500 em 31/01. Transferência de R$ 300 sai de A em 01/02 e chega a B em 03/02. Ao fim de 01/02, A = R$ 1.700 e B = R$ 500; ao fim de 03/02, A = R$ 1.700 e B = R$ 800. Receita e despesa são zero nos dois dias. Entre as datas, a soma das duas contas é R$ 2.200; após ambos os movimentos, volta a R$ 2.500. O complemento abaixo define como mostrar os R$ 300 no intervalo; a diferença temporária não é despesa.

### Valor em trânsito entre as datas — complemento

Quando os dois lados de uma transferência interna e suas datas estão confirmados, o valor aparece como **posição temporária em trânsito** desde a saída efetiva da conta de origem até antes da chegada efetiva à conta de destino. Essa posição é separada dos saldos das contas e integra o consolidado patrimonial nesse intervalo. Na chegada, deixa de integrar o consolidado, enquanto a conta de destino passa a conter o valor. Não cria um terceiro movimento de conta, outra `Transaction`, receita ou despesa; sua representação física ainda não foi escolhida.

Para o exemplo de R$ 300, ao fim de 01/02 e 02/02: A R$ 1.700 + B R$ 500 + em trânsito R$ 300 = R$ 2.500 de ativos mostrados. Ao fim de 03/02: A R$ 1.700 + B R$ 800 + em trânsito R$ 0 = R$ 2.500. A soma das duas contas permanece R$ 2.200 nos dias intermediários, portanto “em trânsito” não deve ser apresentado como saldo disponível de A ou B. Receita e despesa continuam zero.

Alternativa considerada: mostrar só a soma das contas no intervalo. Isso faria o consolidado patrimonial parecer R$ 300 menor até a chegada, embora os dois lados confirmados identifiquem a transferência. A posição separada conserva o total sem antecipar o crédito na conta de destino. Seu custo é exigir vínculo e datas confiáveis dos dois lados; saída sem par segue o complemento abaixo.

### Saída comprovada ainda sem chegada — complemento

Quando há débito comprovado na conta de origem, mas a entrada na conta de destino ainda não foi confirmada, o saldo da origem **diminui na data efetiva do débito**. O débito permanece visível em revisão, com classificação econômica pendente: não vira despesa nem transferência confirmada apenas pela expectativa de chegada. A posição em trânsito do complemento anterior requer os dois lados confirmados e não é criada por essa saída isolada. O destino e o vínculo permanecem para revisão; a apresentação patrimonial segue o complemento abaixo.

Quando a chegada for comprovada, vincular os dois efeitos para confirmar uma transferência íntegra, reutilizando o débito já refletido na origem, sem lançar outro débito. A confirmação do par e de seu vínculo é atômica; depois dela, o histórico consolidado entre as datas pode ser recalculado com o valor em trânsito. A estrutura física e a transição exata do estado pendente ao confirmado ainda exigem desenho e testes de idempotência.

Alternativas consideradas: esperar a chegada para reduzir a origem deixaria seu saldo errado; declarar transferência confirmada ou despesa antes de conhecer o destino afirmaria uma classificação sem prova. O débito em revisão conserva o fato bancário e mantém explícita a falta de vínculo, ao custo de um consolidado econômico e patrimonial incompleto até a revisão.

Exemplo: A = R$ 2.000 e B = R$ 500. Saída comprovada de R$ 300 de A em 01/02 deixa A = R$ 1.700; B continua R$ 500. Os R$ 300 ficam em revisão, sem despesa e sem posição em trânsito confirmada. Se a entrada de R$ 300 em B em 03/02 for comprovada e vinculada, B chega a R$ 800, o mesmo débito de A continua único e o intervalo de 01/02 a 02/02 passa a mostrar R$ 300 em trânsito no consolidado. Nenhum efeito de conta ou econômico é duplicado.

### Apresentação patrimonial enquanto falta a chegada — complemento

Com apenas a saída comprovada, mostrar a **soma das posições conhecidas nas contas** e o valor do débito em revisão separadamente. O total patrimonial afetado por essa saída é identificado como **incompleto/em revisão**, sem número definitivo derivado desses dois itens. O valor pendente não é somado automaticamente como ativo em trânsito nem tratado como perda ou despesa. A revisão posterior pode mudar a apresentação histórica do consolidado quando a natureza da saída for comprovada, preservando o débito único e a trilha.

Exemplo: A R$ 1.700 + B R$ 500 = R$ 2.200 em contas conhecidas; mostrar R$ 300 de saída em revisão em separado. Não apresentar R$ 2.200 como patrimônio definitivo nem somar R$ 300 como trânsito confirmado. Se a chegada for comprovada e vinculada depois, o histórico do intervalo passa a mostrar R$ 300 em trânsito e R$ 2.500 no consolidado patrimonial explicado pelo par.

Alternativas consideradas: tomar R$ 2.200 como patrimônio final sugeriria perda antes de conhecer a natureza da saída; somar R$ 300 como trânsito afirmaria uma transferência ainda sem par. Mostrar subtotal e pendência deixa explícito o que se sabe e o que falta, ao custo de não oferecer um único patrimônio pontual enquanto a revisão estiver aberta.

## Consequências e critérios de verificação

- De A = R$ 2.000 e B = R$ 500, transferir R$ 300 resulta, após os dois efeitos, em A = R$ 1.700, B = R$ 800, total R$ 2.500, receita = R$ 0 e despesa = R$ 0. Se as datas efetivas diferirem, a soma das contas entre elas é temporariamente menor; o valor em trânsito completa o consolidado patrimonial de transferência confirmada, conforme o complemento acima.
- Injetar falha ao confirmar uma transferência de dois lados conhecidos deve deixar ambos os saldos e o evento sem alteração. Se o débito comprovado já estava em revisão, falha ao vinculá-lo à chegada mantém esse débito e seu estado de revisão, sem transferência parcialmente confirmada nem segundo débito.
- Tentativas de usar conta de outro household ou moeda diferente são rejeitadas.
- Consultas por conta mostram o movimento correspondente e podem chegar ao mesmo evento de transferência.
- O ERD e as constraints precisarão preservar a relação entre evento e movimentos; testes devem cobrir exatamente dois efeitos, valores opostos e ausência de duplicação em indicadores.

## Pendências

A ADR-025 define o tratamento conceitual de datas divergentes ou incompletas na fonte para cada movimento de conta. Ainda definir estrutura física e transição do débito em revisão, chegada anterior à saída ou correção posterior das datas, interpretação por formato, política de saldo negativo, idempotência de comandos, concorrência, reversão/correção e transferências entre households. Isolamento por RLS versus filtros de aplicação segue em ADR própria. Nenhuma dessas pendências foi aprovada por esta ADR.

## Gatilhos para revisitar

Evidência de que a separação evento/movimentos impede a conciliação com extratos reais, aumenta complexidade sem benefício para os casos do MVP ou não acomoda operações de cartão e estorno de forma explicável.

## Conceitos para estudo

Evento versus efeito em saldo, atomicidade de banco de dados, invariantes de conservação, isolamento de tenant e rastreabilidade de correções.
