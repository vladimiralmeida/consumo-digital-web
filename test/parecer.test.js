'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAmbiente } = require('./apoio');

const TEXTO_LONGO = 'A plataforma se apresenta como intermediária e essa escolha de redação repercute na cadeia de fornecimento. '.repeat(4);

function iaSimulada(montarTexto = (pedido) => `${pedido.includes('"3. Diagnóstico') ? '3. Diagnóstico' : '4.1 Subseção sem título de seção'}\n\n${TEXTO_LONGO}`) {
  const chamadas = [];
  const fetchImpl = async (url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    chamadas.push(corpo);
    return new Response(JSON.stringify({ model: 'deepseek-chat', choices: [{ message: { content: JSON.stringify({ texto: montarTexto(corpo.messages[1].content) }) } }] }));
  };
  return { fetchImpl, chamadas };
}

/** Caso com o exemplo fictício: índice completo (70%) e um trecho NÃO CONFERIDO (dimensão 9). */
async function casoDeExemplo(ambiente, cliente, extras = {}) {
  const { dados } = await cliente.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Exemplo', tipo: 'market', exemplo: true });
  await cliente.put(`/api/casos/${dados.caso.id}/diagnostico`, { documento_url: 'https://exemplo.com/termos', link_arquivado: 'https://web.archive.org/web/2026/https://exemplo.com/termos', data_acesso: '2026-11-10', ...extras });
  return dados.caso.id;
}

test('abertura do parecer montada por código', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');

  await t.test('traz título, objeto e metodologia com os fatos do caso, sem depender de IA', async () => {
    const caso = await casoDeExemplo(ambiente, aluna);

    const { status, dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/abertura`);

    assert.equal(status, 200);
    assert.match(dados.texto, /^Parecer técnico: análise crítica dos termos de uso de Plataforma Exemplo \(fictícia\)/);
    assert.match(dados.texto, /1\. Objeto da análise\n\nEste documento analisa os termos de uso de Plataforma Exemplo \(fictícia\), na versão acessada em 10\/11\/2026, disponível em https:\/\/exemplo\.com\/termos e arquivada em https:\/\/web\.archive\.org/);
    assert.match(dados.texto, /2\. Metodologia/);
    assert.match(dados.texto, /dividida pelo máximo possível \(30\)/);
    assert.match(dados.texto, /sem consulta a ferramenta de IA nesta etapa/);
    /* Conferência do exemplo: 12 trechos localizados, 1 não localizado (dimensão 9) e 1 descritivo. */
    assert.match(dados.texto, /12 trechos foram localizados no texto-fonte, 1 não foi localizado e 1 resposta não tem transcrição/);
    assert.match(dados.texto, /O trecho não localizado depende de checagem no original e não fundamenta as conclusões deste documento/);
    assert.match(dados.texto, /as conclusões são do grupo\.$/);
  });

  await t.test('formato "recomendações à plataforma" muda o título', async () => {
    const caso = await casoDeExemplo(ambiente, aluna);
    await aluna.put(`/api/casos/${caso}/parecer`, { formato: 'plataforma' });

    const { dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/abertura`);

    assert.match(dados.texto, /^Recomendações a Plataforma Exemplo \(fictícia\)/);
  });

  await t.test('sem a análise de opacidade completa, a redação é recusada', async () => {
    const { dados: criado } = await aluna.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'Vazio', tipo: 'market' });

    const { status, dados } = await aluna.post(`/api/casos/${criado.caso.id}/parecer/ia/abertura`);

    assert.equal(status, 400);
    assert.match(dados.erro, /0 de 10 dimensões/);
  });

  await t.test('sem chave, as seções de IA respondem 503; seção inexistente responde 404', async () => {
    const caso = await casoDeExemplo(ambiente, aluna);

    assert.equal((await aluna.post(`/api/casos/${caso}/parecer/ia/analise`)).status, 503);
    assert.equal((await aluna.post(`/api/casos/${caso}/parecer/ia/inexistente`)).status, 404);
  });
});

