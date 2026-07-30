/* Estimativa de nutrientes de uma receita.
 *
 * Tudo se resolve em gramas: o catálogo informa nutrientes por 100 g, então o
 * único trabalho é descobrir quantos gramas de cada ingrediente a receita usa.
 *
 * Três caminhos para chegar ao peso:
 *   unidade de peso   direto (300 g, 1 kg)
 *   unidade de volume via densidade do ingrediente (2 copos de açúcar)
 *   unidade contável  via pesoPorUnidade (3 ovos = 150 g)
 *
 * Quando nenhum serve, o ingrediente fica FORA da conta e é relatado — a tela
 * mostra o que ficou de fora em vez de fingir que a estimativa é completa.
 *
 * Nota sobre porções: o valor por porção não muda com o seletor. Escalar
 * multiplica todos os ingredientes e o número de porções pelo mesmo fator, e a
 * divisão cancela. Por isso a conta é feita sempre no padrão da receita.
 */

import { CAMPOS_NUTRIENTES } from "../data/ingredientes.js";
import { emGramas } from "./units.js";

const zerado = () => Object.fromEntries(CAMPOS_NUTRIENTES.map(c => [c, 0]));

/** Peso em gramas de um ingrediente já resolvido, ou null se não der. */
export function gramasDe(ing) {
  if (ing.escala === false) return null;   // "a gosto" não tem peso
  return emGramas(ing.qtd, ing.un, ing);
}

/**
 * Nutrientes de um ingrediente, na quantidade que a receita pede.
 * Devolve null quando falta peso ou faltam dados do ingrediente.
 */
export function nutrientesDe(ing) {
  if (!ing.nutrientes) return null;

  const g = gramasDe(ing);
  if (g == null) return null;

  const fator = g / 100;
  return Object.fromEntries(
    CAMPOS_NUTRIENTES.map(c => [c, (ing.nutrientes[c] ?? 0) * fator])
  );
}

/**
 * Estimativa da receita.
 *
 * Devolve:
 *   porPorcao   { kcal, proteina, carboidrato, gordura, fibra, sodio }
 *   total       o mesmo, para a receita inteira
 *   pesoTotal   gramas contabilizados
 *   contados    quantos ingredientes entraram
 *   deFora      [{ nome, motivo }] — o que não entrou e por quê
 *   completa    true quando nada relevante ficou de fora
 */
export function estimarNutrientes(receita) {
  const total = zerado();
  const deFora = [];
  let contados = 0;
  let pesoTotal = 0;

  for (const ing of receita.ingredientes) {
    if (ing.subtitulo) continue;

    // Sem dado nutricional por decisão do catálogo: louro sai da panela,
    // forminha não é comida. Não é lacuna, não se relata.
    if (!ing.nutrientes) continue;

    if (ing.escala === false || ing.qtd == null) {
      deFora.push({ nome: ing.nome, motivo: "quantidade a gosto" });
      continue;
    }

    const parte = nutrientesDe(ing);
    if (!parte) {
      deFora.push({ nome: ing.nome, motivo: `não dá para pesar ${ing.un}` });
      continue;
    }

    for (const c of CAMPOS_NUTRIENTES) total[c] += parte[c];
    pesoTotal += gramasDe(ing);
    contados++;
  }

  const porcoes = receita.porcoes.padrao;
  const porPorcao = Object.fromEntries(
    CAMPOS_NUTRIENTES.map(c => [c, total[c] / porcoes])
  );

  return {
    porPorcao, total, pesoTotal, contados,
    deFora,
    completa: deFora.length === 0
  };
}

/* ------------------------------------------------------- detalhe: energia */

/** Quantas calorias rende 1 g de cada macronutriente. */
export const KCAL_POR_GRAMA = { proteina: 4, carboidrato: 4, gordura: 9 };

/**
 * Valores diários de referência, para uma dieta de 2 000 kcal.
 * Base: rotulagem nutricional brasileira (ANVISA). São referências de
 * população adulta — não uma necessidade individual, e o leitor pode trocar
 * pelos dele nas preferências.
 */
export const VALORES_DIARIOS = {
  kcal: { valor: 2000, un: "kcal" },
  fibra: { valor: 25, un: "g" },
  sodio: { valor: 2400, un: "mg" }
};

/** Metas de distribuição calórica adotadas como ponto de partida (ANVISA). */
export const METAS_MACROS = { proteina: 15, carboidrato: 60, gordura: 25 };

export const BASE_DIARIA_KCAL = VALORES_DIARIOS.kcal.valor;

/** Mistura as preferências do leitor sobre os valores de referência. */
export function valoresDiarios(prefs) {
  return Object.fromEntries(
    Object.entries(VALORES_DIARIOS).map(([campo, ref]) => [
      campo,
      { valor: prefs?.diario?.[campo] ?? ref.valor, un: ref.un }
    ])
  );
}

/** Metas de macro do leitor, ou as de referência. */
export const metasMacros = prefs => ({ ...METAS_MACROS, ...(prefs?.macros ?? {}) });

/** True quando o leitor mexeu em algum valor diário ou meta de macro. */
export function referenciasPersonalizadas(prefs) {
  if (!prefs) return false;
  const diario = valoresDiarios(prefs);
  const metas = metasMacros(prefs);
  return Object.keys(VALORES_DIARIOS).some(c => diario[c].valor !== VALORES_DIARIOS[c].valor)
    || Object.keys(METAS_MACROS).some(c => metas[c] !== METAS_MACROS[c]);
}

/**
 * Arredonda uma lista de porcentagens para inteiros que ainda somam 100.
 * Arredondar cada uma por conta própria daria 99% ou 101% na tela.
 */
