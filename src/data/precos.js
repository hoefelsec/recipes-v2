/* Preços — a ligação entre mercado e produto.
 *
 * É a tabela do MEIO, e o preço mora nela porque não é fato de nenhuma das duas
 * pontas: "R$ 8,00" não é uma propriedade do feijão São João nem do Zaffari, é o
 * que acontece quando os dois se encontram. Enquanto o preço morava em
 * `produtos.js`, o mesmo pacote não podia custar duas coisas — e custa.
 *
 * A ligação é 0-1: um mercado tem no máximo UM preço para cada produto, e pode não
 * ter nenhum (não vende aquilo). Um produto sem nenhum preço não é permitido — há
 * teste — porque produto que ninguém vende é catálogo sujo, do mesmo jeito que
 * ingrediente que nenhuma receita usa.
 *
 * Por que arquivo separado, e não dentro do mercado:
 *
 *   - é o dado que MAIS muda. Mercado e produto são estáveis; preço muda toda
 *     semana, e é bom que a mudança de rotina toque um arquivo só.
 *   - o produto fica limpo de qualquer mercado, e o mercado limpo de qualquer
 *     produto. Nenhum dos dois cresce quando o outro cresce.
 *   - aninhado por mercado, lê-se como uma lista de preços — que é como se copia
 *     de uma nota ou de um site de mercado.
 *
 * ATENÇÃO: todos os preços são FICTÍCIOS, para teste. Não representam valores de
 * mercado nem o que qualquer uma dessas redes cobra.
 */

import { existe as mercadoExiste } from "./mercados.js";

/* Por mercado, e dentro dele por produto. Um produto ausente significa "este
   mercado não vende isso" — e não "vende de graça". */
export const PRECOS = {
  zaffari: {
    "feijao-sao-joao-1kg": 8.0,
    "feijao-camil-1kg": 9.5,
    "farinha-dona-benta-1kg": 6.5,
    "acucar-uniao-1kg": 5.2,
    "acucar-guarani-5kg": 23.9,
    "fermento-royal-100g": 5.2,
    "chocolate-po-garoto-200g": 9.9,
    "chocolate-po-50-200g": 14.5,
    "carne-seca-friboi-500g": 34.9,
    "costelinha-sadia-1kg": 25.9,
    "paio-perdigao-400g": 18.9,
    "calabresa-seara-400g": 17.2,
    "bacon-seara-500g": 19.9,
    "cebola-granel-1kg": 6.3,
    "alho-cabeca-200g": 7.9,
    "cenoura-granel-1kg": 4.8,
    "laranja-pera-1kg": 5.5,
    "ovos-brancos-12un": 15.4,
    "manteiga-aviacao-200g": 12.9,
    "manteiga-president-200g": 15.9,
    "oleo-liza-900ml": 12.4,
    "leite-italac-1l": 5.49,
    "leite-piracanjuba-1l": 5.99,
    "leite-condensado-moca-lata": 8.49,
    "sal-cisne-1kg": 3.2,
    "pimenta-kitano-30g": 5.9,
    "louro-kitano-8g": 4.5,
    "forminha-n4-100un": 7.4
  },

  nacional: {
    "feijao-sao-joao-1kg": 8.4,
    "ovos-caipira-10un": 22.9,
    "farinha-dona-benta-1kg": 6.9,
    "acucar-uniao-1kg": 5.5,
    "acucar-guarani-5kg": 22.9,
    "fermento-royal-100g": 4.9,
    "chocolate-po-50-200g": 15.2,
    "granulado-dori-500g": 12.9,
    "costelinha-sadia-1kg": 24.9,
    "calabresa-seara-400g": 16.5,
    "cebola-granel-1kg": 5.9,
    "cenoura-granel-1kg": 4.5,
    "ovos-brancos-12un": 14.9,
    "manteiga-president-200g": 16.4,
    "oleo-liza-900ml": 11.9,
    "oleo-soya-900ml": 8.9,
    "leite-desnatado-italac-1l": 5.79,
    "leite-condensado-moca-lata": 8.9,
    "sal-cisne-1kg": 3.4,
    "forminha-n4-100un": 6.9
  },

  asun: {
    "feijao-sao-joao-1kg": 8.2,
    "manteiga-tirolez-200g": 17.9,
    "ovos-caipira-10un": 24.9,
    "farinha-dona-benta-1kg": 6.8,
    "chocolate-po-garoto-200g": 10.4,
    "carne-seca-friboi-500g": 35.9,
    "paio-perdigao-400g": 19.4,
    "bacon-seara-500g": 20.4,
    "alho-cabeca-200g": 8.3,
    "laranja-pera-1kg": 5.9,
    "manteiga-aviacao-200g": 13.4,
    "oleo-soya-900ml": 9.2,
    "leite-italac-1l": 5.79,
    "pimenta-kitano-30g": 6.2,
    "louro-kitano-8g": 4.9
  }
};

/**
 * O preço de um produto num mercado, ou `null` se ele não vende aquilo.
 *
 * `null` e não zero: não vender não é vender de graça, e um zero solto na conta
 * apareceria como "R$ 0,00" em vez de "???".
 */
export function preco(mercadoId, produtoId) {
  const doMercado = PRECOS[mercadoId];
  if (!doMercado || !Object.hasOwn(doMercado, produtoId)) return null;
  return doMercado[produtoId];
}

/**
 * Todos os preços de um produto: `[{ mercado, preco }]`, do mais barato ao mais caro.
 *
 * Mercado registrado em `PRECOS` que não exista em `mercados.js` é ignorado — o
 * mesmo saneamento que o resto do site faz na leitura, em vez de confiar no dado.
 */
export function precosDe(produtoId) {
  const achados = [];

  for (const [mercadoId, tabela] of Object.entries(PRECOS)) {
    if (!mercadoExiste(mercadoId)) continue;
    if (!Object.hasOwn(tabela, produtoId)) continue;

    const valor = tabela[produtoId];
    if (typeof valor === "number" && valor > 0) achados.push({ mercado: mercadoId, preco: valor });
  }

  return achados.sort((a, b) => a.preco - b.preco || a.mercado.localeCompare(b.mercado));
}

/**
 * O melhor preço de um produto: `{ mercado, preco }`, ou `null` se ninguém vende.
 *
 * É esta a regra do site enquanto não há como escolher o mercado: o mais barato
 * entre todos. É a extensão do que ele já fazia — escolher o produto mais barato
 * do ingrediente —, uma dimensão a mais na mesma pergunta.
 */
export const maisBarato = produtoId => precosDe(produtoId)[0] ?? null;

/** Este mercado vende este produto? */
export const vendeEm = (mercadoId, produtoId) => preco(mercadoId, produtoId) != null;

/** Em quantos mercados o produto aparece. Zero é defeito de catálogo, não estado. */
export const mercadosDe = produtoId => precosDe(produtoId).map(p => p.mercado);

/** O que um mercado vende. */
export const catalogoDe = mercadoId => Object.keys(PRECOS[mercadoId] ?? {});
