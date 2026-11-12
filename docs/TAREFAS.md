# Lista de tarefas para a próxima etapa

Sugestão de ordem. Cada item pode virar uma *issue* no GitHub.

## Fundação
- [ ] Escolher stack do back-end e hospedagem (decisão de quem implementa; registrar em `docs/DECISOES.md`).
- [ ] Definir autenticação (convite do professor) e perfis aluno, professor e admin.
- [ ] Criar banco de dados conforme o modelo de `ARQUITETURA.md` (seção 3).
- [ ] Configurar variáveis de ambiente e `.env.example` (sem segredos no repositório).
- [ ] Definir política de privacidade, base legal e prazo de retenção (validar com o professor).

## Persistência (substituir "exportar arquivo" por salvar)
- [ ] Salvar Anexo I (Comparação) por grupo.
- [ ] Salvar Anexo II (transação) por grupo, com validação que rejeita frase de recuperação e chave privada.
- [ ] Salvar checklists da Triagem, Publicidade e Skill por caso ou grupo.
- [ ] Salvar notas da autoavaliação do Parecer.
- [ ] Manter a exportação em CSV e TXT como opção.

## Diagnóstico com IA
- [ ] Endpoint que recebe o texto arquivado do documento e executa as perguntas P1.1 a P4.2.
- [ ] Módulo de IA generativa: perguntas P5.1 a P5.4.
- [ ] Conferência automática do trecho literal contra o texto-fonte (marcar NÃO CONFERIDO quando não achar).
- [ ] Cálculo do índice base (/30) e do subíndice (/12) no servidor.
- [ ] Registro de ferramenta, versão, data e prompt de cada consulta.

## Documentos
- [ ] Geração do parecer (3 a 5 páginas) em Word e PDF nos dois formatos.
- [ ] Geração do apêndice técnico com os 7 itens; validação humana e declaração de IA só marcáveis pelo grupo.

## Qualidade
- [ ] Testes de unidade para o cálculo do índice, da média ponderada e da conferência de trecho.
- [ ] Teste de acessibilidade (teclado, leitor de tela, contraste) nas 9 telas.
- [ ] Integração contínua simples (lint e testes) a cada push.
- [ ] Revisão jurídica do conteúdo de `assets/data.js` pelo professor antes de uso real.

## Antes de abrir para terceiros
- [ ] Definir licença (código e conteúdo) e incluir `LICENSE`.
- [ ] Incluir `CITATION.cff` e registrar no Zenodo, conforme a disciplina.
- [ ] Revisar aviso de conteúdo fictício e dados de exemplo.
