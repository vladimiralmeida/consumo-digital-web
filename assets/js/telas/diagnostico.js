/* Diagnóstico da Opacidade: documento analisado, régua de 14 dimensões, conferência e IA. */
import { api } from '../api.js';
import { estado, alterarPacote, alterarResposta, indiceEmTela, respostaDa, temResposta } from '../estado.js';
import { baixarCsv, dataDeHoje } from '../exportar.js';
import { gravarDiagnostico, gravarResposta } from '../gravar.js';
import { html, atributo } from '../html.js';
import { pedirRedesenho } from '../painel.js';
import { agendarSalvamento, descarregarAgendados, salvarAgora } from '../salvar.js';
import { avisoLegal, cabecalho, campo, confirmar, emblema, formatarData, nota, segmento, semCaso } from '../ui.js';

const DATA = window.DATA;
const SIGNIFICADO_DAS_NOTAS = ['claro e favorável', 'pequenas lacunas', 'vago ou desfavorável', 'omisso ou fortemente desfavorável'];
const MAIS_GRAVES = 3;
const visao = () => estado.visao.diag;
const dimensao = (numero) => DATA.dims.find((item) => item.n === Number(numero));
const ehLink = (valor) => /^https?:\/\//i.test(valor);

function emblemaDeConferencia(resposta, descritiva) {
  if (descritiva) { return emblema('Descritivo, sem transcrição'); }
  if (resposta.conferido === true) { return emblema('✓ Conferido no texto-fonte', 'ok'); }
  if (resposta.conferido === false) { return emblema('! NÃO CONFERIDO', 'alerta'); }
  return emblema('Sem trecho a conferir');
}

function textoDeConferencia(resposta, descritiva) {
  if (descritiva || resposta.conferido === null) { return ''; }
  if (resposta.conferido) { return 'O trecho foi encontrado, por comparação de texto, no documento colado acima.'; }
  return estado.pacote.diagnostico.texto_fonte.trim()
    ? 'O trecho não foi encontrado no documento colado. Pode ser paráfrase ou invenção: confira no original antes de usar.'
    : 'Cole o texto do documento arquivado para que o trecho possa ser conferido.';
}

function fonteDoDocumento() {
  const { documento_url: original, link_arquivado: arquivado, data_acesso: acesso } = estado.pacote.diagnostico;
  const link = (endereco, rotulo) => (ehLink(endereco)
    ? html`<a href="${endereco}" target="_blank" rel="noopener noreferrer">${rotulo}</a>`
    : html`<span>${rotulo} não informado</span>`);
  return html`<p class="legenda">Fonte: ${link(original, 'link original')} · ${link(arquivado, 'link arquivado')} · ${acesso ? `acesso em ${formatarData(acesso)}` : 'data de acesso não informada'}</p>`;
}

