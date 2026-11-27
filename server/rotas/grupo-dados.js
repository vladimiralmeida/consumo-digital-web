'use strict';

const express = require('express');
const { carregarGrupo, podeAcessarGrupo } = require('../acesso');
const { emTransacao } = require('../db');
const { naoEncontrado } = require('../erros');
const { esquemas, validar, lerId, DIMENSOES_COMPARACAO } = require('../validacao');

const CAMPOS_DA_TRANSACAO = ['integrante', 'rede', 'endereco_origem', 'endereco_destino', 'hash', 'data_hora', 'link_explorador', 'obs'];

const lerLista = (json) => {
  try { const lista = JSON.parse(json); return Array.isArray(lista) ? lista : []; } catch { return []; }
};

/** Agrupa as linhas (uma por provedor e dimensão) em provedores com suas células. */
function montarProvedores(linhas) {
  const porOrdem = new Map();
  linhas.forEach((linha) => {
    const provedor = porOrdem.get(linha.provedor_ordem) || { nome: linha.provedor_nome, celulas: {} };
    porOrdem.set(linha.provedor_ordem, { ...provedor, celulas: { ...provedor.celulas, [linha.dimensao]: { nota: linha.nota, texto: linha.texto } } });
  });
  return [...porOrdem.keys()].sort((a, b) => a - b).map((ordem) => porOrdem.get(ordem));
}

function rotasDeDadosDoGrupo({ db }) {
  const rotas = express.Router();
  const grupoDaRota = (req) => carregarGrupo(db, req.usuario, lerId(req.params.id));

  const montarDados = (grupoId) => {
    const grupo = db.prepare('SELECT * FROM grupos WHERE id = ?').get(grupoId);
    return {
      grupo: { id: grupo.id, nome: grupo.nome, turma: grupo.turma },
      comparacao: {
        divergencia_destacada: grupo.divergencia_destacada,
        provedores: montarProvedores(db.prepare('SELECT * FROM comparacoes WHERE grupo_id = ? ORDER BY provedor_ordem').all(grupoId))
      },
      transacoes: db.prepare('SELECT * FROM transacoes WHERE grupo_id = ? ORDER BY id').all(grupoId),
      anotacoes: { higiene: lerLista(grupo.higiene), passos_ativos: lerLista(grupo.passos_ativos) }
    };
  };

  rotas.get('/grupos/:id/dados', (req, res) => {
    res.json(montarDados(grupoDaRota(req).id));
  });

  rotas.put('/grupos/:id/comparacao', (req, res) => {
    const grupo = grupoDaRota(req);
    const dados = validar(esquemas.comparacao, req.body);
    emTransacao(db, () => {
      db.prepare('UPDATE grupos SET divergencia_destacada = ? WHERE id = ?').run(dados.divergencia_destacada, grupo.id);
      db.prepare('DELETE FROM comparacoes WHERE grupo_id = ?').run(grupo.id);
      const inserir = db.prepare('INSERT INTO comparacoes (grupo_id, provedor_ordem, provedor_nome, dimensao, nota, texto) VALUES (?, ?, ?, ?, ?, ?)');
      dados.provedores.forEach((provedor, ordem) => {
        DIMENSOES_COMPARACAO.forEach((dimensao) => {
          inserir.run(grupo.id, ordem, provedor.nome, dimensao, provedor.celulas[dimensao].nota, provedor.celulas[dimensao].texto);
        });
      });
    });
    res.json({ comparacao: montarDados(grupo.id).comparacao });
  });

  rotas.put('/grupos/:id/anotacoes', (req, res) => {
    const grupo = grupoDaRota(req);
    const dados = validar(esquemas.anotacoesDoGrupo, req.body);
    db.prepare('UPDATE grupos SET higiene = ?, passos_ativos = ? WHERE id = ?').run(
      dados.higiene ? JSON.stringify(dados.higiene) : grupo.higiene,
      dados.passos_ativos ? JSON.stringify(dados.passos_ativos) : grupo.passos_ativos,
      grupo.id
    );
    res.json({ anotacoes: montarDados(grupo.id).anotacoes });
  });

  rotas.post('/grupos/:id/transacoes', (req, res) => {
    const grupo = grupoDaRota(req);
    const dados = validar(esquemas.transacao, req.body);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO transacoes (grupo_id, ${CAMPOS_DA_TRANSACAO.join(', ')}) VALUES (?, ${CAMPOS_DA_TRANSACAO.map(() => '?').join(', ')})
    `).run(grupo.id, ...CAMPOS_DA_TRANSACAO.map((campo) => dados[campo]));
    res.status(201).json({ transacao: db.prepare('SELECT * FROM transacoes WHERE id = ?').get(lastInsertRowid) });
  });

  const transacaoDaRota = (req) => {
    const transacao = db.prepare('SELECT * FROM transacoes WHERE id = ?').get(lerId(req.params.id));
    if (!transacao || !podeAcessarGrupo(req.usuario, transacao.grupo_id)) { throw naoEncontrado('Transação não encontrada.'); }
    return transacao;
  };

  rotas.put('/transacoes/:id', (req, res) => {
    const transacao = transacaoDaRota(req);
    const dados = validar(esquemas.transacao, req.body);
    db.prepare(`UPDATE transacoes SET ${CAMPOS_DA_TRANSACAO.map((campo) => `${campo} = ?`).join(', ')} WHERE id = ?`)
      .run(...CAMPOS_DA_TRANSACAO.map((campo) => dados[campo]), transacao.id);
    res.json({ transacao: db.prepare('SELECT * FROM transacoes WHERE id = ?').get(transacao.id) });
  });

  rotas.delete('/transacoes/:id', (req, res) => {
    db.prepare('DELETE FROM transacoes WHERE id = ?').run(transacaoDaRota(req).id);
    res.status(204).end();
  });

  return rotas;
}

module.exports = { rotasDeDadosDoGrupo };
