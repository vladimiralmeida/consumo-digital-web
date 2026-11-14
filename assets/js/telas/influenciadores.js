/* Tela "Publicidade" (influenciadores): atores e checklist do anúncio, salvo no caso.
 * O arquivo não se chama publicidade.js porque bloqueadores de anúncio e antivírus barram esse nome. */
import { estado, alterarPacote, alternarMarcado, casoAtual } from '../estado.js';
import { gravarCaso } from '../gravar.js';
import { html } from '../html.js';
import { salvarAgora } from '../salvar.js';
import { aviso, avisoLegal, cabecalho, caixa, cartaoDeHipotese, emblema, segmento } from '../ui.js';

const DATA = window.DATA;
const visao = () => estado.visao.pub;

function render() {
  const caso = casoAtual();
  const marcados = caso ? caso.checklist_publicidade : [];
  return html`
    ${cabecalho('Um influenciador divulgou e você foi lesado: quem responde?', 'Anunciante, agência, influenciador e plataforma podem ser chamados. Cada camada tem seu fundamento e sua ressalva.')}
    <div class="avisos">${aviso('', 'Conferir.', 'A pergunta-problema é uma reconstrução do guia do módulo. As referências a normas e guias recentes (ECA Digital, CONAR) devem ser conferidas na fonte.')}</div>
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="pilha junta"><h2>Mapa de atores</h2><p class="apoio">Escolha um ator para ver a hipótese de responsabilização.</p></div>
          <div class="segmentos" role="group" aria-label="Atores da publicidade">
            ${Object.keys(DATA.atoresPub).map((id) => segmento(visao().ator === id, DATA.atoresPub[id].label, 'pb-ator', id, 'quadrado'))}
          </div>
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Checklist do anúncio</h2>${emblema(`${marcados.length} de ${DATA.checkPub.length}`)}</div>
          <p class="apoio">${caso ? html`Marque o que o caso “${caso.titulo}” comprova.` : html`Abra um caso na <a href="#/triagem">triagem</a> para marcar e salvar este checklist.`}</p>
          <div class="lista">
            ${DATA.checkPub.map((item, i) => caixa(marcados.includes(i), html`<strong>${item.ref}</strong> · ${item.text}`, 'pb-item', i, !caso))}
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

export const tela = {
  titulo: 'Publicidade',
  render,
  acoes: { 'pb-ator': (ator) => { visao().ator = ator; } },
  mudancas: {
    'pb-item': (indice) => {
      alterarPacote('caso', { checklist_publicidade: alternarMarcado(casoAtual().checklist_publicidade, Number(indice)) });
      salvarAgora('caso', gravarCaso);
    }
  }
};
