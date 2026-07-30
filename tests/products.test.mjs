/* Testes da tabela de produtos e do cálculo de preço. */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

/* Raiz do projeto, a partir deste arquivo — assim os testes rodam de qualquer lugar */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const falhas = [];
const ok = (nome, fn) => {
  try { fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n").slice(0, 3).join(" | ")); }
};

const { PRODUTOS, ids, produtosDe, produto, CAMPOS_NUTRIENTES } = await import(`${RAIZ}/src/data/produtos.js`);
const M = await import(`${RAIZ}/src/data/mercados.js`);
const P = await import(`${RAIZ}/src/data/precos.js`);
const { INGREDIENTES } = await import(`${RAIZ}/src/data/ingredientes.js`);
const { receitas } = await import(`${RAIZ}/src/data/index.js`);
const { unidadeConhecida, familia, densidadeDe } = await import(`${RAIZ}/src/js/units.js`);
const { precoUnitario, custo, maisBarato, custoDoIngrediente, custoDaReceita, formatarPreco, textoCusto,
        textoPrecoUnitario, precoDeReferencia, opcoesDeProduto } =
  await import(`${RAIZ}/src/js/pricing.js`);
const P_pricing = await import(`${RAIZ}/src/js/pricing.js`);

const perto = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

/* ------------------------------------------------------------- integridade */

console.log("\nMERCADOS");
ok("[PRD-07][PRD-08] todo mercado tem nome e logo", () => {
  for (const [id, m] of Object.entries(M.MERCADOS)) {
    assert.ok(m.nome?.trim(), `${id}: sem nome`);
    assert.match(m.logo ?? "", /^public\/images\/mercados\/.+\.svg$/, `${id}: logo fora do lugar`);
  }
});
ok("[PRD-08] o arquivo do logo existe de verdade", () => {
  /* Caminho de arquivo é o tipo de dado que ninguém confere até a imagem faltar na
     tela — e aqui não há tela ainda para faltar. */
  for (const [id, m] of Object.entries(M.MERCADOS)) {
    assert.ok(existsSync(`${RAIZ}/${m.logo}`), `${id}: ${m.logo} não está no disco`);
  }
});
ok("[PRD-09] `mercado()` traz o id junto, e null para quem não existe", () => {
  assert.equal(M.mercado("zaffari").id, "zaffari");
  assert.equal(M.mercado("mercado-que-nao-existe"), null);
});
ok("[PRD-10] a lista de mercados sai em ordem de nome", () => {
  const nomes = M.mercados().map(m => m.nome);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
});

console.log("\nPREÇOS: A LIGAÇÃO MERCADO x PRODUTO");
ok("[PRD-15] todo mercado da tabela de preços existe", () => {
  for (const id of Object.keys(P.PRECOS)) {
    assert.ok(M.existe(id), `preços de um mercado fora do cadastro: "${id}"`);
  }
});
ok("[PRD-15] todo produto da tabela de preços existe", () => {
  for (const [mercadoId, tabela] of Object.entries(P.PRECOS)) {
    for (const produtoId of Object.keys(tabela)) {
      assert.ok(PRODUTOS[produtoId], `${mercadoId}: produto "${produtoId}" fora do catálogo`);
    }
  }
});
ok("[PRD-14] todo preço é um número positivo", () => {
  for (const [mercadoId, tabela] of Object.entries(P.PRECOS)) {
    for (const [produtoId, valor] of Object.entries(tabela)) {
      assert.ok(typeof valor === "number" && valor > 0 && Number.isFinite(valor),
        `${mercadoId}/${produtoId}: preço inválido (${valor})`);
    }
  }
});
ok("[PRD-16] todo produto é vendido em ao menos um mercado", () => {
  /* Produto que ninguém vende é catálogo sujo, do mesmo jeito que ingrediente que
     nenhuma receita usa. E sem preço nenhum ele apareceria como "???" na tela, o
     que é honesto mas inútil. */
  const orfaos = ids().filter(id => P.precosDe(id).length === 0);
  assert.deepEqual(orfaos, [], `sem preço em mercado nenhum: ${orfaos.join(", ")}`);
});
ok("[PRD-12] a ligação é 0-1: um preço por par", () => {
  // Garantido pela forma do objeto, e é justamente por isso que ela foi escolhida
  for (const [mercadoId, tabela] of Object.entries(P.PRECOS)) {
    const chaves = Object.keys(tabela);
    assert.equal(new Set(chaves).size, chaves.length, `${mercadoId}: produto repetido`);
  }
});
ok("[PRD-13] `preco()` devolve null para o que o mercado não vende", () => {
  const [mercadoId, tabela] = Object.entries(P.PRECOS)[0];
  const vendido = Object.keys(tabela)[0];
  const naoVendido = ids().find(id => !Object.hasOwn(tabela, id));

  assert.equal(P.preco(mercadoId, vendido), tabela[vendido]);
  assert.equal(P.preco(mercadoId, naoVendido), null, "não vender não é vender de graça");
  assert.equal(P.preco("mercado-que-nao-existe", vendido), null);
});
ok("[PRD-17] `precosDe()` sai do mais barato ao mais caro", () => {
  for (const id of ids()) {
    const valores = P.precosDe(id).map(x => x.preco);
    assert.deepEqual(valores, [...valores].sort((a, b) => a - b), `${id}: fora de ordem`);
  }
});
ok("[PRD-17] `maisBarato()` é o primeiro da lista, com o mercado junto", () => {
  const comVarios = ids().find(id => P.precosDe(id).length > 1);
  assert.ok(comVarios, "o catálogo devia ter algum produto em mais de um mercado");

  const melhor = P.maisBarato(comVarios);
  const todos = P.precosDe(comVarios);
  assert.equal(melhor.preco, Math.min(...todos.map(x => x.preco)));
  assert.ok(M.existe(melhor.mercado));
});
ok("[PRD-20][PRD-23] o produto lido já vem com o melhor preço e o mercado dele", () => {
  for (const id of ids()) {
    const p = produto(id);
    const melhor = P.maisBarato(id);
    assert.equal(p.preco, melhor.preco, `${id}: preço não é o melhor`);
    assert.equal(p.mercado, melhor.mercado, `${id}: sem o mercado do preço`);
  }
});
ok("[PRD-19] mais de um mercado vende o mesmo produto por preços diferentes", () => {
  // Sem isto, a tabela nova não estaria provando nada
  const disputados = ids().filter(id => new Set(P.precosDe(id).map(x => x.preco)).size > 1);
  assert.ok(disputados.length >= 10, `só ${disputados.length} produtos com preços concorrentes`);
});

console.log("\nMERCADO ATIVO: O QUE ELE FILTRA E PRECIFICA");
ok("[PRD-22] com mercado, o preço é o daquele mercado", () => {
  const id = "farinha-dona-benta-1kg";
  for (const { mercado, preco } of P.precosDe(id)) {
    assert.equal(produto(id, mercado).preco, preco, mercado);
    assert.equal(produto(id, mercado).mercado, mercado);
  }
});
ok("[PRD-23][SHL-18] sem mercado, o preço é o mais barato entre todos", () => {
  const id = "farinha-dona-benta-1kg";
  const melhor = P.maisBarato(id);
  assert.equal(produto(id).preco, melhor.preco);
  assert.ok(P.precosDe(id).length > 1, "e há mais de um para escolher");
});
ok("[ING-19][PRD-21] produto que o mercado não vende: preço null e `foraDoMercado`", () => {
  /* Três desfechos diferentes, e a diferença é o que separa o aviso do defeito:
     preço, "aqui não vende" e "ninguém vende". */
  const semAqui = ids().find(id => !P.vendeEm("nacional", id));
  const p = produto(semAqui, "nacional");

  assert.equal(p.preco, null, "não vender não é vender de graça");
  assert.equal(p.mercado, null);
  assert.equal(p.foraDoMercado, true, "é isto que a tela pinta de amarelo");

  assert.equal(produto(semAqui).foraDoMercado, false, "sem mercado, nada fica de fora");
});
ok("[PRD-25] `produtosDe` com mercado só devolve o que se compra ali", () => {
  for (const m of M.ids()) {
    for (const ing of ["manteiga", "leite", "ovo"]) {
      const doMercado = produtosDe(ing, m);
      assert.ok(doMercado.every(p => P.vendeEm(m, p.id)), `${m}/${ing}`);
      assert.ok(doMercado.length <= produtosDe(ing).length);
    }
  }
});
ok("[PRD-27] cada mercado deixa algum ingrediente sem nenhum produto", () => {
  /* É o caso VERMELHO, e ele tem de existir em todos os mercados para poder ser
     conferido em todos — inclusive no mais completo. */
  const usados = [...new Set(
    receitas.flatMap(r => r.ingredientes.filter(i => !i.subtitulo && i.id).map(i => i.id))
  )];

  for (const m of M.ids()) {
    const vazios = usados.filter(id => produtosDe(id, m).length === 0);
    assert.ok(vazios.length > 0, `${m} vende tudo: não há caso de vermelho para testar`);
  }
});
ok("[PRD-27] há um caso de amarelo montado de propósito", () => {
  /* Escolha que um mercado não vende, tendo o ingrediente outro produto ali: é o
     que distingue "escolha outro" de "aqui não tem". */
  const casos = [];

  for (const m of M.ids()) {
    for (const id of ids()) {
      const p = produto(id);
      if (P.vendeEm(m, id)) continue;
      if (produtosDe(p.ing, m).length > 0) casos.push(`${m}/${id}`);
    }
  }

  assert.ok(casos.length >= 3, `poucos casos de amarelo: ${casos.join(", ")}`);
});
ok("[PRC-27] o custo da receita muda de mercado para mercado", () => {
  const { custoDaReceita } = P_pricing;
  const bolo = receitas.find(r => r.slug === "bolo-de-cenoura");
  const totais = M.ids().map(m => custoDaReceita(bolo, 12, m).total);

  assert.equal(new Set(totais).size, totais.length, "dois mercados com o mesmo total é suspeito");
  assert.ok(totais.every(t => t > 0));
});
ok("[LIS-07][PRC-25][PRC-28] mercado incompleto declara o total como piso", () => {
  const { custoDaReceita } = P_pricing;
  const bolo = receitas.find(r => r.slug === "bolo-de-cenoura");

  const asun = custoDaReceita(bolo, 12, "asun");
  assert.equal(asun.completa, false, "o Asun não vende tudo do bolo");
  assert.ok(asun.deFora.some(x => /vendido/.test(x.motivo)), JSON.stringify(asun.deFora));
});

console.log("\nPRODUTOS: INTEGRIDADE");
ok("[PRD-01] todo produto aponta para um ingrediente que existe", () => {
  for (const [id, p] of Object.entries(PRODUTOS)) {
    assert.ok(p.ing, `${id}: sem chave de ingrediente`);
    assert.ok(INGREDIENTES[p.ing], `${id}: ingrediente "${p.ing}" fora do catálogo`);
  }
});
ok("[ING-16] todo ingrediente usado em receita tem ao menos um produto", () => {
  const usados = new Set(
    receitas.flatMap(r => r.ingredientes.filter(i => !i.subtitulo).map(i => i.id))
  );
  const semProduto = [...usados].filter(id => produtosDe(id).length === 0);
  assert.deepEqual(semProduto, [], `sem produto: ${semProduto.join(", ")}`);
});
ok("[PRD-03] a quantidade da embalagem é positiva", () => {
  for (const [id, p] of Object.entries(PRODUTOS)) {
    assert.ok(typeof p.qtd === "number" && p.qtd > 0, `${id}: qtd inválida`);
  }
});
ok("[PRD-05] o registro cru não carrega preço", () => {
  /* O preço é do par mercado+produto e vive em `precos.js`. Um `preco` de volta no
     registro seria um segundo lugar dizendo quanto custa — e o mais fácil de
     esquecer de atualizar. */
  for (const [id, p] of Object.entries(PRODUTOS)) {
    assert.ok(!("preco" in p), `${id}: preço no registro do produto`);
  }
});
ok("[PRD-03] a unidade da embalagem é conhecida", () => {
  for (const [id, p] of Object.entries(PRODUTOS)) {
    assert.ok(unidadeConhecida(p.un), `${id}: unidade "${p.un}" não registrada`);
    if (p.conteudo) assert.ok(unidadeConhecida(p.conteudo.un), `${id}: conteúdo em "${p.conteudo.un}"`);
  }
});
ok("[PRD-04] conteúdo líquido só onde a unidade não é medida", () => {
  // "1 lata" precisa dizer quanto pesa; "500 g" já se mede sozinho
  for (const [id, p] of Object.entries(PRODUTOS)) {
    if (p.conteudo) assert.equal(familia(p.un), null, `${id}: conteúdo redundante em unidade de medida`);
  }
});
ok("[PRD-02] todo produto tem nome", () => {
  for (const [id, p] of Object.entries(PRODUTOS)) {
    assert.ok(p.nome && p.nome.length > 2, `${id}: sem nome`);
  }
});

console.log("\nPRODUTOS: NUTRIENTES (opcionais e parciais)");
ok("[PRD-06] produto sem nutrientes é aceito", () => {
  const semNutriente = ids().filter(id => !PRODUTOS[id].nutrientes);
  assert.ok(semNutriente.length > 0, "o teste precisa de pelo menos um caso");
  for (const id of semNutriente) assert.equal(PRODUTOS[id].nutrientes, undefined);
});
ok("[NUT-32][PRD-06] rótulo parcial é aceito (só proteína, carboidrato e gordura)", () => {
  const feijao = produto("feijao-sao-joao-1kg");
  assert.deepEqual(Object.keys(feijao.nutrientes).sort(), ["carboidrato", "gordura", "proteina"]);
});
ok("[PRD-06] todo campo de nutriente informado é conhecido e não negativo", () => {
  for (const [id, p] of Object.entries(PRODUTOS)) {
    if (!p.nutrientes) continue;
    for (const [campo, valor] of Object.entries(p.nutrientes)) {
      assert.ok(CAMPOS_NUTRIENTES.includes(campo), `${id}: campo desconhecido "${campo}"`);
      assert.equal(typeof valor, "number", `${id}: "${campo}" não é número`);
      assert.ok(valor >= 0, `${id}: "${campo}" negativo`);
    }
    if (p.nutrientes.kcal != null) assert.ok(p.nutrientes.kcal <= 900, `${id}: kcal impossível`);
  }
});

/* ------------------------------------------------------------------ preço */

console.log("\nPREÇO UNITÁRIO");
ok("[PRC-07] peso vira preço por grama", () => {
  const u = precoUnitario(produto("feijao-sao-joao-1kg"));   // 1000 g por R$ 8,00
  assert.equal(u.un, "g");
  assert.ok(perto(u.valor, 0.008), String(u.valor));   // 1000 g por R$ 8,00
});
ok("[PRC-07] volume vira preço por ml", () => {
  const u = precoUnitario(produto("oleo-liza-900ml"));       // 900 ml por R$ 11,90
  assert.equal(u.un, "ml");
  assert.ok(perto(u.valor, 11.9 / 900), String(u.valor));
});
ok("[PRC-07] contável vira preço por unidade", () => {
  const u = precoUnitario(produto("ovos-brancos-12un"));     // 12 un. por R$ 14,90
  assert.equal(u.un, "un.");
  assert.ok(perto(u.valor, 14.9 / 12), String(u.valor));
});
ok("[PRC-01][PRC-07] lata usa o conteúdo líquido para virar preço por grama", () => {
  const u = precoUnitario(produto("leite-condensado-moca-lata"));  // 395 g por R$ 8,49
  assert.equal(u.un, "g");
  assert.ok(perto(u.valor, 8.49 / 395), String(u.valor));
});
ok("[PRC-09] embalagem maior pode sair mais barata por quilo", () => {
  const uniao = precoUnitario(produto("acucar-uniao-1kg")).valor;
  const guarani = precoUnitario(produto("acucar-guarani-5kg")).valor;
  assert.ok(guarani < uniao, "o pacote de 5000 g devia ter o grama mais barato");
  assert.equal(maisBarato("acucar").id, "acucar-guarani-5kg");
});
ok("[PRC-15][PRD-24] mais barato compara todos os produtos do ingrediente", () => {
  assert.equal(maisBarato("feijao-preto").id, "feijao-sao-joao-1kg");
  assert.equal(maisBarato("manteiga").id, "manteiga-aviacao-200g");
  assert.equal(maisBarato("manteiga/sem-sal").id, "manteiga-president-200g");
  assert.equal(maisBarato("leite").id, "leite-italac-1l", "compara os três, de dois subtipos");
  assert.equal(maisBarato("leite/desnatado").id, "leite-desnatado-italac-1l");
});
ok("[PRC-16] ingrediente sem produto não tem mais barato", () => {
  assert.equal(maisBarato("nao-existe"), null);
});

console.log("\nCUSTO DA QUANTIDADE PEDIDA");
ok("[PRC-13] mesma unidade da embalagem", () => {
  // A embalagem guarda 1000 g; "1 kg" é só como isso se escreve
  assert.ok(perto(custo(produto("feijao-sao-joao-1kg"), 1000, "g"), 8.0));
  assert.ok(perto(custo(produto("feijao-sao-joao-1kg"), 2000, "g"), 16.0));
});
ok("[PRC-13] converte dentro da família", () => {
  // 300 g de carne seca a R$ 34,90 / 500 g
  assert.ok(perto(custo(produto("carne-seca-friboi-500g"), 300, "g"), 34.9 * 0.6));
  // 4 col. sopa (60 ml) de leite a R$ 5,49 / L
  assert.ok(perto(custo(produto("leite-italac-1l"), 4, "col. sopa"), 5.49 * 0.06));
});
ok("[PRC-13] cruza volume e peso quando há densidade", () => {
  // 2 copos = 360 ml · densidade 1 g/ml -> 360 g de açúcar refinado
  const acucar = receitas[2].ingredientes.find(i => i.id === "acucar/refinado" && i.un === "copo");
  const c = custo(maisBarato("acucar/refinado", acucar), acucar.qtd, acucar.un, acucar);
  assert.ok(perto(c, (5.2 / 1000) * 360), String(c));
});
ok("[PRC-15][PRD-24] pedindo o pai, o mais barato pode vir de qualquer subtipo", () => {
  // "açúcar" sem dizer qual: o cristal de 5 kg sai mais barato por quilo
  assert.equal(maisBarato("acucar").id, "acucar-guarani-5kg");
  assert.equal(maisBarato("acucar/refinado").id, "acucar-uniao-1kg", "pedindo refinado, só há um");
});
ok("[PRC-13] contável vira peso pelo pesoPorUnidade", () => {
  // 6 dentes de alho a 4 g cada = 24 g de uma cabeça de 200 g por R$ 7,90
  const alho = receitas[0].ingredientes.find(i => i.id === "alho");
  assert.ok(perto(custo(produto("alho-cabeca-200g"), 6, "dente", alho), (7.9 / 200) * 24));

  const cebola = receitas[0].ingredientes.find(i => i.id === "cebola");
  assert.ok(perto(custo(produto("cebola-granel-1kg"), 2, "un.", cebola), (5.9 / 1000) * 300));
});
ok("[PRC-08] a dúzia de ovos e o ovo solto viram comparáveis", () => {
  // 12 un. x 50 g = 600 g por R$ 14,90; a receita pede 3 ovos = 150 g
  const ovo = receitas[2].ingredientes.find(i => i.id === "ovo");
  const u = precoUnitario(produto("ovos-brancos-12un"), ovo);
  assert.equal(u.un, "g");
  assert.ok(perto(u.valor, 14.9 / 600), String(u.valor));
  assert.ok(perto(custo(produto("ovos-brancos-12un"), 3, "un.", ovo), (14.9 / 12) * 3),
    "pelo peso ou pela unidade, o preço é o mesmo");
});
ok("[PRC-08] sem o ingrediente, a base é a da embalagem", () => {
  // é o que mantém `precoUnitario(p)` comparável entre produtos iguais
  assert.equal(precoUnitario(produto("ovos-brancos-12un")).un, "un.");
  assert.equal(precoUnitario(produto("ovos-brancos-12un"), {}).un, "un.");
});
ok("[PRC-14] sem densidade, volume não vira peso: devolve null", () => {
  // chocolate em pó é vendido em gramas e a receita pede colheres
  assert.equal(custo(produto("chocolate-po-garoto-200g"), 4, "col. sopa"), null);
});
ok("[PRC-01][PRC-12] unidade sem equivalência casa só com ela mesma", () => {
  assert.ok(perto(custo(produto("leite-condensado-moca-lata"), 1, "lata"), 8.49));
  assert.ok(perto(custo(produto("forminha-n4-100un"), 25, "un."), 6.9 * 0.25));
  assert.equal(custo(produto("sal-cisne-1kg"), 1, "pitada"), null);
  assert.equal(custo(produto("alho-cabeca-200g"), 6, "dente"), null);
});
ok("[PRC-12] a lata custa o mesmo pedida como lata ou como peso", () => {
  const p = produto("leite-condensado-moca-lata");
  assert.ok(perto(custo(p, 1, "lata"), custo(p, 395, "g")), "as duas vias têm de dar o mesmo");
});
ok("[PRC-12] sem preço no mercado, a lata não custa zero", () => {
  /* O caminho da unidade que só casa com ela mesma divide: `null / p.qtd * qtd` dá 0 em
     JavaScript, e a janela de produtos precifica produtos fora do mercado direto por aqui.
     A tela mostrava "R$ 0,00" para o que aquele mercado não vende. */
  const fora = ids()
    .map(id => produto(id, "asun"))
    .find(p => p.preco == null && !familia(p.un));

  assert.ok(fora, "o catálogo de teste precisa de um contável fora do mercado");
  assert.equal(custo(fora, 1, fora.un), null, "sem preço, sem conta — nem zero");
});
ok("[PRC-31] sem preço não é de graça na ordenação por embalagem", () => {
  /* `null - 5` é `-5` em JavaScript: sem guarda, o produto que aquele mercado não vende
     ia para o TOPO da lista ordenada por preço, como se fosse o mais barato de todos. */
  const ing = INGREDIENTES["manteiga"];
  const opcoes = opcoesDeProduto({ ...ing, id: "manteiga" }, { ordem: "embalagem", mercado: null });
  const semPreco = opcoes.filter(o => o.produto.preco == null);

  assert.equal(semPreco.length, 0, "sem mercado ativo, todo produto tem preço");
  assert.ok(opcoes.length > 1);
  for (let i = 1; i < opcoes.length; i++) {
    assert.ok(opcoes[i - 1].produto.preco <= opcoes[i].produto.preco, "ordem crescente");
  }

  // E o comparador cru, sem o `?? Infinity`, punha o null na frente
  assert.ok((null ?? Infinity) - 5 > 0, "com guarda, o sem preço vai para o fim");
  assert.ok(null - 5 < 0, "sem guarda, ia para o começo");
});
ok("[PRC-11] quantidade ausente não tem custo", () => {
  assert.equal(custo(produto("sal-cisne-1kg"), null, "g"), null);
  assert.equal(custo(produto("sal-cisne-1kg"), 1, null), null);
});

console.log("\nCUSTO A PARTIR DO INGREDIENTE DA RECEITA");
ok("[PRC-13] calcula quando as medidas se convertem", () => {
  const feijao = receitas[0].ingredientes.find(i => i.id === "feijao-preto");
  const c = custoDoIngrediente({ ...feijao, densidade: densidadeDe(feijao) });
  assert.ok(c, "devia ter custo");
  assert.ok(perto(c.valor, 8.0), String(c.valor));
  assert.equal(c.produto.id, "feijao-sao-joao-1kg");
});
ok("[PRC-14] devolve null em vez de inventar número", () => {
  // maço não tem peso por unidade no catálogo: não há como chegar a gramas
  assert.equal(custoDoIngrediente({ id: "cebola", qtd: 1, un: "maço" }), null);
});
ok("[PRC-26] sem produto nenhum, não há custo", () => {
  assert.equal(custoDoIngrediente({ id: "trufa-branca", qtd: 10, un: "g" }), null);
});
ok('[PRC-17][REC-09] "a gosto" não tem custo', () => {
  assert.equal(custoDoIngrediente({ id: "sal", escala: false, texto: "a gosto" }), null);
});
ok("[PRC-13] a quantidade pedida pode ser outra que a do arquivo", () => {
  const feijao = receitas[0].ingredientes.find(i => i.id === "feijao-preto");
  assert.ok(perto(custoDoIngrediente(feijao, 2000).valor, 16.0), "o dobro custa o dobro");
  assert.ok(perto(custoDoIngrediente(feijao, 500).valor, 4.0));
});
ok("[PRC-17] o que se assume ter em casa não entra na conta", () => {
  const sal = receitas[1].ingredientes.find(i => i.id === "sal");
  assert.equal(sal.emCasa, true, "o catálogo marca o sal como já tendo em casa");
  assert.equal(custoDoIngrediente(sal), null, "a pitada custa R$ 0,0013: precificar não informa");
  assert.equal(custoDoIngrediente({ id: "agua", emCasa: true, qtd: 2, un: "L" }), null);

  // o produto continua cadastrado: a decisão é sobre custo, não sobre existir
  assert.ok(maisBarato("sal"), "sal não deixou de existir");
});
ok("[PRC-20] hoje toda linha com quantidade e preço tem preço", () => {
  // Não é regra do site — é o estado do catálogo. Se um ingrediente novo entrar
  // sem produto, este teste avisa, e a tela mostra "???" em vez de errar.
  const semCusto = [];
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.subtitulo || ing.qtd == null || ing.emCasa) continue;
      if (!custoDoIngrediente(ing)) semCusto.push(`${r.slug}/${ing.nome} (${ing.un})`);
    }
  }
  assert.deepEqual(semCusto, []);
});
ok("[PRC-21] o custo da receita inteira fecha com a soma das linhas", () => {
  const feijoada = receitas[0];
  const linhas = feijoada.ingredientes
    .filter(i => !i.subtitulo && i.qtd != null && !i.emCasa)
    .map(i => custoDoIngrediente(i).valor);
  const soma = linhas.reduce((s, v) => s + v, 0);
  assert.equal(linhas.length, 10, "sal e pimenta são a gosto");
  assert.ok(perto(soma, 64.13, 0.01), String(soma));
  assert.ok(perto(custoDaReceita(feijoada).total, soma), "o total tem de ser a soma, não outra conta");
});

