/*
 * Análise dos termos de uso com IA e busca da cópia arquivada. Usado pela triagem (análise
 * completa em um toque) e pelo diagnóstico (dimensão a dimensão).
 */
import { api } from './api.js';
import { estado, respostaDa, temResposta } from './estado.js';
import { pedirRedesenho } from './painel.js';
import { descarregarAgendados } from './salvar.js';
import { confirmar } from './ui.js';

const DATA = window.DATA;
const CONSULTAS_SIMULTANEAS = 3;

export const analise = () => estado.visao.analise;
export const dimensao = (numero) => DATA.dims.find((item) => item.n === Number(numero));
/** Dimensões ainda sem nota de opacidade: a mesma regra que a trilha usa para a etapa de análise. */
export const dimensoesSemNota = () => DATA.dims.filter((item) => respostaDa(item.n).nota === null);
/**
 * Dimensões que a análise em lote envia à IA: as sem nota, menos as que já têm texto escrito
 * pelo grupo. Essas ficam para o grupo dar a nota (ou pedir a IA uma a uma, com confirmação).
 */
export const dimensoesParaIa = () => dimensoesSemNota().filter((item) => !(temResposta(item.n) && respostaDa(item.n).origem === 'grupo'));
export const temTextoDosTermos = () => Boolean(estado.pacote && estado.pacote.diagnostico.texto_fonte.trim());

function alterarAnalise(mudancas) {
  estado.visao.analise = { ...analise(), ...mudancas };
}

const mesmoCaso = (casoId) => Boolean(estado.pacote) && estado.pacote.caso.id === casoId;

function aplicarResultado(resultado) {
  estado.pacote = { ...estado.pacote, respostas: resultado.respostas, indice: resultado.indice, consultas: resultado.consultas };
  if (resultado.documento_truncado) {
    alterarAnalise({ falha: 'O documento é longo demais para a IA ler inteiro: só a parte inicial foi analisada. Confira as cláusulas do final à mão.' });
  }
}

async function confirmarSubstituicao(numero) {
  return confirmar({
    titulo: 'Substituir a resposta do grupo?',
    texto: `A dimensão “${dimensao(numero).name}” já tem uma resposta escrita pelo grupo. A sugestão da IA vai tomar o lugar dela.`,
    rotuloConfirmar: 'Substituir pela sugestão'
  });
}

/** Consulta a IA para uma dimensão. Devolve false se a consulta falhar ou for cancelada. */
export async function consultarIa(numero, substituir = false) {
  const casoId = estado.pacote.caso.id;
  alterarAnalise({ consultando: { ...analise().consultando, [numero]: true } });
  pedirRedesenho();
  try {
    await descarregarAgendados();
    const resultado = await api('POST', `/casos/${casoId}/ia/${numero}`, { substituir });
    if (mesmoCaso(casoId)) { aplicarResultado(resultado); }
    return mesmoCaso(casoId);
  } catch (erro) {
    if (erro.dados && erro.dados.codigo === 'resposta_do_grupo') {
      return (await confirmarSubstituicao(numero)) ? consultarIa(numero, true) : false;
    }
    alterarAnalise({ falha: erro.message });
    return false;
  } finally {
    alterarAnalise({ consultando: { ...analise().consultando, [numero]: false } });
    pedirRedesenho();
  }
}

/**
 * Analisa a opacidade de todas as dimensões que ainda não têm nota, algumas por vez, mostrando
 * o andamento. Para na primeira falha ou quando a pessoa pede para parar. Dimensão com texto
 * do grupo e sem nota pede confirmação antes de ser substituída.
 */
export async function analisarPendentes() {
  const fila = dimensoesParaIa().map((item) => item.n);
  alterarAnalise({ falha: '', lote: { feitas: 0, total: fila.length, parar: false } });
  const trabalhar = async () => {
    while (fila.length && analise().lote && !analise().lote.parar) {
      const numero = fila.shift();
      const deuCerto = await consultarIa(numero);
      if (!analise().lote) { return; }
      alterarAnalise({ lote: { ...analise().lote, feitas: analise().lote.feitas + (deuCerto ? 1 : 0), parar: analise().lote.parar || !deuCerto } });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONSULTAS_SIMULTANEAS, fila.length) }, trabalhar));
  alterarAnalise({ lote: null });
}

export function pararAnalise() {
  if (analise().lote) { alterarAnalise({ lote: { ...analise().lote, parar: true } }); }
}

/** Busca na Wayback Machine a cópia arquivada do link original e preenche o texto dos termos. */
export async function buscarCopiaArquivada() {
  const casoId = estado.pacote.caso.id;
  alterarAnalise({ buscando: true, falhaDoArquivo: '', avisoDoArquivo: '' });
  pedirRedesenho();
  try {
    await descarregarAgendados();
    const resultado = await api('POST', `/casos/${casoId}/arquivo`, { url: estado.pacote.diagnostico.documento_url.trim() });
    if (!mesmoCaso(casoId)) { return; }
    estado.pacote = { ...estado.pacote, diagnostico: resultado.diagnostico, respostas: resultado.respostas, indice: resultado.indice };
    const [ano, mes, dia] = resultado.data_da_captura.split('-');
    alterarAnalise({
      avisoDoArquivo: resultado.texto_curto
        ? `Cópia de ${dia}/${mes}/${ano} encontrada, mas veio pouco texto (a página pode depender de JavaScript). Abra o link arquivado e cole o texto dos termos.`
        : `Texto preenchido com a cópia arquivada em ${dia}/${mes}/${ano}. Confira se é o documento certo antes de analisar.`
    });
  } catch (erro) {
    alterarAnalise({ falhaDoArquivo: erro.message });
  } finally {
    alterarAnalise({ buscando: false });
  }
}
