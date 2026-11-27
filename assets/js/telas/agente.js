/* Agente de IA: mapa de atores e hipóteses de responsabilização. Tela de consulta, nada é salvo. */
import { estado } from '../estado.js';
import { html } from '../html.js';
import { aviso, avisoLegal, cabecalho, cartaoDeHipotese, segmento } from '../ui.js';

const DATA = window.DATA;
const CADEIA = ['usuario', 'agente', 'marketplace', 'vendedor'];
const visao = () => estado.visao.agente;

function render() {
  const atores = DATA.atoresAgente;
  return html`
    ${cabecalho('Se um agente de IA compra por você, quem responde?', 'A plataforma diz ser “mera intermediária”. O STF mandou aplicar o CDC ao marketplace, mas também afirmou que não haverá responsabilidade objetiva na aplicação da tese. Com um agente no meio, a pergunta fica mais difícil.')}
    <div class="avisos">${aviso('info', 'Questão em aberto.', 'Não há resposta consolidada na lei nem na jurisprudência. As camadas abaixo são hipóteses de trabalho, cada uma com seu fundamento e sua ressalva.')}</div>
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="pilha junta"><h2>Mapa de atores</h2><p class="apoio">Escolha um ator para ver a hipótese de responsabilização.</p></div>
          <div class="segmentos" role="group" aria-label="Atores da compra">
            ${CADEIA.map((id, i) => html`${segmento(visao().ator === id, atores[id].label, 'ag-ator', id, 'quadrado')}${i < CADEIA.length - 1 ? html`<span class="seta" aria-hidden="true">→</span>` : ''}`)}
          </div>
          <div class="segmentos"><span class="seta apoio">Pago por</span>${segmento(visao().ator === 'pagamento', atores.pagamento.label, 'ag-ator', 'pagamento', 'quadrado')}</div>
        </section>
        <section class="cartao">
          <h2>O que o agente fez?</h2>
          <div class="segmentos" role="group" aria-label="Cenário">
            ${Object.keys(DATA.cenariosAgente).map((id) => segmento(visao().cenario === id, DATA.cenariosAgente[id].label, 'ag-cenario', id))}
          </div>
          <p>${DATA.cenariosAgente[visao().cenario].text}</p>
        </section>
        <section class="cartao">
          <h2>Provas específicas</h2>
          <ul class="pontos">${DATA.provasAgente.map((prova) => html`<li>${prova}</li>`)}</ul>
        </section>
      </div>
      <aside class="coluna">
        ${cartaoDeHipotese(atores[visao().ator])}
        <section class="cartao compacto">
          <h3>Caminho prático</h3>
          <p class="apoio">Reclame primeiro ao fornecedor do agente e, em paralelo, ao vendedor ou ao marketplace. Peça cancelamento, estorno e informações sobre o funcionamento do agente.</p>
          <div><a class="botao" href="#/triagem">Abrir a triagem do caso</a></div>
        </section>
        ${avisoLegal()}
      </aside>
    </div>`;
}

export const tela = {
  titulo: 'Agente de IA',
  render,
  acoes: {
    'ag-ator': (ator) => { visao().ator = ator; },
    'ag-cenario': (cenario) => { visao().cenario = cenario; }
  }
};
