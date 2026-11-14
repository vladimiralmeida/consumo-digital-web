/*
 * Trilha do caso: as cinco etapas do trabalho, em que ponto o grupo está e qual é o próximo
 * passo. A situação de cada etapa é calculada a partir do que já foi salvo.
 */
import { estado, indiceEmTela } from './estado.js';
import { html } from './html.js';

const DATA = window.DATA;

function situacao() {
  const pacote = estado.pacote;
  if (!pacote) { return { caso: false, termos: false, analise: false, conferencia: false, parecer: false, respondidas: 0, naoConferidos: 0, sugestoesDaIa: 0 }; }
  const indice = indiceEmTela();
  const respondidas = pacote.respostas.filter((resposta) => resposta.nota !== null).length;
  const naoConferidos = pacote.respostas.filter((resposta) => resposta.conferido === false).length;
  const analise = respondidas === DATA.dims.length;
  const sugestoesDaIa = pacote.respostas.filter((resposta) => resposta.origem === 'ia').length;
  return {
    caso: true,
    termos: Boolean(pacote.diagnostico.texto_fonte.trim()),
    analise,
    conferencia: analise && indice.completo && naoConferidos === 0,
    parecer: Boolean(pacote.parecer.texto.trim()) && pacote.parecer.validado_humano,
    respondidas,
    naoConferidos,
    sugestoesDaIa
  };
}

/** As etapas, na ordem, cada uma com a tela onde é feita e o que falta. */
export function etapasDoCaso() {
  const s = situacao();
  const total = DATA.dims.length;
  return [
    { id: 'caso', nome: 'Caso', rota: 'triagem', feita: s.caso, falta: 'Abra um caso e escolha o tipo de problema.', acao: 'Abrir a triagem' },
    { id: 'termos', nome: 'Termos de uso', rota: 'triagem', ancora: 'termos', feita: s.termos, falta: 'Informe o link dos termos e busque a cópia arquivada, ou cole o texto.', acao: 'Informar os termos de uso' },
    { id: 'analise', nome: 'Análise de opacidade', rota: 'triagem', ancora: 'termos', feita: s.analise, detalhe: s.caso ? `${s.respondidas} de ${total}` : '', falta: `${total - s.respondidas} dimensão(ões) da régua de opacidade ainda sem nota. Analise com IA ou responda à mão.`, acao: 'Analisar a opacidade' },
    { id: 'conferencia', nome: 'Conferência', rota: 'diagnostico', feita: s.conferencia, detalhe: s.naoConferidos ? `${s.naoConferidos} a conferir` : s.sugestoesDaIa ? `${s.sugestoesDaIa} sugestões da IA` : '', falta: s.naoConferidos ? `${s.naoConferidos} trecho(s) não foram encontrados no documento. Confira cada um no original e ajuste.` : 'Revise as notas e os trechos no diagnóstico.', acao: 'Revisar no diagnóstico' },
    { id: 'parecer', nome: 'Parecer', rota: 'parecer', feita: s.parecer, falta: 'Redija o parecer e marque a validação humana.', acao: 'Redigir o parecer' }
  ];
}

const destino = (etapa) => `#/${etapa.rota}${etapa.ancora ? `?ir=${etapa.ancora}` : ''}`;

/** Indicador de etapas no topo das telas do caso. A etapa em andamento leva aria-current="step". */
export function trilha() {
  if (!estado.pacote) { return ''; }
  const etapas = etapasDoCaso();
  const atual = etapas.findIndex((etapa) => !etapa.feita);
  return html`
    <nav class="trilha" aria-label="Etapas do caso">
      <ol>
        ${etapas.map((etapa, i) => html`
          <li class="${etapa.feita ? 'feita' : i === atual ? 'atual' : ''}">
            <a href="${destino(etapa)}"${i === atual ? html` aria-current="step"` : ''}>
              <span class="trilha-marca" aria-hidden="true">${etapa.feita ? '✓' : i + 1}</span>
              <span class="trilha-texto"><span class="trilha-nome">${etapa.nome}</span>${etapa.detalhe ? html`<span class="trilha-detalhe">${etapa.detalhe}</span>` : ''}</span>
              <span class="so-leitor">${etapa.feita ? '(concluída)' : i === atual ? '(etapa atual)' : '(pendente)'}</span>
            </a>
          </li>`)}
      </ol>
    </nav>`;
}

/**
 * Cartão "próximo passo" no fim da tela. `rotaAtual` evita oferecer um link para a própria
 * tela: nesse caso mostra só o que falta fazer aqui.
 */
export function proximoPasso(rotaAtual) {
  if (!estado.pacote) { return ''; }
  const etapas = etapasDoCaso();
  const proxima = etapas.find((etapa) => !etapa.feita);
  if (!proxima) {
    return html`
      <section class="cartao proximo" aria-label="Próximo passo">
        <div class="pilha junta"><span class="rotulo">Tudo pronto</span><p><strong>As cinco etapas do caso estão concluídas.</strong> Exporte a ficha, o apêndice e os anexos quando quiser.</p></div>
        ${rotaAtual === 'parecer' ? '' : html`<a class="botao" href="#/parecer">Abrir o parecer</a>`}
      </section>`;
  }
  const numero = etapas.indexOf(proxima) + 1;
  const aqui = proxima.rota === rotaAtual;
  return html`
    <section class="cartao proximo" aria-label="Próximo passo">
      <div class="pilha junta"><span class="rotulo">Próximo passo · etapa ${numero} de ${etapas.length}</span><p><strong>${proxima.nome}.</strong> ${proxima.falta}</p></div>
      ${aqui && !proxima.ancora ? '' : html`<a class="botao ${aqui ? '' : 'primario'}" href="${destino(proxima)}">${proxima.acao}</a>`}
    </section>`;
}
