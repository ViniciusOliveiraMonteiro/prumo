# ADR-033: autenticação e sessão para o primeiro acesso web

- **Status:** aceito para a estratégia; validação da biblioteca candidata pendente
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

O Prumo terá dados financeiros por household. A ADR-030 separa Next.js e NestJS, a ADR-031 escolhe PostgreSQL/Drizzle e a ADR-029 exige autorização atual para cada operação, inclusive após revogação de membership. A ADR-032 define o contrato web/API, mas deixa o mecanismo de autenticação pendente. O usuário estabeleceu custo inicial zero ou quase zero como restrição de arquitetura.

Esta decisão cobre identidade e sessão no primeiro acesso web. A matriz de permissões por ação e a decisão de RLS são trabalhos separados. Nenhum controle desta ADR é considerado implementado pela aceitação do texto.

## Alternativas

| Opção | Benefício | Custo e risco |
|---|---|---|
| Provedor gerenciado | Reduz parte do trabalho de credenciais e recuperação | Planos, limites, preço futuro e dependência externa podem contrariar o custo inicial desejado. |
| Auth.js na web, API com identidade repassada | Integração direta ao Next.js | Exige um contrato adicional para a API confiar na sessão e tratar revogação sem duplicar identidade; aumenta a fronteira de segurança. |
| Better Auth no backend | Biblioteca livre com adapter Drizzle e sessões em banco | A integração com NestJS é mantida pela comunidade e exige validar parser, guards e compatibilidade. |
| `@nestjs/authentication` no backend | Módulo oficial NestJS com sessão em banco e integração documentada com Drizzle | Requer implementar e testar o store e os fluxos da aplicação; compatibilidade da versão escolhida deve ser comprovada. |
| Login/sessão escritos do zero | Controle completo | Mais código sensível para senha, cookie, revogação e recuperação, com maior custo de revisão de segurança. |

## Decisão

Fazer **NestJS ser a autoridade de identidade e sessão** para a aplicação web, usando `@nestjs/authentication` como biblioteca candidata e PostgreSQL como armazenamento durável da sessão. Usar sessão opaca revogável em cookie `HttpOnly`, `Secure` e `SameSite` apropriado ao desenho de origem; não guardar credencial de sessão em `localStorage`/`sessionStorage` nem adotar JWT de longa duração como sessão principal da web. A web apenas apresenta o login e consome a API; não mantém outra base de usuários ou emite uma identidade concorrente. O contrato da ADR-032 documentará o esquema de sessão quando o fluxo estiver implementado.

No primeiro uso privado, oferecer apenas acesso a contas provisionadas/invitadas de modo controlado, sem cadastro público automático. Autenticar credenciais com a biblioteca escolhida e algoritmo de hash apropriado; não implementar criptografia ou hash de senha próprios. A API trata logout da sessão atual, logout de todas as sessões, expiração e invalidação após alteração crítica de credencial. A membership é revalidada para cada operação protegida; uma sessão válida não concede acesso permanente ao household. Mudança ou revogação de membership deve ser refletida na próxima leitura/escrita e nas operações concorrentes segundo a ADR-029.

A topologia de origem única entre browser, Next.js e NestJS foi fixada pela ADR-034. A implementação deve demonstrar proteção contra CSRF, política de origens confiáveis, rotação ou substituição da sessão no login, flags do cookie em ambiente HTTPS, limite de tentativas e ausência de tokens/segredos em logs. O módulo oficial documenta verificações para esses pontos; a aplicação ainda precisa testá-los. Não expor a aplicação a usuários externos antes de fechar recuperação de conta, verificação de e-mail quando aplicável, resposta a abuso e avaliação de MFA/passkeys. Esses fluxos podem exigir provedor de e-mail e custo operacional; uma decisão posterior estimará esse custo antes da abertura pública.

**Restrição de custo:** biblioteca livre e banco já escolhido, sem assinatura de identidade obrigatória nem cobrança por login. O custo direto de licença/serviço de autenticação pode ser zero no primeiro uso privado; desenvolvimento, armazenamento, HTTPS, e-mail e operação continuam custos reais. A estratégia foi aprovada; `@nestjs/authentication` continua candidata sujeita ao gate de compatibilidade e segurança. Se o módulo oficial não cumprir os testes na versão fixada, revisar esta ADR comparando novamente Better Auth e outras opções livres, sem substituir silenciosamente por autenticação própria ou serviço pago.

## Aceite e validação antes de dados financeiros reais

