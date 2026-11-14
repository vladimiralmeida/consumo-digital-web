'use strict';

const express = require('express');
const { carregarCaso } = require('../acesso');
const repositorio = require('../casos-repositorio');
const { emTransacao } = require('../db');
const { ErroHttp, invalido, naoEncontrado } = require('../erros');
const { consultarDeepSeek } = require('../ia/deepseek');
const { limitarRequisicoes } = require('../seguranca');
const { esquemas, validar, lerId } = require('../validacao');

const JANELA_IA_MS = 60 * 1000;
const CONSULTAS_POR_JANELA = 30;

function rotasDeIa({ db, config, fetchImpl }) {
  const rotas = express.Router();
  const limiteDeIa = limitarRequisicoes({
    janelaMs: JANELA_IA_MS,
    max: CONSULTAS_POR_JANELA,
    chave: (req) => `ia:${req.usuario.id}`,
    mensagem: 'Muitas consultas à IA em pouco tempo. Aguarde um minuto e continue.'
  });

  rotas.post('/casos/:id/ia/:dimensao', limiteDeIa, async (req, res) => {
    const caso = carregarCaso(db, req.usuario, lerId(req.params.id));
    const dimensao = repositorio.dimensaoPorNumero(lerId(req.params.dimensao));
    if (!dimensao) { throw naoEncontrado('Dimensão não encontrada.'); }
    const { substituir } = validar(esquemas.consultaIa, req.body);
    if (!config.ia.chave) { throw new ErroHttp(503, 'O diagnóstico com IA não está configurado neste servidor.'); }

    repositorio.garantirRegistros(db, caso.id);
    const { texto_fonte: textoFonte } = db.prepare('SELECT texto_fonte FROM diagnosticos WHERE caso_id = ?').get(caso.id);
    if (!textoFonte.trim()) { throw invalido('Cole o texto do documento arquivado antes de consultar a IA.'); }
    const existente = db.prepare('SELECT origem FROM respostas WHERE caso_id = ? AND dimensao = ?').get(caso.id, dimensao.n);
    if (existente && existente.origem === 'grupo' && !substituir) {
      throw new ErroHttp(409, 'Esta dimensão já tem uma resposta do grupo.', { codigo: 'resposta_do_grupo' });
    }

    const sugestao = await consultarDeepSeek({ config: config.ia, fetchImpl, dimensao, textoFonte });
    emTransacao(db, () => {
      /* A conferência do trecho é feita por código contra o texto-fonte, nunca pelo modelo. */
      const conferido = repositorio.conferirResposta(dimensao, sugestao.trecho_literal, textoFonte);
      repositorio.gravarResposta(db, caso.id, dimensao, {
        nota: sugestao.nota,
        trecho_literal: sugestao.trecho_literal,
        conferido,
        resumo: sugestao.resumo,
        por_que: sugestao.por_que
      }, 'ia');
      db.prepare(`
        INSERT INTO consultas_ia (caso_id, dimensao, pergunta_id, usuario_id, ferramenta, modelo, prompt, resposta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(caso.id, dimensao.n, dimensao.pid, req.usuario.id, config.ia.ferramenta, sugestao.modelo, sugestao.pergunta, sugestao.respostaBruta);
      repositorio.marcarCasoAtualizado(db, caso.id);
    });

    const { respostas, indice, consultas } = repositorio.montarCaso(db, caso);
    res.json({ respostas, indice, consultas, documento_truncado: sugestao.truncado });
  });

  return rotas;
}

module.exports = { rotasDeIa };
