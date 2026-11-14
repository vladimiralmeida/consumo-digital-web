/* Comparação de provedores de IA generativa (Anexo I), salva por grupo. */
import { estado, alterarDadosDoGrupo, grupoAtual } from '../estado.js';
import { baixarCsv, dataDeHoje } from '../exportar.js';
import { gravarComparacao } from '../gravar.js';
import { html, atributo } from '../html.js';
import { agendarSalvamento, salvarAgora } from '../salvar.js';
import { cabecalho, campo, confirmar, emblema, nota, segmento } from '../ui.js';

const DATA = window.DATA;
const COLUNAS = DATA.prov.cols;
const MAXIMO_DE_PROVEDORES = 6;
const NOTAS = [0, 1, 2, 3];

const comparacao = () => estado.dadosDoGrupo.comparacao;
const provedores = () => comparacao().provedores;
const celulasVazias = () => Object.fromEntries(COLUNAS.map((coluna) => [coluna.id, { nota: null, texto: '' }]));
const nomeDe = (provedor, i) => provedor.nome.trim() || `Provedor ${i + 1}`;
const subindice = (provedor) => COLUNAS.reduce((soma, coluna) => soma + (provedor.celulas[coluna.id].nota || 0), 0);

function diverge(colunaId) {
  const notas = provedores().map((provedor) => provedor.celulas[colunaId].nota).filter((valor) => valor !== null);
  return notas.length > 1 && Math.min(...notas) !== Math.max(...notas);
}

function definirProvedores(lista) {
  alterarDadosDoGrupo('comparacao', { provedores: lista });
}

function alterarProvedor(indice, mudancas) {
  definirProvedores(provedores().map((provedor, i) => (i === indice ? { ...provedor, ...mudancas } : provedor)));
}

function alterarCelula(indice, colunaId, mudancas) {
  const provedor = provedores()[indice];
  alterarProvedor(indice, { celulas: { ...provedor.celulas, [colunaId]: { ...provedor.celulas[colunaId], ...mudancas } } });
}

function regiaoDoQuadro() {
  if (!provedores().length) { return html`<p class="apoio">O quadro aparece aqui quando o grupo incluir o primeiro provedor.</p>`; }
  const colunas = COLUNAS.filter((coluna) => !estado.visao.comp.soDivergentes || diverge(coluna.id));
  return html`
    <div class="rolagem">
      <table>
        <caption class="so-leitor">Notas de opacidade por provedor e por ponto comparado</caption>
        <thead><tr><th scope="col">Provedor</th>${colunas.map((coluna) => html`<th scope="col">${coluna.label}</th>`)}<th scope="col">Subíndice</th></tr></thead>
        <tbody>${provedores().map((provedor, i) => html`
          <tr>
            <th scope="row">${nomeDe(provedor, i)}</th>
            ${colunas.map((coluna) => html`<td>${nota(provedor.celulas[coluna.id].nota)}<span class="legenda">${provedor.celulas[coluna.id].texto}</span></td>`)}
            <td><strong>${subindice(provedor)}</strong> de 12</td>
          </tr>`)}
        </tbody>
      </table>
    </div>
    ${estado.visao.comp.soDivergentes && !colunas.length ? html`<p class="apoio">Os provedores não divergem em nenhum ponto com nota.</p>` : ''}`;
}

function regiaoDaAnalise() {
  if (provedores().length < 2) { return html`<p class="apoio">Inclua pelo menos dois provedores para ver onde eles divergem.</p>`; }
  const divergentes = COLUNAS.filter((coluna) => diverge(coluna.id));
  return html`
    <div class="pilha junta"><span class="rotulo">Onde divergem</span>
      <p>${divergentes.length ? divergentes.map((coluna) => coluna.label).join(', ') + '.' : 'Em nenhum ponto com nota.'}</p></div>
    <div class="pilha junta"><span class="rotulo">Ponto mais crítico de cada um</span>
      <ul class="lista">${provedores().map((provedor, i) => {
        const pior = COLUNAS.reduce((atual, coluna) => ((provedor.celulas[coluna.id].nota ?? -1) > (provedor.celulas[atual.id].nota ?? -1) ? coluna : atual), COLUNAS[0]);
        const valor = provedor.celulas[pior.id].nota;
        return html`<li class="item">${nota(valor)}<span><strong>${nomeDe(provedor, i)}</strong><br><span class="apoio">${valor === null ? 'Sem notas ainda.' : pior.label}</span></span></li>`;
      })}</ul></div>`;
}

