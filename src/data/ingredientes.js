/* Catálogo de ingredientes, em árvore.
 *
 * Um ingrediente pode ter subtipos, e os subtipos podem ter subtipos:
 *
 *   tomate
 *     └ tomate italiano
 *         └ tomate san marzano
 *
 * A receita escolhe o quanto quer ser específica. "1 tomate" aceita qualquer um;
 * "1 tomate san marzano" aceita só aquele. Quem responde por essa diferença é a
 * janela de produtos: pedindo o pai, ela oferece os produtos de toda a
 * subárvore; pedindo o subtipo, só os dele.
 *
 * A chave é o caminho, separado por barra: `manteiga/sem-sal`. Assim o id conta
 * a linhagem, e nenhuma chave antiga com hífen colide com ele.
 *
 * Campos de cada nó (todos herdáveis pelos subtipos):
 *   nome        singular, canônico. É o que vai para a lista de compras.
 *   plural      só para contáveis ("3 ovos"); ausente = nome invariável.
 *   densidade   g/ml. Permite converter copo <-> gramas e pesar medida de casa.
 *   liquido     true para o que se mede por volume. Densidade não distingue:
 *               óleo e açúcar têm quase o mesmo 1 g/ml, mas óleo se mede em ml
 *               e açúcar se pesa. É essa a diferença que o campo guarda.
 *   pesoPorUnidade
 *               gramas de UMA unidade contável: { "un.": 50 } para o ovo,
 *               { "dente": 4 } para o alho. É o que permite pesar "3 ovos".
 *   comestivel  false para o que entra na lista mas não no prato (forminhas).
 *   emCasa      true para o que se assume que já está em casa: sal e água. Não
 *               entra na conta de custo nem na lista de compras.
 *   nutrientes  por 100 g ou 100 ml — ver observação no fim do arquivo.
 *
 * Campo só do pai:
 *   comoO       qual subtipo empresta densidade e nutrientes ao pai. "Tomate"
 *               precisa de números para quando a receita não especifica, e
 *               inventar uma média de tipos seria pior do que dizer, explícito,
 *               que os números são os do tipo mais comum.
 *   tipos       os subtipos, pela última parte da chave.
 *
 * Densidade e peso por unidade são estimativas de cozinha, não medições.
 */

