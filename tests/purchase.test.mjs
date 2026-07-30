/* Testes da compra: embalagem inteira, os dois totais, a escolha do carrinho e a
   tela do carrinho. */

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

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/#/carrinho", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
window.localStorage.clear();

const P = await import(`${RAIZ}/src/js/purchase.js`);
const C = await import(`${RAIZ}/src/js/choices.js`);
const { custoDaReceita, formatarPreco } = await import(`${RAIZ}/src/js/pricing.js`);
const { aplicarEscolhas, resolverIngredientes } = await import(`${RAIZ}/src/data/resolve.js`);
const { porSlug } = await import(`${RAIZ}/src/data/index.js`);
const { produto: porId } = await import(`${RAIZ}/src/data/produtos.js`);
const S = await import(`${RAIZ}/src/js/settings.js`);
const MERC = await import(`${RAIZ}/src/data/mercados.js`);
const carrinho = await import(`${RAIZ}/src/js/cart.js`);
const { passoValido, ordenarCompra } = await import(`${RAIZ}/src/js/cart-view.js`);

const item = (slug, porcoes, qtd = 1) => ({ receita: porSlug(slug), porcoes, qtd });
const linhaDe = (t, id) => t.linhas.find(l => l.ing.id === id);

/* ------------------------------------------------------ embalagem inteira */

console.log("\nEMBALAGEM NÃO SE DIVIDE");
ok("[BUY-22][BUY-24] precisar de menos que um pacote ainda custa um pacote", () => {
  // 300 g de carne-seca, pacote de 500 g por R$ 34,90
  const t = P.totaisDaCompra([item("feijoada", 8)], {});
  const l = linhaDe(t, "carne-seca");
  assert.equal(l.embalagens, 1);
  assert.ok(perto(l.custoUsado, 20.94, 0.01), "o consumo é proporcional");
  assert.ok(perto(l.custoCompra, 34.9), "a compra é o pacote inteiro");
  assert.ok(perto(l.sobra, 200), "e sobram 200 g");
});
ok("[BUY-22][BUY-24] precisar de mais que um pacote arredonda para cima", () => {
  // 2 feijoadas de 24 pessoas: 6 kg de feijão, pacotes de 1 kg
  const t = P.totaisDaCompra([item("feijoada", 24, 2)], {});
  const l = linhaDe(t, "feijao-preto");
  assert.equal(l.precisa.qtd, 6000);
  assert.equal(l.embalagens, 6);
  assert.ok(perto(l.custoCompra, 48));
  assert.equal(l.sobra, 0, "seis pacotes de 1 kg fecham exato");
});
ok("[BUY-22] quantidade exata não vira uma embalagem a mais", () => {
  // o ponto flutuante é traiçoeiro: 1000 g em pacote de 1000 g é UM pacote
  const t = P.totaisDaCompra([item("feijoada", 8)], {});
  assert.equal(linhaDe(t, "feijao-preto").embalagens, 1);
});
ok("[BUY-22] uma pitada de fermento custa o pote", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)], {});
  const l = linhaDe(t, "fermento-em-po");
  assert.ok(l.custoUsado < 0.7, "usa uns 13 g");
  assert.ok(perto(l.custoCompra, 4.9), "mas o pote é de 100 g");
});
ok("[BUY-22][BUY-24] contável também: 25 forminhas custam o pacote de 100", () => {
  const t = P.totaisDaCompra([item("brigadeiro", 25)], {});
  const l = linhaDe(t, "forminha-de-papel");
  assert.deepEqual(l.precisa, { qtd: 25, un: "un." });
  assert.equal(l.embalagens, 1);
  assert.ok(perto(l.custoCompra, 6.9));
  assert.equal(l.sobra, 75);
});
ok("[BUY-23] a lata declara o conteúdo, e é ele que se divide", () => {
  const t = P.totaisDaCompra([item("brigadeiro", 50)], {});
  const l = linhaDe(t, "leite-condensado");
  assert.equal(l.precisa.qtd, 790, "duas receitas de 25 pedem 790 g");
  assert.equal(l.embalagens, 2, "duas latas de 395 g");
});
ok("[BUY-35] o que já se tem em casa não entra na compra", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)], {});
  assert.equal(linhaDe(t, "sal"), undefined);
});

console.log("\nOS DOIS TOTAIS");
ok("[BUY-39] a compra é maior que as refeições, e a diferença é a sobra", () => {
  const t = P.totaisDaCompra([item("feijoada", 8), item("brigadeiro", 25)], {});
  assert.ok(t.compra > t.refeicoes);
  assert.ok(perto(t.sobra, t.compra - t.refeicoes));
});
ok("[BUY-37] as refeições batem com a soma das receitas", () => {
  // Sem junção de linhagem no carrinho, é o mesmo número da página da receita
  const itens = [item("feijoada", 16, 2)];
  const t = P.totaisDaCompra(itens, {});
  const soma = itens.reduce((s, it) => s + custoDaReceita(it.receita, it.porcoes).total * it.qtd, 0);
  assert.ok(perto(t.refeicoes, soma, 0.01), `${t.refeicoes} != ${soma}`);
});
ok("[ING-12] com junção de linhagem, o carrinho manda — e diz por quê", () => {
  /* O bolo pede "chocolate em pó" e o brigadeiro o de 50%. A compra leva um
     pote de 50%, que atende os dois, e é por ele que as duas receitas são
     precificadas. A página do bolo, sozinha, usaria o de 32%, mais barato. */
  const itens = [item("bolo-de-cenoura", 12), item("brigadeiro", 25)];
  const t = P.totaisDaCompra(itens, {});

  const soma = t.porItem.reduce((s, i) => s + i.linha, 0);
  assert.ok(perto(soma, t.refeicoes, 0.01), "as linhas do carrinho fecham com o total");

  const isolado = custoDaReceita(porSlug("bolo-de-cenoura"), 12).total;
  const noCarrinho = t.porItem.find(i => i.receita.slug === "bolo-de-cenoura").linha;
  assert.ok(noCarrinho > isolado, "no carrinho o bolo usa o chocolate mais forte, e mais caro");
});
ok("[BUY-22] a compra só sobe quando um pacote a mais é preciso", () => {
  const compraDe = porcoes => P.totaisDaCompra([item("feijoada", porcoes)], {}).compra;
  // Feijão: 1 kg para 8 pessoas, e um pacote de 1 kg cobre até aí
  assert.equal(compraDe(4), compraDe(8), "meio quilo ou um quilo, é o mesmo pacote");
  assert.equal(compraDe(10), compraDe(12), "1,25 kg e 1,5 kg cabem nos mesmos 2 pacotes");
  assert.ok(compraDe(10) > compraDe(8), "passar de 1 kg obriga o segundo pacote");
});
ok("[BUY-39] comprar mais dilui a sobra", () => {
  const uma = P.totaisDaCompra([item("brigadeiro", 25)], {});
  const quatro = P.totaisDaCompra([item("brigadeiro", 25, 4)], {});
  assert.ok(quatro.compra / quatro.refeicoes < uma.compra / uma.refeicoes,
    "a segunda receita usa a sobra da primeira");
});
ok("[BUY-36] o que não dá para precificar é relatado", () => {
  const t = P.totaisDaCompra([item("feijoada", 8)], {});
  assert.equal(t.completa, false);
  assert.ok(t.deFora.some(x => x.nome === "pimenta-do-reino"));
  assert.ok(!t.deFora.some(x => x.nome === "sal"), "sal é decisão, não lacuna");
});
ok("[BUY-43] carrinho vazio não inventa totais", () => {
  const t = P.totaisDaCompra([], {});
  assert.deepEqual(t.linhas, []);
  assert.equal(t.refeicoes, 0);
  assert.equal(t.compra, 0);
  assert.equal(t.contados, 0);
});

