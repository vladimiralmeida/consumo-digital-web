/*
 * Regras de domínio puras, usadas pelo navegador (window.Dominio) e pelo servidor (require).
 * Sem acesso a DOM, rede ou banco: só cálculo. Testes em test/dominio.test.js.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) { module.exports = fabrica(); } else { raiz.Dominio = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NOTA_MAXIMA = 3;
  var NOTA_RUBRICA_MAXIMA = 10;
  var TAMANHO_MINIMO_SEGMENTO = 8;
  var PALAVRAS_MINIMAS_FRASE = 12;

  function notaValida(nota) {
    return Number.isInteger(nota) && nota >= 0 && nota <= NOTA_MAXIMA;
  }

  function somarNotas(dimensoes, notas) {
    return dimensoes.reduce(function (acumulado, dimensao) {
      var nota = notas[dimensao.n];
      if (!notaValida(nota)) { return acumulado; }
      return { soma: acumulado.soma + nota, respondidas: acumulado.respondidas + 1 };
    }, { soma: 0, respondidas: 0 });
  }

  /**
   * Índice de opacidade: soma das notas das dimensões base dividida pelo máximo (10 x 3 = 30).
   * As dimensões do módulo de IA generativa formam um subíndice à parte (0 a 12).
   * `notas` é um mapa { numeroDaDimensao: nota }.
   */
  function calcularIndice(dimensoes, notas) {
    var base = dimensoes.filter(function (d) { return !d.modulo; });
    var modulo = dimensoes.filter(function (d) { return d.modulo; });
    var totalBase = somarNotas(base, notas);
    var totalModulo = somarNotas(modulo, notas);
    var maximoBase = base.length * NOTA_MAXIMA;
    return {
      base: totalBase.soma,
      baseMaximo: maximoBase,
      percentual: maximoBase ? Math.round(totalBase.soma / maximoBase * 100) : 0,
      respondidasBase: totalBase.respondidas,
      totalBase: base.length,
      completo: totalBase.respondidas === base.length,
      sub: totalModulo.soma,
      subMaximo: modulo.length * NOTA_MAXIMA,
      respondidasSub: totalModulo.respondidas,
      totalSub: modulo.length
    };
  }

  /** Média ponderada da rubrica (notas de 0 a 10) e o critério com maior lacuna ponderada. */
  function mediaPonderada(rubrica, notas) {
    var somaPesos = rubrica.reduce(function (a, criterio) { return a + criterio.peso; }, 0);
    var somaNotas = rubrica.reduce(function (a, criterio, i) { return a + (notas[i] || 0) * criterio.peso; }, 0);
    var maiorLacuna = 0;
    var maiorDiferenca = -1;
    rubrica.forEach(function (criterio, i) {
      var diferenca = (NOTA_RUBRICA_MAXIMA - (notas[i] || 0)) * criterio.peso;
      if (diferenca > maiorDiferenca) { maiorDiferenca = diferenca; maiorLacuna = i; }
    });
    return { media: somaPesos ? somaNotas / somaPesos : 0, maiorLacuna: maiorLacuna };
  }

  /** Normaliza texto para comparação: caixa, aspas, hifens, espaços e hifenização de fim de linha. */
  function normalizarTexto(texto) {
    return String(texto == null ? '' : texto)
      .normalize('NFKC')
      .replace(/­/g, '')
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″«»]/g, '"')
      .replace(/[‐-―]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function separarSegmentos(trecho) {
    return String(trecho)
      .split(/\[\s*(?:\.\.\.|…)\s*\]|\(\s*(?:\.\.\.|…)\s*\)/)
      .map(function (segmento) { return normalizarTexto(segmento).replace(/^["']+|["'.,;:]+$/g, '').replace(/^["']+|["']+$/g, '').trim(); })
      .filter(function (segmento) { return segmento.length >= TAMANHO_MINIMO_SEGMENTO; });
  }

  /**
   * Confere, por código, se o trecho literal está no texto-fonte.
   * true = conferido; false = NÃO CONFERIDO; null = nada a conferir (omisso ou descritivo).
   * Trechos com supressão "[...]" são conferidos segmento a segmento.
   */
  function conferirTrecho(trecho, textoFonte) {
    var bruto = String(trecho == null ? '' : trecho).trim();
    if (!bruto || /^["'“]?omisso["'”.]*$/i.test(bruto) || /^\[.*\]$/.test(bruto)) { return null; }
    var segmentos = separarSegmentos(bruto);
    if (!segmentos.length) { return null; }
    var fonte = normalizarTexto(textoFonte);
    if (!fonte) { return false; }
    return segmentos.every(function (segmento) { return fonte.indexOf(segmento) !== -1; });
  }

  var CHAVE_HEXADECIMAL = /^(0x)?[0-9a-f]{64}$/i;
  var CHAVE_WIF = /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/;
  var PALAVRA_DE_FRASE = /^[a-z]{3,8}$/;

  function temSequenciaDePalavras(valor) {
    var sequencia = 0;
    return String(valor).trim().split(/\s+/).some(function (palavra) {
      sequencia = PALAVRA_DE_FRASE.test(palavra) ? sequencia + 1 : 0;
      return sequencia >= PALAVRAS_MINIMAS_FRASE;
    });
  }

  /**
   * Detecta valor com formato de segredo de carteira.
   * Devolve 'frase' (12 ou mais palavras em sequência, como uma frase de recuperação),
   * 'chave' (64 hexadecimais ou formato WIF) ou null.
   * `permitirHash` deve ser true só no campo do código da transação, que tem o mesmo
   * formato de uma chave privada (64 hexadecimais) e por isso não pode ser distinguido.
   */
  function detectarSegredoDeCarteira(valor, permitirHash) {
    var texto = String(valor == null ? '' : valor).trim();
    if (!texto) { return null; }
    if (temSequenciaDePalavras(texto)) { return 'frase'; }
    if (CHAVE_WIF.test(texto)) { return 'chave'; }
    if (!permitirHash && CHAVE_HEXADECIMAL.test(texto)) { return 'chave'; }
    return null;
  }

  /** Neutraliza células que planilhas interpretariam como fórmula (injeção em CSV). */
  function celulaCsvSegura(valor) {
    var texto = String(valor == null ? '' : valor);
    return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
  }

  return {
    NOTA_MAXIMA: NOTA_MAXIMA,
    NOTA_RUBRICA_MAXIMA: NOTA_RUBRICA_MAXIMA,
    notaValida: notaValida,
    calcularIndice: calcularIndice,
    mediaPonderada: mediaPonderada,
    normalizarTexto: normalizarTexto,
    conferirTrecho: conferirTrecho,
    detectarSegredoDeCarteira: detectarSegredoDeCarteira,
    celulaCsvSegura: celulaCsvSegura
  };
});
