/* Testes da escolha de produto: estado guardado, ordenação da janela, efeito no
   custo e nos nutrientes, e o caminho todo na página. */

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const falhas = [];
const ok = (nome, fn) => {
  try { fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n").slice(0, 3).join(" | ")); }
};

const perto = (a, b, e = 0.005) => Math.abs(a - b) <= e;

/* Um `localStorage` de mentira, para poder testar o módulo sem DOM */
const memoria = new Map();
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: k => memoria.delete(k),
  clear: () => memoria.clear()
};

const C = await import(`${RAIZ}/src/js/choices.js`);
const { aplicarEscolhas, comProduto, resolverIngredientes } = await import(`${RAIZ}/src/data/resolve.js`);
const { custoDoIngrediente, custoDaReceita, opcoesDeProduto } = await import(`${RAIZ}/src/js/pricing.js`);
const { estimarNutrientes } = await import(`${RAIZ}/src/js/nutrition.js`);
const { porSlug } = await import(`${RAIZ}/src/data/index.js`);

/* ------------------------------------------------------------- saneamento */

console.log("\nSANEAMENTO DAS ESCOLHAS");
ok("[CHO-05] escolha válida sobrevive", () => {
  const limpo = C.sanearEscolhas({ brigadeiro: { "manteiga/sem-sal": "manteiga-president-200g" } });
  assert.deepEqual(limpo, { brigadeiro: { "manteiga/sem-sal": "manteiga-president-200g" } });
});
ok("[CHO-05] produto que saiu do catálogo é descartado", () => {
  assert.deepEqual(C.sanearEscolhas({ brigadeiro: { manteiga: "manteiga-que-nao-existe" } }), {});
});
ok("[CHO-05] ingrediente que saiu do catálogo é descartado", () => {
  assert.deepEqual(C.sanearEscolhas({ brigadeiro: { trufa: "manteiga-president-200g" } }), {});
});
ok("[CHO-05] produto de OUTRO ingrediente é descartado", () => {
  // O caso silencioso: o produto existe, o ingrediente existe, e ainda assim a
  // escolha está errada. Sem esta checagem, açúcar apareceria vendido em lata.
  assert.deepEqual(C.sanearEscolhas({ brigadeiro: { acucar: "leite-condensado-moca-lata" } }), {});
});
ok("[CHO-06] produto de subtipo serve ao pai, mas não ao irmão", () => {
  // Um pote de manteiga sem sal atende quem pediu "manteiga"…
  assert.deepEqual(C.sanearEscolhas({ bolo: { manteiga: "manteiga-president-200g" } }),
    { bolo: { manteiga: "manteiga-president-200g" } });

  // …e não atende quem pediu "manteiga com sal"
  assert.deepEqual(C.sanearEscolhas({ bolo: { "manteiga/com-sal": "manteiga-president-200g" } }), {});
});
ok("[CHO-05] lixo no lugar do objeto não derruba nada", () => {
  assert.deepEqual(C.sanearEscolhas(null), {});
  assert.deepEqual(C.sanearEscolhas("olá"), {});
  assert.deepEqual(C.sanearEscolhas({ brigadeiro: 42 }), {});
});
ok("[CHO-05] receita que ficou sem nenhuma escolha sai do mapa", () => {
  const limpo = C.sanearEscolhas({
    brigadeiro: { "manteiga/sem-sal": "manteiga-president-200g", acucar: "nao-existe" },
    feijoada: { acucar: "nao-existe" }
  });
  assert.deepEqual(Object.keys(limpo), ["brigadeiro"]);
  assert.deepEqual(limpo.brigadeiro, { "manteiga/sem-sal": "manteiga-president-200g" });
});

