/* Ativos digitais: roteiro da oficina e registro de transações (Anexo II), salvos por grupo. */
import { api } from '../api.js';
import { estado, alterarDadosDoGrupo, alternarMarcado, grupoAtual } from '../estado.js';
import { baixarCsv, dataDeHoje } from '../exportar.js';
import { gravarAnotacoes } from '../gravar.js';
import { html } from '../html.js';
import { pedirRedesenho } from '../painel.js';
import { salvarAgora } from '../salvar.js';
import { aviso, avisoLegal, cabecalho, caixa, campo, confirmar, emblema } from '../ui.js';

const DATA = window.DATA;
const CAMPOS = [
  { id: 'integrante', rotulo: 'Integrante responsável' },
  { id: 'rede', rotulo: 'Rede utilizada', exemplo: 'Ex.: Polygon Amoy (rede de teste)' },
  { id: 'endereco_origem', rotulo: 'Endereço público de origem' },
  { id: 'endereco_destino', rotulo: 'Endereço público de destino' },
  { id: 'hash', rotulo: 'Código da transação (hash)' },
  { id: 'data_hora', rotulo: 'Data e hora' },
  { id: 'link_explorador', rotulo: 'Link do explorador', tipo: 'url', exemplo: 'https://' },
  { id: 'obs', rotulo: 'Observações do grupo', linhas: 2 }
];
const MENSAGENS_DE_SEGREDO = {
  frase: 'Isto parece uma frase de recuperação. O texto foi apagado: nunca registre a frase de recuperação.',
  chave: 'Isto parece uma chave privada. O texto foi apagado: registre só endereços públicos e o código da transação.'
};
const TAMANHO_DO_HASH_RESUMIDO = 14;

const visao = () => estado.visao.ativos;
const rascunhoVazio = () => Object.fromEntries(CAMPOS.map((item) => [item.id, '']));
const rascunho = () => visao().rascunho || rascunhoVazio();
const transacoes = () => estado.dadosDoGrupo.transacoes;
const resumir = (texto) => (texto.length > TAMANHO_DO_HASH_RESUMIDO ? `${texto.slice(0, TAMANHO_DO_HASH_RESUMIDO)}…` : texto);

function definirTransacoes(lista) {
  estado.dadosDoGrupo = { ...estado.dadosDoGrupo, transacoes: lista };
}

function limparFormulario() {
  estado.visao.ativos = { editando: null, rascunho: null, falhas: {}, falhaGeral: '' };
}

function formulario() {
  const { editando, falhas, falhaGeral } = visao();
  return html`
    <form class="cartao realce" data-f="at-salvar" novalidate>
      <div class="cartao-topo"><h2>${editando ? 'Editar transação' : 'Registrar transação'}</h2>${emblema('Anexo II')}</div>
      <p class="apoio">Registre só o endereço público e o código da transação. Frase de recuperação e chave privada são recusadas e apagadas da tela.</p>
      ${falhaGeral ? html`<p class="aviso erro" role="alert">${falhaGeral}</p>` : ''}
      ${CAMPOS.map((item) => campo(`at-${item.id}`, item.rotulo, rascunho()[item.id], 'at-campo', {
        indice: item.id, tipo: item.tipo, exemplo: item.exemplo, linhas: item.linhas, falha: falhas[item.id], maximo: item.linhas ? 2000 : 120
      }))}
      <div class="linha-acoes">
        <button type="submit" class="botao primario">${editando ? 'Salvar alterações' : 'Salvar transação'}</button>
        ${editando ? html`<button type="button" class="botao" data-a="at-cancelar">Cancelar</button>` : ''}
      </div>
    </form>`;
}

function listaDeTransacoes() {
  if (!transacoes().length) { return html`<p class="apoio">Nenhuma transação registrada pelo grupo ainda.</p>`; }
  return html`
    <ul class="lista">${transacoes().map((transacao) => html`
      <li class="item">
        <span><strong>${transacao.rede || 'Rede não informada'}</strong> · ${transacao.data_hora || 'sem data'}<br>
          <span class="legenda">${transacao.hash ? `hash ${resumir(transacao.hash)}` : 'sem código da transação'} · ${transacao.integrante || 'sem responsável'}</span></span>
        <span class="linha-acoes empurra">
          <button type="button" class="botao simples" data-a="at-editar" data-i="${transacao.id}" aria-label="Editar transação de ${transacao.data_hora || 'data não informada'}">Editar</button>
          <button type="button" class="botao simples destrutivo" data-a="at-excluir" data-i="${transacao.id}" aria-label="Excluir transação de ${transacao.data_hora || 'data não informada'}">Excluir</button>
        </span>
      </li>`)}
    </ul>`;
}

