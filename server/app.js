'use strict';

const path = require('node:path');
const express = require('express');
const auth = require('./auth');
const { ErroHttp } = require('./erros');
const { cabecalhosDeSeguranca, limitarRequisicoes } = require('./seguranca');
const { rotasDeAutenticacao } = require('./rotas/autenticacao');
const { rotasDeAdministracao } = require('./rotas/administracao');
const { rotasDeArquivo } = require('./rotas/arquivo');
const { rotasDeCasos } = require('./rotas/casos');
const { rotasDeDadosDoGrupo } = require('./rotas/grupo-dados');
const { rotasDeIa } = require('./rotas/ia');

const JANELA_GERAL_MS = 60 * 1000;
const REQUISICOES_POR_JANELA = 300;
const TAMANHO_MAXIMO_DO_CORPO = '1mb';

function tratarErros(erro, _req, res, _next) {
  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: erro.message, ...(erro.detalhes || {}) });
  }
  if (erro.type === 'entity.too.large') { return res.status(413).json({ erro: 'O conteúdo enviado é grande demais.' }); }
  if (erro.type === 'entity.parse.failed') { return res.status(400).json({ erro: 'Os dados enviados não são um JSON válido.' }); }
  console.error('[erro]', erro);
  return res.status(500).json({ erro: 'Erro interno. Tente de novo; se continuar, avise o administrador.' });
}

/**
 * Monta a aplicação. Recebe as dependências (banco, configuração e fetch) para que os testes
 * usem banco em memória e um serviço de IA simulado.
 */
function criarApp({ db, config, fetchImpl = globalThis.fetch }) {
  const app = express();
  const contexto = { db, config, fetchImpl };

  app.disable('x-powered-by');
  app.set('trust proxy', config.proxiesConfiaveis);
  app.use(cabecalhosDeSeguranca({ https: config.cookieSeguro }));

  app.get('/saude', (_req, res) => { res.json({ ok: true }); });

  /* Só index.html e a pasta assets são públicos; o restante do repositório nunca é servido. */
  app.use('/assets', express.static(path.join(config.raiz, 'assets'), { index: false, fallthrough: false }));
  app.get('/', (_req, res) => { res.sendFile(path.join(config.raiz, 'index.html')); });

  const api = express.Router();
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  api.use(limitarRequisicoes({ janelaMs: JANELA_GERAL_MS, max: REQUISICOES_POR_JANELA, chave: (req) => req.ip }));
  api.use(express.json({ limit: TAMANHO_MAXIMO_DO_CORPO }));
  api.use(auth.carregarSessao(db));
  api.use(auth.protegerContraCsrf);
  api.use('/auth', rotasDeAutenticacao(contexto));
  api.use(auth.exigirLogin, auth.exigirSenhaDefinitiva);
  api.use(rotasDeAdministracao(contexto));
  api.use(rotasDeCasos(contexto));
  api.use(rotasDeDadosDoGrupo(contexto));
  api.use(rotasDeIa(contexto));
  api.use(rotasDeArquivo(contexto));
  api.use(() => { throw new ErroHttp(404, 'Recurso não encontrado.'); });

  app.use('/api', api);
  app.use((_req, res) => { res.status(404).type('text/plain').send('Página não encontrada.'); });
  app.use(tratarErros);
  return app;
}

module.exports = { criarApp };
