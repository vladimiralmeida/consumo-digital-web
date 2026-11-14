/*
 * Estado da aplicação no navegador. Os dados do grupo vivem no servidor; aqui fica a cópia
 * em uso e o estado de visualização (o que está aberto ou selecionado), que não é salvo.
 */
const DATA = window.DATA;

function visaoInicial() {
  return {
    diag: { aberta: null, eixo: 'all', consultando: {}, lote: null },
    comp: { soDivergentes: false },
    agente: { ator: 'agente', cenario: 'fora' },
    pub: { ator: 'plataforma' },
    dados: { cenario: 'preco', fornecedor: '' },
    ativos: { editando: null, rascunho: null, falhas: {} },
    skill: { aberto: -1 },
    contas: { senhaGerada: null, falha: '' },
    conta: { falha: '', ok: false },
    novoCaso: { falha: '' },
    aviso: null
  };
}

export const estado = {
  fase: 'carregando',
  falhaDeEntrada: '',
  usuario: null,
  ia: { disponivel: false, ferramenta: '', modelo: '' },
  grupos: [],
  grupoId: null,
  casos: [],
  pacote: null,
  dadosDoGrupo: null,
  usuarios: null,
  salvamento: { pendentes: 0, falha: null, salvoEm: null },
  visao: visaoInicial()
};

export function reiniciarEstado() {
  Object.assign(estado, {
    usuario: null, grupos: [], grupoId: null, casos: [], pacote: null, dadosDoGrupo: null, usuarios: null,
    salvamento: { pendentes: 0, falha: null, salvoEm: null }, visao: visaoInicial()
  });
}

export const ehGestor = () => Boolean(estado.usuario) && estado.usuario.papel !== 'aluno';
export const ehIntegrante = () => Boolean(estado.usuario) && estado.usuario.papel === 'aluno' && estado.usuario.grupo_id === estado.grupoId;
export const grupoAtual = () => estado.grupos.find((grupo) => grupo.id === estado.grupoId) || null;
export const casoAtual = () => (estado.pacote ? estado.pacote.caso : null);

const RESPOSTA_VAZIA = Object.freeze({ nota: null, trecho_literal: '', conferido: null, resumo: '', por_que: '', origem: 'grupo' });

/** Resposta da dimensão `numero`, ou uma resposta em branco se o grupo ainda não respondeu. */
export function respostaDa(numero) {
  const salva = estado.pacote && estado.pacote.respostas.find((resposta) => resposta.dimensao === numero);
  return salva || { ...RESPOSTA_VAZIA, dimensao: numero };
}

export const temResposta = (numero) => Boolean(estado.pacote && estado.pacote.respostas.some((resposta) => resposta.dimensao === numero));

/** Troca a resposta de uma dimensão por uma cópia com as mudanças (sem alterar a anterior). */
export function alterarResposta(numero, mudancas) {
  const nova = { ...respostaDa(numero), ...mudancas };
  const outras = estado.pacote.respostas.filter((resposta) => resposta.dimensao !== numero);
  estado.pacote = { ...estado.pacote, respostas: [...outras, nova].sort((a, b) => a.dimensao - b.dimensao) };
  return nova;
}

export function alterarPacote(parte, mudancas) {
  estado.pacote = { ...estado.pacote, [parte]: { ...estado.pacote[parte], ...mudancas } };
}

export function alterarDadosDoGrupo(parte, mudancas) {
  estado.dadosDoGrupo = { ...estado.dadosDoGrupo, [parte]: { ...estado.dadosDoGrupo[parte], ...mudancas } };
}

/** Índice calculado no navegador com as notas em tela, para resposta imediata ao toque. */
export function indiceEmTela() {
  const notas = Object.fromEntries(estado.pacote.respostas.map((resposta) => [resposta.dimensao, resposta.nota]));
  return window.Dominio.calcularIndice(DATA.dims, notas);
}

/** Inclui ou retira `indice` de uma lista de itens marcados, devolvendo lista nova e ordenada. */
export function alternarMarcado(lista, indice) {
  return lista.includes(indice) ? lista.filter((item) => item !== indice) : [...lista, indice].sort((a, b) => a - b);
}

/* Preferências de navegação (qual grupo e caso abrir). Não são dados do trabalho. */
export function lembrar(chave, valor) {
  try { localStorage.setItem(`consumo-digital:${chave}`, String(valor)); } catch { /* armazenamento indisponível: segue sem lembrar */ }
}
export function lembrado(chave) {
  try { return Number(localStorage.getItem(`consumo-digital:${chave}`)) || null; } catch { return null; }
}