function editorDaDimensao(item) {
  const resposta = respostaDa(item.n);
  const consultando = Boolean(visao().consultando[item.n]);
  return html`
    <div class="abre-corpo">
      <div class="pilha junta"><span class="rotulo">Pergunta ${item.pid}</span><p>${item.prompt}</p></div>
      <div class="pilha junta"><span class="rotulo">Parâmetro legal</span><p>${item.param}</p></div>
      <div class="pilha junta">
        <span class="campo-rotulo" id="nota-rotulo-${item.n}">Nota de opacidade</span>
        <div class="escolha-nota" role="group" aria-labelledby="nota-rotulo-${item.n}">
          ${SIGNIFICADO_DAS_NOTAS.map((significado, valor) => html`
            <button type="button" class="nota n${valor}" aria-pressed="${resposta.nota === valor ? 'true' : 'false'}" aria-label="Nota ${valor}: ${significado}" title="${significado}" data-a="dg-nota" data-i="${item.n}:${valor}">${valor}</button>`)}
        </div>
        <span class="legenda">${resposta.nota === null ? 'Sem nota. Quanto maior, mais opaco ou desfavorável ao consumidor.' : `Nota ${resposta.nota}: ${SIGNIFICADO_DAS_NOTAS[resposta.nota]}.`}</span>
      </div>
      ${campo(`trecho-${item.n}`, item.descritiva ? 'Descrição' : 'Trecho literal', resposta.trecho_literal, 'dg-trecho', {
        indice: item.n, linhas: 3, maximo: 5000,
        dica: item.descritiva ? 'Resposta descritiva: extensão, clareza e destaque das cláusulas.' : 'Copie a cláusula exatamente como está no documento. Use [...] entre trechos que não são contíguos, ou “omisso”.'
      })}
      <div class="pilha junta" data-regiao="conferencia-${item.n}">${regiaoDeConferencia(item.n)}</div>
      ${campo(`resumo-${item.n}`, 'Em linguagem simples', resposta.resumo, 'dg-resumo', { indice: item.n, maximo: 2000 })}
      ${campo(`porque-${item.n}`, 'Por que esta nota', resposta.por_que, 'dg-porque', { indice: item.n, linhas: 2, maximo: 2000 })}
      ${estado.ia.disponivel ? html`
        <div class="linha-acoes">
          <button type="button" class="botao" data-a="dg-ia" data-i="${item.n}"${atributo(consultando || Boolean(visao().lote), 'disabled')}>${consultando ? 'Consultando a IA…' : 'Sugerir com IA'}</button>
          ${resposta.origem === 'ia' ? html`<span class="legenda">Sugestão da IA (${estado.ia.ferramenta}). A nota e a conclusão são do grupo: revise e ajuste.</span>` : ''}
        </div>` : ''}
    </div>`;
}

function regiaoDeConferencia(numero) {
  const item = dimensao(numero);
  const resposta = respostaDa(numero);
  return html`<div>${emblemaDeConferencia(resposta, item.descritiva)}</div><span class="legenda">${textoDeConferencia(resposta, item.descritiva)}</span>${item.descritiva ? '' : fonteDoDocumento()}`;
}

function linhaDaDimensao(item) {
  const aberta = visao().aberta === item.n;
  const resposta = respostaDa(item.n);
  return html`
    <div class="abre ${aberta ? 'aberta' : ''}">
      <button type="button" aria-expanded="${aberta ? 'true' : 'false'}" data-a="dg-abrir" data-i="${item.n}">
        <span class="ordem">${item.n}</span>
        <span class="titulo">${item.name}<small>Eixo ${item.axis} · ${item.pid}${item.modulo ? ' · módulo de IA generativa' : ''}</small></span>
        ${resposta.origem === 'ia' && temResposta(item.n) ? emblema('IA', 'ia') : ''}
        ${resposta.conferido === false ? emblema('Não conferido', 'alerta') : ''}
        ${nota(resposta.nota)}
        <span class="sinal" aria-hidden="true">${aberta ? '−' : '+'}</span>
      </button>
      ${aberta ? editorDaDimensao(item) : ''}
    </div>`;
}

function regiaoDoIndice() {
  const indice = indiceEmTela();
  return html`
    <span class="rotulo">Índice de opacidade</span>
    <div class="numero-grande">${indice.percentual}%</div>
    <progress max="${indice.baseMaximo}" value="${indice.base}" aria-label="Índice de opacidade: ${indice.base} de ${indice.baseMaximo} pontos"></progress>
    <p class="apoio">${indice.completo
      ? html`Soma das ${indice.totalBase} notas da régua base (${indice.base}) dividida por ${indice.baseMaximo}.`
      : html`<strong>Parcial:</strong> ${indice.respondidasBase} de ${indice.totalBase} dimensões da régua base têm nota.`}
      Compara diagnósticos feitos com a mesma régua. Não é uma medida jurídica.</p>
    <p class="apoio"><strong>Módulo de IA generativa:</strong> ${indice.sub} de ${indice.subMaximo} (${indice.respondidasSub} de ${indice.totalSub} com nota). Fica fora do índice para manter a comparação com a v0.1.</p>`;
}