console.log("\nGUARDAR E LEMBRAR");
ok("[CHO-01] a escolha é por receita, não por ingrediente", () => {
  C.limparEscolhas();
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");
  C.escolher("bolo-de-cenoura", "manteiga", "manteiga-aviacao-200g");

  const e = C.carregarEscolhas();
  assert.equal(e.brigadeiro["manteiga/sem-sal"], "manteiga-president-200g");
  assert.equal(e["bolo-de-cenoura"].manteiga, "manteiga-aviacao-200g");
  // é o que permite manteiga sem sal no doce e com sal no salgado
});
ok("[CHO-08] escolher null volta ao automático", () => {
  C.limparEscolhas();
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");
  C.escolher("brigadeiro", "manteiga/sem-sal", null);
  assert.deepEqual(C.carregarEscolhas(), {});
});
ok("[CHO-07] produto do ingrediente errado não é gravado", () => {
  C.limparEscolhas();
  C.escolher("brigadeiro", "manteiga/sem-sal", "acucar-uniao-1kg");
  assert.deepEqual(C.carregarEscolhas(), {});
});
ok("[CHO-09] os recém-usados guardam a ordem, sem repetir", () => {
  C.limparEscolhas();
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-aviacao-200g");
  C.escolher("brigadeiro", "acucar/refinado", "acucar-uniao-1kg");
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-aviacao-200g");

  assert.deepEqual(C.carregarRecentes(), [
    "manteiga-aviacao-200g", "manteiga-president-200g", "acucar-uniao-1kg"
  ]);
});
ok("[CHO-08] voltar ao automático não conta como uso", () => {
  C.limparEscolhas();
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");
  const antes = C.carregarRecentes();
  C.escolher("brigadeiro", "manteiga/sem-sal", null);
  assert.deepEqual(C.carregarRecentes(), antes);
});
ok("[CHO-09] a lista de recentes tem teto", () => {
  C.limparEscolhas();
  for (let n = 0; n < C.MAX_RECENTES + 10; n++) C.registrarUso("acucar-uniao-1kg");
  assert.equal(C.carregarRecentes().length, 1, "o mesmo produto não se repete");
});
ok("[CHO-11] ordenação escolhida é lembrada, e valor inválido cai no padrão", () => {
  assert.equal(C.carregarOrdem(), C.ORDEM_PADRAO);
  C.salvarOrdem("nome");
  assert.equal(C.carregarOrdem(), "nome");
  C.salvarOrdem("por-cor-da-embalagem");
  assert.equal(C.carregarOrdem(), C.ORDEM_PADRAO);
  C.salvarOrdem(C.ORDEM_PADRAO);
});
ok('[CHO-10] o padrão é "usados há pouco"', () => {
  assert.equal(C.ORDEM_PADRAO, "recentes");
  assert.deepEqual(C.ORDENS.map(o => o.valor), ["recentes", "nome", "embalagem", "unitario"]);
});

/* ------------------------------------------------------------ ordenação */

console.log("\nORDEM DA LISTA DE PRODUTOS");
/* O bolo pede "açúcar refinado", que tem um produto só. Para exercitar a ordenação
   é o PAI que interessa: pedindo "açúcar", vêm refinado e cristal. */
const { ingrediente, descendentes, naSubarvore } = await import(`${RAIZ}/src/data/ingredientes.js`);
const acucar = { ...ingrediente("acucar"), qtd: 2, un: "copo" };
const nomes = ordem => opcoesDeProduto(acucar, { ordem, recentes: ["acucar-uniao-1kg"] })
  .map(o => o.produto.marca);

