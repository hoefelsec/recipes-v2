/* Produto escolhido para cada ingrediente, guardado no navegador.
 *
 * Sem escolha, o site usa o mais barato do catálogo — é um palpite razoável, não
 * uma decisão do leitor. Aqui fica a decisão dele.
 *
 * A escolha é POR RECEITA: a mesma manteiga pode ser a com sal na feijoada e a
 * sem sal no brigadeiro, porque a receita pede coisas diferentes. Guardar por
 * ingrediente só perderia essa distinção.
 *
 *   receitas:produtos     { "brigadeiro": { "manteiga": "manteiga-president-200g" } }
 *   receitas:recentes     ["manteiga-president-200g", "acucar-uniao-1kg", …]
 *   receitas:ordem-produtos  como ordenar a lista na janela
 *
 * Os recém-usados são uma lista só, global: "usei este produto há pouco" não é
 * um fato sobre a receita, é um fato sobre a despensa de quem cozinha.
 */

import { PRODUTOS, produto } from "../data/produtos.js";
import { existe as ingredienteExiste, naSubarvore } from "../data/ingredientes.js";
import { existe as mercadoExiste } from "../data/mercados.js";

const CHAVE = "receitas:produtos";
const CHAVE_RECENTES = "receitas:recentes";
const CHAVE_ORDEM = "receitas:ordem-produtos";
const CHAVE_TENHO = "receitas:tenho";
const CHAVE_MERCADO = "receitas:compras-por-mercado";

/** Quantos produtos a lista de recentes guarda. */
export const MAX_RECENTES = 40;

/**
 * O carrinho é um "slug" à parte, e não um mapa separado.
 *
 * Ele precisa de UMA escolha por ingrediente, não uma por receita: quem vai ao
 * mercado compra um pacote de manteiga, não um por receita. Mas a pergunta é a
 * mesma — "qual produto?" — então reaproveita o mesmo armazenamento e o mesmo
 * saneamento. Os dois-pontos garantem que nenhum slug de receita colida com ele.
 */
export const ESCOPO_CARRINHO = ":carrinho";

/* Quem decide o produto de cada linha da compra é `purchase.js`: é lá que se sabe
   quais receitas caíram na mesma linha, e é lá que a linha se divide quando elas
   escolheram produtos diferentes. Aqui só se guarda e se lê a escolha. */

/** Ordenações oferecidas na janela. A primeira é a padrão. */
export const ORDENS = [
  { valor: "recentes", rotulo: "Usados há pouco" },
  { valor: "nome", rotulo: "Nome" },
  { valor: "embalagem", rotulo: "Preço da embalagem" },
  { valor: "unitario", rotulo: "Preço por medida" }
];

export const ORDEM_PADRAO = ORDENS[0].valor;

/* --------------------------------------------------------------- guardar */

const ler = chave => {
  try {
    return JSON.parse(localStorage.getItem(chave) || "null");
  } catch {
    return null;   // navegador sem localStorage, ou JSON corrompido
  }
};

const escrever = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo privado em alguns navegadores bloqueia a escrita — segue sem salvar */
  }
};

/**
 * Descarta o que não faz sentido mais.
 *
 * Produto ou ingrediente que saiu do catálogo, e — o caso silencioso — produto
 * que existe mas não serve àquele ingrediente. Sem esta última checagem, uma
 * escolha antiga sobreviveria a uma remontagem da tabela apontando para outra
 * coisa.
 *
 * "Servir" é ser da subárvore: um produto de açúcar refinado serve tanto a quem
 * pediu "açúcar refinado" quanto a quem pediu "açúcar". O contrário não vale —
 * escolher um cristal para uma receita que pede refinado seria trocar o pedido.
 */
export function sanearEscolhas(bruto) {
  const saida = {};
  if (!bruto || typeof bruto !== "object") return saida;

  for (const [slug, porIngrediente] of Object.entries(bruto)) {
    if (!porIngrediente || typeof porIngrediente !== "object") continue;

    const limpo = {};
    for (const [ingId, produtoId] of Object.entries(porIngrediente)) {
      if (!ingredienteExiste(ingId)) continue;
      const doProduto = PRODUTOS[produtoId]?.ing;
      if (!doProduto || !naSubarvore(doProduto, ingId)) continue;
      limpo[ingId] = produtoId;
    }

    if (Object.keys(limpo).length) saida[slug] = limpo;
  }

  return saida;
}

export const carregarEscolhas = () => sanearEscolhas(ler(CHAVE));

/** Ids de produto em ordem de uso, do mais recente para o mais antigo. */
export function carregarRecentes() {
  const bruto = ler(CHAVE_RECENTES);
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(id => Object.hasOwn(PRODUTOS, id)).slice(0, MAX_RECENTES);
}

export function carregarOrdem() {
  const bruto = ler(CHAVE_ORDEM);
  return ORDENS.some(o => o.valor === bruto) ? bruto : ORDEM_PADRAO;
}

export const salvarOrdem = ordem => escrever(CHAVE_ORDEM, ordem);

