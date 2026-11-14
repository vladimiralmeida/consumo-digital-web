'use strict';

const express = require('express');
const auth = require('../auth');
const { carregarGrupo } = require('../acesso');
const { emTransacao } = require('../db');
const { ErroHttp, invalido, naoEncontrado, proibido } = require('../erros');
const { esquemas, validar, lerId } = require('../validacao');

const CAMPOS_DO_USUARIO = 'id, nome, email, papel, grupo_id, deve_trocar_senha, ativo, criado_em';

const formatarUsuario = (linha) => ({ ...linha, deve_trocar_senha: Boolean(linha.deve_trocar_senha), ativo: Boolean(linha.ativo) });
const formatarGrupo = (linha) => ({ id: linha.id, nome: linha.nome, turma: linha.turma, criado_em: linha.criado_em });

function traduzirErroDeUnicidade(erro, mensagem) {
  if (String(erro.message).includes('UNIQUE')) { return new ErroHttp(409, mensagem); }
  return erro;
}

/** Aplica as mudanças pedidas sobre a conta atual. Só aluno tem grupo. */
function calcularContaFinal(alvo, mudancas) {
  const papel = mudancas.papel ?? alvo.papel;
  const grupoPedido = mudancas.grupo_id === undefined ? alvo.grupo_id : mudancas.grupo_id;
  if (papel === 'aluno' && grupoPedido === null) { throw invalido('Escolha o grupo do aluno.'); }
  return {
    nome: mudancas.nome ?? alvo.nome,
    papel,
    grupo_id: papel === 'aluno' ? grupoPedido : null,
    ativo: mudancas.ativo ?? Boolean(alvo.ativo)
  };
}

