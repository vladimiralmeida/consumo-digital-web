/* Dados e decisões automatizadas: cenários e minuta de pedido ao fornecedor. A minuta não é salva. */
import { estado } from '../estado.js';
import { baixar, dataDeHoje } from '../exportar.js';
import { html } from '../html.js';
import { aviso, avisoLegal, cabecalho, campo, segmento } from '../ui.js';

const DATA = window.DATA;
const visao = () => estado.visao.dados;

function minuta() {
  const cenario = DATA.cenDados[visao().cenario];
  const fornecedor = visao().fornecedor.trim() || '[fornecedor]';
  return `A/C do Encarregado de Dados de ${fornecedor}\n\nCom fundamento no art. 18 e, quando cabível, no art. 20 da Lei 13.709/2018 (LGPD), requeiro: (i) informações claras sobre ${cenario.pedido}; (ii) os critérios e procedimentos utilizados, observados os segredos comercial e industrial; (iii) a revisão da decisão, quando tomada apenas por tratamento automatizado; (iv) a correção de dados incompletos ou incorretos.\n\nRequeiro resposta no prazo legal e por escrito.\n\n[Local, data e identificação do titular]`;
}

function render() {
  const cenario = DATA.cenDados[visao().cenario];
  return html`
    ${cabecalho('Um sistema decidiu sobre você. Você tem como saber por quê?', 'Preço personalizado, score de crédito, recusa automática, dispositivos conectados: em cada cenário, a LGPD e o CDC dão ferramentas para pedir explicação e revisão.')}
    <div class="avisos">${aviso('', 'Limite.', 'A LGPD protege os segredos comercial e industrial do controlador (art. 20, § 1º). Por isso o pedido deve ser específico e a resposta pode vir parcial. Se vier recusa sem justificativa, a ANPD pode ser acionada.')}</div>
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <h2>Qual foi a decisão?</h2>
          <div class="segmentos" role="group" aria-label="Cenário">
            ${Object.keys(DATA.cenDados).map((id) => segmento(visao().cenario === id, DATA.cenDados[id].label, 'dd-cenario', id))}
          </div>
          <p>${cenario.texto}</p>
          <div class="pilha junta"><span class="rotulo">Fundamento</span><p class="apoio">${cenario.base}</p></div>
        </section>
        <section class="cartao compacto">
          <h3>Debate: o consumidor percebe?</h3>
          <ul class="pontos">
            <li>Quem vê um preço diferente do vizinho percebe que foi decidido por um sistema?</li>
            <li>A explicação “critérios internos” atende ao dever de informação?</li>
            <li>Revisão humana é direito ou favor?</li>
          </ul>
        </section>
      </div>
      <aside class="coluna">
        <section class="cartao realce">
          <div class="pilha junta"><h2>Minuta de pedido ao fornecedor</h2><p class="apoio">Informe o fornecedor e exporte o texto. Esta minuta não é salva no servidor.</p></div>
          ${campo('dd-fornecedor', 'Nome do fornecedor', visao().fornecedor, 'dd-fornecedor', { exemplo: 'Ex.: Plataforma Exemplo', maximo: 120 })}
          <div class="previa" data-regiao="minuta">${minuta()}</div>
          <div><button type="button" class="botao" data-a="dd-exportar">Exportar minuta (TXT)</button></div>
        </section>
        <p class="aviso neutro" role="note">Guarde a data do pedido e o número de protocolo. Sem resposta no prazo, o passo seguinte é a reclamação ao Procon e à ANPD.</p>
        ${avisoLegal()}
      </aside>
    </div>`;
}

export const tela = {
  titulo: 'Dados',
  render,
  regioes: (nome) => (nome === 'minuta' ? html`${minuta()}` : null),
  acoes: {
    'dd-cenario': (cenario) => { visao().cenario = cenario; },
    'dd-exportar': () => baixar(`pedido-lgpd-${dataDeHoje()}.txt`, minuta().replace(/\n/g, '\r\n'))
  },
  campos: { 'dd-fornecedor': (valor) => { visao().fornecedor = valor; } }
};