- Confirmar licença, versões compatíveis de NestJS/Node e instalação local do módulo escolhido; testar store PostgreSQL/Drizzle com os testes de contrato da biblioteca.
- Demonstrar login, cookie, expiração, logout atual e global, troca de credencial e revogação de sessão; falhas negam acesso.
- Demonstrar que usuário sem sessão recebe `401`, usuário de A não lê nem altera B, membership revogada bloqueia a próxima operação mesmo com sessão viva, e replay de comando não devolve dado sem autorização atual.
- Testar CSRF e origem não confiável em escrita; inspecionar flags de cookie em HTTPS, CORS e logs sem credenciais.
- Antes de usuários externos: definir recuperação segura, verificação de e-mail quando houver cadastro, limite de tentativas, monitoramento de abuso e MFA/passkeys; registrar custo de e-mail/infra e teste de recuperação.

## Consequências e pendências

Sessões no PostgreSQL permitem revogação sem uma lista paralela de JWTs e reaproveitam a infraestrutura decidida. O custo é uma leitura/validação de sessão e store confiável, além do trabalho de integração da web com a API. A decisão não define permissões de OWNER/MEMBER/VIEWER, convites, política de retenção, formato físico das tabelas, topologia final de deploy, RLS nem abertura pública. Esses pontos devem ser decididos e testados antes dos fluxos correspondentes. A ADR-034 fixou a topologia do navegador; os comandos de bootstrap estão propostos em `docs/operations/BOOTSTRAP_SPRINT_3.md`. O gate da Sprint 4 depende de implementar a estratégia e demonstrar isolamento A/B.

**Validação inicial em 2026-10-15:** `@nestjs/authentication` 0.1.1 foi adicionado como dependência local da API. O manifesto publicado informa licença MIT, Node `>=20.19.0`, peers NestJS `^12.0.0` e peers opcionais para WebSockets e microservices. O laboratório descartável em `prumo-api/test/authentication.db-spec.ts` implementa somente `SessionStore` com Drizzle e `pg`, em schema criado pelo teste. Os sete casos de `authenticationStoreContract({ contracts: ['sessions'], concurrent: true })` passaram em PostgreSQL local com pool; os dez testes anteriores de banco também passaram. O schema e a classe do laboratório não são migração nem store de produção; a integração posterior está descrita abaixo.

**Avanço após a aprovação da ADR-037:** usuários e sessões foram migrados para o schema `identity`; o store Drizzle está registrado na API, e a role local de aplicação foi separada da migradora. O login privado, `me`, logout atual e global passaram em E2E direto, incluindo cookie seguro, revogação e usuário desativado. O fluxo pelo rewrite local passou com origem pública explícita; uma origem hostil continuou recebendo `403`. O primeiro teste detectou que a biblioteca representa o hash do token em Base64URL, corrigido por migração adicional. Em 2026-10-16, testes direcionados do store real com a role da aplicação passaram no esquema migrado; limites do contrato oficial nesse esquema estão descritos na [ADR-037](ADR-037-private-identity-bootstrap-proposal.md#pendências-e-conceitos-para-estudo). A [ADR-038](ADR-038-private-sign-in-attempt-limit-proposal.md#alternativas-e-proposta) aceitou PostgreSQL, contagem de falhas e limpeza após login válido; os parâmetros de bloqueio do protótipo ainda requerem revisão. A [ADR-039](ADR-039-private-credential-change-recovery-proposal.md#implementação-e-gates-pendentes) aprovou troca autenticada e códigos offline pré-MVP, implementados localmente com revogação global. Em 2026-10-20, cookie, revogação e cache de identidade passaram por proxy HTTPS local e cache compartilhado simulado, conforme a [ADR-034](ADR-034-browser-api-origin-proposal.md#consequências-e-pendências). Naquele estágio, a API ainda não tinha membership, autorização financeira, recuperação por e-mail nem validação no proxy HTTPS de staging. A CI daquela mudança permanecia pendente; esses limites impediam declarar o gate completo.

**Atualização de estado em 2026-11-03:** a frase anterior sobre ausência de membership e autorização financeira descreve o estágio de 2026-10-20. As [ADRs 041–043](ADR-041-household-authorization-boundary-proposal.md#primeiro-recorte-aprovado) implementaram o acesso privado por household, e as [ADRs 046](ADR-046-first-financial-account-proposal.md#implementação-local-em-2026-11-03) e [047](ADR-047-first-manual-income-and-balance-proposal.md#implementação-local-em-2026-11-03) implementaram conta, receita manual e saldo localmente. Recuperação por e-mail, proxy HTTPS de staging e abertura externa continuam pendentes.

## Fontes técnicas consultadas

- [NestJS: autenticação e sessão no PostgreSQL com Drizzle](https://docs.nestjs.com/security/authentication) e [repositório do módulo](https://github.com/nestjs/authentication).
- [Better Auth: integração com NestJS](https://better-auth.com/docs/integrations/nestjs) e [adapter Drizzle](https://better-auth.com/docs/adapters/drizzle).
- [OWASP: gestão de sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) e [proteção CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Conceitos para estudo

Autenticação versus autorização, sessão opaca, cookie seguro, CSRF, revogação, store de sessão, recuperação de conta e custo operacional.
