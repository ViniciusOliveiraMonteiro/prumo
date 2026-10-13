# ADR-021: prova de aplicação e correspondência de crédito no cartão

- **Status:** aceito para prova de aplicação do crédito no cartão na Sprint 1
- **Data:** 2026-10-06

## Contexto

As ADR-018 e ADR-019 só permitem reduzir dívida, despesa e orçamento quando o emissor **aplica** o crédito. Confirmação de crédito para uso futuro, lançamento sem compensação e diferença isolada entre saldos não bastam. A ADR-019 já decide que a compensação efetiva fornece a data do efeito; quando a fatura comprova aplicação no ciclo sem dia individual, seu fechamento fornece uma data **estimada** e corrigível. Esta ADR define quais documentos bastam para comprovar a aplicação e como tratar leituras repetidas do mesmo efeito; detalhes físicos e conflitos específicos seguem pendentes.

Uma confirmação, uma linha de crédito no histórico, uma fatura e uma linha de pagamento podem descrever fatos diferentes ou repetir o mesmo fato. Tratar todas como aplicações duplicaria a baixa. Por outro lado, exigir sempre um identificador externo de aplicação poderia impedir registro de faturas que mostram claramente o abatimento sem fornecer esse identificador.

## Alternativas para reconhecer a aplicação

| Alternativa | Vantagem | Custo |
|---|---|---|
| A. Exigir linha explícita de compensação com identificador externo | Evidência forte e correspondência simples. | Muitos documentos mostram apenas o crédito abatido na fatura fechada; o crédito continuaria pendente apesar do valor exigível comprovado. |
| B. Aceitar compensação explícita ou fatura fechada com abatimento demonstrável (escolhida) | Usa a prova disponível sem confundir confirmação futura com aplicação. | Exige conferir componentes da fatura e sinalizar a data inferida; alguns documentos ainda ficarão em revisão. |
| C. Inferir aplicação de qualquer queda do saldo do cartão | Pode preencher lacunas automaticamente. | Pagamentos, correções, juros e escopos de corte distintos também mudam o saldo; pode criar baixa e despesa incorretas. |

## Decisão

Reconhecer **uma aplicação** somente quando uma fonte do emissor identificar o cartão e o valor efetivamente abatido da obrigação, por um destes caminhos:

1. **Compensação explícita:** lançamento do emissor identificado como crédito efetivamente compensado/aplicado, com valor e data efetiva. O efeito usa essa data, mesmo que a confirmação ou o lançamento inicial tenham outra data (ADR-019).
2. **Fatura fechada demonstrável:** documento final do emissor que inclua uma linha de crédito abatido, seu valor, o cartão/ciclo e um total exigível cuja composição inclua esse abatimento. A conferência considera compras, encargos, pagamentos e outros créditos que constem no mesmo documento; a linha e o total não são duas aplicações. Se o dia individual faltar, usar o fechamento como **data estimada**, conforme ADR-019. A fatura identificada fornece destino somente para o abatimento que ela própria discrimina; um total global do cartão sem fatura de destino segue o estado desconhecido da ADR-019.

Uma confirmação para ciclo futuro, um lançamento com estado pendente, uma linha sem prova de que entrou no valor exigível, a mera diferença entre saldos ou um relato sem fonte do emissor ficam **para revisão**, sem baixa de dívida ou reconhecimento econômico. A classificação manual permitida pela ADR-020 explica excedente **já aplicado**; não comprova a aplicação. Se a fonte prova o total aplicado, mas omite origem entre créditos, aplicar a inferência corrigível da ADR-019 apenas à parte elegível; a parte excedente com origem indeterminada permanece em reconciliação.

Mesmo com prova suficiente, a aplicação respeita o crédito ainda a utilizar e a dívida total aberta; se o destino for conhecido, respeita também a obrigação aberta de destino. Valor externo que exceda esses limites fica em revisão conforme as ADR-018/019, sem saldo credor ou efeito parcial silencioso.

Se uma fatura posterior trouxer data efetiva ou valor corrigido, atualizar o **mesmo fato de aplicação** com fonte e trilha, recalculando os períodos conforme ADR-019. Alteração de valor não deve ser tratada como nova aplicação por padrão: verificar se a fonte está corrigindo a linha anterior ou comprovando um segundo abatimento. A política física de correções permanece pendente.

