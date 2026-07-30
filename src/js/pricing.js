/* Preço: liga o que a receita pede ao que a prateleira vende.
 *
 * Três coisas, em camadas:
 *   precoUnitario  quanto custa 1 g / 1 ml / 1 unidade daquele produto
 *   maisBarato     entre os produtos do ingrediente, qual sai mais em conta
 *   custo          quanto custa a quantidade que a receita pede
 *
 * Nada disso é possível sem uma base comum. A embalagem fala uma língua ("1 kg",
 * "900 ml", "1 lata", "12 un.") e a receita fala outra ("2 copos", "6 dentes"),
 * e a tradução depende do ingrediente: 1 dente pesa 4 g porque é alho.
 *
 * Quando a tradução não existe, a resposta é null — e a tela mostra "???" em vez
 * de um número inventado.
 *
 * O MERCADO ATIVO atravessa tudo aqui como argumento, nunca como estado escondido:
 * `mercado = null` é "compare entre todos", e um id de mercado é "só o que se compra
 * ali, ao preço dali". Passar em vez de guardar é o que deixa o teste escolher o
 * mercado sem mexer em `localStorage`.
 */

import { produtosDe } from "../data/produtos.js";
import { temEmCasa } from "../data/ingredientes.js";
import { converter, familia, emGramas, quantidadeEmTexto, UNIDADES } from "./units.js";

export const formatarPreco = valor =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Custo de uma linha, pronto para a tela.
 * Abaixo de meio centavo, "R$ 0,00" faria parecer de graça — o que é falso, e
 * "< R$ 0,01" diz a mesma coisa sem mentir.
 */
export const textoCusto = valor =>
  valor > 0 && valor < 0.005 ? "< R$ 0,01" : formatarPreco(valor);

/**
 * Quanto vem na embalagem, na unidade de medida do produto.
 * Para lata/pacote usa-se o conteúdo líquido, quando informado.
 */
function medidaDaEmbalagem(p) {
  if (familia(p.un)) return { qtd: p.qtd, un: p.un };
  if (p.conteudo && familia(p.conteudo.un)) {
    return { qtd: p.qtd * p.conteudo.qtd, un: p.conteudo.un };
  }
  return { qtd: p.qtd, un: p.un };   // "1 lata", "100 un." — conta como unidade
}

/**
 * Preço de gôndola: { valor, un }.
 *
 * Não é o mesmo que `precoUnitario`. Aquele existe para a máquina comparar, e
 * por isso puxa tudo para grama; este existe para a pessoa ler, e por isso segue
 * a embalagem — óleo em litro, açúcar em quilo, ovo em unidade. "R$ 13,22/L" se
 * lê; "R$ 0,0144/g" não, e "R$ 24,83/kg de ovo" muito menos.
 */
export function precoDeReferencia(p) {
  const m = medidaDaEmbalagem(p);
  const fam = familia(m.un);

  /* Produto sem preço — o mercado ativo não o vende — não vale zero. `null / 1000`
     daria 0, e "R$ 0,00/kg" é a mentira mais convincente que este arquivo poderia
     contar. */
  if (p.preco == null) return { valor: null, un: fam === "volume" ? "L" : (fam ? "kg" : m.un) };

  if (!fam) return { valor: p.preco / m.qtd, un: m.un };

  const mil = (m.qtd * UNIDADES[m.un].base) / 1000;   // em kg ou em L
  return { valor: p.preco / mil, un: fam === "volume" ? "L" : "kg" };
}

/**
 * "1 kg", "900 ml", "12 un.", "1 lata (395 g)" — a embalagem como ela se lê.
 *
 * Diferente da medida que `emBase` devolve: aquela é para a máquina somar e vem
 * em grama; esta é o que está escrito no rótulo. Um litro de leite não é
 * "1,03 kg" na prateleira, mesmo que a conta interna use isso.
 */
export function textoEmbalagem(p) {
  const proprio = quantidadeEmTexto(p.qtd, p.un) || `${p.qtd}`;
  const rotulo = UNIDADES[p.un]?.oculta ? `${proprio} un.` : proprio;

  return p.conteudo
    ? `${rotulo} (${quantidadeEmTexto(p.conteudo.qtd, p.conteudo.un)})`
    : rotulo;
}

/** "R$ 4,50/kg" — o preço de gôndola pronto para ler. */
export function textoPrecoUnitario(p) {
  const r = precoDeReferencia(p);
  if (r.valor == null) return "sem preço neste mercado";
  return `${formatarPreco(r.valor)}/${r.un}`;
}

/**
 * Traduz uma quantidade para a base em que se pode comparar preço.
 *
 * Grama primeiro, porque é a medida que serve para qualquer ingrediente: com
 * densidade, volume vira peso; com `pesoPorUnidade`, contável também. Volume sem
 * densidade fica em ml. O que não traduz fica na própria unidade, e aí só se
 * compara com quem estiver na mesma.
 */
