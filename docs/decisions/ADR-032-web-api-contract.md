# ADR-032: contrato entre web e API

- **Status:** aceito
- **Data:** 2026-10-13
- **Aprovação:** 2026-10-13

## Contexto

A ADR-030 separa `prumo-web/` (Next.js) de `prumo-api/` (NestJS), e a ADR-031 concentra persistência na API. O primeiro fluxo precisa expor valores em centavos de BRL (ADR-006), dias efetivos distintos de instantes de registro (ADRs 016/025), comandos idempotentes e revisão por versão (ADR-027), sem confiar no household indicado pelo cliente (ADR-029). O Plano Mestre ainda não definiu como publicar o contrato nem suas convenções HTTP.

Esta decisão define a fonte do contrato e um conjunto mínimo de convenções verificáveis. Não define rotas de negócio, autenticação, sessão, papéis, schema físico nem todos os erros do produto.

**Restrição de custo:** no início, a solução de contrato deve funcionar com software livre instalado no projeto e geração local, sem assinatura, conta de fornecedor, cobrança por requisição ou serviço externo obrigatório. O custo direto de licença e serviço de OpenAPI nesta decisão é zero. Tempo de desenvolvimento e recursos de máquina/CI continuam custos operacionais; hospedagem da aplicação será decidida separadamente.

## Alternativas

| Opção | Vantagem | Custo ou risco |
|---|---|---|
| Compartilhar DTOs TypeScript da API com a web | Poucos artefatos | Acopla a web ao código NestJS e tipos de compilação não descrevem sozinhos o JSON real. |
| Escrever OpenAPI à mão antes da implementação | Contrato revisável primeiro | Duas fontes de manutenção se controllers e validação divergirem; exige checagem contínua. |
| Gerar OpenAPI a partir da API e derivar tipos da web | Mantém a superfície HTTP publicada perto dos controllers e permite validar deriva | Exige documentação explícita dos DTOs, geração determinística e testes de conformidade; geração não prova comportamento em runtime. |

## Decisão

A **API NestJS gera um documento OpenAPI versionado no repositório** como fonte do contrato HTTP. No monorepo, uma tarefa local gera um artefato estável a partir do código da API e dele deriva os tipos usados pela web. `@nestjs/swagger` é uma opção livre para gerar o documento; `openapi-typescript` é uma opção livre para derivar tipos. O pacote gerador final e a forma exata do cliente HTTP serão fixados no bootstrap após verificar compatibilidade e licença; o contrato versionado não deve importar entidades Drizzle, tipos internos de domínio ou DTOs NestJS diretamente em `prumo-web/`. Uma alteração de rota, payload, status ou erro exige atualizar o documento e validar os dois lados na mesma mudança. O check local e, quando houver pipeline, a CI detectam geração desatualizada e validam, em testes de contrato, ao menos os casos críticos do primeiro fluxo. Servir uma página interativa de documentação ou contratar uma plataforma de gestão de APIs não é necessário para esse fluxo.

**Dinheiro.** Valores finais trafegam como objeto com `amountMinor` em **string decimal de inteiro assinado** e `currency: "BRL"`, por exemplo `{ "amountMinor": "-80", "currency": "BRL" }`. A unidade é centavo; o formato não usa ponto decimal, separador de milhar ou `Number` JSON. A API rejeita frações, moeda diferente e valores fora do limite definido quando o tipo SQL for escolhido. A web formata a quantia para exibição sem usar ponto flutuante binário nos cálculos. O limite máximo e o tipo SQL continuam pendentes da ADR-006 e da validação da ADR-031.

**Tempo.** Uma data civil efetiva trafega como `YYYY-MM-DD`, sem horário ou fuso presumido. Instantes técnicos de registro/auditoria, quando expostos, usam timestamp com offset explícito em formato RFC 3339; a API documenta sua normalização. Um campo de registro não substitui a data efetiva, e rótulos ambíguos de fontes importadas continuam em revisão conforme ADR-025. O fuso aplicável a regras de calendário futuras exige decisão própria.

