'use strict';

const { z } = require('zod');
const DATA = require('../assets/data.js');
const { detectarSegredoDeCarteira } = require('../assets/dominio.js');
const { SENHA_MINIMA } = require('./config');
const { invalido } = require('./erros');

const LIMITES = Object.freeze({
  nome: 120,
  textoCurto: 500,
  textoMedio: 2000,
  trecho: 5000,
  textoFonte: 600000,
  parecer: 60000,
  senhaMaxima: 200,
  provedores: 6
});

const DIMENSOES_COMPARACAO = DATA.prov.cols.map((coluna) => coluna.id);
const TIPOS_DE_CASO = DATA.tipos.map((tipo) => tipo.id);
const FORMATOS_DE_PARECER = DATA.formatos.map((formato) => formato.id);

const texto = (maximo) => z.string().trim().max(maximo);
const textoObrigatorio = (maximo) => texto(maximo).min(1, 'Preencha este campo.');
const identificador = z.coerce.number().int().positive();
const nota = z.number().int().min(0).max(3).nullable();
const email = z.string().trim().toLowerCase().max(LIMITES.nome).pipe(z.email('Informe um e-mail válido.'));
const senhaNova = z.string().min(SENHA_MINIMA, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`).max(LIMITES.senhaMaxima);
const dataIso = z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use uma data válida.');

/** Só aceita vazio ou endereço http(s): o valor vira link na interface. */
const urlOpcional = texto(LIMITES.textoCurto).refine((valor) => {
  if (!valor) { return true; }
  try { return ['http:', 'https:'].includes(new URL(valor).protocol); } catch { return false; }
}, 'Informe um endereço que comece com http:// ou https://.');

/** Lista de índices marcados em um checklist de `total` itens, sem repetição. */
const marcados = (total) => z.array(z.number().int().min(0).max(total - 1)).max(total)
  .transform((lista) => [...new Set(lista)].sort((a, b) => a - b));

const esquemas = {
  login: z.strictObject({ email, senha: z.string().min(1).max(LIMITES.senhaMaxima) }),
  trocaDeSenha: z.strictObject({ atual: z.string().min(1).max(LIMITES.senhaMaxima), nova: senhaNova }),

  grupo: z.strictObject({ nome: textoObrigatorio(80), turma: texto(80).default('') }),
  usuarioNovo: z.strictObject({
    nome: textoObrigatorio(LIMITES.nome),
    email,
    papel: z.enum(['aluno', 'professor', 'admin']),
    grupo_id: identificador.nullable().default(null)
  }).refine((u) => u.papel !== 'aluno' || u.grupo_id !== null, { path: ['grupo_id'], message: 'Escolha o grupo do aluno.' }),
  usuarioEdicao: z.strictObject({
    nome: textoObrigatorio(LIMITES.nome),
    papel: z.enum(['aluno', 'professor', 'admin']),
    grupo_id: identificador.nullable(),
    ativo: z.boolean(),
    redefinir_senha: z.literal(true)
  }).partial(),

  casoNovo: z.strictObject({
    grupo_id: identificador,
    titulo: textoObrigatorio(LIMITES.nome),
    tipo: z.enum(TIPOS_DE_CASO),
    descricao_curta: texto(LIMITES.textoCurto).default(''),
    exemplo: z.boolean().default(false)
  }),
  casoEdicao: z.strictObject({
    titulo: textoObrigatorio(LIMITES.nome),
    tipo: z.enum(TIPOS_DE_CASO),
    descricao_curta: texto(LIMITES.textoCurto),
    provas: marcados(DATA.provas.length),
    checklist_publicidade: marcados(DATA.checkPub.length)
  }).partial(),

  diagnostico: z.strictObject({
    plataforma: texto(LIMITES.nome),
    documento_url: urlOpcional,
    link_arquivado: urlOpcional,
    data_acesso: dataIso,
    texto_fonte: z.string().max(LIMITES.textoFonte, 'O texto do documento é grande demais.'),
    ferramenta_ia: texto(LIMITES.nome),
    versao_modelo: texto(LIMITES.nome),
    data_criacao: dataIso,
    prompt_usado: texto(LIMITES.trecho)
  }).partial(),
  resposta: z.strictObject({
    nota,
    trecho_literal: texto(LIMITES.trecho),
    resumo: texto(LIMITES.textoMedio),
    por_que: texto(LIMITES.textoMedio)
  }),
  consultaIa: z.strictObject({ substituir: z.boolean().default(false) }),

  parecer: z.strictObject({
    formato: z.enum(FORMATOS_DE_PARECER),
    texto: z.string().max(LIMITES.parecer),
    validado_humano: z.boolean(),
    declaracao_ia: z.boolean(),
    notas: z.array(z.number().int().min(0).max(10)).length(DATA.rubrica.length)
  }).partial(),

  comparacao: z.strictObject({
    divergencia_destacada: texto(LIMITES.textoMedio),
    provedores: z.array(z.strictObject({
      nome: textoObrigatorio(80),
      celulas: z.strictObject(Object.fromEntries(DIMENSOES_COMPARACAO.map((id) => [
        id, z.strictObject({ nota, texto: texto(LIMITES.textoMedio) })
      ])))
    })).max(LIMITES.provedores)
  }),

  transacao: z.strictObject({
    integrante: texto(LIMITES.nome),
    rede: texto(LIMITES.nome),
    endereco_origem: texto(LIMITES.nome),
    endereco_destino: texto(LIMITES.nome),
    hash: texto(LIMITES.nome),
    data_hora: texto(40),
    link_explorador: urlOpcional,
    obs: texto(LIMITES.textoMedio)
  }).superRefine((transacao, contexto) => {
    Object.entries(transacao).forEach(([campo, valor]) => {
      const segredo = detectarSegredoDeCarteira(valor, campo === 'hash');
      if (segredo) {
        contexto.addIssue({
          code: 'custom',
          path: [campo],
          message: segredo === 'frase'
            ? 'Isto parece uma frase de recuperação. Nunca registre a frase de recuperação.'
            : 'Isto parece uma chave privada. Registre apenas endereços públicos e o código da transação.'
        });
      }
    });
  }),

  anotacoesDoGrupo: z.strictObject({
    higiene: marcados(DATA.higiene.length),
    passos_ativos: marcados(DATA.passosAtivos.length)
  }).partial()
};

/** Valida `dados` com o esquema; em caso de erro lança 400 com a mensagem de cada campo. */
function validar(esquema, dados) {
  const resultado = esquema.safeParse(dados);
  if (resultado.success) { return resultado.data; }
  const campos = resultado.error.issues.map((problema) => ({ campo: problema.path.join('.'), mensagem: problema.message }));
  throw invalido(campos[0] && campos[0].campo ? `Confira o campo "${campos[0].campo}": ${campos[0].mensagem}` : 'Confira os dados enviados.', { campos });
}

/** Lê um identificador numérico de rota (ex.: /casos/:id). */
function lerId(valor) {
  const resultado = identificador.safeParse(valor);
  if (!resultado.success) { throw invalido('Identificador inválido.'); }
  return resultado.data;
}

module.exports = { esquemas, validar, lerId, LIMITES, DIMENSOES_COMPARACAO };
