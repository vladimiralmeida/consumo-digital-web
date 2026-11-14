'use strict';

const express = require('express');
const auth = require('../auth');
const { ErroHttp, invalido } = require('../erros');
const { limitarRequisicoes } = require('../seguranca');
const { esquemas, validar } = require('../validacao');

const JANELA_LOGIN_MS = 15 * 60 * 1000;
const TENTATIVAS_LOGIN = 10;
/* Hash usado quando o e-mail não existe, para o tempo de resposta não revelar quais contas existem. */
const HASH_DE_COMPARACAO = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

function rotasDeAutenticacao({ db, config }) {
  const rotas = express.Router();
  const opcoesDoCookie = { seguro: config.cookieSeguro, maxAgeSegundos: Math.floor(auth.DURACAO_SESSAO_MS / 1000) };

  const iniciarSessao = (res, usuarioId) => {
    const { token, csrf } = auth.criarSessao(db, usuarioId);
    res.set('Set-Cookie', auth.montarCookie(token, opcoesDoCookie));
    return csrf;
  };
  const estadoDaIa = () => ({ disponivel: Boolean(config.ia.chave), ferramenta: config.ia.ferramenta, modelo: config.ia.modelo });

  const limiteDeLogin = limitarRequisicoes({
    janelaMs: JANELA_LOGIN_MS,
    max: TENTATIVAS_LOGIN,
    chave: (req) => req.ip,
    mensagem: 'Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.'
  });

  rotas.post('/login', limiteDeLogin, async (req, res) => {
    const { email, senha } = validar(esquemas.login, req.body);
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);
    const senhaConfere = await auth.conferirSenha(senha, usuario ? usuario.senha_hash : HASH_DE_COMPARACAO);
    if (!usuario || !senhaConfere) { throw new ErroHttp(401, 'E-mail ou senha incorretos.'); }
    auth.removerSessoesExpiradas(db);
    const csrf = iniciarSessao(res, usuario.id);
    res.json({ usuario: auth.usuarioPublico(usuario), csrf, ia: estadoDaIa() });
  });

  rotas.get('/me', auth.exigirLogin, (req, res) => {
    res.json({ usuario: req.usuario, csrf: req.csrf, ia: estadoDaIa() });
  });

  rotas.post('/logout', (req, res) => {
    auth.encerrarSessao(db, auth.lerCookie(req, auth.NOME_COOKIE));
    res.set('Set-Cookie', auth.montarCookie('', { seguro: config.cookieSeguro, maxAgeSegundos: 0 }));
    res.status(204).end();
  });

  rotas.post('/senha', auth.exigirLogin, async (req, res) => {
    const { atual, nova } = validar(esquemas.trocaDeSenha, req.body);
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!(await auth.conferirSenha(atual, usuario.senha_hash))) { throw invalido('A senha atual não confere.'); }
    if (atual === nova) { throw invalido('A senha nova precisa ser diferente da atual.'); }
    const hash = await auth.gerarHashDaSenha(nova);
    db.prepare('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 0 WHERE id = ?').run(hash, usuario.id);
    auth.encerrarSessoesDoUsuario(db, usuario.id);
    const csrf = iniciarSessao(res, usuario.id);
    res.json({ usuario: { ...req.usuario, deve_trocar_senha: false }, csrf, ia: estadoDaIa() });
  });

  return rotas;
}

module.exports = { rotasDeAutenticacao };
