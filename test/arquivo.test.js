'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extrairTexto } = require('../server/arquivo');
const { criarAmbiente } = require('./apoio');

const PAGINA = `<!doctype html><html><head><title>Termos</title><style>p{color:red}</style></head><body>
<script>alert('x')</script><!-- comentário -->
<h1>Termos de Uso</h1>
<p>9. Altera&ccedil;&otilde;es. Podemos alterar estes termos a qualquer momento &amp; sem aviso.</p>
<ul><li>Item um</li><li>Item&nbsp;dois &#8220;citado&#8221;</li></ul>
<div>${'Cláusula de preenchimento do documento fictício. '.repeat(20)}</div></body></html>`;

function waybackSimulada({ disponivel = true, tipo = 'text/html; charset=utf-8', destino } = {}) {
  const chamadas = [];
  const fetchImpl = async (url) => {
    chamadas.push(String(url));
    if (String(url).startsWith('https://archive.org/wayback/available')) {
      const proxima = { available: true, status: '200', timestamp: '20260310151411', url: 'http://web.archive.org/web/20260310151411/https://loja.exemplo/termos' };
      return new Response(JSON.stringify({ archived_snapshots: disponivel ? { closest: proxima } : {} }), { headers: { 'content-type': 'application/json' } });
    }
    const resposta = new Response(PAGINA, { headers: { 'content-type': tipo } });
    Object.defineProperty(resposta, 'url', { value: destino || String(url) });
    return resposta;
  };
  return { fetchImpl, chamadas };
}

async function casoNovo(ambiente, cliente) {
  const { dados } = await cliente.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Caso', tipo: 'market' });
  return dados.caso;
}

test('extrairTexto tira scripts, estilos e marcação e decodifica entidades', () => {
  const texto = extrairTexto(PAGINA);

  assert.match(texto, /^Termos de Uso\n\n9\. Alterações\. Podemos alterar estes termos a qualquer momento & sem aviso\./);
  assert.match(texto, /- Item um\n\n- Item dois “citado”/);
  assert.equal(/alert|color:red|comentário|<|Termos<\/title>/.test(texto), false);
});

test('busca na Wayback Machine', async (t) => {
  await t.test('preenche link arquivado, data de acesso e texto-fonte, e reconfere as respostas', async () => {
    const wayback = waybackSimulada();
    const ambiente = await criarAmbiente({ fetchImpl: wayback.fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoNovo(ambiente, aluna);
    await aluna.put(`/api/casos/${caso.id}/respostas/6`, { nota: 3, trecho_literal: 'Podemos alterar estes termos a qualquer momento', resumo: '', por_que: '' });

    const { status, dados } = await aluna.post(`/api/casos/${caso.id}/arquivo`, { url: 'https://loja.exemplo/termos' });

    assert.equal(status, 200);
    assert.equal(dados.diagnostico.documento_url, 'https://loja.exemplo/termos');
    assert.equal(dados.diagnostico.link_arquivado, 'https://web.archive.org/web/20260310151411/https://loja.exemplo/termos');
    assert.equal(dados.diagnostico.data_acesso, new Date().toISOString().slice(0, 10));
    assert.equal(dados.data_da_captura, '2026-03-10');
    assert.match(dados.diagnostico.texto_fonte, /Alterações\. Podemos alterar/);
    assert.equal(dados.respostas[0].conferido, true);
    assert.equal(dados.texto_curto, false);
  });

  await t.test('o servidor só acessa archive.org e web.archive.org, nunca o endereço informado', async () => {
    const wayback = waybackSimulada();
    const ambiente = await criarAmbiente({ fetchImpl: wayback.fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoNovo(ambiente, aluna);

    await aluna.post(`/api/casos/${caso.id}/arquivo`, { url: 'http://169.254.169.254/latest/meta-data' });

    assert.equal(wayback.chamadas.length, 2);
    assert.ok(wayback.chamadas.every((url) => ['archive.org', 'web.archive.org'].includes(new URL(url).hostname)));
    assert.equal(wayback.chamadas[1], 'https://web.archive.org/web/20260310151411id_/https://loja.exemplo/termos');
  });

  await t.test('sem cópia arquivada responde 404 com orientação e não altera o diagnóstico', async () => {
    const ambiente = await criarAmbiente({ fetchImpl: waybackSimulada({ disponivel: false }).fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoNovo(ambiente, aluna);

    const { status, dados } = await aluna.post(`/api/casos/${caso.id}/arquivo`, { url: 'https://loja.exemplo/termos' });
    const lido = (await aluna.get(`/api/casos/${caso.id}`)).dados;

    assert.equal(status, 404);
    assert.equal(dados.codigo, 'sem_copia');
    assert.equal(lido.diagnostico.link_arquivado, '');
  });

  await t.test('redirecionamento para fora do arquivo e conteúdo que não é texto são recusados', async () => {
    const fora = await criarAmbiente({ fetchImpl: waybackSimulada({ destino: 'https://outro.exemplo/pagina' }).fetchImpl });
    const pdf = await criarAmbiente({ fetchImpl: waybackSimulada({ tipo: 'application/pdf' }).fetchImpl });
    t.after(fora.fechar);
    t.after(pdf.fechar);
    const alunaFora = await fora.clienteLogado('a@teste.br');
    const alunaPdf = await pdf.clienteLogado('a@teste.br');

    const respostaFora = await alunaFora.post(`/api/casos/${(await casoNovo(fora, alunaFora)).id}/arquivo`, { url: 'https://loja.exemplo/termos' });
    const respostaPdf = await alunaPdf.post(`/api/casos/${(await casoNovo(pdf, alunaPdf)).id}/arquivo`, { url: 'https://loja.exemplo/termos' });

    assert.equal(respostaFora.status, 502);
    assert.equal(respostaPdf.status, 502);
  });

  await t.test('link vazio ou que não é http(s) é recusado, e aluno de outro grupo não usa o caso alheio', async () => {
    const wayback = waybackSimulada();
    const ambiente = await criarAmbiente({ fetchImpl: wayback.fetchImpl });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const alunoB = await ambiente.clienteLogado('b@teste.br');
    const caso = await casoNovo(ambiente, aluna);

    assert.equal((await aluna.post(`/api/casos/${caso.id}/arquivo`, { url: '' })).status, 400);
    assert.equal((await aluna.post(`/api/casos/${caso.id}/arquivo`, { url: 'file:///etc/passwd' })).status, 400);
    assert.equal((await alunoB.post(`/api/casos/${caso.id}/arquivo`, { url: 'https://loja.exemplo/termos' })).status, 404);
    assert.equal(wayback.chamadas.length, 0);
  });
});