## Correspondência rastreável

Separar conceitualmente a **evidência externa** do **fato financeiro** que ela comprova. Guardar referência à origem, tipo de documento, cartão, intervalo/ciclo, valor, datas informadas, situação de confirmação ou aplicação e vínculo com a linha original. Uma confirmação e a aplicação posterior podem referir-se ao mesmo crédito, mas somente a aplicação produz baixa; uma única linha que comprove confirmação e aplicação pode sustentar ambos os fatos, sem duplicá-los. Duas evidências da mesma aplicação apontam para **um** fato. A forma física, os campos obrigatórios por formato e o tempo de retenção da fonte ficam para a modelagem e a política de dados.

Se o emissor fornecer identificador estável para a mesma aplicação no mesmo cartão, usá-lo como evidência forte de correspondência, conferindo valor e estado. Se o identificador faltar, comparar cartão, valor, datas/ciclo, referência de fatura e contexto da linha para **sugerir** correspondência; igualdade desses campos não prova identidade, pois dois créditos legítimos podem ter mesmo valor e data. Deixar colisão ou conflito em revisão, sem fusão automática nem segunda baixa. Reimportação da mesma fatura ou linha já vinculada reaproveita o fato existente. Uma linha agregada que reúne vários créditos comprova no máximo o **total aplicado**; não cria uma aplicação por crédito de origem nem inventa a origem da parte excedente.

Nenhuma evidência de cartão pode vincular conta, compra, crédito ou fatura de outro household. Autorizações são verificadas no backend; a fonte importada é dado não confiável até validação. Um identificador do emissor é contexto de correspondência, não substitui o identificador próprio nem resolve sozinho correções conflitantes.

## Exemplos e critérios de aceite

1. Em fevereiro, emissor confirma R$ 40 para março; extrato mostra lançamento pendente. Fevereiro mantém dívida e despesa inalteradas e R$ 40 a utilizar. Em março, linha explícita mostra compensação efetiva de R$ 40 em 08/03: um abatimento de R$ 40 ocorre nessa data, com origem e classificação conforme ADR-019.
2. Fatura fechada em 05/03 mostra compras e encargos de R$ 100, uma linha de crédito abatido de R$ 40 e total exigível de R$ 60, sem dia do crédito. Reconhecer **uma** aplicação de R$ 40, com 05/03 como data estimada e fonte identificada. Importar a fatura novamente ou receber depois a mesma linha em extrato não gera segunda baixa. Prova posterior de compensação em 28/02 corrige a data do mesmo efeito.
3. Fatura mostra somente saldo anterior R$ 100 e saldo atual R$ 60, sem discriminar pagamentos ou crédito aplicado. R$ 40 de diferença ficam em revisão; não reduzir automaticamente dívida ou despesa por crédito. Crédito confirmado a utilizar continua separado, sem afirmar que ele causou a diferença.
4. Duas linhas legítimas de R$ 20 no mesmo dia e cartão, sem identificadores externos, não são fundidas pelo valor e data iguais. Se a fatura confirmar abatimento agregado de R$ 40, há um total aplicado de R$ 40; a origem entre créditos segue a ADR-019 para partes elegíveis e fica em revisão para excedentes.
5. Documento novo altera uma linha antes atribuída a R$ 40 para R$ 30. Sinalizar conflito/correção da **mesma** aplicação para revisão com as duas fontes; não registrar R$ 30 adicionais nem apagar a trilha. O tratamento da posição histórica e do crédito restante depende da confirmação da correção.

## Consequências e limites

A alternativa B permite usar uma fatura final como prova sem exigir um campo de compensação que o emissor pode omitir. Ela requer conferência da composição do valor exigível e pode deixar linhas ambíguas pendentes. O reconhecimento da aplicação permanece distinto da classificação econômica e da distribuição entre faturas, como demonstra `docs/domain/card-credit-reconciliation-proposal.md`.

Esta decisão não escolhe parser, chave de banco, janela de deduplicação, armazenamento do arquivo, contrato de API nem política de retenção. O limiar de prova financeira está definido acima; ainda é necessário detalhar o fluxo de revisão de conflitos, a correspondência por formato de importação e os estados de estimativa versus confirmação antes do ERD e da implementação.
