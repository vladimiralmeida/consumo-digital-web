'use strict';

const { naoEncontrado } = require('./erros');

/** Aluno só enxerga o próprio grupo; professor e administrador enxergam todos. */
function podeAcessarGrupo(usuario, grupoId) {
  return usuario.papel !== 'aluno' || usuario.grupo_id === grupoId;
}

/** Só integrante do grupo responde pelo grupo (validação humana e declaração de uso de IA). */
function ehIntegranteDoGrupo(usuario, grupoId) {
  return usuario.papel === 'aluno' && usuario.grupo_id === grupoId;
}

/** Devolve o grupo ou lança 404, também quando existe mas não é acessível (não revela existência). */
function carregarGrupo(db, usuario, grupoId) {
  const grupo = db.prepare('SELECT * FROM grupos WHERE id = ?').get(grupoId);
  if (!grupo || !podeAcessarGrupo(usuario, grupo.id)) { throw naoEncontrado('Grupo não encontrado.'); }
  return grupo;
}

function carregarCaso(db, usuario, casoId) {
  const caso = db.prepare('SELECT * FROM casos WHERE id = ?').get(casoId);
  if (!caso || !podeAcessarGrupo(usuario, caso.grupo_id)) { throw naoEncontrado('Caso não encontrado.'); }
  return caso;
}

module.exports = { podeAcessarGrupo, ehIntegranteDoGrupo, carregarGrupo, carregarCaso };