export function emBase(qtd, un, ing = {}) {
  const g = emGramas(qtd, un, ing);
  if (g != null) return { qtd: g, un: "g" };

  if (familia(un) === "volume") return { qtd: converter(qtd, un, "ml"), un: "ml" };

  return { qtd, un };
}

/**
 * Preço por unidade base: { valor, un }.
 *
 * Com `ing`, a base é a mesma para todos os produtos do ingrediente — é o que
 * permite comparar uma dúzia de ovos com um ovo a granel. Sem `ing`, peso e
 * volume viram R$/g e R$/ml e o resto fica na unidade da embalagem.
 */
export function precoUnitario(p, ing = {}) {
  const medida = medidaDaEmbalagem(p);
  const base = emBase(medida.qtd, medida.un, ing);

  // Sem preço não há preço por grama: null atravessa, e a conta toda para aqui
  if (p.preco == null) return { valor: null, un: base.un };

  return base.qtd > 0
    ? { valor: p.preco / base.qtd, un: base.un }
    : { valor: null, un: base.un };
}

/**
 * Custo de `qtd` `un` de um ingrediente, usando um produto.
 * Devolve null quando as medidas não se traduzem para a mesma base.
 */
export function custo(p, qtd, un, ing = {}) {
  if (qtd == null || !un) return null;

  /* Sem preço, sem conta. O guarda vem antes dos dois caminhos porque o de baixo
     divide: `null / p.qtd * qtd` é 0 em JavaScript, e a janela de produtos precifica
     produtos fora do mercado direto por aqui — mostrava "R$ 0,00" para o que aquele
     mercado não vende. */
  if (p?.preco == null) return null;

  /* Unidade sem tradução (lata, un., pacote) casa com ela mesma: a receita pede
     "1 lata" e é a embalagem que responde, mesmo que a lata tenha preço por kg
     via conteúdo líquido. */
  const pedido = emBase(qtd, un, ing);
  if (pedido.un === un && !familia(un) && un === p.un) {
    return (p.preco / p.qtd) * qtd;
  }

  const unitario = precoUnitario(p, ing);
  if (unitario.valor == null || unitario.un !== pedido.un || pedido.qtd == null) return null;

  return unitario.valor * pedido.qtd;
}

/**
 * Produto mais barato do ingrediente, por unidade base.
 *
 * Produto que não chega à base comum sai da comparação: comparar R$/g com R$/un.
 * não é comparar. Se nenhum chegar, vale o primeiro que existir — é o único
 * candidato de fato.
 */
export function maisBarato(ingId, ing = {}, mercado = null) {
  const lista = produtosDe(ingId, mercado);
  if (!lista.length) return null;

  const comPreco = lista
    .map(p => ({ p, u: precoUnitario(p, ing) }))
    .filter(({ u }) => u.valor != null);

  if (!comPreco.length) return lista[0];

  // Base mais frequente: é nela que a comparação é legítima
  const contagem = new Map();
  for (const { u } of comPreco) contagem.set(u.un, (contagem.get(u.un) ?? 0) + 1);
  const base = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const candidatos = comPreco.filter(({ u }) => u.un === base);
  return candidatos.reduce((a, b) => (b.u.valor < a.u.valor ? b : a)).p;
}

/**
 * Custo estimado de um ingrediente já resolvido, pelo produto mais barato.
 *
 * `qtd` permite pedir outra quantidade que não a do arquivo — é o que a página
 * usa quando o leitor muda o número de porções.
 *
 * Devolve { valor, produto, unitario } ou null quando não dá para calcular.
 */
export function custoDoIngrediente(ing, qtd = ing?.qtd, mercado = null) {
  // Sal e água se assume que já estão em casa: a pitada custa R$ 0,0013, e
  // precificar isso não informa nada — só dá ao resto um ar de precisão falso
  if (!ing || ing.escala === false || temEmCasa(ing)) return null;

  /* O produto que o leitor escolheu manda. Sem escolha, o mais barato — é
     palpite razoável, e a janela de produtos existe justamente para trocá-lo.

     Escolha que o mercado ativo não vende NÃO é substituída por outra: devolve
     null, a linha mostra "???" e o total vira um piso. Trocar por conta própria
     seria fazer a compra no lugar da pessoa, e ela nem saberia. */
  const p = ing.produto ?? maisBarato(ing.id, ing, mercado);
  if (!p || p.preco == null) return null;

  const valor = custo(p, qtd, ing.un, ing);
  if (valor === null) return null;

  return {
    valor, produto: p,
    unitario: precoUnitario(p, ing),
    escolhido: Boolean(ing.produto)
  };
}

/**
 * Os produtos de um ingrediente, com tudo o que a janela de escolha precisa
 * mostrar, já na ordem pedida.
 *
 * Cada opção traz o preço da embalagem (o que sai da carteira), o preço de
 * gôndola (o que permite comparar tamanhos) e o custo desta linha da receita
 * (o que muda na conta se a escolha mudar).
 *
 * `ordem`:
 *   recentes    usados há pouco primeiro; o resto pelo preço de medida, que é a
 *               mesma régua do automático — com histórico vazio, a lista abre
 *               justamente na ordem que o site usaria sozinho
 *   nome · embalagem · unitario
 */
