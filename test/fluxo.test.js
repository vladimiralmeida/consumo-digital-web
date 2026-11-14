'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../assets/data.js');
const { criarAmbiente } = require('./apoio');

const TEXTO_DOS_TERMOS = [
  'TERMOS DE USO DA LOJA TESTE (documento fictício)',
  '1. A Loja Teste atua exclusivamente como intermediadora e não é parte nas transações entre usuários.',
  '9. Podemos alterar estes termos a qualquer momento, e o uso continuado significa aceitação.'
].join('\n\n');
const TRECHO_EXISTENTE = 'Podemos alterar estes termos a qualquer momento';
const PAGINA_ARQUIVADA = `<html><body><p>${TEXTO_DOS_TERMOS.replace(/\n\n/g, '</p><p>')}</p><p>${'Cláusula de preenchimento. '.repeat(30)}</p></body></html>`;

/** Serviços externos simulados: a Wayback Machine e a IA, que dá nota 2 a tudo e inventa o trecho da dimensão 9. */
function servicosSimulados({ falhasDeRede = 0 } = {}) {
  const estado = { falhasRestantes: falhasDeRede, chamadasAoArquivo: 0, perguntas: [] };
  const fetchImpl = async (url, opcoes) => {
    const endereco = String(url);
    if (endereco.includes('archive.org')) {
      estado.chamadasAoArquivo += 1;
      if (estado.falhasRestantes > 0) {
        estado.falhasRestantes -= 1;
        throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
      }
      if (endereco.startsWith('https://archive.org/wayback/available')) {
        const proxima = { available: true, status: '200', timestamp: '20260310151411', url: 'http://web.archive.org/web/20260310151411/https://loja.teste/termos' };
        return new Response(JSON.stringify({ archived_snapshots: { closest: proxima } }), { headers: { 'content-type': 'application/json' } });
      }
      const pagina = new Response(PAGINA_ARQUIVADA, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      Object.defineProperty(pagina, 'url', { value: endereco });
      return pagina;
    }
    const pergunta = JSON.parse(opcoes.body).messages[1].content;
    estado.perguntas.push(pergunta);
    const inventa = pergunta.startsWith('Pergunta P4.1');
    const resposta = { trecho_literal: inventa ? 'Usamos inteligência artificial para decidir tudo' : TRECHO_EXISTENTE, resumo: 'Resumo.', nota: 2, por_que: 'Justificativa.' };
    return new Response(JSON.stringify({ model: 'deepseek-chat', choices: [{ message: { content: JSON.stringify(resposta) } }] }));
  };
  return { fetchImpl, estado };
}

test('fluxo completo: link dos termos, cópia arquivada, análise de opacidade das 14 dimensões e índice', async (t) => {
  const servicos = servicosSimulados();
  const ambiente = await criarAmbiente({ fetchImpl: servicos.fetchImpl, chaveIa: 'chave-de-teste' });
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const { dados: criado } = await aluna.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Loja Teste', tipo: 'market' });
  const caso = criado.caso.id;

  const arquivo = await aluna.post(`/api/casos/${caso}/arquivo`, { url: 'https://loja.teste/termos' });
  for (const dimensao of DATA.dims) {
    const { status } = await aluna.post(`/api/casos/${caso}/ia/${dimensao.n}`);
    assert.equal(status, 200, `dimensão ${dimensao.n}`);
  }
  const { dados: final } = await aluna.get(`/api/casos/${caso}`);

  assert.equal(arquivo.status, 200);
  assert.match(final.diagnostico.texto_fonte, /intermediadora/);
  assert.equal(final.respostas.length, 14);
  assert.ok(final.respostas.every((resposta) => resposta.nota === 2 && resposta.origem === 'ia'));
  /* Régua base: 10 dimensões x nota 2 = 20 de 30. O módulo de IA generativa fica à parte: 4 x 2 = 8 de 12. */
  assert.deepEqual(
    { base: final.indice.base, percentual: final.indice.percentual, completo: final.indice.completo, sub: final.indice.sub },
    { base: 20, percentual: 67, completo: true, sub: 8 }
  );
  /* Conferência por código: o trecho inventado (dimensão 9) é apontado; a dimensão descritiva (10) não tem o que conferir. */
  assert.deepEqual(final.respostas.filter((resposta) => resposta.conferido === false).map((resposta) => resposta.dimensao), [9]);
  assert.equal(final.respostas.find((resposta) => resposta.dimensao === 10).conferido, null);
  assert.equal(final.respostas.filter((resposta) => resposta.conferido === true).length, 12);
  /* Cada pergunta do protocolo foi enviada uma vez e registrada para o apêndice técnico. */
  assert.equal(final.consultas.length, 14);
  assert.deepEqual(final.consultas.map((consulta) => consulta.pergunta_id), DATA.dims.map((dimensao) => dimensao.pid));
  assert.ok(servicos.estado.perguntas.every((pergunta) => pergunta.includes('<DOCUMENTO>') && pergunta.includes('intermediadora')));
});

test('busca na Wayback Machine tenta de novo quando a conexão falha', async (t) => {
  await t.test('falha passageira é superada sem o usuário perceber', async () => {
    const servicos = servicosSimulados({ falhasDeRede: 2 });
    const ambiente = await criarAmbiente({ fetchImpl: servicos.fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const { dados } = await aluna.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Caso', tipo: 'market' });

    const { status } = await aluna.post(`/api/casos/${dados.caso.id}/arquivo`, { url: 'https://loja.teste/termos' });

    assert.equal(status, 200);
    assert.equal(servicos.estado.chamadasAoArquivo, 4);
  });

  await t.test('falha persistente desiste depois de três tentativas e responde 502', async () => {
    const servicos = servicosSimulados({ falhasDeRede: 99 });
    const ambiente = await criarAmbiente({ fetchImpl: servicos.fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const { dados } = await aluna.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Caso', tipo: 'market' });

    const { status, dados: erro } = await aluna.post(`/api/casos/${dados.caso.id}/arquivo`, { url: 'https://loja.teste/termos' });

    assert.equal(status, 502);
    assert.match(erro.erro, /Wayback Machine/);
    assert.equal(servicos.estado.chamadasAoArquivo, 3);
  });
});
