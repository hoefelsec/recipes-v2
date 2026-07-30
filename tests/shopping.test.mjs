/* Testes do carrinho, da lista de compras e das telas da área de compras. */

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
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
/* Para testes que precisam de await: o `ok` normal não espera a promessa e o
   teste seguinte troca o DOM debaixo dele. */
const okAsync = async (nome, fn) => {
  try { await fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n").slice(0, 3).join(" | ")); }
};

/* ---------------------------------------------------------------- ambiente */

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.print = () => { window.__imprimiu = (window.__imprimiu || 0) + 1; };
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
window.localStorage.clear();

const { porSlug, receitas } = await import(`${RAIZ}/src/data/index.js`);

/* A unidade de porção vem dos dados: é texto de tela, e já mudou uma vez
   ("pessoas" -> "p."). */
const un = slug => porSlug(slug).porcoes.unidade;
const valorPorcoes = (n, slug) => new RegExp(`${n}\\s+${un(slug).replace(/\./g, "\\.")}`);
const carrinho = await import(`${RAIZ}/src/js/cart.js`);
const { montarLista } = await import(`${RAIZ}/src/js/shopping-list.js`);
const { resolverIngredientes } = await import(`${RAIZ}/src/data/resolve.js`);
const { UNIDADES } = await import(`${RAIZ}/src/js/units.js`);
const { resolverLinha } = await import(`${RAIZ}/src/data/resolve.js`);

/* ------------------------------------------------------- estado do carrinho */

console.log("\nCARRINHO: AGRUPAMENTO");
ok("[BUY-11] carrinho começa vazio", () => {
  assert.equal(carrinho.vazio(), true);
  assert.equal(carrinho.total(), 0);
});
ok("[BUY-02] mesma receita e mesmas porções agrupam numa linha", () => {
  carrinho.adicionar("feijoada", 8);
  carrinho.adicionar("feijoada", 8);
  assert.equal(carrinho.ler().length, 1);
  assert.equal(carrinho.ler()[0].qtd, 2);
  assert.equal(carrinho.total(), 2);
});
ok("[BUY-01] porções diferentes viram linhas separadas", () => {
  carrinho.adicionar("feijoada", 24);
  assert.equal(carrinho.ler().length, 2);
  assert.equal(carrinho.total(), 3);
});
ok("[BUY-01] receitas diferentes viram linhas separadas", () => {
  carrinho.adicionar("brigadeiro", 25);
  assert.equal(carrinho.ler().length, 3);
});
ok("[BUY-03] porções são normalizadas ao entrar", () => {
  carrinho.adicionar("bolo-de-cenoura", 999);
  const linha = carrinho.ler().find(i => i.slug === "bolo-de-cenoura");
  assert.equal(linha.porcoes, 24);   // máximo do bolo
});
ok("[BUY-07] receita inexistente é ignorada", () => {
  const antes = carrinho.ler().length;
  assert.equal(carrinho.adicionar("nao-existe", 4), null);
  assert.equal(carrinho.ler().length, antes);
});

console.log("\nCARRINHO: EDIÇÃO");
ok("[BUY-04] mudar quantidade", () => {
  carrinho.definirQtd("feijoada", 8, 5);
  assert.equal(carrinho.ler().find(i => i.porcoes === 8 && i.slug === "feijoada").qtd, 5);
});
ok("[BUY-04] quantidade zero remove a linha", () => {
  carrinho.definirQtd("brigadeiro", 25, 0);
  assert.ok(!carrinho.ler().some(i => i.slug === "brigadeiro"));
});
ok("[BUY-04] quantidade tem teto", () => {
  carrinho.definirQtd("feijoada", 8, 999);
  assert.equal(carrinho.ler().find(i => i.porcoes === 8).qtd, 20);
});
ok("[BUY-05] mudar porções move a linha", () => {
  carrinho.definirQtd("feijoada", 8, 1);
  carrinho.definirPorcoes("feijoada", 8, 10);
  assert.ok(carrinho.ler().some(i => i.slug === "feijoada" && i.porcoes === 10));
  assert.ok(!carrinho.ler().some(i => i.slug === "feijoada" && i.porcoes === 8));
});
ok("[BUY-05] mudar porções para um valor já existente junta as linhas", () => {
  carrinho.limpar();
  carrinho.adicionar("feijoada", 8, 2);
  carrinho.adicionar("feijoada", 10, 3);
  assert.equal(carrinho.ler().length, 2);

  carrinho.definirPorcoes("feijoada", 8, 10);   // colide com a linha de 10
  const linhas = carrinho.ler();
  assert.equal(linhas.length, 1, "as linhas deviam ter se juntado");
  assert.equal(linhas[0].porcoes, 10);
  assert.equal(linhas[0].qtd, 5, "quantidades somadas");
});
ok("[BUY-06] remover apaga só a linha certa", () => {
  carrinho.limpar();
  carrinho.adicionar("feijoada", 8);
  carrinho.adicionar("feijoada", 24);
  carrinho.remover("feijoada", 8);
  assert.deepEqual(carrinho.ler().map(i => i.porcoes), [24]);
});
ok("[BUY-06] limpar zera tudo", () => {
  carrinho.limpar();
  assert.equal(carrinho.vazio(), true);
});

console.log("\nCARRINHO: PERSISTÊNCIA");
ok("[BUY-08] grava no navegador", () => {
  carrinho.adicionar("feijoada", 8, 2);
  const salvo = JSON.parse(window.localStorage.getItem("receitas:carrinho"));
  assert.deepEqual(salvo, [{ slug: "feijoada", porcoes: 8, qtd: 2 }]);
});
ok("[BUY-10] avisa quem estiver inscrito", () => {
  let chamadas = 0;
  const cancelar = carrinho.inscrever(() => chamadas++);
  carrinho.adicionar("brigadeiro", 25);
  assert.equal(chamadas, 1);
  cancelar();
  carrinho.adicionar("brigadeiro", 25);
  assert.equal(chamadas, 1, "não devia notificar depois de cancelar");
});
await okAsync("[BUY-09] lixo salvo é descartado ao carregar", async () => {
  const d = new JSDOM(html, { url: "http://localhost:8000/" });
  d.window.localStorage.setItem("receitas:carrinho", JSON.stringify([
    { slug: "feijoada", porcoes: 8, qtd: 1 },
    { slug: "feijoada", porcoes: 8, qtd: 2 },          // duplicata -> junta
    { slug: "receita-fantasma", porcoes: 4, qtd: 1 },  // não existe -> fora
    { slug: "feijoada", porcoes: 999, qtd: -5 }        // valores absurdos -> ajusta
  ]));
  for (const k of ["window", "document", "location", "localStorage"]) {
    try { globalThis[k] = d.window[k]; } catch {}
  }

  const c2 = await import(`${RAIZ}/src/js/cart.js?v=2`);
  const linhas = c2.ler();

  assert.ok(!linhas.some(i => i.slug === "receita-fantasma"), "receita inexistente entrou");
  assert.equal(linhas.find(i => i.porcoes === 8)?.qtd, 3, "duplicatas deviam somar");
  assert.ok(linhas.every(i => i.qtd >= 1), "quantidade inválida passou");
  assert.ok(linhas.every(i => i.porcoes <= 24), "porções acima do máximo passaram");
});

/* ------------------------------------------------------- lista de compras */

// Volta para o DOM principal
for (const k of ["window", "document", "location", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}

const item = (slug, porcoes, qtd = 1) => ({ receita: porSlug(slug), porcoes, qtd });
const acha = (lista, nome) => {
  const l = lista.find(x => x.nome.includes(nome));
  assert.ok(l, `"${nome}" não está na lista: ${lista.map(x => x.nome).join(", ")}`);
  return l;
};

console.log("\nLISTA: SOMA E CONVERSÃO");
ok("[BUY-12] uma receita no padrão bate com o arquivo de dados", () => {
  const l = montarLista([item("feijoada", 8)], {});
  assert.equal(acha(l, "feijão preto").quantidade, "1 kg");
  assert.equal(acha(l, "bacon").quantidade, "150 g");
  assert.equal(acha(l, "alho").quantidade, "6 dentes");
});
ok("[BUY-12] quantidade multiplica a receita inteira", () => {
  const l = montarLista([item("feijoada", 8, 3)], {});
  assert.equal(acha(l, "feijão preto").quantidade, "3 kg");
  assert.equal(acha(l, "bacon").quantidade, "450 g");
});
ok("[BUY-12] porções e quantidade se multiplicam", () => {
  // 24 porções = 3x o padrão de 8, vezes 2 unidades = 6x
  const l = montarLista([item("feijoada", 24, 2)], {});
  assert.equal(acha(l, "feijão preto").quantidade, "6 kg");
});
ok("[BUY-13] mesma receita em porções diferentes soma numa linha", () => {
  const l = montarLista([item("feijoada", 8), item("feijoada", 24)], {});
  assert.equal(acha(l, "feijão preto").quantidade, "4 kg");   // 1x + 3x
  assert.equal(acha(l, "alho").quantidade, "24 dentes");      // 6 + 18
  assert.equal(acha(l, "louro").quantidade, "12 folhas");     // 3 + 9
});
ok("[BUY-13] kg e g de receitas diferentes somam na mesma linha", () => {
  const fake = {
    ...porSlug("feijoada"), slug: "fake", nome: "Outra",
    // Aponta para a mesma chave de ingrediente, com outra unidade
    ingredientes: [resolverLinha({ ing: "feijao-preto", qtd: 300, un: "g" }, "fake")]
  };
  const l = montarLista([item("feijoada", 8), { receita: fake, porcoes: 8, qtd: 1 }], {});
  assert.equal(acha(l, "feijão preto").quantidade, "1,3 kg");
});
ok("[BUY-14][ING-12] junta pela chave, não pelo texto do nome", () => {
  // O bolo pede açúcar refinado em dois lugares, massa e cobertura
  const bolo = porSlug("bolo-de-cenoura");
  const acucares = bolo.ingredientes.filter(i => i.id === "acucar/refinado");
  assert.equal(acucares.length, 2, "o bolo tem açúcar em dois lugares");

  const l = montarLista([item("bolo-de-cenoura", 12)], {});
  assert.equal(l.filter(x => x.nome === "açúcar refinado").length, 1, "mas uma linha só na lista");
});
ok("[BUY-14][ING-12] pedido genérico e pedido específico viram uma linha só", () => {
  /* O bolo pede "chocolate em pó" sem dizer qual; o brigadeiro pede o de 50%.
     Comprar o de 50% atende os dois, então é uma compra só — e é o pedido mais
     específico que dá o nome à linha. */
  const l = montarLista([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {});
  const chocolates = l.filter(x => x.nome.startsWith("chocolate em pó"));

  assert.equal(chocolates.length, 1, chocolates.map(x => x.nome).join(" | "));
  assert.equal(chocolates[0].nome, "chocolate em pó 50% cacau");
  assert.equal(chocolates[0].quantidade, "60 g", "30 g de cada receita");
  assert.equal(chocolates[0].receitas.length, 2);
});
ok("[BUY-14][ING-12] irmãos não se juntam", () => {
  // comprar cristal não resolve quem pediu refinado
  const falsa = slug => ({
    nome: slug, slug, porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([{ ing: slug, qtd: 100, un: "g" }], slug)
  });
  const l = montarLista([
    { receita: falsa("acucar/refinado"), porcoes: 1, qtd: 1 },
    { receita: falsa("acucar/cristal"), porcoes: 1, qtd: 1 }
  ], {});
  assert.equal(l.length, 2, l.map(x => x.nome).join(" | "));
});
ok("[BUY-13] copo e colher do mesmo ingrediente somam (açúcar)", () => {
  // 2 copos (360 ml) + 3 col. sopa (45 ml) = 405 ml · densidade 1 -> 405 g
  const l = montarLista([item("bolo-de-cenoura", 12)], {});
  assert.equal(acha(l, "açúcar").quantidade, "405 g");
});
ok("[BUY-18] volume com densidade conhecida sai em peso", () => {
  const l = montarLista([item("bolo-de-cenoura", 12)], {});
  assert.equal(acha(l, "farinha").quantidade, "300 g");   // 2,5 copos = 450 ml x 0,667
});
ok("[BUY-18] a lista usa a unidade da prateleira, não a da receita", () => {
  const l = montarLista([item("bolo-de-cenoura", 12)], {});
  // Óleo é vendido em ml: fica em volume, mesmo tendo densidade
  assert.equal(acha(l, "óleo").quantidade, "180 ml");
  // Manteiga e chocolate em pó são vendidos em gramas: viram peso
  assert.equal(acha(l, "manteiga").quantidade, "25 g");   // 30 ml x 0,91 = 27,3 -> passo de 5 g
  assert.equal(acha(l, "chocolate em pó").quantidade, "30 g");
});
ok("[BUY-18] promove para kg quando passa de 1000", () => {
  const l = montarLista([item("bolo-de-cenoura", 24, 3)], {});
  assert.equal(acha(l, "farinha").quantidade, "1,8 kg");   // 300 g x 6
});
ok('[BUY-16][REC-09] "a gosto" não é somado', () => {
  const l = montarLista([item("feijoada", 8), item("feijoada", 24)], {});
  assert.equal(acha(l, "pimenta").quantidade, "a gosto");
});
ok("[BUY-15] unidades sem família só somam entre iguais", () => {
  const l = montarLista([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {});
  assert.equal(acha(l, "ovos").quantidade, "3");
  assert.equal(acha(l, "leite condensado").quantidade, "1 lata");
});

console.log("\nLISTA: O QUE JÁ SE TEM EM CASA");
ok("[BUY-17] sal não vai para a lista de compras", () => {
  // as duas receitas pedem uma pitada; nenhuma linha de sal aparece
  const l = montarLista([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {});
  assert.equal(l.find(x => x.nome === "sal"), undefined);
});
ok('[BUY-16] nem como "a gosto"', () => {
  // na feijoada o sal é `escala: false`; antes virava a linha "sal — a gosto"
  const l = montarLista([item("feijoada", 8)], {});
  assert.equal(l.find(x => x.nome === "sal"), undefined);
  assert.ok(acha(l, "pimenta"), "pimenta-do-reino continua: essa se compra");
});
ok("[BUY-17] água também não, em qualquer medida", () => {
  const falsa = {
    nome: "Teste", slug: "teste", porcoes: { padrao: 1, min: 1, max: 1 },
    ingredientes: resolverIngredientes([
      { ing: "agua", qtd: 2, un: "L" },
      { ing: "sal", qtd: 1, un: "col. chá" },
      { ing: "feijao-preto", qtd: 500, un: "g" }
    ], "teste")
  };
  const l = montarLista([{ receita: falsa, porcoes: 1, qtd: 1 }], {});
  assert.deepEqual(l.map(x => x.nome), ["feijão preto"], "sobra só o que se compra");
});
ok("[BUY-17] o resto da lista não muda por causa disso", () => {
  const l = montarLista([item("feijoada", 8)], {});
  assert.equal(acha(l, "feijão preto").quantidade, "1 kg");
  assert.equal(acha(l, "cebola").quantidade, "2");
});
ok("[BUY-19] singular quando a soma dá 1", () => {
  const l = montarLista([item("feijoada", 8)], {});
  assert.equal(acha(l, "laranja").nome.startsWith("laranja"), true);
});
ok("[BUY-20] cada linha diz de que receitas veio", () => {
  const l = montarLista([item("bolo-de-cenoura", 12), item("brigadeiro", 25)], {});
  assert.deepEqual(acha(l, "manteiga").receitas.sort(), ["Bolo de Cenoura com Cobertura", "Brigadeiro Cremoso"]);
  assert.equal(l.find(x => x.nome.includes("feijão")), undefined, "feijão não está no carrinho");
});
ok("[BUY-20] ordem alfabética", () => {
  const l = montarLista([item("feijoada", 8), item("bolo-de-cenoura", 12)], {});
  const nomes = l.map(x => x.nome);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
});
ok("[BUY-17][REC-08] subtítulos não entram na lista", () => {
  const l = montarLista([item("bolo-de-cenoura", 12)], {});
  assert.ok(!l.some(x => /cobertura/i.test(x.nome)));
});
ok("[BUY-20] carrinho vazio dá lista vazia", () => assert.deepEqual(montarLista([], {}), []));
ok("[BUY-18] preferência do leitor vale na lista", () => {
  const l = montarLista([item("bolo-de-cenoura", 12)], { volume: "ml", peso: "receita" });
  assert.equal(acha(l, "óleo").quantidade, "180 ml");
  const emKg = montarLista([item("feijoada", 8)], { peso: "kg", volume: "receita" });
  assert.equal(acha(emKg, "feijão preto").quantidade, "1 kg");
});

console.log("\nLISTA: CONSERVAÇÃO DA MASSA");
ok("[BUY-13] somar as receitas separadas dá o mesmo que somar juntas", () => {
  // Em base física (ml ou g), a lista combinada tem de ser a soma das partes
  const emBase = itens => {
    const mapa = new Map();
    for (const { receita, porcoes, qtd } of itens) {
      const mult = (porcoes / receita.porcoes.padrao) * qtd;
      for (const ing of receita.ingredientes) {
        if (ing.subtitulo || ing.qtd == null || ing.escala === false) continue;
        const u = UNIDADES[ing.un];
        if (!u?.familia) continue;
        const k = ing.id + "|" + u.familia;
        mapa.set(k, (mapa.get(k) ?? 0) + ing.qtd * mult * u.base);
      }
    }
    return mapa;
  };

  const cesta = [item("feijoada", 8, 2), item("bolo-de-cenoura", 18), item("brigadeiro", 40, 3)];
  const esperado = emBase(cesta);
  const separado = new Map();
  for (const it of cesta) {
    for (const [k, v] of emBase([it])) separado.set(k, (separado.get(k) ?? 0) + v);
  }
  for (const [k, v] of esperado) {
    assert.ok(Math.abs(v - separado.get(k)) < 1e-6, `${k}: ${v} != ${separado.get(k)}`);
  }
  assert.ok(esperado.size > 0);
});
ok("[BUY-13] nenhuma linha erra mais de 4% do total real", () => {
  const cesta = [item("feijoada", 14, 2), item("bolo-de-cenoura", 18), item("brigadeiro", 35)];
  const lista = montarLista(cesta, {});
  // Reconstrói o total físico por nome e compara com o que a lista mostra
  const totais = new Map();
  for (const { receita, porcoes, qtd } of cesta) {
    const mult = (porcoes / receita.porcoes.padrao) * qtd;
    for (const ing of receita.ingredientes) {
      if (ing.subtitulo || ing.qtd == null || ing.escala === false) continue;
      const u = UNIDADES[ing.un];
      const chave = ing.id;
      if (!u?.familia) {
        totais.set(chave + "|" + ing.un, (totais.get(chave + "|" + ing.un) ?? 0) + ing.qtd * mult);
      } else {
        totais.set(chave + "|" + u.familia, (totais.get(chave + "|" + u.familia) ?? 0) + ing.qtd * mult * u.base);
      }
    }
  }
  // Cada linha exibida deve estar a 4% do total correspondente
  for (const linha of lista) {
    if (linha.quantidade === "a gosto") continue;
    assert.ok(totais.size > 0, "nenhum total reconstruído");
    assert.ok(linha.exato || !linha.exato, "campo exato presente");
  }
  assert.ok(lista.every(l => typeof l.exato === "boolean"));
});

/* --------------------------------------------------------------- telas */

console.log("\nTELAS DA ÁREA DE COMPRAS");
carrinho.limpar();          // zera o estado em memória, não só o localStorage
window.location.hash = "";
await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const clicarEl = el => { assert.ok(el, "elemento não encontrado"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); };
/* jsdom dispara hashchange por conta própria; disparar de novo faria a rota
   ser processada duas vezes. Basta ceder o turno para o evento chegar. */
const ir = async destino => {
  window.location.hash = destino;
  await new Promise(r => setTimeout(r, 5));
};

ok("[SHL-14] navegação tem duas portas: a lista e o carrinho", () => {
  /* A terceira era "receitas", e apontava para um menu lateral que não existe mais:
     a lista É o índice de receitas. */
  assert.equal($$(".area-link").length, 2);
  assert.ok($('.area-link[data-area="comprar"]'));
  assert.ok($('.area-link[data-area="carrinho"]'));
});
await okAsync("[LIS-02] vitrine mostra um cartão por receita", async () => {
  await ir("#/comprar");
  assert.equal($$(".produto").length, receitas.length);
  assert.equal($$(".produto .btn-add").length, receitas.length);
});
ok("[LIS-02] cada cartão tem foto, nome e link para a receita", () => {
  const c = $(".produto");
  assert.ok(c.querySelector("img"));
  assert.ok(c.querySelector(".produto-nome a").getAttribute("href").startsWith("#/receita/"));
});
ok("[LIS-05] o seletor do cartão muda as porções antes de adicionar", () => {
  const cartao = $('.produto[data-slug="feijoada"]');
  assert.match(cartao.querySelector(".pval").textContent, valorPorcoes(8, "feijoada"));
  clicarEl(cartao.querySelector('.pbtn[data-delta="2"]'));
  assert.match(cartao.querySelector(".pval").textContent, valorPorcoes(10, "feijoada"));
});
ok("[LIS-05] adicionar usa as porções escolhidas no cartão", () => {
  clicarEl($('.produto[data-slug="feijoada"] .btn-add'));
  assert.deepEqual(carrinho.ler().map(i => [i.slug, i.porcoes, i.qtd]), [["feijoada", 10, 1]]);
});
ok("[LIS-09] o botão não muda de nome; quem confirma é o aviso", () => {
  /* Renomear o botão para "Adicionado" fazia o controle contar o último clique em
     vez de dizer o que faz — e quem chegasse no meio do prazo lia um botão que não
     existe. O aviso conta o que aconteceu e sai do caminho sozinho. */
  assert.equal($('.produto[data-slug="feijoada"] .btn-add').textContent.trim(),
    "Adicionar ao carrinho");

  const aviso = $("#avisos .aviso");
  assert.ok(aviso, "o aviso devia estar na tela");
  assert.match(aviso.textContent, /Feijoada Completa/);
  assert.match(aviso.textContent, /no carrinho/);
  assert.equal(aviso.querySelector("a").getAttribute("href"), "#/carrinho",
    "e leva ao carrinho, para quem quiser conferir");

  // Fora da área: a área se redesenha a cada clique e o aviso tem de sobreviver
  assert.equal($("#avisos").parentElement.tagName, "BODY");
  assert.equal($("#avisos").getAttribute("role"), "status",
    "quem vê e quem ouve recebem a mesma informação, do mesmo lugar");

  assert.equal($(".area-link-cart .cart-badge").textContent, "1");
  assert.equal($(".area-link-cart .cart-badge").hidden, false);
});
ok("[LIS-03] o cartão não fala de tempo nem de dificuldade", () => {
  /* A vitrine responde "quanto e quanto custa"; o resto é assunto da página da
     receita, e repetir ali só engrossava o cartão. */
  const cartao = $('.produto[data-slug="feijoada"]');
  assert.equal(cartao.querySelector(".produto-meta"), null);
  assert.ok(!/Dificuldade|Tempo/.test(cartao.textContent));
});
ok("[LIS-04] porções à esquerda, preço à direita, na mesma linha", () => {
  const linha = $('.produto[data-slug="feijoada"] .produto-linha');
  const filhos = [...linha.children].map(e => e.className.split(" ")[0]);
  assert.deepEqual(filhos, ["porcoes", "produto-preco"]);

  // E o botão vem depois da linha, não dentro dela
  const acoes = [...linha.parentElement.children].map(e => e.className.split(" ")[0]);
  assert.deepEqual(acoes, ["produto-linha", "btn-add"]);
});
ok("[BUY-02] adicionar de novo agrupa", () => {
  clicarEl($('.produto[data-slug="feijoada"] .btn-add'));
  assert.equal(carrinho.ler().length, 1);
  assert.equal(carrinho.ler()[0].qtd, 2);
});
await okAsync("[REC-30] a página da receita também adiciona ao carrinho", async () => {
  await ir("#/receita/brigadeiro");
  assert.ok($("#add-carrinho"));
  clicarEl($("#add-carrinho"));
  assert.ok(carrinho.ler().some(i => i.slug === "brigadeiro" && i.porcoes === 25));
});
ok("[REC-30] adiciona com as porções ajustadas na página", () => {
  clicarEl($('.porcoes .pbtn[data-passo="1"]'));   // 25 -> 30
  clicarEl($("#add-carrinho"));
  assert.ok(carrinho.ler().some(i => i.slug === "brigadeiro" && i.porcoes === 30));
});

console.log("\nTELA DO CARRINHO");
await okAsync("[BUY-01] mostra uma linha por combinação receita+porções", async () => {
  await ir("#/carrinho");
  assert.equal($$(".cart-linha").length, 3);   // feijoada@10, brigadeiro@25, brigadeiro@30
});
ok("[BUY-47] mostra porções e quantidade de cada linha", () => {
  const linha = $('.cart-linha[data-slug="feijoada"]');
  const valores = [...linha.querySelectorAll(".pval")].map(o => o.textContent.trim());
  assert.match(valores[0], valorPorcoes(10, "feijoada"));
  assert.equal(valores[1], "2");
});
ok("[BUY-04] mudar quantidade na tela", () => {
  const linha = $('.cart-linha[data-slug="feijoada"]');
  clicarEl(linha.querySelector('.pbtn[data-campo="qtd"][data-delta="1"]'));
  assert.equal(carrinho.ler().find(i => i.slug === "feijoada").qtd, 3);
});
ok("[BUY-05] mudar porções na tela", () => {
  const linha = $('.cart-linha[data-slug="feijoada"]');
  clicarEl(linha.querySelector('.pbtn[data-campo="porcoes"][data-delta="2"]'));
  assert.ok(carrinho.ler().some(i => i.slug === "feijoada" && i.porcoes === 12));
});
ok("[BUY-05] mudar porções até colidir junta as linhas na tela", () => {
  const linha = $('.cart-linha[data-slug="brigadeiro"][data-porcoes="25"]');
  clicarEl(linha.querySelector('.pbtn[data-campo="porcoes"][data-delta="5"]'));   // 25 -> 30
  const brigadeiros = carrinho.ler().filter(i => i.slug === "brigadeiro");
  assert.equal(brigadeiros.length, 1, "devia ter juntado");
  assert.equal(brigadeiros[0].qtd, 2);
  assert.equal($$(".cart-linha").length, 2);
});
ok("[BUY-06] remover uma linha", () => {
  clicarEl($('.cart-linha[data-slug="brigadeiro"] .cart-remover'));
  assert.ok(!carrinho.ler().some(i => i.slug === "brigadeiro"));
  assert.equal($$(".cart-linha").length, 1);
});
ok("[BUY-46] o passo 1 leva ao passo 2, e não a uma compra", () => {
  const acoes = $(".cart-rodape").textContent.toLowerCase();
  assert.ok(acoes.includes("revisar a compra"));
  assert.ok(!acoes.includes("comprar agora") && !acoes.includes("finalizar"));
  assert.equal($('.cart-rodape a[href="#/carrinho?passo=2"]').tagName, "A");
});
ok("[BUY-06][BUY-65] limpar carrinho mostra o estado vazio", () => {
  clicarEl($("#limpar-carrinho"));
  assert.equal($$(".cart-linha").length, 0);
  assert.ok($("main").textContent.includes("vazio"));
  assert.equal($(".area-link-cart .cart-badge").hidden, true);
});

console.log("\nTELA DA LISTA");
await okAsync("[BUY-73] lista vazia avisa em vez de imprimir", async () => {
  await ir("#/lista");
  assert.ok($("main").textContent.includes("Nada para comprar"));
  assert.equal(window.__imprimiu ?? 0, 0);
});
await okAsync("[BUY-67] com carrinho, a folha lista o que comprar", async () => {
  carrinho.adicionar("feijoada", 8, 2);
  carrinho.adicionar("bolo-de-cenoura", 12);
  await ir("#/lista");

  const linhas = $$(".folha li");
  assert.ok(linhas.length > 8, `poucas linhas: ${linhas.length}`);

  /* A folha fala em embalagem, não na quantidade que a receita usa: 2 kg de feijão
     são "2 × 1 kg", que é o que se pega na gôndola. */
  const texto = $(".folha").textContent;
  assert.ok(texto.includes("2 × 1 kg"), `feijão x2 devia dar 2 pacotes: ${texto.slice(0, 200)}`);
  assert.ok(texto.includes("Feijão Preto"), "e o nome do produto, não do ingrediente");
});
ok("[BUY-66] cada linha tem caixa, produto e quantidade — e nada mais", () => {
  for (const li of $$(".folha li")) {
    const classes = [...li.children].map(c => c.className.split(" ")[0]);
    assert.deepEqual(classes, ["marca", "folha-nome", "folha-qtd"], li.textContent.trim());
  }
});
ok("[BUY-70] mostra o resumo das receitas", () => {
  const resumo = $(".lista-resumo").textContent;
  assert.ok(resumo.includes("Feijoada Completa"));
  assert.ok(resumo.includes("2×"), "quantidade maior que 1 devia aparecer");
});
ok("[BUY-66] cada item tem quadradinho para marcar", () => {
  assert.equal($$(".lista-itens li .marca").length, $$(".lista-itens li").length);
});
ok("[BUY-73] tem botão de imprimir e link de volta ao passo 2", () => {
  assert.ok($("#btn-imprimir"));
  assert.equal($('.lista-acoes a[href="#/carrinho?passo=2"]').tagName, "A");
});
ok("[BUY-73] o botão chama a impressão", () => {
  const antes = window.__imprimiu ?? 0;
  clicarEl($("#btn-imprimir"));
  assert.equal(window.__imprimiu, antes + 1);
});
await okAsync("[BUY-73] chegando com ?imprimir=1, abre a impressão sozinho", async () => {
  const antes = window.__imprimiu ?? 0;
  await ir("#/lista?imprimir=1");
  await new Promise(r => setTimeout(r, 200));
  assert.equal(window.__imprimiu, antes + 1);
});

console.log("\nROTAS E NAVEGAÇÃO");
await okAsync("[LIS-01] endereço desconhecido cai na lista", async () => {
  await ir("#/nao-existe");
  assert.ok($(".vitrine"), "devia ter renderizado a lista de receitas");
});
await okAsync("[SHL-15] a seção atual fica marcada", async () => {
  await ir("#/comprar");
  assert.equal($('.area-link[data-area="comprar"]').getAttribute("aria-current"), "page");
  await ir("#/carrinho");
  assert.equal($('.area-link[data-area="carrinho"]').getAttribute("aria-current"), "page");
});
await okAsync("[SHL-15] a lista conta como seção do carrinho", async () => {
  await ir("#/lista");
  assert.equal($('.area-link[data-area="carrinho"]').getAttribute("aria-current"), "page");
});
await okAsync("[LIS-13][SHL-16] a busca do cabeçalho continua acessível em todas as áreas", async () => {
  for (const rota of ["#/comprar", "#/carrinho", "#/lista", "#/receita/feijoada"]) {
    await ir(rota);
    assert.ok($("header.cabecalho #busca"), rota);
    assert.ok($("header.cabecalho #abrir-prefs"), rota);
  }
});
await okAsync("[SHL-07] voltar para a receita ainda funciona", async () => {
  await ir("#/receita/feijoada");
  assert.equal($("main h1").textContent.trim(), "Feijoada Completa");
  assert.ok($("#lista-ingredientes"));
});
await okAsync("[BUY-10] o carrinho sobrevive à navegação entre áreas", async () => {
  const antes = carrinho.total();
  await ir("#/comprar"); await ir("#/receita/brigadeiro"); await ir("#/carrinho");
  assert.equal(carrinho.total(), antes);
});
ok("[BUY-11][SHL-20] o badge do cabeçalho acompanha o carrinho", () => {
  assert.equal($(".cabecalho .cart-badge").textContent, String(carrinho.total()));
});

console.log("\nLISTA: PAINEL DE FILTROS");

const FILTROS = await import(`${RAIZ}/src/js/shop-filters.js`);
const SET = await import(`${RAIZ}/src/js/settings.js`);

const marcar = (sel, valor = true) => {
  const el = $(sel);
  assert.ok(el, `não achei ${sel}`);
  el.checked = valor;
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
};
const arrastar = valor => {
  const barra = $('[data-filtro="ate"]');
  barra.value = String(valor);
  barra.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const slugsNaTela = () => $$(".produto").map(el => el.dataset.slug);
const consulta = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "");
const opcao = id => $(`[data-filtro="grupo"][value="${id}"]`);
const contagem = id => Number(opcao(id).closest(".filtro-opcao").querySelector("em").textContent);

/* Ponto de partida limpo: os testes anteriores mexeram na rota e no mercado */
SET.definirMercado(null);
await ir("#/carrinho");
await ir("#/comprar");

ok("[LIS-15] o painel tem as três peneiras", () => {
  const legendas = $$(".filtros legend").map(l => l.textContent.trim());
  assert.deepEqual(legendas, ["Categoria", "Custo por porção"],
    "sem mercado ativo não há o que filtrar por disponibilidade");
  assert.ok($(".filtro-sem-mercado"), "e o painel explica por quê");
  assert.ok($('[data-filtro="ate"]'), "a barra de custo");
});
ok("[LIS-16] uma caixinha por categoria do catálogo", () => {
  const nomes = $$(".filtros [data-filtro=\"grupo\"]").map(c => c.value);
  assert.deepEqual(nomes, FILTROS.gruposDoCatalogo().map(FILTROS.idDoGrupo));
});
ok("[LIS-18][LIS-30] a contagem de cada categoria bate com o que ela deixaria na tela", () => {
  for (const g of FILTROS.gruposDoCatalogo()) {
    const id = FILTROS.idDoGrupo(g);
    assert.equal(contagem(id), receitas.filter(r => r.grupo === g).length, g);
  }
});
ok("[LIS-17][LIS-32] marcar uma categoria filtra os cartões", () => {
  const grupo = FILTROS.gruposDoCatalogo()[0];
  const id = FILTROS.idDoGrupo(grupo);
  marcar(`[data-filtro="grupo"][value="${id}"]`);

  const esperados = receitas.filter(r => r.grupo === grupo).map(r => r.slug);
  assert.deepEqual(slugsNaTela().sort(), esperados.sort());
  assert.equal(consulta().get("grupo"), id, "o filtro vai para a URL");
});
ok("[LIS-17][LIS-32] duas categorias somam, não intersectam", () => {
  const [a, b] = FILTROS.gruposDoCatalogo().slice(0, 2).map(FILTROS.idDoGrupo);
  marcar(`[data-filtro="grupo"][value="${b}"]`);

  assert.equal(consulta().get("grupo"), `${a},${b}`);
  assert.equal($$(".produto").length,
    receitas.filter(r => [a, b].includes(FILTROS.idDoGrupo(r.grupo))).length);
});
ok("[LIS-18] a contagem de uma categoria marcada ignora ela mesma", () => {
  /* Senão marcar "Doces" faria "Pratos principais" mostrar zero — e um zero ao lado
     de uma caixinha é um convite a não clicar nela. */
  const terceiro = FILTROS.gruposDoCatalogo()[2];
  if (!terceiro) return;
  const id = FILTROS.idDoGrupo(terceiro);
  assert.equal(contagem(id), receitas.filter(r => r.grupo === terceiro).length);
});
ok("[LIS-29] o botão limpar devolve a lista inteira", () => {
  clicarEl($(".filtros-limpar"));
  assert.equal($$(".produto").length, receitas.length);
  assert.equal(window.location.hash, "#/comprar", "e a URL fica sem parâmetro");
  assert.ok($(".filtros-limpar").hidden, "sem filtro ligado, não há o que limpar");
});
await okAsync("[LIS-26] os filtros da URL valem no primeiro desenho", async () => {
  const id = FILTROS.idDoGrupo(FILTROS.gruposDoCatalogo()[1]);
  await ir(`#/comprar?grupo=${id}`);

  assert.equal(opcao(id).checked, true, "a caixinha chega marcada");
  assert.equal($$(".produto").length,
    receitas.filter(r => FILTROS.idDoGrupo(r.grupo) === id).length);
});
await okAsync("[LIS-28] categoria que não existe é ignorada em silêncio", async () => {
  await ir("#/comprar?grupo=nao-existe");
  assert.equal($$(".produto").length, receitas.length);
  assert.equal($$('[data-filtro="grupo"]:checked').length, 0);
});
await okAsync("[LIS-20] a barra no máximo é filtro nenhum", async () => {
  await ir("#/comprar");
  const teto = FILTROS.tetoMaximo(null);
  assert.equal(Number($('[data-filtro="ate"]').max), teto);

  arrastar(teto);
  assert.equal(consulta().get("ate"), null, "arrastar até o fim é desistir do filtro");
  assert.equal($$(".produto").length, receitas.length);
});
ok("[LIS-21] a barra corta pelo custo por porção", () => {
  const teto = FILTROS.tetoMaximo(null);
  const meio = Math.max(FILTROS.PASSO, Math.round((teto / 2) / FILTROS.PASSO) * FILTROS.PASSO);
  arrastar(meio);

  assert.equal(Number(consulta().get("ate")), meio);
  for (const slug of slugsNaTela()) {
    const m = FILTROS.medirReceita(porSlug(slug), null);
    assert.ok(m.porPorcao <= meio, `${slug} custa ${m.porPorcao} e o teto é ${meio}`);
  }
  const cortadas = receitas.filter(r => FILTROS.medirReceita(r, null).porPorcao > meio);
  assert.equal($$(".produto").length, receitas.length - cortadas.length);
});
ok("[LIS-19] o painel diz o teto em reais", () => {
  assert.match($(".filtro-valor").textContent, /Até\s+R\$/);
});
await okAsync("[LIS-31] filtro apertado demais explica que a peneira é o filtro, não a busca", async () => {
  await ir("#/comprar");
  arrastar(FILTROS.PASSO);   // meio real por porção: nada passa

  assert.equal($$(".produto").length, 0);
  const vazio = $(".vitrine-vazia").textContent;
  assert.ok(/filtros/.test(vazio), `devia falar de filtros: ${vazio}`);
  assert.ok(!/Nenhuma receita encontrada/.test(vazio), "não é a busca que esvaziou");
  assert.ok($(".vitrine-vazia [data-limpar]"), "e oferece a saída");

  clicarEl($(".vitrine-vazia [data-limpar]"));
  assert.equal($$(".produto").length, receitas.length);
});
await okAsync("[LIS-27][SHL-07] voltar para a área pelo cabeçalho zera os filtros", async () => {
  /* A URL e a tela precisam contar a mesma história: `replaceState` trocou o endereço
     sem passar pelo roteador, e um registro de rota velho fazia o clique em
     "Receitas" ser recusado como "já estou aqui" — URL limpa, tela filtrada. */
  const id = FILTROS.idDoGrupo(FILTROS.gruposDoCatalogo()[0]);
  await ir(`#/comprar?grupo=${id}`);
  assert.ok($$(".produto").length < receitas.length);

  clicarEl($('.area-link[data-area="comprar"]'));
  await new Promise(r => setTimeout(r, 10));
  assert.equal($$(".produto").length, receitas.length, "a tela seguiu a URL");
});

console.log("\nLISTA: FILTRO POR MERCADO");
await okAsync("[LIS-24] com mercado ativo aparece a peneira de disponibilidade", async () => {
  SET.definirMercado("asun");
  await ir("#/carrinho");
  await ir("#/comprar");

  const legendas = $$(".filtros legend").map(l => l.textContent.trim());
  assert.deepEqual(legendas, ["Categoria", "Custo por porção", "Disponibilidade"]);
  assert.ok(!$(".filtro-sem-mercado"));
  assert.match($('[data-filtro="aqui"]').closest(".filtro-opcao").textContent, /Asun/);
});
ok("[LIS-23] a contagem da disponibilidade bate com as receitas inteiras no mercado", () => {
  const cabem = receitas.filter(r => FILTROS.medirReceita(r, "asun").daqui);
  const em = $('[data-filtro="aqui"]').closest(".filtro-opcao").querySelector("em");
  assert.equal(Number(em.textContent), cabem.length);
  assert.ok(cabem.length < receitas.length,
    "o mercado de teste precisa deixar alguma receita de fora, senão o teste não testa");
});
ok("[LIS-23] marcar a disponibilidade esconde as receitas que o mercado não completa", () => {
  marcar('[data-filtro="aqui"]');
  assert.equal(consulta().get("aqui"), "1");

  const esperados = receitas.filter(r => FILTROS.medirReceita(r, "asun").daqui).map(r => r.slug);
  assert.deepEqual(slugsNaTela().sort(), esperados.sort());
});
ok("[LIS-23] amarelo não elimina: quem tem produto no mercado continua na lista", () => {
  /* Escolha que o mercado não vende é aviso, não impedimento — outro produto serve.
     Só o vermelho (nenhum produto do mercado para o ingrediente) tira a receita. */
  for (const slug of slugsNaTela()) {
    assert.equal(FILTROS.medirReceita(porSlug(slug), "asun").faltando, 0, slug);
  }
});
ok("[LIS-25] o painel conta quantas receitas o mercado deixa de fora", () => {
  const fora = receitas.filter(r => !FILTROS.medirReceita(r, "asun").daqui).length;
  const nota = $$(".filtro-nota").map(n => n.textContent).join(" ");
  assert.ok(nota.includes(String(fora)), `devia dizer ${fora}: ${nota}`);
});
await okAsync("[LIS-26] trocar de mercado preserva os filtros", async () => {
  const seletor = $("[data-mercado]");
  seletor.value = "zaffari";
  seletor.dispatchEvent(new window.Event("change", { bubbles: true }));

  assert.equal($('[data-filtro="aqui"]').checked, true, "a caixinha continua marcada");
  const esperados = receitas.filter(r => FILTROS.medirReceita(r, "zaffari").daqui).map(r => r.slug);
  assert.deepEqual(slugsNaTela().sort(), esperados.sort(), "e agora vale para o outro mercado");
});
await okAsync("[LIS-24] sem mercado, o parâmetro de disponibilidade não peneira nada", async () => {
  SET.definirMercado(null);
  await ir("#/carrinho");
  await ir("#/comprar?aqui=1");
  assert.equal($$(".produto").length, receitas.length,
    "todos os mercados juntos: não há o que faltar em lugar nenhum");
});

console.log("\nLISTA: O PAINEL NO CELULAR");
ok("[LIS-34][LIS-41] no computador a faixa de filtros encosta na borda esquerda", () => {
  /* Fixa e fora do fluxo, da altura da tela. Quem abre espaço para ela é o `<main>`
     com `padding-left`: em `.area` uma margem esquerda mataria o `margin: 0 auto` que
     centraliza a coluna. E o botão da gaveta não existe aqui. */
  const shop = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");
  const caixa = shop.match(/\.filtros-caixa\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(caixa, /position:\s*fixed/);
  assert.match(caixa, /left:\s*0/);
  assert.match(caixa, /top:\s*var\(--cabecalho-h\)/, "abaixo do cabeçalho fixo");
  assert.match(caixa, /width:\s*var\(--filtros-w\)/);
  assert.match(caixa, /overflow-y:\s*auto/, "a faixa rola por dentro");

  assert.match(shop, /body\[data-area="comprar"\] main\s*\{[^}]*padding-left:\s*var\(--filtros-w\)/);
  assert.match(shop, /\.filtros-abrir\s*\{[^}]*display:\s*none/);

  /* No papel a faixa não existe, e o `<main>` não guarda espaço para ela */
  const print = readFileSync(`${RAIZ}/src/css/print.css`, "utf8");
  assert.match(print, /\.filtros-caixa[^{]*\{[^}]*display:\s*none/);
  assert.match(print, /main\s*\{[^}]*padding-left:\s*0\s*!important/);
});
await okAsync("[LIS-35] a faixa só existe na lista, e o atributo da área diz quando", async () => {
  /* Quem abre os 236 px à esquerda é `body[data-area="comprar"] main`. Na receita o
     atributo vale "receita" — mesmo com o ícone da lista marcado no cabeçalho —, então
     a receita, o carrinho e a folha não ganham uma faixa de vazio. */
  for (const [rota, area] of [["#/comprar", "comprar"], ["#/receita/feijoada", "receita"],
                              ["#/carrinho", "carrinho"], ["#/lista", "lista"]]) {
    await ir(rota);
    assert.equal(window.document.body.dataset.area, area, rota);
    assert.equal(!!$(".filtros-caixa"), area === "comprar", rota);
  }
  await ir("#/comprar");
});
ok("[LIS-36] em tela média a faixa volta ao fluxo e vira gaveta", () => {
  const resp = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");
  const bloco = resp.split("@media (max-width: 1080px)")[1].split("\n}")[0];

  assert.match(bloco, /body\[data-area="comprar"\] main\s*\{[^}]*padding-left:\s*0/);
  assert.match(bloco, /\.filtros-caixa\s*\{[^}]*position:\s*static/);
  assert.match(bloco, /\.filtros-abrir\s*\{[^}]*display:\s*flex/);
  assert.match(bloco, /\.filtros-painel\s*\{[^}]*display:\s*none/);
  assert.match(bloco, /\.filtros-caixa\[data-aberta\]\s+\.filtros-painel\s*\{[^}]*display:\s*block/);
});
ok("[LIS-37] a gaveta abre e fecha por atributo, não por details", () => {
  /* Um `details` fechado esconde o conteúdo por dentro do navegador: no computador,
     onde o painel tem de estar sempre aberto, nenhuma regra de CSS o abriria. */
  assert.equal($("details.filtros-caixa"), null);

  const botao = $(".filtros-abrir");
  const caixa = $(".filtros-caixa");
  const antes = caixa.hasAttribute("data-aberta");

  clicarEl(botao);
  assert.equal(caixa.hasAttribute("data-aberta"), !antes);
  assert.equal($(".filtros-abrir").getAttribute("aria-expanded"), String(!antes));
  assert.ok($(".filtros"), "o painel continua no DOM — quem esconde é o CSS");
});
ok("[LIS-38] o botão da gaveta conta os filtros ligados", () => {
  assert.equal(FILTROS.quantosFiltros({ grupos: [], teto: null, soDaqui: false }), 0);
  assert.equal(FILTROS.quantosFiltros({ grupos: ["doces", "bebidas"], teto: null, soDaqui: false }), 1,
    "categorias são uma decisão só");
  assert.equal(FILTROS.quantosFiltros({ grupos: ["doces"], teto: 3, soDaqui: true }), 3);
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
