'use strict';

const { gerarHashDaSenha } = require('./auth');

/**
 * Cria o administrador inicial quando o banco ainda não tem nenhum.
 * Falha na partida, com mensagem clara, se as variáveis necessárias não estiverem definidas.
 */
async function garantirAdministrador(db, config) {
  const existe = db.prepare("SELECT 1 FROM usuarios WHERE papel = 'admin' AND ativo = 1").get();
  if (existe) { return false; }
  if (!config.adminEmail || config.adminSenha.length < config.senhaMinima) {
    throw new Error(`Defina ADMIN_EMAIL e ADMIN_SENHA (mínimo de ${config.senhaMinima} caracteres) para criar o administrador inicial.`);
  }
  const hash = await gerarHashDaSenha(config.adminSenha);
  db.prepare("INSERT INTO usuarios (nome, email, senha_hash, papel, deve_trocar_senha) VALUES (?, ?, ?, 'admin', 1)")
    .run(config.adminNome, config.adminEmail, hash);
  return true;
}

module.exports = { garantirAdministrador };
