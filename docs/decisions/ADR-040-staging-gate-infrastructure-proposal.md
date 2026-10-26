# ADR-040: infraestrutura proposta para o gate de staging

- **Status:** proposta para revisão; nenhuma implantação ou contratação autorizada
- **Data:** 2026-10-20
- **Decisões relacionadas:** [ADR-034](ADR-034-browser-api-origin-proposal.md#decisão) define uma origem pública com `/api` no NestJS; [ADR-033](ADR-033-authentication-session.md#decisão) exige sessão revogável; o [roteiro da Sprint 3](../operations/BOOTSTRAP_SPRINT_3.md#preparação-do-gate-de-staging) descreve o gate ainda não executado

## Contexto e alcance

O commit `684c53d` tem CI verde conforme confirmação do usuário, e o teste local já percorre HTTPS, Next.js, NestJS e PostgreSQL com duas contas sintéticas e cache simulado. Falta validar a configuração de um proxy e de um cache **realmente implantados**. Hoje não existe ambiente de staging ou homologação. O usuário pediu somente a proposta e adiou qualquer implantação em homologação ou produção. Portanto, este documento não aprova fornecedor, despesa, domínio, exposição de rede, criação de contas ou uso de dados reais.

O gate futuro serve para verificar o caminho HTTP implantado; não representa autorização para usuários externos nem substitui os gates de autenticação, household e operação. Produção terá decisão própria. O Plano Mestre mantém infraestrutura cloud como `NÃO DEFINIDO`.

## Alternativas

| Opção | Benefício | Custo e limite | Adequação ao gate |
|---|---|---|---|
| Continuar só com o laboratório HTTPS local | Nenhuma hospedagem ou custo recorrente novo | O proxy e o cache de implantação não são exercitados | Mantém o desenvolvimento, mas não conclui o gate de staging |
| Um host Linux isolado e temporário com web, API, PostgreSQL de teste e proxy/cache | Uma origem pública, rede interna simples e janela de uso controlável | Operação de TLS, host, banco, backup quando necessário e descarte ficam com o projeto; um host é ponto único de falha | **Candidata preferida para um ensaio futuro e descartável**, após orçamento e revisão operacional |
| Web, API, banco e borda gerenciados | Serviços assumem parte da operação e permitem escalar separadamente | Mais contratos/configurações, custo possivelmente recorrente e maior esforço para preservar origem única e inspecionar cache | Reavaliar se a opção de um host não atender ao gate ou se houver necessidade operacional concreta |

A preferência é **apenas para o gate temporário**, não para produção. Um host único reduz o número de componentes externos para verificar a cadeia; seu risco de indisponibilidade e a administração manual não servem como decisão de arquitetura de produção. A documentação do [Next.js recomenda um proxy reverso para self-hosting](https://nextjs.org/docs/app/guides/self-hosting), e o [Docker Compose descreve o uso em staging e em um servidor](https://docs.docker.com/compose/how-tos/production/). Isso sustenta a viabilidade técnica da alternativa, sem provar que ela atende à operação ou ao orçamento do Prumo.

## Topologia candidata para revisão

```text
Navegador de teste -- HTTPS / uma origem --> proxy reverso + cache controlado
                                           |-- /api e /api/* --> NestJS
                                           `-- páginas e assets --> Next.js
Next.js -- rede interna --> NestJS -- role prumo_app --> PostgreSQL sintético
Migração -- role separada e execução pontual --> PostgreSQL sintético
```

No cenário de um host, contêineres/serviços de web, API e banco usariam rede privada e artefatos construídos a partir de um SHA fixo; só o proxy seria alcançável pelo navegador. Nginx é **candidato**, pois oferece roteamento e [controles explícitos de cache, bypass e não armazenamento](https://nginx.org/en/docs/http/ngx_http_proxy_module.html); a ferramenta e o processo de obtenção/renovação de certificado TLS ainda precisam de decisão. Não ativar cache genericamente por caminho. A política proposta permite cache compartilhado apenas para um recurso público sintético do ensaio; `/api/auth/*`, `/conta` (HTML e RSC), respostas com `Set-Cookie`, respostas com `private`/`no-store` e futuras rotas financeiras não entram no cache. O controle público precisa produzir `MISS` seguido de `HIT`; duas identidades e uma leitura anônima precisam permanecer sem armazenamento nem reutilização cruzada.

O proxy deve rotear `/api` sem alterar o prefixo aceito pelo NestJS, preservar método, corpo, `Origin`, cookies, status e cabeçalhos de resposta e substituir cabeçalhos `Forwarded`/`X-Forwarded-*` recebidos do cliente. A API só deve confiar no proxy autorizado e na origem pública configurada; `PRUMO_PUBLIC_ORIGIN` aponta para a URL HTTPS do ensaio e `PRUMO_API_INTERNAL_ORIGIN` para a API na rede interna. Revisar essas variáveis e o comportamento efetivo antes de publicar qualquer porta. Acesso ao ensaio deve ser restrito a operadores autorizados, com apenas contas sintéticas; o mecanismo concreto de restrição ainda será escolhido.

**Detalhe proposto para o limite de e-mail em 2026-10-26:** a [ADR-045 aprovou 30 pedidos em janela móvel exata de cinco minutos como contrato inicial de ensaio](ADR-045-verified-email-lifecycle-proposal.md#limites-por-origem-de-rede--parâmetro-de-ensaio-aprovado-em-2026-10-26), sem aprovar a topologia desta ADR. Neste desenho, uma única borda recebe a conexão externa e encaminha `/api` diretamente à API; o rewrite do Next.js continua no desenvolvimento local. O endereço visto no socket da borda é a chave candidata quando não há outro proxy confiável à frente. Se houver CDN ou balanceador, a cadeia de confiança deve ser redesenhada e testada antes de usar qualquer cabeçalho de IP. O `limit_req` nativo do Nginx aplica taxa média com rajadas e não cumpre o contrato aprovado; PostgreSQL com admissão interna foi escolhido depois para o ensaio local, sem definir a implantação. Conferir na implantação que a API não aceita conexão externa direta e que cabeçalhos encaminhados pelo cliente são descartados.

A [direção de contador com PostgreSQL e admissão interna](ADR-045-verified-email-lifecycle-proposal.md#contador-em-postgresql-para-o-ensaio-local--direção-aprovada-em-2026-10-26) foi aprovada para ensaio local, sem aprovar a implantação desta ADR. Ela exige que a borda aplique a admissão antes de ler o corpo ou encaminhar a requisição, preserve `403` legítimo da API ao traduzir a recusa interna em `429` e feche o acesso em falha do contador. O componente interno, a configuração do proxy, a política de segredos e a medição de carga dependem da escolha da topologia; não há limite por IP ativo hoje.

## Custo e operação a decidir antes de implantar

Registrar em uma revisão posterior: provedor/região, tamanho do host, duração da janela, armazenamento do banco/cache, tráfego, DNS/TLS, eventual backup, limites de cobrança, responsável pela operação e procedimento de desligamento. Estimar custo como **host × tempo + volumes/backup + tráfego + domínio/serviços**, com preços consultados no momento da escolha; esta ADR não afirma custo zero nem fixa valores sem fornecedor. Definir quem atualiza imagens e host, observa disponibilidade/erros, guarda e rotaciona segredos fora do Git, executa migração com role separada e confirma que o banco de teste pode ser descartado. Se o ensaio durar além da janela descartável, decidir retenção e testar restauração de backup antes de armazenar estado que precise ser preservado.

O comando atual `db:provision-user` é limitado ao PostgreSQL local. Um procedimento para criar e remover duas contas sintéticas no ambiente futuro exige revisão de segurança própria; não ampliar silenciosamente o comando existente. Nunca copiar credenciais ou dados de produção para o ensaio.

## Gates e evidência exigida

1. **Antes de criar recursos:** aprovar esta ADR ou sua revisão, escolher fornecedor e proxy/TLS, registrar orçamento máximo, duração, operador, acesso restrito, política de cache, dados sintéticos, segredos, migração, descarte e resposta a falhas. A decisão de gastar ou implantar será separada desta proposta.
2. **Antes do teste externo:** CI verde do SHA exato; build reproduzível de web/API; configuração não sensível versionada e revisada; URL HTTPS e certificado válidos; API e banco inacessíveis diretamente pela internet; contas sintéticas provisionadas por procedimento aprovado.
3. **No endereço implantado:** executar os casos do [roteiro operacional](../operations/BOOTSTRAP_SPRINT_3.md#preparação-do-gate-de-staging): login e cookie `__Host-sid`, CSRF/origem hostil, cabeçalhos forjados, identidade A/B/anônima em `/api/auth/me` e `/conta` HTML/RSC, revogação, troca e recuperação por código, `no-store` e controle `MISS`/`HIT` do cache público. Comparar resultado com a evidência local, sem imprimir segredos.
4. **Encerramento:** guardar SHA, versão não sensível da configuração, códigos HTTP, flags/cabeçalhos, contagens de cache e desvios; remover contas, banco e recursos conforme plano aprovado. Só marcar o gate de staging concluído após evidência do ambiente implantado. O resultado não libera produção ou usuários externos.

## Pendências e conceitos para estudo

Permanecem pendentes aprovação da topologia, fornecedor, proxy/TLS, custo, restrição de acesso, provisionamento sintético, segredos, backup/descarte e executor de smoke test. Uma eventual arquitetura de produção deverá comparar novamente host único e serviços gerenciados, incluindo disponibilidade, recuperação, observabilidade e proteção de dados.

Estudar: origem única, proxy reverso, terminação TLS, cabeçalhos confiáveis, cache compartilhado, redes privadas, migração com role separada, custo variável e restauração de backup.
