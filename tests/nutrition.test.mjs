/* Testes da estimativa de nutrientes. */

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

const { receitas, porSlug } = await import(`${RAIZ}/src/data/index.js`);

// A unidade de porção vem dos dados: é texto de tela, e já mudou uma vez
const un = slug => porSlug(slug).porcoes.unidade;
const { resolverLinha } = await import(`${RAIZ}/src/data/resolve.js`);
const { CAMPOS_NUTRIENTES } = await import(`${RAIZ}/src/data/ingredientes.js`);
const {
  gramasDe, nutrientesDe, estimarNutrientes, formatarNutriente, ORDEM,
  distribuicaoCalorica, percentualDiario, detalhesNutricionais, metaEmGramas, impactoDiario,
  VALORES_DIARIOS, KCAL_POR_GRAMA, BASE_DIARIA_KCAL
} = await import(`${RAIZ}/src/js/nutrition.js`);

const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const ingDe = (slug, id, un = null) =>
  porSlug(slug).ingredientes.find(i => i.id === id && (un === null || i.un === un));

/* ------------------------------------------------------------ peso em gramas */

console.log("\nPESO EM GRAMAS");
ok("[NUT-02] unidade de peso vai direto", () => {
  assert.equal(gramasDe(resolverLinha({ ing: "bacon", qtd: 150, un: "g" })), 150);
  assert.equal(gramasDe(resolverLinha({ ing: "feijao-preto", qtd: 1000, un: "g" })), 1000);
});
ok("[NUT-02] unidade de volume usa a densidade do ingrediente", () => {
  // 1 copo = 180 ml de óleo a 0,92 g/ml
  assert.ok(perto(gramasDe(resolverLinha({ ing: "oleo/girassol", qtd: 1, un: "copo" })), 165.6));
  // 1 col. sopa = 15 ml de chocolate em pó a 0,5 g/ml
  assert.ok(perto(gramasDe(resolverLinha({ ing: "chocolate-em-po", qtd: 1, un: "col. sopa" })), 7.5));
});
ok("[NUT-02] unidade contável usa peso por unidade", () => {
  assert.equal(gramasDe(resolverLinha({ ing: "ovo", qtd: 3, un: "un." })), 150);
  assert.equal(gramasDe(resolverLinha({ ing: "alho", qtd: 6, un: "dente" })), 24);
  assert.equal(gramasDe(resolverLinha({ ing: "leite-condensado", qtd: 1, un: "lata" })), 395);
});
ok('[NUT-03][REC-09] "a gosto" não tem peso', () => {
  assert.equal(gramasDe(resolverLinha({ ing: "sal", escala: false, texto: "a gosto" })), null);
});
ok("[NUT-03] contável sem peso por unidade devolve null", () => {
  // o granulado não tem pesoPorUnidade: pedir em "un." não dá para pesar
  assert.equal(gramasDe(resolverLinha({ ing: "chocolate-granulado", qtd: 2, un: "un." })), null);
});
ok("[NUT-03] volume sem densidade devolve null", () => {
  assert.equal(gramasDe(resolverLinha({ ing: "feijao-preto", qtd: 1, un: "copo" })), null);
});

/* -------------------------------------------------------------- por ingrediente */

console.log("\nNUTRIENTES DE UM INGREDIENTE");
ok("[NUT-01][NUT-04] escala pelos gramas sobre a base de 100 g", () => {
  // bacon: 541 kcal / 100 g · 150 g -> 811,5
  const n = nutrientesDe(resolverLinha({ ing: "bacon", qtd: 150, un: "g" }));
  assert.ok(perto(n.kcal, 811.5), String(n.kcal));
  assert.ok(perto(n.proteina, 55.5), String(n.proteina));
});
ok("[NUT-05] ingrediente sem dado nutricional devolve null", () => {
  assert.equal(nutrientesDe(resolverLinha({ ing: "louro", qtd: 3, un: "folha" })), null);
  assert.equal(nutrientesDe(resolverLinha({ ing: "forminha-de-papel", qtd: 25, un: "un." })), null);
});
ok("[NUT-05] campo ausente no catálogo conta como zero, não como NaN", () => {
  const n = nutrientesDe(resolverLinha({ ing: "sal", qtd: 10, un: "g" }));
  for (const c of CAMPOS_NUTRIENTES) assert.ok(Number.isFinite(n[c]), `${c} = ${n[c]}`);
  assert.equal(n.kcal, 0);
  assert.ok(n.sodio > 0);
});

/* ------------------------------------------------------------------ receita */

