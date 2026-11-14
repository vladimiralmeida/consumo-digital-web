/* Triagem: o caso do grupo, o tipo de problema, os termos de uso com análise por IA e as provas. */
import { analisarPendentes, analise, buscarCopiaArquivada, dimensoesParaIa, dimensoesSemNota, pararAnalise, temTextoDosTermos } from '../analise.js';
import { criarCaso, excluirCasoAtual } from '../dados.js';
import { estado, alterarPacote, alternarMarcado, casoAtual, ehGestor, indiceEmTela, respostaDa, temResposta } from '../estado.js';
import { proximoPasso, trilha } from '../fluxo.js';
import { gravarCaso, gravarDiagnostico } from '../gravar.js';
import { html, atributo } from '../html.js';
import { agendarSalvamento, salvarAgora } from '../salvar.js';
import { avisoLegal, cabecalho, caixa, campo, confirmar, emblema, nota, segmento } from '../ui.js';

const DATA = window.DATA;
const ehLink = (valor) => /^https?:\/\/\S+\.\S+/i.test(valor.trim());

function semGrupo() {
  return html`
    <section class="cartao vazio">
      <h2>Nenhum grupo cadastrado</h2>
      ${ehGestor()
        ? html`<p>Crie o primeiro grupo e as contas dos alunos para começar.</p><a class="botao primario" href="#/contas">Abrir contas e grupos</a>`
        : html`<p>Sua conta ainda não está ligada a um grupo. Fale com o professor.</p>`}
    </section>`;
}

function formularioDeCaso(primeiro) {
  const { falha } = estado.visao.novoCaso;
  return html`
    <form class="cartao" data-f="tri-criar" novalidate>
      <div class="pilha junta">
        <h2>${primeiro ? 'Abrir o primeiro caso' : 'Novo caso'}</h2>
        <p class="apoio">Um caso reúne a triagem, a análise dos termos de uso e o parecer. Tudo fica salvo para o grupo.</p>
      </div>
      ${falha ? html`<p class="aviso erro" role="alert">${falha}</p>` : ''}
      <div class="campo">
        <label for="novo-titulo">Nome do caso</label>
        <input id="novo-titulo" name="titulo" type="text" maxlength="120" required placeholder="Ex.: Termos de uso da Loja Exemplo">
      </div>
      <div class="campo">
        <label for="novo-tipo">Tipo de problema</label>
        <select id="novo-tipo" name="tipo">${DATA.tipos.map((tipo) => html`<option value="${tipo.id}">${tipo.label}</option>`)}</select>
      </div>
      <div class="campo">
        <label for="novo-descricao">Descrição curta (opcional)</label>
        <textarea id="novo-descricao" name="descricao_curta" rows="2" maxlength="500"></textarea>
        <span class="dica">Não inclua dados pessoais de ninguém.</span>
      </div>
      <div class="lista">
        <label class="item"><input type="checkbox" name="exemplo"><span><strong>Começar com o exemplo fictício.</strong> Preenche a análise com a “Plataforma Exemplo”, para ver como a tela funciona.</span></label>
      </div>
      <div class="linha-acoes">
        <button class="botao primario" type="submit">Criar caso</button>
        ${primeiro ? '' : html`<button class="botao" type="button" data-a="tri-cancelar">Cancelar</button>`}
      </div>
    </form>`;
}

function regime(caso) {
  const tipo = DATA.tipos.find((item) => item.id === caso.tipo) || DATA.tipos[0];
  return html`
    <section class="cartao realce">
      <div class="cartao-topo"><h2>${tipo.title}</h2>${emblema(tipo.status)}</div>
      <p>${tipo.text}</p>
      ${tipo.rota ? html`<div><a class="botao" href="#/${tipo.rota}">Abrir a tela do tema</a></div>` : ''}
    </section>`;
}

/* ---------- termos de uso e análise ---------- */

