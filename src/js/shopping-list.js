/* Lista de compras: junta os ingredientes de todas as receitas do carrinho.

   O mesmo ingrediente aparecendo em receitas diferentes vira uma linha só, mesmo
   quando as receitas o escrevem em unidades diferentes — 1 kg de feijão numa e
   300 g em outra dão 1,3 kg. A soma é feita na base da família (ml ou g) e só
   depois se escolhe a unidade de exibição.

   O que não pode ser somado com honestidade não é somado: "a gosto" fica como
   "a gosto", e unidades sem família (dente, lata, un.) só se somam entre iguais.

   O que se assume ter em casa (`emCasa` no catálogo: sal, água) não entra na
   lista — não é compra. */

import { normalizar } from "./dom.js";
import { produtosDe } from "../data/produtos.js";
import { temEmCasa, grupoDeLinhagem, ingrediente } from "../data/ingredientes.js";
import {
  UNIDADES, familia, arredondar, quantidadeEmTexto, conversaoUtil, converter, densidadeDe
} from "./units.js";

const BASE = { volume: "ml", peso: "g" };
/* Só o volume tem um múltiplo que é unidade de verdade (o litro).
   No peso, o kg é promoção de escrita e sai automático no `quantidadeEmTexto`. */
const GRANDE = { volume: "L" };

/* Agrupa pela chave do ingrediente, não pelo texto: "açúcar refinado" da massa e
   "açúcar" da cobertura são o mesmo `acucar` e caem na mesma linha sem precisar
   de apelido. Sem chave (dado antigo), cai no nome normalizado. */
const chaveDeGrupo = ing => ing.id ?? normalizar(ing.item);

/**
 * Em que família o ingrediente é vendido, segundo a tabela de produtos.
 * Farinha vem em kg (peso), óleo em ml (volume) — e a lista tem de falar a
 * língua da prateleira.
 */
function familiaDeCompra(id) {
  for (const p of produtosDe(id)) {
    const f = familia(p.un) ?? (p.conteudo ? familia(p.conteudo.un) : null);
    if (f) return f;
  }
  return null;
}

/**
 * Escolhe em que unidade mostrar o total.
 *
 * Lista de compras não é receita: no mercado se compra por peso e volume, não em
 * copos. Então a régua é métrica — e a família é a da embalagem, não a da
 * receita: manteiga se compra em gramas, leite em litros, mesmo que as duas
 * apareçam medidas em colheres.
 *
 * Ordem: preferência do leitor; a família em que se compra; kg/L em totais
 * grandes; a base da família da receita.
 */
function unidadeDeExibicao(totalBase, fam, densidade, prefs, id) {
  const base = BASE[fam];
  const outra = fam === "volume" ? "peso" : "volume";

  /* 1. O que o leitor pediu nas preferências, se der. */
  const preferidas = [prefs?.[fam]];
  if (densidade) preferidas.push(prefs?.[outra]);

  for (const alvo of preferidas) {
    if (!alvo || alvo === "receita") continue;
    if (alvo === base || conversaoUtil(totalBase, base, alvo, densidade)) return alvo;
  }

  /* 2. A família da prateleira, quando difere da da receita.
     Aqui não vale o limite de 4% de `conversaoUtil`: aquele limite protege as
     equivalências que o site *afirma* na troca de medida. Escolher a unidade de
     uma lista de compras é outra coisa — 25 g ou 27 g de fermento dá na mesma
     quando se compra a lata de 100 g, e o arredondamento já está avisado no pé
     da lista. */
  const compra = familiaDeCompra(id);
  if (densidade && compra && compra !== fam) {
    const convertido = compra === "peso" ? totalBase * densidade : totalBase / densidade;
    const alvo = (GRANDE[compra] && convertido >= 1000) ? GRANDE[compra] : BASE[compra];
    if (convertido >= (UNIDADES[alvo].minConversao ?? UNIDADES[alvo].min)) return alvo;
  }

  /* 3. Litro em totais grandes, senão a base da própria família. O grama vira
        kg sozinho na hora de escrever, então não precisa de decisão aqui. */
  if (GRANDE[fam] && totalBase >= 1000 && conversaoUtil(totalBase, base, GRANDE[fam], densidade)) {
    return GRANDE[fam];
  }
  return base;
}

/**
 * Monta a lista a partir das linhas do carrinho.
 * `itens`: [{ receita, porcoes, qtd }]
 * Devolve [{ id, nome, quantidade, receitas, exato }] em ordem alfabética.
 *
 * O `id` é a chave do ingrediente, e serve para casar cada linha com a compra
 * (`purchase.js`), que sabe qual produto e quantas embalagens. As duas contas são
 * perguntas diferentes — "quanto preciso" e "o que levo" — e é por isso que cada
 * uma tem seu módulo.
 */
