# Como contribuir

1. Faça um fork ou receba convite como colaborador.
2. Crie uma branch: `git checkout -b minha-alteracao`.
3. Rode localmente: `npm install`, copie `.env.example` para `.env` e use `npm start` (detalhes no README).
4. Antes de enviar: `npm run verificar` (lint e testes) precisa passar.
5. Faça alterações pequenas e descreva o que mudou no pull request.
6. Leia `docs/ARQUITETURA.md` e `docs/TAREFAS.md` antes de propor mudanças maiores.

## Regras do projeto
- Conteúdo jurídico fica em `assets/data.js`. Toda referência normativa nova deve ser conferida na fonte e indicar a data.
- Nunca incluir dados pessoais, frase de recuperação, chave privada ou chaves de API no repositório.
- Exemplos continuam fictícios e identificados como tais.
- Não preencher automaticamente a validação humana nem a declaração de uso de IA.
- Texto digitado por alguém só entra na página pelo modelo `html` de `assets/js/html.js`, que faz o escape. Nada de `innerHTML` com texto montado à mão.
- Toda rota nova valida a entrada (`server/validacao.js`), confere o acesso ao grupo (`server/acesso.js`) e ganha teste.
- Cores, tamanhos e espaços saem de `assets/css/tokens.css`; sem estilos em linha (a política de segurança de conteúdo os bloqueia).
- Manter acessibilidade: botões reais, foco visível, alvos de toque de pelo menos 44 px.
