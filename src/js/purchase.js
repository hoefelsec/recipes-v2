/* A compra: o que o carrinho custa para cozinhar e o que custa para comprar.
 *
 * São dois números diferentes, e a diferença é o ponto:
 *
 *   refeições  o que as receitas consomem — 200 g de arroz custam 200 g de arroz
 *   compra     o que se leva do mercado — 200 g de arroz custam um pacote de 1 kg
 *
 * A sobra é real: fica no armário e serve para a próxima receita. Mostrar só o
 * primeiro número esconde o desembolso; mostrar só o segundo faz uma pitada de
 * fermento parecer uma compra de R$ 4,90. Os dois juntos dizem a verdade.
 *
 * Pedidos do mesmo ingrediente se juntam numa linha só: quem vai ao mercado
 * compra um pote de manteiga, e ele serve as duas receitas. Mas a junção existe
 * para poupar embalagem, não para impor consenso — se as receitas escolheram
 * produtos diferentes, a linha se divide e as DUAS vão para a lista. Comprar dois
 * potes é o que a pessoa pediu; mostrar um só seria decidir por ela.
 *
 * O MERCADO ATIVO entra como opção em `totaisDaCompra` e desce daqui para baixo:
 * com mercado, o produto de cada linha é escolhido entre o que aquele mercado vende
 * e precificado ao preço dali. Escolha que ele não vende continua na linha, sem
 * preço — a compra fica sendo um piso, e a tela avisa em amarelo.
 */

import { produtosDe, produto as produtoPorId } from "../data/produtos.js";
import { temEmCasa, grupoDeLinhagem, ingrediente, naSubarvore, SEPARADOR } from "../data/ingredientes.js";
import { aplicarEscolhas } from "../data/resolve.js";
import { ESCOPO_CARRINHO, carregarTenho } from "./choices.js";
import { emBase, precoUnitario, maisBarato, custo, custoDaReceita } from "./pricing.js";
import { quantidadeEmTexto, arredondar, UNIDADES } from "./units.js";

/**
 * Quanto vem na embalagem, na base em que o ingrediente se compara.
 * É o divisor que diz quantas embalagens são necessárias.
 */
function conteudoNaBase(p, ing) {
  const proprio = { qtd: p.qtd, un: p.un };
  const liquido = p.conteudo ? { qtd: p.qtd * p.conteudo.qtd, un: p.conteudo.un } : null;

  // "1 lata" com 395 g declarados: é o conteúdo que se mede, não a lata
  const medida = liquido ?? proprio;
  return emBase(medida.qtd, medida.un, ing);
}

/**
 * Soma o carrinho por ingrediente, na base comparável, e resolve o produto.
 *
 * `itens`: [{ receita, porcoes, qtd }] — as receitas já resolvidas.
 * `escolhas`: o mapa completo de `choices.js`.
 */
