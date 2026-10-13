# ADR-035: organização de código da API e da web

- **Status:** aceito por orientação do usuário
- **Data:** 2026-10-13

## Contexto

O bootstrap cria as primeiras classes NestJS e componentes Next.js. O usuário exige código desacoplado e aderente a SOLID na API, com implementações substituíveis por interface, e separação de layout e lógica em hooks na web. A organização deve impedir classes ou funções que concentrem muitas responsabilidades sem acrescentar abstrações vazias a arquivos estáticos.

## Alternativas

| Opção | Ganho | Limite |
|---|---|---|
| Controllers e services diretos para tudo | Menos arquivos no início | Trocar integração externa ou persistência exige alterar consumidores e facilita acoplamento. |
| Interface e implementação para toda função | Substituição uniforme | Contratos triviais, sem variação real, aumentam navegação e manutenção. |
| Contratos nas fronteiras e hooks por unidade com lógica | Troca de adapters e responsabilidade localizada | Mais arquivos e disciplina de injeção, testes e revisão. |

## Decisão

Na API, organizar por módulo de capacidade. Controller traduz HTTP e chama aplicação; regras de domínio ficam em serviços ou funções focadas; persistência e integrações externas ficam atrás de contratos definidos pelo consumidor. Implementações concretas entram por injeção de dependência com token explícito do NestJS. Consumidores não importam diretamente adapters concretos. Trocar um provedor externo, cliente HTTP ou repositório deve exigir alteração do binding e da implementação, sem reescrever regras de domínio nem controllers. Contratos de resposta HTTP são separados de entidades de banco. A transação explícita e o contexto autorizado das ADRs 027/029/031 continuam atravessando toda operação financeira composta.

Na web, `page.tsx` e `layout.tsx` ficam enxutos e declarativos. Cada componente com lógica de estado, efeitos ou interação tem um hook dedicado em arquivo `use*.ts` ou `use*.tsx`; cada página com essa lógica tem seu próprio hook. O JSX de apresentação fica no `.tsx`, sem chamadas HTTP nem regras financeiras embutidas. Componentes puramente estáticos não criam hook vazio. Um Server Component não chama hooks de cliente: busca de dados no servidor fica em módulo de acesso dedicado, e interações vão para componente cliente com hook próprio. O cliente de API fica atrás de contrato próprio e recebe a implementação HTTP por composição, para facilitar sua troca e os testes. A API NestJS permanece a autoridade de domínio.

Classes e funções têm uma responsabilidade clara e tamanho revisável. Se crescerem para coordenar regras, HTTP, persistência e apresentação no mesmo lugar, separar responsabilidades antes de acrescentar mais caminhos. Testes focam contratos e comportamento observável, incluindo troca de adapter e limites entre households; não duplicam a implementação linha a linha.

## Verificação

- O módulo `health` do bootstrap usa porta e implementação injetada; seu teste confirma o resultado HTTP e permite trocar a implementação sem editar o controller.
- A página inicial estática mantém JSX no arquivo de página sem hook artificial. A primeira tela com interação deverá apresentar o par componente/hook e um teste significativo da lógica.
- Revisões de mudanças verificam dependências entre módulos, tamanho de funções/classes e ausência de import direto de infraestrutura no domínio.

## Conceitos para estudo

Inversão de dependência, interface como contrato, adapter, injeção de dependência, responsabilidade única, composição de componentes, Client/Server Components e hooks React.
