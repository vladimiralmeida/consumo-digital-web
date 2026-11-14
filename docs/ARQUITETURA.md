# Arquitetura

Estado atual (v0.3): front-end sem etapa de build, servidor Node.js (Express) e banco SQLite. O conteúdo jurídico e os exemplos fictícios continuam em `assets/data.js`. As escolhas e seus custos estão em `DECISOES.md`.

## 1. Estado atual

| Parte | Papel |
|---|---|
| `index.html` | Esqueleto: carrega os estilos, `data.js`, `dominio.js` e o módulo `assets/js/main.js`. |
| `assets/data.js` | Objeto `DATA` com o conteúdo: tipos de problema, 14 dimensões, provedores de exemplo, atores, checklists, entregas. Usado pelo navegador e pelo servidor. |
| `assets/dominio.js` | Regras puras: índice, média ponderada, conferência de trecho, detecção de segredo de carteira. Usado pelos dois lados e coberto por testes. |
| `assets/js/main.js` | Barra, menu lateral, roteador por hash (`#/rota`) e delegação de eventos. |
| `assets/js/telas/*.js` | Um módulo por tela: `render()`, `acoes` (cliques, `data-a`), `mudancas` (caixas e seletores, `data-m`), `campos` (digitação, `data-c`), `formularios` (`data-f`) e `regioes` (áreas calculadas, `data-regiao`). |
| `assets/js/html.js` | Modelo etiquetado `html` que escapa toda interpolação. Texto de usuário nunca vira marcação. |
| `assets/js/salvar.js`, `gravar.js` | Salvamento automático: digitação é gravada após uma pausa; cliques, na hora. A situação aparece na barra. |
| `server/` | API REST em JSON, sessão por cookie, validação com zod, SQLite (`node:sqlite`). |

Fluxo de tela: clique → `acoes[nome]` altera o estado e grava → redesenho completo com o foco restaurado. Digitação → `campos[nome]` altera o estado e agenda a gravação → só as regiões calculadas são redesenhadas, para o cursor não sair do campo.

Rotas de tela: `triagem`, `diagnostico`, `comparacao`, `parecer`, `agente`, `publicidade`, `dados`, `ativos`, `skill`, `contas` (professor e administrador), `conta`.

## 2. Regras de domínio que o código já embute

- **Índice de opacidade:** soma das notas (0 a 3) das 10 dimensões base (eixos A a D) dividida por 30. As 4 dimensões do eixo E (IA generativa, P5.1 a P5.4) formam um subíndice de 0 a 12 e **não entram** no índice, para manter a comparabilidade com a v0.1.
- **Conferência da transcrição:** cada dimensão tem `ok`: `true` (conferido no texto-fonte), `false` (NÃO CONFERIDO) ou `null` (descritivo). Trecho NÃO CONFERIDO não pode ser usado antes da checagem humana.
- **Validação humana e declaração de uso de IA** só podem ser marcadas pelo grupo. Nenhum automatismo deve preenchê-las.
- **Rastreabilidade:** cada cláusula citada leva link original, link arquivado (Wayback Machine) e data de acesso.
- **Segurança:** o sistema nunca pede, recebe ou grava frase de recuperação ou chave privada de carteira, nem dados pessoais do usuário.
- **Média ponderada da rubrica:** pesos 2,5 / 3,0 / 2,0 / 1,5 / 1,0 (soma 10).

## 3. Modelo de dados (implementado em `server/db.js`)

```
grupos(id, nome, turma, divergencia_destacada, higiene, passos_ativos, criado_em)
usuarios(id, nome, email, senha_hash, papel[aluno|professor|admin], grupo_id, deve_trocar_senha, ativo, criado_em)
sessoes(token_hash, usuario_id, csrf, expira_em)
casos(id, grupo_id, titulo, tipo, descricao_curta, provas, checklist_publicidade, criado_em, atualizado_em)
diagnosticos(caso_id, plataforma, documento_url, link_arquivado, data_acesso, texto_fonte,
             ferramenta_ia, versao_modelo, data_criacao, prompt_usado, atualizado_em)
respostas(caso_id, dimensao[1..14], pergunta_id, nota[0..3], trecho_literal,
          conferido[1|0|NULL], resumo, por_que, origem[grupo|ia], atualizado_em)
consultas_ia(id, caso_id, dimensao, pergunta_id, usuario_id, ferramenta, modelo, prompt, resposta, criado_em)
pareceres(caso_id, formato, texto, validado_humano, validado_por, validado_em,
          declaracao_ia, declarado_por, declarado_em, notas, atualizado_em)
comparacoes(id, grupo_id, provedor_ordem, provedor_nome, dimensao, nota, texto)
transacoes(id, grupo_id, integrante, rede, endereco_origem, endereco_destino, hash, data_hora, link_explorador, obs, criado_em)
```

