# Threat model inicial do Prumo

**Status:** rascunho da Sprint 1 (SEC-002). Nenhum controle desta tabela foi implementado ou validado. Revisar quando autenticação, banco, armazenamento, importação e IA forem definidos. Este documento deriva das seções 15, 22, 31 e 32 do Plano Mestre.

## Escopo e ativos

O escopo inicial cobre consulta e alteração de contas/transações, transferência entre contas e importação de extrato. Login, convites, exportação, exclusão e IA constam como superfícies futuras a detalhar antes da implementação.

| Ativo | Dano principal em caso de falha | Classificação interna candidata |
|---|---|---|
| Saldo, transações, faturas, extratos e arquivo de importação | Exposição de hábitos e patrimônio; números incorretos | Financeiro Confidencial |
| Identidade, e-mail e membership | Acesso indevido ou associação ao household errado | Pessoal |
| Sessões e credenciais | Tomada de conta | Credencial/Segredo |
| Audit log e resultados de importação | Perda de rastreabilidade ou vazamento indireto | Interno; pode conter Financeiro Confidencial se mal projetado |

A classificação acima é uma política interna de engenharia; ela não declara automaticamente todo dado financeiro como dado sensível na definição legal da LGPD. A política de retenção ainda não foi decidida.

## Fronteiras de confiança candidatas

```text
Pessoa / navegador
  → aplicação web ou cliente
  → API e autorização por membership
  → dados do household em banco
  → armazenamento de arquivos e processamento de imports (futuros)
```

O navegador e arquivos enviados são entradas não confiáveis. A API não pode tratar `householdId` recebido do cliente como prova de autorização. O limite entre households precisa ser verificado para cada recurso, mesmo que os dados compartilhem banco. A escolha entre filtros de aplicação e RLS permanece `NÃO DEFINIDO`; frontend, backend e banco também são hipóteses de stack, não componentes implantados.

## Ameaças, controles candidatos e evidência exigida

Prioridade é uma triagem inicial por impacto e plausibilidade, não uma medida quantitativa. O risco residual só poderá ser avaliado após implementação e testes.

| ID | Cenário de abuso ou falha | Prioridade | Controle candidato | Verificação exigida |
|---|---|---|---|---|
| TM-01 | Usuário troca o ID da conta/household na requisição e lê transações de outro household (IDOR/BOLA). | Alta | Resolver membership e escopo no backend para cada recurso; rejeitar IDs fora do escopo. | Testes negativos de leitura e escrita cruzadas entre households A e B. |
| TM-02 | Membership revogada continua autorizada por sessão ou cache desatualizado. | Alta | Revalidar permissão nas operações protegidas e definir estratégia de invalidação. | Após revogação, tentativa de leitura e mutação é negada. |
| TM-03 | Transferência grava débito mas falha antes do crédito, alterando o total do household. | Alta | Aplicar a atomicidade e os dois movimentos vinculados da ADR-007, com integridade verificável. | Injetar falha no segundo efeito e provar rollback completo. |
| TM-04 | Retry ou clique duplo cria duas transferências iguais. | Alta | Definir idempotência para comandos financeiros e restrição verificável no servidor. | Repetir o mesmo comando e observar um único efeito econômico. |
| TM-05 | Dois comandos concorrentes calculam saldos sobre estado antigo e produzem inconsistência. | Alta | Definir política de concorrência e saldo negativo antes da operação correspondente. | Teste com requisições paralelas e invariantes de saldo/total. |
| TM-06 | Importador vincula uma linha de extrato ao household errado ou worker processa arquivo de outro household. | Alta | Escopar job, objeto e cada linha ao household autorizado; checar vínculo na leitura e na confirmação. | Importar como A e tentar consultar/confirmar/processar como B. |
| TM-07 | Reimportação ou replay confirma o mesmo extrato duas vezes. | Alta | Staging, origem rastreável e deduplicação/idempotência com revisão de conflitos. | Reimportar arquivo idêntico e confirmar sem duplicar lançamentos. |
| TM-08 | Arquivo enorme ou malformado consome memória/CPU do parser e indisponibiliza a API. | Média/Alta | Limites de tamanho e tempo, validação de formato, processamento isolado quando necessário. | Fixtures inválidas, limites e timeout sem estado financeiro parcial. |
| TM-09 | Conteúdo de extrato ou descrição entra em log, trace ou mensagem de erro. | Alta | Política de minimização; registrar IDs e metadados necessários, sem payload financeiro bruto. | Inspecionar logs de erro e importação com dados fictícios marcadores. |
| TM-10 | CSV exportado inclui fórmula de planilha que executa ao abrir. | Média/Alta | Tratar células não confiáveis na exportação, inclusive descrições importadas. | Teste de exportação com entradas iniciadas por caracteres de fórmula. |
| TM-11 | Arquivo de importação ou exportação fica acessível por link público ou prazo indefinido. | Alta | Acesso autenticado e escopado, links temporários quando usados, retenção definida. | Tentar acesso anônimo e entre households; verificar expiração/exclusão conforme política futura. |
| TM-12 | Descrição importada injeta instruções em recurso futuro de IA e induz consulta ou divulgação fora do escopo. | Alta quando IA existir | Separar dados não confiáveis de instruções e limitar tools ao household autorizado. | Avaliação adversarial de prompts e tentativa de acesso cruzado antes de habilitar IA. |

## Pendências e gatilhos de revisão

- Definir autenticação, ciclo de sessão, convites e revogação antes de implementar recursos financeiros (SEC-003/004).
- Decidir isolamento no banco, inclusive se RLS será necessário, e validar com a mesma role usada pela aplicação.
- Definir formato, armazenamento, retenção e limpeza dos arquivos de importação; detalhar ameaças de parser para cada formato aprovado.
- Definir política de exportação e de exclusão antes de usuários externos.
- Reavaliar prioridades e risco residual após cada controle implementado, testes e decisão de arquitetura. Nenhuma linha deve ser marcada como mitigada apenas por existir neste documento.
