'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../assets/data.js');
const { criarAmbiente } = require('./apoio');

const ANUNCIO = 'Legenda: "Emagreça 10 kg em 7 dias, resultado garantido! Só hoje por R$ 99, link na bio." Sem aviso de parceria. Publicação impulsionada no feed.';
const RESPOSTAS_DA_IA = [
  { item: 0, resposta: 'nao', justificativa: 'Não há aviso de publicidade.', trecho: 'Sem aviso de parceria' },
  { item: 1, resposta: 'nao', justificativa: 'Promete resultado garantido.', trecho: 'Emagreça 10 kg em 7 dias, resultado garantido!' },
  { item: 2, resposta: 'nao', justificativa: 'Não cita fonte.', trecho: '' },
  { item: 3, resposta: 'sim', justificativa: 'Informa o preço.', trecho: 'Só hoje por R$ 99' },
  { item: 4, resposta: 'sim', justificativa: 'Foi impulsionada.', trecho: 'Publicação impulsionada pelo anunciante' },
  { item: 5, resposta: 'indeterminado', justificativa: 'O texto não diz o público.', trecho: '' }
];

function iaSimulada(resposta = { pontos: RESPOSTAS_DA_IA }) {
  const chamadas = [];
  const fetchImpl = async (url, opcoes) => {
    chamadas.push(JSON.parse(opcoes.body));
    return new Response(JSON.stringify({ model: 'deepseek-chat', choices: [{ message: { content: JSON.stringify(resposta) } }] }));
  };
  return { fetchImpl, chamadas };
}

async function casoComAnuncio(ambiente, cliente, texto = ANUNCIO) {
  const { dados } = await cliente.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Caso', tipo: 'publicidade' });
  if (texto) { await cliente.patch(`/api/casos/${dados.caso.id}`, { anuncio_texto: texto }); }
  return dados.caso.id;
}

