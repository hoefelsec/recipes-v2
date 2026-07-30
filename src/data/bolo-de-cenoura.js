export default {
  slug: "bolo-de-cenoura",
  nome: "Bolo de Cenoura com Cobertura",
  grupo: "Doces",
  descricaoCurta: "Café da tarde",
  resumo: "Massa úmida de liquidificador e cobertura de chocolate que endurece levemente por cima.",

  imagem: {
    src: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1600&q=80",
    alt: "Fatia de bolo com cobertura escura de chocolate em um prato claro.",
    credito: { autor: "Unsplash", url: "https://unsplash.com" }
  },

  porcoes: { padrao: 12, min: 6, max: 24, passo: 6, unidade: "fatias", unidadeSingular: "fatia" },
  tempo: { valor: "1", unidade: "h 10 min", detalhe: "25 min de preparo + 45 min de forno" },
  dificuldade: "Fácil",
  rendimento: "Forma de furo central 24 cm",
  notaEscala: "Dobrando a receita, use duas formas — uma forma só não assa por igual.",

  ingredientes: [
    { ing: "cenoura", qtd: 3, un: "un.", detalhe: { um: "média em rodelas finas", muitos: "médias em rodelas finas" } },
    { ing: "ovo", qtd: 3, un: "un." },
    { ing: "oleo/girassol", qtd: 1, un: "copo" },
    { ing: "acucar/refinado", qtd: 2, un: "copo" },
    { ing: "farinha-de-trigo", qtd: 2.5, un: "copo" },
    { ing: "fermento-em-po", qtd: 1, un: "col. sopa" },
    { ing: "sal", qtd: 1, un: "pitada" },

    { subtitulo: "Cobertura" },
    { ing: "chocolate-em-po", qtd: 4, un: "col. sopa" },
    { ing: "acucar/refinado", qtd: 3, un: "col. sopa" },
    { ing: "manteiga", qtd: 2, un: "col. sopa" },
    { ing: "leite", qtd: 4, un: "col. sopa" }
  ],

  utensilios: [
    "Liquidificador",
    "Forma de furo central 24 cm",
    "Peneira",
    "Tigela grande",
    "Panela pequena",
    "Espátula",
    "Palito de dente"
  ],

  preparo: [
    {
      titulo: "Aqueça o forno",
      texto: "Pré-aqueça o forno a 180 °C. Unte a forma com manteiga e farinha, cobrindo bem o furo central."
    },
    {
      titulo: "Bata os líquidos",
      texto: "No liquidificador, bata as cenouras, os ovos e o óleo por 3 minutos, até obter um creme laranja completamente liso.",
      dica: "<b>Sem pontinhos:</b> corte a cenoura em rodelas finas — pedaços grandes deixam fiapos na massa."
    },
    {
      titulo: "Incorpore os secos",
      texto: "Transfira para uma tigela e adicione o açúcar. Peneire a farinha e o sal aos poucos, misturando com espátula. Por último, junte o fermento com movimentos delicados, de baixo para cima."
    },
    {
      titulo: "Asse",
      texto: "Despeje na forma e asse por 40 a 45 minutos, sem abrir o forno nos primeiros 25 minutos. Teste com um palito no ponto mais alto: deve sair seco.",
      dica: "<b>Não abra cedo:</b> a corrente de ar fria faz a massa murchar no centro."
    },
    {
      titulo: "Faça a cobertura",
      texto: "Leve todos os ingredientes da cobertura ao fogo baixo, mexendo até engrossar (cerca de 4 minutos). Despeje sobre o bolo ainda morno, já desenformado."
    }
  ]
};