**Comandos e revisões.** Operações financeiras mutáveis recebem uma chave opaca estável em `Idempotency-Key`, preservada pela web em retries da mesma intenção. Revisões enviam a versão esperada no payload, separada da chave. Repetir chave e conteúdo no mesmo contexto retorna a referência ou o resultado do pedido confirmado, depois de revalidar autorização atual; chave reutilizada com conteúdo diferente retorna conflito sem efeito. O contrato distingue pedido ainda pendente de falha definitiva. Formato, tamanho e retenção da chave serão especificados antes dos endpoints reais, sem enfraquecer a duração mínima da ADR-027.

**Erros e acesso.** Respostas de erro têm código estável legível por máquina, mensagem segura e `requestId` para correlação; detalhes de validação são estruturados e não contêm dados financeiros de outro household. `401` indica falta de autenticação válida; `403` indica ação proibida para um contexto autorizado conhecido; IDs de recursos fora do household autorizado são indistinguíveis de recurso inexistente para o cliente, com `404`. Conflito de chave ou versão usa `409`, com códigos distintos; erro de validação usa `400` ou `422` conforme a regra documentada do endpoint. `5xx` não revela detalhes internos. A implementação de autenticação, matriz de permissões e política de logs continuam pendentes.

O household informado pela web é apenas o seletor de contexto. A API verifica ator, membership e cada recurso conforme ADR-029, inclusive ao reproduzir resultado idempotente. O documento OpenAPI indica quais operações exigem autenticação e quais cabeçalhos são obrigatórios; o esquema de autenticação será incluído após sua ADR. Esta decisão não transforma contrato publicado em autorização implementada.

## Aceite e validação

- Gerar OpenAPI e tipos da web de modo reproduzível, sem dependência global, SaaS ou licença paga; uma mudança incompatível ou artefato desatualizado falha no check do monorepo.
- Comparar respostas reais de exemplos do primeiro fluxo com o documento: dinheiro assinado em centavos sem perda, datas civis preservadas, erros com código e `requestId`, chave de idempotência e versão esperada.
- Testar com households A/B que uma leitura por ID de B e um replay de chave sem permissão atual não retornam dados de B; erro e status não revelam existência ou valores.
- Manter um exemplo de contrato para transferência e retificação quando os endpoints forem desenhados, validando `prumo-web/` e `prumo-api/` juntos.

## Consequências e pendências

O contrato fica inspecionável fora do código NestJS, mas exige disciplina para não publicar uma especificação que diverge das respostas. Permanecem pendentes: rotas e paginação concretas, autenticação e sessão, política de versionamento compatível, estratégia de cliente HTTP, limites de valores/chaves, campos exatos de erros, instante/fuso de regras futuras e contratos das fases de cartão/importação. A próxima decisão da Sprint 2 deve tratar autenticação, sessão e autorização por ação antes do fluxo de identidade.

A especificação OpenAPI e os pacotes livres citados não exigem pagamento para este uso; a decisão evita SwaggerHub ou outro serviço hospedado. Se uma ferramenta futura trouxer cobrança obrigatória, ela exigirá nova análise de custo e decisão, sem entrar silenciosamente no bootstrap.

## Fontes técnicas consultadas

- [NestJS: geração de OpenAPI](https://docs.nestjs.com/openapi/introduction).
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) e [licença da especificação](https://github.com/OAI/OpenAPI-Specification/blob/main/LICENSE).
- Licenças MIT de [@nestjs/swagger](https://github.com/nestjs/swagger/blob/master/LICENSE) e [openapi-typescript](https://github.com/openapi-ts/openapi-typescript/blob/main/packages/openapi-typescript/LICENSE).
- [RFC 3339: representação de timestamps](https://www.rfc-editor.org/rfc/rfc3339.html) e [RFC 9110: semântica HTTP](https://www.rfc-editor.org/rfc/rfc9110.html).

## Conceitos para estudo

Contrato HTTP, geração de tipos, conformidade em runtime, compatibilidade, string decimal de inteiro, data civil versus instante, idempotência, erro seguro e autorização por recurso.
