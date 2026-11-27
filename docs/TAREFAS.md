# Lista de tarefas para a próxima etapa

Sugestão de ordem. Cada item pode virar uma *issue* no GitHub.

## Fundação
- [x] Escolher stack do back-end e hospedagem (decisão de quem implementa; registrar em `docs/DECISOES.md`).
- [x] Definir autenticação e perfis aluno, professor e admin (contas criadas pelo professor, sem cadastro aberto).
- [x] Criar banco de dados conforme o modelo de `ARQUITETURA.md` (seção 3).
- [x] Configurar variáveis de ambiente e `.env.example` (sem segredos no repositório).
- [ ] Definir política de privacidade, base legal e prazo de retenção (validar com o professor).

## Persistência (substituir "exportar arquivo" por salvar)
- [x] Salvar Anexo I (Comparação) por grupo.
- [x] Salvar Anexo II (transação) por grupo, com validação que rejeita frase de recuperação e chave privada.
- [x] Salvar checklists da Triagem, Publicidade e Skill por caso ou grupo.
- [x] Salvar notas da autoavaliação do Parecer.
- [x] Manter a exportação em CSV e TXT como opção.

## Diagnóstico com IA
- [x] Endpoint que recebe o texto arquivado do documento e executa as perguntas P1.1 a P4.2.
- [x] Módulo de IA generativa: perguntas P5.1 a P5.4.
- [x] Conferência automática do trecho literal contra o texto-fonte (marcar NÃO CONFERIDO quando não achar).
- [x] Cálculo do índice base (/30) e do subíndice (/12) no servidor.
- [x] Registro de ferramenta, versão, data e prompt de cada consulta.

## Documentos
- [ ] Geração do parecer (3 a 5 páginas) em Word e PDF nos dois formatos.
- [x] Apêndice técnico com os 7 itens exportado em TXT; validação humana e declaração de IA só marcáveis pelo grupo.
- [ ] Apêndice técnico em Word e PDF.

## Qualidade
- [x] Testes de unidade para o cálculo do índice, da média ponderada e da conferência de trecho.
- [ ] Teste de acessibilidade com leitor de tela real (VoiceOver, NVDA) nas telas. Contraste e semântica já revisados.
- [ ] Testes automatizados de interface (Playwright) e em Firefox e Safari.
- [ ] Aviso de conflito quando dois integrantes editam o mesmo campo ao mesmo tempo.
- [ ] Recuperação de senha por e-mail.
- [ ] Integração contínua (lint e testes) a cada push: o modelo está em `docs/ci-github-actions.yml`; basta copiá-lo para `.github/workflows/ci.yml`.
- [ ] Revisão jurídica do conteúdo de `assets/data.js` pelo professor antes de uso real.

## Antes de abrir para terceiros
- [ ] Definir licença (código e conteúdo) e incluir `LICENSE`.
- [ ] Incluir `CITATION.cff` e registrar no Zenodo, conforme a disciplina.
- [ ] Revisar aviso de conteúdo fictício e dados de exemplo.
