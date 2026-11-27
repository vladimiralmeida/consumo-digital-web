'use strict';

const express = require('express');
const { carregarCaso } = require('../acesso');
const repositorio = require('../casos-repositorio');
const { emTransacao } = require('../db');
const { ErroHttp, invalido, naoEncontrado } = require('../erros');
const { verificarAnuncio } = require('../ia/anuncio');
const { consultarDeepSeek } = require('../ia/deepseek');
const { montarAbertura, redigirSecao, SECOES_DE_IA } = require('../ia/parecer');
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

  /* Verificação automática do checklist de publicidade sobre o texto do anúncio salvo no caso. */
  rotas.post('/casos/:id/anuncio/ia', limiteDeIa, async (req, res) => {
    const caso = carregarCaso(db, req.usuario, lerId(req.params.id));
    const { substituir } = validar(esquemas.consultaIa, req.body);
    if (!config.ia.chave) { throw new ErroHttp(503, 'A verificação com IA não está configurada neste servidor.'); }
    if (!caso.anuncio_texto.trim()) { throw invalido('Transcreva ou descreva o anúncio antes de pedir a verificação.'); }
    const temRespostaDoGrupo = repositorio.lerAnaliseDoAnuncio(caso).some((ponto) => ponto.origem === 'grupo' && ponto.resposta !== null);
    if (temRespostaDoGrupo && !substituir) {
      throw new ErroHttp(409, 'O checklist já tem respostas do grupo.', { codigo: 'resposta_do_grupo' });
    }

    const verificacao = await verificarAnuncio({ config: config.ia, fetchImpl, textoDoAnuncio: caso.anuncio_texto });
    /* A conferência do trecho é feita por código contra o texto do anúncio, nunca pelo modelo. */
    const pontos = repositorio.conferirPontosDoAnuncio(verificacao.pontos.map((ponto) => ({ ...ponto, origem: 'ia' })), caso.anuncio_texto);
    emTransacao(db, () => {
      db.prepare("UPDATE casos SET anuncio_analise = ?, atualizado_em = datetime('now') WHERE id = ?").run(JSON.stringify(pontos), caso.id);
      db.prepare(`
        INSERT INTO consultas_ia (caso_id, dimensao, pergunta_id, usuario_id, ferramenta, modelo, prompt, resposta)
        VALUES (?, 0, 'Publicidade', ?, ?, ?, ?, ?)
      `).run(caso.id, req.usuario.id, config.ia.ferramenta, verificacao.modelo, verificacao.pergunta, verificacao.respostaBruta);
    });

    const atualizado = repositorio.montarCaso(db, db.prepare('SELECT * FROM casos WHERE id = ?').get(caso.id));
    res.json({ caso: atualizado.caso, consultas: atualizado.consultas });
  });

  /*
   * Redação do parecer, seção a seção. "abertura" (título, objeto e metodologia) é montada por
   * código com os fatos do caso; as demais são redigidas pela IA a partir das respostas salvas.
   * A rota só devolve o texto: quem grava o parecer é o grupo, pela rota própria.
   */
  rotas.post('/casos/:id/parecer/ia/:secao', limiteDeIa, async (req, res) => {
    const caso = carregarCaso(db, req.usuario, lerId(req.params.id));
    const { secao } = req.params;
    if (secao !== 'abertura' && !SECOES_DE_IA.includes(secao)) { throw naoEncontrado('Seção não encontrada.'); }
    const pacote = repositorio.montarCaso(db, caso);
    if (!pacote.indice.completo) {
      throw invalido(`Conclua a análise de opacidade antes de redigir o parecer: ${pacote.indice.respondidasBase} de ${pacote.indice.totalBase} dimensões da régua base têm nota.`);
    }
    const comIa = Boolean(config.ia.chave);
    if (secao === 'abertura') { return res.json({ texto: montarAbertura(pacote, { comIa, ferramenta: config.ia.ferramenta }), consultas: pacote.consultas }); }
    if (!comIa) { throw new ErroHttp(503, 'A redação com IA não está configurada neste servidor.'); }

    const redacao = await redigirSecao({ config: config.ia, fetchImpl, pacote, secao });
    db.prepare(`
      INSERT INTO consultas_ia (caso_id, dimensao, pergunta_id, usuario_id, ferramenta, modelo, prompt, resposta)
      VALUES (?, 0, ?, ?, ?, ?, ?, ?)
    `).run(caso.id, `Parecer: ${redacao.titulo}`, req.usuario.id, config.ia.ferramenta, redacao.modelo, redacao.pergunta, redacao.respostaBruta);
    return res.json({ texto: redacao.texto, consultas: repositorio.montarCaso(db, caso).consultas });
  });

  return rotas;
}

module.exports = { rotasDeIa };
