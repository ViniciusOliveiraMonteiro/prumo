# ADR-034: origem única para web e API no navegador

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

A ADR-030 escolheu Next.js e NestJS em processos distintos; a ADR-033 escolheu sessão revogável emitida pela API em cookie para o primeiro acesso web privado. Era necessário decidir como o navegador alcança ambos sem duplicar autenticação na web. O custo inicial deve ser zero ou quase zero e a hospedagem definitiva não foi escolhida.

Esta decisão trata da topologia visível ao navegador. Não escolhe provedor de hospedagem, domínio real, proxy de produção, certificado ou política de cache completa.

## Alternativas

| Opção | Vantagem | Custo e risco |
|---|---|---|
| Web e API em origens separadas | Deploy independente direto | Requer CORS com credenciais, política de cookies entre origens e mais combinações para testar CSRF e configuração de ambientes. |
| API de domínio dentro do Next.js | Uma origem e deploy mais simples | Contradiz a API NestJS como autoridade de domínio e duplicaria regras/autorização. |
| Origem única com roteamento por caminho | Browser usa mesma origem para páginas e `/api`; a API NestJS continua independente | Exige proxy/roteamento configurado e teste de cabeçalhos, cookies, cache e corpo das respostas. |

## Decisão

Oferecer ao navegador **uma única origem**: páginas e assets vão à web Next.js; `/api` e `/api/*` vão à API NestJS. A API continua dona de autenticação, autorização, contrato HTTP e regras financeiras. O roteamento apenas encaminha requisições e respostas; não valida membership nem transforma a web em segunda API de domínio. O contrato OpenAPI da ADR-032 descreve os caminhos públicos sob `/api`.

No desenvolvimento local, usar `rewrites` do Next.js para encaminhar `/api/*` ao NestJS em porta interna. Para implantação, colocar um roteador/proxy reverso que preserve o mesmo comportamento, sem escolher agora fornecedor ou serviço pago. Uma alternativa de deploy com origens separadas exige revisão desta ADR e dos testes de sessão/CSRF antes de ser usada. O caminho físico interno da API, os cabeçalhos aceitos de proxy e o endereço do serviço virão da configuração do ambiente, sem segredos no repositório.

Reservar `/api` e `/api/*` para o NestJS na origem pública; a web não cria páginas, Route Handlers nem Server Actions nesse caminho. O bootstrap deve escolher se o prefixo `/api` chega intacto ao NestJS ou é removido no roteamento e conferir que o OpenAPI e os testes usam exatamente o caminho público. Chamadas feitas pelo servidor Next.js também precisam encaminhar a sessão do usuário explicitamente e evitar cache compartilhado; a política concreta de fetching continua pendente.

A API emite cookie de sessão restrito ao host público, `HttpOnly` e `Secure` sob HTTPS, com `SameSite` definido conforme a ADR-033. Não definir `Domain` para o cookie; usar prefixo `__Host-` quando suas condições forem atendidas. Requisições mutáveis são protegidas contra CSRF pela API mesmo quando o navegador usa uma origem. O proxy deve preservar `Set-Cookie`, `Cookie`, `Origin`, método, corpo, código e cabeçalhos relevantes. A API só confia em cabeçalhos de proxy quando vierem de um proxy autorizado; cliente externo não pode escolher o host/origem efetivos por cabeçalhos arbitrários.

Em HTTPS, `__Host-` exige `Secure`, `Path=/` e ausência de `Domain`. A configuração local em HTTP deve ser testada separadamente, sem ser tomada como prova das flags em HTTPS. A API valida a origem externa permitida das mutações com uma lista explícita de origens; uma mesma origem no navegador não elimina requisições forjadas nem dispensa o mecanismo CSRF escolhido na implementação. O roteador de implantação deve rejeitar ou substituir cabeçalhos de encaminhamento recebidos de clientes antes de enviá-los à API.

Respostas autenticadas ou financeiras não devem ser armazenadas em cache compartilhado. A web não usa dados de sessão de outro usuário em cache de servidor. A política concreta de cache e renderização será validada no bootstrap antes das páginas financeiras. O endpoint interno do NestJS não fica publicado como segunda origem do browser no primeiro deploy.

## Custo, aceite e testes

O roteamento local usa recurso da stack já escolhida, sem assinatura. Em hospedagem, o proxy pode demandar recursos e operação; seu custo será estimado na ADR de deploy antes de contratar serviço. Esta ADR não afirma que hospedar Next.js, NestJS e PostgreSQL publicamente terá custo zero.