test('seções do parecer redigidas pela IA', async (t) => {
  const ia = iaSimulada();
  const ambiente = await criarAmbiente({ fetchImpl: ia.fetchImpl, chaveIa: 'chave-de-teste' });
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const caso = await casoDeExemplo(ambiente, aluna);

  await t.test('a IA recebe só as respostas salvas, com a conferência e o parâmetro legal de cada dimensão', async () => {
    const { status, dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/diagnostico`);
    const pedido = ia.chamadas.at(-1).messages[1].content;
    const instrucoes = ia.chamadas.at(-1).messages[0].content;

    assert.equal(status, 200);
    assert.match(dados.texto, /^3\. Diagnóstico da opacidade\n\n/);
    assert.match(pedido, /Índice de opacidade: 70% \(21 de 30 pontos/);
    assert.match(pedido, /Dimensão 2: Natureza da relação \| Eixo A/);
    assert.match(pedido, /Trecho literal \(conferido no texto-fonte\): “A Plataforma atua exclusivamente como intermediadora/);
    assert.match(pedido, /Trecho literal \(NÃO CONFERIDO\): “Usamos sistemas de inteligência artificial/);
    assert.match(pedido, /Parâmetro legal: CDC, arts\. 2º, 3º, 7º, par\. único, 25, § 1º, e 51/);
    assert.equal(pedido.includes('TERMOS DE USO DA PLATAFORMA EXEMPLO'), false, 'o texto-fonte inteiro não é reenviado');
    assert.match(instrucoes, /Cite apenas os dispositivos legais que aparecem no "parâmetro legal"/);
    assert.match(instrucoes, /NÃO CONFERIDO não pode fundamentar conclusão/);
  });

  await t.test('seção sem o título pedido ganha o título, preservando a subseção', async () => {
    const { dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/analise`);

    assert.match(dados.texto, /^4\. Análise crítica à luz do Código de Defesa do Consumidor\n\n4\.1 Subseção sem título de seção\n\n/);
  });

  await t.test('cada seção redigida é registrada para o apêndice, e a rota não grava o texto do parecer', async () => {
    const { dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/conclusao`);
    const lido = (await aluna.get(`/api/casos/${caso}`)).dados;

    assert.deepEqual(dados.consultas.map((consulta) => consulta.pergunta_id), [
      'Parecer: 3. Diagnóstico da opacidade',
      'Parecer: 4. Análise crítica à luz do Código de Defesa do Consumidor',
      'Parecer: 5. Conclusão e encaminhamento'
    ]);
    assert.equal(lido.parecer.texto, '');
  });

  await t.test('com IA, a metodologia declara que as seções 3 a 5 são minuta sujeita à revisão do grupo', async () => {
    const { dados } = await aluna.post(`/api/casos/${caso}/parecer/ia/abertura`);

    assert.match(dados.texto, /minuta gerada por ferramenta de IA \(DeepSeek\)/);
    assert.match(dados.texto, /validação humana do grupo, que responde pelas conclusões\.$/);
  });

  await t.test('texto curto demais devolvido pela IA é recusado', async () => {
    const curta = await criarAmbiente({ fetchImpl: iaSimulada(() => 'Curto.').fetchImpl, chaveIa: 'chave-de-teste' });
    t.after(curta.fechar);
    const outra = await curta.clienteLogado('a@teste.br');

    const { status } = await outra.post(`/api/casos/${await casoDeExemplo(curta, outra)}/parecer/ia/diagnostico`);

    assert.equal(status, 502);
  });

  await t.test('aluno de outro grupo não redige o parecer do caso alheio', async () => {
    const alunoB = await ambiente.clienteLogado('b@teste.br');

    assert.equal((await alunoB.post(`/api/casos/${caso}/parecer/ia/abertura`)).status, 404);
  });
});