ok("[CHO-12] sem histórico, a lista abre na ordem do automático (mais barato por medida)", () => {
  assert.deepEqual(opcoesDeProduto(acucar, { ordem: "recentes", recentes: [] }).map(o => o.produto.marca),
    ["Guarani", "União"], "Guarani sai R$ 4,58/kg contra R$ 5,20/kg");
});
ok("[CHO-12] com histórico, o usado há pouco vem primeiro", () => {
  assert.deepEqual(nomes("recentes"), ["União", "Guarani"]);
});
ok("[CHO-12] por nome, em português", () => {
  assert.deepEqual(nomes("nome"), ["Guarani", "União"]);   // Cristal antes de Refinado
});
ok("[CHO-12] por preço da embalagem: o pacote menor primeiro", () => {
  assert.deepEqual(nomes("embalagem"), ["União", "Guarani"]);   // R$ 5,20 < R$ 22,90
});
ok("[CHO-12] por preço de medida: o quilo mais barato primeiro", () => {
  assert.deepEqual(nomes("unitario"), ["Guarani", "União"]);    // R$ 4,58/kg < R$ 5,20/kg
});
ok("[CHO-13] as duas ordenações de preço discordam, e é esse o ponto", () => {
  assert.notDeepEqual(nomes("embalagem"), nomes("unitario"),
    "embalagem grande é mais caro de comprar e mais barato por quilo");
});
ok("[PRC-31] cada opção traz os quatro números da janela", () => {
  const [o] = opcoesDeProduto(acucar, { ordem: "unitario" });
  assert.equal(o.produto.nome, "Açúcar Cristal Guarani");
  assert.deepEqual(o.embalagem, { qtd: 5000, un: "g" });
  assert.equal(o.produto.preco, 22.9);
  assert.ok(perto(o.referencia.valor, 4.58, 0.01));
  assert.equal(o.referencia.un, "kg");
  assert.ok(perto(o.custo, 1.65, 0.01), "e o custo desta linha da receita");
});
ok("[PRC-32][PRC-33] o pedido decide o que a janela oferece", () => {
  const pai = { ...ingrediente("manteiga"), qtd: 1, un: "col. sopa" };
  const sub = { ...ingrediente("manteiga/sem-sal"), qtd: 1, un: "col. sopa" };

  const doPai = opcoesDeProduto(pai, {}).map(o => o.produto.ing);
  const doSub = opcoesDeProduto(sub, {}).map(o => o.produto.ing);

  assert.ok(doPai.includes("manteiga/com-sal") && doPai.includes("manteiga/sem-sal"),
    "pedindo o pai, vêm os dois subtipos");
  assert.deepEqual([...new Set(doSub)], ["manteiga/sem-sal"], "pedindo o subtipo, só o dele");
  assert.ok(doPai.length > doSub.length, "e o pai oferece mais que o subtipo");

  // e o irmão não vaza para o outro lado
  const irmao = { ...ingrediente("manteiga/com-sal"), qtd: 1, un: "col. sopa" };
  assert.deepEqual(opcoesDeProduto(irmao, {}).map(o => o.produto.nome), ["Manteiga com Sal"]);
});
ok("[ING-01][ING-10][ING-11] três níveis funcionam igual a dois", () => {
  // Nenhum ingrediente do catálogo tem três níveis hoje; a árvore aceita.
  assert.deepEqual(descendentes("acucar"),
    ["acucar", "acucar/refinado", "acucar/cristal", "acucar/mascavo"]);
  assert.equal(naSubarvore("a/b/c", "a"), true);
  assert.equal(naSubarvore("a/b/c", "a/b"), true);
  assert.equal(naSubarvore("a/b", "a/b/c"), false);
  assert.equal(naSubarvore("ab", "a"), false, "prefixo de texto não é subtipo");
});
ok("[CHO-12] ordem desconhecida não quebra: cai no padrão", () => {
  assert.deepEqual(opcoesDeProduto(acucar, { ordem: "inventada", recentes: ["acucar-uniao-1kg"] })
    .map(o => o.produto.marca), nomes("recentes"));
});

/* -------------------------------------------------------- efeito nos dados */

console.log("\nEFEITO NO CUSTO E NOS NUTRIENTES");
const brigadeiro = porSlug("brigadeiro");