function render() {
  if (!estado.dadosDoGrupo) {
    return html`${cabecalho('Oficina blockchain: guardar, enviar e provar uma transação', 'Escolha um grupo para registrar o Anexo II.')}`;
  }
  const passos = estado.dadosDoGrupo.anotacoes.passos_ativos;
  return html`
    ${cabecalho('Oficina blockchain: guardar, enviar e provar uma transação', 'Em quatro passos cronometrados, o grupo faz uma transação de baixo valor, confere o resultado em um explorador público e registra no Anexo II. A prova on-chain tem alcance e limites.')}
    <div class="avisos">${aviso('', 'Regras de segurança.', 'Nunca informe a frase de recuperação nem a chave privada a ninguém, nem a esta interface. Use valor irrelevante e confira no guia a rede e a carteira indicadas.')}</div>
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="cartao-topo"><h2>Roteiro de 2 horas</h2>${emblema(`${passos.length} de ${DATA.passosAtivos.length}`)}</div>
          <div class="lista">
            ${DATA.passosAtivos.map((passo, i) => caixa(passos.includes(i), html`<strong>${passo.min} min · ${passo.titulo}</strong><br>${passo.texto}`, 'at-passo', i))}
          </div>
        </section>
        <section class="cartao">
          <div class="cartao-topo">
            <h2>Transações do grupo</h2>
            <button type="button" class="botao" data-a="at-exportar"${transacoes().length ? '' : html` disabled`}>Exportar Anexo II (CSV)</button>
          </div>
          ${listaDeTransacoes()}
        </section>
        <section class="cartao compacto">
          <h3>Prestadora autorizada e autocustódia</h3>
          <div class="duas">
            <div><strong>Prestadora autorizada</strong><span>Há uma empresa sujeita à Lei 14.478/2022 e às normas do Banco Central (Res. BCB 519 a 521/2025). Cabe reclamação ao fornecedor e discussão de responsabilidade pelo CDC.</span></div>
            <div><strong>Autocustódia</strong><span>Você controla a chave. Não há intermediário para reclamar, e a perda da chave costuma ser irreversível.</span></div>
          </div>
          <p class="legenda">Datas e alcance das resoluções: conferir na fonte oficial.</p>
        </section>
        <section class="cartao compacto">
          <h3>O que a prova blockchain mostra e não mostra</h3>
          <div class="duas">
            <div><strong>Mostra</strong><ul class="pontos"><li>Que a transação ocorreu, com data e hora.</li><li>Os endereços de origem e destino e o valor.</li><li>O código (hash) verificável por qualquer pessoa.</li></ul></div>
            <div><strong>Não mostra</strong><ul class="pontos"><li>Quem é o titular do endereço.</li><li>O motivo ou o acordo que levou à transação.</li><li>Se houve fraude ou erro de quem enviou.</li></ul></div>
          </div>
        </section>
      </div>
      <aside class="coluna">
        ${formulario()}
        <section class="cartao compacto">
          <h3>Perguntas para o debate</h3>
          <ul class="pontos">
            <li>A transação é prova suficiente de um contrato de consumo?</li>
            <li>Quem responde por uma transação irreversível feita por engano?</li>
            <li>A autocustódia afasta o CDC?</li>
          </ul>
        </section>
        ${avisoLegal()}
      </aside>
    </div>`;
}

function exportar() {
  const grupo = grupoAtual() ? grupoAtual().nome : '';
  const linhas = [['Grupo', ...CAMPOS.map((item) => item.rotulo)]]
    .concat(transacoes().map((transacao) => [grupo, ...CAMPOS.map((item) => transacao[item.id])]))
    .concat([[], ['Aviso', 'Não registre frase de recuperação nem chave privada.']]);
  baixarCsv(`anexo-II-transacao-${dataDeHoje()}.csv`, linhas);
}

async function salvarTransacao() {
  const { editando } = visao();
  try {
    if (editando) {
      const { transacao } = await api('PUT', `/transacoes/${editando}`, rascunho());
      definirTransacoes(transacoes().map((item) => (item.id === editando ? transacao : item)));
    } else {
      const { transacao } = await api('POST', `/grupos/${estado.grupoId}/transacoes`, rascunho());
      definirTransacoes([...transacoes(), transacao]);
    }
    limparFormulario();
  } catch (erro) {
    const falhas = Object.fromEntries(((erro.dados && erro.dados.campos) || []).map((item) => [item.campo, item.mensagem]));
    estado.visao.ativos = { ...visao(), falhas, falhaGeral: Object.keys(falhas).length ? '' : erro.message };
  }
}

export const tela = {
  titulo: 'Ativos digitais',
  render,
  acoes: {
    'at-editar': (id) => {
      const transacao = transacoes().find((item) => item.id === Number(id));
      estado.visao.ativos = { editando: transacao.id, rascunho: Object.fromEntries(CAMPOS.map((item) => [item.id, transacao[item.id]])), falhas: {}, falhaGeral: '' };
    },
    'at-cancelar': limparFormulario,
    'at-excluir': async (id) => {
      const confirmado = await confirmar({ titulo: 'Excluir esta transação?', texto: 'O registro sai do Anexo II do grupo. Não dá para desfazer.', rotuloConfirmar: 'Excluir transação', destrutivo: true });
      if (!confirmado) { return; }
      await api('DELETE', `/transacoes/${id}`);
      definirTransacoes(transacoes().filter((item) => item.id !== Number(id)));
      if (visao().editando === Number(id)) { limparFormulario(); }
    },
    'at-exportar': exportar
  },
  mudancas: {
    'at-passo': (indice) => {
      alterarDadosDoGrupo('anotacoes', { passos_ativos: alternarMarcado(estado.dadosDoGrupo.anotacoes.passos_ativos, Number(indice)) });
      salvarAgora('anotacoes', gravarAnotacoes);
    }
  },
  campos: {
    'at-campo': (valor, elemento) => {
      const nome = elemento.dataset.i;
      const segredo = window.Dominio.detectarSegredoDeCarteira(valor, nome === 'hash');
      /* Segredo de carteira não fica nem na tela nem na memória: apaga e explica. */
      estado.visao.ativos = {
        ...visao(),
        rascunho: { ...rascunho(), [nome]: segredo ? '' : valor },
        falhas: { ...visao().falhas, [nome]: segredo ? MENSAGENS_DE_SEGREDO[segredo] : '' }
      };
      if (segredo) { pedirRedesenho(); }
    }
  },
  formularios: { 'at-salvar': salvarTransacao }
};
