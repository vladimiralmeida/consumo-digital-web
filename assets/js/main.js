/* Ponto de entrada: desenha a página, cuida das rotas e distribui os eventos para as telas. */
import { iniciarSessao, sair, selecionarCaso, selecionarGrupo } from './dados.js';
import { estado, ehGestor, reiniciarEstado } from './estado.js';
import { html } from './html.js';
import { registrarPainel } from './painel.js';
import { haAlteracoesPendentes, observarSalvamento, tentarDeNovo } from './salvar.js';
import { tela as agente } from './telas/agente.js';
import { tela as ativos } from './telas/ativos.js';
import { tela as comparacao } from './telas/comparacao.js';
import { tela as conta } from './telas/conta.js';
import { tela as contas } from './telas/contas.js';
import { tela as diagnostico } from './telas/diagnostico.js';
import { formulariosDeEntrada, renderizarEntrada } from './telas/entrada.js';
import { tela as parecer } from './telas/parecer.js';
import { tela as privacidade } from './telas/privacidade.js';
import { tela as publicidade } from './telas/influenciadores.js';
import { tela as skill } from './telas/skill.js';
import { tela as triagem } from './telas/triagem.js';

const TELAS = { triagem, diagnostico, comparacao, parecer, agente, publicidade, dados: privacidade, ativos, skill, contas, conta };
const MENU = [
  ['Casos', ['triagem']],
  ['Documentos', ['diagnostico', 'comparacao', 'parecer']],
  ['Temas', ['agente', 'publicidade', 'dados', 'ativos']],
  ['Skill', ['skill']]
];
const ROTA_INICIAL = 'triagem';
const raiz = document.getElementById('raiz');

const ICONE = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>`;

function rotaAtual() {
  const nome = (location.hash || '').replace(/^#\//, '');
  const tela = TELAS[nome];
  if (!tela || (tela.restrita && !ehGestor())) { return ROTA_INICIAL; }
  return nome;
}

const telaAtual = () => TELAS[rotaAtual()];

/* ---------- barra superior ---------- */

function situacaoDoSalvamento() {
  const { pendentes, falha, salvoEm } = estado.salvamento;
  if (falha) {
    return html`<span class="situacao erro"><span class="ponto"></span>${falha.mensagem} <button type="button" class="botao simples" data-a="salvar-de-novo">Tentar de novo</button></span>`;
  }
  if (pendentes > 0) { return html`<span class="situacao"><span class="ponto"></span>Salvando…</span>`; }
  if (salvoEm) { return html`<span class="situacao salvo"><span class="ponto"></span>Salvo às ${salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>`; }
  return html`<span class="situacao">Tudo o que o grupo preenche é salvo sozinho</span>`;
}

function seletores() {
  const grupos = ehGestor() && estado.grupos.length ? html`
    <label class="so-leitor" for="sel-grupo">Grupo</label>
    <select id="sel-grupo" class="discreto" data-m="escolher-grupo">
      ${estado.grupos.map((grupo) => html`<option value="${grupo.id}"${grupo.id === estado.grupoId ? html` selected` : ''}>${grupo.nome}</option>`)}
    </select>` : '';
  const casos = estado.casos.length ? html`
    <label class="so-leitor" for="sel-caso">Caso</label>
    <select id="sel-caso" class="discreto" data-m="escolher-caso">
      ${estado.casos.map((caso) => html`<option value="${caso.id}"${estado.pacote && caso.id === estado.pacote.caso.id ? html` selected` : ''}>${caso.titulo}</option>`)}
    </select>` : '';
  return html`<div class="barra-grupo">${grupos}${casos}</div>`;
}

function menuDaConta() {
  const { usuario } = estado;
  return html`
    <details class="conta">
      <summary aria-label="Conta de ${usuario.nome}">${usuario.nome.trim().charAt(0).toUpperCase()}</summary>
      <div class="conta-menu">
        <div class="conta-quem"><strong>${usuario.nome}</strong><span class="legenda">${usuario.email}</span></div>
        <a href="#/conta">Minha conta</a>
        ${ehGestor() ? html`<a href="#/contas">Contas e grupos</a>` : ''}
        <button type="button" data-a="sair">Sair</button>
      </div>
    </details>`;
}

function menuLateral(rota) {
  return html`
    <nav class="lateral" aria-label="Seções">
      ${MENU.map(([grupo, rotas]) => html`
        <div class="lateral-grupo">
          <span class="lateral-titulo">${grupo}</span>
          ${rotas.map((nome) => html`<a href="#/${nome}"${nome === rota ? html` aria-current="page"` : ''}>${TELAS[nome].titulo}</a>`)}
        </div>`)}
      ${ehGestor() ? html`<div class="lateral-grupo"><span class="lateral-titulo">Gestão</span><a href="#/contas"${rota === 'contas' ? html` aria-current="page"` : ''}>${contas.titulo}</a></div>` : ''}
    </nav>`;
}

function aplicativo(rota) {
  return html`
    <header class="barra">
      <div class="barra-conteudo">
        <a class="marca" href="#/triagem" aria-label="Consumo Digital, início"><span class="marca-icone">${ICONE}</span><span class="marca-nome">Consumo Digital</span></a>
        <div data-regiao="situacao" aria-live="polite">${situacaoDoSalvamento()}</div>
        ${seletores()}
        ${menuDaConta()}
      </div>
    </header>
    <div class="corpo">
      ${menuLateral(rota)}
      <main id="app" tabindex="-1">${TELAS[rota].render()}</main>
    </div>
    <footer class="rodape">Protótipo acadêmico da disciplina Relações de Consumo e Novas Tecnologias (PPGDI-UNICAP). O que o grupo preenche fica salvo no servidor e só é visto pelo próprio grupo e pelo professor. Não registre dados pessoais de terceiros, frase de recuperação nem chave privada. Orientação informativa; não substitui advogado, Defensoria ou Procon.</footer>`;
}

/* ---------- desenho ---------- */

function redesenhar() {
  const foco = document.activeElement && document.activeElement !== document.body ? chaveDeFoco(document.activeElement) : null;
  const rolagem = window.scrollY;
  const rota = rotaAtual();
  raiz.innerHTML = (estado.fase === 'app' ? aplicativo(rota) : renderizarEntrada()).toString();
  document.title = estado.fase === 'app' ? `${TELAS[rota].titulo} · Consumo Digital` : 'Consumo Digital';
  window.scrollTo(0, rolagem);
  if (foco) {
    const alvo = document.querySelector(foco);
    if (alvo) { alvo.focus({ preventScroll: true }); }
  }
}

/** Redesenha só as áreas calculadas (data-regiao), sem tocar nos campos em edição. */
function redesenharRegioes() {
  document.querySelectorAll('[data-regiao]').forEach((elemento) => {
    const nome = elemento.dataset.regiao;
    const conteudo = nome === 'situacao' ? situacaoDoSalvamento() : telaAtual().regioes ? telaAtual().regioes(nome) : null;
    if (conteudo !== null && conteudo !== undefined) { elemento.innerHTML = conteudo.toString(); }
  });
}

/** Seletor que reencontra, depois do redesenho, o elemento que estava com o foco. */
function chaveDeFoco(elemento) {
  if (elemento.id) { return `#${CSS.escape(elemento.id)}`; }
  const { a, m, i } = elemento.dataset;
  const nome = a ? 'a' : m ? 'm' : null;
  if (!nome) { return null; }
  return `[data-${nome}="${CSS.escape(a || m)}"]${i !== undefined ? `[data-i="${CSS.escape(i)}"]` : ''}`;
}

