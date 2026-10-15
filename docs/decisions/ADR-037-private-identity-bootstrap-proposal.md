# ADR-037: esquema mínimo de identidade para o primeiro acesso privado

- **Status:** aceito para o primeiro acesso privado; gates de segurança e operação ainda pendentes
- **Data:** 2026-10-15
- **Escolha registrada:** em 2026-10-15, o usuário preferiu comando local para criar a primeira conta privada, sem convite por e-mail nesta etapa
- **Aprovação:** em 2026-10-15, o usuário aprovou o esquema mínimo separado dos dados de household, a role restrita e sua implementação

## Contexto

A [ADR-033](ADR-033-authentication-session.md#decisão) aceita o NestJS como autoridade de identidade e sessões revogáveis em PostgreSQL, mas deixa tabelas e provisionamento pendentes. A [ADR-034](ADR-034-browser-api-origin-proposal.md#decisão) reserva `/api` para a API na mesma origem do navegador. O laboratório de `SessionStore` passou com PostgreSQL e Drizzle, porém cria apenas um schema descartável de teste. Ainda não existem usuário, membership ou fluxo de login no produto.

O Plano Mestre define User, Household e Membership conceitualmente, e a [ADR-029](ADR-029-first-flow-household-isolation.md#decisão-para-o-primeiro-fluxo) exige autorização atual por operação financeira. Esta proposta cobre só identidade e sessão do primeiro acesso privado. Ela não concede acesso a dados de household.

## Alternativas

| Opção | Vantagem | Custo e limite |
|---|---|---|
| Criar usuários, memberships e permissões juntos | Fluxo de produto completo mais cedo | Decide a matriz de papéis e o esquema financeiro antes do estudo necessário. |
| Criar identidade e sessão mínimas primeiro | Permite validar cookie, revogação e rewrite sem dados financeiros | Exige uma segunda migração para household e autorização; login não prova isolamento A/B. |
| Continuar apenas com o schema descartável | Nenhuma migração nova | Não valida integração durável, reinício da API nem separação de roles. |

**Decisão:** segunda opção. A API poderá identificar um usuário, mas nenhuma rota financeira será adicionada até existir membership e autorização por ação.

## Modelo e fluxo propostos

- Criar `identity.users` com UUID gerado no servidor, e-mail ASCII com índice único sobre forma normalizada (`trim` e minúsculas), hash de senha produzido pelo `PasswordHasher` da biblioteca, estado ativo/inativo e datas de criação/alteração. Não guardar senha em claro nem incluir hash em respostas, sessão ou logs. A restrição ASCII evita divergência entre a normalização do Node e `lower()` do PostgreSQL neste primeiro fluxo; endereços internacionais exigem revisão.
- Criar `identity.sessions` para o contrato `SessionStore`: ID com hash do token em Base64URL, `user_id` com FK para usuário, criação, expiração absoluta, última atividade, estado MFA opcional e metadados mínimos. Índices por usuário e expiração. A tabela de sessão não armazena membership, permissão nem cópia duradoura do usuário. Exigir leitura atual do usuário a cada validação; usuário desativado perde acesso, mesmo com cookie ainda presente.
- A role migradora cria e possui o schema; uma role de aplicação separada recebe só os privilégios necessários. A API usa a role restrita para o fluxo comum. Definir criação, rotação e distribuição local dessas credenciais sem registrá-las no Git. RLS em dados financeiros continua sujeito à ADR-036; uma sessão de identidade não é contexto autorizado de household.
- Registrar o store PostgreSQL/Drizzle no `AuthenticationModule` e fazer a aplicação falhar na inicialização se o banco não estiver disponível, inclusive em desenvolvimento e teste de integração. Não aceitar fallback em memória para sessões usadas pela API.
- Expor inicialmente login, identidade corrente, logout atual e logout global sob `/api/auth`; respostas de identidade e sessão usam `Cache-Control: no-store`. Os corpos e códigos exatos entram no contrato OpenAPI da ADR-032. Não haverá cadastro público.
- Criar a primeira conta por comando local da API, executado por operador com acesso ao banco de desenvolvimento: recebe e-mail como argumento, pede senha em prompt sem eco, usa `PasswordHasher` e grava apenas o hash. Não aceitar senha por argumento, arquivo versionado ou variável de ambiente, nem imprimir hash, sessão ou credenciais. Falhar para e-mail existente. A criação de outras contas e a recuperação de senha exigirão decisão operacional posterior; esse comando não expõe endpoint público.
- Usar cookie host-only, `HttpOnly`, `SameSite=Lax` e `Secure` no host seguro, com `__Host-` quando suas condições forem satisfeitas. Manter a proteção de origem da API para mutações e testar `Set-Cookie`, `Cookie`, `Origin`, status e `Cache-Control` pelo rewrite. Validar separadamente as flags em HTTPS; o ambiente HTTP local não demonstra o proxy de produção.

## Gates de aceite antes de autenticação pronta

1. Versionar migração SQL e modelo Drizzle equivalentes, sem introduzir membership fictícia; validar o comando de provisionamento no banco local com conta descartável.
2. Reexecutar o contrato oficial de `SessionStore` contra as tabelas migradas e a role da aplicação, inclusive concorrência, revogação e reinício da conexão; recusar startup sem banco/store.
3. Demonstrar login, cookie, expiração, logout atual/global, desativação do usuário e falha fechada. Senha errada e e-mail desconhecido não revelam a existência da conta; limitar tentativas antes de uso real.
4. Testar o caminho completo pelo rewrite da web e a proteção de origem/CSRF, inclusive respostas de erro, redirecionamento se houver, cache e ausência de token nos logs. Repetir com HTTPS/proxy em staging antes de usuários externos.
5. Antes de qualquer rota financeira, decidir e testar schema de household/membership, autorização atual por ação e passagem de contexto à transação conforme ADR-029/036. Sessão válida sozinha não satisfaz esse gate.

## Pendências e conceitos para estudo

**Implementação e evidência local em 2026-10-15:** `0002_identity.sql` cria users e sessions; `0003_session_hash_encoding.sql` corrige a constraint do ID após o E2E revelar que a biblioteca usa Base64URL, preservando o checksum da migração já aplicada. O modelo Drizzle e `DrizzleSessionStore` foram ligados ao módulo da API. `db:prepare-app` cria a role local `prumo_app` sem owner, superuser ou `BYPASSRLS`; `db:provision-user` recebeu uma senha em prompt sem eco e criou uma conta descartável, depois removida. A API falha na inicialização sem `PRUMO_APP_DATABASE_URL`, role esperada ou tabela de identidade. Os E2E diretos passaram para login, cookie, logout atual e global, origem hostil e usuário desativado; a suíte de banco verificou grants da role. Pelo rewrite local, login, identidade corrente, logout e revogação retornaram respectivamente `200`, `200`, `204` e `401`; origem hostil retornou `403`. O cookie preservou `__Host-sid`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` e ausência de `Domain`; a resposta teve `Cache-Control: no-store`. São testes locais em HTTP/localhost, não prova de proxy HTTPS/staging. A CI desta mudança ainda não foi conferida.

**Pendências:** política de troca de credencial, retenção/limpeza de sessões expiradas, limite de tentativas, recuperação de conta, matriz de papéis, HTTPS/staging, contas adicionais e contrato completo de erros. A CLI aceita senha de 12 a 1024 caracteres; a política final para usuários externos segue pendente. O contrato oficial de `SessionStore` passou no laboratório descartável; repetí-lo nas tabelas migradas e com a role da aplicação ainda é um gate. Nenhuma autorização de household foi implementada.

Estudar: token opaco versus seu hash persistido, FK e revogação em cascata, índice único normalizado, role migradora versus role de aplicação, expiração absoluta versus por inatividade e cache de resposta autenticada.

## Referências

- [NestJS: autenticação e contrato de store](https://docs.nestjs.com/security/authentication).
- [NestJS: hashing de senha](https://docs.nestjs.com/security/encryption-and-hashing).
- [ADR-031: banco e migrações](ADR-031-postgresql-access-transactions.md).
- [ADR-036: RLS proposto](ADR-036-row-level-security-proposal.md).