/* ---------------------------------------------------------------- mexer */

/**
 * Escolhe (ou desescolhe, com `produtoId = null`) e devolve o novo estado.
 * Devolve `{ escolhas, recentes }` — quem chama redesenha a partir daí.
 */
export function escolher(slug, ingId, produtoId) {
  const escolhas = carregarEscolhas();
  const doSlug = { ...(escolhas[slug] ?? {}) };

  const servePara = produtoId && naSubarvore(produto(produtoId)?.ing ?? "", ingId);
  if (servePara) doSlug[ingId] = produtoId;
  else delete doSlug[ingId];

  if (Object.keys(doSlug).length) escolhas[slug] = doSlug;
  else delete escolhas[slug];

  escrever(CHAVE, escolhas);

  // Voltar ao automático não é "usar um produto": não mexe nos recentes
  const recentes = produtoId ? registrarUso(produtoId) : carregarRecentes();

  return { escolhas, recentes };
}

/** Põe o produto na frente da lista de recentes, sem repetir. */
export function registrarUso(produtoId) {
  if (!Object.hasOwn(PRODUTOS, produtoId)) return carregarRecentes();

  const recentes = [produtoId, ...carregarRecentes().filter(id => id !== produtoId)]
    .slice(0, MAX_RECENTES);

  escrever(CHAVE_RECENTES, recentes);
  return recentes;
}

/** Id do produto escolhido para este ingrediente nesta receita, ou null. */
export const escolhaDe = (escolhas, slug, ingId) => escolhas?.[slug]?.[ingId] ?? null;

/* ------------------------------------------------------- já tenho em casa */

/**
 * O que a pessoa marcou como já disponível na despensa.
 *
 * Diferente de `emCasa` do catálogo, que é uma afirmação do site sobre sal e
 * água: isto é uma afirmação do leitor sobre esta compra. Sai da lista impressa
 * e do total da compra, mas continua sendo consumido pela receita — se você já
 * tem a farinha, não paga por ela hoje, e o bolo continua levando farinha.
 *
 * Guarda a chave da LINHA da compra, que quase sempre é só o ingrediente — o que
 * está no armário é "farinha de trigo", não uma marca. A exceção é a linha que se
 * dividiu porque as receitas escolheram produtos diferentes: aí a chave é
 * `ingrediente#produto`, porque ter o chocolate de 32% em casa não é ter o de 50%.
 */
const CHAVE_VALIDA = /^([^#]+)(?:#(.+))?$/;

const chaveDeLinhaExiste = chave => {
  const m = CHAVE_VALIDA.exec(String(chave ?? ""));
  if (!m) return false;
  return ingredienteExiste(m[1]) && (!m[2] || Boolean(produto(m[2])));
};

export function carregarTenho() {
  const bruto = ler(CHAVE_TENHO);
  if (!Array.isArray(bruto)) return new Set();
  return new Set(bruto.filter(chaveDeLinhaExiste));
}

/** Marca ou desmarca, e devolve o conjunto novo. */
export function marcarTenho(chave, tenho) {
  const atual = carregarTenho();

  if (tenho && chaveDeLinhaExiste(chave)) atual.add(chave);
  else atual.delete(chave);

  escrever(CHAVE_TENHO, [...atual]);
  return atual;
}

export const limparTenho = () => escrever(CHAVE_TENHO, []);

/* --------------------------------------------- em que mercado comprar cada item */

/**
 * A que mercado cada linha da compra foi atribuída: `{ chaveDaLinha: mercadoId }`.
 *
 * É como o leitor monta uma lista por mercado — cada ingrediente vai para o mercado
 * onde ele decidiu comprá-lo. Chave e mercado inválidos são descartados na leitura,
 * como todo o resto do estado guardado.
 */
export function carregarAtribuicoes() {
  const bruto = ler(CHAVE_MERCADO);
  const saida = {};
  if (bruto && typeof bruto === "object" && !Array.isArray(bruto)) {
    for (const [chave, mercadoId] of Object.entries(bruto)) {
      if (chaveDeLinhaExiste(chave) && mercadoExiste(mercadoId)) saida[chave] = mercadoId;
    }
  }
  return saida;
}

/** Atribui (ou tira, com `mercadoId = null`) uma linha a um mercado. */
export function atribuir(chave, mercadoId) {
  const atual = carregarAtribuicoes();
  if (mercadoId && mercadoExiste(mercadoId) && chaveDeLinhaExiste(chave)) atual[chave] = mercadoId;
  else delete atual[chave];
  escrever(CHAVE_MERCADO, atual);
  return atual;
}

export const desatribuir = chave => atribuir(chave, null);
export const limparAtribuicoes = () => escrever(CHAVE_MERCADO, {});

/** Apaga tudo — usado pelo "voltar ao padrão" das preferências e pelos testes. */
export function limparEscolhas() {
  escrever(CHAVE, {});
  escrever(CHAVE_RECENTES, []);
  escrever(CHAVE_TENHO, []);
  escrever(CHAVE_MERCADO, {});
}
