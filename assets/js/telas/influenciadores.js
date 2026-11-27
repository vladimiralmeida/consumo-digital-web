/* Tela "Publicidade" (influenciadores): atores e checklist do anúncio, verificado pela IA e revisado pelo grupo.
 * O arquivo não se chama publicidade.js porque bloqueadores de anúncio e antivírus barram esse nome. */
import { api } from '../api.js';
import { estado, alterarPacote, casoAtual } from '../estado.js';
import { gravarAnuncio } from '../gravar.js';
import { html, atributo } from '../html.js';
import { pedirRedesenho } from '../painel.js';
import { agendarSalvamento, descarregarAgendados, salvarAgora } from '../salvar.js';
import { aviso, avisoLegal, cabecalho, campo, cartaoDeHipotese, confirmar, emblema, segmento } from '../ui.js';

const DATA = window.DATA;
const PONTOS = DATA.checkPub;
const RESPOSTAS = ['sim', 'nao', 'indeterminado'];
const ROTULOS = {
  conformidade: { sim: 'Atende', nao: 'Não atende', indeterminado: 'Não dá para saber' },
  fato: { sim: 'Sim', nao: 'Não', indeterminado: 'Não dá para saber' }
};
const PONTO_VAZIO = Object.freeze({ resposta: null, justificativa: '', trecho: '', conferido: null, origem: 'grupo' });

const visao = () => estado.visao.pub;
const analiseDoAnuncio = () => (casoAtual() ? casoAtual().anuncio_analise : []);
const pontoDo = (indice) => analiseDoAnuncio().find((ponto) => ponto.item === indice) || { ...PONTO_VAZIO, item: indice };
const rotuloDa = (indice, resposta) => ROTULOS[PONTOS[indice].tipo][resposta];

function alterarPonto(indice, mudancas) {
  const outros = analiseDoAnuncio().filter((ponto) => ponto.item !== indice);
  const pontos = [...outros, { ...pontoDo(indice), ...mudancas }].sort((a, b) => a.item - b.item);
  alterarPacote('caso', { anuncio_analise: pontos });
}

/** Contagem dos pontos de conformidade por situação, para o resumo no topo do checklist. */
function resumo() {
  const conformidade = PONTOS.map((ponto, i) => ({ ponto, resposta: pontoDo(i).resposta })).filter(({ ponto }) => ponto.tipo === 'conformidade');
  const contar = (resposta) => conformidade.filter((item) => item.resposta === resposta).length;
  return { atendem: contar('sim'), naoAtendem: contar('nao'), aVerificar: conformidade.length - contar('sim') - contar('nao'), total: conformidade.length };
}

function regiaoDoResumo() {
  const { atendem, naoAtendem, aVerificar, total } = resumo();
  return html`
    <div class="segmentos" role="status">
      ${emblema(`${atendem} de ${total} atendem`, atendem ? 'ok' : '')}
      ${emblema(`${naoAtendem} não atendem`, naoAtendem ? 'alerta' : '')}
      ${emblema(`${aVerificar} a verificar`)}
    </div>`;
}

function emblemaDaSituacao(indice) {
  const { resposta } = pontoDo(indice);
  if (resposta === null) { return emblema('Sem resposta'); }
  const tipo = PONTOS[indice].tipo === 'conformidade' && resposta !== 'indeterminado' ? (resposta === 'sim' ? 'ok' : 'alerta') : '';
  return emblema(rotuloDa(indice, resposta), tipo);
}

function regiaoDoTrecho(indice) {
  const ponto = pontoDo(indice);
  if (!ponto.trecho) { return ''; }
  return html`
    <blockquote>${ponto.trecho}</blockquote>
    <div>${ponto.conferido === true ? emblema('✓ Trecho conferido no texto do anúncio', 'ok') : ponto.conferido === false ? emblema('! Trecho NÃO CONFERIDO no texto do anúncio', 'alerta') : ''}</div>`;
}

