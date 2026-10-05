# Proposta para Transaction e transferência interna

**Status:** em discussão para a ADR-007. Este texto compara estruturas possíveis; nenhuma foi aprovada. As invariantes BR-001, ADR-006 e ADR-016 já são decisões.

## Pergunta central

`Transaction` representa um evento financeiro único (por exemplo, transferir dinheiro) ou uma linha de movimentação de uma conta? A resposta define como consultar saldos, importar extratos e impedir dupla contagem.

Uma transação financeira do domínio é diferente de uma **transação de banco de dados**: esta última é o mecanismo que confirma ou desfaz várias escritas juntas.

## Alternativas

| Modelo | Como fica a transferência A → B | Vantagem | Custo e risco |
|---|---|---|---|
| Uma `Transaction` com conta de origem e destino | Um registro guarda o evento e as duas contas; saldos projetam os efeitos. | Poucas linhas e vínculo inerente. | Consultas por conta e conciliação de dois extratos precisam interpretar origem/destino; fica menos uniforme com movimentos de uma conta só. |
| Um evento `Transaction` com movimentos vinculados **(recomendado)** | Um evento classificado como transferência possui movimento −X em A e +X em B. | Cada conta tem sua linha de saldo, enquanto o evento único evita contar as duas linhas como receita/despesa; admite vínculo com importações. | Mais registros e consultas; exige persistência atômica e regras de integridade entre evento e movimentos. |
| Duas `Transaction` independentes ligadas por `TransferLink` | Cada conta tem uma transação; um vínculo identifica o par. | Próximo da linha dos extratos e das entidades candidatas do Plano Mestre. | Sem uma operação pai clara, edição, reversão e deduplicação podem deixar metade do par ou contar linhas separadamente. |

**Recomendação para a ADR-007:** `Transaction` nomeia o evento financeiro do household; cada efeito em saldo fica em um movimento vinculado ao evento. Para transferência interna, o evento contém exatamente dois movimentos de mesmo valor e moeda, com sinais opostos e contas distintas do mesmo household. Isso usa um padrão de lançamentos inspirado em contabilidade, **sem afirmar** que o Prumo terá contabilidade completa. A estrutura física e os nomes das tabelas permanecem para a etapa de modelagem do banco.

## Exemplo que a escolha deve explicar

Estado inicial: conta A R$ 2.000; conta B R$ 500. Transferência interna de R$ 300 em BRL.

| Efeito | Conta A | Conta B | Total das duas contas | Receita | Despesa |
|---|---:|---:|---:|---:|---:|
| Antes | 2.000 | 500 | 2.500 | 0 | 0 |
| Movimento de origem | −300 | 0 | — | — | — |
| Movimento de destino | 0 | +300 | — | — | — |
| Após confirmação conjunta | 1.700 | 800 | 2.500 | 0 | 0 |

As duas linhas intermediárias não são estados visíveis após confirmação. Se a gravação de qualquer uma falhar, nenhuma deve persistir. A soma dos movimentos da transferência é zero; ambos usam centavos inteiros de BRL (ADR-006). Os saldos posteriores são derivados dos marcos iniciais e movimentos (ADR-016).

## Invariantes candidatos para aprovação

1. A identidade do household do evento, dos movimentos e das contas deve coincidir; acesso a conta de outro household é rejeitado.
2. Uma transferência confirmada tem exatamente dois efeitos em saldo: débito e crédito de mesma moeda e magnitude; a soma é zero.
3. Os dois efeitos são confirmados em uma transação de banco de dados; falha em qualquer efeito desfaz o conjunto.
4. Transferência entre contas do mesmo household não entra nos totais de receita e despesa.
5. Uma transferência não pode ser editada em apenas um lado. Correção e cancelamento devem preservar o vínculo e a rastreabilidade.
6. Registros vindos de extratos não devem ser ligados automaticamente a uma transferência sem critério verificável ou revisão; duplicação e correspondência ficam para a política de importação.

## Limites desta proposta

- O efeito de compra no cartão, fatura e pagamento sobre movimentos de conta e passivo precisa ser desenhado em conjunto com a ADR-008; não criar entidades apenas para caber neste exemplo.
- Política de saldo negativo, data efetiva versus data informada, transferência entre households, reversão, idempotência e concorrência seguem pendentes.
- O isolamento do household precisa ser imposto no backend e testado; a escolha entre filtros de aplicação e RLS continua em aberto.
- Não há decisão sobre ORM, SQL, chaves ou formato da API.

## Próximo aceite

Escolher uma das três alternativas ou ajustar a recomendação. Depois, registrar a ADR-007 com o contrato conceitual, exemplos de sucesso e falha, trade-offs e perguntas ainda abertas. Só então desenhar o ERD inicial.
