/* Carga dos dados do servidor: sessão, grupos, casos e o pacote do caso em uso. */
import { api, definirCsrf } from './api.js';
import { estado, lembrar, lembrado, reiniciarEstado } from './estado.js';
import { descarregarAgendados } from './salvar.js';

function aplicarSessao(sessao) {
  estado.usuario = sessao.usuario;
  estado.ia = sessao.ia;
  definirCsrf(sessao.csrf);
  estado.fase = sessao.usuario.deve_trocar_senha ? 'senha' : 'app';
}

/** Descobre se há sessão aberta. Sem servidor (ex.: GitHub Pages), mostra o aviso próprio. */
export async function iniciarSessao() {
  try {
    aplicarSessao(await api('GET', '/auth/me'));
  } catch (erro) {
    estado.fase = erro.status === 401 ? 'entrada' : 'sem-servidor';
    return;
  }
  if (estado.fase === 'app') { await carregarGrupos(); }
}

export async function entrar(email, senha) {
  aplicarSessao(await api('POST', '/auth/login', { email, senha }));
  if (estado.fase === 'app') { await carregarGrupos(); }
}

export async function trocarSenha(atual, nova) {
  aplicarSessao(await api('POST', '/auth/senha', { atual, nova }));
  if (!estado.grupos.length) { await carregarGrupos(); }
}

export async function sair() {
  await descarregarAgendados();
  try { await api('POST', '/auth/logout'); } catch { /* a sessão local é encerrada de qualquer forma */ }
  reiniciarEstado();
  estado.fase = 'entrada';
}

export async function carregarGrupos() {
  const { grupos } = await api('GET', '/grupos');
  estado.grupos = grupos;
  const preferido = estado.usuario.grupo_id || lembrado('grupo');
  const escolhido = grupos.find((grupo) => grupo.id === preferido) || grupos[0] || null;
  await selecionarGrupo(escolhido ? escolhido.id : null);
}

export async function selecionarGrupo(grupoId) {
  await descarregarAgendados();
  estado.grupoId = grupoId;
  estado.casos = [];
  estado.pacote = null;
  estado.dadosDoGrupo = null;
  if (!grupoId) { return; }
  lembrar('grupo', grupoId);
  const [{ casos }, dadosDoGrupo] = await Promise.all([
    api('GET', `/casos?grupo_id=${grupoId}`),
    api('GET', `/grupos/${grupoId}/dados`)
  ]);
  estado.casos = casos;
  estado.dadosDoGrupo = dadosDoGrupo;
  const preferido = lembrado(`caso:${grupoId}`);
  const escolhido = casos.find((caso) => caso.id === preferido) || casos[0] || null;
  await selecionarCaso(escolhido ? escolhido.id : null);
}

export async function selecionarCaso(casoId) {
  await descarregarAgendados();
  estado.pacote = casoId ? await api('GET', `/casos/${casoId}`) : null;
  if (casoId) { lembrar(`caso:${estado.grupoId}`, casoId); }
}

export async function criarCaso(dados) {
  const pacote = await api('POST', '/casos', { ...dados, grupo_id: estado.grupoId });
  estado.casos = [pacote.caso, ...estado.casos];
  estado.pacote = pacote;
  lembrar(`caso:${estado.grupoId}`, pacote.caso.id);
}

export async function excluirCasoAtual() {
  const { id } = estado.pacote.caso;
  await api('DELETE', `/casos/${id}`);
  estado.casos = estado.casos.filter((caso) => caso.id !== id);
  await selecionarCaso(estado.casos[0] ? estado.casos[0].id : null);
}