export const ARVORE = {
  /* ---------------------------------------------------------- grãos e pós */

  "feijao-preto": {
    nome: "feijão preto",
    nutrientes: { kcal: 341, proteina: 21.6, carboidrato: 62.4, gordura: 1.4, fibra: 15.5, sodio: 5 }
  },
  "farinha-de-trigo": {
    nome: "farinha de trigo",
    densidade: 0.667,   // farinha peneirada: 2,5 copos dão 300 g
    nutrientes: { kcal: 364, proteina: 10.3, carboidrato: 76.3, gordura: 1, fibra: 2.7, sodio: 2 }
  },

  /* O açúcar da receita costuma dizer qual: a massa do bolo pede refinado, a
     cobertura aceita qualquer um. São os dois casos que a árvore atende. */
  "acucar": {
    nome: "açúcar",
    densidade: 1.0,
    comoO: "refinado",
    tipos: {
      "refinado": {
        nome: "açúcar refinado",
        nutrientes: { kcal: 387, proteina: 0, carboidrato: 100, gordura: 0, fibra: 0, sodio: 1 }
      },
      "cristal": {
        nome: "açúcar cristal",
        densidade: 0.95,   // cristal é mais graúdo: o copo pesa um pouco menos
        nutrientes: { kcal: 387, proteina: 0, carboidrato: 99.9, gordura: 0, fibra: 0, sodio: 1 }
      },
      "mascavo": {
        nome: "açúcar mascavo",
        densidade: 0.9,
        nutrientes: { kcal: 369, proteina: 0.1, carboidrato: 94, gordura: 0, fibra: 0, sodio: 40 }
      }
    }
  },

  "fermento-em-po": {
    nome: "fermento em pó",
    densidade: 0.9,
    nutrientes: { kcal: 53, proteina: 0, carboidrato: 27.7, gordura: 0, fibra: 0.2, sodio: 10600 }
  },

  /* Antes eram dois ingredientes soltos, "chocolate em pó" e "chocolate em pó
     50% cacau", quando o segundo sempre foi um tipo do primeiro. */
  "chocolate-em-po": {
    nome: "chocolate em pó",
    densidade: 0.5,
    comoO: "32",
    tipos: {
      "32": {
        nome: "chocolate em pó 32% cacau",
        nutrientes: { kcal: 228, proteina: 19.6, carboidrato: 57.9, gordura: 13.7, fibra: 33.2, sodio: 21 }
      },
      "50": {
        nome: "chocolate em pó 50% cacau",
        nutrientes: { kcal: 400, proteina: 8, carboidrato: 60, gordura: 15, fibra: 10, sodio: 30 }
      }
    }
  },

  "chocolate-granulado": {
    nome: "chocolate granulado",
    nutrientes: { kcal: 480, proteina: 4, carboidrato: 70, gordura: 20, fibra: 3, sodio: 40 }
  },

  /* -------------------------------------------------------------- carnes */

  "carne-seca": {
    nome: "carne-seca",
    nutrientes: { kcal: 313, proteina: 27, carboidrato: 0, gordura: 22, fibra: 0, sodio: 1800 }
  },
  "costelinha-de-porco": {
    nome: "costelinha de porco",
    nutrientes: { kcal: 277, proteina: 18, carboidrato: 0, gordura: 22, fibra: 0, sodio: 60 }
  },
  "paio": {
    nome: "paio",
    nutrientes: { kcal: 330, proteina: 15, carboidrato: 1, gordura: 29, fibra: 0, sodio: 1200 }
  },
  "linguica-calabresa": {
    nome: "linguiça calabresa",
    nutrientes: { kcal: 296, proteina: 15, carboidrato: 1, gordura: 25, fibra: 0, sodio: 1200 }
  },
  "bacon": {
    nome: "bacon",
    nutrientes: { kcal: 541, proteina: 37, carboidrato: 1.4, gordura: 42, fibra: 0, sodio: 1700 }
  },

  /* ------------------------------------------------------------ frescos */

  "cebola": {
    nome: "cebola", plural: "cebolas",
    pesoPorUnidade: { "un.": 150 },
    nutrientes: { kcal: 40, proteina: 1.1, carboidrato: 9.3, gordura: 0.1, fibra: 1.7, sodio: 4 }
  },
  "alho": {
    nome: "alho",
    pesoPorUnidade: { "dente": 4 },
    nutrientes: { kcal: 149, proteina: 6.4, carboidrato: 33.1, gordura: 0.5, fibra: 2.1, sodio: 17 }
  },
  "cenoura": {
    nome: "cenoura", plural: "cenouras",
    pesoPorUnidade: { "un.": 100 },
    nutrientes: { kcal: 41, proteina: 0.9, carboidrato: 9.6, gordura: 0.2, fibra: 2.8, sodio: 69 }
  },
  "laranja": {
    nome: "laranja", plural: "laranjas",
    pesoPorUnidade: { "un.": 180 },
    nutrientes: { kcal: 47, proteina: 0.9, carboidrato: 11.8, gordura: 0.1, fibra: 2.4, sodio: 0 }
  },
  "ovo": {
    nome: "ovo", plural: "ovos",
    pesoPorUnidade: { "un.": 50 },   // sem casca
    nutrientes: { kcal: 143, proteina: 12.6, carboidrato: 0.7, gordura: 9.5, fibra: 0, sodio: 142 }
  },

  /* ------------------------------------------------------ gorduras e leite */

  /* "Manteiga sem sal" era um `detalhe` de texto na receita, o que deixava o
     site oferecer manteiga com sal para um brigadeiro que pede sem. Virou
     subtipo: agora a janela nem mostra a errada. */
  "manteiga": {
    nome: "manteiga",
    densidade: 0.91,
    comoO: "com-sal",
    tipos: {
      "com-sal": {
        nome: "manteiga com sal",
        nutrientes: { kcal: 717, proteina: 0.9, carboidrato: 0.1, gordura: 81.1, fibra: 0, sodio: 580 }
      },
      "sem-sal": {
        nome: "manteiga sem sal",
        nutrientes: { kcal: 717, proteina: 0.9, carboidrato: 0.1, gordura: 81.1, fibra: 0, sodio: 11 }
      }
    }
  },

  "oleo": {
    nome: "óleo",
    liquido: true,
    comoO: "soja",
    tipos: {
      "soja": {
        nome: "óleo de soja",
        densidade: 0.92,
        nutrientes: { kcal: 884, proteina: 0, carboidrato: 0, gordura: 100, fibra: 0, sodio: 0 }
      },
      "girassol": {
        nome: "óleo de girassol",
        densidade: 0.92,
        nutrientes: { kcal: 884, proteina: 0, carboidrato: 0, gordura: 100, fibra: 0, sodio: 0 }
      }
    }
  },

  "leite": {
    nome: "leite",
    liquido: true,
    comoO: "integral",
    tipos: {
      "integral": {
        nome: "leite integral",
        densidade: 1.03,
        nutrientes: { kcal: 61, proteina: 3.2, carboidrato: 4.8, gordura: 3.3, fibra: 0, sodio: 43 }
      },
      "desnatado": {
        nome: "leite desnatado",
        densidade: 1.035,
        nutrientes: { kcal: 35, proteina: 3.4, carboidrato: 5, gordura: 0.2, fibra: 0, sodio: 52 }
      }
    }
  },

  "leite-condensado": {
    nome: "leite condensado",
    densidade: 1.28, liquido: true, pesoPorUnidade: { "lata": 395 },
    nutrientes: { kcal: 321, proteina: 7.9, carboidrato: 54.4, gordura: 8.7, fibra: 0, sodio: 127 }
  },

  /* ---------------------------------------------------- tempero e aromáticos */

  "sal": {
    nome: "sal",
    emCasa: true,
    densidade: 1.2, pesoPorUnidade: { "pitada": 0.4 },
    nutrientes: { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, sodio: 38758 }
  },
  "pimenta-do-reino": {
    nome: "pimenta-do-reino",
    densidade: 0.5,
    nutrientes: { kcal: 251, proteina: 10.4, carboidrato: 64, gordura: 3.3, fibra: 25.3, sodio: 20 }
  },
  "agua": {
    nome: "água",
    emCasa: true,
    densidade: 1.0, liquido: true,
    // Não tem nada: é a única linha do catálogo em que zero é o valor certo
    nutrientes: { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0, sodio: 0 }
  },
  "louro": {
    nome: "louro",
    pesoPorUnidade: { "folha": 0.2 },
    // Folha de louro sai da panela antes de servir: não entra na conta
    nutrientes: null
  },

  /* ------------------------------------------------------------ não comida */

  "forminha-de-papel": {
    nome: "forminha de papel", plural: "forminhas de papel",
    comestivel: false,
    nutrientes: null
  }
};

