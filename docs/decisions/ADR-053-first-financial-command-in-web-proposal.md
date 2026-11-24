# ADR-053: primeiro comando financeiro na web

- **Status:** aceita para o primeiro comando web local em 2026-11-24; implementação validada, revista e aprovada na CI
- **Data:** 2026-11-24
- **Aprovação:** o usuário aprovou abertura de conta, retry idempotente enquanto o formulário está aberto e ausência de rascunho persistido no navegador em 2026-11-24
- **Escopo:** primeiro comando financeiro da Sprint 5 na web privada, usando contrato já implementado na API; sem nova regra de saldo ou persistência

## Contexto

A página `/financas` já lê households, contas e saldo por data com sessão da API, mas não permite comandos. A [ADR-046](ADR-046-first-financial-account-proposal.md#contrato-e-fronteira-propostos) aceita criação de conta com marco inicial, `Idempotency-Key` UUID, BRL em centavos inteiros e autorização `finance:write` para `OWNER` e `MEMBER`; a API e o OpenAPI já implementam esse contrato. A [ADR-032](ADR-032-web-api-contract.md#decisão) exige preservar a chave em retries da mesma intenção, e a [ADR-035](ADR-035-code-organization.md#decisão) separa apresentação, hook e adapter HTTP. A web não deve decidir saldo nem confiar no seletor como autorização.

Falta escolher o primeiro comando da interface e delimitar o comportamento quando a resposta de criação se perde. O fuso de produto ainda não foi decidido; a data do marco continuará explícita.

## Alternativas

| Primeiro comando | Ganho | Custo ou risco |
|---|---|---|
| Abrir conta com marco inicial | Usa um contrato aceito, permite começar um household sem contas e prepara os movimentos seguintes | Exige entrada cuidadosa de centavos e retry sem duplicação |
| Registrar receita recebida | Demonstra logo um movimento e seu efeito no saldo | Depende de uma conta preexistente; não atende o estado vazio da web |
| Registrar despesa ou transferência | Avança o fluxo econômico completo | Exige categoria ou duas contas e amplia a primeira interação de escrita |

## Escolha proposta

Adicionar em `/financas` um formulário de **abertura de conta** apenas quando o household selecionado tem papel `OWNER` ou `MEMBER`. O formulário pede nome, dia civil do marco e saldo inicial em BRL, inclusive zero ou valor negativo. A data não recebe valor automático dependente de fuso. A web converte a entrada monetária decimal para uma string inteira de centavos sem `Number` nem arredondamento e confirma ao usuário que o marco **não é receita**. A API continua validando nome, data, limite, membership e todos os recursos.

O componente cliente usa um hook próprio e uma porta de criação com adapter `fetch` para `POST /api/households/{householdId}/accounts` na mesma origem. Envia `currency: "BRL"`, `openingDate`, `openingBalanceCents` e `Idempotency-Key` UUID. O hook conserva a mesma chave enquanto o payload normalizado e o household forem iguais, inclusive após falha de rede ou resposta ambígua com o formulário montado. Depois de uma resposta ambígua, o formulário mantém a intenção para retry idêntico; mudar campos ou household exige descartar essa intenção explicitamente e conferir a lista antes de iniciar outra. Antes de enviar o POST, a web grava em `sessionStorage` apenas um **marcador de tentativa pendente por household**, sem nome, saldo, data ou chave. Se o armazenamento falhar, não envia o POST. Após resposta definitiva, limpa o marcador; se o formulário for desmontado enquanto a resposta está pendente ou incerta, a volta àquele household bloqueia nova criação até a pessoa conferir a lista. Após `201`, a web atualiza a leitura de `/financas` e limpa a intenção. Não há retry automático entre recargas nem recuperação da chave após fechar a aba; antes de recriar, a pessoa deve conferir a lista.

`401` leva ao login sem mostrar dados da intenção em URL; `403` informa falta de permissão; `404` informa que o household não está disponível; `409` informa conflito da chave e pede conferir a lista antes de nova tentativa; `400` pede correção dos campos; `5xx` ou falha de rede mantém os campos e a chave para retry. Mensagens não incluem detalhes internos ou dados de outro household. O papel recebido na lista controla somente a apresentação do formulário; a API revalida autorização em cada POST. Respostas financeiras continuam `private, no-store`.

## Gate de implementação

1. Testar conversão exata de `R$ 1.234,56`, zero, negativo, vírgula inválida, excesso de casas e limite da ADR-046 sem usar ponto flutuante.
2. Testar no hook que um retry da mesma intenção reutiliza a chave e que edição de campo ou troca de household gera nova chave; falha ambígua mantém os dados até confirmação.
3. No caminho navegador → `/api` → API → PostgreSQL, criar conta em A, confirmar uma única conta após retry com resposta perdida, atualizar a lista e verificar que `VIEWER`, sessão revogada e household B não criam nem revelam conta de A. Testar `400/401/403/404/409` relevantes e `no-store`.
4. Rodar lint, tipos, formatação, teste web direcionado, E2E integrado e `contract:check`; revisar independentemente autorização, idempotência e limites do navegador. Atualizar guia da aplicação, README web e quadro da sprint na mesma mudança.

## Pendências e conceitos para estudo

A escolha do primeiro comando e o fluxo de retry da web foram aprovados no limite acima. O contrato da API e a regra do marco da ADR-046 permanecem aceitos. Depois deste recorte, escolher receita/despesa/transferência para a interface e decidir, em trabalho próprio, edição do marco, recuperação segura da chave entre recargas ou abas, fuso de produto, RLS real e proxy/cache de staging. Conceitos: idempotência de comando, resposta ambígua, fronteira de autorização, data civil, conversão decimal exata e separação entre marco patrimonial e receita.

## Implementação local em 2026-11-24

`/financas` apresenta o formulário somente para `OWNER` e `MEMBER`; a API revalida papel e household no POST. A entrada em reais é convertida sem ponto flutuante para string de centavos. O adapter usa o caminho público `/api`; o hook mantém a chave para retry enquanto o formulário está montado, bloqueia edição depois de resposta ambígua e exige reconciliação antes de outra intenção após navegação. O marcador de `sessionStorage` não contém dados financeiros. O código de criação da API e o contrato OpenAPI não mudaram.

**Validação local:** testes de conversão e data, lint, tipos e build da web passaram; `contract:check`, tipos e lint da API passaram. O E2E HTTPS com Chromium, NestJS, Next.js de produção e PostgreSQL local passou (1/1): confirma uma conta após `201` substituído por `503` e retry com a mesma chave, protege uma tentativa cujo POST ficou pendente durante a troca real de household, recusa envio quando a escrita ou leitura do storage falha, verifica `400/404/409` na interface, sessão revogada, `VIEWER` e `no-store`. A revisão independente encontrou perda da intenção ao navegar, marcador tardio e leitura de storage que não falhava fechada; as correções foram testadas e a releitura final não encontrou defeito material restante. O [run 32 da CI](https://github.com/ViniciusOliveiraMonteiro/prumo/actions/runs/45478718914) aprovou o commit `205d4f1`, incluindo o E2E Chromium, testes web, banco, contrato, lint, tipos e build. O proxy/cache de staging continua fora deste laboratório.