function regiaoDosMaisGraves() {
  const graves = DATA.dims
    .filter((item) => !item.modulo && respostaDa(item.n).nota !== null)
    .sort((a, b) => respostaDa(b.n).nota - respostaDa(a.n).nota || a.n - b.n)
    .slice(0, MAIS_GRAVES);
  if (!graves.length) { return html`<p class="apoio">Aparecem aqui as três dimensões com nota mais alta.</p>`; }
  return html`<ul class="lista">${graves.map((item) => html`
    <li class="item">${nota(respostaDa(item.n).nota)}<span><strong>${item.name}</strong><br><span class="apoio">${respostaDa(item.n).resumo || 'Sem resumo em linguagem simples.'}</span></span></li>`)}</ul>`;
}

function regiaoDaConferencia() {
  const comTrecho = estado.pacote.respostas.filter((resposta) => resposta.conferido !== null);
  const conferidos = comTrecho.filter((resposta) => resposta.conferido).length;
  return html`<p class="apoio">${comTrecho.length
    ? `${conferidos} de ${comTrecho.length} trechos conferidos no texto-fonte.`
    : 'Nenhum trecho para conferir ainda.'} A conferência é feita por comparação de texto, não pela IA. Trecho NÃO CONFERIDO não deve ser usado antes da checagem no original.</p>`;
}

function cartaoDaIa() {
  const { lote, falhaIa } = visao();
  const semResposta = DATA.dims.filter((item) => !temResposta(item.n)).length;
  if (!estado.ia.disponivel) {
    return html`<p class="aviso neutro" role="note"><strong>IA desativada neste servidor.</strong> O grupo preenche as respostas à mão; a conferência dos trechos funciona normalmente.</p>`;
  }
  return html`
    <div class="pilha">
      <p class="apoio">A IA (${estado.ia.ferramenta}, modelo ${estado.ia.modelo}) lê o documento colado e sugere trecho, resumo e nota. Cada consulta fica registrada para o apêndice técnico. O texto do documento é enviado ao serviço de IA.</p>
      ${falhaIa ? html`<p class="aviso erro" role="alert">${falhaIa}</p>` : ''}
      ${lote
        ? html`
          <div class="pilha junta" role="status">
            <span class="apoio">Consultando: ${lote.feitas} de ${lote.total} dimensões</span>
            <progress max="${lote.total}" value="${lote.feitas}"></progress>
          </div>
          <div><button type="button" class="botao" data-a="dg-ia-parar">Parar</button></div>`
        : html`<div><button type="button" class="botao" data-a="dg-ia-todas"${atributo(!semResposta, 'disabled')}>${semResposta ? `Sugerir com IA as ${semResposta} dimensões sem resposta` : 'Todas as dimensões já têm resposta'}</button></div>`}
    </div>`;
}

