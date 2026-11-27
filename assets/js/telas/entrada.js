/* Telas fora do aplicativo: entrada, troca obrigatória da senha inicial e aviso de servidor ausente. */
import { entrar, trocarSenha } from '../dados.js';
import { estado } from '../estado.js';
import { html, atributo } from '../html.js';

const SENHA_MINIMA = 10;

const ICONE = html`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>`;

const moldura = (titulo, texto, conteudo) => html`
  <main class="entrada" id="app" tabindex="-1">
    <div class="entrada-caixa">
      <div class="entrada-topo"><span class="marca-icone">${ICONE}</span><h1>${titulo}</h1><p>${texto}</p></div>
      ${conteudo}
    </div>
  </main>`;

const falha = () => (estado.falhaDeEntrada ? html`<p class="aviso erro" role="alert">${estado.falhaDeEntrada}</p>` : '');

function telaDeEntrada() {
  return moldura('Consumo Digital', 'Triagem, termos de uso e agentes de IA', html`
    <form class="cartao" data-f="en-entrar" novalidate>
      ${falha()}
      <div class="campo"><label for="en-email">E-mail</label><input id="en-email" name="email" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="en-senha">Senha</label><input id="en-senha" name="senha" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="botao primario largo">Entrar</button>
    </form>
    <p class="entrada-nota">Não há cadastro aberto: a conta é criada pelo professor. Protótipo acadêmico da disciplina Relações de Consumo e Novas Tecnologias (PPGDI-UNICAP).</p>`);
}

/** Formulário de troca de senha, usado na troca obrigatória e na tela "Minha conta". */
export function formularioDeSenha({ obrigatoria }) {
  return html`
    <form class="cartao" data-f="en-senha" novalidate>
      ${obrigatoria ? falha() : ''}
      <div class="campo"><label for="ts-atual">${obrigatoria ? 'Senha inicial' : 'Senha atual'}</label><input id="ts-atual" name="atual" type="password" autocomplete="current-password" required></div>
      <div class="campo">
        <label for="ts-nova">Senha nova</label>
        <input id="ts-nova" name="nova" type="password" autocomplete="new-password" minlength="${SENHA_MINIMA}" required aria-describedby="ts-nova-dica">
        <span class="dica" id="ts-nova-dica">Pelo menos ${SENHA_MINIMA} caracteres. Uma frase longa é melhor que símbolos difíceis.</span>
      </div>
      <div class="campo"><label for="ts-repetir">Repita a senha nova</label><input id="ts-repetir" name="repetir" type="password" autocomplete="new-password" required></div>
      <button type="submit" class="botao primario${atributo(obrigatoria, 'largo')}">Salvar senha nova</button>
    </form>`;
}

const telaDeSenha = () => moldura('Crie sua senha', `Olá, ${estado.usuario.nome}. Antes de continuar, troque a senha inicial por uma que só você conheça.`, formularioDeSenha({ obrigatoria: true }));

const telaSemServidor = () => moldura('Servidor não encontrado', 'Esta versão do Consumo Digital salva os dados de cada grupo e, por isso, precisa do servidor da aplicação.', html`
  <div class="cartao">
    <p class="apoio">Se você abriu o arquivo direto do computador ou pelo GitHub Pages, use o endereço da aplicação publicada ou rode o servidor local com <strong>npm start</strong>. As instruções estão no README do repositório.</p>
    <button type="button" class="botao primario largo" data-a="en-recarregar">Tentar de novo</button>
  </div>`);

const telaCarregando = () => html`<main class="entrada" id="app" tabindex="-1"><p class="apoio" role="status">Carregando…</p></main>`;

export function renderizarEntrada() {
  if (estado.fase === 'entrada') { return telaDeEntrada(); }
  if (estado.fase === 'senha') { return telaDeSenha(); }
  if (estado.fase === 'sem-servidor') { return telaSemServidor(); }
  return telaCarregando();
}

/** Valida e envia a troca de senha. Devolve a mensagem de falha, ou '' se deu certo. */
export async function enviarTrocaDeSenha(dados) {
  const atual = String(dados.get('atual') || '');
  const nova = String(dados.get('nova') || '');
  if (nova.length < SENHA_MINIMA) { return `A senha nova precisa ter pelo menos ${SENHA_MINIMA} caracteres.`; }
  if (nova !== String(dados.get('repetir') || '')) { return 'As duas senhas novas não são iguais.'; }
  try {
    await trocarSenha(atual, nova);
    return '';
  } catch (erro) {
    return erro.message;
  }
}

export const formulariosDeEntrada = {
  'en-entrar': async (dados) => {
    try {
      estado.falhaDeEntrada = '';
      await entrar(String(dados.get('email') || ''), String(dados.get('senha') || ''));
    } catch (erro) {
      estado.falhaDeEntrada = erro.message;
    }
  },
  'en-senha': async (dados) => {
    const mensagem = await enviarTrocaDeSenha(dados);
    if (estado.fase === 'senha') { estado.falhaDeEntrada = mensagem; } else { estado.visao.conta = { falha: mensagem, ok: !mensagem }; }
  }
};
