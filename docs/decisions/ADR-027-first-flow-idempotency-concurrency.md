# ADR-027: idempotência e concorrência do primeiro fluxo financeiro

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto e escopo

O primeiro fluxo da Sprint 5 abre contas com marco, registra receita recebida, despesa paga diretamente e transferência, consulta saldos e admite as correções delimitadas nas ADRs 016 e 026. Uma resposta perdida, clique duplo ou retry pode repetir o mesmo pedido; duas revisões podem partir da mesma versão; transferências e correções podem atingir as mesmas contas ao mesmo tempo. As ADRs 007/017 exigem efeitos íntegros e o threat model registra duplicação e perda de atualização em TM-03/04/05. A ADR-028 define saldo negativo de conta para esse fluxo; a baseline de isolamento segue a ADR-029 e RLS permanece para laboratório.

Esta decisão define resultados observáveis e garantias necessárias, sem escolher banco, ORM, lock, nível de isolamento, endpoint, duração de timeout ou representação física. Importação por formato e comandos de cartão exigirão contratos próprios quando entrarem nas Sprints 6–7; não herdam automaticamente uma chave de linha externa desta ADR.

## Alternativas

1. **Deduplicar por conta, valor, data e descrição.** Evita alguns cliques duplos, mas pode descartar dois fatos legítimos iguais e não identifica uma revisão específica.
2. **Guardar chave apenas na memória do processo.** Simples, mas perde o registro após reinício e não coordena instâncias paralelas.
3. **Identidade persistente do pedido e controle da versão revisada** (escolhida). Repetições do mesmo pedido retornam o mesmo resultado; duas alterações da mesma base não se sobrepõem silenciosamente. Exige escrita atômica, restrição persistente e tratamento explícito de conflito.

## Decisão

**Identidade do comando.** Cada comando financeiro mutável do primeiro fluxo recebe uma identidade de pedido estável durante retries, distinta da identidade do evento financeiro. O servidor registra, de modo durável, household, tipo de operação, chave, autor, dados relevantes normalizados e resultado ou referência ao fato produzido. A mesma chave com o mesmo comando, no mesmo escopo, pode chegar simultaneamente ou após perda da resposta: no máximo **um** conjunto de efeitos é confirmado e a repetição recupera o mesmo resultado, sem novo evento, movimento ou revisão. A chave não é formada por valor/data/descrição; dois fatos legítimos iguais podem usar chaves diferentes.

Reusar a mesma chave para dados relevantes diferentes, outro alvo ou outro autor é conflito **sem efeito financeiro**. Uma chave de outro household não alcança nem revela o resultado deste; autorização da pessoa e de cada recurso é revalidada antes de executar ou devolver informação. A proteção persiste pelo menos enquanto o fato financeiro correspondente for mantido; janela, limpeza e representação exatas serão definidas com a política de retenção e o contrato da API. Um pedido ainda em execução pode informar que o resultado está pendente e permitir nova consulta/retry com a mesma chave; jamais afirmar falha definitiva se a confirmação ainda for incerta.

**Integridade da confirmação.** Identidade do pedido, evento, movimentos, versão/revisão e efeitos derivados necessários são confirmados ou revertidos como unidade. Se falhar antes da confirmação, não há efeito parcial e o retry pode tentar novamente. Se a confirmação ocorrer e a resposta se perder, o retry recupera o resultado já confirmado. Isto inclui os dois lados de transferência e a vinculação de chegada a débito já em revisão, sem repetir a saída da ADR-007. Uma consulta não apresenta transferência confirmada ou revisão com apenas parte dos seus efeitos.

**Revisões concorrentes.** Toda revisão da ADR-026 e correção do marco da ADR-016 declara a versão vigente que a pessoa examinou. Somente uma revisão pode ser aceita a partir dessa versão. A outra recebe conflito com indicação de que deve recarregar o estado autorizado e revisar sua intenção; não é mesclada automaticamente nem aplicada à versão nova. Retry da revisão vencedora com a mesma identidade de pedido recupera o resultado original identificado como resultado daquela revisão, mesmo após outras revisões; não o apresenta como estado vigente se já mudou. Permissões atuais continuam exigidas. Motivo, autor, versão anterior e nova continuam na trilha da ADR-026.

**Comandos distintos concorrentes.** Pedidos com chaves diferentes representam intenções distintas. Se ambos forem válidos, cada um deve ser aplicado uma vez em alguma ordem consistente, sem perda de movimento ou agregado. Validações que dependem de estado mutável — por exemplo, marco, vínculo de transferência ou limite de reembolso — são refeitas contra um estado coerente no ponto de confirmação; se uma delas falhar após o outro pedido vencer, o comando perde sem efeito parcial e informa conflito ou violação de regra. A ADR-028 permite saldo negativo de conta sem bloquear um comando válido apenas por esse resultado; o recálculo e o alerta devem refletir todos os efeitos confirmados. Lock, versão, constraint e isolamento transacional são alternativas técnicas a comparar na Sprint 5.

## Exemplos e critérios de verificação

- Dez envios concorrentes da mesma transferência A → B de R$ 300 com a **mesma chave** produzem um evento, um débito de R$ 300 e um crédito de R$ 300. Após timeout ou reinício, novo envio com essa chave recupera o mesmo evento; A e B não mudam novamente.
- Duas transferências legítimas de R$ 300 entre as mesmas contas e na mesma data, mas com **chaves diferentes**, são dois eventos se ambas cumprirem as regras. Igualdade de conteúdo não autoriza deduplicá-las.
- Uma chave já usada para R$ 300 não pode confirmar R$ 350, outra conta ou outra versão de base: retorna conflito e preserva o resultado original. Uma pessoa sem acesso atual não obtém o resultado pela chave.
- Duas correções concorrentes da mesma despesa na versão 1, uma para R$ 70 e outra para R$ 60: apenas uma produz versão 2. A outra recebe conflito e não cria versão 3 por retry automático. Se a pessoa a reapresentar depois de examinar a versão 2, será uma nova intenção e terá nova identidade de pedido.
- Falha após registrar o débito de transferência mas antes do crédito reverte a confirmação do par. Se já existia débito comprovado em revisão, falha ao vincular a chegada mantém exatamente aquele débito em revisão, sem outro débito e sem transferência parcialmente confirmada.

## Consequências e pendências

A identidade do pedido protege transporte e retries; a correspondência de uma linha importada com um fato já registrado é problema distinto da Sprint 7. O controle de versão protege a intenção humana nas revisões, enquanto a confirmação atômica e validação em estado coerente protegem efeitos simultâneos. Esta decisão não aprova tabela, algoritmo de lock, código HTTP, formato de chave nem tecnologia específica; as [ADRs 046](ADR-046-first-financial-account-proposal.md#implementação-local-em-2026-11-03) e [047](ADR-047-first-manual-income-and-balance-proposal.md#implementação-local-em-2026-11-03) definem essas escolhas para os dois primeiros comandos locais e os testam no PostgreSQL. A ADR-028 define o saldo negativo no primeiro fluxo e a ADR-029 define a baseline de isolamento. Permanecem pendentes: duração e exclusão da chave na política de retenção, revisão por versão esperada, contratos e testes dos demais comandos, regras próprias para cartão/importação e decisão de RLS após testar policies nas tabelas reais.

## Conceitos para estudo

Idempotência de pedido versus deduplicação de fatos, confirmação atômica, versão esperada, perda de atualização, isolamento transacional, retry após resposta perdida e autorização no replay.