console.log("\nCUSTO DA RECEITA");
ok("[PRC-21] total e por porção, no padrão", () => {
  const c = custoDaReceita(receitas[0]);            // feijoada, 8 pessoas
  assert.ok(perto(c.total, 64.13, 0.01), String(c.total));
  assert.ok(perto(c.porPorcao, 64.13 / 8, 0.01), String(c.porPorcao));
  assert.equal(c.contados, 10);
});
ok("[PRC-21] o total escala com as porções", () => {
  const r = receitas[2];                            // bolo, 12 fatias
  const doze = custoDaReceita(r, 12).total;
  assert.ok(perto(custoDaReceita(r, 24).total, doze * 2), "o dobro custa o dobro");
  assert.ok(perto(custoDaReceita(r, 6).total, doze / 2));
});
ok("[PRC-24] o custo por porção NÃO muda com o seletor", () => {
  // escalar multiplica ingredientes e porções pelo mesmo fator: a divisão cancela
  const r = receitas[2];
  const base = custoDaReceita(r, 12).porPorcao;
  for (const p of [6, 12, 18, 24]) {
    assert.ok(perto(custoDaReceita(r, p).porPorcao, base), `${p} fatias deu outro valor`);
  }
});
ok("[PRC-23] o que não dá para precificar é relatado, não somado", () => {
  const c = custoDaReceita(receitas[0]);
  assert.equal(c.completa, false);
  assert.deepEqual(c.deFora, [{ nome: "pimenta-do-reino", motivo: "quantidade a gosto" }]);
});
ok("[PRC-22] o que se assume ter em casa não conta como lacuna", () => {
  // o sal da feijoada também é "a gosto", mas é decisão, não falta de dado
  const c = custoDaReceita(receitas[0]);
  assert.ok(!c.deFora.some(x => x.nome === "sal"), "sal não devia aparecer como pendência");
  const brigadeiro = custoDaReceita(receitas[1]);
  assert.equal(brigadeiro.completa, true, "a pitada de sal não deixa a conta incompleta");
});
ok("[PRC-26] receita sem nada precificável não finge total", () => {
  const vazia = {
    porcoes: { padrao: 4 },
    ingredientes: [{ id: "trufa-branca", nome: "trufa branca", qtd: 10, un: "g" }]
  };
  const c = custoDaReceita(vazia);
  assert.equal(c.contados, 0);
  assert.equal(c.total, 0);
  assert.equal(c.completa, false);
});