Observações:
- Um caso tem um diagnóstico e um parecer. Apagar o caso apaga os dois, as respostas e as consultas.
- `transacoes` guarda **apenas endereços públicos e hash**. O servidor rejeita valor com formato de frase de recuperação (12 ou mais palavras em sequência) ou de chave privada (64 hexadecimais ou WIF). No campo `hash` o formato de 64 hexadecimais é aceito, porque é o do próprio código da transação.
- Listas de itens marcados (provas, checklists) são vetores de índices em JSON, validados na entrada.
- Mudanças de esquema entram como nova posição em `MIGRACOES`; a versão fica em `PRAGMA user_version`.
- Para dados pessoais (nome e e-mail das contas), aplicar minimização e prazo de retenção (LGPD, arts. 6º e 16).

## 4. API (REST, JSON)

Toda rota fora de `/api/auth` exige sessão. Toda alteração exige `Content-Type: application/json` e o cabeçalho `X-CSRF-Token`.

| Método e rota | Função |
|---|---|
| `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/senha` | Sessão e troca de senha |
| `GET /api/grupos` · `POST /api/grupos` · `PUT /api/grupos/:id` | Grupos (criar e editar: professor e administrador) |
| `GET /api/usuarios` · `POST /api/usuarios` · `PATCH /api/usuarios/:id` | Contas (professor e administrador); devolve a senha inicial uma única vez |
| `GET /api/casos?grupo_id=` · `POST /api/casos` · `GET`, `PATCH`, `DELETE /api/casos/:id` | Casos e triagem; `GET` devolve diagnóstico, respostas, índice, parecer e consultas |
| `PUT /api/casos/:id/diagnostico` | Dados do documento e texto-fonte; refaz a conferência de todos os trechos |
| `PUT /api/casos/:id/respostas/:dimensao` | Grava a resposta de uma dimensão e devolve conferência e índice |
| `POST /api/casos/:id/ia/:dimensao` | Consulta a IA para uma dimensão, grava a sugestão e registra a consulta |
| `POST /api/casos/:id/arquivo` | Busca a cópia arquivada do link original na Wayback Machine e preenche link arquivado, data de acesso e texto-fonte |
| `PUT /api/casos/:id/parecer` | Formato, texto, autoavaliação, validação humana e declaração de uso de IA |
| `GET /api/grupos/:id/dados` | Comparação, transações e anotações do grupo |
| `PUT /api/grupos/:id/comparacao` · `PUT /api/grupos/:id/anotacoes` | Anexo I e checklists do grupo |
| `POST /api/grupos/:id/transacoes` · `PUT`, `DELETE /api/transacoes/:id` | Anexo II |
| `GET /saude` | Verificação de funcionamento |

As exportações em CSV e TXT continuam sendo geradas no navegador, a partir dos dados salvos. Exportação do parecer em Word e PDF: pendente.

## 5. Integração com IA

- A chamada ao modelo fica **somente no servidor**. Chave de API em variável de ambiente, nunca no repositório nem no front-end.
- O servidor aplica o protocolo fixo de 12 perguntas (mais P5.1 a P5.4 na oficina de IA generativa) sobre o texto do documento arquivado.
- A conferência do trecho literal deve ser feita **por código** (busca do trecho normalizado no texto-fonte), não pelo modelo.
- Registrar ferramenta, versão do modelo, data e hora e prompt de cada consulta (alimenta o apêndice técnico).
- A conclusão jurídica é do grupo. O sistema descreve e organiza; não decide.

## 6. Autenticação e privacidade

- Sem cadastro aberto: administrador e professor criam as contas; a senha inicial é trocada no primeiro acesso.
- Cada grupo só enxerga seus dados; professor enxerga os da turma.
- Política de privacidade e base legal definidas antes de guardar qualquer dado (LGPD).
- Backups e descarte ao fim da disciplina.

## 7. Hospedagem

- Front-end e API são servidos pelo mesmo servidor Node.js (uma origem só, sem CORS).
- Back-end: servidor próprio, plataforma em nuvem ou serviço gerenciado, a critério de quem implementar. O GitHub Pages **não executa código de servidor**.
- A imagem do `Dockerfile` precisa de um volume em `/data` (banco) e de HTTPS à frente.

## 8. Referências normativas usadas nas telas (conferir na fonte antes de qualquer uso)

CDC (Lei 8.078/1990); Tema 987 do STF (RE 1.037.396), redação dos embargos de 17/06/2026; Marco Civil da Internet (Lei 12.965/2014); LGPD (Lei 13.709/2018); Decreto 7.962/2013; Lei 14.478/2022; Resoluções BCB 519 a 521/2025; ECA Digital (Lei 15.211/2025); orientação do CONAR sobre influenciadores.
