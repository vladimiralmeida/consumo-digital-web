/*
 * Ponte entre as telas e o desenho da página. main.js registra as funções; as telas pedem
 * um redesenho completo (após cliques) ou só das regiões calculadas (durante a digitação,
 * para não tirar o foco do campo).
 */
let redesenhar = () => {};
let redesenharRegioes = () => {};

export function registrarPainel(funcoes) {
  redesenhar = funcoes.redesenhar;
  redesenharRegioes = funcoes.redesenharRegioes;
}

export const pedirRedesenho = () => redesenhar();
export const pedirRegioes = () => redesenharRegioes();
