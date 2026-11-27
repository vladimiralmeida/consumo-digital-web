/* Contas e grupos: só para professor e administrador. Não há cadastro aberto. */
import { api } from '../api.js';
import { carregarGrupos } from '../dados.js';
import { estado } from '../estado.js';
import { html, atributo } from '../html.js';
import { agendarSalvamento } from '../salvar.js';
import { cabecalho, confirmar, emblema } from '../ui.js';

const PAPEIS = { aluno: 'Aluno', professor: 'Professor', admin: 'Administrador' };
const visao = () => estado.visao.contas;
const ehAdmin = () => estado.usuario.papel === 'admin';
const podeGerenciar = (usuario) => ehAdmin() || usuario.papel === 'aluno';
const nomeDoGrupo = (id) => (estado.grupos.find((grupo) => grupo.id === id) || { nome: '–' }).nome;

async function carregar() {
  const { usuarios } = await api('GET', '/usuarios');
  estado.usuarios = usuarios;
}

function senhaGerada() {
  const { senhaGerada: dados } = visao();
  if (!dados) { return ''; }
  return html`
    <section class="cartao realce" role="status">
      <h2>Senha inicial de ${dados.nome}</h2>
      <p class="apoio">Entregue esta senha à pessoa por um canal seguro. Ela aparece só agora e terá de ser trocada no primeiro acesso.</p>
      <div class="senha-gerada">${dados.senha}</div>
      <div><button type="button" class="botao" data-a="ct-ocultar">Já anotei, ocultar</button></div>
    </section>`;
}

function linhaDoUsuario(usuario) {
  const gerenciavel = podeGerenciar(usuario) && usuario.id !== estado.usuario.id;
  return html`
    <tr>
      <th scope="row">${usuario.nome}<span class="legenda">${usuario.email}</span></th>
      <td>${PAPEIS[usuario.papel]}</td>
      <td>${usuario.papel === 'aluno' ? nomeDoGrupo(usuario.grupo_id) : '–'}</td>
      <td>${usuario.ativo ? (usuario.deve_trocar_senha ? emblema('Senha inicial') : emblema('Ativa', 'ok')) : emblema('Desativada')}</td>
      <td>${gerenciavel ? html`
        <div class="linha-acoes">
          <button type="button" class="botao simples" data-a="ct-senha" data-i="${usuario.id}" aria-label="Gerar nova senha para ${usuario.nome}">Nova senha</button>
          <button type="button" class="botao simples ${usuario.ativo ? 'destrutivo' : ''}" data-a="ct-ativo" data-i="${usuario.id}" aria-label="${usuario.ativo ? 'Desativar' : 'Reativar'} a conta de ${usuario.nome}">${usuario.ativo ? 'Desativar' : 'Reativar'}</button>
        </div>` : usuario.id === estado.usuario.id ? html`<span class="legenda">Você</span>` : ''}</td>
    </tr>`;
}

function render() {
  const usuarios = estado.usuarios || [];
  const { falha } = visao();
  return html`
    ${cabecalho('Contas e grupos', 'O professor cria os grupos e as contas. Cada aluno entra com a senha inicial e precisa trocá-la no primeiro acesso. Cada grupo só enxerga os próprios dados.')}
    ${falha ? html`<div class="avisos"><p class="aviso erro" role="alert">${falha}</p></div>` : ''}
    <div class="colunas">
      <div class="coluna">
        ${senhaGerada()}
        <section class="cartao">
          <div class="cartao-topo"><h2>Contas</h2>${emblema(`${usuarios.length} conta(s)`)}</div>
          <div class="rolagem">
            <table>
              <thead><tr><th scope="col">Nome</th><th scope="col">Papel</th><th scope="col">Grupo</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
              <tbody>${usuarios.map(linhaDoUsuario)}</tbody>
            </table>
          </div>
        </section>
        <section class="cartao">
          <div class="pilha junta"><h2>Grupos</h2><p class="apoio">Edite o nome ou a turma direto na lista; a alteração é salva sozinha.</p></div>
          ${estado.grupos.length ? html`<div class="pilha">${estado.grupos.map((grupo) => html`
            <div class="campos-2">
              <div class="campo"><label for="gr-nome-${grupo.id}">Nome do grupo</label><input id="gr-nome-${grupo.id}" type="text" maxlength="80" value="${grupo.nome}" data-c="ct-grupo" data-i="${grupo.id}:nome"></div>
              <div class="campo"><label for="gr-turma-${grupo.id}">Turma</label><input id="gr-turma-${grupo.id}" type="text" maxlength="80" value="${grupo.turma}" data-c="ct-grupo" data-i="${grupo.id}:turma"></div>
            </div>`)}</div>` : html`<p class="apoio">Nenhum grupo ainda. Crie o primeiro ao lado.</p>`}
        </section>
      </div>
      <aside class="coluna">
        <form class="cartao" data-f="ct-novo-grupo" novalidate>
          <h2>Novo grupo</h2>
          <div class="campo"><label for="ng-nome">Nome do grupo</label><input id="ng-nome" name="nome" type="text" maxlength="80" required></div>
          <div class="campo"><label for="ng-turma">Turma (opcional)</label><input id="ng-turma" name="turma" type="text" maxlength="80" placeholder="Ex.: 2026.2"></div>
          <div><button type="submit" class="botao primario">Criar grupo</button></div>
        </form>
        <form class="cartao" data-f="ct-nova-conta" novalidate>
          <h2>Nova conta</h2>
          <div class="campo"><label for="nc-nome">Nome</label><input id="nc-nome" name="nome" type="text" maxlength="120" required autocomplete="off"></div>
          <div class="campo"><label for="nc-email">E-mail</label><input id="nc-email" name="email" type="email" maxlength="120" required autocomplete="off"></div>
          <div class="campo">
            <label for="nc-papel">Papel</label>
            <select id="nc-papel" name="papel">
              <option value="aluno">Aluno</option>
              ${ehAdmin() ? html`<option value="professor">Professor</option><option value="admin">Administrador</option>` : ''}
            </select>
          </div>
          <div class="campo">
            <label for="nc-grupo">Grupo (para aluno)</label>
            <select id="nc-grupo" name="grupo_id"${atributo(!estado.grupos.length, 'disabled')}>
              ${estado.grupos.length ? estado.grupos.map((grupo) => html`<option value="${grupo.id}">${grupo.nome}</option>`) : html`<option value="">Crie um grupo primeiro</option>`}
            </select>
          </div>
          <p class="legenda">O sistema gera a senha inicial e a mostra uma única vez. Guardamos nome e e-mail apenas para o acesso; os dados são descartados ao fim da disciplina.</p>
          <div><button type="submit" class="botao primario">Criar conta</button></div>
        </form>
      </aside>
    </div>`;
}

