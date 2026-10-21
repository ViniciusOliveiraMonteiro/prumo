# Arquitetura de subagentes

O agente principal entende a solicitação, decide se delegar traz benefício, fornece uma tarefa delimitada, confere o resultado e assume a decisão final. Nem toda tarefa passa pelos quatro especialistas.

| Papel | Entrega |
|---|---|
| `explorer` | Pesquisa direcionada com arquivos, fluxos e evidências. |
| `architect` | Alternativas, impactos, trade-offs, riscos e proposta de ADR quando necessária. |
| `developer` | Implementação delimitada, testes pertinentes e relato das mudanças. |
| `reviewer` | Revisão independente com achados concretos e lacunas de teste. |

```text
Usuário
  ↓
Agente principal
  ├── explorer  → evidências
  ├── architect → análise e proposta de ADR
  ├── developer → implementação e validação
  └── reviewer  → achados de revisão
  ↓
Agente principal → resposta e decisões visíveis ao usuário
```

Fluxos típicos:

- Investigação: principal → explorer → principal.
- Decisão arquitetural: principal → explorer, se necessário → architect → principal.
- Implementação de risco relevante: principal ou developer implementa e testa → reviewer faz leitura independente do diff → principal avalia e corrige os achados, repetindo a revisão das correções materiais → principal relata o resultado.
- Mudança trivial: principal resolve diretamente; a revisão por subagente é opcional quando não trouxer ganho concreto.
- Mudança arquitetural complexa: principal → explorer → architect → principal avalia a proposta → developer → reviewer → principal.

O `reviewer` é etapa padrão para regras financeiras, autenticação, autorização, isolamento de households, backend, banco/migrações e DevOps. Ele recebe a mudança delimitada, requisitos, evidência dos testes e pedido de achados por gravidade; atua em leitura e não aprova a própria implementação. O principal mantém a responsabilidade pela decisão final e registra defeitos corrigidos, risco residual e testes executados. Se o agente estiver indisponível, o principal faz a revisão possível e declara explicitamente que não houve revisão independente; não apresenta a etapa como cumprida.

`AGENTS.md` contém regras gerais do projeto e de orquestração. Os arquivos `.codex/agents/*.toml`, quando instalados, serão a única fonte de modelos, permissões solicitadas e instruções específicas de cada papel. Os arquivos `agents/*.md` são transitórios: preservá-los até confirmar a descoberta e o funcionamento dos quatro agentes nativos; depois removê-los. Não copiar os prompts TOML para esta documentação.

Há três camadas distintas:

| Camada | O que faz | Limite |
|---|---|---|
| Instrução por prompt | Define papel, entregáveis e quando devolver a tarefa ao principal. | O modelo pode descumpri-la; o principal precisa conferir. |
| Configuração nativa | Seleciona modelo, esforço, limite de concorrência e `sandbox_mode` dos especialistas. | Depende de carregamento pelo CLI e de acesso ao modelo. |
| Sandbox/runtime | Impõe acesso efetivo a arquivos e comandos. | A política da sessão principal e suas opções em tempo de execução continuam aplicáveis aos filhos; arquivos TOML não concedem acesso acima da política efetiva. |

O limite proposto é de três threads de subagentes abertas simultaneamente, além da thread principal. É um teto, não uma meta: uma tarefa simples fica com o principal. `explorer`, `architect` e `reviewer` pedem `read-only`; `developer` pede `workspace-write`. A sessão principal pode impor restrições adicionais ou reaplicar suas opções de sandbox, portanto o modo efetivo precisa ser conferido em uma execução real. Neste ambiente, a pasta `.codex` está protegida contra escrita inclusive para o `developer`; essa proteção vem do ambiente, não dos arquivos TOML.

O projeto usa os agentes também para aprender. Em mudanças relevantes de arquitetura, segurança, backend, banco ou DevOps, o principal deve tornar explícitos a decisão, o motivo, as alternativas, os trade-offs e os conceitos que merecem estudo. Uma proposta do `architect` não vira decisão aprovada só por ter sido escrita.

## Estado da migração

Em 2026-10-05, o CLI instalado era `0.160.0`, com `multi_agent` ativo e sem configuração de agentes neste projeto. Os modelos pedidos aparecem no catálogo incluído no CLI. O acesso da conta e o carregamento real dos quatro agentes ainda precisam ser validados depois que `.codex/config.toml` e `.codex/agents/*.toml` forem instalados manualmente. Não remover `agents/*.md` antes dessa validação.

Após a instalação, iniciar uma nova sessão do Codex na raiz do projeto e verificar: os quatro nomes reconhecidos; modelo e esforço selecionados; modo de sandbox efetivo; resposta curta do `explorer` ao localizar `AGENTS.md`; análise sem implementação do `architect`; revisão sem edição do `reviewer`; e capacidade de escrita do `developer` apenas quando houver uma tarefa real e segura. Conferir também o estado dos arquivos antes e depois dos testes. Se o projeto for marcado como não confiável pelo Codex, suas camadas locais de `.codex/` não serão carregadas.