function regiaoDoArquivo() {
  const { buscando, falhaDoArquivo, avisoDoArquivo } = analise();
  const { documento_url: original, link_arquivado: arquivado } = estado.pacote.diagnostico;
  return html`
    <div class="linha-acoes">
      <button type="button" class="botao" data-a="tri-arquivo"${atributo(buscando || !ehLink(original), 'disabled')}>${buscando ? 'Buscando na Wayback Machine…' : 'Buscar a cópia arquivada'}</button>
      ${ehLink(arquivado) ? html`<a href="${arquivado}" target="_blank" rel="noopener noreferrer">Abrir o link arquivado</a>` : html`<span class="legenda">Preenche o link arquivado, a data de acesso e o texto abaixo.</span>`}
    </div>
    ${falhaDoArquivo ? html`<p class="aviso erro" role="alert">${falhaDoArquivo}</p>` : ''}
    ${avisoDoArquivo ? html`<p class="aviso info" role="status">${avisoDoArquivo}</p>` : ''}`;
}

function regiaoDaAcao() {
  const { lote, falha } = analise();
  const pendentes = dimensoesParaIa().length;
  const doGrupo = dimensoesSemNota().length - pendentes;
  const total = DATA.dims.length;
  if (!estado.ia.disponivel) {
    return html`<p class="aviso neutro" role="note"><strong>IA desativada neste servidor.</strong> O grupo responde as ${total} perguntas à mão no <a href="#/diagnostico">diagnóstico</a>; a conferência dos trechos funciona normalmente.</p>`;
  }
  if (lote) {
    return html`
      <div class="pilha junta" role="status">
        <span class="apoio">Analisando a opacidade com ${estado.ia.ferramenta}: ${lote.feitas} de ${lote.total} perguntas respondidas</span>
        <progress max="${lote.total}" value="${lote.feitas}"></progress>
      </div>
      <div><button type="button" class="botao" data-a="tri-parar"${atributo(lote.parar, 'disabled')}>${lote.parar ? 'Parando…' : 'Parar'}</button></div>`;
  }
  return html`
    ${falha ? html`<p class="aviso erro" role="alert">${falha}</p>` : ''}
    <div class="linha-acoes">
      <button type="button" class="botao primario" data-a="tri-analisar"${atributo(!temTextoDosTermos() || !pendentes, 'disabled')}>
        ${pendentes === total ? 'Analisar a opacidade dos termos com IA' : pendentes ? `Analisar as ${pendentes} perguntas que faltam` : doGrupo ? 'Falta só a nota do grupo' : 'Análise de opacidade completa'}
      </button>
      ${doGrupo ? html`<span class="legenda">${doGrupo} pergunta(s) têm texto do grupo sem nota: dê a nota no <a href="#/diagnostico">diagnóstico</a>.</span>` : ''}
      ${temTextoDosTermos() ? '' : html`<span class="legenda">Busque a cópia arquivada ou cole o texto dos termos para liberar a análise.</span>`}
    </div>
    <p class="legenda">A IA (${estado.ia.ferramenta}) lê o texto acima e responde as ${total} perguntas do Diagnóstico da Opacidade com trecho, resumo e nota de 0 (claro e favorável) a 3 (omisso ou fortemente desfavorável). O texto é enviado ao serviço de IA. Cada trecho é conferido por comparação com o documento, e a nota final é do grupo.</p>`;
}

function linhaDoResultado(item) {
  const resposta = respostaDa(item.n);
  const consultando = Boolean(analise().consultando[item.n]);
  const respondida = temResposta(item.n);
  const situacao = consultando ? 'Consultando a IA…' : respondida ? (resposta.resumo || 'Sem resumo em linguagem simples.') + (resposta.nota === null ? ' (sem nota)' : '') : 'Aguardando análise.';
  return html`
    <li>
      <button type="button" class="resultado ${consultando ? 'ativo' : ''}" data-a="tri-revisar" data-i="${item.n}" aria-label="Revisar ${item.name} no diagnóstico">
        ${nota(resposta.nota)}
        <span class="resultado-texto"><strong>${item.name}</strong><span class="apoio">${situacao}</span></span>
        ${resposta.conferido === false ? emblema('Não conferido', 'alerta') : ''}
        <span class="sinal" aria-hidden="true">›</span>
      </button>
    </li>`;
}

