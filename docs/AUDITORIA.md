# Auditoria do repositório (v0.2) e o que mudou na v0.3

Verificação feita em 13/11/2026 sobre o commit `909c5fe` (protótipo v0.2), com dois roteiros:

- **ECC** (`affaan-m/ECC`, "everything-claude-code"): regras `rules/common` (segurança, estilo de código, testes, revisão) e `rules/web` (segurança, estilo, qualidade de design, desempenho, testes). Severidades do próprio ECC: CRÍTICO, ALTO, MÉDIO, BAIXO.
- **apple-design** (`dickwu/apple-design-skill`): revisão de interface baseada nas Human Interface Guidelines da Apple. Por ser um site, valem os princípios e os fundamentos (acessibilidade, cor, tipografia, layout, escrita), não as convenções de plataforma do iOS ou do macOS.

A coluna "Situação" diz o que foi feito na v0.3 (branch `persistencia-e-redesenho`).

## 1. Resumo

O protótipo v0.2 era pequeno, sem dependências e sem segredos, com bons cuidados de acessibilidade (link para pular ao conteúdo, foco restaurado após cada clique, alvos de 44 px). Não havia falha explorável **enquanto todo o conteúdo fosse estático**. Os problemas apareciam justamente no passo pedido agora: guardar o que as pessoas digitam. Sem escape de HTML, sem validação, sem servidor e sem testes, persistir dados naquela base criaria XSS armazenado e exposição de dados entre grupos.

Veredito pelo critério do ECC: **bloqueado para receber persistência** até resolver os itens ALTO; nenhum item CRÍTICO no estado estático.

## 2. Achados no código da v0.2

### Segurança

| # | Sev. | Achado | Onde | Situação na v0.3 |
|---|---|---|---|---|
| S1 | ALTO | Toda a página é montada com `innerHTML` e concatenação de texto sem escape. Só `chip`, `node` e `field` escapavam. Inofensivo com conteúdo fixo; vira XSS armazenado assim que o texto de um usuário é salvo e mostrado a outro. | `assets/app.js:25-47, 52-208` | Resolvido. `assets/js/html.js` escapa toda interpolação por padrão; teste no navegador com `<img onerror>` no nome do caso não cria elemento. |
| S2 | ALTO | Sem persistência nem servidor: nada do que o grupo preenche sobrevive a recarregar a página; não há autenticação nem separação entre grupos. | projeto inteiro | Resolvido. API Node.js + SQLite, login com perfis, isolamento por grupo testado. |
| S3 | MÉDIO | Sem Content-Security-Policy nem cabeçalhos de segurança (o GitHub Pages não permite configurá-los). | `index.html` | Resolvido. CSP `default-src 'self'` sem `unsafe-inline`, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS em produção. |
| S4 | MÉDIO | Fontes carregadas do Google Fonts: dependência de terceiro sem SRI e envio do IP de cada visitante ao Google, sem aviso (ponto sensível em um projeto sobre LGPD). | `index.html:8-10` | Resolvido. Fonte do sistema; nenhuma requisição a terceiros a partir do navegador. |
| S5 | MÉDIO | 85 atributos `style="..."` em linha impedem uma CSP estrita. | `assets/app.js` | Resolvido. Zero estilos em linha; tudo em classes. |
| S6 | MÉDIO | Exportação CSV não neutraliza células que começam com `=`, `+`, `-` ou `@` (injeção de fórmula em planilha) quando o texto vem do usuário. | `assets/app.js:36` | Resolvido. `Dominio.celulaCsvSegura`, com teste. |
| S7 | BAIXO | A regra "nunca registrar frase de recuperação ou chave privada" era só um aviso na tela; os campos do Anexo II aceitavam qualquer texto. | `assets/app.js:186-188` | Resolvido. Detecção no navegador (apaga o texto e explica) e rejeição no servidor, com testes. |
| S8 | OK | Nenhum segredo, chave ou dado pessoal real no repositório. | histórico completo | Mantido. `.env` fora do git; `.env.example` sem valores. |

### Qualidade de código

| # | Sev. | Achado | Onde | Situação na v0.3 |
|---|---|---|---|---|
| Q1 | ALTO | Nenhum teste automatizado, lint ou integração contínua. As regras de domínio (índice, média ponderada, conferência) não tinham verificação. | projeto inteiro | Resolvido. 88 testes (`node:test`), 98% de linhas cobertas no servidor e no domínio, ESLint. Modelo de GitHub Actions em `docs/ci-github-actions.yml`, ainda não ativado. |
| Q2 | MÉDIO | Arquivo único com 30 linhas acima de 300 caracteres (a maior com 1.000); cada tela é uma expressão só. Difícil de ler, revisar e comparar em diff. | `assets/app.js` | Resolvido. Um módulo por tela, nenhum arquivo acima de 300 linhas. |
| Q3 | MÉDIO | Nomes de uma letra para as estruturas centrais (`S`, `D`, `V`, `ACT`, `EXP`). | `assets/app.js:3-16, 230-249` | Resolvido. Nomes descritivos em português. |
| Q4 | MÉDIO | Estado global alterado no lugar (`S.x = ...`, `toggle`). | `assets/app.js:228-248` | Melhorado. Dados do grupo são trocados por cópias (`alterarPacote`, `alterarResposta`); só o estado de visualização é alterado no lugar. |
| Q5 | MÉDIO | Números fixos apresentados como se fossem calculados: "4,5 páginas" e "4 de 7 itens prontos" do apêndice. | `assets/app.js:123-124` | Resolvido. Páginas estimadas pelo texto do grupo; itens do apêndice refletem o que foi salvo. |
| Q6 | BAIXO | Variável morta `hoje = new Date('2026-11-12')`. | `assets/app.js:193` | Removida. |
| Q7 | BAIXO | Sem `package.json`, `.gitignore`, licença ou versão declarada. | raiz | Parcial. `package.json`, `.gitignore` e `.dockerignore` criados; **licença continua pendente** (decisão do grupo, ver `TAREFAS.md`). |
| Q8 | OK | Uso de `'use strict'`, IIFE, delegação de eventos e restauração de foco. | `assets/app.js` | Padrões mantidos na reescrita. |

