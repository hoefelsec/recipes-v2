/* Verificação do site: carrega index.html no jsdom, executa os módulos reais
   e checa estrutura, rotas, busca, escape de HTML e acessibilidade. */

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

/* Raiz do projeto, a partir deste arquivo — assim os testes rodam de qualquer lugar */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const html = readFileSync(`${RAIZ}/index.html`, "utf8");

const dom = new JSDOM(html, { url: "http://localhost:8000/", pretendToBeVisual: true });
const { window } = dom;

// Stubs do que o jsdom não implementa
window.scrollTo = () => {};
window.matchMedia = q => ({
  matches: /max-width:\s*860px/.test(q) ? false : false,
  media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
});
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history"]) {
  try { globalThis[k] = window[k]; } catch { /* já definido pelo Node */ }
}

const { receitas } = await import(`${RAIZ}/src/data/index.js`);
await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

/* `#/` agora abre a LISTA, não uma receita: sem menu lateral, a lista é o índice.
   Os testes de estrutura da receita precisam pedir uma. */
const irPara = destino => {
  window.location.hash = destino;
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
};
irPara(`#/receita/${receitas[0].slug}`);

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const falhas = [];
const ok = (nome, fn) => {
  try { fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n")[0]); }
};
/* Para o que depende do `hashchange`, que no jsdom chega no próximo tique — trocar
   de área de dentro de um ouvinte é assíncrono, e fingir que não é esconderia isso. */
const okAsync = async (nome, fn) => {
  try { await fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n")[0]); }
};

console.log("\nESTRUTURA DA PÁGINA");
ok("[REC-18] foto do resultado final no topo", () => {
  const img = $("main .hero img");
  assert.ok(img, "sem <img> no hero");
  assert.ok(img.getAttribute("src").length > 10);
  assert.ok(img.getAttribute("alt").length > 10, "alt ausente ou curto demais");
  // a foto tem de vir antes de tudo no artigo
  const primeiro = $("main article").firstElementChild;
  assert.equal(primeiro.className, "hero");
});
ok("[REC-18] as 5 seções obrigatórias existem", () => {
  const t = $("main").textContent;
  for (const s of ["Porções", "Tempo de preparo", "Ingredientes", "Utensílios", "Modo de preparo"]) {
    assert.ok(t.includes(s), `faltou: ${s}`);
  }
});
ok("[REC-21] faixa de dados: 4 campos + botão de carrinho", () => {
  assert.equal($$("main .meta > div").length, 5);
  assert.equal($$("main .meta > div:not(.meta-add)").length, 4);
  assert.ok($("main .meta .meta-add #add-carrinho"), "botão de adicionar ao carrinho");
});
ok("[REC-19] hierarquia de títulos: um só h1", () => assert.equal($$("main h1").length, 1));
ok("[REC-22] na lista de ingredientes, o nome vem antes da quantidade", () => {
  for (const li of $$("main .ing li:not(.sub)")) {
    const filhos = [...li.children];
    assert.ok(filhos[0].classList.contains("ing-nome"), `primeiro: ${filhos[0].outerHTML}`);
    assert.ok(filhos[1].classList.contains("qty"), `segundo: ${filhos[1]?.outerHTML}`);
  }
});
ok("[REC-23] seções com aria-labelledby apontando para id existente", () => {
  for (const sec of $$("main section[aria-labelledby]")) {
    assert.ok($(`#${sec.getAttribute("aria-labelledby")}`), sec.getAttribute("aria-labelledby"));
  }
});

console.log("\nDADOS x TELA (todas as receitas)");
for (const r of receitas) {
  /* Nome literal, e o slug em cada mensagem: o nome do teste é a chave que liga o
     requisito ao teste, e uma chave interpolada não casa com citação nenhuma. */
  ok("[REC-24] contagens conferem com o arquivo de dados", () => {
    window.location.hash = `#/receita/${r.slug}`;
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    assert.equal($("main h1").textContent.trim(), r.nome, r.slug);
    assert.equal($$("main .steps > li").length, r.preparo.length, `${r.slug}: nº de etapas`);
    assert.equal($$("main .ut li").length, r.utensilios.length, `${r.slug}: nº de utensílios`);
    const ingVisiveis = $$("main .ing li:not(.sub)").length;
    assert.equal(ingVisiveis, r.ingredientes.filter(i => !i.subtitulo).length, `${r.slug}: nº de ingredientes`);
    assert.equal($$("main .ing li.sub").length, r.ingredientes.filter(i => i.subtitulo).length, `${r.slug}: nº de subtítulos`);
    assert.ok($("main .meta").textContent.includes(String(r.porcoes.padrao)), `${r.slug}: porções não exibidas`);
    assert.ok($("main .meta").textContent.includes(r.porcoes.unidade), `${r.slug}: unidade das porções não exibida`);
    assert.equal(window.document.title, `${r.nome} · Caderno de Receitas`, r.slug);
  });
}

console.log("\nNAVEGAÇÃO E ROTAS");
ok("[SHL-12] não há menu lateral: a lista de receitas é o índice", () => {
  /* Um índice lateral ao lado da lista de compras seria a mesma lista escrita duas
     vezes, com duas maneiras de ficar fora de sincronia. */
  assert.equal($("#sidebar"), null);
  assert.equal($("#nav"), null);
  assert.equal($(".scrim"), null, "sem gaveta, sem overlay");
  assert.equal($("#burger"), null, "e sem botão para abri-la");
});
ok("[LIS-01][SHL-03] `#/` abre a lista, e não uma receita ao acaso", () => {
  irPara("#/");
  assert.ok($(".vitrine"), "a lista de receitas");
  assert.equal($$(".produto").length, receitas.length);
  assert.equal(window.document.body.dataset.area, "comprar");
});
ok("[LIS-02] cada cartão da lista abre a sua receita", () => {
  for (const r of receitas) {
    const cartao = $$(".produto").find(c => c.dataset.slug === r.slug);
    assert.ok(cartao, `${r.slug} não está na lista`);
    assert.equal(cartao.querySelector(".produto-nome a").getAttribute("href"),
      `#/receita/${encodeURIComponent(r.slug)}`);
  }
});
ok("[SHL-15] na receita, a seção da lista continua marcada", () => {
  /* A receita não é uma seção à parte: chegou-se nela pela lista, e é para lá que o
     ícone aponta de volta. */
  irPara(`#/receita/${receitas[0].slug}`);
  const marcados = $$('.area-link[aria-current="page"]');
  assert.equal(marcados.length, 1);
  assert.equal(marcados[0].dataset.area, "comprar");
});
ok("[SHL-03] hash inválido cai na lista", () => {
  irPara("#/nao-existe");
  assert.ok($(".vitrine"));
});
ok("[SHL-04] receita inexistente cai na primeira", () => {
  irPara("#/receita/nao-existe");
  assert.equal($("main h1").textContent.trim(), receitas[0].nome);
});
ok("[SHL-12][SHL-13] o cabeçalho é um só, com marca à esquerda e ações à direita", () => {
  /* Antes eram dois: a barra do celular (com marca e nome da receita) e o topo do
     menu lateral (com a marca de novo). O nome da receita saiu de lá porque o `<h1>`
     do hero diz o mesmo, logo abaixo. */
  const cab = $("header.cabecalho");
  assert.ok(cab, "sem cabeçalho");
  assert.equal($$("header.cabecalho").length, 1);

  assert.ok(cab.querySelector(".brand-mark"), "a marca vive no cabeçalho");

  for (const parte of ["#busca", "#mercado-topo", "#abrir-prefs", ".areas"]) {
    assert.ok(cab.querySelector(parte), `faltou ${parte} no cabeçalho`);
  }

  /* Dois grupos, e o corte cai entre o que se digita e o que se aponta: no celular a
     fileira de baixo é só busca e mercado. Com um grupo só, os quatro desciam juntos
     e o campo de busca ficava com 26 px. */
  assert.ok(cab.querySelector(".cabecalho-acoes #busca"));
  assert.ok(cab.querySelector(".cabecalho-acoes #mercado-topo"));
  assert.ok(cab.querySelector(".cabecalho-atalhos #abrir-prefs"));
  assert.ok(cab.querySelector(".cabecalho-atalhos .areas"));

  // A ordem no HTML é a ordem lida por leitor de tela: marca, depois ações
  const filhos = [...cab.children].map(e => e.className.split(" ")[0]);
  assert.deepEqual(filhos, ["brand-mark", "cabecalho-acoes", "cabecalho-atalhos"]);

  // As duas portas: a lista e o carrinho, e nada mais
  assert.deepEqual([...cab.querySelectorAll(".area-link")].map(a => a.dataset.area),
    ["comprar", "carrinho"]);
});

console.log("\nBUSCA");
const buscar = v => {
  $("#busca").value = v;
  $("#busca").dispatchEvent(new window.Event("input", { bubbles: true }));
};
ok("[LIS-12][LIS-13] a busca vive no cabeçalho e filtra a lista", () => {
  irPara("#/");
  buscar("brigadeiro");
  assert.equal($$(".produto").length, 1);
  assert.ok($("header.cabecalho #busca"), "o campo é do cabeçalho");
});
ok("[LIS-12] busca ignora acento e caixa (FEIJAO)", () => { buscar("FEIJAO"); assert.equal($$(".produto").length, 1); });
ok("[LIS-12] busca por ingrediente (cenoura)", () => {
  buscar("cenoura");
  assert.equal($$(".produto").length, 1);
  assert.ok($$(".produto")[0].textContent.includes("Cenoura"));
});
ok("[LIS-12][LIS-31] estado vazio quando nada casa", () => {
  buscar("zzzz");
  assert.equal($$(".produto").length, 0);
  assert.ok($(".vitrine-vazia"), "sem mensagem de estado vazio");
  assert.match($(".vitrine-vazia").textContent, /zzzz/, "e ela repete o que foi digitado");
});
await okAsync("[LIS-14] digitar numa receita leva para a lista", async () => {
  /* Buscar é pedir uma lista, e a receita aberta não tem onde mostrá-la. */
  buscar("");
  irPara(`#/receita/${receitas[0].slug}`);
  buscar("bolo");

  await new Promise(r => setTimeout(r, 0));   // o `hashchange` do jsdom

  assert.ok($(".vitrine"), "saiu da receita");
  assert.equal($$(".produto").length, 1);
  assert.equal($("#busca").value, "bolo", "e o que foi digitado continua lá");
});
ok("[LIS-12] limpar a busca restaura a lista", () => { buscar(""); assert.equal($$(".produto").length, receitas.length); });

console.log("\nSEGURANÇA E ROBUSTEZ");
ok("[SHL-26] texto de dados é escapado (sem injeção de HTML)", async () => {
  const { renderizarReceita } = await import(`${RAIZ}/src/js/recipe-view.js`);
  const alvo = window.document.createElement("div");
  renderizarReceita({
    ...receitas[0],
    nome: '<img src=x onerror=alert(1)>"malicioso"',
    imagem: { src: "x.jpg", alt: "a" },
    utensilios: ["<script>alert(2)</script>"]
  }, alvo);
  assert.equal(alvo.querySelectorAll("script").length, 0, "script injetado");
  assert.equal(alvo.querySelectorAll("h1 img").length, 0, "img injetada no título");
  assert.ok(alvo.querySelector("h1").textContent.includes("malicioso"));
});
ok("[REC-20] imagem tem fallback declarado (onerror)", () => {
  // O teste anterior mexeu na área: a foto do hero só existe numa receita
  irPara(`#/receita/${receitas[0].slug}`);
  assert.ok($("main .hero img").getAttribute("onerror").includes("this.src="));
});
ok("[SHL-27] nenhum link externo sem rel=noopener", () => {
  for (const a of $$('main a[target="_blank"]')) {
    assert.ok((a.getAttribute("rel") || "").includes("noopener"), a.outerHTML);
  }
});

console.log("\nACESSIBILIDADE (estático)");
ok("[SHL-25] skip link presente e aponta para o main", () => {
  assert.equal($(".skip-link").getAttribute("href"), "#conteudo");
  assert.ok($("#conteudo"));
});
ok("[SHL-25] os atalhos do cabeçalho têm nome para leitor de tela", () => {
  // São ícones: sem o texto escondido, um leitor de tela anuncia "link" e mais nada
  for (const link of $$(".cabecalho .area-link")) {
    assert.ok(link.querySelector(".sr-only")?.textContent.trim(), link.outerHTML);
    assert.ok(link.getAttribute("title"), "e dica ao passar o mouse");
  }
});
ok("[LIS-12] campo de busca tem label", () => {
  assert.ok($('label[for="busca"]') || $("#busca").getAttribute("aria-label"));
});
ok("[REC-04][REC-20] toda imagem tem alt", () => {
  for (const img of $$("img")) assert.ok(img.hasAttribute("alt"), img.outerHTML);
});

console.log("\nCATÁLOGO DE INGREDIENTES");
const { INGREDIENTES, CAMPOS_NUTRIENTES, ids, temEmCasa, descendentes, linhagem } =
  await import(`${RAIZ}/src/data/ingredientes.js`);
const { problemas, resolverLinha } = await import(`${RAIZ}/src/data/resolve.js`);

ok("[ING-13] toda chave usada nas receitas existe no catálogo", () => {
  assert.deepEqual(problemas, [], problemas.join(" · "));
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.subtitulo) continue;
      assert.ok(!ing.desconhecido, `${r.slug}: ${ing.id}`);
      assert.ok(INGREDIENTES[ing.id], `${r.slug}: chave "${ing.id}" fora do catálogo`);
    }
  }
});
ok("[ING-15] nenhum ingrediente do catálogo está órfão", () => {
  const usados = new Set(
    receitas.flatMap(r => r.ingredientes.filter(i => !i.subtitulo).map(i => i.id))
  );

  /* Três coisas não contam como órfãs:
     - o que se assume ter em casa (água é ingrediente de quase tudo e quase nunca
       aparece escrita na lista);
     - um nó que existe para agrupar: ninguém precisa pedir "manteiga" para que
       "manteiga com sal" faça sentido;
     - um subtipo cujo pai ou irmão é pedido — é a variedade que dá escolha na
       janela de produtos, e é ela que justifica a árvore. */
  const servePorParentesco = id => {
    const eu = INGREDIENTES[id];
    if (descendentes(id).some(d => usados.has(d))) return true;   // eu ou algum filho
    return Boolean(eu.pai) && descendentes(eu.pai).some(d => usados.has(d));
  };

  const orfaos = ids().filter(id => !temEmCasa(INGREDIENTES[id]) && !servePorParentesco(id));
  assert.deepEqual(orfaos, [], `sem receita que use: ${orfaos.join(", ")}`);
});
ok("[ING-09] o que se assume ter em casa está marcado", () => {
  assert.deepEqual(ids().filter(id => temEmCasa(INGREDIENTES[id])).sort(), ["agua", "sal"]);
});