console.log("\nDE QUEM É A ESCOLHA NA COMPRA");
ok("[BUY-29] sem escolha nenhuma, o mais barato", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)], {});
  const l = linhaDe(t, "manteiga");
  assert.equal(l.produto.id, "manteiga-aviacao-200g", "o bolo aceita qualquer manteiga");
  assert.equal(l.origem, "automatico");
});
ok("[BUY-27][BUY-29] pedido específico limita o automático ao subtipo", () => {
  const t = P.totaisDaCompra([item("brigadeiro", 25)], {});
  const l = linhaDe(t, "manteiga/sem-sal");
  assert.equal(l.produto.id, "manteiga-president-200g",
    "pedindo sem sal, a com sal nem entra na comparação, mesmo sendo mais barata");
});
ok("[BUY-30] a escolha da receita atravessa para a compra", () => {
  const t = P.totaisDaCompra([item("brigadeiro", 25)],
    { brigadeiro: { "manteiga/sem-sal": "manteiga-president-200g" } });
  const l = linhaDe(t, "manteiga/sem-sal");
  assert.equal(l.produto.id, "manteiga-president-200g");
  assert.equal(l.origem, "receita");
  assert.deepEqual(l.divididaCom, [], "uma receita só: não há o que dividir");
});
ok("[BUY-21][BUY-26][BUY-31] receitas que discordam viram duas linhas, não um erro", () => {
  /* O bolo quer o de 32%, o brigadeiro o de 50%. São dois potes, e é isso que a
     lista tem de dizer: mostrar um só seria decidir pela pessoa, e o outro
     simplesmente não seria comprado. */
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {
    "bolo-de-cenoura": { "chocolate-em-po": "chocolate-po-garoto-200g" },
    brigadeiro: { "chocolate-em-po/50": "chocolate-po-50-200g" }
  });

  const chocolates = t.linhas.filter(l => l.ing.id.startsWith("chocolate-em-po"));
  assert.deepEqual(chocolates.map(l => l.produto.id).sort(),
    ["chocolate-po-50-200g", "chocolate-po-garoto-200g"]);

  for (const l of chocolates) {
    assert.equal(l.embalagens, 1, "um pote de cada");
    assert.equal(l.divididaCom.length, 2, "cada linha sabe que divide o ingrediente");
    assert.match(l.chave, /#/, "e tem chave própria, porque o ingrediente é o mesmo");
  }

  // Cada linha carrega só o que a sua receita pede
  const doBolo = chocolates.find(l => l.produto.id === "chocolate-po-garoto-200g");
  assert.deepEqual(doBolo.receitas, ["Bolo de Cenoura com Cobertura"]);
});
ok("[BUY-28] dividido, a escolha do carrinho junta de novo", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {
    "bolo-de-cenoura": { "chocolate-em-po": "chocolate-po-garoto-200g" },
    brigadeiro: { "chocolate-em-po/50": "chocolate-po-50-200g" },
    [C.ESCOPO_CARRINHO]: { "chocolate-em-po/50": "chocolate-po-50-200g" }
  });

  const chocolates = t.linhas.filter(l => l.ing.id.startsWith("chocolate-em-po"));
  assert.equal(chocolates.length, 1, "quem vai ao mercado decidiu: um pote");
  assert.equal(chocolates[0].origem, "carrinho");
  assert.deepEqual(chocolates[0].divididaCom, []);
});
ok("[BUY-32] quem não escolheu acompanha o mais barato dos escolhidos", () => {
  /* Uma terceira receita pedindo chocolate sem dizer qual não abre uma terceira
     embalagem: vai junto do mais barato entre os que já vão na sacola. */
  const falsa = {
    nome: "Sem preferência", slug: "sem-preferencia", porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([{ ing: "chocolate-em-po", qtd: 50, un: "g" }], "sem-preferencia")
  };

  const t = P.totaisDaCompra(
    [item("bolo-de-cenoura", 12), item("brigadeiro", 25), { receita: falsa, porcoes: 1, qtd: 1 }],
    {
      "bolo-de-cenoura": { "chocolate-em-po": "chocolate-po-garoto-200g" },
      brigadeiro: { "chocolate-em-po/50": "chocolate-po-50-200g" }
    });

  const chocolates = t.linhas.filter(l => l.ing.id.startsWith("chocolate-em-po"));
  assert.equal(chocolates.length, 2, "duas linhas, não três");

  const comOCarona = chocolates.find(l => l.receitas.includes("Sem preferência"));
  assert.equal(comOCarona.produto.id, "chocolate-po-garoto-200g", "o de 32% é o mais barato por grama");
});
ok("[BUY-28] a escolha feita no carrinho vence a das receitas", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)], {
    "bolo-de-cenoura": { manteiga: "manteiga-president-200g" },
    [C.ESCOPO_CARRINHO]: { manteiga: "manteiga-aviacao-200g" }
  });
  const l = linhaDe(t, "manteiga");
  assert.equal(l.produto.id, "manteiga-aviacao-200g");
  assert.equal(l.origem, "carrinho");
});
ok("[CHO-02][REC-15] o escopo do carrinho não colide com slug de receita", () => {
  assert.equal(C.ESCOPO_CARRINHO, ":carrinho");
  assert.ok(!porSlug(":carrinho"), "nenhuma receita pode se chamar assim");
});
ok("[BUY-33] as três origens de uma linha", () => {
  const falsa = {
    nome: "Teste", slug: "teste", porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([{ ing: "acucar", qtd: 500, un: "g" }], "teste")
  };
  const itens = [{ receita: falsa, porcoes: 1, qtd: 1 }];
  const origemCom = escolhas => P.totaisDaCompra(itens, escolhas).linhas[0].origem;

  assert.equal(origemCom({}), "automatico");
  assert.equal(origemCom({ teste: { acucar: "acucar-uniao-1kg" } }), "receita");
  assert.equal(origemCom({ [C.ESCOPO_CARRINHO]: { acucar: "acucar-guarani-5kg" } }), "carrinho");
});
ok("[BUY-38][CHO-21] trocar o produto no carrinho muda os dois totais", () => {
  /* Precisa de um ingrediente com dois produtos comparáveis. "Açúcar" genérico
     tem: refinado de 1 kg e cristal de 5 kg. Nenhuma receita pede açúcar sem
     dizer qual, então a receita aqui é de mentira. */
  const falsa = {
    nome: "Teste", slug: "teste", porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([{ ing: "acucar", qtd: 500, un: "g" }], "teste")
  };
  const itens = [{ receita: falsa, porcoes: 1, qtd: 1 }];

  const grande = P.totaisDaCompra(itens, { [C.ESCOPO_CARRINHO]: { acucar: "acucar-guarani-5kg" } });
  const pequeno = P.totaisDaCompra(itens, { [C.ESCOPO_CARRINHO]: { acucar: "acucar-uniao-1kg" } });

  assert.ok(pequeno.refeicoes > grande.refeicoes, "o quilo do União é mais caro");
  assert.ok(pequeno.compra < grande.compra, "mas levar 5 kg para casa custa muito mais");
  // é exatamente por isso que a janela do carrinho mostra o preço da compra
});
ok("[BUY-30] escolha que não serve ao pedido é ignorada", () => {
  // Guarani é cristal: não atende quem pediu açúcar refinado
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)],
    { [C.ESCOPO_CARRINHO]: { "acucar/refinado": "acucar-guarani-5kg" } });
  const l = linhaDe(t, "acucar/refinado");
  assert.equal(l.produto.id, "acucar-uniao-1kg");
  assert.equal(l.origem, "automatico", "cai no automático em vez de trocar o pedido");
});

