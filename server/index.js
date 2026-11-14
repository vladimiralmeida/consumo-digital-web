'use strict';

const { criarApp } = require('./app');
const { removerSessoesExpiradas } = require('./auth');
const { carregarArquivoEnv, lerConfig } = require('./config');
const { abrirBanco } = require('./db');
const { garantirAdministrador } = require('./semente');

const INTERVALO_DE_LIMPEZA_MS = 60 * 60 * 1000;

async function iniciar() {
  carregarArquivoEnv();
  const config = lerConfig();
  const db = abrirBanco(config.caminhoBanco);
  if (await garantirAdministrador(db, config)) {
    console.log(`[inicio] administrador inicial criado: ${config.adminEmail} (a senha deve ser trocada no primeiro acesso)`);
  }
  removerSessoesExpiradas(db);
  setInterval(() => removerSessoesExpiradas(db), INTERVALO_DE_LIMPEZA_MS).unref();

  const servidor = criarApp({ db, config }).listen(config.porta, () => {
    console.log(`[inicio] Consumo Digital em http://localhost:${config.porta} · IA ${config.ia.chave ? 'ativada' : 'desativada'}`);
  });

  const encerrar = () => {
    servidor.close(() => { db.close(); process.exit(0); });
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((erro) => {
  console.error('[inicio] não foi possível iniciar:', erro.message);
  process.exit(1);
});
