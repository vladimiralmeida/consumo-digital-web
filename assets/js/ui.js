/* Componentes de interface compartilhados pelas telas. Todos devolvem Marcacao (ver html.js). */
import { html, atributo } from './html.js';

export const cabecalho = (titulo, texto) => html`
  <header class="cabecalho-pagina"><h1>${titulo}</h1><p>${texto}</p></header>`;

/** tipo: '' (atenção), 'info', 'erro' ou 'neutro'. */
export const aviso = (tipo, destaque, texto) => html`
  <p class="aviso ${tipo}" role="note"><strong>${destaque}</strong> ${texto}</p>`;

export const avisoLegal = () => html`
  <p class="legenda">Orientação informativa. Não substitui advogado, Defensoria ou Procon.</p>`;

export const emblema = (texto, tipo = '') => html`<span class="emblema ${tipo}">${texto}</span>`;

export const nota = (valor) => html`
  <span class="nota ${valor === null || valor === undefined ? '' : `n${valor}`}">${valor === null || valor === undefined ? '–' : valor}</span>`;

/** Botão de escolha (aria-pressed). `acao` e `valor` vão para data-a e data-i. */
export const segmento = (ativo, rotulo, acao, valor, classe = '') => html`
  <button type="button" class="segmento ${classe}" aria-pressed="${ativo ? 'true' : 'false'}" data-a="${acao}" data-i="${valor}">${rotulo}</button>`;

/** Linha de checklist com caixa de seleção nativa. `mudanca` e `valor` vão para data-m e data-i. */
export const caixa = (marcado, conteudo, mudanca, valor, desativado = false) => html`
  <label class="item">
    <input type="checkbox" data-m="${mudanca}" data-i="${valor}"${atributo(marcado, 'checked')}${atributo(desativado, 'disabled')}>
    <span>${conteudo}</span>
  </label>`;

/**
 * Campo de texto com rótulo. `campo` vai para data-c e identifica quem trata a digitação.
 * opcoes: indice (data-i), tipo, dica, exemplo, linhas (vira textarea), classe, maximo, falha, autocompletar, obrigatorio.
 */
export function campo(id, rotulo, valor, campoDeDados, opcoes = {}) {
  const descricao = opcoes.falha ? `${id}-falha` : opcoes.dica ? `${id}-dica` : '';
  const comuns = html` id="${id}" data-c="${campoDeDados}"${opcoes.indice !== undefined ? html` data-i="${opcoes.indice}"` : ''}${descricao ? html` aria-describedby="${descricao}"` : ''}${atributo(opcoes.falha, 'aria-invalid="true"')}${atributo(opcoes.obrigatorio, 'required')}${opcoes.maximo ? html` maxlength="${opcoes.maximo}"` : ''}${opcoes.exemplo ? html` placeholder="${opcoes.exemplo}"` : ''}${opcoes.autocompletar ? html` autocomplete="${opcoes.autocompletar}"` : ''}`;
  const controle = opcoes.linhas
    ? html`<textarea${comuns} rows="${opcoes.linhas}" class="${opcoes.classe || ''}">${valor}</textarea>`
    : html`<input${comuns} type="${opcoes.tipo || 'text'}" value="${valor}">`;
  return html`
    <div class="campo">
      <label for="${id}">${rotulo}</label>
      ${controle}
      ${opcoes.falha ? html`<span class="falha" id="${id}-falha">${opcoes.falha}</span>` : opcoes.dica ? html`<span class="dica" id="${id}-dica">${opcoes.dica}</span>` : ''}
    </div>`;
}

export const cartaoDeHipotese = (ator) => html`
  <section class="cartao realce">
    <div class="cartao-topo"><h2>${ator.titulo}</h2>${emblema(ator.status)}</div>
    <div class="pilha junta"><span class="rotulo">Fundamento</span><p>${ator.fundamento}</p></div>
    <div class="pilha junta"><span class="rotulo">Ressalva</span><p class="apoio">${ator.ressalva}</p></div>
  </section>`;

export const semCaso = (texto) => html`
  <section class="cartao vazio">
    <h2>Nenhum caso aberto</h2>
    <p>${texto}</p>
    <a class="botao primario" href="#/triagem">Ir para a triagem</a>
  </section>`;

export const formatarDecimal = (numero) => numero.toFixed(1).replace('.', ',');

export function formatarData(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : '';
}

/** Janela de confirmação. Resolve com true se a pessoa confirmar, false se cancelar. */
export function confirmar({ titulo, texto, rotuloConfirmar, destrutivo = false }) {
  const janela = document.getElementById('dialogo');
  janela.innerHTML = html`
    <form method="dialog" class="dialogo">
      <h2>${titulo}</h2>
      <p class="apoio">${texto}</p>
      <div class="linha-acoes">
        <button class="botao" value="cancelar" autofocus>Cancelar</button>
        <button class="botao ${destrutivo ? 'destrutivo' : 'primario'}" value="confirmar">${rotuloConfirmar}</button>
      </div>
    </form>`.toString();
  return new Promise((resolver) => {
    janela.addEventListener('close', () => resolver(janela.returnValue === 'confirmar'), { once: true });
    janela.returnValue = 'cancelar';
    janela.showModal();
  });
}
