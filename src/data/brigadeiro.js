export default {
  slug: "brigadeiro",
  nome: "Brigadeiro Cremoso",
  grupo: "Doces",
  descricaoCurta: "Sobremesa de festa",
  resumo: "O clássico brasileiro no ponto de colher — brilhante, sedoso e com sabor intenso de cacau.",

  imagem: {
    src: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1600&q=80",
    alt: "Doces de chocolate arredondados cobertos de granulado, servidos em forminhas de papel.",
    credito: { autor: "Unsplash", url: "https://unsplash.com" }
  },

  porcoes: { padrao: 25, min: 10, max: 75, passo: 5, unidade: "un." },
  tempo: { valor: "30", unidade: "min", detalhe: "20 min de fogo + 40 min para esfriar" },
  dificuldade: "Fácil",
  rendimento: "1 panela média",

  ingredientes: [
    { ing: "leite-condensado", qtd: 1, un: "lata" },
    { ing: "chocolate-em-po/50", qtd: 4, un: "col. sopa" },
    { ing: "manteiga/sem-sal", qtd: 1, un: "col. sopa" },
    { ing: "sal", qtd: 1, un: "pitada" },

    { subtitulo: "Para finalizar" },
    { ing: "chocolate-granulado", qtd: 100, un: "g" },
    { ing: "forminha-de-papel", qtd: 25, un: "un." }
  ],

  utensilios: [
    "Panela de fundo grosso",
    "Espátula de silicone",
    "Prato raso untado",
    "Forminhas de papel",
    "Balança de cozinha"
  ],

  preparo: [
    {
      titulo: "Prepare a base",
      texto: "Em uma panela de fundo grosso e ainda fora do fogo, misture o leite condensado, o chocolate em pó peneirado, a manteiga e a pitada de sal até ficar homogêneo e sem grumos."
    },
    {
      titulo: "Cozinhe em fogo médio-baixo",
      texto: "Leve ao fogo mexendo sem parar com a espátula, sempre raspando o fundo e as laterais. A mistura vai escurecer e engrossar aos poucos.",
      dica: "<b>Ponto certo:</b> está pronto quando você inclina a panela e a massa desliza em bloco, deixando o fundo limpo por 2 segundos."
    },
    {
      titulo: "Resfrie",
      texto: "Transfira imediatamente para um prato raso untado com manteiga, espalhe e deixe esfriar em temperatura ambiente por cerca de 40 minutos."
    },
    {
      titulo: "Enrole e finalize",
      texto: "Com as mãos levemente untadas, faça bolinhas de aproximadamente 15 g, passe no granulado e acomode nas forminhas.",
      dica: "<b>Guarde assim:</b> em pote fechado fora da geladeira duram 3 dias; na geladeira, 1 semana (tire 20 min antes de servir)."
    }
  ]
};
