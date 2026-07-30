/* Carrinho de receitas.

   Uma linha do carrinho é a combinação receita + número de porções. Adicionar a
   mesma receita com as mesmas porções aumenta a quantidade daquela linha;
   com porções diferentes, cria outra linha — são coisas diferentes de fato
   (uma feijoada para 8 e outra para 20 não é o mesmo pedido). */

import { porSlug } from "../data/index.js";
import { normalizarPorcoes } from "./scaling.js";

const CHAVE = "receitas:carrinho";
const QTD_MAX = 20;

let itens = [];
const ouvintes = new Set();

export const chaveDe = (slug, porcoes) => `${slug}@${porcoes}`;

/* ------------------------------------------------------------ persistência */

/** Descarta o que não faz sentido e junta linhas repetidas. */
function sanear(bruto) {
  const mapa = new Map();

  for (const item of Array.isArray(bruto) ? bruto : []) {
    const receita = porSlug(item?.slug);
    if (!receita) continue;   // receita removida do site desde a última visita

    const porcoes = normalizarPorcoes(receita, item.porcoes);
    const qtd = Math.min(QTD_MAX, Math.max(1, Math.round(Number(item.qtd) || 1)));
    const k = chaveDe(receita.slug, porcoes);

    const existente = mapa.get(k);
    if (existente) existente.qtd = Math.min(QTD_MAX, existente.qtd + qtd);
    else mapa.set(k, { slug: receita.slug, porcoes, qtd });
  }

  return [...mapa.values()];
}

function carregar() {
  try {
    return sanear(JSON.parse(localStorage.getItem(CHAVE) || "[]"));
  } catch {
    return [];
  }
}

function gravar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(itens));
  } catch {
    /* modo privado pode bloquear a escrita — o carrinho segue válido na sessão */
  }
}

function mudou() {
  gravar();
  for (const fn of ouvintes) fn(ler());
}

itens = carregar();

/* -------------------------------------------------------------------- leitura */

/** Cópia das linhas, na ordem em que foram adicionadas. */
export const ler = () => itens.map(i => ({ ...i, chave: chaveDe(i.slug, i.porcoes) }));

/** Linhas já com a receita resolvida — o que as telas costumam querer. */
export function lerComReceitas() {
  return ler()
    .map(i => ({ ...i, receita: porSlug(i.slug) }))
    .filter(i => i.receita);
}

/** Total de itens (somando quantidades), para o badge do carrinho. */
export const total = () => itens.reduce((s, i) => s + i.qtd, 0);

export const vazio = () => itens.length === 0;

export function inscrever(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/* -------------------------------------------------------------------- escrita */

export function adicionar(slug, porcoes, qtd = 1) {
  const receita = porSlug(slug);
  if (!receita) return null;

  const p = normalizarPorcoes(receita, porcoes);
  const linha = itens.find(i => i.slug === slug && i.porcoes === p);

  if (linha) linha.qtd = Math.min(QTD_MAX, linha.qtd + qtd);
  else itens.push({ slug, porcoes: p, qtd: Math.min(QTD_MAX, Math.max(1, qtd)) });

  mudou();
  return chaveDe(slug, p);
}

export function definirQtd(slug, porcoes, qtd) {
  const i = itens.findIndex(x => x.slug === slug && x.porcoes === porcoes);
  if (i === -1) return;

  const n = Math.round(Number(qtd) || 0);
  if (n <= 0) itens.splice(i, 1);
  else itens[i].qtd = Math.min(QTD_MAX, n);

  mudou();
}

/**
 * Muda as porções de uma linha. Se já existir outra linha com as porções novas,
 * as duas se juntam — senão o carrinho ficaria com duas linhas idênticas.
 */
export function definirPorcoes(slug, porcoesAntigas, porcoesNovas) {
  const receita = porSlug(slug);
  if (!receita) return null;

  const nova = normalizarPorcoes(receita, porcoesNovas);
  const linha = itens.find(i => i.slug === slug && i.porcoes === porcoesAntigas);
  if (!linha || nova === porcoesAntigas) return linha ? chaveDe(slug, nova) : null;

  const destino = itens.find(i => i.slug === slug && i.porcoes === nova);

  if (destino) {
    destino.qtd = Math.min(QTD_MAX, destino.qtd + linha.qtd);
    itens = itens.filter(i => i !== linha);
  } else {
    linha.porcoes = nova;
  }

  mudou();
  return chaveDe(slug, nova);
}

export function remover(slug, porcoes) {
  itens = itens.filter(i => !(i.slug === slug && i.porcoes === porcoes));
  mudou();
}

export function limpar() {
  itens = [];
  mudou();
}