test('checklist de publicidade verificado pela IA', async (t) => {
  await t.test('grava os seis pontos com origem IA, confere cada trecho por código e registra a consulta', async () => {
    const ia = iaSimulada();
    const ambiente = await criarAmbiente({ fetchImpl: ia.fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoComAnuncio(ambiente, aluna);

    const { status, dados } = await aluna.post(`/api/casos/${caso}/anuncio/ia`);
    const pontos = dados.caso.anuncio_analise;

    assert.equal(status, 200);
    assert.equal(pontos.length, DATA.checkPub.length);
    assert.deepEqual(pontos.map((ponto) => ponto.resposta), ['nao', 'nao', 'nao', 'sim', 'sim', 'indeterminado']);
    assert.ok(pontos.every((ponto) => ponto.origem === 'ia'));
    /* Trecho existente é conferido; trecho que a IA alterou (ponto 4) é apontado; sem trecho não há o que conferir. */
    assert.deepEqual(pontos.map((ponto) => ponto.conferido), [true, true, null, true, false, null]);
    assert.equal(dados.consultas.length, 1);
    assert.equal(dados.consultas[0].pergunta_id, 'Publicidade');
    assert.match(ia.chamadas[0].messages[1].content, /<ANUNCIO>/);
    assert.match(ia.chamadas[0].messages[1].content, /Ponto 0 \(CDC, art\. 36\)/);
  });

  await t.test('sem texto do anúncio a verificação é recusada antes de chamar a IA', async () => {
    const ia = iaSimulada();
    const ambiente = await criarAmbiente({ fetchImpl: ia.fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoComAnuncio(ambiente, aluna, '');

    const { status } = await aluna.post(`/api/casos/${caso}/anuncio/ia`);

    assert.equal(status, 400);
    assert.equal(ia.chamadas.length, 0);
  });

  await t.test('respostas do grupo só são substituídas com confirmação', async () => {
    const ambiente = await criarAmbiente({ fetchImpl: iaSimulada().fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(ambiente.fechar);
    const aluna = await ambiente.clienteLogado('a@teste.br');
    const caso = await casoComAnuncio(ambiente, aluna);
    await aluna.patch(`/api/casos/${caso}`, { anuncio_analise: [{ item: 0, resposta: 'sim', justificativa: 'O grupo viu o aviso.', trecho: '', origem: 'grupo' }] });

    const semConfirmar = await aluna.post(`/api/casos/${caso}/anuncio/ia`);
    const confirmando = await aluna.post(`/api/casos/${caso}/anuncio/ia`, { substituir: true });

    assert.equal(semConfirmar.status, 409);
    assert.equal(semConfirmar.dados.codigo, 'resposta_do_grupo');
    assert.equal(confirmando.status, 200);
    assert.equal(confirmando.dados.caso.anuncio_analise[0].resposta, 'nao');
  });

  await t.test('resposta da IA com ponto faltando ou repetido não é gravada', async () => {
    const faltando = await criarAmbiente({ fetchImpl: iaSimulada({ pontos: RESPOSTAS_DA_IA.slice(0, 4) }).fetchImpl, chaveIa: 'chave-de-teste' });
    const repetido = await criarAmbiente({ fetchImpl: iaSimulada({ pontos: RESPOSTAS_DA_IA.map((ponto) => ({ ...ponto, item: 0 })) }).fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(faltando.fechar);
    t.after(repetido.fechar);
    const alunaA = await faltando.clienteLogado('a@teste.br');
    const alunaB = await repetido.clienteLogado('a@teste.br');
    const casoA = await casoComAnuncio(faltando, alunaA);
    const casoB = await casoComAnuncio(repetido, alunaB);

    assert.equal((await alunaA.post(`/api/casos/${casoA}/anuncio/ia`)).status, 502);
    assert.equal((await alunaB.post(`/api/casos/${casoB}/anuncio/ia`)).status, 502);
    assert.deepEqual((await alunaA.get(`/api/casos/${casoA}`)).dados.caso.anuncio_analise, []);
  });

  await t.test('sem chave a verificação responde 503, e aluno de outro grupo não verifica o caso alheio', async () => {
    const semChave = await criarAmbiente();
    const comChave = await criarAmbiente({ fetchImpl: iaSimulada().fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(semChave.fechar);
    t.after(comChave.fechar);
    const aluna = await semChave.clienteLogado('a@teste.br');
    const dona = await comChave.clienteLogado('a@teste.br');
    const alunoB = await comChave.clienteLogado('b@teste.br');

    assert.equal((await aluna.post(`/api/casos/${await casoComAnuncio(semChave, aluna)}/anuncio/ia`)).status, 503);
    assert.equal((await alunoB.post(`/api/casos/${await casoComAnuncio(comChave, dona)}/anuncio/ia`)).status, 404);
  });
});

test('checklist de publicidade preenchido pelo grupo', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');

  await t.test('resposta do grupo é salva e o trecho é reconferido quando o texto do anúncio muda', async () => {
    const caso = await casoComAnuncio(ambiente, aluna);
    const ponto = { item: 1, resposta: 'nao', justificativa: 'Promessa de resultado.', trecho: 'resultado garantido', origem: 'grupo' };

    const salvo = await aluna.patch(`/api/casos/${caso}`, { anuncio_analise: [ponto] });
    const textoTrocado = await aluna.patch(`/api/casos/${caso}`, { anuncio_texto: 'Outro anúncio, sem promessa.' });

    assert.equal(salvo.dados.caso.anuncio_analise[0].conferido, true);
    assert.equal(textoTrocado.dados.caso.anuncio_analise[0].conferido, false);
    assert.equal(textoTrocado.dados.caso.anuncio_analise[0].resposta, 'nao');
  });

  await t.test('resposta fora das opções, ponto inexistente e ponto repetido são recusados', async () => {
    const caso = await casoComAnuncio(ambiente, aluna);
    const base = { justificativa: '', trecho: '', origem: 'grupo' };

    assert.equal((await aluna.patch(`/api/casos/${caso}`, { anuncio_analise: [{ ...base, item: 0, resposta: 'talvez' }] })).status, 400);
    assert.equal((await aluna.patch(`/api/casos/${caso}`, { anuncio_analise: [{ ...base, item: 9, resposta: 'sim' }] })).status, 400);
    assert.equal((await aluna.patch(`/api/casos/${caso}`, { anuncio_analise: [{ ...base, item: 0, resposta: 'sim' }, { ...base, item: 0, resposta: 'nao' }] })).status, 400);
  });

  await t.test('caso antigo, só com itens marcados, aparece como resposta "sim" do grupo', async () => {
    const caso = await casoComAnuncio(ambiente, aluna, '');
    ambiente.db.prepare("UPDATE casos SET checklist_publicidade = '[0,4]' WHERE id = ?").run(caso);

    const { dados } = await aluna.get(`/api/casos/${caso}`);

    assert.deepEqual(dados.caso.anuncio_analise.map((ponto) => [ponto.item, ponto.resposta, ponto.origem]), [[0, 'sim', 'grupo'], [4, 'sim', 'grupo']]);
  });
});