### Interface (lentes do apple-design; onde não há citação, é julgamento do revisor)

| # | Sev. | Achado | Situação na v0.3 |
|---|---|---|---|
| D1 | ALTO | Borda dos controles (`#C9BCC0` sobre branco) com contraste de **1,84:1**, abaixo dos 3:1 exigidos para componentes de interface (WCAG 1.4.11). Campos e fichas quase somem para quem tem baixa visão. | Resolvido. Borda `#8E8E93`: 3,26:1 no claro e 5,22:1 no escuro. |
| D2 | ALTO | Sem aparência escura. `dark-mode.md` pede as duas aparências, seguindo o ajuste do sistema, sem interruptor próprio. | Resolvido. Tokens claros e escuros por `prefers-color-scheme`; todos os pares de texto medidos (mínimo 5,44:1). |
| D3 | MÉDIO | Checklists feitos com `<button aria-pressed>` e os caracteres ☑/☐. Leitor de tela anuncia "botão pressionado", não "caixa de seleção marcada". | Resolvido. `<input type="checkbox">` nativo, com a linha inteira como alvo. |
| D4 | MÉDIO | Quadro comparativo montado com `div` em grade: sem semântica de tabela, cabeçalhos não são associados às células. | Resolvido. `<table>` com `<caption>`, `scope="col"` e `scope="row"`. |
| D5 | MÉDIO | Navegação com nove pílulas no cabeçalho, que quebram em várias linhas e empurram o conteúdo. | Resolvido. Barra lateral em dois níveis no computador; faixa rolável no celular, com todas as seções alcançáveis. |
| D6 | MÉDIO | Cor de destaque usada para tudo: navegação ativa, borda de cartão, botão, citação e barra. `color.md`: uma cor, um significado. | Resolvido. Bordô reservado a ação principal, seleção e links; a régua de 0 a 3 tem cores próprias e sempre traz o número. |
| D7 | MÉDIO | Sem resposta a "reduzir movimento", "aumentar contraste" e "reduzir transparência". | Resolvido nas três preferências (`tokens.css`). |
| D8 | BAIXO | Duas famílias de fonte externas para um utilitário. | Resolvido. Fonte do sistema; texto em `rem`, acompanha o tamanho definido pelo usuário. |
| D9 | OK | Contraste de texto já era bom (mínimo medido: 6,26:1), alvos de 44 px, foco visível, link para pular ao conteúdo, `aria-current` na navegação. | Mantido. |

Contraste medido com a fórmula de luminância relativa da WCAG sobre os valores hexadecimais; os números da paleta nova estão comentados em `assets/css/tokens.css`.

## 3. Verificação da v0.3

| Verificação | Resultado |
|---|---|
| `npm run lint` (ESLint) | sem erros nem avisos |
| `npm test` | 88 testes, 0 falhas; cobertura de linhas 98,3%, de ramos 86,7% |
| Fluxo da triagem | link real de termos → cópia arquivada pela Wayback Machine → 14 perguntas respondidas pelo DeepSeek, todos os trechos conferidos → trilha leva ao parecer |
| Fluxo no navegador (Chromium, via Playwright) | entrada, troca da senha inicial, criação de grupo e conta, caso com exemplo, as 9 telas, sem erro de página |
| Persistência | prova marcada, descrição e validação humana continuam após recarregar |
| IA real (DeepSeek) | sugestão gravada, trecho conferido por código; ao trocar o trecho por texto inexistente, volta a NÃO CONFERIDO |
| XSS | nome de caso `<img src=x onerror=alert(1)>` é mostrado como texto |
| Segredo de carteira | frase de 12 palavras é apagada da tela e recusada pelo servidor |
| Responsivo | sem rolagem horizontal em 375 px e em 320 px |
| Aparência escura | conferida por captura de tela |

Não verificado: construção da imagem Docker nesta máquina (o Docker Desktop estava desligado), leitor de tela real (VoiceOver, NVDA), Firefox e Safari, e teste de carga.

## 4. Limites conhecidos da v0.3

- **Hash e chave privada têm o mesmo formato** (64 hexadecimais). O campo "código da transação" precisa aceitar esse formato, então uma chave colada ali não é distinguível por código. Os demais campos a recusam.
- **Edição simultânea**: se dois integrantes editam o mesmo campo ao mesmo tempo, vale a última gravação. Não há aviso de conflito.
- **Limite de requisições em memória**: serve a um processo só. Com mais de uma réplica, trocar por um armazenamento compartilhado.
- **IA**: o texto do documento é enviado ao DeepSeek (servidores fora do Brasil). Documentos acima de 120 mil caracteres são analisados só no início, e a tela avisa. A nota sugerida é ponto de partida; a conclusão é do grupo.
- **Sem recuperação de senha por e-mail**: quem esquece a senha pede outra ao professor.
- **Parecer em Word ou PDF** e **política de privacidade formal** continuam em `TAREFAS.md`.