function rotasDeAdministracao({ db }) {
  const rotas = express.Router();
  const somenteGestao = auth.exigirPapel('admin', 'professor');

  const exigirGrupoExistente = (grupoId) => {
    if (grupoId !== null && !db.prepare('SELECT 1 FROM grupos WHERE id = ?').get(grupoId)) { throw invalido('O grupo escolhido não existe.'); }
  };
  /* Professor administra apenas contas de aluno; contas de professor e administrador são do administrador. */
  const exigirAlcance = (gestor, papelDoAlvo) => {
    if (gestor.papel !== 'admin' && papelDoAlvo !== 'aluno') { throw proibido('Só o administrador gerencia contas de professor e de administrador.'); }
  };
  const contarAdministradoresAtivos = () => db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'admin' AND ativo = 1").get().total;
  /* Ninguém se tranca para fora: a própria conta não é desativada e sempre sobra um administrador ativo. */
  const exigirAdministracaoPreservada = (gestor, alvo, final) => {
    const ehPropriaConta = alvo.id === gestor.id;
    const perdeAdministracao = alvo.papel === 'admin' && Boolean(alvo.ativo) && (final.papel !== 'admin' || !final.ativo);
    if (perdeAdministracao && ehPropriaConta) { throw invalido('Você não pode remover o próprio acesso de administrador.'); }
    if (perdeAdministracao && contarAdministradoresAtivos() <= 1) { throw invalido('O sistema precisa de pelo menos um administrador ativo.'); }
    if (!final.ativo && ehPropriaConta) { throw invalido('Você não pode desativar a própria conta.'); }
  };

  /* ---------- grupos ---------- */

  rotas.get('/grupos', (req, res) => {
    const grupos = req.usuario.papel === 'aluno'
      ? db.prepare('SELECT * FROM grupos WHERE id = ?').all(req.usuario.grupo_id)
      : db.prepare('SELECT * FROM grupos ORDER BY nome').all();
    res.json({ grupos: grupos.map(formatarGrupo) });
  });

  rotas.post('/grupos', somenteGestao, (req, res) => {
    const { nome, turma } = validar(esquemas.grupo, req.body);
    try {
      const { lastInsertRowid } = db.prepare('INSERT INTO grupos (nome, turma) VALUES (?, ?)').run(nome, turma);
      res.status(201).json({ grupo: formatarGrupo(db.prepare('SELECT * FROM grupos WHERE id = ?').get(lastInsertRowid)) });
    } catch (erro) {
      throw traduzirErroDeUnicidade(erro, 'Já existe um grupo com esse nome.');
    }
  });

  rotas.put('/grupos/:id', somenteGestao, (req, res) => {
    const grupo = carregarGrupo(db, req.usuario, lerId(req.params.id));
    const { nome, turma } = validar(esquemas.grupo, req.body);
    try {
      db.prepare('UPDATE grupos SET nome = ?, turma = ? WHERE id = ?').run(nome, turma, grupo.id);
    } catch (erro) {
      throw traduzirErroDeUnicidade(erro, 'Já existe um grupo com esse nome.');
    }
    res.json({ grupo: formatarGrupo({ ...grupo, nome, turma }) });
  });

  /* ---------- usuários ---------- */

  rotas.get('/usuarios', somenteGestao, (_req, res) => {
    const usuarios = db.prepare(`SELECT ${CAMPOS_DO_USUARIO} FROM usuarios ORDER BY ativo DESC, nome`).all();
    res.json({ usuarios: usuarios.map(formatarUsuario) });
  });

  rotas.post('/usuarios', somenteGestao, async (req, res) => {
    const dados = validar(esquemas.usuarioNovo, req.body);
    exigirAlcance(req.usuario, dados.papel);
    const grupoId = dados.papel === 'aluno' ? dados.grupo_id : null;
    exigirGrupoExistente(grupoId);
    const senhaInicial = auth.gerarSenhaInicial();
    const hash = await auth.gerarHashDaSenha(senhaInicial);
    try {
      const { lastInsertRowid } = db.prepare('INSERT INTO usuarios (nome, email, senha_hash, papel, grupo_id) VALUES (?, ?, ?, ?, ?)')
        .run(dados.nome, dados.email, hash, dados.papel, grupoId);
      const usuario = db.prepare(`SELECT ${CAMPOS_DO_USUARIO} FROM usuarios WHERE id = ?`).get(lastInsertRowid);
      /* A senha inicial aparece só nesta resposta; no banco fica apenas o hash. */
      res.status(201).json({ usuario: formatarUsuario(usuario), senha_inicial: senhaInicial });
    } catch (erro) {
      throw traduzirErroDeUnicidade(erro, 'Já existe uma conta com esse e-mail.');
    }
  });

  rotas.patch('/usuarios/:id', somenteGestao, async (req, res) => {
    const alvo = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(lerId(req.params.id));
    if (!alvo) { throw naoEncontrado('Conta não encontrada.'); }
    const mudancas = validar(esquemas.usuarioEdicao, req.body);
    const final = calcularContaFinal(alvo, mudancas);
    exigirAlcance(req.usuario, alvo.papel);
    exigirAlcance(req.usuario, final.papel);
    exigirGrupoExistente(final.grupo_id);
    exigirAdministracaoPreservada(req.usuario, alvo, final);

    const senhaInicial = mudancas.redefinir_senha ? auth.gerarSenhaInicial() : null;
    const hash = senhaInicial ? await auth.gerarHashDaSenha(senhaInicial) : null;
    emTransacao(db, () => {
      db.prepare('UPDATE usuarios SET nome = ?, papel = ?, grupo_id = ?, ativo = ? WHERE id = ?')
        .run(final.nome, final.papel, final.grupo_id, Number(final.ativo), alvo.id);
      if (hash) { db.prepare('UPDATE usuarios SET senha_hash = ?, deve_trocar_senha = 1 WHERE id = ?').run(hash, alvo.id); }
      /* Mudança de senha, de papel, de grupo ou desativação derruba as sessões abertas da conta. */
      const mudouAcesso = hash || !final.ativo || final.papel !== alvo.papel || final.grupo_id !== alvo.grupo_id;
      if (mudouAcesso) { auth.encerrarSessoesDoUsuario(db, alvo.id); }
    });
    const usuario = db.prepare(`SELECT ${CAMPOS_DO_USUARIO} FROM usuarios WHERE id = ?`).get(alvo.id);
    res.json({ usuario: formatarUsuario(usuario), ...(senhaInicial ? { senha_inicial: senhaInicial } : {}) });
  });

  return rotas;
}

module.exports = { rotasDeAdministracao };
