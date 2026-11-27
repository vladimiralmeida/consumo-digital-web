'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { ErroHttp, proibido } = require('./erros');

const scrypt = promisify(crypto.scrypt);

const NOME_COOKIE = 'sid';
const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;
const TAMANHO_SAL = 16;
const TAMANHO_HASH = 64;
const TAMANHO_SENHA_GERADA = 14;
const ALFABETO_SENHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function gerarHashDaSenha(senha) {
  const sal = crypto.randomBytes(TAMANHO_SAL);
  const hash = await scrypt(senha, sal, TAMANHO_HASH);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

async function conferirSenha(senha, armazenado) {
  const [esquema, salB64, hashB64] = String(armazenado).split('$');
  if (esquema !== 'scrypt' || !salB64 || !hashB64) { return false; }
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = await scrypt(senha, Buffer.from(salB64, 'base64'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

function gerarSenhaInicial() {
  return Array.from(crypto.randomBytes(TAMANHO_SENHA_GERADA), (byte) => ALFABETO_SENHA[byte % ALFABETO_SENHA.length]).join('');
}

const hashDoToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function iguaisEmTempoConstante(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

function lerCookie(req, nome) {
  const cabecalho = req.headers.cookie || '';
  const par = cabecalho.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : '';
}

function montarCookie(valor, { seguro, maxAgeSegundos }) {
  const partes = [`${NOME_COOKIE}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSegundos}`];
  if (seguro) { partes.push('Secure'); }
  return partes.join('; ');
}

/** Cria a sessão no banco e devolve o token (só o hash fica guardado) e o token CSRF. */
function criarSessao(db, usuarioId, agora = Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, csrf, expira_em) VALUES (?, ?, ?, ?)')
    .run(hashDoToken(token), usuarioId, csrf, agora + DURACAO_SESSAO_MS);
  return { token, csrf };
}

function encerrarSessao(db, token) {
  if (token) { db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashDoToken(token)); }
}

function encerrarSessoesDoUsuario(db, usuarioId) {
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuarioId);
}

function removerSessoesExpiradas(db, agora = Date.now()) {
  db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora);
}

function buscarSessao(db, token, agora = Date.now()) {
  if (!token) { return null; }
  return db.prepare(`
    SELECT s.csrf, u.id, u.nome, u.email, u.papel, u.grupo_id, u.deve_trocar_senha
    FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1
  `).get(hashDoToken(token), agora) || null;
}

function usuarioPublico(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
    grupo_id: linha.grupo_id,
    deve_trocar_senha: Boolean(linha.deve_trocar_senha)
  };
}

/** Anexa `req.usuario` e `req.csrf` quando há sessão válida. Não bloqueia. */
function carregarSessao(db) {
  return (req, _res, next) => {
    const sessao = buscarSessao(db, lerCookie(req, NOME_COOKIE));
    if (sessao) {
      req.usuario = usuarioPublico(sessao);
      req.csrf = sessao.csrf;
    }
    next();
  };
}

function exigirLogin(req, _res, next) {
  if (!req.usuario) { throw new ErroHttp(401, 'Entre com seu e-mail e senha para continuar.'); }
  next();
}

/** Bloqueia o uso do sistema enquanto a senha inicial não for trocada. */
function exigirSenhaDefinitiva(req, _res, next) {
  if (req.usuario.deve_trocar_senha) { throw new ErroHttp(403, 'Troque a senha inicial antes de continuar.', { codigo: 'trocar_senha' }); }
  next();
}

const exigirPapel = (...papeis) => (req, _res, next) => {
  if (!papeis.includes(req.usuario.papel)) { throw proibido(); }
  next();
};

/**
 * Proteção CSRF: toda requisição que altera dados precisa ser JSON e trazer o token da sessão.
 * O login não tem sessão ainda; ali valem o cookie SameSite=Strict e a exigência de JSON.
 */
function protegerContraCsrf(req, _res, next) {
  if (METODOS_SEGUROS.has(req.method)) { return next(); }
  if (!req.is('application/json')) { throw new ErroHttp(415, 'Envie os dados em JSON.'); }
  if (req.usuario && !iguaisEmTempoConstante(req.get('X-CSRF-Token') || '', req.csrf)) {
    throw new ErroHttp(403, 'Sessão inválida. Recarregue a página e tente de novo.');
  }
  next();
}

module.exports = {
  NOME_COOKIE,
  DURACAO_SESSAO_MS,
  gerarHashDaSenha,
  conferirSenha,
  gerarSenhaInicial,
  lerCookie,
  montarCookie,
  criarSessao,
  encerrarSessao,
  encerrarSessoesDoUsuario,
  removerSessoesExpiradas,
  usuarioPublico,
  carregarSessao,
  exigirLogin,
  exigirSenhaDefinitiva,
  exigirPapel,
  protegerContraCsrf
};