function cartaoDoProvedor(provedor, i) {
  return html`
    <section class="cartao">
      <div class="cartao-topo">
        <h2>${i + 1}º provedor</h2>
        <button type="button" class="botao simples destrutivo" data-a="cp-remover" data-i="${i}">Remover</button>
      </div>
      ${campo(`cp-nome-${i}`, 'Provedor ou ferramenta', provedor.nome, 'cp-nome', { indice: i, maximo: 80, exemplo: 'Nome e versão' })}
      ${COLUNAS.map((coluna) => {
        const celula = provedor.celulas[coluna.id];
        return html`
          <div class="pilha junta">
            <span class="campo-rotulo" id="cp-rotulo-${i}-${coluna.id}">${coluna.label}</span>
            <div class="escolha-nota" role="group" aria-labelledby="cp-rotulo-${i}-${coluna.id}">
              ${NOTAS.map((valor) => html`<button type="button" class="nota n${valor}" aria-pressed="${celula.nota === valor ? 'true' : 'false'}" aria-label="Nota ${valor}" data-a="cp-nota" data-i="${i}:${coluna.id}:${valor}">${valor}</button>`)}
            </div>
            <label class="so-leitor" for="cp-texto-${i}-${coluna.id}">Transcrição ou resumo de ${coluna.label}</label>
            <textarea id="cp-texto-${i}-${coluna.id}" rows="2" maxlength="2000" data-c="cp-texto" data-i="${i}:${coluna.id}" placeholder="Transcrição literal conferida, com link original e arquivado">${celula.texto}</textarea>
          </div>`;
      })}
    </section>`;
}

function render() {
  if (!estado.dadosDoGrupo) {
    return html`${cabecalho('Provedores de IA generativa, lado a lado', 'Escolha um grupo para preencher o Anexo I.')}`;
  }
  const total = provedores().length;
  return html`
    ${cabecalho('Provedores de IA generativa, lado a lado', 'Anexo I: o grupo cria um conteúdo, lê os termos de cada ferramenta e compara quatro pontos. A nota usa a mesma régua do diagnóstico (0 a 3; quanto maior, mais opaco ou desfavorável).')}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="cartao-topo">
            <h2>Quadro comparativo</h2>
            ${segmento(estado.visao.comp.soDivergentes, 'Mostrar só onde divergem', 'cp-divergentes', '')}
          </div>
          <div data-regiao="quadro">${regiaoDoQuadro()}</div>
        </section>
        ${provedores().map(cartaoDoProvedor)}
        <div class="linha-acoes">
          <button type="button" class="botao primario" data-a="cp-adicionar"${atributo(total >= MAXIMO_DE_PROVEDORES, 'disabled')}>Incluir provedor</button>
          ${total ? '' : html`<button type="button" class="botao" data-a="cp-exemplo">Carregar o exemplo fictício</button>`}
          ${total >= MAXIMO_DE_PROVEDORES ? html`<span class="legenda">Limite de ${MAXIMO_DE_PROVEDORES} provedores.</span>` : ''}
        </div>
      </div>
      <aside class="coluna">
        <section class="cartao realce compacto"><h2>Leitura do quadro</h2><div class="pilha" data-regiao="analise">${regiaoDaAnalise()}</div></section>
        <section class="cartao">
          <div class="cartao-topo"><h3>Dados do grupo</h3>${emblema(grupoAtual() ? grupoAtual().nome : '')}</div>
          ${campo('cp-divergencia', 'Divergência que o grupo quer destacar', comparacao().divergencia_destacada, 'cp-divergencia', { linhas: 3, maximo: 2000, exemplo: 'Ex.: um provedor permite recusar o treinamento e outro não' })}
          <div><button type="button" class="botao" data-a="cp-exportar"${atributo(!total, 'disabled')}>Exportar Anexo I (CSV)</button></div>
        </section>
        <p class="aviso neutro" role="note">Cláusulas que transferem ao usuário o risco do conteúdo gerado são examinadas à luz do art. 51, I e IV, do CDC. A comparação mostra a divergência de mercado; ela não decide a validade da cláusula.</p>
      </aside>
    </div>`;
}

