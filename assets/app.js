(function () {
  'use strict';
  var D = window.DATA;
  var app = document.getElementById('app');
  var S = {
    triagem: { tipo: 'market', provas: {} },
    diag: { open: 'd2', eixo: 'all', ferr: '', data: '', prompt: '' },
    comp: { only: false, sel: 'A', grupo: '', achado: '' },
    parecer: { fmt: 'senacon', val: false, decl: false, notas: [7, 8, 8, 7, 8] },
    agente: { ator: 'agente', cen: 'fora' },
    pub: { ator: 'plataforma', marc: {} },
    dados: { cen: 'preco', forn: '' },
    ativos: { feitos: {}, vals: {} },
    skill: { open: 2, hig: {} }
  };
  var ROUTES = [
    ['Casos', [['triagem', 'Triagem do caso']]],
    ['Documentos', [['diagnostico', 'Diagnóstico'], ['comparacao', 'Comparação'], ['parecer', 'Parecer']]],
    ['Temas', [['agente', 'Agente de IA'], ['publicidade', 'Publicidade'], ['dados', 'Dados'], ['ativos', 'Ativos digitais']]],
    ['Skill', [['skill', 'v0.2 e entregas']]]
  ];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function lead(h, p) { return '<div class="lead"><h1>' + h + '</h1><p>' + p + '</p></div>'; }
  function banner(kind, strong, txt) { return '<div class="banner ' + kind + '" role="note"><div><strong>' + strong + '</strong> ' + txt + '</div></div>'; }
  function foot() { return '<div style="font-size:13px;color:var(--muted)">Orientação informativa. Não substitui advogado, Defensoria ou Procon.</div>'; }
  function fmt1(x) { return x.toFixed(1).replace('.', ','); }
  function download(name, text, type) {
    var blob = new Blob(['﻿' + text], { type: (type || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csv(rows) { return rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n'); }
  function stamp() { return new Date().toISOString().slice(0, 10); }
  function exportBtn(action, label) { return '<button type="button" class="btn ghost" data-a="' + action + '">' + label + '</button>'; }
  function check(on, text, a, i) { return '<button type="button" class="check" aria-pressed="' + (!!on) + '" data-a="' + a + '" data-i="' + i + '"><span class="m" aria-hidden="true">' + (on ? '☑' : '☐') + '</span><span>' + text + '</span></button>'; }
  function chip(pressed, label, a, i) { return '<button type="button" class="chip" aria-pressed="' + pressed + '" data-a="' + a + '" data-i="' + i + '">' + esc(label) + '</button>'; }
  function node(pressed, label, a, i) { return '<button type="button" class="node" aria-pressed="' + pressed + '" data-a="' + a + '" data-i="' + i + '">' + esc(label) + '</button>'; }
  function field(id, label, val, ph) { return '<label class="f" for="' + id + '">' + label + '</label><input id="' + id + '" type="text" data-f="' + id + '" value="' + esc(val) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; }
  function hypo(a) {
    return '<div class="card hl"><div class="row" style="margin-bottom:14px"><h2 style="margin:0">' + a.titulo + '</h2><span class="badge">' + a.status + '</span></div>' +
      '<div class="lbl">Fundamento</div><p style="margin:0 0 16px;font-size:15px;line-height:1.6">' + a.fundamento + '</p>' +
      '<div class="lbl">Ressalva</div><p class="note">' + a.ressalva + '</p></div>';
  }

  /* ---------- telas ---------- */
  var V = {};

  V.triagem = function () {
    var s = S.triagem, t = D.tipos.filter(function (x) { return x.id === s.tipo; })[0];
    var n = D.provas.filter(function (_, i) { return s.provas[i]; }).length;
    return lead('O que aconteceu com você?', 'Escolha o tipo de problema. A triagem mostra o regime jurídico provável e as provas que valem a pena guardar.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Tipo de problema</h2><div class="chips" role="group" aria-label="Tipo de problema">' +
      D.tipos.map(function (x) { return chip(s.tipo === x.id, x.label, 'tri-tipo', x.id); }).join('') + '</div></div>' +
      '<div class="card"><h2>Provas a guardar <span style="font-size:14px;font-weight:500;color:var(--muted)">· ' + n + ' de ' + D.provas.length + '</span></h2><div class="list">' +
      D.provas.map(function (p, i) { return check(s.provas[i], p, 'tri-prova', i); }).join('') + '</div></div></section>' +
      '<aside class="side"><div class="card hl"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">' + t.title + '</h2><span class="badge">' + t.status + '</span></div><p class="note">' + t.text + '</p>' +
      (t.link ? '<p style="margin:14px 0 0"><a class="btn" href="' + t.link + '">Abrir a tela do tema</a></p>' : '') + '</div>' + foot() +
      '<section class="card" aria-labelledby="eq"><h2 id="eq" class="sm">Equipe</h2><ul class="tight" style="list-style:none;padding:0;font-size:15px">' + D.equipe.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section></aside></div>';
  };

  V.diagnostico = function () {
    var s = S.diag, base = D.dims.filter(function (d) { return !d.modulo; }), mod = D.dims.filter(function (d) { return d.modulo; });
    var tot = base.reduce(function (a, d) { return a + d.score; }, 0), sub = mod.reduce(function (a, d) { return a + d.score; }, 0), pct = Math.round(tot / 30 * 100);
    var top = base.slice().sort(function (a, b) { return b.score - a.score || a.n - b.n; }).slice(0, 3);
    var conf = D.dims.filter(function (d) { return d.ok === true; }).length, com = D.dims.filter(function (d) { return d.ok !== null; }).length;
    var vis = D.dims.filter(function (d) { return s.eixo === 'all' || d.axis === s.eixo; });
    return lead('Diagnóstico da Opacidade', 'A skill interroga os termos com as mesmas 12 perguntas, em quatro rodadas (na v0.2, mais quatro do módulo de IA generativa), e confere cada transcrição com o texto-fonte.') +
      banner('warn', 'Exemplo com dados fictícios.', 'A “Plataforma Exemplo” e seus trechos ilustram o formato. Não representam nenhuma empresa real.') +
      '<div class="cols"><section class="main">' +
      '<div class="card"><div class="row" style="margin-bottom:14px"><h2 style="margin:0">Registro da criação <span class="tag">novo na v0.2</span></h2></div><p class="sub">Para a oficina de IA generativa: o grupo cria um conteúdo e depois audita os termos da ferramenta usada.</p>' +
      field('ferr', 'Ferramenta de IA generativa', s.ferr, 'Nome e versão do modelo') +
      '<label class="f" for="datacr">Data da criação</label><input id="datacr" type="date" data-f="datacr" value="' + esc(s.data) + '">' +
      field('promptcr', 'Prompt utilizado', s.prompt, 'Exatamente como enviado') + '</div>' +
      '<div class="card"><h2>Régua base (10 dimensões) e módulo de IA generativa</h2><div class="chips" role="group" aria-label="Filtrar por eixo" style="margin-bottom:16px">' +
      D.eixos.map(function (e) { return chip(s.eixo === e.id, e.label, 'dg-eixo', e.id); }).join('') + '</div><div class="list">' +
      vis.map(function (d) {
        var id = 'd' + d.n, open = s.open === id;
        var sel = d.ok === true ? '<span class="sel ok">✓ Conferido no texto-fonte</span>' : d.ok === false ? '<span class="sel no">! NÃO CONFERIDO</span>' : '<span class="sel na">Descritivo, sem transcrição</span>';
        return '<div class="dim' + (open ? ' open' : '') + '"><button type="button" aria-expanded="' + open + '" data-a="dg-open" data-i="' + id + '"><span class="nn">' + d.n + '</span><span class="gr">' + d.name + ' <span style="font-size:12px;color:var(--muted);font-weight:500">· Eixo ' + d.axis + '</span></span><span class="p p' + d.score + '">' + d.score + '</span><span aria-hidden="true">' + (open ? '−' : '+') + '</span></button>' +
          (open ? '<div class="body"><div class="lbl">Pergunta ' + d.pid + '</div><p style="margin:0 0 10px">' + d.prompt + '</p><div class="lbl">Trecho literal</div><blockquote>' + d.quote + '</blockquote><div style="font-size:12px;color:var(--muted);margin:6px 0 10px">Fonte: [link original] · [link arquivado na Wayback Machine] · [data de acesso]</div><div style="margin-bottom:10px">' + sel + '</div><div class="lbl">Por que esta nota</div><p style="margin:0 0 10px">' + d.why + '</p><div class="lbl">Parâmetro legal</div><p style="margin:0">' + d.param + '</p></div>' : '') + '</div>';
      }).join('') + '</div></div></section>' +
      '<aside class="side"><div class="card hl"><div class="lbl">Índice de opacidade</div><div class="big">' + pct + '%</div><div class="bar" style="margin:12px 0" role="img" aria-label="Índice ' + pct + ' por cento"><i style="width:' + pct + '%"></i></div>' +
      '<p style="margin:0 0 10px;font-size:13px;color:var(--muted)">Soma das 10 notas da régua base dividida por 30. Compara diagnósticos feitos com a mesma régua. Não é uma medida jurídica.</p>' +
      '<p style="margin:0;font-size:13px;border-top:1px solid var(--line);padding-top:10px"><strong>Módulo IA generativa:</strong> ' + sub + ' de 12. Fica fora do índice para não quebrar a comparação com diagnósticos da v0.1.</p></div>' +
      '<div class="card"><h2 class="sm">Três pontos mais graves</h2><div class="list">' + top.map(function (d) { return '<div style="display:flex;gap:10px;align-items:flex-start"><span class="p p' + d.score + '">' + d.score + '</span><div><strong>' + d.name + '</strong><div style="font-size:14px;color:var(--muted)">' + d.plain + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2 class="sm">Conferência</h2><p style="margin:0;font-size:14px">' + conf + ' de ' + com + ' trechos conferidos no texto-fonte. Trecho NÃO CONFERIDO não deve ser usado antes da checagem no original.</p><p style="margin:14px 0 0">' + exportBtn('dg-export', 'Exportar ficha (CSV)') + '</p></div>' + foot() + '</aside></div>';
  };

  V.comparacao = function () {
    var s = S.comp, P = D.prov, ids = ['A', 'B', 'C'];
    function diff(c) { var v = ids.map(function (i) { return P.items[i][c][0]; }); return Math.min.apply(null, v) !== Math.max.apply(null, v); }
    var cols = P.cols.filter(function (c) { return !s.only || diff(c.id); });
    var gs = 'grid-template-columns:170px repeat(' + Math.max(cols.length, 1) + ',minmax(0,1fr))';
    var p = P.items[s.sel];
    var worst = P.cols.slice().sort(function (a, b) { return p[b.id][0] - p[a.id][0]; })[0];
    var others = ids.filter(function (i) { return i !== s.sel; });
    var divs = P.cols.filter(function (c) { return others.some(function (o) { return P.items[o][c.id][0] !== p[c.id][0]; }); }).map(function (c) { return c.label.toLowerCase(); });
    var sums = ids.map(function (i) { return i + ' = ' + P.cols.reduce(function (a, c) { return a + P.items[i][c.id][0]; }, 0); }).join('; ');
    return lead('Três provedores de IA generativa, lado a lado', 'Anexo I da atividade: o grupo cria um conteúdo, lê os termos de cada ferramenta e compara quatro pontos. A nota é a mesma régua do Diagnóstico (0 a 3; quanto maior, mais opaco ou desfavorável).') +
      banner('warn', 'Dados fictícios.', '“Provedor Exemplo A, B e C” ilustram o quadro. Em um trabalho real, cada célula leva a transcrição literal conferida, o link original e o link da Wayback Machine.') +
      '<div class="cols"><section class="main"><div class="card"><div class="row" style="margin-bottom:16px"><h2 style="margin:0">Quadro comparativo</h2><button type="button" class="chip" aria-pressed="' + s.only + '" data-a="cp-only">Mostrar só onde divergem</button></div><div class="table">' +
      '<div class="grid h" style="' + gs + '"><div class="lbl" style="margin:0">Provedor</div>' + cols.map(function (c) { return '<div class="lbl" style="margin:0">' + c.label + '</div>'; }).join('') + '</div>' +
      ids.map(function (i) {
        return '<div class="grid r" style="' + gs + '"><div><button type="button" class="node" aria-pressed="' + (s.sel === i) + '" data-a="cp-sel" data-i="' + i + '">' + P.items[i].name + '</button></div>' +
          cols.map(function (c) { var v = P.items[i][c.id]; return '<div style="display:flex;flex-direction:column;gap:6px;padding-right:8px"><span class="p p' + v[0] + '" style="align-self:flex-start;font-size:12px">Nota ' + v[0] + '</span><span style="font-size:13px;line-height:1.45">' + v[1] + '</span></div>'; }).join('') + '</div>';
      }).join('') + '</div><p style="font-size:13px;color:var(--muted);margin:14px 0 0">Subíndice do módulo de IA generativa (soma das quatro notas, de 0 a 12), por provedor: ' + sums + '.</p></div></section>' +
      '<aside class="side"><div class="card hl"><h2 class="sm">' + p.name + '</h2><div class="lbl">Ponto mais crítico</div><p style="margin:0 0 14px">' + worst.label + ' (nota ' + p[worst.id][0] + '): ' + p[worst.id][1] + '</p><div class="lbl">Onde diverge dos outros</div><p class="note">' + (divs.length ? 'Diverge dos outros em: ' + divs.join(', ') + '.' : 'Não diverge dos demais em nenhum ponto.') + '</p></div>' +
      '<div class="card"><h2 class="sm">Dados do grupo (Anexo I)</h2>' + field('grupo', 'Grupo', s.grupo, 'Nome do grupo') +
      '<label class="f" for="achado">Divergência que o grupo quer destacar</label><textarea id="achado" rows="3" data-f="achado" placeholder="Ex.: um provedor permite recusar o treinamento e outro não">' + esc(s.achado) + '</textarea>' +
      '<p style="margin:14px 0 0">' + exportBtn('cp-export', 'Exportar Anexo I (CSV)') + '</p></div>' +
      '<div class="card" style="font-size:14px">Cláusulas que transferem ao usuário o risco do conteúdo gerado são examinadas à luz do art. 51, I e IV, do CDC. A comparação mostra a divergência de mercado; ela não decide a validade da cláusula.</div></aside></div>';
  };

  V.parecer = function () {
    var s = S.parecer, f = D.formatos.filter(function (x) { return x.id === s.fmt; })[0];
    var sp = D.rubrica.reduce(function (a, c) { return a + c.peso; }, 0);
    var media = D.rubrica.reduce(function (a, c, i) { return a + s.notas[i] * c.peso; }, 0) / sp;
    var pior = 0, pd = -1; D.rubrica.forEach(function (c, i) { var d = (10 - s.notas[i]) * c.peso; if (d > pd) { pd = d; pior = i; } });
    var prontos = 4 + (s.val ? 1 : 0) + (s.decl ? 1 : 0);
    var pag = 4.5;
    return lead('Do diagnóstico ao parecer', 'Escolha o formato, confira a estrutura de 3 a 5 páginas e complete o apêndice técnico. A skill redige e organiza; a conferência e a declaração de validação humana são do grupo.') +
      banner('warn', 'Exemplo ilustrativo com dados fictícios.', 'A “Plataforma Exemplo”, os trechos e as notas da autoavaliação servem para mostrar o formato. Não representam nenhuma empresa real.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Formato do documento</h2><div class="chips" style="gap:12px">' +
      D.formatos.map(function (x) { return '<button type="button" class="node" style="flex:1 1 240px;text-align:left;padding:14px 16px;height:auto" aria-pressed="' + (s.fmt === x.id) + '" data-a="pr-fmt" data-i="' + x.id + '"><strong>' + x.title + '</strong><br><span style="font-weight:400;font-size:13px">' + x.desc + '</span></button>'; }).join('') + '</div><p style="margin:14px 0 0;font-size:14px">Tom da conclusão: <strong>' + f.tom + '</strong></p></div>' +
      '<div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Estrutura do texto</h2><span class="badge">' + fmt1(pag) + ' páginas de 3 a 5</span></div><div class="bar" style="margin-bottom:14px"><i style="width:' + Math.round(pag / 5 * 100) + '%"></i></div><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:15px">' +
      D.estrutura.map(function (e, i) { return '<li>' + e[0] + (i === 5 ? ' (' + f.tom + ')' : '') + (e[1] ? ' <span style="color:var(--muted)">' + e[1] + '</span>' : '') + '</li>'; }).join('') + '</ol></div>' +
      '<div class="card"><h2>Prévia do texto</h2><div class="pre"><strong>Análise Crítica dos Termos de Serviço da Plataforma Exemplo à Luz do Código de Defesa do Consumidor</strong>\n\n2. Objeto da Análise\nEste documento tem por objeto a análise dos Termos de Uso da Plataforma Exemplo, versão acessada em [data], disponível em [link] e arquivada em [link da Wayback Machine].\n\n4.1 Identidade e posicionamento (Eixo A)\nCláusula identificada: “A Plataforma atua exclusivamente como intermediadora e não é parte nas transações entre usuários.”\n\n5.1 Responsabilidade e cadeia de fornecimento\nA autodefinição como “mera intermediária” tende a afastar a responsabilidade solidária prevista no art. 7º, parágrafo único, e no art. 25, § 1º, do CDC, o que indica potencial abusividade. Como contraponto, a plataforma poderia sustentar que apenas conecta usuários; porém o Tema 987 do STF manda aplicar o CDC aos marketplaces.\n\n6. Conclusão e Encaminhamento\n' + f.concl + '</div></div></section>' +
      '<aside class="side"><div class="card hl"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">Apêndice técnico</h2><span class="badge">' + prontos + ' de 7 itens prontos</span></div><div class="list">' +
      D.apendice.map(function (a, i) {
        var n = (i + 1) + '. <strong>' + a.t + '.</strong> ' + a.d;
        if (a.chave) return check(s[a.chave], n, 'pr-ap', a.chave);
        return '<div style="display:flex;gap:10px;font-size:14px;padding:10px 14px"><span aria-hidden="true">' + (a.aberto ? '☐' : '✓') + '</span><span>' + n + '</span></div>';
      }).join('') + '</div><p style="margin:14px 0 0">' + exportBtn('pr-export', 'Exportar apêndice (TXT)') + '</p></div>' +
      '<div class="card"><h2 class="sm">Autoavaliação pela rubrica</h2><p class="sub">Notas de 0 a 10, com os pesos da ficha. Os valores iniciais são de exemplo.</p><div class="list">' +
      D.rubrica.map(function (c, i) { return '<div class="row"><div style="font-size:14px"><strong>' + c.name + '</strong> <span style="color:var(--muted)">peso ' + fmt1(c.peso) + '</span></div><div class="stepper"><button type="button" aria-label="Diminuir a nota de ' + c.name + '" data-a="pr-nota" data-i="' + i + ':-1">−</button><strong aria-live="polite" style="min-width:24px;text-align:center">' + s.notas[i] + '</strong><button type="button" aria-label="Aumentar a nota de ' + c.name + '" data-a="pr-nota" data-i="' + i + ':1">+</button></div></div>'; }).join('') + '</div>' +
      '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px"><div class="lbl">Média ponderada</div><div class="big" style="font-size:40px">' + fmt1(media) + '</div><p style="margin:8px 0 0;font-size:13px;color:var(--muted)">Maior lacuna: <strong>' + D.rubrica[pior].name + '</strong>. É uma simulação para achar o que melhorar. A avaliação vale quando feita pelos outros grupos e pelo professor.</p></div></div>' +
      '<div class="card"><h2 class="sm">Roteiro de 15 minutos</h2><div class="list">' + D.roteiro.map(function (r) { return '<div style="display:flex;gap:12px;font-size:14px"><strong style="min-width:48px">' + r[0] + ' min</strong><span>' + r[1] + '</span></div>'; }).join('') + '</div></div></aside></div>';
  };

  V.agente = function () {
    var s = S.agente, A = D.atoresAgente, ids = ['usuario', 'agente', 'marketplace', 'vendedor'];
    return lead('Se um agente de IA compra por você, quem responde?', 'A plataforma diz ser “mera intermediária”. O STF mandou aplicar o CDC ao marketplace, mas também afirmou que não haverá responsabilidade objetiva na aplicação da tese. Com um agente no meio, a pergunta fica mais difícil.') +
      banner('info', 'Questão em aberto.', 'Não há resposta consolidada na lei nem na jurisprudência. As camadas abaixo são hipóteses de trabalho, cada uma com seu fundamento e sua ressalva.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Mapa de atores</h2><p class="sub">Toque em um ator para ver a hipótese de responsabilização.</p><div class="chips" style="align-items:center">' +
      ids.map(function (id, i) { return node(s.ator === id, A[id].label, 'ag-ator', id) + (i < ids.length - 1 ? '<span aria-hidden="true" style="color:var(--muted);font-size:18px">→</span>' : ''); }).join('') +
      '</div><div class="chips" style="align-items:center;margin-top:12px"><span aria-hidden="true" style="color:var(--muted)">↳ paga por</span>' + node(s.ator === 'pagamento', A.pagamento.label, 'ag-ator', 'pagamento') + '</div></div>' +
      '<div class="card"><h2>O que o agente fez?</h2><div class="chips" role="group" aria-label="Cenário" style="margin-bottom:16px">' + Object.keys(D.cenariosAgente).map(function (id) { return chip(s.cen === id, D.cenariosAgente[id].label, 'ag-cen', id); }).join('') + '</div><p style="margin:0;font-size:15px;line-height:1.6">' + D.cenariosAgente[s.cen].text + '</p></div>' +
      '<div class="card"><h2>Provas específicas</h2><ul class="tight" style="font-size:15px">' + D.provasAgente.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul></div></section>' +
      '<aside class="side">' + hypo(A[s.ator]) + '<div class="card"><h2 class="sm">Caminho prático</h2><p style="margin:0 0 16px;font-size:15px;line-height:1.6">Reclame primeiro ao fornecedor do agente e, em paralelo, ao vendedor ou ao marketplace. Peça cancelamento, estorno e informações sobre o funcionamento do agente.</p><a class="btn" href="#/triagem">Abrir a triagem do caso</a></div>' + foot() + '</aside></div>';
  };

  V.publicidade = function () {
    var s = S.pub, A = D.atoresPub, n = D.checkPub.filter(function (_, i) { return s.marc[i]; }).length;
    return lead('Um influenciador divulgou e você foi lesado: quem responde?', 'A pergunta-problema do módulo, em redação própria: anunciante, agência, influenciador e plataforma podem ser chamados. Cada camada tem seu fundamento e sua ressalva.') +
      banner('warn', 'Conferir.', 'O texto original da pergunta-problema do guia veio embaralhado na extração do PDF; esta redação é uma reconstrução. As referências a normas e guias recentes (ECA Digital, CONAR) seguem o guia do módulo e devem ser conferidas na fonte.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Mapa de atores</h2><p class="sub">Toque em um ator para ver a hipótese de responsabilização.</p><div class="chips">' + Object.keys(A).map(function (id) { return node(s.ator === id, A[id].label, 'pb-ator', id); }).join('') + '</div></div>' +
      '<div class="card"><h2>Checklist do anúncio</h2><p class="sub">Marque o que o caso comprova. ' + n + ' de ' + D.checkPub.length + ' itens.</p><div class="list">' + D.checkPub.map(function (c, i) { return check(s.marc[i], '<strong>' + c.ref + '</strong> · ' + c.text, 'pb-chk', i); }).join('') + '</div></div></section>' +
      '<aside class="side">' + hypo(A[s.ator]) + '<div class="card"><h2 class="sm">Debate: a autorregulação basta?</h2><p style="margin:0 0 12px;font-size:15px;line-height:1.6">O CONAR orienta a identificação da publicidade por influenciadores, mas suas decisões não são lei. O CDC (art. 36) impõe a identificação por qualquer meio.</p><ul class="tight"><li>Uma etiqueta “publi” escondida na legenda cumpre o art. 36?</li><li>A plataforma deve ser chamada a responder quando lucra com o impulsionamento?</li><li>O influenciador responde pelo produto ou só pela divulgação?</li></ul></div>' + foot() + '</aside></div>';
  };

  function minuta() {
    var c = D.cenDados[S.dados.cen], f = S.dados.forn.trim() || '[fornecedor]';
    return 'A/C do Encarregado de Dados de ' + f + '\n\nCom fundamento no art. 18 e, quando cabível, no art. 20 da Lei 13.709/2018 (LGPD), requeiro: (i) informações claras sobre ' + c.pedido + '; (ii) os critérios e procedimentos utilizados, observados os segredos comercial e industrial; (iii) a revisão da decisão, quando tomada apenas por tratamento automatizado; (iv) a correção de dados incompletos ou incorretos.\n\nRequeiro resposta no prazo legal e por escrito.\n\n[Local, data e identificação do titular]';
  }
  V.dados = function () {
    var s = S.dados, c = D.cenDados[s.cen];
    return lead('Um sistema decidiu sobre você. Você tem como saber por quê?', 'Preço personalizado, score de crédito, recusa automática, dispositivos conectados: em cada cenário, a LGPD e o CDC dão ferramentas para pedir explicação e revisão.') +
      banner('warn', 'Limite.', 'A LGPD protege os segredos comercial e industrial do controlador (art. 20, § 1º). Por isso o pedido deve ser específico e a resposta pode vir parcial. Se vier recusa sem justificativa, a ANPD pode ser acionada.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Qual foi a decisão?</h2><div class="chips" role="group" aria-label="Cenário" style="margin-bottom:16px">' + Object.keys(D.cenDados).map(function (id) { return chip(s.cen === id, D.cenDados[id].label, 'dd-cen', id); }).join('') + '</div><p style="margin:0 0 16px;font-size:15px;line-height:1.6">' + c.texto + '</p><div class="lbl">Fundamento</div><p class="note">' + c.base + '</p></div>' +
      '<div class="card"><h2 class="sm">Debate: o consumidor percebe?</h2><ul class="tight"><li>Quem vê um preço diferente do vizinho percebe que foi decidido por um sistema?</li><li>A explicação “critérios internos” atende ao dever de informação?</li><li>Revisão humana é direito ou favor?</li></ul></div></section>' +
      '<aside class="side"><div class="card hl"><h2>Minuta de pedido ao fornecedor</h2><p class="sub">Informe o fornecedor e exporte o texto. Nenhum dado pessoal é guardado.</p>' + field('forn', 'Nome do fornecedor', s.forn, 'Ex.: Plataforma Exemplo') + '<div class="pre" id="minuta" style="margin-top:14px"></div><p style="margin:14px 0 0">' + exportBtn('dd-export', 'Exportar minuta (TXT)') + '</p></div>' +
      '<div class="card" style="font-size:14px">Guarde a data do pedido e o número de protocolo. Sem resposta no prazo, o passo seguinte é a reclamação ao Procon e à ANPD.</div>' + foot() + '</aside></div>';
  };

  V.ativos = function () {
    var s = S.ativos;
    return lead('Oficina blockchain: guardar, enviar e provar uma transação', 'Em quatro passos cronometrados, o grupo faz uma transação de baixo valor, confere o resultado em um explorador público e registra no Anexo II. A prova on-chain tem alcance e limites.') +
      banner('warn', 'Regras de segurança.', 'Nunca informe a frase de recuperação nem a chave privada a ninguém, nem a esta interface. Registre apenas o endereço público e o código da transação (hash). Use valor irrelevante e confira no guia a rede e a carteira indicadas.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Roteiro de 2 horas</h2><div class="list">' + D.passosAtivos.map(function (p, i) { return check(s.feitos[i], '<span><strong>' + p.min + ' min · ' + p.titulo + '</strong><br><span style="font-weight:400">' + p.texto + '</span></span>', 'at-passo', i); }).join('') + '</div></div>' +
      '<div class="card"><h2 class="sm">Prestadora autorizada × autocustódia</h2><div class="two"><div><strong>Prestadora autorizada</strong><br>Há uma empresa sujeita à Lei 14.478/2022 e às normas do Banco Central (Res. BCB 519 a 521/2025). Cabe reclamação ao fornecedor e discussão de responsabilidade pelo CDC.</div><div><strong>Autocustódia</strong><br>Você controla a chave. Não há intermediário para reclamar, e a perda da chave costuma ser irreversível.</div></div><p style="font-size:13px;color:var(--muted);margin:12px 0 0">Datas e alcance das resoluções: conferir na fonte oficial.</p></div>' +
      '<div class="card"><h2 class="sm">O que a prova blockchain mostra e não mostra</h2><div class="two"><div><strong>Mostra</strong><ul class="tight" style="margin-top:6px"><li>Que a transação ocorreu, com data e hora.</li><li>Os endereços de origem e destino e o valor.</li><li>O código (hash) verificável por qualquer pessoa.</li></ul></div><div><strong>Não mostra</strong><ul class="tight" style="margin-top:6px"><li>Quem é o titular do endereço.</li><li>O motivo ou o acordo que levou à transação.</li><li>Se houve fraude ou erro de quem enviou.</li></ul></div></div></div></section>' +
      '<aside class="side"><div class="card hl"><div class="row" style="margin-bottom:14px"><h2 style="margin:0">Anexo II</h2><span class="badge" id="cnt"></span></div>' +
      D.camposAnexo2.map(function (l, i) { return field('c' + i, l, s.vals[i] || ''); }).join('') +
      '<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:var(--muted)">Link do explorador (ex.: Polygonscan): cole o endereço da página da transação. Não registre frase de recuperação nem chave privada.</p><p style="margin:14px 0 0">' + exportBtn('at-export', 'Exportar Anexo II (CSV)') + '</p></div>' +
      '<div class="card"><h2 class="sm">Perguntas para o debate</h2><ul class="tight"><li>A transação é prova suficiente de um contrato de consumo?</li><li>Quem responde por uma transação irreversível feita por engano?</li><li>A autocustódia afasta o CDC?</li></ul></div>' + foot() + '</aside></div>';
  };

  V.skill = function () {
    var s = S.skill, hoje = new Date('2026-11-12'), hoje2 = new Date(); hoje2.setHours(0, 0, 0, 0);
    var ref = new Date(Date.UTC(hoje2.getFullYear(), hoje2.getMonth(), hoje2.getDate()));
    var nh = D.higiene.filter(function (_, i) { return s.hig[i]; }).length;
    return lead('Da skill v0.1 à v0.2: o que muda e o que entregar', 'O módulo 2 acrescenta à skill a auditoria de termos de provedores de IA generativa. Esta tela liga cada achado a um passo, uma regra e uma referência, e organiza as entregas e a higiene do repositório.') +
      banner('warn', 'Prazos.', 'As datas abaixo seguem o guia do módulo e o e-mail do professor; confirme cada uma antes de contar com ela. Os dias restantes são calculados pela data do seu aparelho.') +
      '<div class="cols"><section class="main"><div class="card"><h2>Achados do módulo → mudança na skill</h2><p class="sub">Toque em um achado para ver o passo da skill, a regra e a referência.</p><div class="list">' +
      D.achadosSkill.map(function (a, i) { var o = s.open === i; return '<div class="dim' + (o ? ' open' : '') + '"><button type="button" aria-expanded="' + o + '" data-a="sk-open" data-i="' + i + '"><span class="gr">' + a.pid + ' · ' + a.titulo + '</span><span aria-hidden="true">' + (o ? '−' : '+') + '</span></button>' + (o ? '<div class="body"><div><strong>Passo:</strong> ' + a.passo + '</div><div><strong>Regra:</strong> ' + a.regra + '</div><div><strong>Referência:</strong> ' + a.ref + '</div></div>' : '') + '</div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Higiene do repositório</h2><p class="sub">' + nh + ' de ' + D.higiene.length + ' itens conferidos antes do commit.</p><div class="list">' + D.higiene.map(function (h, i) { return check(s.hig[i], h, 'sk-hig', i); }).join('') + '</div></div></section>' +
      '<aside class="side"><div class="card hl"><h2>Linha do tempo das entregas</h2><div class="list">' + D.entregas.map(function (e) {
        var d = new Date(e.iso), diff = Math.round((d - ref) / 86400000), cls = diff < 0 ? 'past' : diff === 0 ? 'today' : '';
        var txt = diff < 0 ? 'Prazo passado há ' + (-diff) + ' dia(s)' : diff === 0 ? 'É hoje' : 'Faltam ' + diff + ' dia(s)';
        var p = e.iso.split('-'); return '<div class="t ' + cls + '"><strong>' + p[2] + '/' + p[1] + ' · ' + e.titulo + '</strong><div style="font-size:13px;margin-top:2px">' + txt + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2 class="sm">Mensagem de commit sugerida</h2><div class="mono">Skill v0.2: auditoria de Termos de provedores de IA\n\n- adiciona perguntas P5.1 a P5.4 (módulo IA generativa)\n- subíndice 0 a 12, separado do índice base\n- regras de segurança sobre carteira e dados pessoais</div></div>' +
      '<div class="card" style="font-size:14px;line-height:1.55"><strong>Rastreabilidade.</strong> Para cada cláusula citada: link original, link arquivado na Wayback Machine e data de acesso. A validação humana e a declaração de uso de IA são preenchidas pelo grupo, nunca pela skill.</div></aside></div>';
  };

  /* ---------- roteador e render ---------- */
  function route() { var h = (location.hash || '#/triagem').replace(/^#\//, ''); return V[h] ? h : 'triagem'; }
  function nav(cur) {
    $('#nav').innerHTML = ROUTES.map(function (g) {
      return '<div><div class="ng-t">' + g[0] + '</div><div class="ng-l">' + g[1].map(function (r) { return '<a class="pill-link" href="#/' + r[0] + '"' + (r[0] === cur ? ' aria-current="page"' : '') + '>' + r[1] + '</a>'; }).join('') + '</div></div>';
    }).join('');
  }
  function after(cur) {
    if (cur === 'dados') { $('#minuta').textContent = minuta(); }
    if (cur === 'ativos') { countAtivos(); }
  }
  function countAtivos() { var n = D.camposAnexo2.filter(function (_, i) { return (S.ativos.vals[i] || '').trim(); }).length; var el = $('#cnt'); if (el) el.textContent = n + ' de ' + D.camposAnexo2.length + ' campos'; }
  function render(keepScroll) {
    var cur = route(), y = window.scrollY;
    nav(cur); app.innerHTML = V[cur](); after(cur);
    document.title = 'Consumo Digital · ' + (ROUTES.reduce(function (a, g) { return a.concat(g[1]); }, []).filter(function (r) { return r[0] === cur; })[0] || [0, ''])[1];
    if (keepScroll) window.scrollTo(0, y); else { window.scrollTo(0, 0); }
  }
  function toggle(o, k) { o[k] = !o[k]; }

  var ACT = {
    'tri-tipo': function (i) { S.triagem.tipo = i; },
    'tri-prova': function (i) { toggle(S.triagem.provas, i); },
    'dg-eixo': function (i) { S.diag.eixo = i; },
    'dg-open': function (i) { S.diag.open = S.diag.open === i ? null : i; },
    'cp-only': function () { S.comp.only = !S.comp.only; },
    'cp-sel': function (i) { S.comp.sel = i; },
    'pr-fmt': function (i) { S.parecer.fmt = i; },
    'pr-ap': function (i) { S.parecer[i] = !S.parecer[i]; },
    'pr-nota': function (i) { var p = i.split(':'), k = +p[0]; S.parecer.notas[k] = Math.max(0, Math.min(10, S.parecer.notas[k] + (+p[1]))); },
    'ag-ator': function (i) { S.agente.ator = i; },
    'ag-cen': function (i) { S.agente.cen = i; },
    'pb-ator': function (i) { S.pub.ator = i; },
    'pb-chk': function (i) { toggle(S.pub.marc, i); },
    'dd-cen': function (i) { S.dados.cen = i; },
    'at-passo': function (i) { toggle(S.ativos.feitos, i); },
    'sk-open': function (i) { S.skill.open = S.skill.open === +i ? -1 : +i; },
    'sk-hig': function (i) { toggle(S.skill.hig, i); }
  };
  var EXP = {
    'dg-export': function () {
      download('diagnostico-opacidade-' + stamp() + '.csv', csv([['Eixo', 'Pergunta', 'Dimensão', 'Nota', 'Trecho literal', 'Conferência', 'Parâmetro legal', 'Por que esta nota'], ].concat(D.dims.map(function (d) { return [d.axis, d.pid, d.name, d.score, d.quote, d.ok === true ? 'Conferido' : d.ok === false ? 'NÃO CONFERIDO' : 'Descritivo', d.param, d.why]; }))), 'text/csv');
    },
    'cp-export': function () {
      var P = D.prov, ids = ['A', 'B', 'C'];
      var rows = [['Grupo', 'Provedor / ferramenta'].concat(P.cols.map(function (c) { return c.label + ' (nota e texto)'; }))];
      ids.forEach(function (i) { rows.push([S.comp.grupo, P.items[i].name].concat(P.cols.map(function (c) { return P.items[i][c.id][0] + ' · ' + P.items[i][c.id][1]; }))); });
      rows.push([]); rows.push(['Divergência destacada pelo grupo', S.comp.achado]);
      rows.push(['Aviso', 'Dados fictícios de exemplo. Substitua por transcrições literais conferidas, com link original e link arquivado.']);
      download('anexo-I-comparacao-' + stamp() + '.csv', csv(rows), 'text/csv');
    },
    'pr-export': function () {
      var s = S.parecer, lines = ['APÊNDICE TÉCNICO (modelo)', 'Gerado em ' + stamp(), ''];
      D.apendice.forEach(function (a, i) { var st = a.chave ? (s[a.chave] ? '[x]' : '[ ]') : (a.aberto ? '[ ]' : '[x]'); lines.push(st + ' ' + (i + 1) + '. ' + a.t + '. ' + a.d); });
      lines.push('', 'Validação humana e declaração de uso de IA só valem se feitas pelo grupo.');
      download('apendice-tecnico-' + stamp() + '.txt', lines.join('\r\n'));
    },
    'dd-export': function () { download('pedido-lgpd-' + stamp() + '.txt', minuta().replace(/\n/g, '\r\n')); },
    'at-export': function () {
      var rows = [['Campo', 'Valor']].concat(D.camposAnexo2.map(function (l, i) { return [l, S.ativos.vals[i] || '']; }));
      rows.push(['Aviso', 'Não registre frase de recuperação nem chave privada.']);
      download('anexo-II-transacao-' + stamp() + '.csv', csv(rows), 'text/csv');
    }
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (EXP[a]) { EXP[a](); return; }
    if (ACT[a]) { ACT[a](b.getAttribute('data-i')); render(true); var f = document.querySelector('[data-a="' + a + '"][data-i="' + b.getAttribute('data-i') + '"]'); if (f) f.focus({ preventScroll: true }); }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-f'); if (!id) return;
    var v = e.target.value;
    if (id === 'ferr') S.diag.ferr = v; else if (id === 'datacr') S.diag.data = v; else if (id === 'promptcr') S.diag.prompt = v;
    else if (id === 'grupo') S.comp.grupo = v; else if (id === 'achado') S.comp.achado = v;
    else if (id === 'forn') { S.dados.forn = v; $('#minuta').textContent = minuta(); }
    else if (/^c\d$/.test(id)) { S.ativos.vals[+id.slice(1)] = v; countAtivos(); }
  });
  window.addEventListener('hashchange', function () { render(false); app.focus({ preventScroll: true }); });
  render(false);
})();
