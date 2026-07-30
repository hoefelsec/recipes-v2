/* Comparativo de mercado: a tabela do passo "Escolher mercado".
 *
 * Uma linha por ingrediente da compra (já somado entre as receitas), uma coluna
 * por mercado. Em cada célula, o custo mais barato para atender a necessidade
 * daquele ingrediente NAQUELE mercado — e "mais barato" é por embalagem inteira,
 * não por preço de gôndola: precisar de 800 g e comprar 2 × 500 g pode sair mais
 * caro do que 1 × 1 kg, mesmo o quilo do primeiro sendo mais barato.
 *
 * A necessidade e o produto escolhido não dependem do mercado — vêm das receitas e
 * das escolhas do leitor —, então são medidos uma vez (com `mercado = null`). Só o
 * preço muda de coluna para coluna.
 */

import { mercados } from "../data/mercados.js";
import { produtosDe } from "../data/produtos.js";
import { itensDaCompra, embalagensPara } from "./purchase.js";
import { carregarTenho, carregarAtribuicoes } from "./choices.js";

/**
 * Entre os produtos dados, o mais barato para cobrir `precisa` em embalagens
 * inteiras. Devolve `{ produto, embalagens, custoCompra, ... }` ou null.
 */
function maisBaratoPorEmbalagem(produtos, ing, precisa) {
  let melhor = null;
  for (const p of produtos) {
    const e = embalagensPara(p, ing, precisa);
    if (!e) continue;
    if (!melhor || e.custoCompra < melhor.custoCompra) melhor = { produto: p, ...e };
  }
  return melhor;
}

/**
 * A célula de um ingrediente num mercado.
 *
 * Com produto escolhido: o preço DAQUELE produto ali. Se o mercado não o vende mas
 * vende outro que serve, é amarelo (mostra o mais barato que serve). Se não vende
 * nada que sirva, é vermelho.
 *
 * Sem escolha (genérico): o mais barato por embalagem entre os que o mercado vende;
 * vermelho se ele não vende nenhum.
 *
 * `estado`: "" normal, "alerta" amarelo, "errada" vermelho.
 */
function celula(linha, mercadoId) {
  const { ing, precisa, escolhidoId } = linha;
  const disponiveis = produtosDe(ing.id, mercadoId);

  if (escolhidoId) {
    const escolhido = disponiveis.find(p => p.id === escolhidoId);
    if (escolhido) {
      const e = embalagensPara(escolhido, ing, precisa);
      if (e) return { estado: "", valor: e.custoCompra, produto: escolhido, embalagens: e.embalagens };
      return { estado: "errada", valor: null, motivo: "a embalagem não se converte" };
    }
    if (!disponiveis.length) {
      return { estado: "errada", valor: null, motivo: "não vende nenhum produto para este ingrediente" };
    }
    const alt = maisBaratoPorEmbalagem(disponiveis, ing, precisa);
    return alt
      ? { estado: "alerta", valor: alt.custoCompra, produto: alt.produto, embalagens: alt.embalagens,
          motivo: "não vende o produto escolhido — preço de outro que serve" }
      : { estado: "alerta", valor: null, motivo: "não vende o produto escolhido" };
  }

  if (!disponiveis.length) {
    return { estado: "errada", valor: null, motivo: "não vende nenhum produto para este ingrediente" };
  }
  const melhor = maisBaratoPorEmbalagem(disponiveis, ing, precisa);
  return melhor
    ? { estado: "", valor: melhor.custoCompra, produto: melhor.produto, embalagens: melhor.embalagens }
    : { estado: "errada", valor: null, motivo: "a embalagem não se converte" };
}

/**
 * O comparativo inteiro.
 *
 * Devolve { mercados, linhas, matriz, totais, melhor, deFora }, onde:
 *   mercados  a lista de mercados (colunas)
 *   linhas    [{ ing, precisa, chave, escolhidoId, escolhidoNome }]
 *   matriz    Map(chave -> Map(mercadoId -> célula))
 *   totais    Map(mercadoId -> { valor, faltas, temValor })
 *   melhor    id do mercado mais barato que atende TUDO (sem vermelho), ou null
 */
export function comparativoDeMercado(itens, escolhas = {}) {
  const listaMercados = mercados();

  // Necessidade + produto escolhido por linha, sem filtrar por mercado
  const { linhas: linhasCompra, deFora } = itensDaCompra(itens, escolhas, null);
  const tenho = carregarTenho();
  const atribuicoes = carregarAtribuicoes();

  const linhas = linhasCompra.map(l => ({
    ing: l.ing,
    precisa: l.precisa,
    chave: l.chave,
    // Marcado como já disponível em casa: fora da compra
    tenho: tenho.has(l.chave),
    // Mercado ao qual o item foi atribuído para compra, ou null
    atribuido: atribuicoes[l.chave] ?? null,
    // origem "automatico" = o site escolheu; qualquer outra = o leitor escolheu
    escolhidoId: l.origem === "automatico" ? null : (l.produto?.id ?? null),
    escolhidoNome: l.origem === "automatico" || !l.produto
      ? null
      : `${l.produto.nome}${l.produto.marca ? ` · ${l.produto.marca}` : ""}`
  }));

  // Uma célula por (linha, mercado), para TODAS as linhas — serve à tabela
  // principal e às listas por mercado
  const matriz = new Map();
  for (const l of linhas) {
    const celulas = new Map();
    for (const m of listaMercados) celulas.set(m.id, celula(l, m.id));
    matriz.set(l.chave, celulas);
  }

  // A tabela principal mostra só o que falta colocar: nem "tenho", nem atribuído
  const pendentes = linhas.filter(l => !l.tenho && !l.atribuido);

  // Totais da tabela principal: somam os pendentes
  const totais = new Map();
  for (const m of listaMercados) totais.set(m.id, { valor: 0, faltas: 0, temValor: false });
  for (const l of pendentes) {
    for (const m of listaMercados) {
      const c = matriz.get(l.chave).get(m.id);
      const t = totais.get(m.id);
      if (c.valor != null) { t.valor += c.valor; t.temValor = true; }
      if (c.estado === "errada") t.faltas++;
    }
  }

  let melhor = null;
  for (const m of listaMercados) {
    const t = totais.get(m.id);
    if (t.faltas === 0 && t.temValor && (!melhor || t.valor < totais.get(melhor).valor)) {
      melhor = m.id;
    }
  }

  // Listas por mercado: o que foi atribuído a cada um, com a célula daquele mercado
  const porMercado = new Map();
  const totaisMercado = new Map();
  for (const m of listaMercados) { porMercado.set(m.id, []); totaisMercado.set(m.id, 0); }
  for (const l of linhas) {
    if (!l.atribuido || !porMercado.has(l.atribuido)) continue;
    const cell = matriz.get(l.chave).get(l.atribuido);
    porMercado.get(l.atribuido).push({ linha: l, cell });
    totaisMercado.set(l.atribuido, totaisMercado.get(l.atribuido) + (cell.valor ?? 0));
  }

  // Só se pode avançar quando toda linha está resolvida: em casa ou num mercado
  const todasColocadas = linhas.every(l => l.tenho || l.atribuido);

  return {
    mercados: listaMercados, linhas, matriz,
    pendentes, totais, melhor,
    porMercado, totaisMercado, todasColocadas,
    deFora
  };
}
