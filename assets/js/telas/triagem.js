/* Triagem: o caso do grupo, o tipo de problema e as provas a guardar. */
import { criarCaso, excluirCasoAtual } from '../dados.js';
import { estado, alterarPacote, alternarMarcado, casoAtual, ehGestor } from '../estado.js';
import { gravarCaso } from '../gravar.js';
import { html } from '../html.js';
import { agendarSalvamento, salvarAgora } from '../salvar.js';
import { avisoLegal, cabecalho, caixa, campo, confirmar, emblema, segmento } from '../ui.js';

const DATA = window.DATA;

function semGrupo() {
  return html`
    <section class="cartao vazio">
      <h2>Nenhum grupo cadastrado</h2>
      ${ehGestor()
        ? html`<p>Crie o primeiro grupo e as contas dos alunos para começar.</p><a class="botao primario" href="#/contas">Abrir contas e grupos</a>`
        : html`<p>Sua conta ainda não está ligada a um grupo. Fale com o professor.</p>`}
    </section>`;
}

function formularioDeCaso(primeiro) {
  const { falha } = estado.visao.novoCaso;
  return html`
    <form class="cartao" data-f="tri-criar" novalidate>
      <div class="pilha junta">
        <h2>${primeiro ? 'Abrir o primeiro caso' : 'Novo caso'}</h2>
        <p class="apoio">Um caso reúne a triagem, o diagnóstico dos termos e o parecer. Tudo fica salvo para o grupo.</p>
      </div>
      ${falha ? html`<p class="aviso erro" role="alert">${falha}</p>` : ''}
      <div class="campo">
        <label for="novo-titulo">Nome do caso</label>
        <input id="novo-titulo" name="titulo" type="text" maxlength="120" required placeholder="Ex.: Termos de uso da Loja Exemplo">
      </div>
      <div class="campo">
        <label for="novo-tipo">Tipo de problema</label>
        <select id="novo-tipo" name="tipo">${DATA.tipos.map((tipo) => html`<option value="${tipo.id}">${tipo.label}</option>`)}</select>
      </div>
      <div class="campo">
        <label for="novo-descricao">Descrição curta (opcional)</label>
        <textarea id="novo-descricao" name="descricao_curta" rows="2" maxlength="500"></textarea>
        <span class="dica">Não inclua dados pessoais de ninguém.</span>
      </div>
      <div class="lista">
        <label class="item"><input type="checkbox" name="exemplo"><span><strong>Começar com o exemplo fictício.</strong> Preenche o diagnóstico com a “Plataforma Exemplo”, para ver como a tela funciona.</span></label>
      </div>
      <div class="linha-acoes">
        <button class="botao primario" type="submit">Criar caso</button>
        ${primeiro ? '' : html`<button class="botao" type="button" data-a="tri-cancelar">Cancelar</button>`}
      </div>
    </form>`;
}

function regime(caso) {
  const tipo = DATA.tipos.find((item) => item.id === caso.tipo) || DATA.tipos[0];
  return html`
    <section class="cartao realce">
      <div class="cartao-topo"><h2>${tipo.title}</h2>${emblema(tipo.status)}</div>
      <p>${tipo.text}</p>
      ${tipo.rota ? html`<div><a class="botao" href="#/${tipo.rota}">Abrir a tela do tema</a></div>` : ''}
    </section>`;
}

function render() {
  if (!estado.grupoId) { return semGrupo(); }
  const caso = casoAtual();
  const topo = cabecalho('O que aconteceu?', 'Escolha o tipo de problema. A triagem mostra o regime jurídico provável e as provas que valem a pena guardar.');
  if (!caso) { return html`${topo}<div class="colunas"><div class="coluna">${formularioDeCaso(true)}</div></div>`; }
  if (estado.visao.novoCaso.aberto) { return html`${topo}<div class="colunas"><div class="coluna">${formularioDeCaso(false)}</div></div>`; }
  const marcadas = caso.provas.length;
  return html`
    ${topo}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <div class="cartao-topo">
            <h2>Caso</h2>
            <div class="linha-acoes">
              <button class="botao" type="button" data-a="tri-novo">Novo caso</button>
              <button class="botao simples destrutivo" type="button" data-a="tri-excluir">Excluir caso</button>
            </div>
          </div>
          ${campo('caso-titulo', 'Nome do caso', caso.titulo, 'tri-titulo', { maximo: 120 })}
          ${campo('caso-descricao', 'Descrição curta', caso.descricao_curta, 'tri-descricao', { linhas: 2, maximo: 500, dica: 'Não inclua dados pessoais de ninguém.' })}
        </section>
        <section class="cartao">
          <h2>Tipo de problema</h2>
          <div class="segmentos" role="group" aria-label="Tipo de problema">
            ${DATA.tipos.map((tipo) => segmento(caso.tipo === tipo.id, tipo.label, 'tri-tipo', tipo.id))}
          </div>
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Provas a guardar</h2>${emblema(`${marcadas} de ${DATA.provas.length}`)}</div>
          <div class="lista">${DATA.provas.map((prova, i) => caixa(caso.provas.includes(i), prova, 'tri-prova', i))}</div>
        </section>
      </div>
      <aside class="coluna">${regime(caso)}${avisoLegal()}</aside>
    </div>`;
}

const sincronizarLista = () => {
  const caso = casoAtual();
  estado.casos = estado.casos.map((item) => (item.id === caso.id ? { ...item, titulo: caso.titulo } : item));
};

export const tela = {
  titulo: 'Triagem do caso',
  render,
  acoes: {
    'tri-novo': () => { estado.visao.novoCaso = { aberto: true, falha: '' }; },
    'tri-cancelar': () => { estado.visao.novoCaso = { aberto: false, falha: '' }; },
    'tri-tipo': (tipo) => { alterarPacote('caso', { tipo }); salvarAgora('caso', gravarCaso); },
    'tri-excluir': async () => {
      const confirmado = await confirmar({
        titulo: 'Excluir este caso?',
        texto: `“${casoAtual().titulo}” será apagado com o diagnóstico, as respostas e o parecer. Não dá para desfazer.`,
        rotuloConfirmar: 'Excluir caso',
        destrutivo: true
      });
      if (confirmado) { await excluirCasoAtual(); }
    }
  },
  mudancas: {
    'tri-prova': (indice) => {
      alterarPacote('caso', { provas: alternarMarcado(casoAtual().provas, Number(indice)) });
      salvarAgora('caso', gravarCaso);
    }
  },
  campos: {
    'tri-titulo': (valor) => { alterarPacote('caso', { titulo: valor }); sincronizarLista(); agendarSalvamento('caso', gravarCaso); },
    'tri-descricao': (valor) => { alterarPacote('caso', { descricao_curta: valor }); agendarSalvamento('caso', gravarCaso); }
  },
  formularios: {
    'tri-criar': async (dados) => {
      const titulo = String(dados.get('titulo') || '').trim();
      if (!titulo) { estado.visao.novoCaso = { ...estado.visao.novoCaso, falha: 'Dê um nome ao caso.' }; return; }
      try {
        await criarCaso({ titulo, tipo: dados.get('tipo'), descricao_curta: String(dados.get('descricao_curta') || ''), exemplo: dados.get('exemplo') === 'on' });
        estado.visao.novoCaso = { aberto: false, falha: '' };
      } catch (erro) {
        estado.visao.novoCaso = { ...estado.visao.novoCaso, falha: erro.message };
      }
    }
  }
};