/* --------------------------------------------------------------- achatar */

export const SEPARADOR = "/";

/** Campos que um subtipo herda do pai quando não declara os seus. */
const HERDAVEIS = ["densidade", "liquido", "pesoPorUnidade", "comestivel", "emCasa", "nutrientes", "plural"];

/** Campos que o pai toma do subtipo apontado por `comoO`. */
const EMPRESTAVEIS = ["densidade", "liquido", "pesoPorUnidade", "nutrientes"];

const declarado = (no, campo) => Object.hasOwn(no, campo);

/**
 * Percorre a árvore e devolve um índice plano `id -> ingrediente`.
 *
 * Três passagens, e a ordem importa:
 *
 *   1. o que cada nó declara de si;
 *   2. de baixo para cima, o pai toma do subtipo `comoO` o que não declarou;
 *   3. de cima para baixo, o subtipo herda do pai o que ainda falta.
 *
 * Sem a ordem, dava para o pai herdar do filho que herdou do pai — e o número
 * apareceria do nada.
 */
function achatar(arvore) {
  const plano = new Map();

  /* 1 e 2 — desce montando, sobe emprestando */
  const visitar = (chave, no, paiId) => {
    const id = paiId ? `${paiId}${SEPARADOR}${chave}` : chave;
    const filhos = Object.entries(no.tipos ?? {});

    const registro = {
      id,
      pai: paiId ?? null,
      filhos: filhos.map(([k]) => `${id}${SEPARADOR}${k}`),
      nivel: id.split(SEPARADOR).length - 1,
      nome: no.nome,
      comoO: no.comoO ?? null,
      declarados: new Set(HERDAVEIS.filter(c => declarado(no, c)))
    };

    for (const campo of HERDAVEIS) if (declarado(no, campo)) registro[campo] = no[campo];

    plano.set(id, registro);
    for (const [k, filho] of filhos) visitar(k, filho, id);

    // 2. o pai toma do tipo mais comum o que não disse de si
    if (no.comoO) {
      const emprestado = plano.get(`${id}${SEPARADOR}${no.comoO}`);
      if (emprestado) {
        for (const campo of EMPRESTAVEIS) {
          if (!registro.declarados.has(campo) && emprestado[campo] !== undefined) {
            registro[campo] = emprestado[campo];
            registro.emprestados ??= new Set();
            registro.emprestados.add(campo);
          }
        }
      }
    }
  };

  for (const [chave, no] of Object.entries(arvore)) visitar(chave, no, null);

  /* 3 — de cima para baixo, o subtipo completa o que falta com o do pai */
  for (const registro of plano.values()) {
    const pai = registro.pai ? plano.get(registro.pai) : null;
    if (!pai) continue;

    for (const campo of HERDAVEIS) {
      if (registro[campo] === undefined && pai[campo] !== undefined) registro[campo] = pai[campo];
    }
  }

  /* Normaliza o que as telas leem sem checar */
  for (const registro of plano.values()) {
    registro.comestivel = registro.comestivel !== false;
    registro.emCasa = registro.emCasa === true;
    registro.liquido = registro.liquido === true;
    registro.pesoPorUnidade ??= null;
    registro.nutrientes ??= null;
  }

  return Object.fromEntries(plano);
}

