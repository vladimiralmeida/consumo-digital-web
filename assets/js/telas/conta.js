/* Minha conta: dados de acesso e troca de senha. */
import { estado, grupoAtual } from '../estado.js';
import { html } from '../html.js';
import { cabecalho } from '../ui.js';
import { formularioDeSenha } from './entrada.js';

const PAPEIS = { aluno: 'Aluno', professor: 'Professor', admin: 'Administrador' };

function render() {
  const { usuario } = estado;
  const { falha, ok } = estado.visao.conta;
  return html`
    ${cabecalho('Minha conta', 'Seus dados de acesso. Para corrigir nome, e-mail ou grupo, fale com o professor.')}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <h2>Acesso</h2>
          <ul class="lista">
            <li class="item"><span class="rotulo">Nome</span><span>${usuario.nome}</span></li>
            <li class="item"><span class="rotulo">E-mail</span><span>${usuario.email}</span></li>
            <li class="item"><span class="rotulo">Papel</span><span>${PAPEIS[usuario.papel]}</span></li>
            ${usuario.papel === 'aluno' ? html`<li class="item"><span class="rotulo">Grupo</span><span>${grupoAtual() ? grupoAtual().nome : '–'}</span></li>` : ''}
          </ul>
        </section>
      </div>
      <aside class="coluna">
        <div class="pilha">
          <h2>Trocar a senha</h2>
          ${falha ? html`<p class="aviso erro" role="alert">${falha}</p>` : ''}
          ${ok ? html`<p class="aviso info" role="status"><strong>Senha trocada.</strong> As outras sessões desta conta foram encerradas.</p>` : ''}
          ${formularioDeSenha({ obrigatoria: false })}
        </div>
      </aside>
    </div>`;
}

export const tela = { titulo: 'Minha conta', render };