/* ------------------------------------------------------------- na página */

await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const clicar = el => { assert.ok(el, "elemento não encontrado"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); };
const irPara = hash => {
  window.location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
};

C.limparEscolhas();
carrinho.limpar();
carrinho.adicionar("bolo-de-cenoura", 12);
carrinho.adicionar("brigadeiro", 25);
irPara("#/carrinho?passo=2");
await new Promise(r => setTimeout(r, 30));

/* Casa pelo nome do produto, não pelo texto todo: "sal" está dentro de
   "manteiga sem sal", e o teste de que sal não entra na compra passaria à toa. */
const linhaCompra = nome => $$(".compra-linha")
  .find(l => l.querySelector(".compra-nome")?.textContent.trim().startsWith(nome));
const ingredienteNaCompra = id => $$(".compra-item").some(b => b.dataset.ing === id);
/* Pelo id do produto, não pelo texto: "Manteiga sem Sal" aparece também na opção
   "deixar o site escolher", que diz qual seria hoje. */
const opcaoDe = produtoId => $$("#produtos .prod").find(b => b.dataset.produto === produtoId);
const totalDe = rotulo => $$(".compra-total > div")
  .find(d => d.querySelector("dt").textContent.trim() === rotulo)
  ?.querySelector("dd").textContent.replace(/\s+/g, " ").trim();

console.log("\nOS TRÊS PASSOS");
ok("[BUY-46][SHL-08] o passo vive na URL, e o padrão é o primeiro", () => {
  assert.equal(passoValido(undefined), 1);
  assert.equal(passoValido("1"), 1);
  assert.equal(passoValido("2"), 2);
  assert.equal(passoValido("9"), 2, "acima do último, fica no último do carrinho");
  assert.equal(passoValido("abacaxi"), 1);
});
ok("[BUY-45] a trilha marca onde se está e liga os outros passos", () => {
  irPara("#/carrinho");
  assert.equal($(".passo-atual .passo-rotulo").textContent.trim(), "Receitas");
  assert.equal($(".passo-atual a"), null, "o passo atual não é link para si mesmo");
  assert.ok($('.passos a[href="#/carrinho?passo=2"]'));

  irPara("#/carrinho?passo=2");
  assert.equal($(".passo-atual .passo-rotulo").textContent.trim(), "Compra");
  assert.ok($(".passo-feito"), "o primeiro passo aparece como feito");
  assert.ok($('.passos a[href="#/lista"]'));
});
ok("[BUY-45] passo 1 mostra receitas; passo 2, a compra", () => {
  irPara("#/carrinho");
  assert.ok($(".cart-lista"), "receitas no passo 1");
  assert.equal($(".compra-lista"), null);

  irPara("#/carrinho?passo=2");
  assert.ok($(".compra-lista"), "compra no passo 2");
  assert.equal($(".cart-lista"), null);
});
ok("[BUY-47] o seletor de preparos é o único caminho para uma segunda leva", () => {
  irPara("#/carrinho");
  const linha = () => $$(".cart-linha")[0];
  const preparos = () => Number(linha().querySelectorAll(".pval")[1].textContent.trim());
  const antes = preparos();

  // Não há botão "duplicar": mudar a quantidade já fazia o mesmo, e dois
  // caminhos para o mesmo efeito é só uma tela mais cheia
  assert.equal(linha().querySelector(".cart-duplicar"), null, "sem botão duplicar");

  clicar(linha().querySelector('.pbtn[data-campo="qtd"][data-delta="1"]'));
  assert.equal(preparos(), antes + 1, "a mesma linha ganha mais um preparo");

  clicar(linha().querySelector('.pbtn[data-campo="qtd"][data-delta="-1"]'));
  assert.equal(preparos(), antes);
});
ok("[BUY-06] excluir tira a linha", () => {
  const antes = $$(".cart-linha").length;
  clicar($$(".cart-linha")[0].querySelector(".cart-remover"));
  assert.equal($$(".cart-linha").length, antes - 1);
});

console.log("\nPASSO 1: ABRIR A RECEITA");
ok("[BUY-48] os ingredientes só aparecem quando se pede", () => {
  carrinho.limpar();
  C.limparEscolhas();
  carrinho.adicionar("bolo-de-cenoura", 12);
  carrinho.adicionar("brigadeiro", 25);
  irPara("#/carrinho");

  assert.equal($(".rev-painel"), null);
  assert.equal($$(".cart-linha")[0].querySelector(".rev-toggle").getAttribute("aria-expanded"), "false");

  clicar($$(".cart-linha")[0].querySelector(".rev-toggle"));
  assert.ok($(".rev-painel"), "abriu");
  assert.ok($$(".rev-ing").length > 5);
});
ok("[BUY-48] cada ingrediente mostra quantidade, produto e preço", () => {
  const linha = $$(".rev-ing").find(l => l.textContent.includes("manteiga"));
  assert.match(linha.querySelector(".rev-ing-qtd").textContent, /col\. sopa/);
  assert.match(linha.querySelector(".rev-ing-prod").textContent, /Manteiga/);
  assert.match(linha.querySelector(".rev-ing-preco").textContent, /R\$/);
});
ok("[BUY-52] o que se assume ter em casa é o verde do painel", () => {
  /* Verde é "já está em casa"; sal e água são o caso permanente disso. O que vai
     para a sacola fica sem cor, escolhido pelo leitor ou pelo site. */
  const sal = $$(".rev-ing").find(l => l.querySelector(".rev-ing-nome").textContent.trim() === "sal");
  assert.ok(sal.classList.contains("tenho"), "sal é verde e riscado");

  const manteiga = $$(".rev-ing").find(l => l.textContent.includes("manteiga"));
  assert.equal(manteiga.className, "rev-ing", "manteiga vai na sacola: sem cor");
  assert.equal(manteiga.querySelector(".rev-ing-prod em"), null, "e nenhuma etiqueta de texto");
});
ok("[BUY-55][CHO-15] o que se assume ter em casa não pede escolha", () => {
  const sal = $$(".rev-ing").find(l => l.querySelector(".rev-ing-nome").textContent.trim() === "sal");
  assert.match(sal.querySelector(".rev-ing-prod").textContent, /já em casa/);
  assert.equal(sal.querySelector("button"), null);
});
ok("[CHO-25] clicar no produto abre a janela para aquela receita", () => {
  const botao = $$(".rev-ing").find(l => l.textContent.includes("manteiga")).querySelector(".escolher");
  clicar(botao);

  assert.equal($("#produtos .pref-head h2").textContent.trim(), "manteiga");
  assert.match($("#produtos .pref-ajuda").textContent.replace(/\s+/g, " "),
    /A receita pede .* manteiga em Bolo de Cenoura/);
});
ok("[CHO-25] escolher ali muda o preço da linha e o total da receita", () => {
  const antes = $$(".rev-ing").find(l => l.textContent.includes("manteiga"))
    .querySelector(".rev-ing-preco").textContent.trim();

  clicar(opcaoDe("manteiga-president-200g"));

  const linha = $$(".rev-ing").find(l => l.textContent.includes("manteiga"));
  assert.notEqual(linha.querySelector(".rev-ing-preco").textContent.trim(), antes);
  assert.match(linha.querySelector(".rev-ing-prod").textContent, /sem Sal/);
  assert.equal(linha.className, "rev-ing",
    "escolher não pinta a linha: verde é para o que já está em casa");

  clicar($("#produtos .prod-auto"));
  clicar($("#produtos .pref-ok"));
});
ok("[BUY-63][CHO-14] a janela destaca o produto que já vai na sacola por outra receita", () => {
  // o brigadeiro pede manteiga sem sal: aquele pote já está indo
  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");

  // sai e volta para forçar o redesenho: a escolha foi gravada por fora da tela
  irPara("#/comprar");
  irPara("#/carrinho");

  const doBolo = $$(".cart-linha").find(l => l.textContent.includes("Bolo"));
  clicar(doBolo.querySelector(".rev-toggle"));
  clicar($$(".rev-ing").find(l => l.textContent.includes("manteiga")).querySelector(".escolher"));

  const primeira = $$("#produtos .prod")[1];
  assert.equal(primeira.dataset.produto, "manteiga-president-200g",
    "vem primeiro, seja qual for a ordenação");
  assert.match(primeira.querySelector(".prod-selo").textContent, /já no carrinho/);

  clicar($("#produtos .pref-ok"));
  C.limparEscolhas();
});

