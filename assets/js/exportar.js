/* Exportação de arquivos (CSV e TXT) gerados no navegador a partir dos dados salvos. */
const MARCA_UTF8 = '﻿';
const TEMPO_PARA_LIBERAR_MS = 1000;

export const dataDeHoje = () => new Date().toISOString().slice(0, 10);

export function baixar(nome, texto, tipo = 'text/plain') {
  const arquivo = new Blob([MARCA_UTF8 + texto], { type: `${tipo};charset=utf-8` });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), TEMPO_PARA_LIBERAR_MS);
}

/** Monta CSV com aspas duplicadas e células neutralizadas contra fórmulas de planilha. */
export function montarCsv(linhas) {
  const { celulaCsvSegura } = window.Dominio;
  return linhas
    .map((linha) => linha.map((celula) => `"${celulaCsvSegura(celula).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export const baixarCsv = (nome, linhas) => baixar(nome, montarCsv(linhas), 'text/csv');
export const baixarTexto = (nome, linhas) => baixar(nome, linhas.join('\r\n'));
