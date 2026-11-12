# Arquitetura e proposta de back-end

Documento para quem vai evoluir o protótipo. Estado atual (v0.2): front-end estático, sem back-end, sem persistência. Tudo o que está em `assets/data.js` é conteúdo de exemplo (fictício).

## 1. Estado atual

| Arquivo | Papel |
|---|---|
| `index.html` | Esqueleto: cabeçalho, `<main id="app">`, rodapé, carrega `data.js` e `app.js`. |
| `assets/data.js` | Objeto global `window.DATA` com todo o conteúdo: tipos de problema, 14 dimensões do diagnóstico, provedores de exemplo, atores, checklists, minutas, entregas. |
| `assets/app.js` | Estado em memória (`S`), uma função de tela por rota (`V.triagem`, `V.diagnostico`, ...), roteador por hash (`#/rota`), delegação de eventos (`data-a`, `data-i`, `data-f`) e funções de exportação (`EXP`). |
| `assets/styles.css` | Visual (variáveis CSS no topo). |

Fluxo: `hashchange` → `render()` → `V[rota]()` devolve HTML → `app.innerHTML`. Cliques chamam `ACT[acao](indice)`, que altera `S` e re-renderiza. Campos de texto gravam em `S` no evento `input`, sem re-render.

Rotas: `triagem`, `diagnostico`, `comparacao`, `parecer`, `agente`, `publicidade`, `dados`, `ativos`, `skill`.

## 2. Regras de domínio que o código já embute

- **Índice de opacidade:** soma das notas (0 a 3) das 10 dimensões base (eixos A a D) dividida por 30. As 4 dimensões do eixo E (IA generativa, P5.1 a P5.4) formam um subíndice de 0 a 12 e **não entram** no índice, para manter a comparabilidade com a v0.1.
- **Conferência da transcrição:** cada dimensão tem `ok`: `true` (conferido no texto-fonte), `false` (NÃO CONFERIDO) ou `null` (descritivo). Trecho NÃO CONFERIDO não pode ser usado antes da checagem humana.
- **Validação humana e declaração de uso de IA** só podem ser marcadas pelo grupo. Nenhum automatismo deve preenchê-las.
- **Rastreabilidade:** cada cláusula citada leva link original, link arquivado (Wayback Machine) e data de acesso.
- **Segurança:** o sistema nunca pede, recebe ou grava frase de recuperação ou chave privada de carteira, nem dados pessoais do usuário.
- **Média ponderada da rubrica:** pesos 2,5 / 3,0 / 2,0 / 1,5 / 1,0 (soma 10).

## 3. Modelo de dados proposto

```
Grupo(id, nome, turma, criado_em)
Usuario(id, nome, email, grupo_id, papel[aluno|professor|admin])
Caso(id, grupo_id, tipo, descricao_curta, criado_em)
Prova(id, caso_id, descricao, link_original, link_arquivado, data_acesso, entregue)
Diagnostico(id, caso_id, plataforma, documento_url, link_arquivado, data_acesso,
            ferramenta_ia, versao_modelo, data_criacao, prompt_usado)
Resposta(id, diagnostico_id, pergunta_id[P1.1..P5.4], dimensao, nota[0..3],
         trecho_literal, conferido[true|false|null], por_que, parametro_legal)
Comparacao(id, grupo_id, provedor_nome, dimensao, nota, texto, divergencia_destacada)
Parecer(id, diagnostico_id, formato[senacon|plataforma], texto, validado_humano, declaracao_ia)
RegistroTransacao(id, grupo_id, rede, endereco_origem, endereco_destino, hash, data_hora, link_explorador, obs)
Autoavaliacao(id, parecer_id, criterio, nota)
```

Observações:
- `RegistroTransacao` guarda **apenas endereços públicos e hash**. Validar no servidor que os campos não parecem frase de recuperação (12 ou 24 palavras) nem chave privada (64 caracteres hexadecimais), e rejeitar.
- Para dados sensíveis, aplicar minimização e prazo de retenção (LGPD, arts. 6º e 16).

## 4. API proposta (REST, JSON)

| Método e rota | Função |
|---|---|
| `POST /api/grupos` · `GET /api/grupos/:id` | Criar e consultar grupo |
| `POST /api/casos` · `GET /api/casos/:id` | Triagem: cria caso e devolve regime provável e provas sugeridas |
| `POST /api/diagnosticos` | Cria diagnóstico (plataforma, link, ferramenta de IA) |
| `PUT /api/diagnosticos/:id/respostas/:pergunta` | Grava resposta de uma dimensão |
| `POST /api/diagnosticos/:id/conferir` | Confere cada trecho literal contra o texto-fonte do documento arquivado |
| `GET /api/diagnosticos/:id/indice` | Calcula índice base e subíndice |
| `GET /api/comparacoes/:grupoId/export.csv` | Anexo I |
| `POST /api/pareceres` · `GET /api/pareceres/:id/export.docx` | Gera e exporta parecer e apêndice |
| `POST /api/transacoes` · `GET /api/grupos/:id/transacoes/export.csv` | Anexo II |

## 5. Integração com IA

- A chamada ao modelo fica **somente no servidor**. Chave de API em variável de ambiente, nunca no repositório nem no front-end.
- O servidor aplica o protocolo fixo de 12 perguntas (mais P5.1 a P5.4 na oficina de IA generativa) sobre o texto do documento arquivado.
- A conferência do trecho literal deve ser feita **por código** (busca do trecho normalizado no texto-fonte), não pelo modelo.
- Registrar ferramenta, versão do modelo, data e hora e prompt de cada consulta (alimenta o apêndice técnico).
- A conclusão jurídica é do grupo. O sistema descreve e organiza; não decide.

## 6. Autenticação e privacidade

- Login institucional ou por convite do professor. Sem cadastro aberto.
- Cada grupo só enxerga seus dados; professor enxerga os da turma.
- Política de privacidade e base legal definidas antes de guardar qualquer dado (LGPD).
- Backups e descarte ao fim da disciplina.

## 7. Hospedagem

- Front-end estático: GitHub Pages (atual) ou o mesmo servidor do back-end.
- Back-end: servidor próprio, plataforma em nuvem ou serviço gerenciado, a critério de quem implementar. O GitHub Pages **não executa código de servidor**.
- Se front e API ficarem em domínios diferentes, configurar CORS e cookies de sessão com `SameSite` adequado.

## 8. Referências normativas usadas nas telas (conferir na fonte antes de qualquer uso)

CDC (Lei 8.078/1990); Tema 987 do STF (RE 1.037.396), redação dos embargos de 17/06/2026; Marco Civil da Internet (Lei 12.965/2014); LGPD (Lei 13.709/2018); Decreto 7.962/2013; Lei 14.478/2022; Resoluções BCB 519 a 521/2025; ECA Digital (Lei 15.211/2025); orientação do CONAR sobre influenciadores.
