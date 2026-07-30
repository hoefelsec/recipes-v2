/* Quantidades de um ingrediente na tela: escala por porção, unidade preferida
   e conversão escolhida no clique.

   O conhecimento sobre unidades em si (arredondamento, plural, conversão) vive
   em units.js — aqui só se decide *qual* unidade usar e monta-se o texto. */

import {
  arredondar, formatar, pluralizar, quantidadeEmTexto, unidadeConhecida,
  converter, conversaoUtil, equivalentes, densidadeDe, familia, conversivel,
  equivalenciaMetrica
} from "./units.js";

// Reexportados para quem já importava daqui
export { arredondar, formatar, pluralizar, quantidadeEmTexto, unidadeConhecida, densidadeDe, familia };

/** Fator de multiplicação para o número de porções escolhido. */
export function fator(receita, porcoes) {
  return porcoes / receita.porcoes.padrao;
}

/**
 * Qual unidade usar para exibir.
 *
 * Ordem de prioridade:
 *   1. a unidade que a pessoa escolheu clicando naquele ingrediente;
 *   2. a preferência da família da própria unidade (volume para copo, peso para g);
 *   3. a preferência da *outra* família, quando o ingrediente tem densidade
 *      — é o que permite ver farinha em gramas mesmo escrita em copos;
 *   4. a unidade original da receita.
 *
 * Conversão que daria um número ruim ("0,08 copo") é descartada.
 */
function unidadeDeExibicao(valor, un, densidade, prefs, forcada) {
  if (forcada && conversaoUtil(valor, un, forcada, densidade)) return forcada;

  const propria = familia(un);
  if (!propria) return un;

  const outra = propria === "volume" ? "peso" : "volume";
  const candidatas = [prefs?.[propria], densidade ? prefs?.[outra] : null];

  for (const alvo of candidatas) {
    if (alvo && alvo !== "receita" && conversaoUtil(valor, un, alvo, densidade)) return alvo;
  }
  return un;
}

/**
 * Converte um ingrediente do arquivo de dados no que vai para a tela.
 *
 * Retorna { subtitulo } para separadores, ou:
 *   { qtd, item, nota, un, unOriginal, convertido, alternativas }
 * onde `alternativas` alimenta o menu de conversão.
 */
export function escalarIngrediente(ing, mult = 1, { prefs, unidadeForcada } = {}) {
  if (ing.subtitulo) return { subtitulo: ing.subtitulo };

  // "a gosto", "o quanto baste" e afins não escalam nem convertem
  if (ing.escala === false || ing.qtd == null) {
    return {
      qtd: ing.texto ?? "", item: ing.item,
      nota: null,
      un: null, unOriginal: null, convertido: false, alternativas: []
    };
  }

  const bruto = ing.qtd * mult;
  const densidade = densidadeDe(ing);
  const un = unidadeDeExibicao(bruto, ing.un, densidade, prefs, unidadeForcada);

  const valor = arredondar(converter(bruto, ing.un, un, densidade) ?? bruto, un);
  const convertido = un !== ing.un;

  const item = valor <= 1 && !convertido && ing.itemSingular ? ing.itemSingular : ing.item;

  return {
    qtd: quantidadeEmTexto(valor, un),
    item,
    nota: notaDe(ing, bruto, un),
    un,
    unOriginal: ing.un,
    convertido,
    alternativas: alternativasDe(bruto, ing.un, un, densidade)
  };
}

/**
 * Texto entre parênteses.
 *
 * Sem conversão, é a equivalência métrica da medida de casa — "2 copos (360 g)".
 * Não vem escrita na receita: é calculada da medida e do que o catálogo sabe do
 * ingrediente, então basta corrigir a densidade num lugar para todas as receitas
 * acertarem juntas.
 *
 * Convertido, passa a ser a medida original — "360 g (2 copos)" — assim não se
 * perde de vista o que a receita dizia.
 */
function notaDe(ing, bruto, un) {
  if (ing.un !== un) {
    const original = arredondar(bruto, ing.un);
    return quantidadeEmTexto(original, ing.un);
  }

  const eq = equivalenciaMetrica(ing, bruto);
  if (!eq || eq.un === un) return null;   // repetir a medida já mostrada não informa

  return quantidadeEmTexto(eq.qtd, eq.un);
}

/** Opções do menu de conversão, com o valor já convertido em cada uma. */
function alternativasDe(bruto, unOriginal, unAtual, densidade) {
  if (!conversivel(unOriginal)) return [];

  const alvos = equivalentes(bruto, unOriginal, densidade);

  // Sem para onde ir, não se abre menu: com o kg fora da tabela, peso puro
  // (300 g) não tem mais alternativa nenhuma
  if (!alvos.length) return [];

  // A unidade da receita sempre pode ser retomada
  if (!alvos.includes(unOriginal)) alvos.unshift(unOriginal);

  return alvos.map(alvo => {
    const v = arredondar(converter(bruto, unOriginal, alvo, densidade), alvo);
    return {
      un: alvo,
      texto: quantidadeEmTexto(v, alvo),
      atual: alvo === unAtual,
      original: alvo === unOriginal
    };
  });
}

/** Limita o valor ao intervalo da receita e encaixa no passo do seletor. */
export function normalizarPorcoes(receita, valor) {
  const { min, max, passo = 1, padrao } = receita.porcoes;
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;

  const encaixado = min + Math.round((n - min) / passo) * passo;
  return Math.min(max, Math.max(min, encaixado));
}
