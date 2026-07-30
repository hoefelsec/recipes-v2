/* Junta a linha da receita com o catálogo de ingredientes.
 *
 * A linha diz "quanto" e "como preparar"; o catálogo diz "o quê". O resultado é
 * um objeto achatado com tudo que as telas precisam — quem consome ingredientes
 * não sabe que existem duas fontes.
 *
 * Linha:      { ing: "cebola", qtd: 2, un: "un.", detalhe: { um: "picada", muitos: "picadas" } }
 * Resolvido:  { id: "cebola", qtd: 2, un: "un.", item: "cebolas picadas",
 *               itemSingular: "cebola picada", nome: "cebola", nomePlural: "cebolas", … }
 */

import { INGREDIENTES, naSubarvore } from "./ingredientes.js";
import { produto as doCatalogo } from "./produtos.js";

/** Referências quebradas encontradas na carga — os testes conferem que está vazio. */
export const problemas = [];

/** "cebolas" + "picadas" -> "cebolas picadas" */
const juntar = (nome, detalhe) => (detalhe ? `${nome} ${detalhe}` : nome);

const formaDoDetalhe = (detalhe, plural) => {
  if (!detalhe) return null;
  if (typeof detalhe === "string") return detalhe;
  return plural ? detalhe.muitos : detalhe.um;
};

export function resolverLinha(linha, contexto = "") {
  if (linha.subtitulo) return { subtitulo: linha.subtitulo };

  const base = INGREDIENTES[linha.ing];

  if (!base) {
    // Não derruba a página por um erro de digitação: registra e mostra o problema
    problemas.push(`${contexto}: ingrediente "${linha.ing}" não existe no catálogo`);
    console.error(`Ingrediente desconhecido: "${linha.ing}" (${contexto})`);
    return {
      id: linha.ing, qtd: linha.qtd ?? null, un: linha.un ?? null,
      item: `[?] ${linha.ing}`, nome: `[?] ${linha.ing}`, desconhecido: true
    };
  }

  const nomePlural = base.plural ?? base.nome;

  return {
    id: linha.ing,

    // Quantidade: vem só da linha
    qtd: linha.qtd ?? null,
    un: linha.un ?? null,
    escala: linha.escala,
    texto: linha.texto,

    // Nome exibido na receita: catálogo + preparo daquela receita
    item: juntar(nomePlural, formaDoDetalhe(linha.detalhe, true)),
    itemSingular: juntar(base.nome, formaDoDetalhe(linha.detalhe, false)),

    /* O preparo separado do nome. Junto, é o que a linha mostra; separado, é o
       que sobra quando o nome dá lugar ao do produto escolhido. */
    detalhe: formaDoDetalhe(linha.detalhe, true),
    detalheSingular: formaDoDetalhe(linha.detalhe, false),

    // Nome do catálogo, sem preparo: é o que serve para comprar
    nome: base.nome,
    nomePlural,

    // Propriedades do ingrediente
    densidade: base.densidade,
    liquido: base.liquido === true,
    pesoPorUnidade: base.pesoPorUnidade ?? null,
    comestivel: base.comestivel !== false,
    emCasa: base.emCasa === true,
    nutrientes: base.nutrientes ?? null
  };
}

/* ------------------------------------------------- o produto escolhido */

/**
 * Nutrientes do rótulo sobre os da tabela, campo por campo.
 *
 * Rótulo brasileiro pode declarar menos que a tabela de referência — há produto
 * aqui que informa só proteína, carboidrato e gordura. Onde ele fala, vale o que
 * ele diz, porque é o que está na embalagem que a pessoa vai comprar; onde ele
 * cala, fica a tabela, que é melhor do que um buraco.
 *
 * `null` no catálogo é decisão, não lacuna (louro sai da panela): não se
 * preenche com o rótulo.
 */
function nutrientesComRotulo(base, rotulo) {
  if (!base || !rotulo) return { nutrientes: base ?? null, doRotulo: [] };

  const doRotulo = Object.keys(rotulo).filter(c => rotulo[c] != null);
  if (!doRotulo.length) return { nutrientes: base, doRotulo: [] };

  return { nutrientes: { ...base, ...Object.fromEntries(doRotulo.map(c => [c, rotulo[c]])) }, doRotulo };
}

/**
 * Anexa o produto escolhido a um ingrediente já resolvido.
 *
 * Devolve um objeto novo — a receita resolvida na carga não é tocada, porque a
 * escolha é do leitor e vive no navegador dele, não nos dados do site.
 */
export function comProduto(ing, produtoId, mercado = null) {
  /* `produto()` e não `PRODUTOS[…]`: é a leitura que traz o preço e o mercado
     junto, e o preço não está mais no registro cru. Com mercado ativo, o produto
     vem com `foraDoMercado` quando aquele mercado não o vende — a escolha continua
     de pé, e é a tela que avisa. */
  const p = produtoId ? doCatalogo(produtoId, mercado) : null;

  /* O produto tem de servir ao que a receita pediu, e servir é ser da subárvore:
     um pote de manteiga sem sal atende "manteiga sem sal" e também "manteiga".
     O contrário não — com sal não atende quem pediu sem. */
  if (!p || !naSubarvore(p.ing, ing.id)) return ing;

  const { nutrientes, doRotulo } = nutrientesComRotulo(ing.nutrientes, p.nutrientes);

  return {
    ...ing,
    produto: p,
    nutrientes,
    nutrientesDoRotulo: doRotulo
  };
}

/**
 * A receita com as escolhas do leitor aplicadas.
 * `escolhas` é o mapa `{ ingId: produtoId }` daquela receita.
 */
export function aplicarEscolhas(receita, escolhas = {}, mercado = null) {
  if (!escolhas || !Object.keys(escolhas).length) return receita;

  return {
    ...receita,
    ingredientes: receita.ingredientes.map(ing =>
      ing.subtitulo ? ing : comProduto(ing, escolhas[ing.id], mercado)
    )
  };
}

/** Resolve a lista de ingredientes de uma receita. */
export const resolverIngredientes = (linhas, contexto) =>
  linhas.map(l => resolverLinha(l, contexto));

/** Aplica a resolução a uma receita, devolvendo uma cópia pronta para uso. */
export function resolverReceita(receita) {
  return {
    ...receita,
    ingredientes: resolverIngredientes(receita.ingredientes, receita.slug),
    linhas: receita.ingredientes   // as linhas originais, se alguém precisar
  };
}