function resultados() {
  const comNota = DATA.dims.length - dimensoesSemNota().length;
  const iniciada = DATA.dims.some((item) => temResposta(item.n));
  if (!iniciada && !analise().lote) { return ''; }
  return html`
    <div class="pilha">
      <div class="cartao-topo"><h3>Opacidade por pergunta</h3>${emblema(`${comNota} de ${DATA.dims.length} com nota`)}</div>
      <ul class="resultados">${DATA.dims.map(linhaDoResultado)}</ul>
      <p class="legenda">Toque em uma linha para revisar o trecho, a nota e a conferência no diagnóstico.</p>
    </div>`;
}

function cartaoDosTermos() {
  const { diagnostico } = estado.pacote;
  return html`
    <section class="cartao" id="termos" tabindex="-1" aria-labelledby="termos-titulo">
      <div class="pilha junta">
        <h2 id="termos-titulo">Termos de uso</h2>
        <p class="apoio">Informe onde estão os termos da plataforma. A análise de opacidade responde as mesmas perguntas do diagnóstico e leva o caso direto para a conferência.</p>
      </div>
      ${campo('tri-plataforma', 'Plataforma', diagnostico.plataforma, 'tri-doc', { indice: 'plataforma', maximo: 120, exemplo: 'Nome da plataforma ou do serviço' })}
      ${campo('tri-url', 'Link original dos termos', diagnostico.documento_url, 'tri-doc', { indice: 'documento_url', tipo: 'url', exemplo: 'https://' })}
      <div class="pilha" data-regiao="arquivo">${regiaoDoArquivo()}</div>
      ${campo('tri-fonte', 'Texto dos termos', diagnostico.texto_fonte, 'tri-doc', {
        indice: 'texto_fonte', linhas: 6, classe: 'fonte-documento',
        dica: 'Vem da cópia arquivada ou pode ser colado. Não cole dados pessoais.'
      })}
      <div class="pilha" data-regiao="acao">${regiaoDaAcao()}</div>
      ${resultados()}
    </section>`;
}

function resumoDaAnalise() {
  const respondidas = estado.pacote.respostas.filter((resposta) => resposta.nota !== null).length;
  if (!respondidas) { return ''; }
  const indice = indiceEmTela();
  const naoConferidos = estado.pacote.respostas.filter((resposta) => resposta.conferido === false).length;
  return html`
    <section class="cartao compacto">
      <span class="rotulo">Índice de opacidade${indice.completo ? '' : ' (parcial)'}</span>
      <div class="numero-medio">${indice.percentual}%</div>
      <progress max="${indice.baseMaximo}" value="${indice.base}" aria-label="Índice de opacidade: ${indice.base} de ${indice.baseMaximo} pontos"></progress>
      <p class="apoio">${indice.respondidasBase} de ${indice.totalBase} dimensões da régua base com nota. Módulo de IA generativa: ${indice.sub} de ${indice.subMaximo}.</p>
      ${naoConferidos ? html`<p class="aviso" role="note"><strong>${naoConferidos} trecho(s) não conferido(s).</strong> Confira no documento original antes de usar.</p>` : ''}
      <div><a class="botao" href="#/diagnostico">Abrir o diagnóstico</a></div>
    </section>`;
}