function exportar() {
  const grupo = grupoAtual() ? grupoAtual().nome : '';
  const linhas = [['Grupo', 'Provedor / ferramenta', ...COLUNAS.map((coluna) => `${coluna.label} (nota e texto)`), 'Subíndice (0 a 12)']]
    .concat(provedores().map((provedor, i) => [grupo, nomeDe(provedor, i),
      ...COLUNAS.map((coluna) => `${provedor.celulas[coluna.id].nota ?? 'sem nota'} · ${provedor.celulas[coluna.id].texto}`), subindice(provedor)]))
    .concat([[], ['Divergência destacada pelo grupo', comparacao().divergencia_destacada]]);
  baixarCsv(`anexo-I-comparacao-${dataDeHoje()}.csv`, linhas);
}

const exemploFicticio = () => ['A', 'B', 'C'].map((id) => {
  const item = DATA.prov.items[id];
  return { nome: `${item.name} (fictício)`, celulas: Object.fromEntries(COLUNAS.map((coluna) => [coluna.id, { nota: item[coluna.id][0], texto: item[coluna.id][1] }])) };
});

export const tela = {
  titulo: 'Comparação',
  render,
  regioes: (nome) => (nome === 'quadro' ? regiaoDoQuadro() : nome === 'analise' ? regiaoDaAnalise() : null),
  acoes: {
    'cp-divergentes': () => { estado.visao.comp.soDivergentes = !estado.visao.comp.soDivergentes; },
    'cp-adicionar': () => {
      definirProvedores([...provedores(), { nome: '', celulas: celulasVazias() }]);
      salvarAgora('comparacao', gravarComparacao);
    },
    'cp-exemplo': () => { definirProvedores(exemploFicticio()); salvarAgora('comparacao', gravarComparacao); },
    'cp-remover': async (indice) => {
      const i = Number(indice);
      const confirmado = await confirmar({
        titulo: 'Remover este provedor?',
        texto: `“${nomeDe(provedores()[i], i)}” sai do quadro com as notas e os textos. Não dá para desfazer.`,
        rotuloConfirmar: 'Remover provedor',
        destrutivo: true
      });
      if (confirmado) { definirProvedores(provedores().filter((_, posicao) => posicao !== i)); salvarAgora('comparacao', gravarComparacao); }
    },
    'cp-nota': (trio) => {
      const [indice, colunaId, valor] = trio.split(':');
      const atual = provedores()[Number(indice)].celulas[colunaId].nota;
      alterarCelula(Number(indice), colunaId, { nota: atual === Number(valor) ? null : Number(valor) });
      salvarAgora('comparacao', gravarComparacao);
    },
    'cp-exportar': exportar
  },
  campos: {
    'cp-nome': (valor, elemento) => { alterarProvedor(Number(elemento.dataset.i), { nome: valor }); agendarSalvamento('comparacao', gravarComparacao); },
    'cp-texto': (valor, elemento) => {
      const [indice, colunaId] = elemento.dataset.i.split(':');
      alterarCelula(Number(indice), colunaId, { texto: valor });
      agendarSalvamento('comparacao', gravarComparacao);
    },
    'cp-divergencia': (valor) => { alterarDadosDoGrupo('comparacao', { divergencia_destacada: valor }); agendarSalvamento('comparacao', gravarComparacao); }
  }
};