export function itensDaCompra(itens, escolhas = {}, mercado = null) {
  const slugs = [...new Set(itens.map(i => i.receita.slug))];
  const grupos = new Map();
  const deFora = [];

  /* Uma receita pode pedir "açúcar" e outra "açúcar refinado". Comprar refinado
     atende as duas, então é uma linha só, sob o pedido mais específico. Irmãos
     não se juntam: cristal não resolve quem pediu refinado. */
  const linhagens = grupoDeLinhagem(
    itens.flatMap(({ receita }) => receita.ingredientes.filter(i => i.id).map(i => i.id))
  );

  for (const { receita, porcoes, qtd } of itens) {
    const mult = (porcoes / receita.porcoes.padrao) * qtd;

    for (const ing of receita.ingredientes) {
      if (ing.subtitulo || temEmCasa(ing)) continue;

      if (ing.escala === false || ing.qtd == null) {
        deFora.push({ nome: ing.nome, motivo: "quantidade a gosto" });
        continue;
      }

      const chave = linhagens[ing.id] ?? ing.id;

      if (!grupos.has(chave)) {
        // O ingrediente do grupo é o do pedido mais específico, não o desta linha
        const doGrupo = chave === ing.id ? ing : { ...ing, ...ingrediente(chave), id: chave };
        grupos.set(chave, { ing: doGrupo, un: null, requisicoes: [] });
      }

      const g = grupos.get(chave);

      const emMedida = emBase(ing.qtd * mult, ing.un, ing);
      if (emMedida.qtd == null) {
        deFora.push({ nome: ing.nome, motivo: `não dá para medir ${ing.un}` });
        continue;
      }

      /* Base diferente no mesmo ingrediente não deveria acontecer — `emBase`
         depende do ingrediente, não da receita — mas se acontecer é melhor
         relatar do que somar grama com unidade. */
      if (g.un && g.un !== emMedida.un) {
        deFora.push({ nome: ing.nome, motivo: "medidas que não se somam" });
        continue;
      }

      g.un = emMedida.un;

      /* Uma requisição por linha de receita, e não um total já somado: é ela que
         permite dividir o grupo depois, se as receitas quiserem produtos
         diferentes. Somar primeiro seria perder de quem é cada grama. */
      g.requisicoes.push({
        slug: receita.slug, receita: receita.nome,
        ingId: ing.id, ing, qtd: emMedida.qtd
      });
    }
  }

  const linhas = [...grupos.values()]
    .filter(g => g.un)
    .flatMap(g => montarLinhas(g, escolhas, mercado));

  for (const l of linhas) {
    if (!l.produto) deFora.push({ nome: l.ing.nome, motivo: "sem produto no catálogo" });
    else if (l.embalagens == null) deFora.push({ nome: l.ing.nome, motivo: "embalagem que não se converte" });
  }

  return {
    linhas: linhas.sort((a, b) => a.ing.nome.localeCompare(b.ing.nome, "pt-BR")),
    linhagens,
    deFora
  };
}

/**
 * Quantas embalagens deste produto para cobrir `precisa`, e a que preço.
 *
 * Arredondado para cima: meia lata não se compra. É daí que sai a diferença entre
 * os dois totais, e por isso a sobra volta junto — para a tela poder explicá-la em
 * vez de deixar o leitor achando que a conta está errada.
 *
 * Devolve null quando a embalagem não se converte para a medida da necessidade.
 */
export function embalagensPara(produto, ing, precisa) {
  if (!produto || !precisa || !(precisa.qtd > 0)) return null;

  const conteudo = conteudoNaBase(produto, ing);
  const unitario = precoUnitario(produto, ing);

  /* `unitario.valor == null` é o produto que o mercado ativo não vende: contar
     embalagens dele daria "1 × R$ 0,00" na tela, o que parece uma promoção. */
  if (unitario.valor == null) return null;
  if (!(conteudo.qtd > 0) || conteudo.un !== precisa.un || unitario.un !== precisa.un) return null;

  /* A folga de 1e-9 evita que 450 g exatos em pacotes de 450 g virem dois
     pacotes por causa de um resto de ponto flutuante. */
  const embalagens = Math.ceil(precisa.qtd / conteudo.qtd - 1e-9);

  return {
    conteudo,
    embalagens,
    custoUsado: unitario.valor * precisa.qtd,
    custoCompra: embalagens * produto.preco,
    sobra: embalagens * conteudo.qtd - precisa.qtd
  };
}

const SEM_CONTA = { conteudo: null, embalagens: null, custoUsado: null, custoCompra: null, sobra: null };

/** O pedido mais específico entre os de uma linha — é ele que define a linha. */
const maisEspecifico = requisicoes =>
  requisicoes.reduce((a, b) =>
    (b.ingId.split(SEPARADOR).length > a.ingId.split(SEPARADOR).length ? b : a)).ing;

/**
 * Divide as requisições do grupo pelo produto que cada receita escolheu.
 *
 * A escolha vale se o produto serve o pedido DAQUELA receita, não o do grupo: o
 * bolo pediu "chocolate em pó" e escolheu o de 32%; o brigadeiro pediu o de 50%.
 * O de 32% serve o bolo e não serve o brigadeiro — são dois potes, e é por isso
 * que a junção se desfaz.
 *
 * Quem não escolheu nada fica em `semDono`: não tem preferência, e vai junto de
 * quem tiver, na linha do produto mais barato.
 */
