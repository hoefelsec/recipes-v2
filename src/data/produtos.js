/* Produtos — o que se compra na prateleira.
 *
 * Terceira tabela do modelo:
 *
 *   receita  --(ing)-->  ingrediente  <--(ing)--  produto
 *
 * O ingrediente é o conceito ("feijão preto"); o produto é a embalagem concreta
 * ("Feijão Preto São João, 1 kg"). Um ingrediente pode ter vários produtos, e é
 * isso que permite comparar marcas.
 *
 * O PREÇO NÃO ESTÁ AQUI. Ele é do par mercado+produto e vive em `precos.js`: o
 * mesmo pacote custa uma coisa num mercado e outra no da esquina, e nenhuma das
 * duas é "o preço do feijão São João". As funções de leitura abaixo já entregam o
 * produto com `preco` e `mercado` do melhor preço encontrado, para que quem só
 * quer precificar não precise saber que há uma quarta tabela.
 *
 * Campos:
 *   ing         chave no catálogo de ingredientes — sempre a mais específica que
 *               couber: um produto é de "açúcar refinado", não de "açúcar".
 *               Quem pede o pai recebe os produtos de todos os subtipos.
 *   nome        como aparece na embalagem.
 *   marca       opcional; ausente em produto a granel.
 *   qtd · un    o que vem na embalagem. `un` tem de existir em src/js/units.js.
 *   conteudo    opcional. Conteúdo líquido, quando `un` não é uma medida —
 *               uma lata é "1 lata", e o peso de 395 g fica aqui.
 *   nutrientes  opcional, e pode ser parcial: rótulo que só informa proteína,
 *               carboidrato e gordura entra assim mesmo. Por 100 g ou 100 ml.
 *
 * ATENÇÃO: as marcas abaixo são FICTÍCIAS enquanto dados de teste — e os preços,
 * em `precos.js`, também. Não representam produtos reais nem valores de mercado.
 */

import { naSubarvore } from "./ingredientes.js";
import { maisBarato as melhorPreco, preco as precoNoMercado, vendeEm } from "./precos.js";