function render() {
  if (!estado.pacote) { return semCaso('Abra um caso na triagem para fazer o diagnóstico dos termos.'); }
  const { diagnostico } = estado.pacote;
  const visiveis = DATA.dims.filter((item) => visao().eixo === 'all' || item.axis === visao().eixo);
  return html`
    ${cabecalho('Diagnóstico da Opacidade', 'O grupo interroga os termos com as mesmas 12 perguntas, em quatro rodadas, mais quatro do módulo de IA generativa, e confere cada transcrição com o texto-fonte.')}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="pilha junta"><h2>Documento analisado</h2><p class="apoio">Cada cláusula citada leva link original, link arquivado na Wayback Machine e data de acesso.</p></div>
          ${campo('dg-plataforma', 'Plataforma', diagnostico.plataforma, 'dg-doc', { indice: 'plataforma', maximo: 120 })}
          <div class="campos-2">
            ${campo('dg-url', 'Link original', diagnostico.documento_url, 'dg-doc', { indice: 'documento_url', tipo: 'url', exemplo: 'https://' })}
            ${campo('dg-arquivado', 'Link arquivado', diagnostico.link_arquivado, 'dg-doc', { indice: 'link_arquivado', tipo: 'url', exemplo: 'https://web.archive.org/' })}
          </div>
          <div class="campos-2">${campo('dg-acesso', 'Data de acesso', diagnostico.data_acesso, 'dg-doc', { indice: 'data_acesso', tipo: 'date' })}</div>
          ${campo('dg-fonte', 'Texto do documento arquivado', diagnostico.texto_fonte, 'dg-doc', {
            indice: 'texto_fonte', linhas: 8, classe: 'fonte-documento',
            dica: 'Cole o texto integral dos termos. A conferência dos trechos e a consulta à IA usam este texto. Não cole dados pessoais.'
          })}
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Régua de opacidade</h2>${emblema('10 dimensões base e 4 do módulo')}</div>
          <div class="segmentos" role="group" aria-label="Filtrar por eixo">
            ${DATA.eixos.map((eixo) => segmento(visao().eixo === eixo.id, eixo.label, 'dg-eixo', eixo.id))}
          </div>
          ${cartaoDaIa()}
          <div>${visiveis.map(linhaDaDimensao)}</div>
        </section>
        <section class="cartao">
          <div class="pilha junta"><h2>Registro da criação</h2><p class="apoio">Para a oficina de IA generativa: o grupo cria um conteúdo e depois audita os termos da ferramenta usada.</p></div>
          <div class="campos-2">
            ${campo('dg-ferramenta', 'Ferramenta de IA generativa', diagnostico.ferramenta_ia, 'dg-doc', { indice: 'ferramenta_ia', maximo: 120 })}
            ${campo('dg-versao', 'Versão do modelo', diagnostico.versao_modelo, 'dg-doc', { indice: 'versao_modelo', maximo: 120 })}
          </div>
          <div class="campos-2">${campo('dg-criacao', 'Data da criação', diagnostico.data_criacao, 'dg-doc', { indice: 'data_criacao', tipo: 'date' })}</div>
          ${campo('dg-prompt', 'Prompt utilizado', diagnostico.prompt_usado, 'dg-doc', { indice: 'prompt_usado', linhas: 2, maximo: 5000, dica: 'Exatamente como enviado.' })}
        </section>
      </div>
      <aside class="coluna">
        <section class="cartao realce compacto" data-regiao="indice">${regiaoDoIndice()}</section>
        <section class="cartao compacto"><h3>Três pontos mais graves</h3><div data-regiao="graves">${regiaoDosMaisGraves()}</div></section>
        <section class="cartao compacto">
          <h3>Conferência</h3>
          <div data-regiao="conferencia">${regiaoDaConferencia()}</div>
          <div><button type="button" class="botao" data-a="dg-exportar">Exportar ficha (CSV)</button></div>
        </section>
        ${avisoLegal()}
      </aside>
    </div>`;
}

function aplicarRespostaDaIa(resultado) {
  estado.pacote = { ...estado.pacote, respostas: resultado.respostas, indice: resultado.indice, consultas: resultado.consultas };
  if (resultado.documento_truncado) {
    visao().falhaIa = 'O documento é longo demais para a IA ler inteiro: só a parte inicial foi analisada. Confira as cláusulas do final à mão.';
  }
}

/** Consulta a IA para uma dimensão. Devolve false se a consulta falhar ou for cancelada. */
async function consultarIa(numero, substituir = false) {
  const casoId = estado.pacote.caso.id;
  visao().consultando = { ...visao().consultando, [numero]: true };
  pedirRedesenho();
  try {
    await descarregarAgendados();
    aplicarRespostaDaIa(await api('POST', `/casos/${casoId}/ia/${numero}`, { substituir }));
    return true;
  } catch (erro) {
    if (erro.dados && erro.dados.codigo === 'resposta_do_grupo') {
      const confirmado = await confirmar({
        titulo: 'Substituir a resposta do grupo?',
        texto: `A dimensão “${dimensao(numero).name}” já tem uma resposta escrita pelo grupo. A sugestão da IA vai tomar o lugar dela.`,
        rotuloConfirmar: 'Substituir pela sugestão'
      });
      return confirmado ? consultarIa(numero, true) : false;
    }
    visao().falhaIa = erro.message;
    return false;
  } finally {
    visao().consultando = { ...visao().consultando, [numero]: false };
  }
}