function dividirPorProduto(requisicoes, escolhas, mercado) {
  const porProduto = new Map();
  const semDono = [];

  for (const r of requisicoes) {
    const id = escolhas?.[r.slug]?.[r.ingId];
    const p = id ? produtoPorId(id, mercado) : null;

    if (p && naSubarvore(p.ing, r.ingId)) {
      if (!porProduto.has(p.id)) porProduto.set(p.id, []);
      porProduto.get(p.id).push(r);
    } else {
      semDono.push(r);
    }
  }

  return { porProduto, semDono };
}

/**
 * As linhas de um grupo: uma, ou uma por produto quando as receitas discordam.
 *
 * Discordar não é defeito. Quem escolheu manteiga com sal na feijoada e sem sal no
 * brigadeiro quer dois potes, e a lista tem de dizer isso — antes o carrinho
 * mostrava um só, marcado como erro, e o outro simplesmente não era comprado.
 *
 * A escolha feita NO CARRINHO continua valendo para todos: ela é a decisão de
 * quem vai ao mercado, e serve justamente para juntar de novo o que se dividiu.
 */
function montarLinhas(g, escolhas, mercado) {
  const pedidos = [...new Set(g.requisicoes.map(r => r.ingId))];
  const doCarrinho = pedidos
    .map(id => escolhas?.[ESCOPO_CARRINHO]?.[id])
    .map(id => (id ? produtoPorId(id, mercado) : null))
    .find(p => p && naSubarvore(p.ing, g.ing.id));

  if (doCarrinho) return [linha(g.requisicoes, g.un, doCarrinho, "carrinho")];

  const { porProduto, semDono } = dividirPorProduto(g.requisicoes, escolhas, mercado);

  if (!porProduto.size) {
    return [linha(g.requisicoes, g.un, maisBarato(g.ing.id, g.ing, mercado), "automatico")];
  }

  /* Quem não tem preferência acompanha o mais barato entre os produtos já
     escolhidos: é a mesma régua que o site usa quando ninguém escolheu, e é o que
     evita abrir uma terceira embalagem por indecisão. */
  const grupos = [...porProduto.entries()].map(([id, reqs]) => ({ p: produtoPorId(id, mercado), reqs }));
  const barato = grupos.reduce((a, b) => {
    const ua = precoUnitario(a.p, g.ing).valor ?? Infinity;
    const ub = precoUnitario(b.p, g.ing).valor ?? Infinity;
    return ub < ua ? b : a;
  });
  barato.reqs = [...barato.reqs, ...semDono];

  const dividido = grupos.length > 1;

  return grupos
    .sort((a, b) => a.p.nome.localeCompare(b.p.nome, "pt-BR"))
    .map(({ p, reqs }) => linha(reqs, g.un, p, "receita", dividido ? grupos.map(x => x.p.id) : []));
}

/** Uma linha da compra: o que precisa, de qual produto, em quantas embalagens. */
function linha(requisicoes, un, produto, origem, divididaCom = []) {
  const ing = maisEspecifico(requisicoes);
  const precisa = { qtd: requisicoes.reduce((s, r) => s + r.qtd, 0), un };

  return {
    ing,
    /* Chave própria porque duas linhas podem ser do mesmo ingrediente: é ela que
       identifica a linha na tela e no "já tenho". */
    chave: divididaCom.length ? `${ing.id}#${produto.id}` : ing.id,
    receitas: [...new Set(requisicoes.map(r => r.receita))],
    /* Quem caiu nesta linha, com receita e pedido: a tela precisa do par, porque
       o mesmo ingrediente pode estar em duas linhas. */
    requisicoes: requisicoes.map(({ slug, receita, ingId }) => ({ slug, receita, ingId })),
    pedidos: [...new Set(requisicoes.map(r => r.ingId))],
    precisa,
    produto,
    origem,
    /* Os produtos entre os quais o grupo se dividiu, este incluído. Vazio quando
       não houve divisão. */
    divididaCom,
    ...(embalagensPara(produto, ing, precisa) ?? SEM_CONTA)
  };
}

