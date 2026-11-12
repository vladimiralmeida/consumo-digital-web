# Consumo Digital · protótipo web v0.2

Protótipo de interface para a skill **Consumo Digital Diagnóstico** (disciplina Relações de Consumo e Novas Tecnologias, PPGDI-UNICAP). Site estático: HTML, CSS e JavaScript puros, sem build e sem dependências.

**Todos os exemplos são fictícios.** Nada é enviado nem guardado: o navegador só gera arquivo quando você clica em *Exportar* (CSV ou TXT). Não digite dados pessoais, frase de recuperação nem chave privada.

## Telas
Triagem do caso · Diagnóstico da Opacidade (com módulo de IA generativa) · Comparação de provedores (Anexo I) · Parecer e apêndice · Agente de IA · Publicidade · Dados · Ativos digitais (Anexo II) · Skill v0.2 e entregas.

## Rodar localmente
Abra `index.html` no navegador. Ou, na pasta: `python3 -m http.server 8000` e acesse http://localhost:8000.

## Publicar no GitHub Pages
1. Crie um repositório **público** (ex.: `consumo-digital-web`) em github.com.
2. Envie o conteúdo desta pasta para a raiz do repositório (inclua o arquivo `.nojekyll`).
3. Em *Settings > Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
4. O site ficará em `https://SEU-USUARIO.github.io/consumo-digital-web/`.

## Antes de publicar
- Confira as referências normativas e as datas (Tema 987 na redação dos embargos de 17/06/2026, Res. BCB 519 a 521/2025, Lei 15.211/2025, orientação do CONAR) na fonte oficial.
- Confirme as datas das entregas na tela *Skill v0.2 e entregas*.
- Revise o aviso de conteúdo fictício e inclua licença e forma de citar (ex.: CC BY 4.0, a decidir com o grupo).

## Ajustes de design
As cores ficam nas variáveis de `assets/styles.css` (`--primary` etc.). O bordô é uma aproximação; troque pelo tom oficial da UNICAP, se houver manual de identidade. Os textos e dados ficam em `assets/data.js`.

## Estrutura
```
index.html
assets/styles.css
assets/data.js    (conteúdo)
assets/app.js     (telas e interações)
.nojekyll
```
