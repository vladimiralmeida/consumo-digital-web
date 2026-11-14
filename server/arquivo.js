'use strict';

const { ErroHttp } = require('./erros');

/*
 * Busca a cópia arquivada de um documento na Wayback Machine (Internet Archive).
 * O servidor só fala com archive.org e web.archive.org: o endereço informado pela pessoa
 * nunca é acessado diretamente, o que impede usar esta rota para alcançar a rede interna.
 */
const API_DE_DISPONIBILIDADE = 'https://archive.org/wayback/available';
const SERVIDOR_DO_ARQUIVO = 'web.archive.org';
const TEMPO_LIMITE_MS = 30000;
const TENTATIVAS_DE_CONEXAO = 3;
const ESPERA_ENTRE_TENTATIVAS_MS = 600;
const TAMANHO_MAXIMO_DA_PAGINA = 3 * 1024 * 1024;
const TEXTO_MINIMO_UTIL = 500;
const ESPACOS = new RegExp('[ \t' + String.fromCharCode(160) + ']+', 'g');
const CAPTURA = /\/web\/(\d{14})\/(.+)$/;

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', sect: '§', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', copy: '©', reg: '®' };
/* Entidades de letra acentuada (&aacute;, &Ccedil;...): letra seguida do nome do acento. */
const MARCAS_DE_ACENTO = { acute: '́', grave: '̀', circ: '̂', tilde: '̃', uml: '̈', cedil: '̧' };
const LETRA_ACENTUADA = /^([a-z])(acute|grave|circ|tilde|uml|cedil)$/i;

function decodificarCodigo(nome) {
  const codigo = nome[1].toLowerCase() === 'x' ? Number.parseInt(nome.slice(2), 16) : Number.parseInt(nome.slice(1), 10);
  return Number.isInteger(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : null;
}

/** Decodifica entidades HTML numéricas e as nomeadas mais comuns em textos em português. */
function decodificarEntidades(texto) {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (original, nome) => {
    if (nome[0] === '#') { return decodificarCodigo(nome) || original; }
    if (ENTIDADES[nome.toLowerCase()]) { return ENTIDADES[nome.toLowerCase()]; }
    const acento = LETRA_ACENTUADA.exec(nome);
    return acento ? (acento[1] + MARCAS_DE_ACENTO[acento[2].toLowerCase()]).normalize('NFC') : original;
  });
}

/** Extrai o texto legível de uma página HTML, mantendo as quebras de parágrafo. */
function extrairTexto(html) {
  const semBlocosOcultos = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|head|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const comQuebras = semBlocosOcultos
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|blockquote|ul|ol|table|header|footer)\s*>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ');
  return decodificarEntidades(comQuebras)
    .replace(ESPACOS, ' ')
    .split('\n').map((linha) => linha.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const esperar = (milissegundos) => new Promise((resolver) => { setTimeout(resolver, milissegundos); });

/** Falhas de conexão com o arquivo costumam ser passageiras: tenta de novo antes de desistir. */
async function buscar(fetchImpl, url) {
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CONEXAO; tentativa += 1) {
    try {
      return await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(TEMPO_LIMITE_MS), headers: { Accept: 'application/json, text/html, text/plain' } });
    } catch (erro) {
      const causa = (erro.cause && (erro.cause.code || erro.cause.message)) || erro.message;
      console.error(`[arquivo] falha de rede ao consultar a Wayback Machine (tentativa ${tentativa} de ${TENTATIVAS_DE_CONEXAO}):`, erro.name, causa);
      if (tentativa < TENTATIVAS_DE_CONEXAO) { await esperar(ESPERA_ENTRE_TENTATIVAS_MS); }
    }
  }
  throw new ErroHttp(502, 'Não foi possível falar com a Wayback Machine. Tente de novo em instantes ou cole o texto dos termos.');
}

/** Devolve { instante, original } da captura mais próxima, ou null se não houver cópia arquivada. */
async function localizarCaptura(fetchImpl, endereco) {
  const resposta = await buscar(fetchImpl, `${API_DE_DISPONIBILIDADE}?url=${encodeURIComponent(endereco)}`);
  if (!resposta.ok) { throw new ErroHttp(502, 'A Wayback Machine está indisponível no momento. Tente de novo em instantes ou cole o texto dos termos.'); }
  const dados = await resposta.json();
  const proxima = dados && dados.archived_snapshots && dados.archived_snapshots.closest;
  const partes = proxima && proxima.available ? CAPTURA.exec(String(proxima.url)) : null;
  return partes ? { instante: partes[1], original: partes[2] } : null;
}

/**
 * Busca a cópia arquivada mais recente de `endereco` e devolve o link arquivado, a data da
 * captura (AAAA-MM-DD) e o texto extraído da página.
 */
async function buscarCopiaArquivada({ fetchImpl, endereco }) {
  const captura = await localizarCaptura(fetchImpl, endereco);
  if (!captura) {
    throw new ErroHttp(404, 'A Wayback Machine ainda não tem cópia desta página. Salve uma em web.archive.org/save e tente de novo, ou cole o texto dos termos.', { codigo: 'sem_copia' });
  }
  /* O sufixo "id_" pede a página como foi capturada, sem a barra de navegação do arquivo. */
  const resposta = await buscar(fetchImpl, `https://${SERVIDOR_DO_ARQUIVO}/web/${captura.instante}id_/${captura.original}`);
  const destino = new URL(resposta.url || `https://${SERVIDOR_DO_ARQUIVO}/`);
  const tipo = resposta.headers.get('content-type') || '';
  if (!resposta.ok || destino.hostname !== SERVIDOR_DO_ARQUIVO || !/^text\/(html|plain)/i.test(tipo)) {
    throw new ErroHttp(502, 'A cópia arquivada não pôde ser lida como texto. Abra o link arquivado e cole o texto dos termos.');
  }
  const pagina = (await resposta.text()).slice(0, TAMANHO_MAXIMO_DA_PAGINA);
  const texto = /^text\/plain/i.test(tipo) ? pagina.trim() : extrairTexto(pagina);
  const [, ano, mes, dia] = /^(\d{4})(\d{2})(\d{2})/.exec(captura.instante);
  return {
    link_arquivado: `https://${SERVIDOR_DO_ARQUIVO}/web/${captura.instante}/${captura.original}`,
    data_da_captura: `${ano}-${mes}-${dia}`,
    texto,
    texto_curto: texto.length < TEXTO_MINIMO_UTIL
  };
}

module.exports = { buscarCopiaArquivada, extrairTexto, decodificarEntidades };