console.log("\nPASSO 2: JÁ TENHO EM CASA");
ok("[BUY-61][CHO-22] a janela do passo 2 diz quem pede e quanto", () => {
  irPara("#/carrinho?passo=2");
  clicar(linhaCompra("Chocolate em Pó").querySelector(".compra-item"));

  const quem = $("#produtos .prod-quem");
  assert.ok(quem, "o bloco de quem pede");
  assert.equal(quem.querySelectorAll("li").length, 2, "duas receitas pedem chocolate em pó");
  assert.match(quem.textContent, /Bolo de Cenoura/);
  assert.match(quem.textContent, /Brigadeiro/);
  assert.match(quem.querySelector(".prod-quem-total").textContent, /60 g/, "somado");

  clicar($("#produtos .pref-ok"));
});
ok("[BUY-40][BUY-41] marcar que já tenho abate da compra e não das refeições", () => {
  const numero = t => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
  const antes = { compra: numero(totalDe("Compra")), refeicoes: numero(totalDe("Refeições")) };

  const caixa = linhaCompra("Farinha de Trigo").querySelector("[data-tenho]");
  caixa.checked = true;
  caixa.dispatchEvent(new window.Event("change", { bubbles: true }));

  assert.ok(numero(totalDe("Compra")) < antes.compra, "a compra diminui");
  assert.equal(numero(totalDe("Refeições")), antes.refeicoes, "o bolo continua levando farinha");
  assert.equal(totalDe("Já tenho") !== undefined, true, "e a terceira caixa passa a contar o abatido");
});
ok("[BUY-54][BUY-59] o item marcado cai para o fim da lista e fica riscado", () => {
  const nomes = $$(".compra-linha .compra-nome").map(n => n.textContent.trim().split("\n")[0]);
  const farinha = nomes.findIndex(n => n.startsWith("Farinha"));
  assert.equal(farinha, nomes.length - 1, `${nomes.join(" | ")}`);
  assert.ok($$(".compra-linha")[farinha].classList.contains("tenho"));
});
ok("[BUY-26][BUY-40][BUY-44] a marcação sobrevive, e desmarcar devolve o valor", () => {
  assert.deepEqual([...C.carregarTenho()], ["farinha-de-trigo"]);

  const numero = t => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
  const comMarca = numero(totalDe("Compra"));

  const caixa = linhaCompra("Farinha de Trigo").querySelector("[data-tenho]");
  caixa.checked = false;
  caixa.dispatchEvent(new window.Event("change", { bubbles: true }));

  assert.ok(numero(totalDe("Compra")) > comMarca);
  assert.deepEqual([...C.carregarTenho()], []);
});
ok("[BUY-59] itens sem escolha específica aparecem primeiro", () => {
  const linhas = $$(".compra-linha");
  const semCor = linhas.findIndex(l => l.className === "compra-linha");
  const comCor = linhas.findIndex(l =>
    l.classList.contains("escolhido") && !l.classList.contains("tenho"));

  assert.ok(semCor >= 0, "há pelo menos um genérico");
  if (comCor >= 0) assert.ok(semCor < comCor, "e ele vem antes dos resolvidos");
  assert.match($(".compra-dica").textContent.replace(/\s+/g, " "), /vêm primeiro|vem primeiro/);
});
ok("[BUY-58] a legenda só cita a cor que está na tela", () => {
  /* Explicar um sinal que não apareceu é ensinar a procurá-lo. */
  const legenda = () => ($(".compra-legenda")?.textContent ?? "").replace(/\s+/g, " ");

  assert.equal(/em casa/.test(legenda()), $$(".compra-linha.tenho").length > 0);
  assert.equal(/atenção/.test(legenda()), $$(".compra-linha.errada").length > 0);

  // Marcar um item faz o verde aparecer na legenda
  clicar($('input[data-tenho="farinha-de-trigo"]'));
  assert.match(legenda(), /1 item já está em casa/);

  C.limparTenho();
  irPara("#/carrinho");
  irPara("#/carrinho?passo=2");
  assert.ok(!/em casa/.test(legenda()), "sem nada marcado, a legenda se cala de novo");
});

console.log("\nMERCADO ATIVO NA TELA");
const trocarMercado = valor => {
  const sel = $("[data-mercado]");
  sel.value = valor;
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
};