console.log("\nESTIMATIVA DA RECEITA");
ok("[NUT-10] todas as receitas produzem números finitos e positivos", () => {
  for (const r of receitas) {
    const e = estimarNutrientes(r);
    assert.ok(e.contados > 0, `${r.slug}: nenhum ingrediente contabilizado`);
    for (const c of ORDEM) {
      assert.ok(Number.isFinite(e.porPorcao[c]), `${r.slug}/${c} não é número`);
      assert.ok(e.porPorcao[c] >= 0, `${r.slug}/${c} negativo`);
    }
    assert.ok(e.pesoTotal > 0);
  }
});
ok("[NUT-13] as calorias conferem com 4/4/9 dos macros (aferição independente)", () => {
  for (const r of receitas) {
    const p = estimarNutrientes(r).porPorcao;
    const pelosMacros = p.proteina * 4 + p.carboidrato * 4 + p.gordura * 9;
    const desvio = Math.abs(pelosMacros - p.kcal) / p.kcal;
    assert.ok(desvio <= 0.06, `${r.slug}: ${Math.round(pelosMacros)} vs ${Math.round(p.kcal)} kcal (${(desvio * 100).toFixed(0)}%)`);
  }
});
ok("[NUT-11] o total é o valor por porção vezes o número de porções", () => {
  for (const r of receitas) {
    const e = estimarNutrientes(r);
    for (const c of ORDEM) {
      assert.ok(perto(e.porPorcao[c] * r.porcoes.padrao, e.total[c], 0.001), `${r.slug}/${c}`);
    }
  }
});
ok("[NUT-07][NUT-09] o que é a gosto é relatado, não somado em silêncio", () => {
  const e = estimarNutrientes(porSlug("feijoada"));
  const nomes = e.deFora.map(d => d.nome).sort();
  assert.deepEqual(nomes, ["pimenta-do-reino", "sal"]);
  assert.ok(e.deFora.every(d => d.motivo.includes("gosto")));
  assert.equal(e.completa, false);
});
ok("[NUT-06] louro e forminha ficam fora sem virar lacuna", () => {
  // O catálogo diz nutrientes: null de propósito — não é dado faltando
  const feijoada = estimarNutrientes(porSlug("feijoada"));
  assert.ok(!feijoada.deFora.some(d => d.nome === "louro"));

  const brigadeiro = estimarNutrientes(porSlug("brigadeiro"));
  assert.ok(!brigadeiro.deFora.some(d => d.nome.includes("forminha")));
  assert.equal(brigadeiro.completa, true, "o brigadeiro devia estar completo");
});
ok("[NUT-14] valores por porção são plausíveis", () => {
  const brigadeiro = estimarNutrientes(porSlug("brigadeiro")).porPorcao;
  assert.ok(brigadeiro.kcal > 40 && brigadeiro.kcal < 140, `brigadeiro: ${brigadeiro.kcal} kcal`);

  const bolo = estimarNutrientes(porSlug("bolo-de-cenoura")).porPorcao;
  assert.ok(bolo.kcal > 200 && bolo.kcal < 700, `fatia de bolo: ${bolo.kcal} kcal`);

  // Nenhuma porção pode passar de 3 000 kcal: sinal de erro de unidade
  for (const r of receitas) {
    assert.ok(estimarNutrientes(r).porPorcao.kcal < 3000, r.slug);
  }
});

console.log("\nDISTRIBUIÇÃO DAS CALORIAS");
ok("[NUT-16] energia de cada macro é gramas × 4/4/9", () => {
  const d = distribuicaoCalorica({ proteina: 10, carboidrato: 20, gordura: 5 });
  const porCampo = Object.fromEntries(d.itens.map(i => [i.campo, i]));
  assert.equal(porCampo.proteina.kcal, 40);
  assert.equal(porCampo.carboidrato.kcal, 80);
  assert.equal(porCampo.gordura.kcal, 45);
  assert.equal(d.kcalDosMacros, 165);
  assert.deepEqual(KCAL_POR_GRAMA, { proteina: 4, carboidrato: 4, gordura: 9 });
});
ok("[NUT-22] as porcentagens exibidas somam exatamente 100", () => {
  for (const r of receitas) {
    const d = distribuicaoCalorica(estimarNutrientes(r).porPorcao);
    const soma = d.itens.reduce((s, i) => s + i.pctArredondado, 0);
    assert.equal(soma, 100, `${r.slug}: soma ${soma}%`);
  }
});
ok("[NUT-23] arredondamento ingênuo daria 99% ou 101%, e aqui não dá", () => {
  // 1/3 de cada: 33,33% três vezes -> Math.round daria 99
  const d = distribuicaoCalorica({ proteina: 10, carboidrato: 10, gordura: 40 / 9 });
  const soma = d.itens.reduce((s, i) => s + i.pctArredondado, 0);
  assert.equal(soma, 100);
  // e o valor exato continua disponível para quem quiser
  for (const i of d.itens) assert.ok(Math.abs(i.pct - 100 / 3) < 0.01, String(i.pct));
});
ok("[NUT-24] receita sem macros não estoura", () => {
  const d = distribuicaoCalorica({ proteina: 0, carboidrato: 0, gordura: 0 });
  assert.equal(d.kcalDosMacros, 0);
  for (const i of d.itens) {
    assert.equal(i.pct, 0);
    assert.ok(Number.isFinite(i.pctArredondado));
  }
});