function render() {
  if (!estado.grupoId) { return semGrupo(); }
  const caso = casoAtual();
  const topo = cabecalho('O que aconteceu?', 'Abra o caso, informe os termos de uso da plataforma e peça a análise. A triagem mostra o regime jurídico provável e as provas que valem a pena guardar.');
  if (!caso) { return html`${topo}<div class="colunas"><div class="coluna">${formularioDeCaso(true)}</div></div>`; }
  if (estado.visao.novoCaso.aberto) { return html`${topo}<div class="colunas"><div class="coluna">${formularioDeCaso(false)}</div></div>`; }
  const marcadas = caso.provas.length;
  return html`
    ${topo}
    ${trilha()}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="cartao-topo">
            <h2>Caso</h2>
            <div class="linha-acoes">
              <button class="botao" type="button" data-a="tri-novo">Novo caso</button>
              <button class="botao simples destrutivo" type="button" data-a="tri-excluir">Excluir caso</button>
            </div>
          </div>
          ${campo('caso-titulo', 'Nome do caso', caso.titulo, 'tri-titulo', { maximo: 120 })}
          ${campo('caso-descricao', 'Descrição curta', caso.descricao_curta, 'tri-descricao', { linhas: 2, maximo: 500, dica: 'Não inclua dados pessoais de ninguém.' })}
          <div class="pilha junta">
            <span class="campo-rotulo" id="tipo-rotulo">Tipo de problema</span>
            <div class="segmentos" role="group" aria-labelledby="tipo-rotulo">
              ${DATA.tipos.map((tipo) => segmento(caso.tipo === tipo.id, tipo.label, 'tri-tipo', tipo.id))}
            </div>
          </div>
        </section>
        ${cartaoDosTermos()}
        <section class="cartao">
          <div class="cartao-topo"><h2>Provas a guardar</h2>${emblema(`${marcadas} de ${DATA.provas.length}`)}</div>
          <div class="lista">${DATA.provas.map((prova, i) => caixa(caso.provas.includes(i), prova, 'tri-prova', i))}</div>
        </section>
        ${proximoPasso('triagem')}
      </div>
      <aside class="coluna">${regime(caso)}${resumoDaAnalise()}${avisoLegal()}</aside>
    </div>`;
}

const sincronizarLista = () => {
  const caso = casoAtual();
  estado.casos = estado.casos.map((item) => (item.id === caso.id ? { ...item, titulo: caso.titulo } : item));
};

export const tela = {
  titulo: 'Triagem do caso',
  render,
  regioes: (nome) => (nome === 'arquivo' ? regiaoDoArquivo() : nome === 'acao' ? regiaoDaAcao() : null),
  acoes: {
    'tri-novo': () => { estado.visao.novoCaso = { aberto: true, falha: '' }; },
    'tri-cancelar': () => { estado.visao.novoCaso = { aberto: false, falha: '' }; },
    'tri-tipo': (tipo) => { alterarPacote('caso', { tipo }); salvarAgora('caso', gravarCaso); },
    'tri-arquivo': buscarCopiaArquivada,
    'tri-analisar': analisarPendentes,
    'tri-parar': pararAnalise,
    'tri-revisar': (numero) => { estado.visao.diag.aberta = Number(numero); location.hash = '#/diagnostico'; },
    'tri-excluir': async () => {
      const confirmado = await confirmar({
        titulo: 'Excluir este caso?',
        texto: `“${casoAtual().titulo}” será apagado com o diagnóstico, as respostas e o parecer. Não dá para desfazer.`,
        rotuloConfirmar: 'Excluir caso',
        destrutivo: true
      });
      if (confirmado) { await excluirCasoAtual(); }
    }
  },
  mudancas: {
    'tri-prova': (indice) => {
      alterarPacote('caso', { provas: alternarMarcado(casoAtual().provas, Number(indice)) });
      salvarAgora('caso', gravarCaso);
    }
  },
  campos: {
    'tri-titulo': (valor) => { alterarPacote('caso', { titulo: valor }); sincronizarLista(); agendarSalvamento('caso', gravarCaso); },
    'tri-descricao': (valor) => { alterarPacote('caso', { descricao_curta: valor }); agendarSalvamento('caso', gravarCaso); },
    'tri-doc': (valor, elemento) => { alterarPacote('diagnostico', { [elemento.dataset.i]: valor }); agendarSalvamento('diagnostico', gravarDiagnostico); }
  },
  formularios: {
    'tri-criar': async (dados) => {
      const titulo = String(dados.get('titulo') || '').trim();
      if (!titulo) { estado.visao.novoCaso = { ...estado.visao.novoCaso, falha: 'Dê um nome ao caso.' }; return; }
      try {
        await criarCaso({ titulo, tipo: dados.get('tipo'), descricao_curta: String(dados.get('descricao_curta') || ''), exemplo: dados.get('exemplo') === 'on' });
        estado.visao.novoCaso = { aberto: false, falha: '' };
      } catch (erro) {
        estado.visao.novoCaso = { ...estado.visao.novoCaso, falha: erro.message };
      }
    }
  }
};
