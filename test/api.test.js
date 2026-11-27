'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarAmbiente, SENHA } = require('./apoio');

const TRANSACAO = {
  integrante: 'Aluna A',
  rede: 'Polygon Amoy (teste)',
  endereco_origem: '0x52908400098527886E0F7030069857D2E4169EE7',
  endereco_destino: '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  hash: `0x${'c'.repeat(64)}`,
  data_hora: '2026-11-13 19:30',
  link_explorador: 'https://amoy.polygonscan.com/tx/0xabc',
  obs: 'Valor irrelevante, enviado em sala.'
};

async function criarCaso(cliente, grupoId, extras = {}) {
  const { status, dados } = await cliente.post('/api/casos', { grupo_id: grupoId, titulo: 'Caso de teste', tipo: 'market', ...extras });
  assert.equal(status, 201);
  return dados;
}

test('autenticação', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);

  await t.test('rota protegida responde 401 sem sessão', async () => {
    const { status } = await ambiente.novoCliente().get('/api/grupos');
    assert.equal(status, 401);
  });

  await t.test('senha errada e e-mail inexistente dão a mesma resposta', async () => {
    const cliente = ambiente.novoCliente();
    const senhaErrada = await cliente.entrar('a@teste.br', 'senha-incorreta-999');
    const emailInexistente = await cliente.entrar('ninguem@teste.br', SENHA);

    assert.equal(senhaErrada.status, 401);
    assert.equal(emailInexistente.status, 401);
    assert.equal(senhaErrada.dados.erro, emailInexistente.dados.erro);
  });

  await t.test('login cria cookie HttpOnly e SameSite=Strict e não devolve o hash da senha', async () => {
    const { status, dados, cabecalhos } = await ambiente.novoCliente().entrar('a@teste.br');

    assert.equal(status, 200);
    assert.match(cabecalhos.get('set-cookie'), /HttpOnly/);
    assert.match(cabecalhos.get('set-cookie'), /SameSite=Strict/);
    assert.equal(dados.usuario.papel, 'aluno');
    assert.equal(JSON.stringify(dados).includes('scrypt'), false);
  });

  await t.test('alteração sem token CSRF é recusada', async () => {
    const cliente = await ambiente.clienteLogado('a@teste.br');
    cliente.esquecerCsrf();

    const { status } = await cliente.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'x', tipo: 'market' });

    assert.equal(status, 403);
  });

  await t.test('alteração que não é JSON é recusada', async () => {
    const cliente = await ambiente.clienteLogado('a@teste.br');
    const resposta = await fetch(`${ambiente.urlBase}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });

    assert.equal(resposta.status, 415);
    assert.equal((await cliente.get('/api/auth/me')).status, 200);
  });

  await t.test('sair encerra a sessão', async () => {
    const cliente = await ambiente.clienteLogado('a@teste.br');

    await cliente.post('/api/auth/logout');

    assert.equal((await cliente.get('/api/auth/me')).status, 401);
  });

  await t.test('respostas trazem cabeçalhos de segurança e a API não é guardada em cache', async () => {
    const { cabecalhos } = await ambiente.novoCliente().get('/api/auth/me');

    assert.match(cabecalhos.get('content-security-policy'), /default-src 'self'/);
    assert.equal(cabecalhos.get('x-content-type-options'), 'nosniff');
    assert.equal(cabecalhos.get('x-frame-options'), 'DENY');
    assert.equal(cabecalhos.get('cache-control'), 'no-store');
  });

  await t.test('arquivos do servidor e o .env nunca são servidos', async () => {
    const cliente = ambiente.novoCliente();

    assert.equal((await cliente.get('/server/index.js')).status, 404);
    assert.equal((await cliente.get('/.env')).status, 404);
    assert.equal((await cliente.get('/assets/../package.json')).status, 404);
    assert.equal((await cliente.get('/assets/dominio.js')).status, 200);
  });
});

test('limite de tentativas de login', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const cliente = ambiente.novoCliente();

  const tentativas = [];
  for (let i = 0; i < 11; i += 1) { tentativas.push((await cliente.entrar('a@teste.br', 'senha-incorreta-999')).status); }

  assert.deepEqual(tentativas.slice(0, 10), Array(10).fill(401));
  assert.equal(tentativas[10], 429);
});

test('contas e senha inicial', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const admin = await ambiente.clienteLogado('admin@teste.br');
  const professora = await ambiente.clienteLogado('prof@teste.br');

  await t.test('aluno não cria conta nem lista contas', async () => {
    const aluna = await ambiente.clienteLogado('a@teste.br');

    assert.equal((await aluna.get('/api/usuarios')).status, 403);
    assert.equal((await aluna.post('/api/usuarios', { nome: 'X', email: 'x@teste.br', papel: 'aluno', grupo_id: ambiente.grupoA })).status, 403);
  });

  await t.test('professora cria aluno, mas não cria administrador', async () => {
    const aluno = await professora.post('/api/usuarios', { nome: 'Novo Aluno', email: 'novo@teste.br', papel: 'aluno', grupo_id: ambiente.grupoA });
    const administrador = await professora.post('/api/usuarios', { nome: 'Outro', email: 'outro@teste.br', papel: 'admin' });

    assert.equal(aluno.status, 201);
    assert.equal(aluno.dados.senha_inicial.length, 14);
    assert.equal(administrador.status, 403);
  });

  await t.test('conta nova precisa trocar a senha inicial antes de usar o sistema', async () => {
    const criada = await admin.post('/api/usuarios', { nome: 'Calouro', email: 'calouro@teste.br', papel: 'aluno', grupo_id: ambiente.grupoB });
    const calouro = ambiente.novoCliente();
    await calouro.entrar('calouro@teste.br', criada.dados.senha_inicial);

    const antes = await calouro.get('/api/grupos');
    const troca = await calouro.post('/api/auth/senha', { atual: criada.dados.senha_inicial, nova: 'uma-senha-nova-456' });
    const depois = await calouro.get('/api/grupos');

    assert.equal(antes.status, 403);
    assert.equal(antes.dados.codigo, 'trocar_senha');
    assert.equal(troca.status, 200);
    assert.equal(depois.status, 200);
    assert.deepEqual(depois.dados.grupos.map((g) => g.id), [ambiente.grupoB]);
  });

  await t.test('senha nova curta é recusada', async () => {
    const aluno = await ambiente.clienteLogado('b@teste.br');

    const { status } = await aluno.post('/api/auth/senha', { atual: SENHA, nova: 'curta' });

    assert.equal(status, 400);
  });

  await t.test('e-mail repetido é recusado', async () => {
    const { status } = await admin.post('/api/usuarios', { nome: 'Repetido', email: 'A@teste.br', papel: 'aluno', grupo_id: ambiente.grupoA });
    assert.equal(status, 409);
  });

  await t.test('aluno sem grupo é recusado', async () => {
    const { status } = await admin.post('/api/usuarios', { nome: 'Sem Grupo', email: 'sg@teste.br', papel: 'aluno' });
    assert.equal(status, 400);
  });

  await t.test('desativar a conta derruba a sessão e impede novo login', async () => {
    const aluno = await ambiente.clienteLogado('b@teste.br');
    const { dados } = await admin.get('/api/usuarios');
    const alvo = dados.usuarios.find((u) => u.email === 'b@teste.br');

    const desativacao = await admin.patch(`/api/usuarios/${alvo.id}`, { ativo: false });

    assert.equal(desativacao.status, 200);
    assert.equal((await aluno.get('/api/auth/me')).status, 401);
    assert.equal((await ambiente.novoCliente().entrar('b@teste.br')).status, 401);
  });

  await t.test('o único administrador não pode se desativar nem se rebaixar', async () => {
    const { dados } = await admin.get('/api/usuarios');
    const proprio = dados.usuarios.find((u) => u.email === 'admin@teste.br');

    assert.equal((await admin.patch(`/api/usuarios/${proprio.id}`, { ativo: false })).status, 400);
    assert.equal((await admin.patch(`/api/usuarios/${proprio.id}`, { papel: 'professor' })).status, 400);
  });

  await t.test('professora não redefine a senha do administrador', async () => {
    const { dados } = await professora.get('/api/usuarios');
    const alvo = dados.usuarios.find((u) => u.email === 'admin@teste.br');

    assert.equal((await professora.patch(`/api/usuarios/${alvo.id}`, { redefinir_senha: true })).status, 403);
  });

  await t.test('grupo com nome repetido é recusado', async () => {
    assert.equal((await professora.post('/api/grupos', { nome: 'grupo a' })).status, 409);
    assert.equal((await professora.post('/api/grupos', { nome: 'Grupo C', turma: '2026.2' })).status, 201);
  });
});

test('isolamento entre grupos', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const alunaA = await ambiente.clienteLogado('a@teste.br');
  const alunoB = await ambiente.clienteLogado('b@teste.br');
  const professora = await ambiente.clienteLogado('prof@teste.br');
  const { caso } = await criarCaso(alunaA, ambiente.grupoA);

  await t.test('aluno de outro grupo não lê, não altera e não apaga o caso', async () => {
    assert.equal((await alunoB.get(`/api/casos/${caso.id}`)).status, 404);
    assert.equal((await alunoB.patch(`/api/casos/${caso.id}`, { titulo: 'invadido' })).status, 404);
    assert.equal((await alunoB.put(`/api/casos/${caso.id}/parecer`, { texto: 'x' })).status, 404);
    assert.equal((await alunoB.del(`/api/casos/${caso.id}`)).status, 404);
    assert.equal((await alunoB.get(`/api/casos?grupo_id=${ambiente.grupoA}`)).status, 404);
    assert.equal((await alunoB.get(`/api/grupos/${ambiente.grupoA}/dados`)).status, 404);
  });

  await t.test('aluno não cria caso em grupo alheio', async () => {
    const { status } = await alunoB.post('/api/casos', { grupo_id: ambiente.grupoA, titulo: 'x', tipo: 'market' });
    assert.equal(status, 404);
  });

  await t.test('professora enxerga os casos de qualquer grupo', async () => {
    const { status, dados } = await professora.get(`/api/casos?grupo_id=${ambiente.grupoA}`);

    assert.equal(status, 200);
    assert.equal(dados.casos.length, 1);
  });

  await t.test('aluno lista só o próprio grupo', async () => {
    const { dados } = await alunoB.get('/api/grupos');
    assert.deepEqual(dados.grupos.map((g) => g.id), [ambiente.grupoB]);
  });

  await t.test('transação de outro grupo não é alterada nem apagada', async () => {
    const criada = await alunaA.post(`/api/grupos/${ambiente.grupoA}/transacoes`, TRANSACAO);

    assert.equal(criada.status, 201);
    assert.equal((await alunoB.put(`/api/transacoes/${criada.dados.transacao.id}`, TRANSACAO)).status, 404);
    assert.equal((await alunoB.del(`/api/transacoes/${criada.dados.transacao.id}`)).status, 404);
  });
});

test('caso, diagnóstico e conferência', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');

  await t.test('caso com exemplo fictício reproduz índice de 70% e um trecho NÃO CONFERIDO', async () => {
    const { caso, indice, respostas } = await criarCaso(aluna, ambiente.grupoA, { exemplo: true });

    assert.equal(indice.percentual, 70);
    assert.equal(indice.sub, 7);
    assert.equal(respostas.length, 14);
    assert.deepEqual(respostas.filter((r) => r.conferido === false).map((r) => r.dimensao), [9]);
    assert.equal(respostas.find((r) => r.dimensao === 10).conferido, null);
    assert.ok(caso.id);
  });

  await t.test('dados persistem: o que foi salvo volta em nova leitura', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);

    await aluna.patch(`/api/casos/${caso.id}`, { tipo: 'cobranca', provas: [3, 0, 3], checklist_publicidade: [1] });
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { plataforma: 'Loja X', documento_url: 'https://exemplo.com/termos', data_acesso: '2026-11-10' });
    const lido = (await aluna.get(`/api/casos/${caso.id}`)).dados;

    assert.equal(lido.caso.tipo, 'cobranca');
    assert.deepEqual(lido.caso.provas, [0, 3]);
    assert.deepEqual(lido.caso.checklist_publicidade, [1]);
    assert.equal(lido.diagnostico.plataforma, 'Loja X');
    assert.equal(lido.diagnostico.data_acesso, '2026-11-10');
  });

  await t.test('resposta é conferida por código e reconferida quando o texto-fonte muda', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    const resposta = { nota: 3, trecho_literal: '“Podemos alterar estes termos a qualquer momento.”', resumo: 'Muda sem aviso.', por_que: 'Sem prazo.' };

    const semFonte = await aluna.put(`/api/casos/${caso.id}/respostas/6`, resposta);
    const comFonte = await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: 'Cláusula 9. Podemos alterar estes termos a qualquer momento.' });
    const fonteTrocada = await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: 'Outro documento.' });

    assert.equal(semFonte.dados.respostas[0].conferido, false);
    assert.equal(semFonte.dados.respostas[0].origem, 'grupo');
    assert.equal(semFonte.dados.indice.base, 3);
    assert.equal(comFonte.dados.respostas[0].conferido, true);
    assert.equal(fonteTrocada.dados.respostas[0].conferido, false);
  });

  await t.test('nota fora da régua e dimensão inexistente são recusadas', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    const base = { trecho_literal: '', resumo: '', por_que: '' };

    assert.equal((await aluna.put(`/api/casos/${caso.id}/respostas/1`, { ...base, nota: 4 })).status, 400);
    assert.equal((await aluna.put(`/api/casos/${caso.id}/respostas/99`, { ...base, nota: 1 })).status, 404);
  });

  await t.test('link que não é http(s) é recusado', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);

    const { status } = await aluna.put(`/api/casos/${caso.id}/diagnostico`, { documento_url: 'javascript:alert(1)' });

    assert.equal(status, 400);
  });

  await t.test('campo desconhecido e tipo inválido são recusados', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);

    assert.equal((await aluna.patch(`/api/casos/${caso.id}`, { grupo_id: ambiente.grupoB })).status, 400);
    assert.equal((await aluna.patch(`/api/casos/${caso.id}`, { tipo: 'inexistente' })).status, 400);
    assert.equal((await aluna.patch(`/api/casos/${caso.id}`, { provas: [99] })).status, 400);
  });

  await t.test('apagar o caso remove diagnóstico, respostas e parecer', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA, { exemplo: true });

    const { status } = await aluna.del(`/api/casos/${caso.id}`);

    assert.equal(status, 204);
    assert.equal((await aluna.get(`/api/casos/${caso.id}`)).status, 404);
    assert.equal(ambiente.db.prepare('SELECT COUNT(*) AS total FROM respostas WHERE caso_id = ?').get(caso.id).total, 0);
  });
});

test('parecer: validação humana e declaração de uso de IA', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const professora = await ambiente.clienteLogado('prof@teste.br');
  const admin = await ambiente.clienteLogado('admin@teste.br');
  const { caso } = await criarCaso(aluna, ambiente.grupoA);

  await t.test('professora e administrador não marcam pelo grupo', async () => {
    assert.equal((await professora.put(`/api/casos/${caso.id}/parecer`, { validado_humano: true })).status, 403);
    assert.equal((await admin.put(`/api/casos/${caso.id}/parecer`, { declaracao_ia: true })).status, 403);
  });

  await t.test('integrante do grupo marca, e o registro guarda a data', async () => {
    const { status, dados } = await aluna.put(`/api/casos/${caso.id}/parecer`, { validado_humano: true, declaracao_ia: true });

    assert.equal(status, 200);
    assert.equal(dados.parecer.validado_humano, true);
    assert.equal(dados.parecer.declaracao_ia, true);
    assert.ok(dados.parecer.validado_em);
  });

  await t.test('professora edita texto e notas sem mexer na validação já feita', async () => {
    const { status, dados } = await professora.put(`/api/casos/${caso.id}/parecer`, { texto: 'Comentário.', notas: [7, 8, 8, 7, 8], validado_humano: true });

    assert.equal(status, 200);
    assert.equal(dados.parecer.texto, 'Comentário.');
    assert.deepEqual(dados.parecer.notas, [7, 8, 8, 7, 8]);
    assert.equal(dados.parecer.validado_humano, true);
  });

  await t.test('professora não desmarca a validação do grupo', async () => {
    assert.equal((await professora.put(`/api/casos/${caso.id}/parecer`, { validado_humano: false })).status, 403);
  });

  await t.test('notas fora de 0 a 10 ou em quantidade errada são recusadas', async () => {
    assert.equal((await aluna.put(`/api/casos/${caso.id}/parecer`, { notas: [11, 8, 8, 7, 8] })).status, 400);
    assert.equal((await aluna.put(`/api/casos/${caso.id}/parecer`, { notas: [7, 8] })).status, 400);
  });
});

test('dados do grupo: comparação, anotações e transações', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const celula = (nota, texto) => ({ nota, texto });
  const provedor = (nome) => ({ nome, celulas: { tit: celula(1, 'a'), com: celula(0, 'b'), trn: celula(2, 'c'), res: celula(3, 'd') } });

  await t.test('comparação salva volta na mesma ordem', async () => {
    const corpo = { divergencia_destacada: 'Um permite recusar o treinamento.', provedores: [provedor('Provedor Z'), provedor('Provedor A')] };

    const salvo = await aluna.put(`/api/grupos/${ambiente.grupoA}/comparacao`, corpo);
    const lido = (await aluna.get(`/api/grupos/${ambiente.grupoA}/dados`)).dados;

    assert.equal(salvo.status, 200);
    assert.deepEqual(lido.comparacao.provedores.map((p) => p.nome), ['Provedor Z', 'Provedor A']);
    assert.deepEqual(lido.comparacao.provedores[0].celulas.res, { nota: 3, texto: 'd' });
    assert.equal(lido.comparacao.divergencia_destacada, corpo.divergencia_destacada);
  });

  await t.test('comparação com célula faltando ou provedores demais é recusada', async () => {
    const incompleto = { nome: 'X', celulas: { tit: celula(1, 'a') } };

    assert.equal((await aluna.put(`/api/grupos/${ambiente.grupoA}/comparacao`, { divergencia_destacada: '', provedores: [incompleto] })).status, 400);
    assert.equal((await aluna.put(`/api/grupos/${ambiente.grupoA}/comparacao`, { divergencia_destacada: '', provedores: Array(7).fill(provedor('P')) })).status, 400);
  });

  await t.test('anotações do grupo são salvas sem apagar a lista que não veio', async () => {
    await aluna.put(`/api/grupos/${ambiente.grupoA}/anotacoes`, { higiene: [0, 2] });
    const { dados } = await aluna.put(`/api/grupos/${ambiente.grupoA}/anotacoes`, { passos_ativos: [1] });

    assert.deepEqual(dados.anotacoes, { higiene: [0, 2], passos_ativos: [1] });
  });

  await t.test('transação com endereço público e hash é aceita, alterada e apagada', async () => {
    const criada = await aluna.post(`/api/grupos/${ambiente.grupoA}/transacoes`, TRANSACAO);
    const alterada = await aluna.put(`/api/transacoes/${criada.dados.transacao.id}`, { ...TRANSACAO, obs: 'Conferida.' });
    const apagada = await aluna.del(`/api/transacoes/${criada.dados.transacao.id}`);

    assert.equal(criada.status, 201);
    assert.equal(alterada.dados.transacao.obs, 'Conferida.');
    assert.equal(apagada.status, 204);
  });

  await t.test('frase de recuperação é rejeitada em qualquer campo e não é gravada', async () => {
    const frase = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

    const { status, dados } = await aluna.post(`/api/grupos/${ambiente.grupoA}/transacoes`, { ...TRANSACAO, obs: frase });

    assert.equal(status, 400);
    assert.equal(dados.campos[0].campo, 'obs');
    assert.equal(ambiente.db.prepare("SELECT COUNT(*) AS total FROM transacoes WHERE obs LIKE '%sausage%'").get().total, 0);
  });

  await t.test('chave privada no lugar do endereço é rejeitada', async () => {
    const { status, dados } = await aluna.post(`/api/grupos/${ambiente.grupoA}/transacoes`, { ...TRANSACAO, endereco_origem: 'd'.repeat(64) });

    assert.equal(status, 400);
    assert.equal(dados.campos[0].campo, 'endereco_origem');
  });
});

test('diagnóstico com IA', async (t) => {
  const chamadas = [];
  let respostaDaIa = { trecho_literal: 'Podemos alterar estes termos a qualquer momento', resumo: 'Muda sem aviso.', nota: 3, por_que: 'Sem prazo nem aviso.' };
  let statusDaIa = 200;
  const iaSimulada = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return new Response(JSON.stringify({ model: 'deepseek-chat', choices: [{ message: { content: JSON.stringify(respostaDaIa) } }] }), { status: statusDaIa });
  };
  const ambiente = await criarAmbiente({ fetchImpl: iaSimulada, chaveIa: 'chave-de-teste' });
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const textoFonte = 'Cláusula 9. Podemos alterar estes termos a qualquer momento, e o uso continuado significa aceitação.';

  await t.test('sem texto do documento a consulta é recusada antes de chamar a IA', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);

    const { status } = await aluna.post(`/api/casos/${caso.id}/ia/6`);

    assert.equal(status, 400);
    assert.equal(chamadas.length, 0);
  });

  await t.test('sugestão é gravada com origem IA, conferida por código e registrada no histórico', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: textoFonte });

    const { status, dados } = await aluna.post(`/api/casos/${caso.id}/ia/6`);
    const enviada = chamadas.at(-1);

    assert.equal(status, 200);
    assert.deepEqual({ ...dados.respostas[0], atualizado_em: undefined }, {
      dimensao: 6, pergunta_id: 'P3.1', nota: 3, trecho_literal: respostaDaIa.trecho_literal, conferido: true,
      resumo: 'Muda sem aviso.', por_que: 'Sem prazo nem aviso.', origem: 'ia', atualizado_em: undefined
    });
    assert.equal(dados.consultas.length, 1);
    assert.equal(dados.consultas[0].ferramenta, 'DeepSeek');
    assert.match(dados.consultas[0].prompt, /Pergunta P3\.1/);
    assert.equal(enviada.url, 'https://api.deepseek.com/chat/completions');
    assert.equal(enviada.opcoes.headers.Authorization, 'Bearer chave-de-teste');
    assert.match(JSON.parse(enviada.opcoes.body).messages[1].content, /<DOCUMENTO>/);
  });

  await t.test('trecho inventado pela IA fica como NÃO CONFERIDO', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: textoFonte });
    respostaDaIa = { ...respostaDaIa, trecho_literal: 'A empresa avisará com trinta dias de antecedência' };

    const { dados } = await aluna.post(`/api/casos/${caso.id}/ia/6`);

    assert.equal(dados.respostas[0].conferido, false);
  });

  await t.test('resposta do grupo só é substituída com confirmação', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: textoFonte });
    await aluna.put(`/api/casos/${caso.id}/respostas/6`, { nota: 1, trecho_literal: '', resumo: 'Do grupo.', por_que: '' });

    const semConfirmar = await aluna.post(`/api/casos/${caso.id}/ia/6`);
    const confirmando = await aluna.post(`/api/casos/${caso.id}/ia/6`, { substituir: true });

    assert.equal(semConfirmar.status, 409);
    assert.equal(semConfirmar.dados.codigo, 'resposta_do_grupo');
    assert.equal(confirmando.status, 200);
    assert.equal(confirmando.dados.respostas[0].origem, 'ia');
  });

  await t.test('resposta da IA fora do formato não é gravada', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: textoFonte });
    respostaDaIa = { nota: 9 };

    const { status } = await aluna.post(`/api/casos/${caso.id}/ia/6`);
    const lido = (await aluna.get(`/api/casos/${caso.id}`)).dados;

    assert.equal(status, 502);
    assert.equal(lido.respostas.length, 0);
    assert.equal(lido.consultas.length, 0);
  });

  await t.test('falha do serviço de IA vira erro 502 sem expor a chave', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    await aluna.put(`/api/casos/${caso.id}/diagnostico`, { texto_fonte: textoFonte });
    statusDaIa = 401;

    const { status, dados } = await aluna.post(`/api/casos/${caso.id}/ia/6`);

    assert.equal(status, 502);
    assert.equal(JSON.stringify(dados).includes('chave-de-teste'), false);
  });

  await t.test('aluno de outro grupo não consulta a IA no caso alheio', async () => {
    const { caso } = await criarCaso(aluna, ambiente.grupoA);
    const alunoB = await ambiente.clienteLogado('b@teste.br');

    assert.equal((await alunoB.post(`/api/casos/${caso.id}/ia/6`)).status, 404);
  });
});

test('IA desativada quando não há chave', async (t) => {
  const ambiente = await criarAmbiente();
  t.after(ambiente.fechar);
  const aluna = await ambiente.clienteLogado('a@teste.br');
  const { caso } = await criarCaso(aluna, ambiente.grupoA);

  const { status } = await aluna.post(`/api/casos/${caso.id}/ia/1`);
  const eu = await aluna.get('/api/auth/me');

  assert.equal(status, 503);
  assert.equal(eu.dados.ia.disponivel, false);
});
