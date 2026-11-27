'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../assets/data.js');
const dominio = require('../assets/dominio.js');

const notasDoExemplo = Object.fromEntries(DATA.dims.map((d) => [d.n, d.score]));

test('índice do exemplo soma as 10 dimensões base e divide por 30', () => {
  const indice = dominio.calcularIndice(DATA.dims, notasDoExemplo);

  assert.equal(indice.base, 21);
  assert.equal(indice.baseMaximo, 30);
  assert.equal(indice.percentual, 70);
  assert.equal(indice.completo, true);
});

test('módulo de IA generativa forma subíndice de 0 a 12 e não entra no índice base', () => {
  const semModulo = { ...notasDoExemplo, 11: 0, 12: 0, 13: 0, 14: 0 };

  const comModulo = dominio.calcularIndice(DATA.dims, notasDoExemplo);
  const zerado = dominio.calcularIndice(DATA.dims, semModulo);

  assert.equal(comModulo.sub, 7);
  assert.equal(comModulo.subMaximo, 12);
  assert.equal(zerado.percentual, comModulo.percentual);
});

test('índice fica marcado como incompleto quando falta nota em dimensão base', () => {
  const indice = dominio.calcularIndice(DATA.dims, { 1: 3, 2: null });

  assert.equal(indice.completo, false);
  assert.equal(indice.respondidasBase, 1);
  assert.equal(indice.base, 3);
});

test('índice ignora nota fora da régua de 0 a 3', () => {
  const indice = dominio.calcularIndice(DATA.dims, { 1: 7, 2: -1, 3: 1.5, 4: 2 });

  assert.equal(indice.base, 2);
  assert.equal(indice.respondidasBase, 1);
});

test('média ponderada usa os pesos 2,5 / 3,0 / 2,0 / 1,5 / 1,0', () => {
  const { media, maiorLacuna } = dominio.mediaPonderada(DATA.rubrica, [7, 8, 8, 7, 8]);

  assert.equal(media.toFixed(2), '7.60');
  assert.equal(DATA.rubrica[maiorLacuna].name, 'Rigor metodológico');
});

test('média ponderada com todas as notas 10 é 10', () => {
  assert.equal(dominio.mediaPonderada(DATA.rubrica, [10, 10, 10, 10, 10]).media, 10);
});

test('conferência encontra trecho apesar de aspas, caixa e quebras de linha diferentes', () => {
  const fonte = 'Cláusula 3.\nA Plataforma atua exclusivamente como\n intermediadora e não é parte nas transações entre usuários.';

  const conferido = dominio.conferirTrecho('“A PLATAFORMA atua exclusivamente como intermediadora e não é parte nas transações entre usuários.”', fonte);

  assert.equal(conferido, true);
});

test('conferência marca NÃO CONFERIDO quando o trecho não está no texto-fonte', () => {
  assert.equal(dominio.conferirTrecho('“Usamos inteligência artificial para treinar nossos modelos.”', 'Texto sem essa cláusula.'), false);
});

test('conferência exige todos os segmentos de um trecho com supressão [...]', () => {
  const fonte = 'Podemos alterar estes termos a qualquer momento. Outras regras. O uso continuado significa aceitação.';

  assert.equal(dominio.conferirTrecho('Podemos alterar estes termos [...] o uso continuado significa aceitação', fonte), true);
  assert.equal(dominio.conferirTrecho('Podemos alterar estes termos [...] mediante aviso prévio de trinta dias', fonte), false);
});

test('conferência devolve null para omisso, vazio e resposta descritiva', () => {
  assert.equal(dominio.conferirTrecho('omisso', 'qualquer texto'), null);
  assert.equal(dominio.conferirTrecho('“Omisso”.', 'qualquer texto'), null);
  assert.equal(dominio.conferirTrecho('', 'qualquer texto'), null);
  assert.equal(dominio.conferirTrecho('[Descrição: documento de 48 páginas]', 'qualquer texto'), null);
});

test('conferência sem texto-fonte não confirma trecho algum', () => {
  assert.equal(dominio.conferirTrecho('Uma cláusula qualquer do contrato', ''), false);
});

test('detecta frase de recuperação de 12 palavras, inclusive no meio de um texto', () => {
  const frase = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

  assert.equal(dominio.detectarSegredoDeCarteira(frase), 'frase');
  assert.equal(dominio.detectarSegredoDeCarteira(`minha frase: ${frase}`), 'frase');
});

test('detecta chave privada hexadecimal e no formato WIF', () => {
  const hexadecimal = 'a'.repeat(64);

  assert.equal(dominio.detectarSegredoDeCarteira(hexadecimal), 'chave');
  assert.equal(dominio.detectarSegredoDeCarteira(`0x${hexadecimal}`), 'chave');
  assert.equal(dominio.detectarSegredoDeCarteira('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'), 'chave');
});

test('aceita 64 hexadecimais só no campo do código da transação', () => {
  assert.equal(dominio.detectarSegredoDeCarteira(`0x${'b'.repeat(64)}`, true), null);
});

test('não acusa endereço público nem observação comum em português', () => {
  assert.equal(dominio.detectarSegredoDeCarteira('0x52908400098527886E0F7030069857D2E4169EE7'), null);
  assert.equal(dominio.detectarSegredoDeCarteira('A transação foi feita em sala e conferida no explorador pelo grupo todo, sem erro de valor ou de rede.'), null);
  assert.equal(dominio.detectarSegredoDeCarteira(''), null);
});

test('célula de CSV iniciada por símbolo de fórmula é neutralizada', () => {
  assert.equal(dominio.celulaCsvSegura('=HYPERLINK("http://exemplo")'), '\'=HYPERLINK("http://exemplo")');
  assert.equal(dominio.celulaCsvSegura('texto comum'), 'texto comum');
  assert.equal(dominio.celulaCsvSegura(null), '');
});
