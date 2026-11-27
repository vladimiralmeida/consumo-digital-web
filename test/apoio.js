'use strict';

const { criarApp } = require('../server/app');
const { gerarHashDaSenha } = require('../server/auth');
const { lerConfig } = require('../server/config');
const { abrirBanco } = require('../server/db');

const SENHA = 'senha-de-teste-123';

/** Cliente HTTP mínimo que guarda o cookie de sessão e o token CSRF, como o navegador faz. */
function criarCliente(urlBase) {
  let cookie = '';
  let csrf = '';
  const chamar = async (metodo, caminho, corpo, cabecalhos = {}) => {
    const resposta = await fetch(urlBase + caminho, {
      method: metodo,
      headers: {
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...cabecalhos
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined
    });
    const novoCookie = resposta.headers.get('set-cookie');
    if (novoCookie) { cookie = novoCookie.split(';')[0]; }
    const texto = await resposta.text();
    const dados = texto && resposta.headers.get('content-type')?.includes('json') ? JSON.parse(texto) : texto;
    if (dados && dados.csrf) { csrf = dados.csrf; }
    return { status: resposta.status, dados, cabecalhos: resposta.headers };
  };
  return {
    get: (caminho) => chamar('GET', caminho),
    post: (caminho, corpo = {}, cabecalhos) => chamar('POST', caminho, corpo, cabecalhos),
    put: (caminho, corpo = {}) => chamar('PUT', caminho, corpo),
    patch: (caminho, corpo = {}) => chamar('PATCH', caminho, corpo),
    del: (caminho) => chamar('DELETE', caminho, {}),
    entrar: (email, senha = SENHA) => chamar('POST', '/api/auth/login', { email, senha }),
    esquecerCsrf: () => { csrf = ''; }
  };
}

/**
 * Sobe a aplicação com banco em memória e dois grupos, cada um com um aluno, além de
 * professor e administrador. Todas as contas já estão com a senha definitiva.
 */
async function criarAmbiente({ fetchImpl, chaveIa = '' } = {}) {
  const config = lerConfig({ COOKIE_SECURE: 'false', DEEPSEEK_API_KEY: chaveIa });
  const db = abrirBanco(':memory:');
  const hash = await gerarHashDaSenha(SENHA);
  const inserirGrupo = db.prepare('INSERT INTO grupos (nome) VALUES (?)');
  const grupoA = Number(inserirGrupo.run('Grupo A').lastInsertRowid);
  const grupoB = Number(inserirGrupo.run('Grupo B').lastInsertRowid);
  const inserirUsuario = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, papel, grupo_id, deve_trocar_senha) VALUES (?, ?, ?, ?, ?, 0)');
  inserirUsuario.run('Admin', 'admin@teste.br', hash, 'admin', null);
  inserirUsuario.run('Professora', 'prof@teste.br', hash, 'professor', null);
  inserirUsuario.run('Aluna A', 'a@teste.br', hash, 'aluno', grupoA);
  inserirUsuario.run('Aluno B', 'b@teste.br', hash, 'aluno', grupoB);

  const servidor = criarApp({ db, config, fetchImpl }).listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  const urlBase = `http://127.0.0.1:${servidor.address().port}`;

  const clienteLogado = async (email) => {
    const cliente = criarCliente(urlBase);
    const { status } = await cliente.entrar(email);
    if (status !== 200) { throw new Error(`login de ${email} falhou com status ${status}`); }
    return cliente;
  };

  return {
    db,
    urlBase,
    grupoA,
    grupoB,
    novoCliente: () => criarCliente(urlBase),
    clienteLogado,
    fechar: () => new Promise((resolver) => { servidor.close(() => { db.close(); resolver(); }); })
  };
}

module.exports = { criarAmbiente, SENHA };