console.log("\nPERCENTUAL DO VALOR DIÁRIO");
ok("[NUT-15] a referência é a da rotulagem brasileira", () => {
  assert.equal(VALORES_DIARIOS.fibra.valor, 25);
  assert.equal(VALORES_DIARIOS.sodio.valor, 2400);
  assert.equal(VALORES_DIARIOS.sodio.un, "mg");
  assert.equal(BASE_DIARIA_KCAL, 2000);
});
ok("[NUT-19] valor igual à referência dá 100%", () => {
  assert.equal(percentualDiario("fibra", 25), 100);
  assert.equal(percentualDiario("sodio", 2400), 100);
  assert.equal(percentualDiario("fibra", 12.5), 50);
});
ok("[NUT-19] passar da referência passa de 100%", () => {
  assert.equal(percentualDiario("sodio", 4800), 200);
});
ok("[NUT-19] caloria tem referência diária", () => {
  // o consumo diário de kcal virou preferência do leitor
  assert.equal(percentualDiario("kcal", 2000), 100);
  assert.equal(percentualDiario("kcal", 1000), 50);
});
ok("[NUT-18] macro tem referência diária derivada dos macros escolhidos", () => {
  // 2000 kcal com 15% de proteína = 300 kcal = 75 g
  assert.equal(metaEmGramas("proteina"), 75);
  assert.equal(metaEmGramas("carboidrato"), 300);
  assert.ok(perto(metaEmGramas("gordura"), 500 / 9, 0.01));
  assert.equal(percentualDiario("proteina", 75), 100);
  assert.equal(percentualDiario("carboidrato", 150), 50);
});
ok("[NUT-19] nutriente sem referência nenhuma devolve null", () => {
  assert.equal(percentualDiario("inexistente", 10), null);
});
ok("[NUT-20] os detalhes trazem os seis nutrientes como % do dia", () => {
  const d = detalhesNutricionais(porSlug("feijoada"));
  assert.deepEqual(d.impacto.map(x => x.campo), ORDEM);
  for (const x of d.impacto) {
    assert.ok(Number.isFinite(x.pct), x.campo);
    assert.ok(x.referencia.valor > 0, x.campo);
  }
  // kcal, fibra e sódio vêm da tabela; os macros são derivados
  assert.equal(d.impacto.find(x => x.campo === "kcal").referencia.derivada, undefined);
  assert.equal(d.impacto.find(x => x.campo === "proteina").referencia.derivada, true);
});
ok("[NUT-20] os valores conferem com a conta feita à mão", () => {
  const d = detalhesNutricionais(porSlug("feijoada"));
  const fibra = d.impacto.find(x => x.campo === "fibra");
  assert.ok(perto(fibra.pct, (d.porPorcao.fibra / 25) * 100, 0.001));
  const prot = d.impacto.find(x => x.campo === "proteina");
  assert.ok(perto(prot.pct, (d.porPorcao.proteina / 75) * 100, 0.001));
});

console.log("\nFORMATO");
ok("[NUT-26] caloria em inteiro, macro com decimal quando pequeno, sódio em mg", () => {
  assert.deepEqual(formatarNutriente("kcal", 934.7), { valor: "935", un: "kcal" });
  assert.deepEqual(formatarNutriente("sodio", 1624.5), { valor: "1625", un: "mg" });
  assert.deepEqual(formatarNutriente("proteina", 59.4), { valor: "59", un: "g" });
  assert.deepEqual(formatarNutriente("gordura", 2.83), { valor: "2,8", un: "g" });
});

/* --------------------------------------------------------------- na página */

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/#/receita/feijoada", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];

