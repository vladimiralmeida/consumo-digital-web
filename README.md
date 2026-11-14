# Consumo Digital · v0.3

Interface para a skill **Consumo Digital Diagnóstico** (disciplina Relações de Consumo e Novas Tecnologias, PPGDI-UNICAP): triagem do caso, diagnóstico da opacidade de termos de uso, comparação de provedores de IA generativa, parecer e apêndice técnico.

O trabalho segue uma trilha de cinco etapas ligadas (caso, termos de uso, análise, conferência, parecer), visível no topo das telas do caso, com o próximo passo indicado no fim de cada uma. Na triagem, o grupo informa o link dos termos, o sistema busca a cópia arquivada na Wayback Machine e a IA responde as 14 perguntas do protocolo.

A partir da v0.3 a aplicação tem **servidor e banco de dados**: o que cada grupo preenche fica salvo, o acesso é por conta e senha, e o diagnóstico pode receber sugestões de IA. A v0.2 era um site estático que perdia tudo ao recarregar.

Os exemplos que acompanham o sistema são fictícios e identificados como tais. Não registre dados pessoais de terceiros, frase de recuperação nem chave privada.

## Telas

Triagem do caso · Diagnóstico da Opacidade (com módulo de IA generativa) · Comparação de provedores (Anexo I) · Parecer e apêndice · Agente de IA · Publicidade · Dados · Ativos digitais (Anexo II) · Skill v0.2 e entregas · Contas e grupos (professor e administrador).

## Rodar localmente

Requer Node.js 22.13 ou mais novo (testado no 24).

```bash
npm install
cp .env.example .env      # preencha ADMIN_EMAIL e ADMIN_SENHA; para http://localhost use COOKIE_SECURE=false
npm start                 # http://localhost:3000
```

Na primeira partida o servidor cria o administrador com `ADMIN_EMAIL` e `ADMIN_SENHA`. No primeiro acesso ele é obrigado a trocar a senha. Depois: **Contas e grupos** → criar os grupos → criar as contas. Cada conta nasce com uma senha inicial, mostrada uma única vez.

Com Docker: `docker compose up --build` (o banco fica no volume `consumo-digital-dados`).

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `PORT` | Porta HTTP (padrão 3000). |
| `DATABASE_PATH` | Arquivo do SQLite. Em contêiner, aponte para um volume. |
| `ADMIN_EMAIL`, `ADMIN_SENHA`, `ADMIN_NOME` | Administrador inicial. Só são usadas quando o banco não tem administrador. |
| `COOKIE_SECURE` | `true` em produção (HTTPS). `false` só para testar em `http://localhost`. |
| `TRUST_PROXY` | Número de proxies à frente do servidor (1 atrás do Traefik do Dokploy). |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL` | Diagnóstico com IA. Sem a chave, a IA fica desativada e o restante funciona. |

Nenhum segredo vai para o repositório: `.env` está no `.gitignore`.

## Perfis

- **Aluno**: vê e edita só os dados do próprio grupo. Só integrante do grupo marca a validação humana e a declaração de uso de IA.
- **Professor**: vê todos os grupos, cria grupos e contas de aluno.
- **Administrador**: tudo o que o professor faz, mais contas de professor e de administrador.

## Verificar

```bash
npm run lint       # ESLint
npm test           # 84 testes com cobertura (node:test)
npm run verificar  # os dois
```

## Publicar

A aplicação precisa de um servidor; o **GitHub Pages não a executa** (ali aparece um aviso explicando). O `Dockerfile` gera uma imagem pronta para qualquer hospedagem de contêiner. Monte um volume em `/data`, defina as variáveis acima e coloque HTTPS na frente.

Antes de publicar para uso real:
- Confira as referências normativas e as datas nas fontes oficiais (lista em `docs/ARQUITETURA.md`, seção 8).
- Defina com o professor a política de privacidade, a base legal e o prazo de descarte dos dados (LGPD).
- Avise os grupos de que o texto colado para o diagnóstico com IA é enviado ao serviço de IA.
- Defina a licença e a forma de citar.

## Estrutura

```
index.html
assets/
  data.js            conteúdo jurídico e exemplos (usado no navegador e no servidor)
  dominio.js         regras de cálculo: índice, média, conferência de trecho, segredos de carteira
  css/               tokens.css (cores, tipos, medidas), base.css, componentes.css
  js/                main.js, estado, salvamento automático, API, fluxo.js (trilha), analise.js (IA e arquivo)
  js/telas/          um módulo por tela
server/
  index.js, app.js   partida e montagem da aplicação
  db.js              SQLite e migrações
  auth.js            senha, sessão, perfis, CSRF
  seguranca.js       cabeçalhos e limite de requisições
  validacao.js       esquemas de entrada (zod)
  rotas/             autenticação, administração, casos, dados do grupo, IA
  ia/deepseek.js     chamada ao modelo
  arquivo.js         busca da cópia arquivada na Wayback Machine
test/                testes de domínio e da API
docs/                arquitetura, decisões, auditoria e tarefas
```

## Documentação

- `docs/AUDITORIA.md`: verificação da v0.2 (boas práticas do ECC e revisão de interface) e o que mudou.
- `docs/DECISOES.md`: escolhas de implementação e seus custos.
- `docs/ARQUITETURA.md`: modelo de dados, API e regras de domínio.
- `docs/TAREFAS.md`: o que foi feito e o que falta.
- `CONTRIBUTING.md`: como contribuir.
