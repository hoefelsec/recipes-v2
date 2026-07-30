export default {
  slug: "feijoada",
  nome: "Feijoada Completa",
  grupo: "Pratos principais",
  descricaoCurta: "Almoço de domingo",
  resumo: "Cozimento lento, caldo escuro e encorpado. O prato que pede mesa cheia e tempo de sobra.",

  imagem: {
    src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80",
    alt: "Prato fundo com ensopado escuro de carnes, servido à mesa.",
    credito: { autor: "Unsplash", url: "https://unsplash.com" }
  },

  porcoes: { padrao: 8, min: 4, max: 24, passo: 2, unidade: "p." },
  tempo: { valor: "3", unidade: "h", detalhe: "+ 12 h de molho na véspera" },
  dificuldade: "Médio",
  rendimento: "Panela de 6 L",

  ingredientes: [
    { ing: "feijao-preto", qtd: 1000, un: "g" },
    { ing: "louro", qtd: 3, un: "folha" },

    { subtitulo: "Carnes" },
    { ing: "carne-seca", qtd: 300, un: "g", detalhe: "dessalgada" },
    { ing: "costelinha-de-porco", qtd: 300, un: "g" },
    { ing: "paio", qtd: 200, un: "g", detalhe: "em rodelas" },
    { ing: "linguica-calabresa", qtd: 200, un: "g" },
    { ing: "bacon", qtd: 150, un: "g", detalhe: "em cubos" },

    { subtitulo: "Refogado" },
    { ing: "cebola", qtd: 2, un: "un.", detalhe: { um: "picada", muitos: "picadas" } },
    { ing: "alho", qtd: 6, un: "dente", detalhe: "amassado" },
    { ing: "sal", escala: false, texto: "a gosto" },
    { ing: "pimenta-do-reino", escala: false, texto: "a gosto" },
    { ing: "laranja", qtd: 1, un: "un.", detalhe: "para cozinhar junto (opcional)" }
  ],

  utensilios: [
    "Caldeirão ou panela de ferro de 6 L",
    "Frigideira",
    "Peneira grande",
    "Faca de chef",
    "Tábua de corte",
    "Colher de pau",
    "Concha"
  ],

  preparo: [
    {
      titulo: "Deixe de molho na véspera",
      texto: "Cubra o feijão preto com água fria e deixe descansar por 12 horas. Separadamente, dessalgue a carne-seca em água gelada, trocando a água 3 vezes.",
      dica: "<b>Atalho:</b> na panela de pressão o feijão cozinha em 25 min sem molho, mas o caldo fica menos encorpado."
    },
    {
      titulo: "Cozinhe as carnes salgadas",
      texto: "Escorra o feijão, cubra com água nova e leve ao fogo com o louro, a carne-seca e a costelinha. Cozinhe em fogo baixo por 1 h 30 min, completando com água quente sempre que necessário."
    },
    {
      titulo: "Doure os embutidos",
      texto: "Frite o bacon até liberar a gordura, retire e reserve. Na mesma gordura, doure o paio e a calabresa e junte tudo à panela do feijão."
    },
    {
      titulo: "Monte o refogado",
      texto: "Na gordura restante, refogue a cebola até ficar translúcida e o alho até perfumar. Adicione 2 conchas de feijão, amasse bem e devolva à panela — é isso que engrossa o caldo."
    },
    {
      titulo: "Apure e descanse",
      texto: "Cozinhe destampado por mais 40 minutos em fogo baixo, ajuste o sal e a pimenta. Desligue e deixe descansar 20 minutos antes de servir.",
      dica: "<b>Melhor no dia seguinte:</b> o sabor apura na geladeira. Reaqueça em fogo baixo com um pouco de água."
    },
    {
      titulo: "Sirva",
      texto: "Acompanha arroz branco, couve refogada, farofa, vinagrete e gomos de laranja."
    }
  ]
};