export const PRODUTOS = {
  /* ---------------------------------------------------------- grãos e pós */

  "feijao-sao-joao-1kg": {
    ing: "feijao-preto", nome: "Feijão Preto São João", marca: "São João",
    qtd: 1000, un: "g",
    // Rótulo parcial de propósito: declara os macros e cala sobre o resto
    nutrientes: { proteina: 21, carboidrato: 61, gordura: 1.5 }
  },
  "feijao-camil-1kg": {
    ing: "feijao-preto", nome: "Feijão Preto Camil", marca: "Camil",
    qtd: 1000, un: "g",
    nutrientes: { kcal: 340, proteina: 21, carboidrato: 62, gordura: 1.5, fibra: 15 }
  },

  "farinha-dona-benta-1kg": {
    ing: "farinha-de-trigo", nome: "Farinha de Trigo Dona Benta", marca: "Dona Benta",
    qtd: 1000, un: "g",
    nutrientes: { kcal: 360, proteina: 10, carboidrato: 75, gordura: 1.5, fibra: 2.5 }
  },

  "acucar-uniao-1kg": {
    ing: "acucar/refinado", nome: "Açúcar Refinado União", marca: "União",
    qtd: 1000, un: "g",
    nutrientes: { kcal: 387, carboidrato: 100 }
  },
  "acucar-guarani-5kg": {
    ing: "acucar/cristal", nome: "Açúcar Cristal Guarani", marca: "Guarani",
    qtd: 5000, un: "g",
    nutrientes: { kcal: 387, carboidrato: 100 }
  },

  "fermento-royal-100g": {
    ing: "fermento-em-po", nome: "Fermento em Pó Royal", marca: "Royal",
    qtd: 100, un: "g"
  },

  "chocolate-po-garoto-200g": {
    ing: "chocolate-em-po/32", nome: "Chocolate em Pó 32% Cacau", marca: "Garoto",
    qtd: 200, un: "g",
    nutrientes: { kcal: 250, proteina: 15, carboidrato: 58, gordura: 12, fibra: 25 }
  },
  "chocolate-po-50-200g": {
    ing: "chocolate-em-po/50", nome: "Chocolate em Pó 50% Cacau", marca: "Dois Frades",
    qtd: 200, un: "g",
    nutrientes: { kcal: 400, proteina: 8, carboidrato: 60, gordura: 15 }
  },
  "granulado-dori-500g": {
    ing: "chocolate-granulado", nome: "Granulado de Chocolate", marca: "Dori",
    qtd: 500, un: "g",
    nutrientes: { kcal: 480, carboidrato: 70, gordura: 20 }
  },

  /* -------------------------------------------------------------- carnes */

  "carne-seca-friboi-500g": {
    ing: "carne-seca", nome: "Carne Seca Dianteiro", marca: "Friboi",
    qtd: 500, un: "g",
    nutrientes: { kcal: 313, proteina: 27, gordura: 22, sodio: 1800 }
  },
  "costelinha-sadia-1kg": {
    ing: "costelinha-de-porco", nome: "Costelinha de Porco", marca: "Sadia",
    qtd: 1000, un: "g",
    nutrientes: { kcal: 277, proteina: 18, gordura: 22 }
  },
  "paio-perdigao-400g": {
    ing: "paio", nome: "Paio Defumado", marca: "Perdigão",
    qtd: 400, un: "g",
    nutrientes: { kcal: 330, proteina: 15, gordura: 29, sodio: 1200 }
  },
  "calabresa-seara-400g": {
    ing: "linguica-calabresa", nome: "Linguiça Calabresa Defumada", marca: "Seara",
    qtd: 400, un: "g",
    nutrientes: { kcal: 296, proteina: 15, gordura: 25, sodio: 1200 }
  },
  "bacon-seara-500g": {
    ing: "bacon", nome: "Bacon em Cubos", marca: "Seara",
    qtd: 500, un: "g",
    nutrientes: { kcal: 541, proteina: 37, gordura: 42, sodio: 1700 }
  },

  /* ------------------------------------------------------------- frescos */

  "cebola-granel-1kg": {
    ing: "cebola", nome: "Cebola branca a granel",
    qtd: 1000, un: "g"
  },
  "alho-cabeca-200g": {
    ing: "alho", nome: "Alho em cabeça",
    qtd: 200, un: "g"
  },
  "cenoura-granel-1kg": {
    ing: "cenoura", nome: "Cenoura a granel",
    qtd: 1000, un: "g",
    nutrientes: { kcal: 41, carboidrato: 9.6, fibra: 2.8 }
  },
  "laranja-pera-1kg": {
    ing: "laranja", nome: "Laranja pera a granel",
    qtd: 1000, un: "g"
  },
  "ovos-brancos-12un": {
    ing: "ovo", nome: "Ovos brancos grandes", marca: "Katayama",
    qtd: 12, un: "un.",
    nutrientes: { kcal: 143, proteina: 12.6, gordura: 9.5 }
  },

  /* ------------------------------------------------------ gorduras e leite */

  /* Também para o AMARELO, do outro lado: o ovo branco não é vendido no Asun, e
     sem um segundo produto o Asun ficava vermelho em vez de amarelo. Mais caro de
     propósito — assim o mais barato entre todos os mercados não muda. */
  "ovos-caipira-10un": {
    ing: "ovo", nome: "Ovos caipiras", marca: "Granja Faria",
    qtd: 10, un: "un.",
    nutrientes: { kcal: 152, proteina: 13, carboidrato: 0.7, gordura: 11 }
  },
  "manteiga-aviacao-200g": {
    ing: "manteiga/com-sal", nome: "Manteiga com Sal", marca: "Aviação",
    qtd: 200, un: "g",
    nutrientes: { kcal: 717, proteina: 0.9, gordura: 81, sodio: 580 }
  },
  /* Existe para o teste do AMARELO: dá ao Asun uma manteiga sem sal, então quem
     escolheu a President e troca para o Asun vê "não é vendida aqui" em vez de
     "aqui não tem manteiga sem sal". São os dois avisos, e eles se parecem. */
  "manteiga-tirolez-200g": {
    ing: "manteiga/sem-sal", nome: "Manteiga sem Sal Tradicional", marca: "Tirolez",
    qtd: 200, un: "g",
    nutrientes: { kcal: 744, proteina: 0.6, carboidrato: 0.6, gordura: 82, sodio: 8 }
  },
  "manteiga-president-200g": {
    ing: "manteiga/sem-sal", nome: "Manteiga sem Sal", marca: "Président",
    qtd: 200, un: "g",
    nutrientes: { kcal: 717, proteina: 0.9, gordura: 81, sodio: 11 }
  },
  "oleo-liza-900ml": {
    ing: "oleo/girassol", nome: "Óleo de Girassol", marca: "Liza",
    qtd: 900, un: "ml",
    nutrientes: { kcal: 884, gordura: 100 }
  },
  "oleo-soya-900ml": {
    ing: "oleo/soja", nome: "Óleo de Soja", marca: "Soya",
    qtd: 900, un: "ml",
    nutrientes: { kcal: 884, gordura: 100 }
  },
  "leite-italac-1l": {
    ing: "leite/integral", nome: "Leite Integral UHT", marca: "Italac",
    qtd: 1, un: "L",
    nutrientes: { kcal: 61, proteina: 3.2, carboidrato: 4.8, gordura: 3.3 }
  },
  "leite-piracanjuba-1l": {
    ing: "leite/integral", nome: "Leite Integral UHT", marca: "Piracanjuba",
    qtd: 1, un: "L",
    nutrientes: { kcal: 61, proteina: 3.2, carboidrato: 4.8, gordura: 3.3 }
  },
  "leite-desnatado-italac-1l": {
    ing: "leite/desnatado", nome: "Leite Desnatado UHT", marca: "Italac",
    qtd: 1, un: "L",
    nutrientes: { kcal: 35, proteina: 3.4, carboidrato: 5, gordura: 0.2 }
  },
  "leite-condensado-moca-lata": {
    ing: "leite-condensado", nome: "Leite Condensado Moça", marca: "Nestlé",
    qtd: 1, un: "lata",
    conteudo: { qtd: 395, un: "g" },
    nutrientes: { kcal: 321, proteina: 7.9, carboidrato: 54, gordura: 8.7 }
  },

  /* ------------------------------------------------------------- tempero */

  "sal-cisne-1kg": {
    ing: "sal", nome: "Sal Refinado Iodado", marca: "Cisne",
    qtd: 1000, un: "g",
    nutrientes: { sodio: 38758 }
  },
  "pimenta-kitano-30g": {
    ing: "pimenta-do-reino", nome: "Pimenta do Reino Moída", marca: "Kitano",
    qtd: 30, un: "g"
  },
  "louro-kitano-8g": {
    ing: "louro", nome: "Folhas de Louro", marca: "Kitano",
    qtd: 8, un: "g"
  },

  /* ---------------------------------------------------------- não comida */

  "forminha-n4-100un": {
    ing: "forminha-de-papel", nome: "Forminhas de papel nº 4", marca: "Mago",
    qtd: 100, un: "un."
  }
};

