'use strict';

const { ErroHttp } = require('./erros');

const POLITICA_DE_CONTEUDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

/** Cabeçalhos de segurança em todas as respostas. Sem scripts, estilos ou fontes de terceiros. */
function cabecalhosDeSeguranca({ https }) {
  return (_req, res, next) => {
    res.set({
      'Content-Security-Policy': POLITICA_DE_CONTEUDO,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin'
    });
    if (https) { res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); }
    next();
  };
}

/**
 * Limite de requisições por janela fixa, em memória (um processo, um contêiner).
 * `chave(req)` define quem é contado; `max` requisições por `janelaMs`.
 */
function limitarRequisicoes({ janelaMs, max, chave, mensagem }) {
  const contadores = new Map();
  const limpeza = setInterval(() => {
    const agora = Date.now();
    contadores.forEach((registro, id) => { if (registro.expira <= agora) { contadores.delete(id); } });
  }, janelaMs);
  limpeza.unref();

  return (req, res, next) => {
    const id = chave(req);
    const agora = Date.now();
    const anterior = contadores.get(id);
    const registro = anterior && anterior.expira > agora
      ? { total: anterior.total + 1, expira: anterior.expira }
      : { total: 1, expira: agora + janelaMs };
    contadores.set(id, registro);
    if (registro.total > max) {
      res.set('Retry-After', String(Math.ceil((registro.expira - agora) / 1000)));
      throw new ErroHttp(429, mensagem || 'Muitas requisições. Aguarde um pouco e tente de novo.');
    }
    next();
  };
}

module.exports = { cabecalhosDeSeguranca, limitarRequisicoes, POLITICA_DE_CONTEUDO };
