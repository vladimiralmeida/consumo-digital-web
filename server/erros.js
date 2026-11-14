'use strict';

/** Erro com status HTTP e mensagem segura para mostrar a quem usa o sistema. */
class ErroHttp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.detalhes = detalhes;
  }
}

const naoEncontrado = (mensagem = 'Não encontrado.') => new ErroHttp(404, mensagem);
const proibido = (mensagem = 'Você não tem permissão para esta ação.') => new ErroHttp(403, mensagem);
const invalido = (mensagem, detalhes) => new ErroHttp(400, mensagem, detalhes);

module.exports = { ErroHttp, naoEncontrado, proibido, invalido };
