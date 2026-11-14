# Decisões de implementação (v0.3)

Registro pedido em `TAREFAS.md`. Cada decisão traz o motivo e o que ela custa.

| Decisão | Motivo | Custo |
|---|---|---|
| **Node.js 24 + Express 5**, CommonJS | Mesma linguagem do front; `assets/data.js` e `assets/dominio.js` são usados pelo navegador e pelo servidor sem cópia. | O GitHub Pages deixa de servir a aplicação (ele não executa servidor). Ali aparece um aviso com a instrução. |
| **SQLite pelo módulo nativo `node:sqlite`** | Um arquivo, sem serviço de banco e sem dependência compilada. Suficiente para uma disciplina. | Um processo por vez grava. Para várias turmas simultâneas, migrar para PostgreSQL (o SQL está concentrado em `server/rotas` e `server/casos-repositorio.js`). |
| **Sem etapa de build no front** (módulos ES nativos) | Mantém a regra do projeto: abrir, ler e alterar sem ferramenta. | Vários arquivos pequenos por carregamento; aceitável em HTTP/2. |
| **Dependências de produção: só `express` e `zod`** | Menos superfície de ataque. Senha com `scrypt`, sessão, CSRF, limite de requisições e cabeçalhos feitos com a biblioteca padrão. | Mais código próprio de segurança, coberto por testes. |
| **Sessão por cookie** `HttpOnly`, `SameSite=Strict`, `Secure`; no banco fica só o hash do token | O JavaScript da página nunca enxerga o token. | Sessão de 12 horas; depois disso é preciso entrar de novo. |
| **Sem cadastro aberto**: administrador e professor criam as contas; senha inicial gerada e mostrada uma vez | Segue `ARQUITETURA.md` (seção 6) e a escolha feita para esta etapa. | O professor entrega a senha por fora do sistema. |
| **Aluno só enxerga o próprio grupo**; recurso alheio responde 404 | Não revela nem a existência do dado de outro grupo. | — |
| **Validação humana e declaração de uso de IA só por integrante do grupo** | Regra de domínio: ninguém marca pelo grupo, nem professor, nem administrador, nem automatismo. | Professor não consegue corrigir uma marcação indevida; pede ao grupo. |
| **IA pelo DeepSeek**, só no servidor, uma pergunta por chamada | Chave fornecida para esta etapa; API compatível com a da OpenAI, trocável por variável de ambiente. | O texto do documento sai do servidor para o DeepSeek. Sem a chave, a IA fica desativada e o restante funciona. |
| **Conferência do trecho por código** (`Dominio.conferirTrecho`), nunca pelo modelo | `ARQUITETURA.md`, seção 5. Texto normalizado (caixa, aspas, espaços) e supressões `[...]` conferidas segmento a segmento. | Paráfrase fica como NÃO CONFERIDO, que é o comportamento desejado. |
| **Resposta do grupo só é trocada pela da IA com confirmação** | Evita que um clique apague o trabalho do grupo. | Um passo a mais na tela. |
| **Módulo da tela Publicidade se chama `influenciadores.js`** | Antivírus e bloqueadores de anúncio barram arquivos chamados `publicidade.js` (aconteceu no teste). | Nome do arquivo difere do nome da tela. |
| **Interface pelas Human Interface Guidelines** (via `dickwu/apple-design-skill`), com o bordô como destaque | Pedido desta etapa; preserva a identidade da UNICAP. | O bordô continua sendo aproximação; trocar em `assets/css/tokens.css` se houver manual de identidade. |