async function consultarTodas() {
  const pendentes = DATA.dims.filter((item) => !temResposta(item.n)).map((item) => item.n);
  visao().lote = { feitas: 0, total: pendentes.length, parar: false };
  for (const numero of pendentes) {
    if (visao().lote.parar || !(await consultarIa(numero))) { break; }
    visao().lote = { ...visao().lote, feitas: visao().lote.feitas + 1 };
  }
  visao().lote = null;
}

function exportarFicha() {
  const rotuloDeConferencia = (resposta) => (resposta.conferido === true ? 'Conferido' : resposta.conferido === false ? 'NÃO CONFERIDO' : 'Sem transcrição');
  const { diagnostico, caso } = estado.pacote;
  const linhas = [
    ['Caso', caso.titulo], ['Plataforma', diagnostico.plataforma], ['Link original', diagnostico.documento_url],
    ['Link arquivado', diagnostico.link_arquivado], ['Data de acesso', diagnostico.data_acesso], [],
    ['Eixo', 'Pergunta', 'Dimensão', 'Nota', 'Trecho literal', 'Conferência', 'Origem', 'Parâmetro legal', 'Em linguagem simples', 'Por que esta nota']
  ].concat(DATA.dims.map((item) => {
    const resposta = respostaDa(item.n);
    return [item.axis, item.pid, item.name, resposta.nota === null ? '' : resposta.nota, resposta.trecho_literal, rotuloDeConferencia(resposta),
      temResposta(item.n) ? (resposta.origem === 'ia' ? 'Sugestão de IA' : 'Grupo') : '', item.param, resposta.resumo, resposta.por_que];
  }));
  baixarCsv(`diagnostico-opacidade-${dataDeHoje()}.csv`, linhas);
}

const campoDeResposta = (nome) => (valor, elemento) => {
  const numero = Number(elemento.dataset.i);
  alterarResposta(numero, { [nome]: valor, origem: 'grupo' });
  agendarSalvamento(`resposta:${numero}`, gravarResposta(numero));
};

export const tela = {
  titulo: 'Diagnóstico',
  render,
  regioes: (nome) => {
    if (nome === 'indice') { return regiaoDoIndice(); }
    if (nome === 'graves') { return regiaoDosMaisGraves(); }
    if (nome === 'conferencia') { return regiaoDaConferencia(); }
    if (nome.startsWith('conferencia-')) { return regiaoDeConferencia(Number(nome.split('-')[1])); }
    return null;
  },
  acoes: {
    'dg-eixo': (eixo) => { visao().eixo = eixo; },
    'dg-abrir': (numero) => { visao().aberta = visao().aberta === Number(numero) ? null : Number(numero); },
    'dg-nota': (par) => {
      const [numero, valor] = par.split(':').map(Number);
      alterarResposta(numero, { nota: respostaDa(numero).nota === valor ? null : valor, origem: 'grupo' });
      salvarAgora(`resposta:${numero}`, gravarResposta(numero));
    },
    'dg-ia': async (numero) => { visao().falhaIa = ''; await consultarIa(Number(numero)); },
    'dg-ia-todas': async () => { visao().falhaIa = ''; await consultarTodas(); },
    'dg-ia-parar': () => { if (visao().lote) { visao().lote = { ...visao().lote, parar: true }; } },
    'dg-exportar': exportarFicha
  },
  campos: {
    'dg-doc': (valor, elemento) => { alterarPacote('diagnostico', { [elemento.dataset.i]: valor }); agendarSalvamento('diagnostico', gravarDiagnostico); },
    'dg-trecho': campoDeResposta('trecho_literal'),
    'dg-resumo': campoDeResposta('resumo'),
    'dg-porque': campoDeResposta('por_que')
  }
};
