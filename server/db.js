'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/*
 * Migrações em ordem. Cada posição do vetor leva o banco à versão (índice + 1),
 * registrada em PRAGMA user_version. Nunca edite uma migração já publicada: acrescente outra.
 */
const MIGRACOES = [
  `
  CREATE TABLE grupos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
    turma TEXT NOT NULL DEFAULT '',
    divergencia_destacada TEXT NOT NULL DEFAULT '',
    higiene TEXT NOT NULL DEFAULT '[]',
    passos_ativos TEXT NOT NULL DEFAULT '[]',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('aluno', 'professor', 'admin')),
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE SET NULL,
    deve_trocar_senha INTEGER NOT NULL DEFAULT 1,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    expira_em INTEGER NOT NULL
  );
  CREATE INDEX sessoes_usuario ON sessoes(usuario_id);

  CREATE TABLE casos (
    id INTEGER PRIMARY KEY,
    grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    descricao_curta TEXT NOT NULL DEFAULT '',
    provas TEXT NOT NULL DEFAULT '[]',
    checklist_publicidade TEXT NOT NULL DEFAULT '[]',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX casos_grupo ON casos(grupo_id);

  CREATE TABLE diagnosticos (
    caso_id INTEGER PRIMARY KEY REFERENCES casos(id) ON DELETE CASCADE,
    plataforma TEXT NOT NULL DEFAULT '',
    documento_url TEXT NOT NULL DEFAULT '',
    link_arquivado TEXT NOT NULL DEFAULT '',
    data_acesso TEXT NOT NULL DEFAULT '',
    texto_fonte TEXT NOT NULL DEFAULT '',
    ferramenta_ia TEXT NOT NULL DEFAULT '',
    versao_modelo TEXT NOT NULL DEFAULT '',
    data_criacao TEXT NOT NULL DEFAULT '',
    prompt_usado TEXT NOT NULL DEFAULT '',
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE respostas (
    caso_id INTEGER NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
    dimensao INTEGER NOT NULL,
    pergunta_id TEXT NOT NULL,
    nota INTEGER CHECK (nota IS NULL OR nota BETWEEN 0 AND 3),
    trecho_literal TEXT NOT NULL DEFAULT '',
    conferido INTEGER CHECK (conferido IS NULL OR conferido IN (0, 1)),
    resumo TEXT NOT NULL DEFAULT '',
    por_que TEXT NOT NULL DEFAULT '',
    origem TEXT NOT NULL DEFAULT 'grupo' CHECK (origem IN ('grupo', 'ia')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (caso_id, dimensao)
  );

  CREATE TABLE consultas_ia (
    id INTEGER PRIMARY KEY,
    caso_id INTEGER NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
    dimensao INTEGER NOT NULL,
    pergunta_id TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    ferramenta TEXT NOT NULL,
    modelo TEXT NOT NULL,
    prompt TEXT NOT NULL,
    resposta TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX consultas_caso ON consultas_ia(caso_id);

  CREATE TABLE pareceres (
    caso_id INTEGER PRIMARY KEY REFERENCES casos(id) ON DELETE CASCADE,
    formato TEXT NOT NULL DEFAULT 'senacon',
    texto TEXT NOT NULL DEFAULT '',
    validado_humano INTEGER NOT NULL DEFAULT 0,
    validado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    validado_em TEXT,
    declaracao_ia INTEGER NOT NULL DEFAULT 0,
    declarado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    declarado_em TEXT,
    notas TEXT NOT NULL DEFAULT '[]',
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE comparacoes (
    id INTEGER PRIMARY KEY,
    grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    provedor_ordem INTEGER NOT NULL,
    provedor_nome TEXT NOT NULL,
    dimensao TEXT NOT NULL,
    nota INTEGER CHECK (nota IS NULL OR nota BETWEEN 0 AND 3),
    texto TEXT NOT NULL DEFAULT '',
    UNIQUE (grupo_id, provedor_ordem, dimensao)
  );

  CREATE TABLE transacoes (
    id INTEGER PRIMARY KEY,
    grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
    integrante TEXT NOT NULL DEFAULT '',
    rede TEXT NOT NULL DEFAULT '',
    endereco_origem TEXT NOT NULL DEFAULT '',
    endereco_destino TEXT NOT NULL DEFAULT '',
    hash TEXT NOT NULL DEFAULT '',
    data_hora TEXT NOT NULL DEFAULT '',
    link_explorador TEXT NOT NULL DEFAULT '',
    obs TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX transacoes_grupo ON transacoes(grupo_id);
  `
];

function migrar(db) {
  const atual = db.prepare('PRAGMA user_version').get().user_version;
  MIGRACOES.slice(atual).forEach((sql, i) => {
    const versao = atual + i + 1;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${versao}`);
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      throw new Error(`Falha na migração ${versao}: ${erro.message}`, { cause: erro });
    }
  });
}

/** Abre (ou cria) o banco e aplica as migrações pendentes. Use ':memory:' nos testes. */
function abrirBanco(caminho) {
  if (caminho !== ':memory:') { fs.mkdirSync(path.dirname(caminho), { recursive: true }); }
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrar(db);
  return db;
}

/** Executa `acao` em uma transação: confirma se terminar bem, desfaz se lançar erro. */
function emTransacao(db, acao) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = acao();
    db.exec('COMMIT');
    return resultado;
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}

module.exports = { abrirBanco, emTransacao };
