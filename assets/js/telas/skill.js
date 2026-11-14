/* Skill v0.2: achados do módulo, higiene do repositório (salva por grupo) e entregas. */
import { estado, alterarDadosDoGrupo, alternarMarcado } from '../estado.js';
import { gravarAnotacoes } from '../gravar.js';
import { html } from '../html.js';
import { salvarAgora } from '../salvar.js';
import { aviso, cabecalho, caixa, emblema } from '../ui.js';

const DATA = window.DATA;
const MILISSEGUNDOS_POR_DIA = 86400000;
const MENSAGEM_DE_COMMIT = [
  'Skill v0.2: auditoria de Termos de provedores de IA', '',
  '- adiciona perguntas P5.1 a P5.4 (módulo IA generativa)',
  '- subíndice 0 a 12, separado do índice base',
  '- regras de segurança sobre carteira e dados pessoais'
].join('\n');
const visao = () => estado.visao.skill;

function prazo(entrega) {
  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dias = Math.round((new Date(entrega.iso).getTime() - hoje) / MILISSEGUNDOS_POR_DIA);
  const [, mes, dia] = entrega.iso.split('-');
  const situacao = dias < 0 ? `Prazo passado há ${-dias} dia(s)` : dias === 0 ? 'É hoje' : `Faltam ${dias} dia(s)`;
  return html`<div class="prazo ${dias < 0 ? 'passado' : dias === 0 ? 'hoje' : ''}"><strong>${dia}/${mes} · ${entrega.titulo}</strong><span class="legenda">${situacao}</span></div>`;
}

function achado(item, i) {
  const aberto = visao().aberto === i;
  return html`
    <div class="abre ${aberto ? 'aberta' : ''}">
      <button type="button" aria-expanded="${aberto ? 'true' : 'false'}" data-a="sk-abrir" data-i="${i}">
        <span class="titulo">${item.pid} · ${item.titulo}</span><span class="sinal" aria-hidden="true">${aberto ? '−' : '+'}</span>
      </button>
      ${aberto ? html`<div class="abre-corpo"><p><strong>Passo:</strong> ${item.passo}</p><p><strong>Regra:</strong> ${item.regra}</p><p><strong>Referência:</strong> ${item.ref}</p></div>` : ''}
    </div>`;
}

function render() {
  const higiene = estado.dadosDoGrupo ? estado.dadosDoGrupo.anotacoes.higiene : [];
  return html`
    ${cabecalho('Da skill v0.1 à v0.2: o que muda e o que entregar', 'O módulo 2 acrescenta à skill a auditoria de termos de provedores de IA generativa. Esta tela liga cada achado a um passo, uma regra e uma referência, e organiza as entregas e a higiene do repositório.')}
    <div class="avisos">${aviso('', 'Prazos.', 'As datas seguem o guia do módulo e o e-mail do professor; confirme cada uma antes de contar com ela. Os dias restantes são calculados pela data do seu aparelho.')}</div>
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="pilha junta"><h2>Achados do módulo e mudança na skill</h2><p class="apoio">Abra um achado para ver o passo da skill, a regra e a referência.</p></div>
          <div>${DATA.achadosSkill.map(achado)}</div>
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Higiene do repositório</h2>${emblema(`${higiene.length} de ${DATA.higiene.length}`)}</div>
          <p class="apoio">Confira antes de cada commit.</p>
          <div class="lista">${DATA.higiene.map((item, i) => caixa(higiene.includes(i), item, 'sk-higiene', i, !estado.dadosDoGrupo))}</div>
        </section>
      </div>
      <aside class="coluna">
        <section class="cartao realce">
          <h2>Entregas</h2>
          <div class="pilha">${DATA.entregas.map(prazo)}</div>
        </section>
        <section class="cartao compacto">
          <h3>Mensagem de commit sugerida</h3>
          <div class="codigo">${MENSAGEM_DE_COMMIT}</div>
        </section>
        <section class="cartao compacto">
          <h3>Equipe do protótipo</h3>
          <ul class="pontos">${DATA.equipe.map((nome) => html`<li>${nome}</li>`)}</ul>
        </section>
        <p class="aviso neutro" role="note"><strong>Rastreabilidade.</strong> Para cada cláusula citada: link original, link arquivado na Wayback Machine e data de acesso. A validação humana e a declaração de uso de IA são preenchidas pelo grupo, nunca pela skill.</p>
      </aside>
    </div>`;
}

export const tela = {
  titulo: 'Skill v0.2 e entregas',
  render,
  acoes: { 'sk-abrir': (indice) => { visao().aberto = visao().aberto === Number(indice) ? -1 : Number(indice); } },
  mudancas: {
    'sk-higiene': (indice) => {
      alterarDadosDoGrupo('anotacoes', { higiene: alternarMarcado(estado.dadosDoGrupo.anotacoes.higiene, Number(indice)) });
      salvarAgora('anotacoes', gravarAnotacoes);
    }
  }
};