function cartaoDoPonto(definicao, indice) {
  const ponto = pontoDo(indice);
  const semCaso = !casoAtual();
  return html`
    <div class="item-do-checklist">
      <div class="entre">
        <span class="item-do-checklist-texto"><strong>${definicao.ref}</strong> · ${definicao.text}</span>
        <span class="linha-acoes">${ponto.origem === 'ia' && ponto.resposta !== null ? emblema('IA', 'ia') : ''}${emblemaDaSituacao(indice)}</span>
      </div>
      <div class="segmentos" role="group" aria-label="Resposta para ${definicao.ref}">
        ${RESPOSTAS.map((resposta) => html`
          <button type="button" class="segmento" aria-pressed="${ponto.resposta === resposta ? 'true' : 'false'}" data-a="pb-resposta" data-i="${indice}:${resposta}"${atributo(semCaso, 'disabled')}>${rotuloDa(indice, resposta)}</button>`)}
      </div>
      ${definicao.efeito ? html`<p class="legenda">${definicao.efeito}</p>` : ''}
      <div class="pilha junta" data-regiao="trecho-${indice}">${regiaoDoTrecho(indice)}</div>
      ${ponto.resposta !== null || ponto.justificativa ? campo(`pb-justificativa-${indice}`, 'Justificativa', ponto.justificativa, 'pb-justificativa', { indice, linhas: 2, maximo: 2000 }) : ''}
    </div>`;
}

function regiaoDaAcao() {
  const { verificando, falha } = visao();
  const temTexto = Boolean(casoAtual() && casoAtual().anuncio_texto.trim());
  if (!estado.ia.disponivel) {
    return html`<p class="aviso neutro" role="note"><strong>IA desativada neste servidor.</strong> O grupo responde cada ponto do checklist à mão.</p>`;
  }
  return html`
    ${falha ? html`<p class="aviso erro" role="alert">${falha}</p>` : ''}
    <div class="linha-acoes">
      <button type="button" class="botao primario" data-a="pb-verificar"${atributo(verificando || !temTexto, 'disabled')}>${verificando ? 'Verificando o anúncio…' : 'Verificar o anúncio com IA'}</button>
      ${temTexto ? '' : html`<span class="legenda">Transcreva ou descreva o anúncio para liberar a verificação.</span>`}
    </div>
    <p class="legenda">A IA (${estado.ia.ferramenta}) lê o texto acima e responde os ${PONTOS.length} pontos do checklist com justificativa e trecho. O texto é enviado ao serviço de IA. O trecho é conferido por comparação com o anúncio, e a resposta final é do grupo.</p>`;
}

function cartaoDoAnuncio() {
  const caso = casoAtual();
  if (!caso) {
    return html`<section class="cartao"><h2>Anúncio</h2><p class="apoio">Abra um caso na <a href="#/triagem">triagem</a> para registrar o anúncio e verificar o checklist.</p></section>`;
  }
  return html`
    <section class="cartao">
      <div class="pilha junta"><h2>Anúncio</h2><p class="apoio">Caso “${caso.titulo}”. Cole a legenda, a transcrição da fala e as marcações da publicação, ou descreva o que aparece nela.</p></div>
      ${campo('pb-texto', 'Texto ou descrição do anúncio', caso.anuncio_texto, 'pb-texto', {
        linhas: 6, maximo: 20000,
        dica: 'Ex.: legenda, hashtags, aviso de parceria, preço, prazo, promessas, plataforma e público. Não inclua dados pessoais de terceiros.'
      })}
      <div class="pilha" data-regiao="acao">${regiaoDaAcao()}</div>
    </section>`;
}

