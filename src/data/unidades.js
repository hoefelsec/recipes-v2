/* Banco de medidas.
 *
 * É a tabela que diz *quanto vale* cada medida de cozinha. O comportamento —
 * arredondar, escrever, converter — vive em `src/js/units.js`; aqui ficam só os
 * números e as palavras.
 *
 * Três grupos, e o grupo define a família da medida:
 *   VOLUMES    convertem entre si livremente (base em ml)
 *   PESOS      convertem entre si livremente (base em g)
 *   CONTAVEIS  não convertem: são coisas contadas ou embalagens
 *
 * Cruzar volume e peso (copo -> g) depende da densidade do ingrediente: um copo
 * de farinha e um copo de açúcar não pesam a mesma coisa.
 *
 * Campos de cada medida:
 *   base          quanto vale em ml (volume) ou g (peso)
 *   plural        ausente = palavra invariável ("col. sopa")
 *   passo         múltiplo de arredondamento; função quando depende do tamanho
 *   min           menor valor que faz sentido escrever
 *   minConversao  abaixo disto, não vale a pena oferecer a conversão
 *   preservar     valor que já é redondo e não deve ser mexido
 *   decimal       escreve 1,25 em vez de 1 ¼ (medida métrica)
 *   oculta        não se escreve o nome ("3 ovos", não "3 un. ovos")
 *   passoEquivalencia
 *                 arredondamento mais fino, para quando o número não é uma
 *                 instrução mas uma equivalência: "2 col. sopa (27 g)" não pode
 *                 virar 25 g, porque aí a equivalência deixa de ser verdade.
 */

/* --------------------------------------------------------------- volume ---
 * As medidas de casa são CONVENÇÕES, não padrões: "um copo" varia de armário
 * para armário. Os valores abaixo são os mais usados em receita brasileira, e
 * é por isso que o site sempre mostra quantos ml a medida vale.
 */
export const VOLUMES = {
  "ml": {
    base: 1, decimal: true,
    passo: v => (v >= 200 ? 25 : v >= 100 ? 10 : v >= 20 ? 5 : 1), min: 1,
    passoEquivalencia: v => (v < 100 ? 1 : v < 1000 ? 5 : 25),
    preservar: v => (v >= 20 ? v % 5 === 0 : Number.isInteger(v)),
    minConversao: 1
  },
  "L": {
    base: 1000, decimal: true,
    passo: 0.01, min: 0.01,
    minConversao: 1   // ninguém escreve "0,36 L": abaixo de 1 L fica em ml
  },

  "copo":            { base: 180, passo: 0.25, min: 0.25, plural: "copos",   minConversao: 0.25 },
  "copo americano":  { base: 200, passo: 0.25, min: 0.25, plural: "copos americanos",  minConversao: 0.25 },
  "copo de requeijão": { base: 250, passo: 0.25, min: 0.25, plural: "copos de requeijão", minConversao: 0.25 },
  "xícara":          { base: 240, passo: 0.25, min: 0.25, plural: "xícaras", minConversao: 0.25 },

  "col. sopa":       { base: 15, passo: 0.25, min: 0.25, plural: "col. sopa",       minConversao: 0.5 },
  "col. sobremesa":  { base: 10, passo: 0.25, min: 0.25, plural: "col. sobremesa",  minConversao: 0.5 },
  "col. chá":        { base: 5,  passo: 0.25, min: 0.25, plural: "col. chá",        minConversao: 0.5 },
  "col. café":       { base: 2,  passo: 0.25, min: 0.25, plural: "col. café",       minConversao: 1 }
};

/* ---------------------------------------------------------------- peso ---
 * Só existe grama. "kg" não é medida: é como o grama se escreve quando passa
 * de mil — ver PROMOCOES.
 */
export const PESOS = {
  "g": {
    base: 1, decimal: true,
    passo: v => (v >= 200 ? 25 : v >= 100 ? 10 : v >= 20 ? 5 : 1), min: 1,
    passoEquivalencia: v => (v < 100 ? 1 : v < 1000 ? 5 : 25),
    preservar: v => (v >= 20 ? v % 5 === 0 : Number.isInteger(v)),
    minConversao: 1
  }
};

/* ----------------------------------------------------------- contáveis ---
 * Quanto pesa uma unidade destas depende do ingrediente, não da medida: um
 * dente de alho e um dente de outra coisa não existem. Por isso o peso mora em
 * `pesoPorUnidade`, no catálogo de ingredientes.
 */
export const CONTAVEIS = {
  "pitada": { passo: 1, min: 1, plural: "pitadas" },
  "un.":    { passo: 1, min: 1, plural: "un.", oculta: true },
  "dente":  { passo: 1, min: 1, plural: "dentes" },
  "folha":  { passo: 1, min: 1, plural: "folhas" },
  "fatia":  { passo: 1, min: 1, plural: "fatias" },
  "lata":   { passo: 0.5, min: 0.5, plural: "latas" },
  "maço":   { passo: 0.5, min: 0.5, plural: "maços" },
  "pacote": { passo: 0.5, min: 0.5, plural: "pacotes" }
};

/* A família não se repete medida por medida: ela é o grupo em que a medida
   está. Assim é impossível cadastrar um volume dizendo que é peso. */
const comFamilia = (grupo, familia) =>
  Object.fromEntries(Object.entries(grupo).map(([un, def]) => [un, { ...def, familia }]));

export const UNIDADES = {
  ...comFamilia(VOLUMES, "volume"),
  ...comFamilia(PESOS, "peso"),
  ...CONTAVEIS
};

/* Medidas oferecidas no menu de conversão, na ordem em que aparecem.
 *
 * É um recorte da tabela, não a tabela toda: um menu com nove opções de volume
 * seria pior do que um com seis. As demais continuam válidas se uma receita
 * usá-las — só não são sugeridas. */
export const MENU = {
  volume: ["ml", "L", "copo", "xícara", "col. sopa", "col. chá"],
  peso: ["g"]
};

/* Múltiplos que existem só na escrita. Guardar "1 kg" e "1.000 g" como coisas
   diferentes seria guardar o mesmo peso duas vezes — a conta é sempre em grama,
   e a escrita muda quando o número cresce.

   Para fazer o mesmo com litro, bastaria acrescentar
   `ml: { limite: 1000, un: "L", divisor: 1000, decimais: 2 }` aqui. Hoje o litro
   ainda é medida de verdade, porque é assim que líquido é vendido e medido. */
export const PROMOCOES = {
  g: { limite: 1000, un: "kg", divisor: 1000, decimais: 2 }
};

/** Medidas métricas: quem já está numa delas não precisa de equivalência. */
export const METRICAS = ["g", "ml", "L"];