/** Índice plano: é por aqui que todo o resto do site fala com o catálogo. */
export const INGREDIENTES = achatar(ARVORE);

/* ------------------------------------------------------------- consultas */

export const ingrediente = id => INGREDIENTES[id];

export const existe = id => Object.hasOwn(INGREDIENTES, id);

export const ids = () => Object.keys(INGREDIENTES);

/** Só os nós de topo, na ordem em que foram escritos. */
export const raizes = () => ids().filter(id => !INGREDIENTES[id].pai);

/** Subtipos diretos. */
export const subtipos = id => INGREDIENTES[id]?.filhos ?? [];

/** É folha quem não tem subtipo — o mais específico que se pode pedir. */
export const ehFolha = id => subtipos(id).length === 0;

/**
 * O ingrediente e toda a sua descendência, ele primeiro.
 *
 * É o que faz a janela de produtos mostrar tudo quando a receita pede o pai:
 * pedindo "açúcar", cabem refinado, cristal e mascavo.
 */
export function descendentes(id) {
  if (!existe(id)) return [];

  const saida = [id];
  for (const filho of subtipos(id)) saida.push(...descendentes(filho));
  return saida;
}

/** `filho` é o próprio `ancestral` ou está abaixo dele. */
export const naSubarvore = (filho, ancestral) =>
  filho === ancestral || String(filho).startsWith(`${ancestral}${SEPARADOR}`);

/** Nomes do topo até aqui: ["açúcar", "açúcar refinado"]. */
export function linhagem(id) {
  const nomes = [];
  for (let atual = id; atual; atual = INGREDIENTES[atual]?.pai) {
    if (INGREDIENTES[atual]) nomes.unshift(INGREDIENTES[atual].nome);
  }
  return nomes;
}

/**
 * Assume-se que já está em casa?
 *
 * Vale para o ingrediente do catálogo e para o já resolvido, porque `resolve.js`
 * copia o campo. É o que tira sal e água da conta de custo e da lista de compras.
 */
export const temEmCasa = ing => ing?.emCasa === true;

/**
 * Agrupa ids que estão na mesma linhagem, sob o mais específico.
 *
 * Duas receitas no carrinho, uma pedindo "açúcar" e outra "açúcar refinado":
 * comprar refinado atende as duas, então é uma linha só, e é a exigência mais
 * específica que manda. Irmãos (refinado e cristal) não se juntam — comprar um
 * não resolve o outro.
 *
 * Devolve `id -> id do grupo`.
 */
export function grupoDeLinhagem(idsPedidos) {
  const unicos = [...new Set(idsPedidos)];
  const mapa = {};

  const nivel = x => INGREDIENTES[x]?.nivel ?? 0;

  /** O subtipo que o pai aponta como mais comum, se for este. */
  const ehMaisComum = x => {
    const pai = INGREDIENTES[x]?.pai;
    return Boolean(pai) && `${pai}${SEPARADOR}${INGREDIENTES[pai].comoO}` === x;
  };

  for (const id of unicos) {
    // Só quem está abaixo serve: comprar refinado atende "açúcar", não o contrário
    const candidatos = unicos.filter(outro => naSubarvore(outro, id));

    /* Desempate entre dois subtipos igualmente fundos — "açúcar refinado" e
       "açúcar cristal" pedidos junto com "açúcar" avulso: o avulso cai no tipo
       mais comum, que é a mesma escolha que o site faria sozinho. */
    mapa[id] = candidatos.reduce((melhor, atual) => {
      if (nivel(atual) !== nivel(melhor)) return nivel(atual) > nivel(melhor) ? atual : melhor;
      if (ehMaisComum(atual) && !ehMaisComum(melhor)) return atual;
      return melhor;
    }, id);
  }

  return mapa;
}

/* Os valores nutricionais são por 100 g (ou 100 ml, para líquidos), em base
 * crua, e são referências aproximadas de tabelas públicas (TACO / USDA).
 * Servem para estimativa; confira antes de exibir como informação nutricional.
 */
export const NUTRIENTES_POR = 100;

export const CAMPOS_NUTRIENTES = ["kcal", "proteina", "carboidrato", "gordura", "fibra", "sodio"];