export const MOEDA = "BRL";

/** Campos aceitos em `nutrientes` — os mesmos do catálogo, todos opcionais aqui. */
export { CAMPOS_NUTRIENTES } from "./ingredientes.js";

/**
 * O produto pronto para usar: id, campos do catálogo, preço e onde.
 *
 * Com `mercado`, o preço é o DAQUELE mercado — é assim que escolher onde comprar
 * muda todo número da tela sem que nenhuma tela saiba como. Sem `mercado`, é o mais
 * barato entre todos, que é comparar em vez de comprar.
 *
 * Três desfechos para `preco`, e a diferença entre os dois últimos é o que separa
 * um aviso de um defeito:
 *
 *   número   dá para precificar
 *   null + foraDoMercado   o mercado ativo não vende isto, mas alguém vende
 *   null                   ninguém vende (não deveria acontecer; há teste)
 */
function comPreco(id, p, mercado) {
  if (mercado) {
    const valor = precoNoMercado(mercado, id);
    return {
      id, ...p,
      preco: valor,
      mercado: valor == null ? null : mercado,
      foraDoMercado: valor == null
    };
  }

  const melhor = melhorPreco(id);
  return {
    id, ...p,
    preco: melhor?.preco ?? null,
    mercado: melhor?.mercado ?? null,
    foraDoMercado: false
  };
}

export const produto = (id, mercado = null) =>
  (Object.hasOwn(PRODUTOS, id) ? comPreco(id, PRODUTOS[id], mercado) : null);

export const existe = id => Object.hasOwn(PRODUTOS, id);

export const ids = () => Object.keys(PRODUTOS);

/**
 * Todos os produtos de um ingrediente **e de seus subtipos**, com o id junto.
 *
 * É o que faz a janela de escolha responder ao quanto a receita foi específica:
 * pedindo "açúcar", vêm refinado, cristal e mascavo; pedindo "açúcar refinado",
 * só os refinados. O produto aponta sempre para a folha que ele é.
 *
 * Com `mercado`, sai só o que aquele mercado vende. Lista vazia passa a ter dois
 * significados — "o catálogo não tem" e "aqui não vende" —, e quem chama distingue
 * comparando com a lista sem filtro.
 */
export const produtosDe = (ingId, mercado = null) =>
  Object.entries(PRODUTOS)
    .filter(([id, p]) => naSubarvore(p.ing, ingId) && (!mercado || vendeEm(mercado, id)))
    .map(([id, p]) => comPreco(id, p, mercado));

/** Só os produtos que são exatamente daquele nó, sem descer. */
export const produtosExatosDe = (ingId, mercado = null) =>
  Object.entries(PRODUTOS)
    .filter(([id, p]) => p.ing === ingId && (!mercado || vendeEm(mercado, id)))
    .map(([id, p]) => comPreco(id, p, mercado));