export function opcoesDeProduto(ing, {
  ordem = "recentes", recentes = [], qtd = ing?.qtd, un = ing?.un, emUso = new Set(),
  mercado = null
} = {}) {
  // Com mercado ativo, a janela só oferece o que se compra ali
  const opcoes = produtosDe(ing.id, mercado).map(p => ({
    id: p.id,
    produto: p,
    embalagem: medidaDaEmbalagem(p),
    referencia: precoDeReferencia(p),
    unitario: precoUnitario(p, ing),
    /* `un` separado de `ing.un` porque o carrinho pergunta em outra medida: a
       receita pede "2 copos", a compra somada pede "450 g". */
    custo: custo(p, qtd, un, ing),
    recencia: recentes.indexOf(p.id),
    /* Já escolhido para outra receita do mesmo carrinho. Vale destaque porque
       reaproveitar o pote que já vai na sacola é quase sempre o que se quer —
       e o contrário, dois potes do mesmo ingrediente, é dinheiro parado. */
    emUso: emUso.has(p.id)
  }));

  const porUnitario = (a, b) => (a.referencia.valor ?? Infinity) - (b.referencia.valor ?? Infinity);

  const comparadores = {
    nome: (a, b) => a.produto.nome.localeCompare(b.produto.nome, "pt-BR"),
    /* `?? Infinity` nos dois: `null - 5` é `-5`, então sem guarda o produto que este
       mercado não vende subia ao TOPO da lista de preços, como se fosse o mais barato.
       Sem preço vai para o fim. */
    embalagem: (a, b) => (a.produto.preco ?? Infinity) - (b.produto.preco ?? Infinity),
    unitario: porUnitario,
    recentes: (a, b) => {
      const ra = a.recencia < 0 ? Infinity : a.recencia;
      const rb = b.recencia < 0 ? Infinity : b.recencia;
      return ra === rb ? porUnitario(a, b) : ra - rb;
    }
  };

  const escolhido = comparadores[ordem] ?? comparadores.recentes;

  /* O que já está no carrinho vem primeiro, seja qual for a ordenação: não é uma
     ordem entre iguais, é um aviso de que aquele pote já está indo. */
  return opcoes.sort((a, b) => (a.emUso === b.emUso ? escolhido(a, b) : (a.emUso ? -1 : 1)));
}

/**
 * Por que uma linha ficou sem preço, em português e sem rodeio.
 *
 * Três motivos diferentes, e a tela pinta cada um de outra cor — misturá-los num
 * "sem produto que sirva" genérico era o que impedia distinguir "você escolheu algo
 * que aqui não tem" de "aqui não tem nada disso".
 */
export function motivoSemPreco(ing, mercado = null) {
  if (!mercado) return "sem produto que sirva";
  if (ing?.produto?.foraDoMercado) return "o produto escolhido não é vendido aqui";
  if (produtosDe(ing.id, mercado).length === 0) return "nenhum produto vendido aqui";
  return "sem produto que sirva";
}

/**
 * Custo da receita inteira e por porção, no número de porções pedido.
 *
 * O que fica de fora é relatado, não escondido: uma linha "a gosto" não tem
 * quantidade para precificar, e ingrediente sem produto que sirva não tem preço.
 * Somar o resto e chamar de total seria dizer que a conta fechou.
 *
 * O que se assume ter em casa (sal, água) não conta como lacuna: é decisão, não
 * falta de dado.
 *
 * Devolve { total, porPorcao, contados, deFora, completa }.
 */
export function custoDaReceita(receita, porcoes = receita.porcoes.padrao, mercado = null) {
  const mult = porcoes / receita.porcoes.padrao;
  const deFora = [];
  let total = 0;
  let contados = 0;

  for (const ing of receita.ingredientes) {
    if (ing.subtitulo || temEmCasa(ing)) continue;

    if (ing.escala === false || ing.qtd == null) {
      deFora.push({ nome: ing.nome, motivo: "quantidade a gosto" });
      continue;
    }

    const c = custoDoIngrediente(ing, ing.qtd * mult, mercado);
    if (!c) {
      deFora.push({ nome: ing.nome, motivo: motivoSemPreco(ing, mercado) });
      continue;
    }

    total += c.valor;
    contados++;
  }

  return {
    total,
    /* Nota: o custo por porção não depende do seletor. Escalar multiplica os
       ingredientes e as porções pelo mesmo fator, e a divisão cancela — como nos
       nutrientes. Ainda assim se calcula a partir do total exibido, para que os
       dois números da tela sempre fechem entre si. */
    porPorcao: porcoes > 0 ? total / porcoes : null,
    contados,
    deFora,
    completa: deFora.length === 0
  };
}
