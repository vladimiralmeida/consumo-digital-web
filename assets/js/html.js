/*
 * Montagem de HTML com escape por padrão.
 * Tudo o que entra em um modelo html`...` é escapado, a menos que já seja uma Marcacao
 * (resultado de outro html`...`). Texto digitado por alguém nunca vira marcação.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapar(valor) {
  return String(valor).replace(/[&<>"']/g, (caractere) => ESCAPES[caractere]);
}

class Marcacao {
  constructor(texto) { this.texto = texto; }
  toString() { return this.texto; }
}

function converter(valor) {
  if (valor === null || valor === undefined || valor === false) { return ''; }
  if (valor instanceof Marcacao) { return valor.texto; }
  if (Array.isArray(valor)) { return valor.map(converter).join(''); }
  return escapar(valor);
}

/** Modelo etiquetado: html`<p>${textoDoUsuario}</p>` devolve Marcacao com o texto escapado. */
export function html(partes, ...valores) {
  return new Marcacao(partes.reduce((acumulado, parte, i) => acumulado + parte + (i < valores.length ? converter(valores[i]) : ''), ''));
}

/** Atributo booleano: atributo(condicao, 'disabled') devolve o atributo ou nada. */
export function atributo(condicao, nome) {
  return condicao ? new Marcacao(` ${nome}`) : '';
}
