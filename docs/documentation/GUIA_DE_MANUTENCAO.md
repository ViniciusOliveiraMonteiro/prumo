# Manutenção da documentação

Este guia define como manter a documentação do Prumo junto com o código e as decisões. Aplica-se a mudanças feitas por pessoas e agentes. O [índice de `docs/`](../README.md) mostra a organização atual; o [quadro de desenvolvimento](../planning/PLANO_DE_DESENVOLVIMENTO.md) registra o andamento.

## Fonte de cada informação

| Informação | Fonte principal | Atualização de apoio |
|---|---|---|
| Propósito, escopo e regras de produto | [Plano Mestre](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md) | Resumo e links no [Guia da aplicação](../application/GUIA_DA_APLICACAO.md) |
| Decisão técnica ou regra financeira delimitada | ADR aceita em [`decisions/`](../decisions/) | Plano Mestre, exemplos de domínio e guia, quando afetados |
| Comportamento implementado | Código, testes e contrato gerado | README da aplicação, guia e roteiro operacional |
| Status, aceite e próxima ação | [Plano de desenvolvimento](../planning/PLANO_DE_DESENVOLVIMENTO.md) | Link para a evidência ou pendência no documento específico |
| Procedimento de execução e diagnóstico | [`operations/`](../operations/) e READMEs | Índice e guia da aplicação |
| Conceitos e exercícios | Plano de Estudos e Caderno | Links nos documentos de decisão pertinentes |

Uma regra normativa deve ter uma fonte principal identificável. Resumos podem facilitar a leitura, mas devem apontar para a fonte e não criar uma segunda versão da regra. Uma ADR em estado `proposta`, uma `HIPÓTESE` ou um item `NÃO DEFINIDO` não deve aparecer como decisão aprovada ou funcionalidade pronta.

## O que atualizar em cada mudança

1. **Nova capacidade ou alteração de comportamento:** atualize o README da aplicação afetada e o [Guia da aplicação](../application/GUIA_DA_APLICACAO.md) quando sua descrição, requisitos ou comandos mudarem. Atualize o contrato OpenAPI quando o HTTP mudar e valide web e API. Registre status, aceite e próxima ação no [quadro](../planning/PLANO_DE_DESENVOLVIMENTO.md).
2. **Regra financeira ou de produto:** consulte a decisão existente; se faltar, registre a pendência e proponha uma ADR antes de implementar. Atualize a ADR aceita, os exemplos de [`domain/`](../domain/) e a seção pertinente do Plano Mestre. Ajuste apenas o resumo e os links do guia da aplicação.
3. **Decisão de arquitetura, segurança ou operação:** registre contexto, alternativas, decisão ou proposta, motivo, trade-offs, testes exigidos e pendências na ADR. Atualize o [threat model](../security/threat-model.md) ou o roteiro operacional quando o risco ou o procedimento mudar. A aprovação da decisão deve ficar explícita.
4. **Mudança apenas documental:** corrija as referências que apontavam para o título ou caminho anterior. Se mudar a estrutura de `docs/`, atualize seu índice, os READMEs, `AGENTS.md` e as referências do Plano Mestre.

Faça as atualizações na **mesma mudança** que conclui a etapa ou toma a decisão. Registre trabalho pendente no lugar correspondente e deixe a próxima ação verificável. Não marque uma sprint concluída por calendário nem por um laboratório que cobre apenas parte do fluxo.

## Organização e escrita

- Use as pastas existentes por assunto: `application/`, `planning/`, `operations/`, `decisions/`, `domain/`, `security/`, `collaboration/` e `documentation/`. Crie outra pasta somente quando houver um tipo de conteúdo com responsabilidade distinta; atualize o [índice](../README.md).
- Dê ao arquivo um nome estável e descritivo. Preserve os nomes e números de ADR; não renumere decisões publicadas. Para uma nova ADR, indique status e data no início. Não mude o status para aceito sem uma aprovação registrada.
- Comece com um título `#`, use `##` para seções principais e `###` para detalhes. Escreva primeiro o resultado ou a regra, depois motivo, exemplos, limites e referências. Use termos do [glossário](../domain/glossary.md) e exemplos com valores e datas quando a regra financeira depender deles.
- Separe **decidido**, **implementado**, **testado** e **pendente**. Diga onde e quando uma validação ocorreu; um teste local não comprova CI, staging ou produção. Evite expressões como “funciona” sem indicar o fluxo observado.
- Use links Markdown relativos para arquivos do repositório. Quando citar uma regra, gate ou exemplo específico, aponte para a **seção** com `#âncora`; use links para o documento inteiro apenas quando a referência for geral. Ao renomear títulos, confira os links que usam suas âncoras.
- Mantenha comandos copiáveis, a partir de um diretório declarado, com pré-requisitos e variáveis de ambiente descritos sem valores sensíveis. Não registre credenciais, tokens, dados reais de usuários ou saídas que os exponham.
- Mantenha Markdown como fonte editável. Não altere PDFs sem pedido explícito.

## Revisão antes de concluir

- Confira se a fonte principal e os resumos concordam, se o estado de implementação é fiel ao código e se propostas continuam identificadas como propostas.
- Verifique todos os arquivos e âncoras locais adicionados ou alterados; confira também referências ao caminho antigo quando mover um documento.
- Execute `git diff --check`. Para comandos operacionais alterados, rode a verificação relevante quando praticável ou registre por que não foi possível. Para mudança apenas de Markdown, não há motivo para repetir toda a suíte de código.
- Confira no quadro da sprint o **status**, o **critério de aceite** e a **próxima ação**. O documento deve permitir que outra pessoa encontre a evidência sem depender da conversa.

Este guia é uma regra de manutenção. A [governança do Plano Mestre](../../PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md#44-governança-de-documentação) resume sua posição no projeto; `AGENTS.md` exige sua aplicação durante o trabalho.