async function executar(acao) {
  try {
    visao().falha = '';
    await acao();
  } catch (erro) {
    visao().falha = erro.message;
  }
}

const usuarioPorId = (id) => estado.usuarios.find((usuario) => usuario.id === Number(id));
const trocarUsuario = (novo) => { estado.usuarios = estado.usuarios.map((usuario) => (usuario.id === novo.id ? novo : usuario)); };

function gravarGrupo(grupoId) {
  return () => {
    const { nome, turma } = estado.grupos.find((grupo) => grupo.id === grupoId);
    return api('PUT', `/grupos/${grupoId}`, { nome, turma });
  };
}

export const tela = {
  titulo: 'Contas e grupos',
  restrita: true,
  carregar,
  render,
  acoes: {
    'ct-ocultar': () => { visao().senhaGerada = null; },
    'ct-senha': (id) => executar(async () => {
      const alvo = usuarioPorId(id);
      const confirmado = await confirmar({ titulo: `Gerar nova senha para ${alvo.nome}?`, texto: 'A senha atual deixa de valer e as sessões abertas dessa conta são encerradas.', rotuloConfirmar: 'Gerar nova senha' });
      if (!confirmado) { return; }
      const { usuario, senha_inicial: senha } = await api('PATCH', `/usuarios/${alvo.id}`, { redefinir_senha: true });
      trocarUsuario(usuario);
      visao().senhaGerada = { nome: usuario.nome, senha };
    }),
    'ct-ativo': (id) => executar(async () => {
      const alvo = usuarioPorId(id);
      if (alvo.ativo) {
        const confirmado = await confirmar({ titulo: `Desativar a conta de ${alvo.nome}?`, texto: 'A pessoa deixa de conseguir entrar. Os dados do grupo continuam salvos e a conta pode ser reativada.', rotuloConfirmar: 'Desativar conta', destrutivo: true });
        if (!confirmado) { return; }
      }
      const { usuario } = await api('PATCH', `/usuarios/${alvo.id}`, { ativo: !alvo.ativo });
      trocarUsuario(usuario);
    })
  },
  campos: {
    'ct-grupo': (valor, elemento) => {
      const [id, nomeDoCampo] = elemento.dataset.i.split(':');
      const grupoId = Number(id);
      estado.grupos = estado.grupos.map((grupo) => (grupo.id === grupoId ? { ...grupo, [nomeDoCampo]: valor } : grupo));
      agendarSalvamento(`grupo:${grupoId}`, gravarGrupo(grupoId));
    }
  },
  formularios: {
    'ct-novo-grupo': (dados) => executar(async () => {
      await api('POST', '/grupos', { nome: String(dados.get('nome') || ''), turma: String(dados.get('turma') || '') });
      const semGrupoAntes = !estado.grupoId;
      const { grupos } = await api('GET', '/grupos');
      estado.grupos = grupos;
      if (semGrupoAntes) { await carregarGrupos(); }
    }),
    'ct-nova-conta': (dados) => executar(async () => {
      const papel = String(dados.get('papel'));
      const { usuario, senha_inicial: senha } = await api('POST', '/usuarios', {
        nome: String(dados.get('nome') || ''),
        email: String(dados.get('email') || ''),
        papel,
        grupo_id: papel === 'aluno' && dados.get('grupo_id') ? Number(dados.get('grupo_id')) : null
      });
      estado.usuarios = [...estado.usuarios, usuario];
      visao().senhaGerada = { nome: usuario.nome, senha };
    })
  }
};