export function montarLista(itens, prefs = {}) {
  const grupos = new Map();

  /* "Açúcar" de uma receita e "açúcar refinado" de outra são a mesma compra:
     juntam-se sob o pedido mais específico. Ver `grupoDeLinhagem`. */
  const linhagens = grupoDeLinhagem(
    itens.flatMap(({ receita }) => receita.ingredientes.filter(i => i.id).map(i => i.id))
  );

  for (const { receita, porcoes, qtd } of itens) {
    const mult = (porcoes / receita.porcoes.padrao) * qtd;

    for (const ing of receita.ingredientes) {
      if (ing.subtitulo) continue;

      // Sal e água se assume que já estão em casa. Ninguém sai para comprar água
      // porque a receita pede água, e a linha só ocuparia espaço na lista.
      if (temEmCasa(ing)) continue;

      const chave = linhagens[ing.id] ?? chaveDeGrupo(ing);
      const nomeDoGrupo = ingrediente(chave) ?? null;
      const fam = ing.qtd == null || ing.escala === false ? null : familia(ing.un);

      // Chave: por família quando há uma; senão, por unidade exata
      const tipo = ing.qtd == null || ing.escala === false ? "gosto" : (fam ?? `un:${ing.un}`);
      const k = `${chave}|${tipo}`;

      if (!grupos.has(k)) {
        grupos.set(k, {
          /* Na lista vai o nome do catálogo, sem o preparo da receita: compra-se
             "cebola", não "cebolas picadas". Sendo grupo de linhagem, vale o nome
             do pedido mais específico — é o que se procura na prateleira. */
          nome: nomeDoGrupo?.plural ?? nomeDoGrupo?.nome ?? ing.nomePlural ?? ing.item,
          itemSingular: nomeDoGrupo?.nome ?? ing.nome ?? ing.itemSingular,
          id: chave, familia: fam, tipo,
          totalBase: 0, valor: 0, un: ing.un,
          unidadesUsadas: new Set(), receitas: new Set(), exato: true
        });
      }
      const g = grupos.get(k);
      g.receitas.add(receita.nome);

      if (tipo === "gosto") continue;

      if (fam) {
        g.totalBase += ing.qtd * mult * UNIDADES[ing.un].base;
        g.unidadesUsadas.add(ing.un);
        // A densidade permite cruzar famílias no ingrediente, mas na soma da
        // lista mantemos a família em que a receita escreveu — sem inventar.
        if (densidadeDe(ing)) g.densidade = densidadeDe(ing);
      } else {
        g.valor += ing.qtd * mult;
      }
    }
  }

  /* O mesmo ingrediente pode cair num grupo "a gosto" e num grupo com
     quantidade — sal de feijoada e pitada de sal do bolo. Não dá para somar os
     dois, e duas linhas de "sal" na lista só confundem: quem já vai comprar
     300 g de sal não precisa da linha "a gosto". */
  const comQuantidade = new Set(
    [...grupos.values()].filter(g => g.tipo !== "gosto").map(g => g.id)
  );

  const linhas = [...grupos.values()]
    .filter(g => g.tipo !== "gosto" || !comQuantidade.has(g.id))
    .map(g => {
    if (g.tipo === "gosto") {
      return { id: g.id, nome: g.nome, quantidade: "a gosto", receitas: [...g.receitas], exato: true };
    }

    if (!g.familia) {
      const v = arredondar(g.valor, g.un);
      return {
        id: g.id,
        nome: v <= 1 && g.itemSingular ? g.itemSingular : g.nome,
        quantidade: quantidadeEmTexto(v, g.un),
        receitas: [...g.receitas],
        exato: Math.abs(v - g.valor) / g.valor <= 0.04
      };
    }

    const base = BASE[g.familia];
    const un = unidadeDeExibicao(g.totalBase, g.familia, g.densidade, prefs, g.id);
    const bruto = converter(g.totalBase, base, un, g.densidade);
    const v = arredondar(bruto, un);

    return {
      id: g.id,
      nome: g.nome,
      quantidade: quantidadeEmTexto(v, un),
      receitas: [...g.receitas],
      exato: Math.abs(v - bruto) / bruto <= 0.04
    };
  });

  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Resumo do que foi somado, para o cabeçalho da lista impressa. */
export function resumo(itens) {
  const receitas = itens.map(({ receita, porcoes, qtd }) => ({
    nome: receita.nome,
    porcoes,
    unidade: porcoes === 1 && receita.porcoes.unidadeSingular
      ? receita.porcoes.unidadeSingular
      : receita.porcoes.unidade,
    qtd
  }));

  return {
    receitas,
    pratos: itens.reduce((s, i) => s + i.qtd, 0)
  };
}
