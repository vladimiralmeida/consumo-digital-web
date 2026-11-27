/*
 * Salvamento automático. Cada recurso (ex.: "resposta:6") tem uma gravação agendada; novas
 * digitações adiam a gravação, que sempre envia o estado mais recente. A situação aparece
 * na barra superior, e uma falha fica visível com a opção de tentar de novo.
 */
import { estado } from './estado.js';

const ESPERA_MS = 700;
const agendadas = new Map();
let aoMudar = () => {};

export function observarSalvamento(funcao) { aoMudar = funcao; }

function definirSituacao(mudancas) {
  estado.salvamento = { ...estado.salvamento, ...mudancas };
  aoMudar();
}

async function executar(chave, gravar) {
  definirSituacao({ pendentes: estado.salvamento.pendentes + 1 });
  try {
    await gravar();
    definirSituacao({ pendentes: estado.salvamento.pendentes - 1, falha: null, salvoEm: new Date() });
  } catch (erro) {
    definirSituacao({
      pendentes: estado.salvamento.pendentes - 1,
      falha: { chave, gravar, mensagem: erro.message || 'Não foi possível salvar.' }
    });
  }
}

/** Agenda a gravação de um recurso; chamadas seguidas para a mesma chave viram uma só. */
export function agendarSalvamento(chave, gravar) {
  const anterior = agendadas.get(chave);
  if (anterior) { clearTimeout(anterior.temporizador); } else { definirSituacao({ pendentes: estado.salvamento.pendentes + 1 }); }
  const temporizador = setTimeout(() => {
    agendadas.delete(chave);
    definirSituacao({ pendentes: estado.salvamento.pendentes - 1 });
    executar(chave, gravar);
  }, ESPERA_MS);
  agendadas.set(chave, { temporizador, gravar });
}

/** Grava já (cliques em notas, caixas de seleção e escolhas). */
export function salvarAgora(chave, gravar) {
  const anterior = agendadas.get(chave);
  if (anterior) {
    clearTimeout(anterior.temporizador);
    agendadas.delete(chave);
    definirSituacao({ pendentes: estado.salvamento.pendentes - 1 });
  }
  return executar(chave, gravar);
}

/** Envia de imediato tudo o que está agendado (antes de trocar de caso ou de sair). */
export function descarregarAgendados() {
  const pendentes = [...agendadas.entries()];
  agendadas.clear();
  return Promise.all(pendentes.map(([chave, { temporizador, gravar }]) => {
    clearTimeout(temporizador);
    definirSituacao({ pendentes: estado.salvamento.pendentes - 1 });
    return executar(chave, gravar);
  }));
}

export function tentarDeNovo() {
  const { falha } = estado.salvamento;
  if (falha) { executar(falha.chave, falha.gravar); }
}

export const haAlteracoesPendentes = () => estado.salvamento.pendentes > 0 || Boolean(estado.salvamento.falha);