/**
 * O produto que a compra resolveu, receita por receita.
 *
 * Serve para precificar cada receita do carrinho pelos MESMOS produtos que vão na
 * sacola. É por receita, e não por ingrediente, porque a compra pode levar dois
 * produtos do mesmo ingrediente — um para cada receita que o escolheu.
 */
export function escolhasEfetivas(linhas) {
  const saida = {};

  for (const l of linhas) {
    if (!l.produto) continue;
    for (const { slug, ingId } of l.requisicoes) {
      saida[slug] = { ...(saida[slug] ?? {}), [ingId]: l.produto.id };
    }
  }

  return saida;
}

/**
 * Quanto custa cada linha do carrinho.
 *
 * `total` é uma preparação; `linha` é `total × qtd`, que é o que aquela linha
 * contribui para o carrinho. `porPorcao` não muda com as porções — escalar
 * multiplica ingredientes e porções pelo mesmo fator.
 */
export function custoPorItem(itens, linhasDaCompra, mercado = null) {
  const efetivas = escolhasEfetivas(linhasDaCompra);

  return itens.map(({ receita, porcoes, qtd }) => {
    const comEscolhas = aplicarEscolhas(receita, efetivas[receita.slug] ?? {}, mercado);
    const c = custoDaReceita(comEscolhas, porcoes, mercado);

    return {
      receita, porcoes, qtd,
      total: c.total,
      linha: c.total * qtd,
      porPorcao: c.porPorcao,
      completa: c.completa,
      deFora: c.deFora
    };
  });
}

/**
 * Os quatro números do carrinho, mais o que ficou de fora deles.
 *
 *   refeicoes    o que as receitas consomem
 *   compra       o que se paga no caixa
 *   sobra        o que fica no armário do que se está levando
 *   economizado  o que não se leva porque já está em casa
 *
 * O que a pessoa marcou como "já tenho em casa" sai da compra e continua nas
 * refeições: você não paga a farinha hoje, mas o bolo leva farinha.
 *
 * `sobra` é somada linha por linha, e não como `compra - refeicoes`: com algo
 * marcado como já disponível, `refeicoes` conta o que aquela linha consome e
 * `compra` não conta o que ela custaria, então a subtração daria menos que a sobra
 * real — e, com bastante coisa em casa, um número negativo.
 *
 * `completa` é falso quando alguma linha não entrou em nenhum dos dois.
 */
export function totaisDaCompra(itens, escolhas = {}, { tenho = carregarTenho(), mercado = null } = {}) {
  const { linhas, linhagens, deFora } = itensDaCompra(itens, escolhas, mercado);

  let refeicoes = 0;
  let compra = 0;
  let sobra = 0;
  let economizado = 0;
  let contados = 0;
  let aComprar = 0;

  for (const l of linhas) {
    l.tenho = tenho.has(l.chave);
    if (l.custoUsado == null) continue;

    refeicoes += l.custoUsado;
    contados++;

    if (l.tenho) { economizado += l.custoCompra; continue; }

    compra += l.custoCompra;
    sobra += l.custoCompra - l.custoUsado;
    aComprar++;
  }

  return {
    linhas, linhagens, deFora, contados, aComprar,
    /* O mercado volta junto com os números: quem desenha precisa dele para pintar
       o aviso, e passá-lo duas vezes seria dar chance de divergirem. */
    mercado,
    porItem: custoPorItem(itens, linhas, mercado),
    refeicoes,
    compra,
    economizado,
    sobra,
    completa: deFora.length === 0
  };
}

/** "1 kg", "450 g", "3 un." — a quantidade de uma linha, pronta para ler. */
export function textoPrecisa({ qtd, un }) {
  const arredondado = arredondar(qtd, un);
  const texto = quantidadeEmTexto(arredondado, un);
  return UNIDADES[un]?.oculta ? `${texto} un.` : texto;
}

/** Reexportado para quem monta a tela e precisa do custo de uma linha isolada. */
export { custo };
