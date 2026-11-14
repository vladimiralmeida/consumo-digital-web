/* Parecer: formato, texto do grupo, apêndice técnico e autoavaliação pela rubrica. */
import { estado, alterarPacote, ehIntegrante, indiceEmTela } from '../estado.js';
import { baixarTexto, dataDeHoje } from '../exportar.js';
import { gravarParecer } from '../gravar.js';
import { html, atributo } from '../html.js';
import { agendarSalvamento, salvarAgora } from '../salvar.js';
import { cabecalho, campo, emblema, formatarData, formatarDecimal, semCaso } from '../ui.js';

const DATA = window.DATA;
const CARACTERES_POR_PAGINA = 3000;
const PAGINAS_MINIMAS = 3;
const PAGINAS_MAXIMAS = 5;
const NOTA_MAXIMA = 10;

const parecer = () => estado.pacote.parecer;
const formatoAtual = () => DATA.formatos.find((formato) => formato.id === parecer().formato) || DATA.formatos[0];

/** Situação real de cada item do apêndice, a partir do que o grupo já salvou. */
function situacaoDoApendice() {
  const { diagnostico, respostas, consultas } = estado.pacote;
  const indice = indiceEmTela();
  return [
    Boolean(diagnostico.plataforma && diagnostico.documento_url && diagnostico.link_arquivado && diagnostico.data_acesso),
    consultas.length > 0 || Boolean(diagnostico.ferramenta_ia),
    consultas.length > 0,
    respostas.some((resposta) => resposta.trecho_literal.trim()),
    indice.completo,
    parecer().validado_humano,
    parecer().declaracao_ia
  ];
}

function regiaoDasPaginas() {
  const paginas = parecer().texto.length / CARACTERES_POR_PAGINA;
  const dentro = paginas >= PAGINAS_MINIMAS && paginas <= PAGINAS_MAXIMAS;
  return html`
    <div class="entre"><span class="apoio">Cerca de ${formatarDecimal(paginas)} página(s). O trabalho pede de ${PAGINAS_MINIMAS} a ${PAGINAS_MAXIMAS}.</span>${emblema(dentro ? 'Dentro do tamanho' : paginas < PAGINAS_MINIMAS ? 'Abaixo do mínimo' : 'Acima do máximo', dentro ? 'ok' : '')}</div>
    <progress max="${PAGINAS_MAXIMAS}" value="${Math.min(paginas, PAGINAS_MAXIMAS)}" aria-label="Tamanho do texto em páginas"></progress>`;
}

function regiaoDaMedia() {
  const { media, maiorLacuna } = window.Dominio.mediaPonderada(DATA.rubrica, parecer().notas);
  return html`
    <span class="rotulo">Média ponderada</span>
    <div class="numero-medio">${formatarDecimal(media)}</div>
    <p class="apoio">Maior lacuna: <strong>${DATA.rubrica[maiorLacuna].name}</strong>. É uma simulação para achar o que melhorar. A avaliação vale quando feita pelos outros grupos e pelo professor.</p>`;
}

function itemDoApendice(item, i, pronto) {
  const texto = html`<span>${i + 1}. <strong>${item.t}.</strong> ${item.d}</span>`;
  if (!item.chave) {
    return html`<li class="item"><span class="estado ${pronto ? '' : 'aberto'}" aria-hidden="true">${pronto ? '✓' : '○'}</span>${texto}<span class="so-leitor">${pronto ? '(pronto)' : '(pendente)'}</span></li>`;
  }
  const campoDoParecer = item.chave === 'val' ? 'validado_humano' : 'declaracao_ia';
  const quando = item.chave === 'val' ? parecer().validado_em : parecer().declarado_em;
  return html`
    <li class="item">
      <input type="checkbox" class="interruptor" id="ap-${item.chave}" role="switch" data-m="pr-ato" data-i="${campoDoParecer}"${atributo(pronto, 'checked')}${atributo(!ehIntegrante(), 'disabled')}>
      <label for="ap-${item.chave}">${texto}${pronto && quando ? html`<br><span class="legenda">Marcado pelo grupo em ${formatarData(quando)}.</span>` : ''}</label>
    </li>`;
}

