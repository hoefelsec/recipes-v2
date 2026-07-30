/* Como arredondar, escrever e converter medidas.

   Os números e as palavras de cada medida ficam no banco de medidas,
   `src/data/unidades.js` — aqui está só o que se *faz* com eles.

   Duas famílias convertem livremente entre si:
     volume — ml, L, copo, xícara, colheres…
     peso   — g

   Cruzar volume e peso (copo -> g) depende da densidade do ingrediente: um copo
   de farinha e um copo de açúcar não pesam a mesma coisa. */

import { UNIDADES, MENU, PROMOCOES, METRICAS } from "../data/unidades.js";

export { UNIDADES, PROMOCOES, METRICAS };

/** Ordem em que as alternativas aparecem no menu de conversão. */
export const POR_FAMILIA = MENU;

const GENERICA = { passo: 0.25, min: 0.25 };
const FRACOES = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];

/* --------------------------------------------------------------- promoções */

/**
 * Em que múltiplo o valor deve ser escrito.
 * Devolve { valor, un, promovido }.
 */
export function promover(valor, un) {
  const p = PROMOCOES[un];
  if (!p || !Number.isFinite(valor) || Math.abs(valor) < p.limite) {
    return { valor, un, promovido: false };
  }
  return { valor: valor / p.divisor, un: p.un, promovido: true, decimais: p.decimais };
}

export const cfg = unidade => UNIDADES[unidade] || GENERICA;
export const familia = unidade => UNIDADES[unidade]?.familia ?? null;
export const conversivel = unidade => Boolean(familia(unidade));
export const unidadeConhecida = unidade => Object.hasOwn(UNIDADES, unidade);

/* ------------------------------------------------------ escrever e arredondar */

/** Arredonda para um valor "de cozinha", conforme a unidade. */
export function arredondar(valor, unidade) {
  const c = cfg(unidade);

  // Já é um número redondo? Então não estrague.
  if (c.preservar?.(valor)) return valor;

  const passo = typeof c.passo === "function" ? c.passo(valor) : c.passo;
  const arredondado = Math.round(valor / passo) * passo;
  return Math.max(c.min, Number(arredondado.toFixed(4)));
}

/**
 * Arredonda uma equivalência — número que *descreve* em vez de instruir.
 *
 * `arredondar` é generoso porque a receita admite folga: 27 g de manteiga podem
 * virar 25 g sem prejuízo do bolo. Uma equivalência, não: dizer que 2 colheres
 * são 25 g quando são 27 é dizer algo falso. Daí um passo mais fino.
 */
export function arredondarEquivalencia(valor, unidade) {
  const p = cfg(unidade).passoEquivalencia;
  if (!p) return arredondar(valor, unidade);

  const passo = typeof p === "function" ? p(valor) : p;
  return Number((Math.round(valor / passo) * passo).toFixed(4));
}

/**
 * Número em texto. Peso e volume métricos saem em decimal (1,25); o resto,
 * em fração (2 ½), que é como receita se escreve.
 */