console.log("\nCARTÃO NA PÁGINA DA RECEITA");
ok("[NUT-27] o cartão aparece com os seis nutrientes", () => {
  assert.ok($("#tit-nutrientes"), "sem cartão de nutrientes");
  assert.match($("#tit-nutrientes").textContent, /porção/i);
  assert.equal($$(".nutri li").length, 6);
});
ok("[NUT-27] as calorias vêm primeiro e em destaque", () => {
  const primeiro = $(".nutri li");
  assert.ok(primeiro.classList.contains("nutri-destaque"));
  assert.match(primeiro.textContent, /Calorias/);
  assert.match(primeiro.textContent, /kcal/);
});
ok("[NUT-27] o cartão diz que é estimativa e sobre ingredientes crus", () => {
  const nota = $(".nutri-nota").textContent;
  assert.match(nota, /[Ee]stimativa/);
  assert.match(nota, /crus/);
});
ok("[NUT-09][NUT-27] o que ficou de fora é declarado", () => {
  const nota = $(".nutri-nota").textContent;
  assert.match(nota, /sal/);
  assert.match(nota, /pimenta-do-reino/);
});
ok("[NUT-12] o valor por porção não muda ao mexer no seletor de porções", () => {
  const antes = $(".nutri").textContent.replace(/\s+/g, " ");
  $('.pbtn[data-passo="1"]').dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.match($("#porcoes-valor").textContent, new RegExp(`10\\s+${un("feijoada").replace(/\./g, "\\.")}`), "as porções deviam ter mudado");
  const depois = $(".nutri").textContent.replace(/\s+/g, " ");
  assert.equal(depois, antes, "por porção é invariante: escalar multiplica os dois lados");
});
ok("[NUT-28] o cartão fica entre os ingredientes e os utensílios", () => {
  const titulos = $$(".col-left .card h2").map(h => h.id);
  assert.deepEqual(titulos, ["tit-ingredientes", "tit-nutrientes", "tit-utensilios"]);
});

console.log("\nJANELA DE DETALHES");
const dialogo = () => $("#nutri-detalhes");
const clicarEl = el => { assert.ok(el, "elemento não encontrado"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); };
const estaAberto = () => dialogo().open || dialogo().hasAttribute("open");
/* jsdom não implementa <dialog>, então o site cai no plano B (atributo `open`).
   Fechar pelo botão é o caminho do usuário e é o que exercita esse plano B. */
const fechar = () => clicarEl($("#nutri-detalhes .pref-ok"));