console.log("\nÁRVORE DE SUBTIPOS");
ok("[ING-01][ING-02][ING-11] o id conta a linhagem", () => {
  assert.equal(INGREDIENTES["manteiga/sem-sal"].pai, "manteiga");
  assert.equal(INGREDIENTES["manteiga"].pai, null);
  assert.deepEqual(INGREDIENTES["manteiga"].filhos, ["manteiga/com-sal", "manteiga/sem-sal"]);
  assert.deepEqual(linhagem("manteiga/sem-sal"), ["manteiga", "manteiga sem sal"]);
});
ok("[ING-03][ING-04] o subtipo herda do pai o que não declara", () => {
  // a densidade da manteiga está no pai; os dois subtipos a herdam
  assert.equal(INGREDIENTES["manteiga/com-sal"].densidade, 0.91);
  assert.equal(INGREDIENTES["manteiga/sem-sal"].densidade, 0.91);
  // e o que declaram vale sobre o do pai
  assert.equal(INGREDIENTES["acucar/cristal"].densidade, 0.95);
  assert.equal(INGREDIENTES["acucar"].densidade, 1.0);
});
ok("[ING-03][ING-04][ING-05] o pai toma nutrientes do subtipo mais comum", () => {
  for (const id of ids()) {
    const no = INGREDIENTES[id];
    if (!no.comoO) continue;

    const comum = INGREDIENTES[`${id}/${no.comoO}`];
    assert.ok(comum, `${id}: comoO aponta para subtipo que não existe`);
    assert.deepEqual(no.nutrientes, comum.nutrientes,
      `${id}: os números do pai deviam ser os do ${no.comoO}`);
  }
});
ok("[ING-06] todo pai com subtipos diz de qual deles vêm os números", () => {
  const semComoO = ids().filter(id => INGREDIENTES[id].filhos.length && !INGREDIENTES[id].comoO);
  assert.deepEqual(semComoO, [],
    "sem isso o pai ficaria sem densidade e sem nutrientes, e a receita genérica não teria conta");
});
ok("[ING-03][ING-08] todo nó tem nome próprio, e o do subtipo diz o que é", () => {
  for (const id of ids()) {
    const no = INGREDIENTES[id];
    assert.ok(no.nome, `${id}: sem nome`);
    if (no.pai) {
      assert.notEqual(no.nome, INGREDIENTES[no.pai].nome,
        `${id}: o subtipo tem de se chamar diferente do pai`);
    }
  }
});
ok("[ING-03][ING-07] subtipo herda o que o pai declara sobre estado e casa", () => {
  assert.equal(INGREDIENTES["oleo/soja"].liquido, true, "declarado no pai óleo");
  assert.equal(INGREDIENTES["leite/desnatado"].liquido, true);
  assert.equal(INGREDIENTES["acucar/mascavo"].liquido, false);
});
ok("[ING-14] chave desconhecida não derruba a página", () => {
  const antes = problemas.length;
  const r = resolverLinha({ ing: "nao-existe", qtd: 1, un: "g" }, "teste");
  assert.equal(r.desconhecido, true);
  assert.ok(r.item.includes("nao-existe"), "o problema tem de ficar visível na tela");
  assert.equal(problemas.length, antes + 1, "e registrado para os testes pegarem");
  problemas.length = antes;   // não contamina os outros testes
});
ok("[ING-08][NUT-01] cada entrada do catálogo tem nome e forma de nutrientes válida", () => {
  for (const [id, ing] of Object.entries(INGREDIENTES)) {
    assert.ok(ing.nome && typeof ing.nome === "string", `${id}: sem nome`);
    assert.ok(!/[A-Z]/.test(ing.nome[0]), `${id}: nome devia começar em minúscula`);

    if (ing.nutrientes === null) continue;
    for (const campo of CAMPOS_NUTRIENTES) {
      const v = ing.nutrientes[campo];
      assert.equal(typeof v, "number", `${id}: nutriente "${campo}" faltando`);
      assert.ok(v >= 0, `${id}: "${campo}" negativo`);
    }
    assert.ok(ing.nutrientes.kcal <= 900, `${id}: kcal acima do possível por 100 g`);
  }
});
ok("[ING-09][NUT-06] o que não é comida não tem nutrientes", () => {
  for (const [id, ing] of Object.entries(INGREDIENTES)) {
    if (ing.comestivel === false) assert.equal(ing.nutrientes, null, id);
  }
});
ok("[REC-11] o preparo fica na receita, não no catálogo", () => {
  // "picada", "em cubos", "dessalgada" descrevem o que a receita faz com o
  // ingrediente — no catálogo isso poluiria a lista de compras
  for (const [id, ing] of Object.entries(INGREDIENTES)) {
    for (const palavra of ["picad", "amassad", "em cubos", "em rodelas", "dessalgad", "ralad"]) {
      assert.ok(!ing.nome.includes(palavra), `${id}: "${ing.nome}" tem preparo no nome`);
    }
  }
});