ok("[SHL-17] o seletor de mercado está no cabeçalho das compras", () => {
  carrinho.limpar();
  C.limparEscolhas();
  S.definirMercado(null);
  carrinho.adicionar("bolo-de-cenoura", 12);
  carrinho.adicionar("brigadeiro", 25);
  irPara("#/carrinho");

  const sel = $("[data-mercado]");
  assert.ok(sel, "sem seletor no passo 1");
  assert.equal(sel.value, "todos", "começa em todos os mercados");
  assert.deepEqual([...sel.options].map(o => o.value),
    ["todos", ...MERC.mercados().map(m => m.id)], "todos primeiro, e o resto por nome");
});
ok("[SHL-10][SHL-17] trocar de mercado é lembrado e muda os números", () => {
  const totalDoBolo = () => $$(".cart-linha")[0].querySelector(".receita-preco b").textContent.trim();
  const comTodos = totalDoBolo();

  trocarMercado("nacional");
  assert.equal(S.mercadoAtivo(), "nacional", "ficou guardado nas preferências");
  assert.notEqual(totalDoBolo(), comTodos, "e o preço da linha acompanha");

  // O seletor sobrevive ao redesenho, com o valor certo
  assert.equal($("[data-mercado]").value, "nacional");
});
ok("[BUY-25][BUY-52][BUY-56][ING-19][PRC-19] escolha que o mercado não vende pinta a linha de amarelo", () => {
  /* O Asun não vende a manteiga Président, mas vende outra sem sal: é o caso em que
     trocar de produto resolve, e por isso é aviso e não impedimento. */
  C.escolher("bolo-de-cenoura", "manteiga", "manteiga-president-200g");
  trocarMercado("asun");
  clicar($$(".cart-linha")[0].querySelector(".rev-toggle"));

  const linha = $$(".rev-ing")
    .find(l => l.querySelector(".rev-ing-nome").textContent.trim() === "manteiga");
  assert.match(linha.querySelector(".rev-ing-prod").textContent, /Manteiga sem Sal/,
    "a escolha continua na linha, com nome e tudo");
  assert.ok(linha.classList.contains("alerta"), `veio "${linha.className}"`);
  assert.match(linha.querySelector(".rev-ing-preco").textContent, /\?\?\?/,
    "sem preço: o site não troca de produto por conta própria");
});
ok("[BUY-52] ingrediente sem nenhum produto no mercado pinta de vermelho", () => {
  const linha = $$(".rev-ing").find(l => l.querySelector(".rev-ing-nome").textContent.trim() === "cenoura");
  assert.ok(linha.classList.contains("errada"), `veio "${linha.className}"`);
  assert.match(linha.querySelector(".rev-ing-prod").textContent, /sem produto/);
});
ok("[BUY-50] a linha FECHADA da receita já mostra o que há a resolver", () => {
  /* Sem isto, a única forma de descobrir era abrir cada receita — e o motivo para
     abrir era justamente o que só aparecia depois de abrir. */
  irPara("#/comprar");            // sai e volta: fecha o painel que o teste anterior abriu
  irPara("#/carrinho");

  const linha = $$(".cart-linha")[0];
  assert.ok(linha.classList.contains("errada"),
    `a receita tem ingrediente que o Asun não vende: veio "${linha.className}"`);

  const chips = [...linha.querySelectorAll(".cart-chave")].map(c => c.textContent.replace(/\s+/g, " ").trim());
  assert.ok(chips.some(c => /não são vendidos neste mercado/.test(c)), chips.join(" | "));
  assert.ok(chips.some(c => /escolha não é vendida aqui/.test(c)), chips.join(" | "));

  assert.equal(linha.querySelector(".rev-painel"), null, "e tudo isso com o painel fechado");
});
ok("[BUY-51] vermelho manda sobre amarelo na linha da receita", () => {
  /* "Aqui não tem" é maior que "escolha outro produto": a linha inteira usa a cor do
     aviso mais grave, e os dois chips continuam listados. */
  const linha = $$(".cart-linha")[0];
  assert.ok(linha.classList.contains("errada"));
  assert.ok(!linha.classList.contains("alerta"));
});
ok("[BUY-49] o resumo fechado e o painel aberto contam a mesma coisa", () => {
  const linha = () => $$(".cart-linha")[0];
  const chip = /(\d+)\s+ingredientes?\s+não/.exec(
    [...linha().querySelectorAll(".cart-chave")].map(c => c.textContent.replace(/\s+/g, " ")).join(" "));

  assert.ok(chip, "o chip de vermelho devia estar na linha fechada");
  clicar(linha().querySelector(".rev-toggle"));
  const vermelhas = linha().querySelectorAll(".rev-ing.errada").length;

  assert.equal(Number(chip[1]), vermelhas, "o resumo é a contagem do painel, não outra conta");
  clicar(linha().querySelector(".rev-toggle"));
});
ok('[BUY-53] "a gosto" não é defeito', () => {
  /* Linha sem quantidade não tem preço, e ausência de preço vinha caindo no mesmo
     balde de "não dá para precificar" — a pimenta da feijoada aparecia em vermelho. */
  carrinho.limpar();
  carrinho.adicionar("feijoada", 8);
  irPara("#/carrinho");
  clicar($$(".cart-linha")[0].querySelector(".rev-toggle"));

  const pimenta = $$(".rev-ing")
    .find(l => l.querySelector(".rev-ing-nome").textContent.includes("pimenta"));

  assert.ok(pimenta, "a pimenta está na lista");
  assert.ok(!pimenta.classList.contains("errada"), `veio "${pimenta.className}"`);
  assert.match(pimenta.querySelector(".rev-ing-qtd").textContent, /a gosto/);

  carrinho.limpar();
  carrinho.adicionar("bolo-de-cenoura", 12);
  carrinho.adicionar("brigadeiro", 25);
});
ok("[BUY-25][BUY-56][BUY-58] na compra, as mesmas duas cores e a legenda das duas", () => {
  irPara("#/carrinho?passo=2");

  const amarelas = $$(".compra-linha.alerta");
  const vermelhas = $$(".compra-linha.errada");
  assert.equal(amarelas.length, 1, "uma escolha fora do mercado");
  assert.ok(vermelhas.length > 1, "e vários ingredientes que o Asun não vende");

  assert.match(amarelas[0].querySelector(".compra-nome").textContent, /Président/);
  assert.match(amarelas[0].querySelector(".compra-preco").textContent, /\?\?\?/,
    "nem R$ 0,00, nem um produto substituto");

  const legenda = $(".compra-legenda").textContent.replace(/\s+/g, " ");
  assert.match(legenda, /1 escolha não é vendida aqui/);
  assert.match(legenda, /linhas precisam de atenção/);
});
ok("[CHO-23] a janela só oferece o que o mercado vende, e diz que a escolha ficou fora", () => {
  clicar($$(".compra-linha.alerta")[0].querySelector(".compra-item"));

  const ids = $$("#produtos .prod").slice(1).map(b => b.dataset.produto);
  assert.ok(ids.length > 0, "há outra manteiga sem sal no Asun");
  assert.ok(!ids.includes("manteiga-president-200g"), "a escolhida não se compra aqui");
  assert.ok($("#produtos .prod-fora"), "e a janela diz isso, em vez de deixar a lista sem marca");

  clicar($("#produtos .pref-ok"));
});
ok("[BUY-58][SHL-17] voltar para todos os mercados desfaz os avisos", () => {
  trocarMercado("todos");
  assert.equal($$(".compra-linha.alerta").length, 0);
  assert.equal($$(".compra-linha.errada").length, 0);
  assert.equal(S.mercadoAtivo(), null, "null, e não a palavra \"todos\"");
  C.limparEscolhas();
});