console.log("\nFORMATO");
ok("[PRC-30] menos de meio centavo não vira R$ 0,00", () => {
  assert.equal(textoCusto(0.0013), "< R$ 0,01");
  assert.equal(textoCusto(0.004), "< R$ 0,01");
  assert.equal(textoCusto(0.006), formatarPreco(0.006), "0,6 centavo arredonda para 0,01");
  assert.equal(textoCusto(0), formatarPreco(0), "zero é zero, não 'menos de um centavo'");
  assert.equal(textoCusto(8), formatarPreco(8));
});
ok("[PRC-29] preço sai em reais, com vírgula", () => {
  const t = formatarPreco(8);
  assert.ok(t.includes("R$"), t);
  assert.ok(t.includes("8,00"), t);
});
ok("[PRC-02] preço de gôndola segue a embalagem, não a base de cálculo", () => {
  // `formatarPreco` usa espaço fino do pt-BR; comparar com ele evita testar o Intl
  const texto = id => textoPrecoUnitario(produto(id));

  assert.equal(texto("feijao-sao-joao-1kg"), `${formatarPreco(8)}/kg`);
  assert.equal(texto("oleo-liza-900ml"), `${formatarPreco(11.9 / 0.9)}/L`, "óleo se compara por litro");
  assert.equal(texto("leite-italac-1l"), `${formatarPreco(5.49)}/L`);

  // ovo tem peso por unidade, então a comparação interna é em grama — mas
  // "R$ 24,83/kg de ovo" não é como ninguém compra ovo
  assert.equal(texto("ovos-brancos-12un"), `${formatarPreco(14.9 / 12)}/un.`);
  assert.equal(precoUnitario(produto("ovos-brancos-12un"), { pesoPorUnidade: { "un.": 50 } }).un, "g");

  // a lata declara o conteúdo em gramas: é por quilo que ela se compara
  assert.deepEqual(precoDeReferencia(produto("leite-condensado-moca-lata")),
    { valor: 8.49 / 0.395, un: "kg" });
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
