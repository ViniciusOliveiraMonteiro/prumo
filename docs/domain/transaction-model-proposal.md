# Proposta para Transaction e transferência interna

**Status:** a alternativa de evento `Transaction` com movimentos vinculados foi aprovada na ADR-007. Este texto preserva a comparação e o exemplo que fundamentaram a escolha; as pendências ao final continuam abertas.

## Pergunta central

`Transaction` representa um evento financeiro único (por exemplo, transferir dinheiro) ou uma linha de movimentação de uma conta? A resposta define como consultar saldos, importar extratos e impedir dupla contagem.

Uma transação financeira do domínio é diferente de uma **transação de banco de dados**: esta última é o mecanismo que confirma ou desfaz várias escritas juntas.

## Alternativas

| Modelo | Como fica a transferência A → B | Vantagem | Custo e risco |
|---|---|---|---|
| Uma `Transaction` com conta de origem e destino | Um registro guarda o evento e as duas contas; saldos projetam os efeitos. | Poucas linhas e vínculo inerente. | Consultas por conta e conciliação de dois extratos precisam interpretar origem/destino; fica menos uniforme com movimentos de uma conta só. |
| Um evento `Transaction` com movimentos vinculados **(escolhido)** | Um evento classificado como transferência possui movimento −X em A e +X em B. | Cada conta tem sua linha de saldo, enquanto o evento único evita contar as duas linhas como receita/despesa; admite vínculo com importações. | Mais registros e consultas; exige persistência atômica e regras de integridade entre evento e movimentos. |
| Duas `Transaction` independentes ligadas por `TransferLink` | Cada conta tem uma transação; um vínculo identifica o par. | Próximo da linha dos extratos e das entidades candidatas do Plano Mestre. | Sem uma operação pai clara, edição, reversão e deduplicação podem deixar metade do par ou contar linhas separadamente. |

**Decisão ADR-007:** `Transaction` nomeia o evento financeiro do household; cada efeito em saldo fica em um movimento vinculado ao evento. Para transferência interna, o evento contém exatamente dois movimentos de mesmo valor e moeda, com sinais opostos e contas distintas do mesmo household. Isso usa um padrão de lançamentos inspirado em contabilidade, **sem afirmar** que o Prumo terá contabilidade completa. A estrutura física e os nomes das tabelas permanecem para a etapa de modelagem do banco.

## Exemplo que a escolha deve explicar

Estado inicial: conta A R$ 2.000; conta B R$ 500. Transferência interna de R$ 300 em BRL.

| Efeito | Conta A | Conta B | Total das duas contas | Receita | Despesa |
|---|---:|---:|---:|---:|---:|
| Antes | 2.000 | 500 | 2.500 | 0 | 0 |
| Movimento de origem | −300 | 0 | — | — | — |
| Movimento de destino | 0 | +300 | — | — | — |
| Após confirmação conjunta | 1.700 | 800 | 2.500 | 0 | 0 |

As duas linhas intermediárias da tabela são etapas de gravação do exemplo com efeitos na mesma data, não estados visíveis após confirmação. Se a gravação de qualquer uma falhar, nenhuma deve persistir. A soma dos movimentos da transferência é zero; ambos usam centavos inteiros de BRL (ADR-006). Os saldos posteriores são derivados dos marcos iniciais e movimentos (ADR-016). Se os efeitos tiverem datas efetivas diferentes, a ADR-007 os aplica em suas respectivas contas nesses dias; a soma das contas entre eles cai temporariamente, e um valor em trânsito separado conserva o consolidado patrimonial do par confirmado.

## Invariantes do núcleo e requisitos pendentes

1. A identidade do household do evento, dos movimentos e das contas deve coincidir; acesso a conta de outro household é rejeitado.
2. Uma transferência confirmada tem exatamente dois efeitos em saldo: débito e crédito de mesma moeda e magnitude; a soma é zero.
3. Os dois efeitos são confirmados em uma transação de banco de dados; falha em qualquer efeito desfaz o conjunto.
4. Transferência entre contas do mesmo household não entra nos totais de receita e despesa.
5. Uma transferência não pode ser editada em apenas um lado. Correção e cancelamento devem preservar o vínculo e a rastreabilidade.
6. Saída comprovada ainda sem chegada reduz a conta de origem e fica em revisão, sem despesa ou transferência confirmada. Vincular depois o par não repete o débito (ADR-007). **Pendente:** critério de correspondência de registros de extratos, transição física, revisão e deduplicação.

## Limites desta proposta

- O efeito de compra no cartão, fatura e pagamento sobre movimentos de conta e passivo precisa ser desenhado em conjunto com a ADR-008; não criar entidades apenas para caber neste exemplo.
- Política de saldo negativo, comprovação de datas informadas, transição física da saída em revisão, transferência entre households, reversão, idempotência e concorrência seguem pendentes. Com só a saída comprovada, a ADR-007 mostra subtotal de contas e débito pendente separados, com patrimônio afetado incompleto.
- O isolamento do household precisa ser imposto no backend e testado; a escolha entre filtros de aplicação e RLS continua em aberto.
- Não há decisão sobre ORM, SQL, chaves ou formato da API.

## Próximo trabalho

O esboço de receita/despesa e dos efeitos de cartão está em `event-effects-proposal.md`, com casos observáveis em `priority-use-cases.md`. A ADR-017 aprovou classificação pelo evento para receita recebida e despesa de consumo à vista e obrigação própria do cartão vinculada aos eventos. Datas econômicas, demais eventos e estrutura física seguem pendentes antes do ERD inicial. A estratégia de isolamento de households também permanece pendente.