function render() {
  return html`
    ${cabecalho('Um influenciador divulgou e você foi lesado: quem responde?', 'Anunciante, agência, influenciador e plataforma podem ser chamados. Registre o anúncio e veja, ponto a ponto, o que ele atende e o que não atende.')}
    <div class="avisos">${aviso('', 'Conferir.', 'A pergunta-problema é uma reconstrução do guia do módulo. As referências a normas e guias recentes (ECA Digital, CONAR) devem ser conferidas na fonte.')}</div>
    <div class="colunas">
      <div class="coluna">
        ${cartaoDoAnuncio()}
        <section class="cartao">
          <div class="cartao-topo"><h2>Checklist do anúncio</h2><div data-regiao="resumo">${regiaoDoResumo()}</div></div>
          <p class="apoio">Quatro pontos de conformidade com o CDC e dois fatos que mudam o regime aplicável. A IA sugere; o grupo confirma ou corrige cada resposta.</p>
          <div class="pontos-do-checklist">${PONTOS.map(cartaoDoPonto)}</div>
        </section>
        <section class="cartao">
          <div class="pilha junta"><h2>Mapa de atores</h2><p class="apoio">Escolha um ator para ver a hipótese de responsabilização.</p></div>
          <div class="segmentos" role="group" aria-label="Atores da publicidade">
            ${Object.keys(DATA.atoresPub).map((id) => segmento(visao().ator === id, DATA.atoresPub[id].label, 'pb-ator', id, 'quadrado'))}
          </div>
        </section>
      </div>
      <aside class="coluna">
        ${cartaoDeHipotese(DATA.atoresPub[visao().ator])}
        <section class="cartao compacto">
          <h3>Debate: a autorregulação basta?</h3>
          <p class="apoio">O CONAR orienta a identificação da publicidade por influenciadores, mas suas decisões não são lei. O CDC (art. 36) impõe a identificação por qualquer meio.</p>
          <ul class="pontos">
            <li>Uma etiqueta “publi” escondida na legenda cumpre o art. 36?</li>
            <li>A plataforma deve ser chamada a responder quando lucra com o impulsionamento?</li>
            <li>O influenciador responde pelo produto ou só pela divulgação?</li>
          </ul>
        </section>
        ${avisoLegal()}
      </aside>
    </div>`;
}

/** Pede à IA a verificação dos pontos. Se o grupo já respondeu algum, confirma antes de substituir. */
async function verificar(substituir = false) {
  const casoId = casoAtual().id;
  estado.visao.pub = { ...visao(), verificando: true, falha: '' };
  pedirRedesenho();
  try {
    await descarregarAgendados();
    const { caso, consultas } = await api('POST', `/casos/${casoId}/anuncio/ia`, { substituir });
    if (estado.pacote && estado.pacote.caso.id === casoId) { estado.pacote = { ...estado.pacote, caso, consultas }; }
  } catch (erro) {
    if (erro.dados && erro.dados.codigo === 'resposta_do_grupo') {
      estado.visao.pub = { ...visao(), verificando: false };
      const confirmado = await confirmar({
        titulo: 'Substituir as respostas do grupo?',
        texto: 'O checklist já tem respostas dadas pelo grupo. A verificação da IA vai tomar o lugar de todas elas.',
        rotuloConfirmar: 'Substituir pela verificação'
      });
      if (confirmado) { await verificar(true); }
      return;
    }
    estado.visao.pub = { ...visao(), falha: erro.message };
  } finally {
    estado.visao.pub = { ...visao(), verificando: false };
  }
}

export const tela = {
  titulo: 'Publicidade',
  render,
  regioes: (nome) => {
    if (nome === 'acao') { return casoAtual() ? regiaoDaAcao() : null; }
    if (nome === 'resumo') { return regiaoDoResumo(); }
    if (nome.startsWith('trecho-')) { return regiaoDoTrecho(Number(nome.split('-')[1])); }
    return null;
  },
  acoes: {
    'pb-ator': (ator) => { visao().ator = ator; },
    'pb-verificar': () => verificar(),
    'pb-resposta': (par) => {
      const [indice, resposta] = par.split(':');
      const atual = pontoDo(Number(indice)).resposta;
      alterarPonto(Number(indice), { resposta: atual === resposta ? null : resposta, origem: 'grupo' });
      salvarAgora('anuncio', gravarAnuncio);
    }
  },
  campos: {
    'pb-texto': (valor) => { alterarPacote('caso', { anuncio_texto: valor }); agendarSalvamento('anuncio', gravarAnuncio); },
    'pb-justificativa': (valor, elemento) => {
      alterarPonto(Number(elemento.dataset.i), { justificativa: valor, origem: 'grupo' });
      agendarSalvamento('anuncio', gravarAnuncio);
    }
  }
};