ok("[NUT-29] a janela existe e começa fechada", () => {
  assert.ok(dialogo());
  assert.equal(estaAberto(), false);
});
ok("[NUT-29] o botão do cartão abre a janela", () => {
  clicarEl($("#ver-nutrientes"));
  assert.equal(estaAberto(), true);
  assert.ok($("#nutri-detalhes .pref-form"), "a janela devia ter conteúdo");
});
ok("[NUT-29] o botão anuncia que abre um diálogo", () => {
  assert.equal($("#ver-nutrientes").getAttribute("aria-haspopup"), "dialog");
});
ok("[NUT-30] mostra a receita e a porção de referência", () => {
  const sub = $(".nutri-dl-sub").textContent;
  assert.match(sub, /Feijoada/);
  assert.match(sub, new RegExp(`1 de 8 ${un("feijoada").replace(/\./g, "\\.")}`));
  assert.match(sub, /kcal/);
});
ok("[NUT-30] seis barras, uma por nutriente, com valor e referência", () => {
  const itens = $$("#nutri-detalhes .nutri-barras li");
  assert.equal(itens.length, 6);
  for (const li of itens) {
    assert.ok(li.querySelector(".nb-barra i"), "sem barra");
    assert.match(li.querySelector(".nb-pct").textContent, /^\d+%$/);
    assert.match(li.querySelector(".nb-detalhe").textContent, / de /, "devia dizer de quanto");
  }
});
ok("[NUT-22] as barras medem o dia, então não somam 100", () => {
  const soma = $$("#nutri-detalhes .nb-pct").map(b => Number(b.textContent.replace("%", "")))
    .reduce((s, v) => s + v, 0);
  assert.notEqual(soma, 100, "barra de % do dia não é distribuição");
});
ok("[NUT-22] as fatias da rosca somam 100", () => {
  const pcts = $$("#nutri-detalhes .rl-pct").map(b => Number(b.textContent.replace("%", "")));
  assert.equal(pcts.length, 3);
  assert.equal(pcts.reduce((s, v) => s + v, 0), 100, pcts.join(" + "));
});
ok("[NUT-30] a rosca fecha o círculo e as fatias se encadeiam", () => {
  const volta = 2 * Math.PI * 26;
  let soma = 0, offsetEsperado = 0;
  for (const fatia of $$("#nutri-detalhes .rosca-fatia")) {
    const comprimento = Number(fatia.getAttribute("stroke-dasharray").split(" ")[0]);
    const offset = -Number(fatia.getAttribute("stroke-dashoffset"));
    assert.ok(Math.abs(offset - offsetEsperado) < 0.05, `fatia deslocada: ${offset} != ${offsetEsperado}`);
    soma += comprimento;
    offsetEsperado += comprimento;
  }
  assert.ok(Math.abs(soma - volta) < 0.05, `as fatias somam ${soma} de ${volta}`);
});
ok("[NUT-30] a rosca é legível por leitor de tela", () => {
  const svg = $("#nutri-detalhes .rosca");
  assert.equal(svg.getAttribute("role"), "img");
  assert.match(svg.getAttribute("aria-label"), /Proteínas \d+%/);
  assert.match(svg.getAttribute("aria-label"), /Gorduras \d+%/);
});
ok("[NUT-30] a legenda mostra a meta ao lado do que a receita entrega", () => {
  const proteina = $$("#nutri-detalhes .rosca-legenda li")[0];
  assert.match(proteina.textContent, /Proteínas/);
  assert.match(proteina.querySelector(".rl-meta").textContent, /meta \d+%/);
});
ok("[NUT-30] explica a base 4/4/9 da rosca", () => {
  const notas = $$("#nutri-detalhes .nutri-dl-nota").map(n => n.textContent).join(" ");
  assert.match(notas, /4 kcal/);
  assert.match(notas, /9 kcal/);
  assert.match(notas, /100%/);
});
ok("[NUT-30] cada barra diz de que referência é a fração", () => {
  const itens = $$("#nutri-detalhes .nutri-barras li");
  const texto = i => itens[i].querySelector(".nb-detalhe").textContent;
  assert.match(itens[0].textContent, /Calorias/);
  assert.match(texto(0), /de 2000 kcal/);
  assert.match(texto(1), /de 75 g/);      // proteína: 15% de 2000 kcal
  assert.match(texto(2), /de 300 g/);     // carboidrato: 60%
  assert.match(texto(4), /de 25 g/);      // fibra
  assert.match(texto(5), /de 2400 mg/);   // sódio
});
ok("[NUT-21] declara a base do valor diário e que não é individual", () => {
  const notas = $$("#nutri-detalhes .nutri-dl-nota").map(n => n.textContent).join(" ");
  assert.match(notas, /2\.000 kcal/);
  assert.match(notas, /ANVISA/);
  assert.match(notas, /não é uma necessidade individual/i);
});
ok("[NUT-30] nenhuma barra passa de 100% de largura", () => {
  for (const i of $$("#nutri-detalhes .nb-barra i")) {
    const largura = Number(i.style.width.replace("%", ""));
    assert.ok(largura <= 100, `barra de ${largura}%`);
    assert.ok(largura >= 0);
  }
});
ok("[NUT-09] o que ficou de fora também aparece na janela", () => {
  assert.match($("#nutri-detalhes").textContent, /Fora da conta/);
  assert.match($("#nutri-detalhes").textContent, /sal/);
});
ok("[NUT-29][SHL-28] fecha pelo botão", () => {
  fechar();
  assert.equal(estaAberto(), false);
});
ok("[NUT-29][SHL-28] fecha clicando no fundo escuro", () => {
  clicarEl($("#ver-nutrientes"));
  assert.equal(estaAberto(), true);
  clicarEl(dialogo());          // o alvo é o próprio dialogo = fundo
  assert.equal(estaAberto(), false);
});
ok("[NUT-29] clicar no cartão também abre", () => {
  clicarEl($(".card-nutri h2"));
  assert.equal(estaAberto(), true);
  fechar();
});
ok("[NUT-31] a janela reflete a receita aberta", () => {
  window.location.hash = "#/receita/brigadeiro";
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  clicarEl($("#ver-nutrientes"));
  assert.match($(".nutri-dl-sub").textContent, /Brigadeiro/);
  assert.match($(".nutri-dl-sub").textContent, new RegExp(`1 de 25 ${un("brigadeiro").replace(/\./g, "\\.")}`));
  // O brigadeiro não tem ingrediente a gosto: não deve haver linha de exclusão
  assert.ok(!$("#nutri-detalhes").textContent.includes("Fora da conta"));
  fechar();
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
