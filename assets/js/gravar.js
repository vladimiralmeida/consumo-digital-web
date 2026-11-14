/*
 * Gravações no servidor. Cada função envia o estado atual de um recurso. A resposta só
 * atualiza o que o servidor calcula (conferência e índice), para não sobrescrever o que a
 * pessoa continua digitando.
 */
import { api } from './api.js';
import { estado, respostaDa } from './estado.js';
import { pedirRegioes } from './painel.js';

/** Copia para o estado a conferência e a origem calculadas pelo servidor. */
function aplicarConferencia(respostasDoServidor, indice) {
  const porDimensao = new Map(respostasDoServidor.map((resposta) => [resposta.dimensao, resposta]));
  const respostas = estado.pacote.respostas.map((local) => {
    const remota = porDimensao.get(local.dimensao);
    return remota ? { ...local, conferido: remota.conferido, origem: remota.origem, atualizado_em: remota.atualizado_em } : local;
  });
  estado.pacote = { ...estado.pacote, respostas, indice };
  pedirRegioes();
}

export function gravarCaso() {
  const { id, titulo, tipo, descricao_curta, provas, checklist_publicidade } = estado.pacote.caso;
  return api('PATCH', `/casos/${id}`, { titulo, tipo, descricao_curta, provas, checklist_publicidade });
}

export async function gravarDiagnostico() {
  const { caso, diagnostico } = estado.pacote;
  const { atualizado_em: _ignorado, ...campos } = diagnostico;
  const { respostas, indice } = await api('PUT', `/casos/${caso.id}/diagnostico`, campos);
  if (estado.pacote && estado.pacote.caso.id === caso.id) { aplicarConferencia(respostas, indice); }
}

export const gravarResposta = (numero) => async () => {
  const casoId = estado.pacote.caso.id;
  const { nota, trecho_literal, resumo, por_que } = respostaDa(numero);
  const { respostas, indice } = await api('PUT', `/casos/${casoId}/respostas/${numero}`, { nota, trecho_literal, resumo, por_que });
  if (estado.pacote && estado.pacote.caso.id === casoId) { aplicarConferencia(respostas, indice); }
};

/** `campos` limita o envio (ex.: só a validação), para o servidor aplicar a regra certa a cada um. */
export const gravarParecer = (campos) => async () => {
  const { caso, parecer } = estado.pacote;
  const corpo = Object.fromEntries(campos.map((campo) => [campo, parecer[campo]]));
  const resposta = await api('PUT', `/casos/${caso.id}/parecer`, corpo);
  if (estado.pacote && estado.pacote.caso.id === caso.id) {
    const { validado_em, declarado_em } = resposta.parecer;
    estado.pacote = { ...estado.pacote, parecer: { ...estado.pacote.parecer, validado_em, declarado_em } };
  }
};

export function gravarComparacao() {
  const { divergencia_destacada, provedores } = estado.dadosDoGrupo.comparacao;
  const corpo = {
    divergencia_destacada,
    provedores: provedores.map((provedor, i) => ({ ...provedor, nome: provedor.nome.trim() || `Provedor ${i + 1}` }))
  };
  return api('PUT', `/grupos/${estado.grupoId}/comparacao`, corpo);
}

export function gravarAnotacoes() {
  return api('PUT', `/grupos/${estado.grupoId}/anotacoes`, estado.dadosDoGrupo.anotacoes);
}