ok("[CHO-32][PRC-18] o custo da linha passa a ser o do produto escolhido", () => {
  const auto = custoDoIngrediente(brigadeiro.ingredientes.find(i => i.id === "manteiga/sem-sal"));
  assert.equal(auto.produto.id, "manteiga-president-200g",
    "o brigadeiro pede sem sal: só existe uma, e é ela");
  assert.equal(auto.escolhido, false);

  const r = aplicarEscolhas(brigadeiro, { "manteiga/sem-sal": "manteiga-president-200g" });
  const escolhido = custoDoIngrediente(r.ingredientes.find(i => i.id === "manteiga/sem-sal"));
  assert.equal(escolhido.produto.id, "manteiga-president-200g");
  assert.equal(escolhido.escolhido, true);
  assert.equal(escolhido.valor, auto.valor, "mesma escolha, mesmo valor");
});
ok("[CHO-32] o total e o por porção acompanham", () => {
  // O bolo pede "manteiga" sem especificar: aí há duas para escolher
  const bolo = porSlug("bolo-de-cenoura");
  const antes = custoDaReceita(bolo);
  const depois = custoDaReceita(aplicarEscolhas(bolo, { manteiga: "manteiga-president-200g" }));
  const diferenca = depois.total - antes.total;

  assert.ok(diferenca > 0, "a sem sal é mais cara que a com sal");
  assert.ok(perto(depois.porPorcao - antes.porPorcao, diferenca / bolo.porcoes.padrao),
    "por porção é o total dividido pelas porções, antes e depois");
});
ok("[CHO-33][NUT-32] o rótulo do produto entra nos nutrientes", () => {
  const feijoada = porSlug("feijoada");
  const antes = estimarNutrientes(feijoada).porPorcao;

  const r = aplicarEscolhas(feijoada, { "feijao-preto": "feijao-sao-joao-1kg" });
  const depois = estimarNutrientes(r).porPorcao;

  const ing = r.ingredientes.find(i => i.id === "feijao-preto");
  assert.deepEqual(ing.nutrientesDoRotulo, ["proteina", "carboidrato", "gordura"]);
  assert.notEqual(depois.proteina, antes.proteina, "o rótulo declara proteína: vale o rótulo");
});
ok("[ING-17][NUT-32] onde o rótulo cala, o valor continua vindo da tabela", () => {
  const r = aplicarEscolhas(porSlug("feijoada"), { "feijao-preto": "feijao-sao-joao-1kg" });
  const ing = r.ingredientes.find(i => i.id === "feijao-preto");

  assert.equal(ing.nutrientes.proteina, 21, "do rótulo");
  assert.equal(ing.nutrientes.fibra, 15.5, "da tabela: o rótulo não fala de fibra");
  assert.equal(ing.nutrientes.kcal, 341, "da tabela");
});
ok("[NUT-33] null no catálogo é decisão, e o rótulo não a desfaz", () => {
  // Louro sai da panela antes de servir: não entra na conta, com produto ou sem
  const louro = porSlug("feijoada").ingredientes.find(i => i.id === "louro");
  assert.equal(louro.nutrientes, null);
  assert.equal(comProduto(louro, "louro-kitano-8g").nutrientes, null);
});
ok("[ING-18] escolha de produto de outro ingrediente é ignorada na aplicação", () => {
  const r = aplicarEscolhas(brigadeiro, { "manteiga/sem-sal": "acucar-uniao-1kg" });
  assert.equal(r.ingredientes.find(i => i.id === "manteiga/sem-sal").produto, undefined);
});
ok("[ING-18] produto do irmão também é ignorado", () => {
  // manteiga com sal não serve a quem pediu sem sal
  const r = aplicarEscolhas(brigadeiro, { "manteiga/sem-sal": "manteiga-aviacao-200g" });
  assert.equal(r.ingredientes.find(i => i.id === "manteiga/sem-sal").produto, undefined);
});
ok("[ING-18] produto de subtipo serve a quem pediu o pai", () => {
  const bolo = aplicarEscolhas(porSlug("bolo-de-cenoura"), { manteiga: "manteiga-president-200g" });
  assert.equal(bolo.ingredientes.find(i => i.id === "manteiga").produto.id, "manteiga-president-200g");
});
ok("[ING-20] aplicar mapa vazio devolve a própria receita, sem cópia", () => {
  assert.equal(aplicarEscolhas(brigadeiro, {}), brigadeiro);
  assert.equal(aplicarEscolhas(brigadeiro), brigadeiro);
});
ok("[ING-21] a receita original não é tocada", () => {
  const antes = JSON.stringify(brigadeiro.ingredientes.map(i => i.nutrientes));
  aplicarEscolhas(brigadeiro, { "manteiga/sem-sal": "manteiga-president-200g" });
  assert.equal(JSON.stringify(brigadeiro.ingredientes.map(i => i.nutrientes)), antes);
});

/* --------------------------------------------------------------- na página */

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/#/receita/bolo-de-cenoura", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
window.localStorage.clear();
await import(`${RAIZ}/src/js/app.js`);
const { listaIngredientes } = await import(`${RAIZ}/src/js/recipe-view.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const clicar = el => { assert.ok(el, "elemento não encontrado"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); };
const irPara = slug => {
  window.location.hash = `#/receita/${slug}`;
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
};

const linhaDe = nome => {
  const li = $$("#lista-ingredientes li:not(.sub)")
    .find(l => l.querySelector(".ing-nome")?.textContent.trim().startsWith(nome));
  assert.ok(li, `ingrediente não encontrado: ${nome}`);
  return li;
};
const total = () => $("#custo-total .custo > div:first-child dd").textContent.replace(/\s+/g, " ").trim();
const precoDe = nome => linhaDe(nome).querySelector(".ing-preco").textContent.replace(/\s+/g, " ").trim();
const opcoes = () => $$("#produtos .prod");
const abrirEscolha = nome => clicar(linhaDe(nome).querySelector(".escolher-produto"));
const fecharEscolha = () => clicar($("#produtos .pref-ok"));

