# ADR-038: limite de tentativas no login privado

- **Status:** aceito para PostgreSQL, contagem apenas de falhas e limpeza após login válido; parâmetros de bloqueio ainda propostos
- **Data:** 2026-10-16
- **Aprovação do princípio:** 2026-10-19; após comparar alternativas, o usuário pediu seguir a recomendação de contar falhas, limpar após login válido e estudar espera progressiva antes de fixar um bloqueio rígido
- **Decisão existente:** a [ADR-033](ADR-033-authentication-session.md#decisão) exige limite de tentativas antes do uso real

## Contexto

O login privado já verifica a senha com `@nestjs/authentication` e devolve erro genérico para e-mail conhecido ou desconhecido. Sem limite, tentativas repetidas podem adivinhar credenciais ou consumir CPU com verificações de hash. O threat model registra o risco em TM-31. A API pode ter mais de uma instância, então um contador apenas em memória não manteria um orçamento comum. A origem e a cadeia de proxies ainda não estão definidas para confiar em um IP de cliente.

## Alternativas e proposta

| Opção | Benefício | Custo ou limite |
|---|---|---|
| Contador em memória por processo | Simples | Reinício e múltiplas instâncias zeram ou dividem o limite. |
| Redis distribuído | Operações rápidas e expiração nativa | Introduz outro serviço e custo antes de uma demanda medida. |
| PostgreSQL por e-mail normalizado | Usa o banco existente e uma atualização atômica entre instâncias | Uma escrita e uma limpeza indexada por falha; não limita pulverização entre muitos e-mails. |

**Decisão para o primeiro acesso privado:** usar PostgreSQL e contar somente falhas de senha por e-mail normalizado, inclusive para conta inexistente. Um login válido limpa a contagem desse e-mail. Não usar IP como chave de segurança até definir a cadeia de proxies confiáveis. Estudar espera progressiva antes de fixar os parâmetros de bloqueio para uso real.

**Parâmetros provisórios do protótipo:** até **10 falhas por e-mail em uma janela fixa de 15 minutos**. Após dez falhas, a tentativa seguinte recebe `429`, `Retry-After` em segundos e `Cache-Control: no-store`, mesmo se a senha for correta. A janela não se estende ao atingir o limite. Antes de verificar a senha, a API consulta o limite para evitar trabalho de hash quando já bloqueado. Após senha inválida, um `INSERT ... ON CONFLICT DO UPDATE` atômico registra a falha; em uma corrida, apenas as primeiras dez falhas recebem `401`. Falha do banco impede o login. Os números e o bloqueio rígido ainda requerem revisão antes de uso real.

O banco guarda SHA-256 do e-mail normalizado como chave do contador, sem senha, IP ou corpo da requisição. Esse hash é um pseudônimo sujeito a tentativa de dicionário, não anonimização. Uma exclusão indexada remove linhas com início de janela anterior a 24 horas a cada falha; sem falhas novas, a limpeza espera a próxima. O limite é igual para conta conhecida e desconhecida, para que o status não revele existência da conta.

## Implementação e verificação local

`0004_sign_in_attempts.sql` cria a tabela e o índice; `db:prepare-app` concede à `prumo_app` apenas as operações necessárias. `SignInAttemptsService` consulta o bloqueio, registra falhas atomicamente e limpa o contador após senha válida; o contrato OpenAPI inclui `429`. A role migradora aplica migrações; a API usa a role restrita. Os E2E locais verificam contas existentes e inexistentes, `Retry-After`, recuperação da janela, limpeza no sucesso, 20 falhas concorrentes e remoção de contador antigo; o teste de banco verifica os grants.

## Espera progressiva em estudo

Uma alternativa ao bloqueio fixo é devolver atrasos curtos após falhas sucessivas, com teto definido. O atraso deve ser aplicado pelo banco ou por resposta `Retry-After`, sem manter uma requisição dormindo na API. A escolha precisa comparar o número de senhas que um atacante consegue testar, o tempo de espera imposto ao titular sob ataque e o custo de rajadas paralelas. A mesma resposta deve valer para e-mail conhecido e desconhecido. Antes de substituir o limiar provisório, especificar a progressão, o teto, a janela, o reset após sucesso e testes de concorrência e recuperação. Esses valores ainda não estão aprovados.

## Limites e gates

- Um atacante pode consumir o orçamento de uma conta e impedir temporariamente seu login. A janela limita a duração; a alternativa de espera progressiva deve ser estudada antes de fixar bloqueio e números para uso real.
- A consulta anterior ao hash evita trabalho quando a conta já está bloqueada, mas uma rajada simultânea ainda pode iniciar várias verificações de senha antes de registrar as falhas. A atualização atômica preserva o limite de respostas `401`; monitorar esse custo em testes de carga antes de uso externo.
- O limite por e-mail não impede pulverização entre muitos e-mails. Definir IP confiável na topologia de proxy antes de introduzir um segundo limite; não usar `X-Forwarded-For` enviado diretamente pelo cliente como identidade confiável.
- Monitoramento agregado de rejeições, limpeza operacional independente de novos logins, troca e recuperação de credencial, HTTPS/proxy/cache e revisão de valores ainda são pendentes antes de usuários externos. Não registrar e-mail, senha ou hash do assunto em logs de abuso.
- O princípio de contar falhas e limpar após sucesso foi aprovado. Os parâmetros de bloqueio são provisórios e o comportamento está validado apenas localmente; a política para uso real ainda deve ser registrada.

## Conceitos para estudo

Janela fixa versus janela deslizante, atualização atômica, limite distribuído, IP confiável atrás de proxy, pseudonimização, negação de serviço por bloqueio de conta e `Retry-After`.

## Referências

- [Plano de Estudos, SEC-010](../../CADERNO_DE_ESTUDOS_APLICADO.md#sec-010---rate-limiting-quotas-e-abuso).
- [Threat model, TM-31](../security/threat-model.md#ameaças-controles-candidatos-e-evidência-exigida).
- [ADR-033: autenticação](ADR-033-authentication-session.md#aceite-e-validação-antes-de-dados-financeiros-reais).
