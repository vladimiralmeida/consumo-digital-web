'use strict';

const express = require('express');
const { carregarCaso, carregarGrupo, ehIntegranteDoGrupo } = require('../acesso');
const repositorio = require('../casos-repositorio');
const { emTransacao } = require('../db');
const { invalido, naoEncontrado, proibido } = require('../erros');
const { esquemas, validar, lerId } = require('../validacao');

const CAMPOS_DO_DIAGNOSTICO = ['plataforma', 'documento_url', 'link_arquivado', 'data_acesso', 'texto_fonte', 'ferramenta_ia', 'versao_modelo', 'data_criacao', 'prompt_usado'];
const CAMPOS_DO_CASO = ['titulo', 'tipo', 'descricao_curta'];
const LISTAS_DO_CASO = ['provas', 'checklist_publicidade'];

/** Monta "campo = ?, campo = ?" só com os campos permitidos que vieram na requisição. */
function montarAtualizacao(dados, camposPermitidos, converter = (valor) => valor) {
  const campos = camposPermitidos.filter((campo) => dados[campo] !== undefined);
  return { sql: campos.map((campo) => `${campo} = ?`), valores: campos.map((campo) => converter(dados[campo])) };
}

function rotasDeCasos({ db }) {
  const rotas = express.Router();
  const casoDaRota = (req) => carregarCaso(db, req.usuario, lerId(req.params.id));
  const respostasEIndice = (caso) => {
    const { respostas, indice } = repositorio.montarCaso(db, caso);
    return { respostas, indice };
  };

  rotas.get('/casos', (req, res) => {
    const grupo = carregarGrupo(db, req.usuario, lerId(req.query.grupo_id));
    const casos = db.prepare('SELECT * FROM casos WHERE grupo_id = ? ORDER BY atualizado_em DESC, id DESC').all(grupo.id);
    res.json({ casos: casos.map(repositorio.formatarCaso) });
  });

  rotas.post('/casos', (req, res) => {
    const dados = validar(esquemas.casoNovo, req.body);
    const grupo = carregarGrupo(db, req.usuario, dados.grupo_id);
    const casoId = emTransacao(db, () => {
      const { lastInsertRowid } = db.prepare('INSERT INTO casos (grupo_id, titulo, tipo, descricao_curta) VALUES (?, ?, ?, ?)')
        .run(grupo.id, dados.titulo, dados.tipo, dados.descricao_curta);
      repositorio.garantirRegistros(db, lastInsertRowid);
      if (dados.exemplo) { repositorio.preencherComExemplo(db, lastInsertRowid); }
      return lastInsertRowid;
    });
    res.status(201).json(repositorio.montarCaso(db, db.prepare('SELECT * FROM casos WHERE id = ?').get(casoId)));
  });

  rotas.get('/casos/:id', (req, res) => {
    res.json(repositorio.montarCaso(db, casoDaRota(req)));
  });

  rotas.patch('/casos/:id', (req, res) => {
    const caso = casoDaRota(req);
    const dados = validar(esquemas.casoEdicao, req.body);
    const textos = montarAtualizacao(dados, CAMPOS_DO_CASO);
    const listas = montarAtualizacao(dados, LISTAS_DO_CASO, JSON.stringify);
    const sql = [...textos.sql, ...listas.sql, "atualizado_em = datetime('now')"].join(', ');
    db.prepare(`UPDATE casos SET ${sql} WHERE id = ?`).run(...textos.valores, ...listas.valores, caso.id);
    res.json({ caso: repositorio.formatarCaso(db.prepare('SELECT * FROM casos WHERE id = ?').get(caso.id)) });
  });

  rotas.delete('/casos/:id', (req, res) => {
    const caso = casoDaRota(req);
    db.prepare('DELETE FROM casos WHERE id = ?').run(caso.id);
    res.status(204).end();
  });

  rotas.put('/casos/:id/diagnostico', (req, res) => {
    const caso = casoDaRota(req);
    const dados = validar(esquemas.diagnostico, req.body);
    const { sql, valores } = montarAtualizacao(dados, CAMPOS_DO_DIAGNOSTICO);
    emTransacao(db, () => {
      repositorio.garantirRegistros(db, caso.id);
      if (sql.length) {
        db.prepare(`UPDATE diagnosticos SET ${sql.join(', ')}, atualizado_em = datetime('now') WHERE caso_id = ?`).run(...valores, caso.id);
      }
      /* Texto-fonte novo invalida a conferência anterior: refaz por código, nunca por IA. */
      if (dados.texto_fonte !== undefined) { repositorio.reconferirRespostas(db, caso.id, dados.texto_fonte); }
      repositorio.marcarCasoAtualizado(db, caso.id);
    });
    res.json(respostasEIndice(caso));
  });

  rotas.put('/casos/:id/respostas/:dimensao', (req, res) => {
    const caso = casoDaRota(req);
    const dimensao = repositorio.dimensaoPorNumero(lerId(req.params.dimensao));
    if (!dimensao) { throw naoEncontrado('Dimensão não encontrada.'); }
    const dados = validar(esquemas.resposta, req.body);
    emTransacao(db, () => {
      repositorio.garantirRegistros(db, caso.id);
      const { texto_fonte: textoFonte } = db.prepare('SELECT texto_fonte FROM diagnosticos WHERE caso_id = ?').get(caso.id);
      const conferido = repositorio.conferirResposta(dimensao, dados.trecho_literal, textoFonte);
      repositorio.gravarResposta(db, caso.id, dimensao, { ...dados, conferido }, 'grupo');
      repositorio.marcarCasoAtualizado(db, caso.id);
    });
    res.json(respostasEIndice(caso));
  });

  rotas.put('/casos/:id/parecer', (req, res) => {
    const caso = casoDaRota(req);
    const dados = validar(esquemas.parecer, req.body);
    repositorio.garantirRegistros(db, caso.id);
    const atual = db.prepare('SELECT * FROM pareceres WHERE caso_id = ?').get(caso.id);

    /* Validação humana e declaração de uso de IA são atos do grupo: ninguém marca por ele. */
    const mudouValidacao = dados.validado_humano !== undefined && dados.validado_humano !== Boolean(atual.validado_humano);
    const mudouDeclaracao = dados.declaracao_ia !== undefined && dados.declaracao_ia !== Boolean(atual.declaracao_ia);
    if ((mudouValidacao || mudouDeclaracao) && !ehIntegranteDoGrupo(req.usuario, caso.grupo_id)) {
      throw proibido('Só integrantes do grupo marcam a validação humana e a declaração de uso de IA.');
    }
    if (dados.formato === undefined && dados.texto === undefined && dados.notas === undefined && !mudouValidacao && !mudouDeclaracao) {
      throw invalido('Nada para salvar.');
    }

    emTransacao(db, () => {
      db.prepare(`
        UPDATE pareceres SET formato = ?, texto = ?, notas = ?, atualizado_em = datetime('now') WHERE caso_id = ?
      `).run(dados.formato ?? atual.formato, dados.texto ?? atual.texto, dados.notas ? JSON.stringify(dados.notas) : atual.notas, caso.id);
      if (mudouValidacao) {
        db.prepare(`UPDATE pareceres SET validado_humano = ?, validado_por = ?, validado_em = CASE WHEN ? THEN datetime('now') END WHERE caso_id = ?`)
          .run(Number(dados.validado_humano), dados.validado_humano ? req.usuario.id : null, Number(dados.validado_humano), caso.id);
      }
      if (mudouDeclaracao) {
        db.prepare(`UPDATE pareceres SET declaracao_ia = ?, declarado_por = ?, declarado_em = CASE WHEN ? THEN datetime('now') END WHERE caso_id = ?`)
          .run(Number(dados.declaracao_ia), dados.declaracao_ia ? req.usuario.id : null, Number(dados.declaracao_ia), caso.id);
      }
      repositorio.marcarCasoAtualizado(db, caso.id);
    });
    res.json({ parecer: repositorio.montarCaso(db, caso).parecer });
  });

  return rotas;
}

module.exports = { rotasDeCasos };