export function formatar(valor, unidade) {
  if (!Number.isFinite(valor)) return "";

  if (UNIDADES[unidade]?.decimal) {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  const inteiro = Math.floor(valor + 1e-9);
  const resto = valor - inteiro;

  if (resto < 0.02) return String(inteiro);

  const fracao = FRACOES.find(([d]) => Math.abs(resto - d) < 0.02);
  if (fracao) return (inteiro ? `${inteiro} ` : "") + fracao[1];

  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Singular ou plural da unidade. Em português, ½ ainda pede singular. */
export function pluralizar(unidade, valor) {
  const c = UNIDADES[unidade];
  if (!c) return unidade;
  return valor <= 1 ? unidade : (c.plural ?? unidade);
}

/** Unidades como "un." não aparecem: mostra-se "3 ovos", não "3 un. ovos". */
export function textoUnidade(unidade, valor) {
  if (!unidade || UNIDADES[unidade]?.oculta) return "";
  return " " + pluralizar(unidade, valor);
}

/**
 * Quantidade completa em texto: "1,25 kg", "2 ½ copos", "6 dentes".
 * É aqui que a promoção acontece: 1.250 g guardados saem como "1,25 kg".
 */
export function quantidadeEmTexto(valor, unidade) {
  const p = promover(valor, unidade);

  if (p.promovido) {
    const numero = p.valor.toLocaleString("pt-BR", { maximumFractionDigits: p.decimais });
    return `${numero} ${p.un}`;
  }

  return formatar(valor, unidade) + textoUnidade(unidade, valor);
}

/* --------------------------------------------------------------- converter */

/**
 * Converte um valor entre unidades.
 * `densidade` é em g/ml e só é necessária para cruzar volume <-> peso.
 * Retorna null quando a conversão não é possível.
 */
export function converter(valor, de, para, densidade = null) {
  if (de === para) return valor;

  const fDe = familia(de);
  const fPara = familia(para);
  if (!fDe || !fPara) return null;

  const emBase = valor * UNIDADES[de].base;   // ml ou g

  if (fDe === fPara) return emBase / UNIDADES[para].base;

  if (!densidade) return null;
  const convertido = fDe === "volume" ? emBase * densidade : emBase / densidade;
  return convertido / UNIDADES[para].base;
}

/* Erro máximo tolerado numa conversão. Escalar a receita é uma escolha da
   pessoa e admite arredondamento; converter é uma promessa de equivalência,
   então só se oferece o que fecha (quase) exato. */
const ERRO_MAXIMO = 0.04;

/**
 * Conversão que vale a pena mostrar?
 *
 * Descarta dois casos: número ruim de ler ("0,08 copo", "0,36 L") e conversão
 * que o arredondamento estragaria — 4 col. sopa é ⅓ de copo, e mostrar "¼ copo"
 * seria 25% menos do que a receita pede.
 */
export function conversaoUtil(valor, de, para, densidade = null) {
  const bruto = converter(valor, de, para, densidade);
  if (bruto === null || bruto <= 0) return false;

  if (bruto < (cfg(para).minConversao ?? cfg(para).min)) return false;

  const erro = Math.abs(arredondar(bruto, para) - bruto) / bruto;
  return erro <= ERRO_MAXIMO;
}

/**
 * Unidades para as quais este valor pode ser convertido de forma útil,
 * já sem a unidade atual. Peso entra na lista de volume (e vice-versa)
 * apenas quando há densidade.
 */
export function equivalentes(valor, unidade, densidade = null) {
  const f = familia(unidade);
  if (!f) return [];

  const candidatas = densidade
    ? [...POR_FAMILIA.volume, ...POR_FAMILIA.peso]
    : [...POR_FAMILIA[f]];

  return candidatas.filter(u => u !== unidade && conversaoUtil(valor, unidade, u, densidade));
}

/** Densidade (g/ml) do ingrediente, quando o catálogo a informa. */
export const densidadeDe = ing =>
  typeof ing?.densidade === "number" ? ing.densidade : null;

/** A medida já é métrica? Então não precisa de equivalência nenhuma. */
export const metrica = unidade => METRICAS.includes(unidade);

/**
 * Peso em gramas de uma quantidade, ou null quando não há como saber.
 *
 * É a ponte que quase tudo no site atravessa — nutrientes, preço, equivalência —
 * porque grama é a única medida que serve para qualquer ingrediente. Três
 * caminhos, na ordem em que se tenta:
 *
 *   peso      direto            300 g, 1 kg
 *   volume    pela densidade    2 copos de açúcar
 *   contável  por pesoPorUnidade  3 ovos, 6 dentes, 1 lata
 */
export function emGramas(qtd, un, ing = {}) {
  if (qtd == null || !un) return null;

  const fam = familia(un);

  if (fam === "peso") return converter(qtd, un, "g");
  if (fam === "volume") {
    const d = densidadeDe(ing);
    return d ? converter(qtd, un, "g", d) : null;
  }

  const porUnidade = ing.pesoPorUnidade?.[un];
  return porUnidade == null ? null : qtd * porUnidade;
}

/* Abaixo disto a equivalência não ajuda ninguém: uma pitada de sal são 0,4 g,
   número que balança de cozinha não lê e que ninguém vai medir. */
const MINIMO_UTIL = 5;

/**
 * Equivalência métrica de uma medida de casa — o que vai entre parênteses.
 *
 * Sai da medida e do que o catálogo sabe do ingrediente, nunca da receita:
 *
 *   volume + líquido    o próprio volume em ml, exato pela tabela de medidas
 *                       (1 copo = 180 ml). Líquido se mede por volume.
 *   volume + sólido     o peso, pela densidade — é o que se põe na balança
 *                       (2 copos de açúcar = 360 g).
 *   contável/embalagem  o peso de uma unidade vezes a quantidade
 *                       (3 cenouras = 300 g; 1 lata = 395 g). Aqui não há
 *                       escolha: volume de uma lata não é dado que se tenha.
 *
 * Devolve { qtd, un } já arredondado, ou null quando não há como calcular — ou
 * quando o número seria pequeno demais para significar algo.
 */
export function equivalenciaMetrica(ing, qtd = ing?.qtd) {
  if (!ing || qtd == null || metrica(ing.un)) return null;

  const fam = familia(ing.un);
  let saida = null;

  if (fam === "volume") {
    saida = ing.liquido
      ? { qtd: converter(qtd, ing.un, "ml"), un: "ml" }
      : (ing.densidade ? { qtd: converter(qtd, ing.un, "g", ing.densidade), un: "g" } : null);
  } else if (fam === "peso") {
    saida = { qtd: converter(qtd, ing.un, "g"), un: "g" };
  } else {
    const porUnidade = ing.pesoPorUnidade?.[ing.un];
    if (porUnidade != null) saida = { qtd: qtd * porUnidade, un: "g" };
  }

  if (!saida || !Number.isFinite(saida.qtd) || saida.qtd < MINIMO_UTIL) return null;
  return { qtd: arredondarEquivalencia(saida.qtd, saida.un), un: saida.un };
}