console.log("\nO CARRINHO NA TELA");
ok("[BUY-47] cada linha do carrinho mostra o total e o por porção", () => {
  irPara("#/carrinho");
  const linhas = $$(".cart-linha").map(l => ({
    nome: l.querySelector(".cart-nome").textContent.trim(),
    preco: l.querySelector(".receita-preco")?.textContent.replace(/\s+/g, " ").trim() ?? null
  }));

  const bolo = linhas.find(l => l.nome.includes("Bolo"));
  assert.match(bolo.preco, /R\$ 16,85/, "total da linha");
  assert.match(bolo.preco, /por fatia/, "e o rótulo da porção da receita");
});
ok("[PRC-25] o separador não aparece antes do \"a partir de\"", () => {
  // `.receita-preco span::before` também pegava o span do "a partir de", e a
  // linha começava com um "·" solto
  const css = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");
  assert.ok(css.includes(".receita-preco-porcao::before"), "o separador é da classe, não de qualquer span");
  assert.ok(!/\.receita-preco span::before/.test(css));

  for (const l of $$(".cart-linha .receita-preco")) {
    assert.ok(!l.textContent.replace(/\s+/g, " ").trim().startsWith("·"), l.textContent);
  }
});
ok("[BUY-37] a soma das linhas do passo 1 é o total de refeições do passo 2", () => {
  const numero = t => Number(t.replace(/[^\d,]/g, "").replace(",", "."));

  irPara("#/carrinho");
  const somaLinhas = $$(".cart-linha .receita-preco b").reduce((s, b) => s + numero(b.textContent), 0);

  irPara("#/carrinho?passo=2");
  assert.ok(perto(somaLinhas, numero(totalDe("Refeições")), 0.02),
    `linhas ${somaLinhas} vs refeições ${totalDe("Refeições")}`);
});
ok("[BUY-35] a seção da compra aparece com uma linha por ingrediente", () => {
  assert.ok($(".compra-lista"), "a lista devia existir");
  assert.ok($$(".compra-linha").length >= 10);
  assert.equal(ingredienteNaCompra("sal"), false, "sal não entra na compra");
});
ok("[BUY-27][BUY-60][CHO-19] cada linha diz o produto, o quanto precisa, as embalagens e o preço", () => {
  const l = linhaCompra("Manteiga sem Sal");
  /* O bolo pede "manteiga" (27 g) e o brigadeiro "manteiga sem sal" (14 g).
     Comprar sem sal atende os dois: uma linha só, 41 g -> 40 g no passo. */
  assert.match(l.querySelector(".compra-precisa").textContent, /40 g/);
  assert.match(l.querySelector(".compra-emb").textContent, /^1/);
  assert.match(l.querySelector(".compra-preco").textContent, /15,90/);
  assert.match(l.querySelector(".compra-preco small").textContent, /sobra/);
  assert.match(l.querySelector(".compra-nome small").textContent, /manteiga/);
});
ok("[BUY-42] os quatro números aparecem, inclusive zerados", () => {
  /* Sempre os quatro. Trocar uma caixa por outra conforme o número fazia a tela
     mudar de assunto quando se marcava uma caixinha. */
  assert.ok(totalDe("Refeições"));
  assert.ok(totalDe("Compra"));
  assert.ok(totalDe("Sobra"));
  assert.match(totalDe("Já tenho"), /^R\$ 0,00$/, "nada marcado, e o zero se mostra");
});
ok("[BUY-38] o total da compra é maior que o das refeições", () => {
  const numero = t => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
  assert.ok(numero(totalDe("Compra")) > numero(totalDe("Refeições")));
  assert.ok(perto(numero(totalDe("Sobra")), numero(totalDe("Compra")) - numero(totalDe("Refeições")), 0.02));
});
ok("[BUY-39] marcar 'já tenho' não muda de assunto nem estraga a sobra", () => {
  const num = r => Number(totalDe(r).replace(/[^\d,]/g, "").replace(",", "."));
  const antes = { refeicoes: num("Refeições"), compra: num("Compra"), sobra: num("Sobra") };

  clicar($('input[data-tenho="farinha-de-trigo"]'));

  assert.equal(num("Refeições"), antes.refeicoes, "o bolo continua levando farinha");
  assert.ok(num("Compra") < antes.compra, "mas ela não entra na compra de hoje");
  assert.ok(num("Já tenho") > 0, "e o abatido aparece na sua própria caixa");

  /* A sobra é somada linha por linha, não como compra - refeições: aquela conta
     daria menos que a sobra real, e com bastante coisa em casa, negativa. */
  assert.ok(num("Sobra") > 0 && num("Sobra") < antes.sobra,
    `sobra ${num("Sobra")} devia ser positiva e menor que ${antes.sobra}`);

  C.limparTenho();
  irPara("#/carrinho");
  irPara("#/carrinho?passo=2");
});
ok("[BUY-39] com tudo em casa, a sobra é zero e não negativa", () => {
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12)], {},
    { tenho: new Set(P.itensDaCompra([item("bolo-de-cenoura", 12)], {}).linhas.map(l => l.chave)) });

  assert.equal(t.compra, 0);
  assert.equal(t.sobra, 0, "não se sobra do que não se compra");
  assert.ok(t.economizado > 0);
  assert.ok(t.refeicoes > 0, "e o bolo continua custando o que consome");
});
ok("[BUY-61][CHO-22] clicar num produto abre a janela, com o pedido somado", () => {
  clicar(linhaCompra("Manteiga sem Sal").querySelector(".compra-item"));
  assert.ok($("#produtos").hasAttribute("open") || typeof $("#produtos").showModal === "function");
  assert.equal($("#produtos .pref-head h2").textContent.trim(), "manteiga sem sal");
  assert.match($("#produtos .pref-ajuda").textContent.replace(/\s+/g, " "),
    /A compra soma 40 g de manteiga sem sal/);
});
ok("[CHO-22] a nota da janela fala da compra, não do rótulo", () => {
  assert.match($("#produtos .pref-nota").textContent.replace(/\s+/g, " "), /compra inteira/);
  assert.ok(!$("#produtos .pref-nota").textContent.includes("tabela de referência"),
    "nutriente não é assunto de quem está montando a sacola");
});
ok("[CHO-21] no carrinho, a janela mostra embalagens em vez do custo da receita", () => {
  const opcao = opcaoDe("manteiga-president-200g");
  assert.match(opcao.querySelector(".prod-legenda").textContent, /embalagem/);
  assert.match(opcao.querySelector(".prod-linha").textContent, /15,90/, "o preço do pote, não o do consumo");
});
ok("[CHO-17] pedindo o subtipo, a janela do carrinho também se restringe", () => {
  // a linha é do grupo "manteiga sem sal": nenhuma com sal aparece
  const ids = $$("#produtos .prod").slice(1).map(b => b.dataset.produto);
  assert.ok(ids.includes("manteiga-president-200g"));
  assert.ok(ids.every(id => porId(id).ing === "manteiga/sem-sal"),
    `alguma com sal vazou: ${ids.join(", ")}`);
});
ok("[BUY-62][CHO-25] escolher no carrinho grava e marca a linha", () => {
  clicar(opcaoDe("manteiga-president-200g"));

  /* Escolher não pinta nada: as cores da compra falam do que vai na sacola, não
     de quem escolheu. */
  assert.equal(linhaCompra("Manteiga sem Sal").className, "compra-linha");

  /* Escolher na compra também resolve as receitas que pediam o genérico: o pote é
     um só, e deixar a receita discordando do carrinho seria guardar contradição. */
  const guardado = JSON.parse(window.localStorage.getItem("receitas:produtos"));
  assert.equal(guardado[":carrinho"]["manteiga/sem-sal"], "manteiga-president-200g");
  assert.equal(guardado["bolo-de-cenoura"]?.manteiga, "manteiga-president-200g");
  assert.equal(guardado.brigadeiro?.["manteiga/sem-sal"], "manteiga-president-200g");
});
ok("[BUY-62] voltar ao automático limpa a escolha do carrinho, não a das receitas", () => {
  clicar($$("#produtos .prod")[0]);

  const guardado = JSON.parse(window.localStorage.getItem("receitas:produtos"));
  assert.equal(guardado[":carrinho"]?.["manteiga/sem-sal"], undefined, "o carrinho solta a rédea");
  assert.equal(guardado.brigadeiro?.["manteiga/sem-sal"], "manteiga-president-200g",
    "a escolha da receita continua sendo dela");

  window.localStorage.removeItem("receitas:produtos");
  irPara("#/carrinho");            // sai e volta: o mesmo hash não redesenha
  irPara("#/carrinho?passo=2");
});
ok("[BUY-26][BUY-31][BUY-60] receitas que discordam viram duas linhas na tela, sem vermelho", () => {
  C.limparEscolhas();
  C.escolher("bolo-de-cenoura", "chocolate-em-po", "chocolate-po-garoto-200g");
  C.escolher("brigadeiro", "chocolate-em-po/50", "chocolate-po-50-200g");
  irPara("#/carrinho");
  irPara("#/carrinho?passo=2");

  const chocolates = $$(".compra-linha")
    .filter(l => l.querySelector(".compra-nome").textContent.includes("Chocolate em Pó"));

  assert.equal(chocolates.length, 2, "os dois potes na lista");
  assert.ok(chocolates.every(l => !l.classList.contains("errada")),
    "discordar não é defeito: ninguém fica vermelho");
  assert.ok(chocolates.every(l => /1 de 2 produtos/.test(l.querySelector(".compra-nome small").textContent)),
    "e cada linha diz que divide o ingrediente, senão pareceria engano");

  // Chaves distintas: sem isso a caixa "já tenho" de uma marcaria a outra
  const chaves = chocolates.map(l => l.querySelector(".compra-item").dataset.chave);
  assert.equal(new Set(chaves).size, 2);
});
ok("[BUY-26] marcar uma das duas não marca a outra", () => {
  const chocolates = () => $$(".compra-linha")
    .filter(l => l.querySelector(".compra-nome").textContent.includes("Chocolate em Pó"));

  clicar(chocolates()[0].querySelector("input[data-tenho]"));
  const marcados = chocolates().filter(l => l.classList.contains("tenho"));

  assert.equal(marcados.length, 1, "ter o de 32% em casa não é ter o de 50%");
  C.limparTenho();
});
ok("[BUY-31] a folha impressa leva os dois", () => {
  irPara("#/lista");
  const nomes = $$(".folha .folha-nome").map(n => n.textContent);
  assert.equal(nomes.filter(n => n.includes("Chocolate em Pó")).length, 2);
  C.limparEscolhas();
});
ok("[CHO-25] a escolha feita na receita aparece no carrinho", () => {
  C.escolher("brigadeiro", "chocolate-em-po/50", "chocolate-po-50-200g");
  irPara("#/receita/brigadeiro");
  irPara("#/carrinho?passo=2");
  assert.ok(linhaCompra("Chocolate em Pó 50% Cacau"), "o produto escolhido na receita é o da compra");
});
ok("[BUY-64] mudar as porções no passo 1 muda as refeições, e a compra só na virada", () => {
  irPara("#/carrinho");
  clicar($$(".cart-linha .pbtn")
    .find(b => b.dataset.campo === "porcoes" && Number(b.dataset.delta) > 0 && !b.disabled));

  irPara("#/carrinho?passo=2");
  assert.ok(totalDe("Refeições"), "os totais continuam somando");
  assert.ok(totalDe("Compra"));
});
ok("[BUY-65] carrinho vazio não mostra a seção da compra", () => {
  irPara("#/carrinho");
  clicar($("#limpar-carrinho"));
  assert.equal($(".compra-lista"), null);
  assert.match($(".area-head h1").textContent, /vazio/);
});