No bootstrap, demonstrar por testes locais de duas aplicações: (1) login via `/api` recebe cookie no host da web; (2) uma requisição protegida encaminha o cookie e a API reconhece a sessão; (3) logout/revogação impede a próxima requisição; (4) `Set-Cookie`, `Origin`, corpo e status não se perdem no caminho, inclusive em erro e redirecionamento; (5) origem hostil não consegue mutar via cookie; (6) resposta financeira não aparece em cache compartilhado, inclusive ao trocar de usuário; (7) o endereço interno do NestJS não é usado pelo browser; (8) `/api` e `/api/*` alcançam a rota pública esperada sem colisão com a web; (9) uma página renderizada no servidor só recebe dados da sessão correspondente. Repetir o fluxo em staging com HTTPS e proxy escolhidos antes de qualquer usuário externo, conferindo `Secure`, `HttpOnly`, `SameSite`, `Path`, ausência de `Domain` e tratamento dos cabeçalhos de encaminhamento.

## Consequências e pendências

A origem única simplifica o contrato do browser e evita configurar CORS com credenciais para o fluxo principal. Em troca, o roteamento se torna parte do caminho de sessão e deve ser testado. Continuam pendentes: proxy e hospedagem de produção, certificado, domínio, compatibilidade de cookies com a biblioteca candidata, política concreta de cache e matriz de permissões por ação. Se o laboratório mostrar que o rewrite local não preserva um requisito, trocar o mecanismo de roteamento local mantendo o contrato público, ou revisar esta decisão.

Em 2026-10-15, o login pelo rewrite local mostrou que o `Host` recebido pela API pode ser o endereço interno. A API passou a usar `PRUMO_PUBLIC_ORIGIN` como origem externa confiável explícita tanto na proteção CSRF quanto na biblioteca de sessão, sem confiar em `X-Forwarded-Host` enviado pelo cliente. Com essa configuração, a conta descartável fez login, leu `/api/auth/me` e saiu pelo caminho público; o mesmo cookie falhou após a revogação e uma origem estrangeira recebeu `403`. `Set-Cookie` e `Cache-Control: no-store` foram preservados. Isso cobre o desenvolvimento local; ainda faltam HTTPS, proxy de implantação, renderização autenticada da web e teste de cache com dois usuários.

Em 2026-10-20, um teste E2E local acrescentou TLS com certificado temporário, proxy reverso, rewrite Next.js e duas contas descartáveis. O caminho preservou cookie seguro, origem, status e `no-store`; a identidade de cada cookie ficou isolada e o logout de uma conta não afetou a outra. A evidência e o comando estão no [roteiro da Sprint 3](../operations/BOOTSTRAP_SPRINT_3.md#checks-de-saída). Permanece pendente repetir com o proxy de staging, avaliar cache intermediário real e testar página autenticada renderizada no servidor.

No mesmo teste, o proxy local passou a simular um cache compartilhado para `GET /api/auth/me`, usando apenas o caminho como chave e respeitando `no-store`, `no-cache` e `private`. Uma resposta pública sintética foi armazenada e reutilizada como controle positivo; a leitura com dois cookies e a leitura anônima não criaram entrada nem hit de cache. Esse caso detecta regressões de cabeçalho que poderiam reutilizar uma identidade entre contas; o comportamento do cache de staging continua pendente.

Em 2026-10-20, `/conta` passou a consultar `/api/auth/me` na renderização do servidor, encaminhando somente o cookie de sessão e usando `fetch` sem cache. A rota recebe `Cache-Control: private, no-store`. O E2E com build de produção do Next.js, proxy HTTPS local e cache compartilhado simulado confirmou e-mails separados para duas sessões, ausência de identidade na página anônima e após logout e nenhuma entrada de `/conta` no cache. O modo de desenvolvimento do Next.js respondeu `no-cache, must-revalidate`, por isso o teste de isolamento da página usa o build de produção. Ainda faltam validação no proxy/cache de staging e política para futuras páginas com dados financeiros.

## Fontes técnicas consultadas

- [Next.js: rewrites para URL externa](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites) e [self-hosting com proxy reverso](https://nextjs.org/docs/app/guides/self-hosting).
- [NestJS: autenticação e sessão](https://docs.nestjs.com/security/authentication).
- [MDN: política de mesma origem](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy) e [cookies `__Host-`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies).
- [OWASP: proteção contra CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Conceitos para estudo

Origem versus site, proxy reverso, roteamento por caminho, cookie host-only, CORS, CSRF, cache compartilhado e cabeçalhos de proxy confiáveis.
