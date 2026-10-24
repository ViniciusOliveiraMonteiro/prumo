# ADR-045: ciclo de verificação e troca do e-mail da conta

- **Status:** políticas, protocolo transacional, parâmetros de códigos e outbox cifrada aprovados pelo usuário em 2026-10-23; política de troca de endereço já verificado aprovada em 2026-10-22; incremento local com captura de teste implementado e validado parcialmente em 2026-10-23; transporte externo, operação da chave e gates adicionais pendentes
- **Data:** 2026-10-22; decisões complementares em 2026-10-23
- **Escopo:** contas existentes no acesso externo; não define cadastro público nem provedor de entrega
- **Relacionadas:** [ADR-037](ADR-037-private-identity-bootstrap-proposal.md#modelo-e-fluxo-propostos), [ADR-039](ADR-039-private-credential-change-recovery-proposal.md#fluxo-alvo-para-o-mvp--direção-aceita-detalhes-pendentes) e [ADR-044](ADR-044-email-invitation-acceptance-proposal.md#direção-aprovada)

## Problema e decisões delimitadas

O e-mail atual identifica o login, mas não tem prova de posse. A direção aprovada na ADR-044 exige endereço verificado antes de entregar e aceitar convite. A recuperação por e-mail proposta na ADR-039 tem a mesma dependência. Nenhuma conta existente, inclusive criada pela CLI, pode ser marcada verificada por migração.

Esta ADR aprova a primeira verificação por código digitado na sessão, a troca de endereço **nunca verificado** com sessão, senha atual e prova do novo endereço, e a troca de endereço **já verificado** com sessão, senha atual e confirmação dos endereços antigo e novo. Quando o endereço verificado foi perdido, a troca fica bloqueada até existir uma exceção aprovada com prova previamente vinculada à conta. A escolha dessa exceção permanece pendente. A outbox cifrada, a validade e os limites por conta/finalidade estão aprovados abaixo; gestão da chave, limites por origem, transporte, custo e contrato HTTP precisam de definição antes de implementar ou abrir o fluxo externo.

## Alternativas para comprovar o endereço

| Opção | Vantagem | Limite |
|---|---|---|
| Código digitado numa sessão autenticada | Não coloca segredo em URL nem aceita por prévia de mensagem; permite vincular prova à conta | Exige copiar o código; depende de entrega, prazo e limite de tentativas |
| Link de confirmação vinculado à sessão | Menos passos | Exige proteger URL, logs, cache e scanners; abrir o link não pode confirmar automaticamente |
| Confirmar por resposta ao e-mail ou declaração do operador | Pode parecer simples no laboratório | Não oferece prova automatizada, transacional e auditável para usuários externos |

**Decisão aprovada em 2026-10-23:** usar código de uso único enviado ao endereço atual e digitado pela conta autenticada. A prova vale somente para o endereço e a versão do endereço registrados quando o desafio foi emitido. Verificação não cria sessão, não recupera senha e não concede membership. Contas existentes começam sem verificação; não se presume posse por migração.

## Primeira verificação: política e protocolo aprovados

1. Uma conta ativa e autenticada pede a verificação do seu e-mail atual. A API cria desafio com finalidade `verify_email`, identificador da conta, endereço normalizado e versão do endereço; guarda apenas verificador do código no estado durável e prepara entrega. Reenvio invalida o código anterior. Uma conta provisionada pela CLI começa sem verificação.
2. A pessoa digita o código na própria sessão. Em uma transação, a API bloqueia a conta e o desafio, confere finalidade, prazo, tentativa, versão e endereço atuais, consome o código e marca **essa versão** do endereço como verificada. Falha reverte todos os efeitos. Código encaminhado a outra conta não verifica o endereço dela.
3. Pedido e consumo exigem proteção de origem/CSRF, `no-store`, limites de tentativa e emissão e logs sem endereço completo nem segredo. Uma fila de entrega com retry precisa descartar mensagens de desafios substituídos; atraso de mensagem não pode validar código antigo.

**Modelo candidato:** `email_version` monotônica na conta, `verified_email_version` nula até a prova, e desafios com finalidade e versão. Assim, `verified_email_version = email_version` é a condição de endereço atual verificado. A migração preenche `verified_email_version` com `NULL`, sem inferir posse de endereços antigos. O armazenamento, índice e grants devem ser especificados na implementação e testados com `prumo_app`.

### Parâmetros de códigos aprovados

| Item | Decisão de 2026-10-23 | Motivo e limite |
|---|---|---|
| Código de verificação e troca | 128 bits aleatórios em Base64URL sem padding (22 caracteres) para copiar e colar; verificador criptográfico no estado durável | Mantém margem contra tentativa online sem depender apenas do limite; o formato visível exige teste de usabilidade |
| Prazo | 30 minutos da emissão para primeira verificação e para cada prova de troca | Reduz janela de exposição; entrega atrasada pode exigir reenvio |
| Tentativas | Cinco falhas por desafio; a quinta o invalida | Limita adivinhação; contador deve persistir mesmo quando a prova falha |
| Emissão | No máximo uma nova emissão por finalidade/conta a cada 60 segundos e cinco por 24 horas; reenvio substitui o desafio anterior | Limita spam e invalida código antigo; controles por origem confiável e resposta a abuso continuam necessários |
| Troca pendente | Uma solicitação ativa por conta, válida por 30 minutos; nova solicitação cancela a anterior | Impede duas trocas concorrentes com provas misturadas; cancelar não troca o login |

Estes valores foram **aprovados pelo usuário em 2026-10-23** para verificação e troca de e-mail. O convite da ADR-044 e a recuperação da ADR-039 têm finalidades e prazos próprios; não herdam automaticamente estes números. Na API, pedido e consumo exigem sessão, origem confiável, `no-store` e corpo sem segredo em logs. Respostas para endereço novo já usado ou envio indisponível não devem revelar outra conta; erro de senha atual pode ser informado apenas à própria sessão, sob limite de tentativa. O contrato HTTP e os textos exatos permanecem para especificação junto com a implementação.

## Troca do endereço

### Política aprovada para trocar endereço verificado

Em 2026-10-22, o usuário escolheu a segunda política: a conta precisa de sessão autenticada, senha atual e **confirmação dos endereços antigo e novo** para concluir a troca de um endereço já verificado. A prova do novo endereço sozinha não desloca o login nem o canal de recuperação. O endereço antigo permanece ativo enquanto a troca está pendente. Abrir uma mensagem não conclui a operação.

O protocolo aprovado em 2026-10-23 prevê criar uma solicitação vinculada à conta e aos dois endereços, emitir códigos distintos para cada finalidade e confirmar ambos na sessão da conta. Somente após as duas confirmações, uma transação troca o endereço de login e sua versão, invalida desafios e códigos de convite ligados à versão antiga, revoga sessões antigas e exige novo login e registra auditoria sem endereço completo. Preparar também aviso de conclusão ao endereço antigo. Falha de envio, confirmação ou transação conserva o endereço antigo. O prazo e o reenvio seguem os parâmetros aprovados; ordem física dos bloqueios e concorrência com convite e recuperação exigem desenho e testes antes da implementação.

Alternativas consideradas:

| Política para autorizar a troca | Vantagem | Custo e risco |
|---|---|---|
| Senha atual, sessão e prova do endereço novo; aviso ao antigo | Permite recuperar o endereço perdido sem suporte manual | Quem obtém sessão e senha pode deslocar o canal de recuperação; aviso pode chegar tarde |
| Exigir também prova do endereço antigo quando verificado; oferecer caminho excepcional separado | Reduz troca silenciosa após roubo de sessão e senha | Bloqueia titular que perdeu o endereço até existir recuperação segura |

### Política aprovada para trocar endereço nunca verificado

Em 2026-10-23, o usuário aprovou exigir sessão autenticada, senha atual e código de uso único enviado ao **novo** endereço. Não se exige prova do endereço anterior, cuja posse nunca foi confirmada; isso permite corrigir um endereço digitado incorretamente. A troca deve ser transacional: até a prova do novo endereço, o login continua no endereço anterior. A operação não alega notificação independente por um endereço nunca verificado. O protocolo aprovado exige desafios vinculados à conta e versão, revogação de sessões e rechecagem do estado do endereço antigo no commit; o esquema físico e os testes de concorrência ainda precisam ser fechados antes da implementação.

### Política aprovada para endereço verificado perdido

Em 2026-10-23, o usuário aprovou **manter a troca bloqueada** quando não há confirmação do endereço antigo já verificado. Sessão, senha atual e prova do endereço novo, sozinhas, não autorizam a exceção. A escolha de um método de recuperação específico para e-mail continua pendente; os códigos offline da ADR-039 recuperam senha e não ganham automaticamente a finalidade de trocar o endereço.

### Alternativas pendentes para a exceção

Enquanto não houver um método de recuperação de e-mail aprovado, a política exige manter o endereço verificado e impedir sua troca sem a confirmação do antigo. A pessoa poderá continuar usando a conta se tiver sessão e senha válidas, mas convites e recuperação que dependam da caixa postal perdida não poderão ser concluídos por declaração de perda. O suporte não deve marcar outro endereço como verificado manualmente.

| Caminho para uma futura exceção | Benefício | Dependência e risco |
|---|---|---|
| Código offline **específico para recuperação do e-mail**, emitido antes da perda, mais sessão, senha atual e prova do novo endereço | Permite recuperar sem acesso ao endereço antigo | Exige inscrição prévia, guarda pelo titular, uso único, limites, revogação, notificação e testes de concorrência; os códigos de senha atuais não ganham essa finalidade automaticamente |
| Segundo canal de contato verificado previamente, mais sessão, senha atual e prova do novo endereço | Permite confirmar a mudança por canal ainda controlado | Exige ciclo de vida próprio para o segundo canal; perder os dois canais mantém o bloqueio |
| Operador ou dados biográficos sem prova prévia | Pode aparentar resolver bloqueios | Não demonstra controle da conta; não é proposta para acesso externo |

**Próxima decisão:** escolher, se necessário, uma exceção verificável e auditável. Ao aprová-la, definir como ela revoga sessões e desafios antigos, avisa os canais previamente registrados e lida com a perda simultânea de todos os meios. O procedimento local da ADR-039, limitado ao próprio operador, não vira suporte para outras pessoas.

## Protocolo transacional aprovado — desenho físico pendente

1. **Emitir:** autenticar e, quando for troca, conferir a senha atual antes de criar a solicitação. Em uma transação, bloquear a conta, conferir estado e limites, cancelar solicitação e desafios substituídos, persistir somente verificadores dos códigos e enfileirar as mensagens correspondentes. Cada desafio referencia conta, finalidade, solicitação, endereço normalizado e versão de e-mail. A emissão não altera o endereço de login nem marca verificação. Uma restrição de unicidade do novo endereço deve impedir duas contas de concluírem a mesma troca; reserva temporária e comportamento de conflito ainda exigem desenho físico.
2. **Provar:** sob a sessão da mesma conta, bloquear conta, solicitação e desafio em ordem global; conferir finalidade, endereço, versão, prazo, tentativas e estado; consumir a prova uma vez. Na primeira verificação, marcar apenas a versão atual como verificada. Na troca de endereço nunca verificado, exigir a prova do novo endereço **e conferir novamente, no commit, que o antigo continua não verificado**. Se a verificação concorrente do antigo venceu, cancelar a solicitação mais fraca e iniciar outra com prova dos dois endereços. Na troca de endereço já verificado, exigir as provas distintas do antigo e do novo dentro da mesma solicitação. Confirmar a alteração do login, elevar a versão do e-mail, marcar a nova versão verificada, invalidar desafios e convites ligados à versão anterior e auditar na mesma transação. Uma prova válida isolada da troca não altera o login.
3. **Sessões e concorrência:** a conclusão da troca deve revogar as sessões anteriores e exigir novo login no novo endereço; a versão de credencial/sessão precisa impedir que login concorrente com o e-mail antigo deixe uma sessão utilizável após o commit. A implementação deve demonstrar essa propriedade no PostgreSQL e proteger operações já autorizadas conforme a ADR-029. Colisão de endereço, verificação simultânea, convite e recuperação precisam de ordem de locks e casos de teste nas duas ordens.
4. **Falha:** erro na transação reverte endereço, prova, auditoria e mensagem de conclusão. Falha de transporte não marca endereço verificado nem conclui uma troca sem prova; uma mensagem já emitida pode chegar tarde, mas seu código substituído ou vencido não volta a valer. Confirmar por `GET`, prévia do e-mail ou declaração do operador não produz efeito.

## Outbox cifrada aprovada — transporte pendente

Uma **outbox no PostgreSQL**, gravada na mesma transação do desafio, foi aprovada pelo usuário em 2026-10-23 para desacoplar a API do provedor. O worker lê apenas itens confirmados, verifica novamente finalidade, prazo, versão, solicitação e estado antes de cada tentativa, marca tentativas e resultado, e descarta mensagens substituídas. O banco guarda apenas verificadores para aceitar códigos; para enviar ou repetir a mensagem, a outbox precisa reter temporariamente o código reversível em payload cifrado com chave fora do banco. A escolha da chave, rotação, acesso do worker, prazo máximo de retenção e limpeza comprovada é gate de implementação. Cifrar o payload reduz a exposição em backup do banco, mas não protege contra comprometimento simultâneo da aplicação e da chave.

O transporte deve oferecer autenticação de domínio de envio, TLS, tratamento de bounce e reclamação, limite de throughput, logs sem endereço completo nem código e monitoramento de atraso/falha. Aceitação pelo provedor não comprova entrega à caixa postal; retry após resposta ambígua pode duplicar a mensagem, mas não deve emitir segundo código. Mensagem já em trânsito pode chegar depois do cancelamento, sempre com código inválido. Antes de informar falha permanente à própria conta autenticada, definir estado genérico que não revele se outro endereço existe; a etapa local não expõe estado de entrega. Ainda faltam escolha de provedor ou SMTP, domínio, região, custo, responsáveis e procedimento de desligamento; nenhum serviço externo foi autorizado ou configurado. O mesmo mecanismo poderá servir convite e recuperação, mas cada finalidade preserva suas regras e decisões próprias.

### Transporte externo em avaliação — nenhuma conta ou serviço escolhido

Preços públicos consultados em 2026-10-23, em USD e sujeitos a mudança; volume, região, domínio e orçamento do Prumo ainda não foram definidos. O custo de DNS, armazenamento, monitoramento e outros serviços não está incluído nos valores abaixo.

| Opção | Preço público observado | Ganho | Custo operacional e limite |
|---|---|---|---|
| [Resend](https://resend.com/pricing) | Gratuito: até 3.000 e-mails/mês e 100/dia; Pro: US$ 20/mês para 50.000/mês | API transacional, SMTP, eventos e supressão; baixo custo inicial | Exige conta externa, domínio verificado, credencial, webhooks e conferência de retenção/região; quota diária do plano gratuito pode interromper testes |
| [Postmark](https://postmarkapp.com/pricing/) | Gratuito: 100 e-mails/mês; Basic: US$ 15/mês no volume de referência de 10.000/mês | Foco em e-mail transacional, eventos e supressão | Franquia gratuita menor; plano pago fixo e retenção de conteúdo por padrão precisam de revisão de privacidade |
| [Amazon SES](https://aws.amazon.com/ses/pricing/) | Essentials: US$ 0,16 por 1.000 e-mails no primeiro nível, além de cobrança de dados e possíveis serviços AWS | Custo variável baixo por mensagem e APIs/SMTP | Exige mais configuração de conta, região, permissões, domínio, eventos, bounce e custo total; não pressupõe que o Prumo usará AWS |
| SMTP próprio | Servidor e operação a estimar | Controle direto do transporte | Entregabilidade, reputação, abuso, DNS, manutenção e disponibilidade recaem sobre o projeto; não recomendado para o primeiro envio externo |

**Proposta de sequência:** testes e desenvolvimento usam transporte local que captura mensagens sem envio real; o adaptador do worker mantém o contrato de envio e eventos independente do fornecedor. Para um piloto externo, comparar Resend e Postmark com volume e orçamento estimados, retenção de conteúdo, região, domínio, suporte a bounce/reclamação e limites. SES merece comparação se a infraestrutura AWS já fizer parte da decisão de implantação ou se o volume justificar sua operação. Criar conta, domínio, credencial ou despesa exige decisão posterior de implantação; esta tabela não aprova nenhum fornecedor.

### Etapa local escolhida em 2026-10-23

O usuário escolheu detalhar e validar primeiro o fluxo com captura local de mensagens, sem envio real, deixando a escolha do provedor para a implantação. O recurso de e-mail fica desabilitado por padrão para preservar o acesso privado atual. O transporte local deve ser injetado apenas em testes e ambiente de desenvolvimento explicitamente configurado; quando o recurso for habilitado, a inicialização deve falhar se não houver transporte válido. A captura não expõe códigos em HTTP, logs, métricas, arquivos persistentes ou respostas da API. Testes obtêm o conteúdo somente pelo adaptador de teste em memória, com limpeza entre casos. Isso permite demonstrar o fluxo sem criar conta externa nem usar credenciais. A política para um laboratório manual sem adaptador de teste ainda precisa de desenho; não transformar a captura em caixa postal pública.

## Esquema físico mínimo proposto para a etapa local

Esta seção registrou o desenho do incremento local. A migração `0011` implementou os objetos abaixo; a validação de grants e índices em teste de banco direcionado permanece pendente. Preserva `identity.users` e `identity.sessions` existentes, as migrações SQL versionadas da ADR-031 e a role restrita `prumo_app`.

| Objeto | Colunas e restrições propostas | Papel |
|---|---|---|
| `identity.users` | `email_version integer NOT NULL DEFAULT 1`, `verified_email_version integer NULL`; `verified_email_version IS NULL OR verified_email_version = email_version` | Contas existentes iniciam não verificadas; igualdade marca apenas a versão atual |
| `identity.email_change_requests` | `id`, `user_id`, e-mails antigo e novo normalizados, `from_email_version`, `from_credential_version`, `requires_old_proof`, `status`, `created_at`, `expires_at`; uma solicitação pendente por conta | Congela os dados de abertura e vincula as duas provas sem mudar o login antes da conclusão; troca/recuperação de senha invalida a solicitação |
| `identity.email_challenges` | `id`, `user_id`, `request_id` anulável na primeira verificação, finalidade `verify_current`/`change_old`/`change_new`, endereço normalizado, versões de e-mail e credencial na emissão, `code_hash`, `failed_attempts`, `status`, `created_at`, `expires_at`; um desafio vigente por conta/finalidade/solicitação | Impede trocar códigos entre contas, versões, solicitações ou finalidades; hash do código de 128 bits |
| `identity.email_issue_attempts` | `user_id`, finalidade, `created_at`, `admitted`; índice por conta/finalidade/horário e retenção superior a 24 horas | Contar apenas pedidos admitidos com `202` na janela móvel, inclusive inelegíveis, mesmo após reenvio/cancelamento; pedidos recusados com `429` ficam separados para monitorar abuso sem prolongar a janela de emissão |
| `identity.email_delivery_outbox` | `id`, `challenge_id`, payload cifrado autenticadamente com endereço e código, identificador de chave, estado, tentativas, próximo envio e prazo de descarte; índice para itens prontos | Envio e retry sem persistir código legível; conteúdo cifrado eliminado após aceite pelo transporte ou expiração |
| `identity.email_events` | `id`, `user_id`, tipo, horário e IDs de solicitação/desafio sem endereço completo ou código; grant de `INSERT` sem `SELECT` para a API | Auditoria transacional de emissão, verificação, troca e cancelamento |

**Unicidade e concorrência:** a unicidade atual de `users.email_normalized` decide qual troca pode confirmar um novo endereço. Não reservar endereços por solicitação pendente: uma conta não deve poder bloquear indefinidamente o e-mail de outra. Pedido para endereço já usado mantém a mesma forma de resposta e de estado pendente da própria conta, sem enviar código ao endereço de outra conta; expira sem alterar o login. A implementação precisa testar diferença grosseira de tempo e metadados, inclusive em `GET /email-status`, sem prometer igualdade estatística. Para desafios de primeira verificação, `request_id` é nulo: um índice único comum não impede duplicatas nesse caso. Usar índice único parcial para desafio vigente de `verify_current` por conta e outro para desafios vigentes ligados à solicitação, ou demonstrar alternativa equivalente com `NULLS NOT DISTINCT`. No commit, bloquear a conta e conferir versões do e-mail e da credencial do desafio; para troca elegível, conferir ainda o estado de verificação e a versão da credencial registrada na abertura. Troca ou recuperação de senha invalida solicitações e desafios de e-mail na mesma transação que eleva `credential_version`. Aplicar a mudança com a restrição única, elevar `email_version` e `credential_version`, revogar sessões, invalidar desafios e convites da versão antiga, registrar evento e mensagem de conclusão na mesma transação. Em colisão posterior, reverter sem revelar qual conta usa o endereço; a solicitação pode ser encerrada como não concluída. Antes de abrir o fluxo externo, definir ordem global de locks que inclua convites e recuperação.

**Falhas de código e emissão:** incrementar `failed_attempts` de forma durável mesmo quando a confirmação falha; a quinta falha invalida o desafio. Não lançar erro dentro de uma transação que precise preservar esse contador. Na confirmação com dois códigos, uma falha não consome a prova correta, mas incrementa o contador do desafio incorreto. Contar cada pedido admitido com `202` na janela de cinco emissões, inclusive para endereço duplicado, sem reverter o histórico ao cancelar ou reenviar. Pedido recusado com `429` pode ser registrado para observabilidade, mas **não** conta como nova emissão nem adia o fim da janela; testar uma rajada de `429` seguida de nova emissão após a janela original. O hash de um código de 128 bits pode usar SHA-256, como os códigos offline atuais, mas o domínio deve incluir finalidade ou ID do desafio para evitar reutilização entre protocolos. Reenvio cancela desafio e item de outbox anteriores na mesma transação. O worker confere estado antes de enviar; depois do envio, só o consumo transacional decide validade.

**Grants e limpeza:** `prumo_app` precisa apenas das operações necessárias em solicitações, desafios e outbox, sem leitura de eventos; o worker deve usar interface/role com acesso mínimo ao payload cifrado e à checagem de validade, a especificar antes do envio externo. Nos testes, uma chave efêmera é gerada por instância e não fica versionada; o capturador local deve processar apenas itens com `key_id` da própria instância, pois outra execução pode deixar payload cifrado com chave distinta na outbox. Para worker em processo separado ou implantação, a chave precisa vir de configuração segura e sobreviver a restart até a outbox esvaziar. Uma rotina local remove desafios, solicitações e ciphertext vencidos sem apagar eventos de auditoria antes do prazo de retenção aprovado. Não colocar payload cifrado em fixtures versionadas ou snapshots de teste.

## Contrato web/API proposto para a etapa local

Os caminhos e corpos abaixo foram implementados no incremento local e adicionados ao OpenAPI. Seguem origem única `/api`, cookie de sessão, `Cache-Control: no-store`, proteção de origem/CSRF nas mutações e tipos web derivados do OpenAPI da API. Nenhuma resposta inclui código ou afirma que o provedor entregou a mensagem. No runtime normal, as rotas respondem indisponibilidade porque não há transporte externo; a captura funciona apenas nos testes explicitamente configurados.

| Operação | Pedido | Resposta proposta |
|---|---|---|
| `GET /api/auth/email-status` | Sessão | `200 { email, verified, pendingChange: null \| { newEmail, expiresAt, requiresOldCode } }` apenas para a própria conta; `401` sem sessão |
| `POST /api/auth/email-verification` | Sessão, corpo vazio | `202` sem corpo para pedido aceito ou inelegível; `429` com `Retry-After` quando a própria conta atingiu o limite |
| `POST /api/auth/email-verification/confirm` | Sessão, `{ code }` | `204` na verificação; `400` para formato, `401` sem sessão, `422` para código inválido/vencido e `429` para excesso de tentativas |
| `POST /api/auth/email-changes` | Sessão, `{ newEmail, currentPassword }` | `202` sem corpo, inclusive se o novo endereço já estiver em uso; `400` para formato, `401` para sessão ausente ou senha atual incorreta, `429` para limite |
| `POST /api/auth/email-changes/confirm` | Sessão, `{ newCode, oldCode? }` | `204` e cookie limpo após troca concluída; `422` com corpo genérico para prova inválida/vencida, colisão ou política mais fraca vencida por verificação concorrente; `429` para excesso |
| `POST /api/auth/email-changes/cancel` | Sessão, corpo vazio | `204` mesmo sem solicitação ativa; não muda o endereço |

Na troca de endereço já verificado, `oldCode` e `newCode` são obrigatórios na **mesma confirmação**; uma prova correta isolada não fica marcada como aprovada. Quando o endereço antigo nunca foi verificado, apenas `newCode` é aceito, mas a transação revalida que o antigo continua não verificado. A solicitação também expira se `credential_version` mudou desde a abertura. Código inválido incrementa o contador do desafio correspondente e não consome o outro. Reenvio dos códigos de troca usa novo `POST /email-changes` com senha atual e substitui a solicitação anterior. `GET /email-status` não expõe hash, código nem detalhes da fila; pedido inelegível e colisão mantêm metadados e erros genéricos. O contrato local não promete estado de entrega: falha permanente de transporte só poderá ser mostrada à própria conta após definir um estado genérico que não permita inferir existência de outro endereço. O OpenAPI e os tipos web foram gerados e a checagem local de contrato passou; a revisão independente das correções foi concluída.

**Gates da etapa local:** migrar com `prumo_app`, executar E2E com duas contas e captura em memória, testar migração de contas anteriores não verificadas, índice de desafio vigente com `request_id` nulo, unicidade, reenvio, cinco falhas duráveis de cada um dos dois códigos, cinco emissões na janela de 24 horas mesmo após cancelamento, 30 minutos, rollback de evento/outbox, invalidação de solicitação após troca/recuperação de senha, revogação de sessão e login concorrente, corrida entre primeira verificação e troca nas duas ordens, convite e recuperação concorrentes, e confirmar ausência de código/endereço completo em resposta e logs. Validar OpenAPI, tipos da web, proxy HTTPS local, CSRF e cache; pedir revisão independente da implementação. O ambiente PostgreSQL local precisa ser recriado antes desses testes, pois os containers e volumes anteriores foram excluídos pelo usuário.

## Dependências e critérios de aceite

- Especificar esquema físico, contrato HTTP e integração com a ADR-039 sem ampliar a finalidade dos códigos de senha. A exceção para perda do endereço verificado ainda exige decisão própria. Validade, tamanho e limites por conta dos códigos estão aprovados; resposta a abuso por origem, retenção, tratamento de endereço internacional e mensagens de erro seguem pendentes antes de implementação externa.
- Decidir provedor, domínio, custo, bounce, gestão da chave, proteção e descarte do payload temporário da fila, monitoramento e retry. A fila transacional deve demonstrar que falha de envio não marca endereço verificado e que mensagem atrasada não revalida código substituído.
- Testar no PostgreSQL com `prumo_app`: contas antigas não verificadas; correção de endereço nunca verificado sem prova do antigo e sem ativar o novo antes da confirmação; A/B; código de apenas um endereço não conclui troca quando o antigo era verificado; perda do antigo verificado mantém a troca bloqueada; códigos trocados entre finalidades ou solicitações são rejeitados; reenvio e replay; verificação concorrente do antigo versus troca sem prova dele nas duas ordens, impedindo confirmar a política mais fraca após a verificação; troca versus convite e recuperação; endereço duplicado; rollback de auditoria e fila; perda de sessão; revogação de sessões antigas; entrega indisponível e mensagem duplicada ou atrasada.
- Validar contrato web/API, proxy HTTPS, CSRF, cache e logs; solicitar revisão independente após implementação. O gate da ADR-044 continua aberto até que a prova do endereço e a entrega estejam operacionais.

## Incremento local implementado em 2026-10-23

A migração `prumo-api/migrations/0011_email_lifecycle.sql` adiciona versão e estado de verificação do endereço, solicitações, desafios, histórico de emissão, outbox e eventos. As contas existentes permanecem **não verificadas**. A API recebeu as seis rotas propostas; `contracts/openapi.json` e os tipos gerados da web foram atualizados. Troca e recuperação de senha invalidam pedidos e desafios de e-mail na mesma transação. A conclusão de troca eleva `credential_version`, revoga sessões e exige login novo. O fluxo de e-mail fica indisponível no runtime normal; a captura em memória só é habilitada com `NODE_ENV=test` e `PRUMO_EMAIL_TRANSPORT=capture`, sem código em HTTP ou log. Não há envio real, formulário web nem provedor configurado.

**Evidência local:** `0011` e `0012` foram aplicadas e os grants de `prumo_app` preparados no PostgreSQL local. Treze E2E direcionados em `prumo-api/test/email-lifecycle.e2e-spec.ts` passaram com `prumo_app`, incluindo dois códigos e aviso de conclusão para endereço já verificado, revogação, corrida com primeira verificação, mudança e recuperação de senha, janela de emissão após `429`, limite da senha atual, colisão de endereço, cinco códigos incorretos, reenvio, replay, cancelamento e rollback de evento/outbox. A regressão direcionada de autenticação e recuperação passou com 17 E2E; 28 testes de banco passaram, incluindo descarte de ciphertext vencido; os testes direcionados de retenção e grants passaram após a limpeza de desafios e solicitações vencidos. O E2E do proxy HTTPS local passou para as novas rotas com `503`, `403` por origem hostil e `no-store`. Typecheck e lint da API, typecheck da web, geração e checagem do contrato passaram. Uma execução paralela de testes expôs que a captura tentava decifrar itens de outra instância com chave efêmera diferente; o capturador agora filtra `key_id` próprio. Este resultado não comprova envio ou uso externo.

**Revisão independente:** a primeira revisão encontrou falta de limite para senha atual incorreta, diferença de trabalho entre endereço ocupado e livre, aviso de conclusão ausente, ciphertext vencido sem descarte e respostas ausentes no OpenAPI. A implementação ganhou limite de cinco falhas em 15 minutos, caminho de persistência uniforme para endereço ocupado, aviso transacional ao endereço antigo verificado, limpeza do payload vencido e contrato corrigido. Os testes adicionais verificam os efeitos. A segunda passagem independente examinou as cinco correções sem achar defeito bloqueante. A limpeza adicional de desafios e solicitações vencidos foi testada e revisada sem achado material. O recorte local ainda depende dos gates de concorrência e de tempo abaixo. A equivalência estatística de tempo entre endereços ocupados e livres não foi demonstrada.

**Gates ainda abertos:** corrida com convite e login e comparação de tempo/logs para colisão; política de chave persistente, limites por origem, retenção do histórico de emissão, transporte e custo. A outbox local captura mensagens na requisição e não é um worker externo com retry operacional. A ADR-044 continua sem aceite externo implementado. Não marcar a Sprint 4 concluída por este incremento.

## Conceitos para estudo

Prova de controle do endereço, identidade de login, reautenticação, canal de recuperação, desafio de uso único, versão para invalidar concorrência, fila transacional e notificação independente têm papéis diferentes. O endereço verificado prova acesso à caixa postal naquele momento; não substitui autenticação nem autorização de household.

## Referências

- [OWASP, Email Validation and Verification Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html): prova de endereço, troca, validade e enumeração.
- [OWASP, Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): limites e proteção de segredos em fluxos enviados por e-mail; parâmetros desta ADR são proposta própria.
- [NIST SP 800-63B, Account Recovery](https://pages.nist.gov/800-63-4/sp800-63b.html#account-recovery): métodos e notificações de recuperação; verificação de e-mail não é tratada como fator de autenticação.