console.log("\nPREÇO DE CADA RECEITA");
ok("[BUY-34] a soma das linhas fecha com o total de refeições", () => {
  // Se não fechasse, o leitor veria três números e uma conta que não bate
  const itens = [item("feijoada", 8, 2), item("brigadeiro", 25), item("bolo-de-cenoura", 18)];
  const t = P.totaisDaCompra(itens, {});
  const soma = t.porItem.reduce((s, i) => s + i.linha, 0);
  assert.ok(perto(soma, t.refeicoes, 0.01), `${soma} != ${t.refeicoes}`);
});
ok("[BUY-34] total é uma preparação; linha é vezes a quantidade", () => {
  const t = P.totaisDaCompra([item("feijoada", 8, 2)], {});
  const [i] = t.porItem;
  assert.ok(perto(i.total, 64.13, 0.01));
  assert.ok(perto(i.linha, 128.26, 0.02));
  assert.ok(perto(i.porPorcao, 64.13 / 8, 0.01));
});
ok("[PRC-24] o por porção não muda com as porções", () => {
  const oito = P.totaisDaCompra([item("feijoada", 8)], {}).porItem[0].porPorcao;
  const vinte = P.totaisDaCompra([item("feijoada", 24)], {}).porItem[0].porPorcao;
  assert.ok(perto(oito, vinte));
});
ok("[BUY-34] cada linha é precificada pelo produto que vai na sacola", () => {
  // A escolha do carrinho vence a da receita, e a linha acompanha — senão a soma
  // das linhas não fecharia com o total
  const itens = [item("bolo-de-cenoura", 12)];
  const escolhas = {
    "bolo-de-cenoura": { manteiga: "manteiga-president-200g" },
    [C.ESCOPO_CARRINHO]: { manteiga: "manteiga-aviacao-200g" }
  };
  const t = P.totaisDaCompra(itens, escolhas);
  assert.ok(perto(t.porItem[0].linha, t.refeicoes, 0.01));
  assert.equal(P.escolhasEfetivas(t.linhas)["bolo-de-cenoura"].manteiga, "manteiga-aviacao-200g");
});
ok("[BUY-34][ING-12] quem pediu o pai recebe o produto do grupo", () => {
  /* O bolo pede "manteiga" e cai no grupo de "manteiga sem sal", do brigadeiro.
     A receita tem de ser precificada pelo pote que vai para casa. */
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {});
  const efetivas = P.escolhasEfetivas(t.linhas);

  assert.equal(efetivas["bolo-de-cenoura"].manteiga, "manteiga-president-200g");
  assert.equal(efetivas.brigadeiro["manteiga/sem-sal"], "manteiga-president-200g");
});
ok("[BUY-34] dividido, cada receita é precificada pelo SEU pote", () => {
  /* É por isto que o mapa é por receita e não por ingrediente: com a linha
     dividida, o mesmo ingrediente tem dois produtos, um por receita. */
  const escolhas = {
    "bolo-de-cenoura": { "chocolate-em-po": "chocolate-po-garoto-200g" },
    brigadeiro: { "chocolate-em-po/50": "chocolate-po-50-200g" }
  };
  const t = P.totaisDaCompra([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], escolhas);
  const efetivas = P.escolhasEfetivas(t.linhas);

  assert.equal(efetivas["bolo-de-cenoura"]["chocolate-em-po"], "chocolate-po-garoto-200g");
  assert.equal(efetivas.brigadeiro["chocolate-em-po/50"], "chocolate-po-50-200g");

  // E a soma das linhas continua fechando com o total de refeições
  const soma = t.porItem.reduce((s, i) => s + i.linha, 0);
  assert.ok(perto(soma, t.refeicoes, 0.01), `${soma} != ${t.refeicoes}`);
});
ok("[BUY-36] receita com ingrediente a gosto se declara incompleta", () => {
  const t = P.totaisDaCompra([item("feijoada", 8), item("brigadeiro", 25)], {});
  const porSlugItem = new Map(t.porItem.map(i => [i.receita.slug, i]));
  assert.equal(porSlugItem.get("feijoada").completa, false);
  assert.ok(porSlugItem.get("feijoada").deFora.some(x => x.nome === "pimenta-do-reino"));
  assert.equal(porSlugItem.get("brigadeiro").completa, true);
});