function render() {
  if (!estado.pacote) { return semCaso('Abra um caso na triagem para redigir o parecer.'); }
  const formato = formatoAtual();
  const situacao = situacaoDoApendice();
  const prontos = situacao.filter(Boolean).length;
  return html`
    ${cabecalho('Do diagnóstico ao parecer', 'Escolha o formato, redija o texto de 3 a 5 páginas e complete o apêndice técnico. A ferramenta organiza; a conferência e a declaração de validação humana são do grupo.')}
    <div class="colunas">
      <div class="coluna">
        <section class="cartao">
          <h2>Formato do documento</h2>
          <div class="segmentos" role="group" aria-label="Formato do documento">
            ${DATA.formatos.map((item) => html`
              <button type="button" class="segmento bloco" aria-pressed="${parecer().formato === item.id ? 'true' : 'false'}" data-a="pr-formato" data-i="${item.id}">
                <strong>${item.title}</strong><span>${item.desc}</span>
              </button>`)}
          </div>
          <p class="apoio">Tom da conclusão: <strong>${formato.tom}</strong>.</p>
        </section>
        <section class="cartao">
          <div class="cartao-topo"><h2>Texto do parecer</h2>
            ${parecer().texto.trim() ? '' : html`<button type="button" class="botao" data-a="pr-modelo">Inserir a estrutura</button>`}
          </div>
          ${campo('pr-texto', 'Redação do grupo', parecer().texto, 'pr-texto', { linhas: 14, classe: 'alto', maximo: 60000, dica: 'Salvo automaticamente. Cite cada cláusula com o trecho literal conferido, o link original e o link arquivado.' })}
          <div class="pilha junta" data-regiao="paginas">${regiaoDasPaginas()}</div>
        </section>
        <section class="cartao">
          <h2>Estrutura do texto</h2>
          <ol class="pontos">
            ${DATA.estrutura.map((parte, i) => html`<li>${parte[0]}${i === DATA.estrutura.length - 1 ? ` (${formato.tom})` : ''} ${parte[1] ? html`<span class="apoio">${parte[1]}</span>` : ''}</li>`)}
          </ol>
        </section>
      </div>
      <aside class="coluna">
        <section class="cartao realce">
          <div class="cartao-topo"><h2>Apêndice técnico</h2>${emblema(`${prontos} de ${DATA.apendice.length} itens prontos`)}</div>
          <ul class="lista">${DATA.apendice.map((item, i) => itemDoApendice(item, i, situacao[i]))}</ul>
          ${ehIntegrante() ? '' : html`<p class="legenda">A validação humana e a declaração de uso de IA só podem ser marcadas por integrantes do grupo.</p>`}
          <div><button type="button" class="botao" data-a="pr-exportar">Exportar apêndice (TXT)</button></div>
        </section>
        <section class="cartao">
          <div class="pilha junta"><h3>Autoavaliação pela rubrica</h3><p class="apoio">Notas de 0 a 10, com os pesos da ficha.</p></div>
          <div class="pilha">
            ${DATA.rubrica.map((criterio, i) => html`
              <div class="entre">
                <span class="apoio"><strong>${criterio.name}</strong> · peso ${formatarDecimal(criterio.peso)}</span>
                <div class="passo">
                  <button type="button" aria-label="Diminuir a nota de ${criterio.name}" data-a="pr-nota" data-i="${i}:-1">−</button>
                  <output aria-live="polite" aria-label="Nota de ${criterio.name}">${parecer().notas[i]}</output>
                  <button type="button" aria-label="Aumentar a nota de ${criterio.name}" data-a="pr-nota" data-i="${i}:1">+</button>
                </div>
              </div>`)}
          </div>
          <div class="pilha junta">${regiaoDaMedia()}</div>
        </section>
        <section class="cartao compacto">
          <h3>Roteiro de 15 minutos</h3>
          <ul class="lista">${DATA.roteiro.map((passo) => html`<li class="item"><strong>${passo[0]} min</strong><span>${passo[1]}</span></li>`)}</ul>
        </section>
      </aside>
    </div>`;
}

function estruturaInicial() {
  const { diagnostico } = estado.pacote;
  const plataforma = diagnostico.plataforma || '[plataforma]';
  return [
    `Análise Crítica dos Termos de Serviço de ${plataforma} à Luz do Código de Defesa do Consumidor`, '',
    '1. Objeto da análise',
    `Este documento analisa os termos de ${plataforma}, versão acessada em ${formatarData(diagnostico.data_acesso) || '[data]'}, disponível em ${diagnostico.documento_url || '[link original]'} e arquivada em ${diagnostico.link_arquivado || '[link arquivado]'}.`, '',
    '2. Metodologia', '[Ferramentas de IA usadas e protocolo de perguntas.]', '',
    '3. Diagnóstico da opacidade', '[Achados por eixo, cada um com o trecho literal conferido.]', '',
    '4. Análise crítica à luz do CDC', '[Núcleo do trabalho.]', '',
    '5. Conclusão e encaminhamento', formatoAtual().concl
  ].join('\n');
}