function arredondarSomando100(valores) {
  const pisos = valores.map(v => Math.floor(v));
  const falta = Math.round(valores.reduce((s, v) => s + v, 0)) - pisos.reduce((s, v) => s + v, 0);

  // Quem tem a maior parte fracionária leva os pontos que faltam
  const ordem = valores
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((a, b) => b.resto - a.resto);

  const saida = [...pisos];
  for (let n = 0; n < falta; n++) saida[ordem[n % ordem.length].i] += 1;
  return saida;
}

/**
 * Quanto cada macro contribui para as calorias da porção.
 * As porcentagens são sobre a energia vinda dos macros (4/4/9), então somam
 * exatamente 100% — é uma distribuição, não uma comparação com a tabela.
 *
 * Com `prefs`, cada item traz também a meta do leitor e a diferença.
 */
export function distribuicaoCalorica(porPorcao, prefs) {
  const campos = Object.keys(KCAL_POR_GRAMA);
  const kcal = campos.map(c => (porPorcao[c] ?? 0) * KCAL_POR_GRAMA[c]);
  const soma = kcal.reduce((s, v) => s + v, 0);

  const pcts = soma > 0 ? kcal.map(v => (v / soma) * 100) : campos.map(() => 0);
  const arredondados = arredondarSomando100(pcts);
  const metas = metasMacros(prefs);

  return {
    kcalDosMacros: soma,
    metas,
    itens: campos.map((campo, i) => ({
      campo,
      gramas: porPorcao[campo] ?? 0,
      kcal: kcal[i],
      pct: pcts[i],
      pctArredondado: arredondados[i],
      meta: metas[campo],
      diferenca: arredondados[i] - metas[campo]
    }))
  };
}

/**
 * Meta diária de um macro, em gramas.
 *
 * Sai do consumo diário de calorias e da distribuição escolhida: 2 000 kcal com
 * 15% de proteína dão 300 kcal, que a 4 kcal/g são 75 g. Não é um número extra
 * para o leitor informar — é consequência dos dois que ele já informou.
 */
export function metaEmGramas(campo, prefs) {
  const kcalPorGrama = KCAL_POR_GRAMA[campo];
  if (!kcalPorGrama) return null;

  const pct = metasMacros(prefs)[campo];
  if (!pct) return null;

  return (valoresDiarios(prefs).kcal.valor * pct / 100) / kcalPorGrama;
}

/**
 * O caminho de volta: quantos por cento das calorias do dia são `gramas` deste
 * macro. É o inverso exato de `metaEmGramas` — usado quando o leitor digita a
 * meta em gramas em vez de arrastar a porcentagem.
 */
export function pctDeGramas(campo, gramas, prefs) {
  const kcalPorGrama = KCAL_POR_GRAMA[campo];
  if (!kcalPorGrama) return null;

  const kcalDia = valoresDiarios(prefs).kcal.valor;
  if (!kcalDia) return null;

  return (gramas * kcalPorGrama / kcalDia) * 100;
}

/** Referência diária de qualquer nutriente: informada ou derivada dos macros. */
export function referenciaDiaria(campo, prefs) {
  const direta = valoresDiarios(prefs)[campo];
  if (direta) return direta;

  const gramas = metaEmGramas(campo, prefs);
  return gramas == null ? null : { valor: gramas, un: "g", derivada: true };
}

/**
 * Percentual do valor diário, ou null se o nutriente não tiver referência.
 * `prefs` permite usar o consumo diário do leitor em vez do de rotulagem.
 */
export function percentualDiario(campo, valor, prefs) {
  const ref = referenciaDiaria(campo, prefs);
  return ref ? (valor / ref.valor) * 100 : null;
}

/**
 * Quanto uma porção representa do dia, nutriente por nutriente.
 * É a leitura que a barra mostra: 79% da proteína do dia, 29% do carboidrato.
 */
export function impactoDiario(porPorcao, prefs) {
  return ORDEM
    .map(campo => {
      const referencia = referenciaDiaria(campo, prefs);
      if (!referencia) return null;
      return {
        campo,
        valor: porPorcao[campo],
        referencia,
        pct: (porPorcao[campo] / referencia.valor) * 100
      };
    })
    .filter(Boolean);
}

/** Tudo que a janela de detalhes precisa. */
export function detalhesNutricionais(receita, prefs) {
  const e = estimarNutrientes(receita);

  return {
    ...e,
    // Barras: o quanto da porção pesa no dia
    impacto: impactoDiario(e.porPorcao, prefs),
    // Rosca: como a energia da própria receita se reparte
    distribuicao: distribuicaoCalorica(e.porPorcao, prefs),
    personalizado: referenciasPersonalizadas(prefs)
  };
}

/* ------------------------------------------------------------ apresentação */

export const ROTULOS = {
  kcal: "Calorias",
  proteina: "Proteínas",
  carboidrato: "Carboidratos",
  gordura: "Gorduras",
  fibra: "Fibras",
  sodio: "Sódio"
};

/** Ordem em que aparecem na tela. */
export const ORDEM = ["kcal", "proteina", "carboidrato", "gordura", "fibra", "sodio"];

/**
 * Número + unidade de um nutriente, arredondado para o que faz sentido ler.
 * Caloria em inteiro; macro com uma decimal abaixo de 10 g; sódio em mg.
 */
export function formatarNutriente(campo, valor) {
  if (campo === "kcal") return { valor: String(Math.round(valor)), un: "kcal" };
  if (campo === "sodio") return { valor: String(Math.round(valor)), un: "mg" };

  const casas = valor < 10 ? 1 : 0;
  return { valor: valor.toLocaleString("pt-BR", { maximumFractionDigits: casas }), un: "g" };
}