async function abrirRota() {
  const tela = telaAtual();
  if (estado.fase === 'app' && tela.carregar) {
    try { await tela.carregar(); } catch (erro) { estado.visao.contas.falha = erro.message; }
  }
  redesenhar();
  window.scrollTo(0, 0);
  const principal = document.getElementById('app');
  if (principal) { principal.focus({ preventScroll: true }); }
}

/* ---------- eventos ---------- */

const ACOES_GERAIS = {
  sair: async () => { await sair(); location.hash = `#/${ROTA_INICIAL}`; },
  'salvar-de-novo': tentarDeNovo,
  'en-recarregar': () => location.reload()
};

const MUDANCAS_GERAIS = {
  'escolher-grupo': (_indice, elemento) => selecionarGrupo(Number(elemento.value)),
  'escolher-caso': (_indice, elemento) => selecionarCaso(Number(elemento.value))
};

/** Executa o tratador e redesenha; uma falha inesperada aparece na barra, nunca some em silêncio. */
async function executar(tratador, ...argumentos) {
  try {
    await tratador(...argumentos);
  } catch (erro) {
    estado.salvamento = { ...estado.salvamento, falha: { chave: 'acao', gravar: () => Promise.resolve(), mensagem: erro.message || 'Não foi possível concluir a ação.' } };
  }
  redesenhar();
}

document.addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-a]');
  if (!botao || botao.disabled) { return; }
  const nome = botao.dataset.a;
  const tratador = ACOES_GERAIS[nome] || (estado.fase === 'app' && telaAtual().acoes && telaAtual().acoes[nome]);
  if (tratador) { executar(tratador, botao.dataset.i, botao); }
});

document.addEventListener('change', (evento) => {
  const nome = evento.target.dataset && evento.target.dataset.m;
  if (!nome) { return; }
  const tratador = MUDANCAS_GERAIS[nome] || (telaAtual().mudancas && telaAtual().mudancas[nome]);
  if (tratador) { executar(tratador, evento.target.dataset.i, evento.target); }
});

document.addEventListener('input', (evento) => {
  const nome = evento.target.dataset && evento.target.dataset.c;
  const tratador = nome && telaAtual().campos && telaAtual().campos[nome];
  if (!tratador) { return; }
  tratador(evento.target.value, evento.target);
  redesenharRegioes();
});

document.addEventListener('submit', (evento) => {
  const nome = evento.target.dataset && evento.target.dataset.f;
  if (!nome) { return; }
  evento.preventDefault();
  const tratador = formulariosDeEntrada[nome] || (telaAtual().formularios && telaAtual().formularios[nome]);
  if (tratador) { executar(tratador, new FormData(evento.target), evento.target); }
});

/* Fecha o menu da conta ao clicar fora dele ou ao escolher um item. */
document.addEventListener('click', (evento) => {
  const menu = document.querySelector('details.conta[open]');
  if (menu && (!menu.contains(evento.target) || evento.target.closest('.conta-menu a'))) { menu.removeAttribute('open'); }
});

window.addEventListener('hashchange', abrirRota);
window.addEventListener('sessao-encerrada', () => {
  reiniciarEstado();
  estado.fase = 'entrada';
  estado.falhaDeEntrada = 'Sua sessão terminou. Entre de novo para continuar.';
  redesenhar();
});
window.addEventListener('beforeunload', (evento) => {
  if (haAlteracoesPendentes()) { evento.preventDefault(); }
});

registrarPainel({ redesenhar, redesenharRegioes });
observarSalvamento(redesenharRegioes);

redesenhar();
iniciarSessao().then(abrirRota);
