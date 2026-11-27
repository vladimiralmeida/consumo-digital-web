'use strict';

const express = require('express');
const { carregarCaso } = require('../acesso');
const { buscarCopiaArquivada } = require('../arquivo');
const repositorio = require('../casos-repositorio');
const { emTransacao } = require('../db');
const { limitarRequisicoes } = require('../seguranca');
const { esquemas, validar, lerId, LIMITES } = require('../validacao');

const JANELA_MS = 60 * 1000;
const BUSCAS_POR_JANELA = 10;

function rotasDeArquivo({ db, fetchImpl }) {
  const rotas = express.Router();
  const limite = limitarRequisicoes({
    janelaMs: JANELA_MS,
    max: BUSCAS_POR_JANELA,
    chave: (req) => `arquivo:${req.usuario.id}`,
    mensagem: 'Muitas buscas na Wayback Machine em pouco tempo. Aguarde um minuto.'
  });

  /* Preenche o diagnóstico com a cópia arquivada do documento: link, data de acesso e texto-fonte. */
  rotas.post('/casos/:id/arquivo', limite, async (req, res) => {
    const caso = carregarCaso(db, req.usuario, lerId(req.params.id));
    const { url } = validar(esquemas.copiaArquivada, req.body);
    const copia = await buscarCopiaArquivada({ fetchImpl, endereco: url });
    const textoFonte = copia.texto.slice(0, LIMITES.textoFonte);
    const hoje = new Date().toISOString().slice(0, 10);

    emTransacao(db, () => {
      repositorio.garantirRegistros(db, caso.id);
      db.prepare(`
        UPDATE diagnosticos SET documento_url = ?, link_arquivado = ?, data_acesso = ?, texto_fonte = ?, atualizado_em = datetime('now')
        WHERE caso_id = ?
      `).run(url, copia.link_arquivado, hoje, textoFonte, caso.id);
      repositorio.reconferirRespostas(db, caso.id, textoFonte);
      repositorio.marcarCasoAtualizado(db, caso.id);
    });

    const { diagnostico, respostas, indice } = repositorio.montarCaso(db, caso);
    res.json({ diagnostico, respostas, indice, data_da_captura: copia.data_da_captura, texto_curto: copia.texto_curto });
  });

  return rotas;
}

module.exports = { rotasDeArquivo };
