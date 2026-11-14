'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { conferirSenha } = require('../server/auth');
const { lerConfig } = require('../server/config');
const { abrirBanco } = require('../server/db');
const { garantirAdministrador } = require('../server/semente');

test('administrador inicial é criado só uma vez, com senha em hash e troca obrigatória', async () => {
  const db = abrirBanco(':memory:');
  const config = lerConfig({ ADMIN_EMAIL: 'Chefe@Teste.br', ADMIN_SENHA: 'senha-inicial-123' });

  const primeira = await garantirAdministrador(db, config);
  const segunda = await garantirAdministrador(db, config);
  const admin = db.prepare("SELECT * FROM usuarios WHERE papel = 'admin'").all();

  assert.equal(primeira, true);
  assert.equal(segunda, false);
  assert.equal(admin.length, 1);
  assert.equal(admin[0].email, 'chefe@teste.br');
  assert.equal(admin[0].deve_trocar_senha, 1);
  assert.equal(admin[0].senha_hash.includes('senha-inicial-123'), false);
  assert.equal(await conferirSenha('senha-inicial-123', admin[0].senha_hash), true);
  db.close();
});

test('partida falha com mensagem clara quando falta a senha do administrador inicial', async () => {
  const db = abrirBanco(':memory:');

  await assert.rejects(garantirAdministrador(db, lerConfig({ ADMIN_EMAIL: 'a@teste.br', ADMIN_SENHA: 'curta' })), /ADMIN_EMAIL e ADMIN_SENHA/);
  db.close();
});

test('configuração não traz segredo padrão e liga o cookie seguro em produção', () => {
  const producao = lerConfig({ NODE_ENV: 'production' });
  const local = lerConfig({});

  assert.equal(producao.cookieSeguro, true);
  assert.equal(local.cookieSeguro, false);
  assert.equal(producao.ia.chave, '');
  assert.equal(producao.adminSenha, '');
});

test('migrações são aplicadas uma vez e o banco reabre sem erro', () => {
  const db = abrirBanco(':memory:');

  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  db.close();
});