console.log("\nA JANELA NA PÁGINA");
irPara("bolo-de-cenoura");

ok("[CHO-15] o nome do ingrediente é um botão quando há produto", () => {
  assert.equal(linhaDe("manteiga").querySelector(".escolher-produto")?.tagName, "BUTTON");
  assert.equal(linhaDe("manteiga").querySelector(".ing-nome").getAttribute("aria-haspopup"), "dialog");
});
ok("[CHO-16] a janela abre com o nome do ingrediente no título", () => {
  abrirEscolha("manteiga");
  assert.ok($("#produtos").hasAttribute("open") || typeof $("#produtos").showModal === "function");
  assert.equal($("#produtos .pref-head h2").textContent.trim(), "manteiga");
});
ok("[CHO-17][PRC-33] pedindo o pai, a janela mostra os produtos de todos os subtipos", () => {
  // o bolo pede "manteiga" sem dizer qual: cabem as com sal e as sem sal
  const nomes = opcoes().slice(1).map(b => b.querySelector(".prod-nome").textContent.trim());
  assert.ok(nomes.some(n => n.includes("com Sal")), nomes.join(" | "));
  assert.ok(nomes.some(n => n.includes("sem Sal")), nomes.join(" | "));
});
ok("[CHO-19][CHO-21] lista os quatro números de cada produto", () => {
  const dados = opcoes()[1].querySelector(".prod-dados").textContent.replace(/\s+/g, " ").trim();
  assert.match(dados, /Aviação/, "marca");
  assert.match(dados, /200 g/, "tamanho da embalagem");
  assert.match(dados, /12,90/, "preço da embalagem");
  assert.match(dados, /64,50\/kg/, "preço por medida");
  assert.match(opcoes()[1].querySelector(".prod-linha").textContent, /1,76/, "e o custo nesta receita");
});
ok("[CHO-18] a primeira opção é voltar ao automático, e começa marcada", () => {
  assert.ok(opcoes()[0].classList.contains("prod-auto"));
  assert.equal(opcoes()[0].getAttribute("aria-checked"), "true");
  assert.match(opcoes()[0].textContent, /Manteiga com Sal/, "diz qual o site escolheria hoje");
});
ok("[CHO-20] o mais barato leva selo, e só ele", () => {
  const selos = opcoes().map(b => b.querySelector(".prod-selo")?.textContent.trim() ?? null);
  assert.deepEqual(selos.filter(Boolean), ["mais barato"]);
  assert.equal(selos[0], null, "a opção de automático não é um produto");
});
ok("[CHO-25][CHO-31] escolher troca o nome, o preço e o total", () => {
  const antes = total();
  clicar(opcoes().find(b => b.textContent.includes("sem Sal")));

  assert.match(linhaDe("Manteiga sem Sal").textContent, /Président/, "a marca aparece na linha");
  assert.equal(precoDe("Manteiga sem Sal"), "R$ 2,17");
  assert.notEqual(total(), antes);
  assert.equal(total(), "R$ 16,16");
  fecharEscolha();
});
ok("[CHO-28] fechar devolve o foco para o nome do ingrediente", () => {
  // o botão que abriu foi substituído no redesenho: o foco procura pelo índice
  assert.ok($("#lista-ingredientes .escolher-produto"));
  assert.equal(window.document.activeElement?.classList.contains("escolher-produto"), true);
});
ok("[CHO-31][ING-17][REC-10] o preparo da receita não se perde: desce para o parêntese", () => {
  irPara("feijoada");
  abrirEscolha("carne-seca");
  clicar(opcoes().find(b => b.dataset.produto === "carne-seca-friboi-500g"));
  const linha = linhaDe("Carne Seca Dianteiro").textContent.replace(/\s+/g, " ");
  assert.match(linha, /dessalgada/, "era 'carne-seca dessalgada'");
  fecharEscolha();
});
ok("[CHO-18] a escolha fica marcada quando a janela reabre", () => {
  irPara("bolo-de-cenoura");
  abrirEscolha("Manteiga sem Sal");
  const marcada = opcoes().find(b => b.getAttribute("aria-checked") === "true");
  assert.match(marcada.textContent, /sem Sal/);
  assert.equal(opcoes()[0].getAttribute("aria-checked"), "false", "o automático deixou de valer");
});
ok("[CHO-03][CHO-26] trocar a ordenação reordena sem fechar a janela", () => {
  const seletor = $("#produtos #prod-ordem");
  seletor.value = "unitario";
  seletor.dispatchEvent(new window.Event("change", { bubbles: true }));

  /* Por preço de medida, a mais barata por quilo vem primeiro. Ler os números da
     tela em vez de fixar a ordem dos nomes: produto novo no catálogo não devia
     derrubar um teste de ordenação. */
  const precos = opcoes().slice(1)
    // Sem o "R$": `formatarPreco` usa espaço não separável depois dele
    .map(b => b.querySelector(".prod-dados").textContent.match(/([\d.,]+)\/kg/)?.[1])
    .filter(Boolean)
    .map(x => Number(x.replace(".", "").replace(",", ".")));

  assert.ok(precos.length >= 2, "precisa de dois para comparar");
  assert.deepEqual(precos, [...precos].sort((a, b) => a - b), "do mais barato por medida ao mais caro");
  assert.equal(window.localStorage.getItem("receitas:ordem-produtos"), '"unitario"');

  seletor.value = "recentes";
  seletor.dispatchEvent(new window.Event("change", { bubbles: true }));
});
ok("[CHO-08] voltar ao automático desfaz tudo", () => {
  clicar(opcoes()[0]);
  assert.match(linhaDe("manteiga").textContent, /^manteiga/, "o nome volta a ser o do catálogo");
  assert.equal(precoDe("manteiga"), "R$ 1,76");
  assert.equal(total(), "R$ 15,75");
});
ok("[CHO-33][NUT-32] os nutrientes avisam quando vêm de um rótulo", () => {
  fecharEscolha();
  assert.ok(!$(".nutri-nota").textContent.includes("rótulo"), "sem escolha, nada a dizer");

  abrirEscolha("manteiga");
  clicar(opcoes().find(b => b.textContent.includes("sem Sal")));
  assert.match($(".nutri-nota").textContent, /rótulo de 1 produto escolhido/);

  clicar($("#ver-nutrientes"));
  assert.match($("#nutri-detalhes").textContent, /Manteiga sem Sal/);
  assert.match($("#nutri-detalhes").textContent, /rótulo parcial/, "o rótulo declara menos que a tabela");
  clicar($("#nutri-detalhes .pref-ok"));
});
ok("[CHO-15][ING-16] ingrediente sem produto no catálogo não é clicável", () => {
  // Água é o caso: está no catálogo e não se compra, então não há produto
  const falsa = {
    porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([
      { ing: "agua", qtd: 1, un: "L" },
      { ing: "acucar/refinado", qtd: 100, un: "g" }
    ], "teste")
  };
  const div = window.document.createElement("div");
  div.innerHTML = listaIngredientes(falsa, 1, {});

  const nomes = [...div.querySelectorAll(".ing-nome")];
  assert.equal(nomes[0].tagName, "SPAN", "água não tem produto: nome não é botão");
  assert.equal(nomes[1].tagName, "BUTTON", "açúcar tem: é botão");
});

console.log("\nPERSISTÊNCIA");
ok("[CHO-01][CHO-34] a escolha sobrevive a recarregar a página", async () => {
  const guardado = window.localStorage.getItem("receitas:produtos");
  assert.match(guardado, /manteiga-president-200g/);

  const d2 = new JSDOM(html, { url: "http://localhost:8000/#/receita/bolo-de-cenoura", pretendToBeVisual: true });
  d2.window.scrollTo = () => {};
  d2.window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  d2.window.localStorage.setItem("receitas:produtos", guardado);
  for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
    try { globalThis[k] = d2.window[k]; } catch {}
  }
  await import(`${RAIZ}/src/js/app.js?v=escolhas`);
  await new Promise(r => setTimeout(r, 40));

  const nomes = [...d2.window.document.querySelectorAll("#lista-ingredientes .ing-nome")].map(n => n.textContent.trim());
  assert.ok(nomes.some(n => n.startsWith("Manteiga sem Sal")), nomes.join(" | "));
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