function exportarApendice() {
  const { diagnostico, consultas, respostas, caso } = estado.pacote;
  const situacao = situacaoDoApendice();
  const linhas = ['APÊNDICE TÉCNICO', `Caso: ${caso.titulo}`, `Gerado em ${formatarData(dataDeHoje())}`, ''];
  DATA.apendice.forEach((item, i) => linhas.push(`${situacao[i] ? '[x]' : '[ ]'} ${i + 1}. ${item.t}. ${item.d}`));
  linhas.push('', '1. IDENTIFICAÇÃO DO DOCUMENTO',
    `Plataforma: ${diagnostico.plataforma}`, `Link original: ${diagnostico.documento_url}`,
    `Link arquivado: ${diagnostico.link_arquivado}`, `Data de acesso: ${formatarData(diagnostico.data_acesso)}`,
    '', '2 e 3. FERRAMENTAS DE IA E REGISTRO DOS PROMPTS');
  if (diagnostico.ferramenta_ia) { linhas.push(`Criação do conteúdo: ${diagnostico.ferramenta_ia} ${diagnostico.versao_modelo}, em ${formatarData(diagnostico.data_criacao)}. Prompt: ${diagnostico.prompt_usado}`); }
  if (!consultas.length) { linhas.push('Nenhuma consulta à IA registrada neste caso.'); }
  consultas.forEach((consulta) => linhas.push(`- ${consulta.criado_em} UTC · ${consulta.ferramenta} · modelo ${consulta.modelo} · ${consulta.prompt.replace(/\n/g, ' ')}`));
  linhas.push('', '4. TRANSCRIÇÕES LITERAIS');
  respostas.filter((resposta) => resposta.trecho_literal.trim()).forEach((resposta) => {
    const conferencia = resposta.conferido === true ? 'conferido no texto-fonte' : resposta.conferido === false ? 'NÃO CONFERIDO' : 'sem transcrição a conferir';
    linhas.push(`- ${resposta.pergunta_id || `Dimensão ${resposta.dimensao}`} (nota ${resposta.nota ?? 'sem nota'}; ${conferencia}): ${resposta.trecho_literal}`, `  Em linguagem simples: ${resposta.resumo}`, '  Comentário do grupo:');
  });
  linhas.push('', '6. VALIDAÇÃO HUMANA', parecer().validado_humano ? `Marcada pelo grupo em ${formatarData(parecer().validado_em)}.` : 'Ainda não marcada pelo grupo.',
    '', '7. DECLARAÇÃO DE USO RESPONSÁVEL DE IA', parecer().declaracao_ia ? `Marcada pelo grupo em ${formatarData(parecer().declarado_em)}.` : 'Ainda não marcada pelo grupo.',
    '', 'Validação humana e declaração de uso de IA só valem se feitas pelo grupo.');
  baixarTexto(`apendice-tecnico-${dataDeHoje()}.txt`, linhas);
}

export const tela = {
  titulo: 'Parecer',
  render,
  regioes: (nome) => (nome === 'paginas' ? regiaoDasPaginas() : null),
  acoes: {
    'pr-formato': (formato) => { alterarPacote('parecer', { formato }); salvarAgora('parecer', gravarParecer(['formato'])); },
    'pr-modelo': () => { alterarPacote('parecer', { texto: estruturaInicial() }); salvarAgora('parecer-texto', gravarParecer(['texto'])); },
    'pr-nota': (par) => {
      const [indice, passo] = par.split(':').map(Number);
      const notas = parecer().notas.map((valor, i) => (i === indice ? Math.max(0, Math.min(NOTA_MAXIMA, valor + passo)) : valor));
      alterarPacote('parecer', { notas });
      agendarSalvamento('parecer-notas', gravarParecer(['notas']));
    },
    'pr-exportar': exportarApendice
  },
  mudancas: {
    'pr-ato': (campoDoParecer, elemento) => {
      alterarPacote('parecer', { [campoDoParecer]: elemento.checked });
      return salvarAgora(`parecer-${campoDoParecer}`, gravarParecer([campoDoParecer]));
    }
  },
  campos: {
    'pr-texto': (valor) => { alterarPacote('parecer', { texto: valor }); agendarSalvamento('parecer-texto', gravarParecer(['texto'])); }
  }
};
