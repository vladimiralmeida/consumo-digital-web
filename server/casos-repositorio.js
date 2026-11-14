'use strict';

const DATA = require('../assets/data.js');
const { calcularIndice, conferirTrecho } = require('../assets/dominio.js');

const NOTAS_INICIAIS = DATA.rubrica.map(() => 0);

const lerLista = (json) => {
  try { const lista = JSON.parse(json); return Array.isArray(lista) ? lista : []; } catch { return []; }
};

const dimensaoPorNumero = (numero) => DATA.dims.find((dimensao) => dimensao.n === numero) || null;

/** Converte o inteiro do banco (1, 0, NULL) no valor do domínio (true, false, null). */
const lerConferido = (valor) => (valor === null ? null : Boolean(valor));
const gravarConferido = (valor) => (valor === null ? null : Number(valor));

/** Dimensão descritiva não tem transcrição a conferir. */
function conferirResposta(dimensao, trecho, textoFonte) {
  return dimensao.descritiva ? null : conferirTrecho(trecho, textoFonte);
}

function formatarCaso(linha) {
  return {
    id: linha.id,
    grupo_id: linha.grupo_id,
    titulo: linha.titulo,
    tipo: linha.tipo,
    descricao_curta: linha.descricao_curta,
    provas: lerLista(linha.provas),
    checklist_publicidade: lerLista(linha.checklist_publicidade),
    criado_em: linha.criado_em,
    atualizado_em: linha.atualizado_em
  };
}

function formatarResposta(linha) {
  return {
    dimensao: linha.dimensao,
    pergunta_id: linha.pergunta_id,
    nota: linha.nota,
    trecho_literal: linha.trecho_literal,
    conferido: lerConferido(linha.conferido),
    resumo: linha.resumo,
    por_que: linha.por_que,
    origem: linha.origem,
    atualizado_em: linha.atualizado_em
  };
}

function formatarParecer(linha) {
  const notas = lerLista(linha.notas);
  return {
    formato: linha.formato,
    texto: linha.texto,
    validado_humano: Boolean(linha.validado_humano),
    validado_em: linha.validado_em,
    declaracao_ia: Boolean(linha.declaracao_ia),
    declarado_em: linha.declarado_em,
    notas: notas.length === NOTAS_INICIAIS.length ? notas : NOTAS_INICIAIS,
    atualizado_em: linha.atualizado_em
  };
}

function garantirRegistros(db, casoId) {
  db.prepare('INSERT OR IGNORE INTO diagnosticos (caso_id) VALUES (?)').run(casoId);
  db.prepare('INSERT OR IGNORE INTO pareceres (caso_id, notas) VALUES (?, ?)').run(casoId, JSON.stringify(NOTAS_INICIAIS));
}

function listarRespostas(db, casoId) {
  return db.prepare('SELECT * FROM respostas WHERE caso_id = ? ORDER BY dimensao').all(casoId).map(formatarResposta);
}

function calcularIndiceDoCaso(respostas) {
  const notas = Object.fromEntries(respostas.map((resposta) => [resposta.dimensao, resposta.nota]));
  return calcularIndice(DATA.dims, notas);
}

/** Tudo o que as telas precisam de um caso: triagem, diagnóstico, respostas, índice, parecer e consultas. */
function montarCaso(db, caso) {
  garantirRegistros(db, caso.id);
  const respostas = listarRespostas(db, caso.id);
  const diagnostico = db.prepare('SELECT * FROM diagnosticos WHERE caso_id = ?').get(caso.id);
  const parecer = db.prepare('SELECT * FROM pareceres WHERE caso_id = ?').get(caso.id);
  const consultas = db.prepare(`
    SELECT dimensao, pergunta_id, ferramenta, modelo, prompt, criado_em
    FROM consultas_ia WHERE caso_id = ? ORDER BY id
  `).all(caso.id);
  const { caso_id: _ignorado, ...camposDoDiagnostico } = diagnostico;
  return {
    caso: formatarCaso(caso),
    diagnostico: camposDoDiagnostico,
    respostas,
    indice: calcularIndiceDoCaso(respostas),
    parecer: formatarParecer(parecer),
    consultas
  };
}

function gravarResposta(db, casoId, dimensao, campos, origem) {
  db.prepare(`
    INSERT INTO respostas (caso_id, dimensao, pergunta_id, nota, trecho_literal, conferido, resumo, por_que, origem)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (caso_id, dimensao) DO UPDATE SET
      nota = excluded.nota, trecho_literal = excluded.trecho_literal, conferido = excluded.conferido,
      resumo = excluded.resumo, por_que = excluded.por_que, origem = excluded.origem,
      atualizado_em = datetime('now')
  `).run(casoId, dimensao.n, dimensao.pid, campos.nota, campos.trecho_literal, gravarConferido(campos.conferido), campos.resumo, campos.por_que, origem);
}

/** Refaz a conferência de todos os trechos do caso contra o texto-fonte atual. */
function reconferirRespostas(db, casoId, textoFonte) {
  const atualizar = db.prepare('UPDATE respostas SET conferido = ? WHERE caso_id = ? AND dimensao = ?');
  listarRespostas(db, casoId).forEach((resposta) => {
    const dimensao = dimensaoPorNumero(resposta.dimensao);
    if (!dimensao) { return; }
    atualizar.run(gravarConferido(conferirResposta(dimensao, resposta.trecho_literal, textoFonte)), casoId, resposta.dimensao);
  });
}

const marcarCasoAtualizado = (db, casoId) => {
  db.prepare("UPDATE casos SET atualizado_em = datetime('now') WHERE id = ?").run(casoId);
};

/**
 * Preenche o caso com o exemplo fictício de assets/data.js. O texto-fonte é montado com os
 * trechos conferidos; o trecho marcado como não conferido fica de fora, e a conferência por
 * código o aponta como NÃO CONFERIDO.
 */
function preencherComExemplo(db, casoId) {
  const textoFonte = ['TERMOS DE USO DA PLATAFORMA EXEMPLO (documento fictício, criado para demonstração)']
    .concat(DATA.dims.filter((d) => d.ok === true).map((d) => d.quote.replace(/^[“"]|[”"]$/g, '')))
    .join('\n\n');
  db.prepare(`
    INSERT INTO diagnosticos (caso_id, plataforma, texto_fonte) VALUES (?, 'Plataforma Exemplo (fictícia)', ?)
    ON CONFLICT (caso_id) DO UPDATE SET plataforma = excluded.plataforma, texto_fonte = excluded.texto_fonte
  `).run(casoId, textoFonte);
  DATA.dims.forEach((dimensao) => {
    gravarResposta(db, casoId, dimensao, {
      nota: dimensao.score,
      trecho_literal: dimensao.quote,
      conferido: conferirResposta(dimensao, dimensao.quote, textoFonte),
      resumo: dimensao.plain,
      por_que: dimensao.why
    }, 'grupo');
  });
}

module.exports = {
  dimensaoPorNumero,
  conferirResposta,
  formatarCaso,
  garantirRegistros,
  montarCaso,
  gravarResposta,
  reconferirRespostas,
  marcarCasoAtualizado,
  preencherComExemplo
};
