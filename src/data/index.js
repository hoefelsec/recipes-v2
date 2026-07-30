/* Registro de receitas.
   Para adicionar uma receita: crie o arquivo em src/data/, importe aqui
   e inclua na lista `receitas`. A ordem dos grupos segue GRUPOS. */

import brigadeiro from "./brigadeiro.js";
import feijoada from "./feijoada.js";
import boloDeCenoura from "./bolo-de-cenoura.js";
import { resolverReceita } from "./resolve.js";

/* Os arquivos de receita guardam só a chave do ingrediente; a junção com o
   catálogo acontece aqui, uma vez, na carga. Quem consome `receitas` recebe os
   ingredientes já completos. */
export const receitas = [feijoada, brigadeiro, boloDeCenoura].map(resolverReceita);

/* Ordem em que os grupos aparecem no menu lateral.
   Grupos não listados aqui vão para o fim, em ordem alfabética. */
export const GRUPOS = ["Pratos principais", "Doces", "Acompanhamentos", "Bebidas"];

export function porSlug(slug) {
  return receitas.find(r => r.slug === slug);
}

/** Agrupa as receitas para montar o menu: [{ grupo, itens: [] }] */
export function agrupadas(lista = receitas) {
  const nomes = [...new Set(lista.map(r => r.grupo))].sort((a, b) => {
    const ia = GRUPOS.indexOf(a), ib = GRUPOS.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return nomes.map(grupo => ({
    grupo,
    itens: lista.filter(r => r.grupo === grupo)
  }));
}
