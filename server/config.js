'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const SENHA_MINIMA = 10;

function carregarArquivoEnv() {
  const arquivo = path.join(RAIZ, '.env');
  if (fs.existsSync(arquivo)) { process.loadEnvFile(arquivo); }
}

function booleano(valor, padrao) {
  if (valor === undefined || valor === '') { return padrao; }
  return ['1', 'true', 'sim', 'yes'].includes(String(valor).toLowerCase());
}

function inteiro(valor, padrao) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : padrao;
}

/** Lê a configuração do ambiente. Nenhum segredo tem valor padrão no código. */
function lerConfig(env = process.env) {
  const emProducao = env.NODE_ENV === 'production';
  return Object.freeze({
    raiz: RAIZ,
    porta: inteiro(env.PORT, 3000),
    caminhoBanco: env.DATABASE_PATH || path.join(RAIZ, 'data', 'consumo.db'),
    adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    adminSenha: env.ADMIN_SENHA || '',
    adminNome: (env.ADMIN_NOME || 'Administrador').trim(),
    cookieSeguro: booleano(env.COOKIE_SECURE, emProducao),
    proxiesConfiaveis: inteiro(env.TRUST_PROXY, 0),
    senhaMinima: SENHA_MINIMA,
    ia: Object.freeze({
      chave: (env.DEEPSEEK_API_KEY || '').trim(),
      modelo: (env.DEEPSEEK_MODEL || 'deepseek-chat').trim(),
      urlBase: (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').trim().replace(/\/+$/, ''),
      ferramenta: 'DeepSeek'
    })
  });
}

module.exports = { carregarArquivoEnv, lerConfig, SENHA_MINIMA };
