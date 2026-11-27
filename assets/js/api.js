/* Acesso à API do servidor: JSON, cookie de sessão e token CSRF. */

let tokenCsrf = '';

export function definirCsrf(token) { tokenCsrf = token || ''; }

export class ErroApi extends Error {
  constructor(status, mensagem, dados) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.dados = dados || {};
  }
}

const MENSAGEM_SEM_CONEXAO = 'Sem conexão com o servidor. Confira a internet e tente de novo.';

export async function api(metodo, caminho, corpo) {
  const alteraDados = metodo !== 'GET';
  let resposta;
  try {
    resposta = await fetch(`api${caminho}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: alteraDados ? { 'Content-Type': 'application/json', 'X-CSRF-Token': tokenCsrf } : {},
      body: alteraDados ? JSON.stringify(corpo || {}) : undefined
    });
  } catch {
    throw new ErroApi(0, MENSAGEM_SEM_CONEXAO);
  }
  const ehJson = (resposta.headers.get('content-type') || '').includes('application/json');
  const dados = ehJson ? await resposta.json() : null;
  if (!resposta.ok) {
    if (resposta.status === 401 && caminho !== '/auth/login' && caminho !== '/auth/me') {
      window.dispatchEvent(new CustomEvent('sessao-encerrada'));
    }
    throw new ErroApi(resposta.status, (dados && dados.erro) || 'O servidor não respondeu como esperado.', dados);
  }
  if (dados && dados.csrf) { definirCsrf(dados.csrf); }
  return dados;
}