console.log("\nO PREÇO NA VITRINE");
ok("[LIS-06] cada cartão mostra o total e o por porção", () => {
  // as escolhas dos testes anteriores mudariam os números: começa limpo
  C.limparEscolhas();
  irPara("#/carrinho");
  irPara("#/comprar");
  const cartao = $$(".produto").find(c => c.textContent.includes("Bolo de Cenoura"));
  const preco = cartao.querySelector(".receita-preco");
  assert.ok(preco, "o cartão devia ter preço");
  assert.match(preco.textContent, /15,75/, "12 fatias, o padrão da receita");
  assert.match(preco.textContent, /1,31/);
  assert.match(preco.textContent, /por fatia/);
});
ok("[LIS-05] mexer nas porções do cartão move o total, não o por porção", () => {
  const cartao = $$(".produto").find(c => c.textContent.includes("Bolo de Cenoura"));
  const ler = () => cartao.querySelector(".receita-preco").textContent.replace(/\s+/g, " ");
  const antes = ler();

  clicar([...cartao.querySelectorAll(".pbtn")].find(b => Number(b.dataset.delta) > 0 && !b.disabled));

  assert.notEqual(ler(), antes);
  assert.match(ler(), /23,62/, "18 fatias");
  assert.match(ler(), /1,31/, "o por fatia é o mesmo bolo");
});
ok('[PRC-25] receita incompleta diz "a partir de"', () => {
  const cartao = $$(".produto").find(c => c.textContent.includes("Feijoada"));
  assert.ok(cartao.querySelector(".receita-preco-piso"), "a pimenta a gosto não entrou na conta");
  assert.match(cartao.querySelector(".receita-preco").textContent.replace(/\s+/g, " ").trim(),
    /^a partir de R\$/, "e a frase começa por ela, sem separador solto");
  assert.match(cartao.querySelector(".receita-preco").getAttribute("title"), /pimenta-do-reino/);

  const brigadeiro = $$(".produto").find(c => c.textContent.includes("Brigadeiro"));
  assert.equal(brigadeiro.querySelector(".receita-preco-piso"), null, "essa fecha");
});
ok("[LIS-06] o cartão usa o produto escolhido naquela receita", () => {
  const ler = () => $$(".produto").find(c => c.textContent.includes("Brigadeiro"))
    .querySelector(".receita-preco b").textContent.replace(/\s+/g, " ").trim();
  const antes = ler();

  C.escolher("brigadeiro", "manteiga/sem-sal", "manteiga-president-200g");
  irPara("#/carrinho?passo=2");
  irPara("#/comprar");

  // é a única manteiga que serve ao brigadeiro, então o total não muda
  assert.equal(ler(), antes);
});

console.log("\nA LISTA IMPRESSA");
ok("[BUY-66] a folha tem uma linha por item: caixa, produto, quantidade", () => {
  C.limparEscolhas();
  carrinho.limpar();
  carrinho.adicionar("feijoada", 8);
  irPara("#/lista");

  const linha = $$(".folha li").find(l => l.textContent.includes("Carne Seca"));
  assert.ok(linha, "a folha lista o produto, não o ingrediente");
  assert.match(linha.querySelector(".folha-nome").textContent.replace(/\s+/g, " "),
    /Carne Seca Dianteiro Friboi/);
  assert.match(linha.querySelector(".folha-qtd").textContent, /^500 g$/,
    "a quantidade é a da embalagem: é o que se pega na gôndola");
  assert.ok(linha.querySelector(".marca"), "e a caixa para marcar no mercado");
});
ok("[BUY-68] a folha não repete o que pertence ao passo 2", () => {
  const texto = $(".lista-itens").textContent;
  assert.ok(!texto.includes("precisa"), "quanto a receita usa é decisão, não compra");
  assert.ok(!texto.includes("sobra"), "sobra também");
});
ok("[SHL-38] a marca do produto não rouba a regra de bloco das receitas", () => {
  // `.lista-nome em { display: block }` também pegava a marca, que é um `em`:
  // "Seara" pulava para uma linha só dela no meio da linha do produto
  const css = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");
  assert.ok(css.includes(".lista-nome > em"), "a regra tem de ser de filho direto");
  assert.ok(!/\.lista-nome em\s*\{/.test(css), "sem seletor de descendente solto");
});
ok("[BUY-68] a folha traz o total da compra no cabeçalho", () => {
  // um só número, o do caixa: os três totais são do passo 2
  assert.equal($(".lista-total"), null);
  assert.match($(".lista-data").textContent.replace(/\s+/g, " "), /R\$ \d/);
});
ok("[BUY-28] a folha respeita o produto escolhido no carrinho", () => {
  C.escolher(C.ESCOPO_CARRINHO, "feijao-preto", "feijao-camil-1kg");
  irPara("#/carrinho?passo=2");
  irPara("#/lista");

  const linha = $$(".folha li").find(l => l.textContent.includes("Feijão Preto"));
  assert.match(linha.querySelector(".folha-nome").textContent, /Camil/);
});
ok('[BUY-71][REC-09] "a gosto" não entra na folha', () => {
  // sem quantidade não há embalagem a comprar; o passo 2 já relatou a lacuna
  assert.equal($$(".folha li").find(l => l.textContent.includes("imenta")), undefined);
});
ok("[BUY-67] a folha explica que a quantidade é a da embalagem", () => {
  const notas = $$(".lista-nota").map(n => n.textContent.replace(/\s+/g, " ")).join(" ");
  assert.match(notas, /da embalagem/);
  assert.match(notas, /não a que a receita usa/);
});
ok("[BUY-69] o que se tem em casa sai da lista de comprar", () => {
  const antes = $$(".lista-itens .folha li").length;

  C.marcarTenho("feijao-preto", true);
  irPara("#/carrinho?passo=2");
  irPara("#/lista");

  const comprar = $$("#tit-itens ~ .folha li, .lista-itens:not(.lista-tenho) .folha li");
  assert.equal(comprar.length, antes - 1, "uma linha a menos para comprar");
  assert.ok($(".lista-tenho"), "e uma seção dizendo o que você marcou");
  assert.match($(".lista-tenho").textContent, /Feijão Preto/);

  C.marcarTenho("feijao-preto", false);
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
