# Instruções do projeto

## Contexto e alcance

- Este diretório (`/home/vinicius/workspace/prumo/`) é a raiz do monorepo; `/home/vinicius/workspace/` pode conter outros projetos. `prumo-web/` e `prumo-api/` são diretórios internos, sem repositórios Git próprios. Execute comandos de cada aplicação no respectivo diretório.
- Prumo é uma plataforma de inteligência financeira doméstica. Leia apenas as seções relevantes de `PLANO_MESTRE_GESTAO_FINANCEIRA_DOMESTICA.md`, `PLANO_DE_ESTUDOS_APLICADO.md` e `CADERNO_DE_ESTUDOS_APLICADO.md` antes de propor mudanças de produto, domínio ou arquitetura.
- O Plano Mestre orienta produto e domínio; ADRs registram decisões arquiteturais; código e testes descrevem o comportamento implementado. Trate itens marcados `HIPÓTESE` ou `NÃO DEFINIDO` como pendentes; a stack base já foi decidida na ADR-030, mas opções específicas ainda podem estar abertas.

## Trabalho

- Respeite os limites de `prumo-web/` e `prumo-api/`. Para mudanças entre ambos, explicite o contrato e valide os dois lados.
- Antes de implementar regras financeiras, autenticação, isolamento de households ou uso de IA sobre dados, identifique a decisão existente ou apresente a pendência e uma proposta de ADR. Não decida esses pontos silenciosamente.
- Preserve as convenções presentes; use dependências locais e o gerenciador de pacotes adotado pelo projeto. Faça verificações direcionadas após alterações.
- A cada etapa concluída ou decisão tomada, atualize na mesma mudança a documentação correspondente (Plano Mestre, ADR, estudo ou guia operacional). Registre pendências como pendências, sem apresentá-las como decisões.
- Siga `docs/documentation/GUIA_DE_MANUTENCAO.md` para escolher a fonte principal, manter a organização das pastas, distinguir decisão de implementação e verificar links, âncoras e comandos alterados.
- Atualize somente os arquivos Markdown de documentação. Não gere nem altere PDFs, a menos que o usuário peça explicitamente.
- Use `docs/planning/PLANO_DE_DESENVOLVIMENTO.md` como quadro de execução: mantenha status, critério de aceite e próxima ação da sprint atualizados.
- Trabalhe somente neste projeto. Não acesse produção ou credenciais, não use `sudo` e peça aprovação antes de operações destrutivas de Docker ou mudanças em pacotes do sistema.

## Especialistas

O agente principal compreende a demanda, decide se delega, seleciona o especialista, avalia criticamente o resultado e integra a resposta final. Delegue apenas quando houver ganho real de investigação, independência ou execução; resolva tarefas triviais diretamente e não crie agentes só porque há vagas.

- Escolha pelo resultado pedido: evidências → `explorer`; análise ou proposta de ADR → `architect`; implementação → `developer`; revisão de mudança concluída → `reviewer`.
- Após implementar e testar uma mudança de risco relevante — regras financeiras, autenticação, autorização, isolamento de households, backend, banco/migrações ou DevOps — acione `reviewer` como etapa padrão antes de apresentar o trabalho como concluído. Para mudanças triviais, explique quando a revisão independente não agregar valor. O principal avalia os achados, corrige defeitos e repete a revisão das partes alteradas quando a correção for material; testes verdes não substituem essa revisão.
- Dê a cada subagente uma pergunta ou tarefa objetiva, contexto mínimo, limites e resultado esperado. Evite trabalho duplicado e edições concorrentes nos mesmos arquivos.
- Subagentes não ampliam o próprio escopo. Pedidos fora do papel voltam ao agente principal, que redistribui o trabalho. Decisões arquiteturais relevantes ficam visíveis para o usuário.
- Em assuntos relevantes de arquitetura, segurança, backend, banco ou DevOps, explique decisão, motivo, alternativas, trade-offs e conceitos para estudo posterior. Não esconda essas decisões atrás da implementação.
- Use as configurações nativas em `.codex/agents/` quando estiverem instaladas e validadas. Até lá, use os perfis transitórios em `agents/`; remova-os somente após validar os agentes nativos. Consulte `docs/collaboration/agents.md` para a arquitetura e o estado da migração.
