/* Mercados — onde se compra.
 *
 * Quarta tabela do modelo, e a que fecha a ponta que faltava:
 *
 *   receita --(ing)--> ingrediente <--(ing)-- produto <--(produto)-- preço --(mercado)--> mercado
 *
 * O produto é a embalagem ("Feijão Preto São João, 1 kg"); o mercado é o lugar.
 * O PREÇO não pertence a nenhum dos dois: pertence ao par. O mesmo pacote custa
 * uma coisa num mercado e outra no da esquina, e nenhuma das duas é "o preço do
 * feijão São João" — por isso ele saiu de `produtos.js` e foi para `precos.js`.
 *
 * Campos:
 *   nome   como o mercado se chama. É o que vai para a tela.
 *   logo   caminho do arquivo, a partir da raiz do site.
 *
 * Só isso. Endereço, horário e bandeira de cartão são coisas que um caderno de
 * receitas não precisa saber, e campo que ninguém lê é campo que envelhece errado.
 *
 * ATENÇÃO: os nomes abaixo são de redes que existem, mas TODOS OS PREÇOS em
 * `precos.js` são FICTÍCIOS, para teste — não representam valores de mercado nem
 * o que qualquer uma dessas redes cobra. Os logos são marcas de lugar, desenhadas
 * aqui, e não as identidades visuais reais.
 */

export const MERCADOS = {
  zaffari: {
    nome: "Zaffari",
    logo: "public/images/mercados/zaffari.svg"
  },
  nacional: {
    nome: "Nacional",
    logo: "public/images/mercados/nacional.svg"
  },
  asun: {
    nome: "Asun",
    logo: "public/images/mercados/asun.svg"
  }
};

/** O registro do mercado, com o id junto — o id identifica, então ele anda com o resto. */
export const mercado = id => (Object.hasOwn(MERCADOS, id) ? { id, ...MERCADOS[id] } : null);

export const existe = id => Object.hasOwn(MERCADOS, id);

export const ids = () => Object.keys(MERCADOS);

/** Todos, em ordem de nome — é a ordem em que uma lista deles se lê. */
export const mercados = () =>
  ids().map(mercado).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