console.log("\nCASCATA DO CSS");

/* O jsdom não faz layout, mas aplica a cascata — e é aí que moram os defeitos
   de seletor solto: uma regra escrita para UM elemento acaba pegando todos os
   outros do mesmo tipo. Já aconteceu três vezes neste projeto (nav, aside e o
   reset de margem em dialog), então cada caso virou teste. */
function paginaComCss() {
  const css = ["tokens", "base", "header", "recipe", "settings", "shop", "responsive"]
    .map(f => readFileSync(`${RAIZ}/src/css/${f}.css`, "utf8")).join("\n");
  const comCss = html
    .replace(/<link rel="stylesheet"[^>]*>/g, "")
    .replace("</head>", `<style>${css}</style></head>`);
  return new JSDOM(comCss, { url: "http://localhost/" }).window;
}

ok("[SHL-37] quem zera margem no universal devolve a de <dialog>", () => {
  /* `* { margin: 0 }` apaga o `margin: auto` com que o navegador centraliza um
     dialog modal, e a janela vai para o canto superior esquerdo.

     Este teste olha o FONTE, não o estilo calculado: o jsdom devolve "auto"
     para margin de <dialog> com ou sem a regra, então uma verificação por
     getComputedStyle passaria sempre — e teste que não falha não serve. */
  const base = readFileSync(`${RAIZ}/src/css/base.css`, "utf8");
  const zeraTudo = /\*\s*\{[^}]*margin:\s*0/.test(base);

  if (zeraTudo) {
    assert.match(base, /(^|\n)\s*dialog[^{]*\{[^}]*margin:\s*auto/,
      "o reset universal precisa de uma exceção para dialog");
  }
});
ok("[SHL-36] nenhum <aside> é posicionado por seletor de elemento", () => {
  /* A barra lateral era o `<aside>` do site, e `aside { position: fixed }` pegou a
     rosca de nutrientes, que virou um painel fixo no canto. A barra saiu; a regra que
     ela obrigou a escrever fica, porque a rosca continua sendo um `<aside>`. */
  const w = paginaComCss();
  const doc = w.document;

  const solto = doc.createElement("aside");
  solto.className = "nutri-rosca";
  doc.body.appendChild(solto);

  assert.equal(w.getComputedStyle(solto).position, "static", "aside comum não deve ser fixo");
});
ok("[SHL-36] nenhum seletor de elemento solto e posicionador no CSS", () => {
  /* `main` fica fora da lista: a especificação permite um só por documento,
     então um seletor `main` não pode pegar outro elemento por acidente. Os
     demais repetem à vontade na página. */
  const arriscados = ["aside", "nav", "section", "header", "footer", "article", "form", "dialog"];
  const problemas = [];

  for (const arquivo of ["base", "header", "recipe", "settings", "shop", "responsive"]) {
    const css = readFileSync(`${RAIZ}/src/css/${arquivo}.css`, "utf8");

    for (const el of arriscados) {
      // seletor do tipo `aside {` ou `aside,` começando a linha
      for (const m of css.matchAll(new RegExp(`^[ \\t]*${el}\\s*[,{]`, "gm"))) {
        const bloco = css.slice(m.index, css.indexOf("}", m.index));
        // Só o que tira o elemento do fluxo ou muda o modo de layout é perigoso.
        // `margin-left` não conta — daí a âncora no começo da declaração.
        const perigoso = /(^|[;{]\s*)(position|inset|flex)\s*:/.test(bloco)
          || /(^|[;{]\s*)display\s*:\s*(flex|grid)/.test(bloco);
        if (perigoso) problemas.push(`${arquivo}.css: "${el}" solto posicionando`);
      }
    }
  }
  assert.deepEqual(problemas, [], problemas.join(" · "));
});
ok("[SHL-24] a altura do cabeçalho é declarada, e os três a usam", () => {
  /* O cabeçalho é fixo: o `<main>` e o menu lateral se posicionam a partir dela. Se
     um deles usar outro número, o conteúdo passa por baixo do cabeçalho ou sobra uma
     faixa em branco — e o jsdom não faz layout para reclamar. No celular ela tem
     dois valores porque tem duas fileiras, e o segundo é declarado junto. */
  const tokens = readFileSync(`${RAIZ}/src/css/tokens.css`, "utf8");
  const recipe = readFileSync(`${RAIZ}/src/css/recipe.css`, "utf8");
  const header = readFileSync(`${RAIZ}/src/css/header.css`, "utf8");
  const resp = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");

  assert.match(tokens, /--cabecalho-h:\s*\d+px/, "a altura vive em tokens.css");
  assert.match(resp, /:root\s*\{[^}]*--cabecalho-h:\s*\d+px/, "e é redeclarada no celular");

  assert.match(recipe, /main\s*\{[^}]*margin-top:\s*var\(--cabecalho-h\)/, "o main desvia dela");
  assert.match(header, /\.cabecalho\s*\{[^}]*height:\s*var\(--cabecalho-h\)/, "e ela é a altura do próprio cabeçalho");
});
ok("[SHL-23] no celular, busca e mercado descem para a própria fileira e repartem", () => {
  /* Em 430 px a fileira única transbordava 106 px. Quem quebra a linha é o FILHO do
     cabeçalho: o mercado é neto, e `flex-basis` nele não empurrava nada.

     E a fileira de baixo leva só os dois campos. O mínimo automático de um `<select>`
     é o texto da sua opção mais longa: "Todos os mercados" ocupava 164 px e não cedia,
     então o campo de busca encolhia até 26 px. Metade para cada um, e `min-width: 0`
     para autorizar o corte. */
  const resp = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");
  const cel = resp.split("@media (max-width: 860px) {")[1].split("\n}\n\n/*")[0];

  assert.match(cel, /\.cabecalho\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(cel, /\.cabecalho-acoes\s*\{[^}]*flex-basis:\s*100%/);
  assert.match(cel, /\.cabecalho-acoes\s*\{[^}]*order:\s*2/, "os atalhos ficam na fileira de cima");
  assert.match(cel, /\.cabecalho \.busca\s*\{[^}]*flex:\s*1/);
  assert.match(cel, /\.cabecalho #mercado-topo\s*\{[^}]*flex:\s*1/,
    "quem reparte é a caixa do seletor, não o seletor de dentro dela");
  assert.match(cel, /\.cabecalho \.mercado-seletor select\s*\{[^}]*min-width:\s*0/);
  assert.match(cel, /\.cabecalho \.mercado-logo\s*\{[^}]*display:\s*none/, "o enfeite cede ao nome");
});
ok("[SHL-22] a busca ocupa a folga do cabeçalho — mas só onde há folga", () => {
  /* Era um campo de 190 px numa barra de 1900, com o vazio entre a marca e os botões.
     Cresce por `flex`, com teto: sem `max-width` engoliria a barra inteira.

     E cresce só do tablet para cima. No celular a mesma fileira leva o mercado, a
     engrenagem e dois ícones — em 430 px o campo com `flex: 1` e um mínimo de 140 px
     empurrava os vizinhos 74 px para fora da tela, pela esquerda. Lá ele CEDE. */
  const header = readFileSync(`${RAIZ}/src/css/header.css`, "utf8");
  const resp = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");
  const largas = resp.split("@media (min-width: 861px) {")[1]?.split("\n}")[0] ?? "";

  assert.match(header, /\.busca input\s*\{[^}]*max-width:\s*100%/, "no celular o campo encolhe");
  assert.doesNotMatch(header, /\.busca\s*\{[^}]*flex:\s*1/, "e não cresce por padrão");

  assert.match(largas, /\.cabecalho-acoes\s*\{[^}]*flex:\s*1/, "o pai precisa de folga para repartir");
  assert.match(largas, /\.busca\s*\{[^}]*flex:\s*1/);
  assert.match(largas, /\.busca\s*\{[^}]*max-width:\s*\d+px/);
  assert.match(largas, /\.busca input\s*\{[^}]*width:\s*100%/);
});
ok("[SHL-19] a seta do seletor de mercado é desenhada por nós", () => {
  /* Numa pílula, a seta nativa encosta na curva da borda: ela é pintada fora da caixa
     de conteúdo, e nenhum `padding` a alcança. `appearance: none` traz o controle de
     volta — e aí a folga da direita é declarada, igual em todo navegador. */
  const shop = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");
  const regra = shop.match(/\.mercado-seletor select\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(regra, /appearance:\s*none/);
  assert.match(regra, /background-image:\s*url\(/, "a seta vem de um SVG embutido");
  assert.match(regra, /padding:[^;]*\s3[0-9]px/, "e há folga à direita para ela");
  assert.match(regra, /background-position:\s*right\s+\d+px/);
});
ok("[SHL-32] nenhuma classe é componente e modificador ao mesmo tempo", () => {
  /* O oitavo defeito de tela desta série, e o primeiro que não é seletor de
     ELEMENTO solto: `.aviso` era o componente do aviso passageiro (fundo escuro,
     `display: flex`, sombra, animação) e passou a ser também o estado amarelo de
     uma linha de tabela. `.compra-linha.aviso` ganhava o fundo certo por
     especificidade — e herdava layout, sombra e `color: #fff` do outro, que apagou
     o "12" do seletor de porções sobre o creme.

     A regra: uma classe usada como componente (`.x` sozinha no compound) não pode
     ser usada como modificador (`.y.x`). Estado é adjetivo; componente é
     substantivo, e a mesma palavra não pode ser os dois. */
  const sozinhas = new Map();
  const modificadoras = new Map();

  for (const arquivo of ["base", "header", "recipe", "settings", "shop", "responsive", "print"]) {
    const css = readFileSync(`${RAIZ}/src/css/${arquivo}.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const regra of css.matchAll(/([^{}@]+)\{/g)) {
      for (const sel of regra[1].split(",")) {
        for (const composto of sel.trim().split(/[\s>+~]+/)) {
          if (!composto.startsWith(".")) continue;

          const classes = [...composto.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m => m[1]);
          if (classes.length === 1) sozinhas.set(classes[0], arquivo);
          else for (const c of classes.slice(1)) modificadoras.set(c, arquivo);
        }
      }
    }
  }

  const colisoes = [...sozinhas.keys()]
    .filter(c => modificadoras.has(c))
    .map(c => `.${c} (componente em ${sozinhas.get(c)}.css, modificador em ${modificadoras.get(c)}.css)`);

  assert.deepEqual(colisoes, [], colisoes.join(" · "));
});
ok("[LIS-08][SHL-34] nada de largura mínima automática nas linhas apertadas", () => {
  /* O jsdom não faz layout, então este é um teste de intenção. O mínimo automático
     de um item flex é o tamanho do seu conteúdo: um número comprido empurra a linha
     para fora do cartão em vez de apertar o vizinho. Foi assim que o preço da
     vitrine vazou pela borda direita — e `white-space: nowrap`, que eu havia posto
     para evitar a quebra, garantia o vazamento. `min-width: 0` desarma isso. */
  const shop = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");

  assert.match(shop, /\.produto-linha \.porcoes\s*\{[^}]*min-width:\s*0/);
  assert.match(shop, /\.produto-preco\s*\{[^}]*min-width:\s*0/);
  assert.ok(!/\.produto-preco[^{]*\{[^}]*white-space:\s*nowrap/.test(shop),
    "nowrap num item que precisa encolher é vazamento garantido");
});
ok("[SHL-33] nenhum `:nth-of-type` pendurado numa classe", () => {
  /* `:nth-of-type` conta por TAG entre os irmãos, não por classe. Escrito depois
     de uma classe ele parece dizer "o primeiro .cart-controle" e diz outra coisa:
     na linha do carrinho, `.cart-controle:nth-of-type(1)` não pegava ninguém (o
     primeiro <div> é `.cart-info`) e o `(2)` pegava o stepper de porções, que ia
     para a área do de preparos. Para "o primeiro com esta classe", classe. */
  const problemas = [];

  for (const arquivo of ["base", "header", "recipe", "settings", "shop", "responsive", "print"]) {
    // Sem os comentários: é lá que se explica o seletor errado que saiu daqui
    const css = readFileSync(`${RAIZ}/src/css/${arquivo}.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/\.[\w-]+:nth-of-type\([^)]*\)/g)) {
      problemas.push(`${arquivo}.css: ${m[0]}`);
    }
  }
  assert.deepEqual(problemas, [], problemas.join(" · "));
});
ok('[SHL-39] "Excluir" compensa o rótulo que não tem', () => {
  /* Os vizinhos são bloco de rótulo + stepper; o botão é só botão. Centralizados
     na mesma fileira, o botão subia ~10 px em relação aos steppers. A margem
     devolve isso — e as duas medidas do rótulo saem de variáveis, para que mudar
     o rótulo não desalinhe o botão em silêncio. */
  const shop = readFileSync(`${RAIZ}/src/css/shop.css`, "utf8");
  const resp = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");
  const tokens = readFileSync(`${RAIZ}/src/css/tokens.css`, "utf8");

  assert.match(tokens, /--rotulo-linha:\s*\d/, "a medida do rótulo é variável e global");
  assert.match(shop, /\.cart-rotulo\s*\{[^}]*line-height:\s*var\(--rotulo-linha\)/);
  assert.match(shop, /\.cart-rotulo\s*\{[^}]*margin-bottom:\s*var\(--rotulo-respiro\)/);
  assert.match(shop, /\.cart-remover\s*\{[^}]*margin-top:\s*calc\(var\(--rotulo-linha\)\s*\+\s*var\(--rotulo-respiro\)\)/,
    "o botão compensa a altura inteira do rótulo");

  // No celular o rótulo vai para o lado do stepper: não há o que compensar
  assert.match(resp, /\.cart-remover\s*\{[^}]*margin-top:\s*0/);
});
ok("[SHL-35] no celular, cada stepper do carrinho tem sua própria área", () => {
  const css = readFileSync(`${RAIZ}/src/css/responsive.css`, "utf8");
  const areas = [...css.matchAll(/grid-area:\s*(porcoes|qtd)\s*;/g)].map(m => m[1]);

  assert.deepEqual([...new Set(areas)].sort(), ["porcoes", "qtd"], "as duas áreas são reivindicadas");
  assert.match(css, /\.cart-porcoes\s*\{[^}]*grid-area:\s*porcoes/);
  assert.match(css, /\.cart-preparos\s*\{[^}]*grid-area:\s*qtd/);
});

ok("[SHL-21] no cabeçalho, quem empurra é a marca", () => {
  /* Só a marca cresce; as ações ficam do tamanho do que carregam. Antes um `nav`
     solto esticava o menu de seções e empurrava a busca para o meio da tela. */
  const w = paginaComCss();
  const estilo = sel => w.getComputedStyle(w.document.querySelector(sel));

  assert.equal(estilo(".cabecalho .brand-mark").marginRight, "auto");
  assert.equal(estilo(".cabecalho").display, "flex");
  assert.equal(estilo(".areas").flexGrow, "0", "a fileira de ícones não deve crescer");
  assert.equal(estilo(".area-link").height, "34px");
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
