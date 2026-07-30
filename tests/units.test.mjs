/* Testes de conversão de medidas e de preferências. */

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

/* ------------------------------------------------------------- matemática */

const U = await import(`${RAIZ}/src/js/units.js`);
const { converter, conversaoUtil, equivalentes, densidadeDe, arredondar, arredondarEquivalencia,
        equivalenciaMetrica, metrica, familia, quantidadeEmTexto, unidadeConhecida } = U;
const { escalarIngrediente } = await import(`${RAIZ}/src/js/scaling.js`);
const { receitas } = await import(`${RAIZ}/src/data/index.js`);

const MEDIDAS = await import(`${RAIZ}/src/data/unidades.js`);

console.log("\nBANCO DE MEDIDAS");
ok("[MEA-03] os volumes de cozinha estão cadastrados, em ml", () => {
  const esperado = {
    "ml": 1, "L": 1000,
    "copo": 180, "copo americano": 200, "copo de requeijão": 250, "xícara": 240,
    "col. sopa": 15, "col. sobremesa": 10, "col. chá": 5, "col. café": 2
  };
  for (const [un, base] of Object.entries(esperado)) {
    assert.equal(MEDIDAS.VOLUMES[un]?.base, base, `${un} deveria valer ${base} ml`);
  }
  assert.deepEqual(Object.keys(MEDIDAS.VOLUMES).sort(), Object.keys(esperado).sort());
});
ok("[MEA-02] a família vem do grupo, não de cada linha", () => {
  for (const un of Object.keys(MEDIDAS.VOLUMES)) assert.equal(familia(un), "volume", un);
  for (const un of Object.keys(MEDIDAS.PESOS)) assert.equal(familia(un), "peso", un);
  for (const un of Object.keys(MEDIDAS.CONTAVEIS)) assert.equal(familia(un), null, un);
  // ninguém declara a família à mão: assim não existe volume dizendo que é peso
  for (const grupo of [MEDIDAS.VOLUMES, MEDIDAS.PESOS, MEDIDAS.CONTAVEIS]) {
    for (const [un, def] of Object.entries(grupo)) {
      assert.ok(!Object.hasOwn(def, "familia"), `${un} declara família na mão`);
    }
  }
});
ok("[MEA-01] nenhuma medida está em dois grupos", () => {
  const nomes = [
    ...Object.keys(MEDIDAS.VOLUMES), ...Object.keys(MEDIDAS.PESOS), ...Object.keys(MEDIDAS.CONTAVEIS)
  ];
  assert.equal(new Set(nomes).size, nomes.length);
  assert.equal(Object.keys(MEDIDAS.UNIDADES).length, nomes.length);
});
ok("[MEA-06] toda medida sabe arredondar e escrever o plural", () => {
  for (const [un, def] of Object.entries(MEDIDAS.UNIDADES)) {
    assert.ok(def.passo != null, `${un} sem passo`);
    assert.ok(def.min != null, `${un} sem mínimo`);
    assert.equal(quantidadeEmTexto(2, un).includes("NaN"), false, un);
  }
});
ok("[MEA-22] o menu de conversão só oferece medidas que existem", () => {
  for (const [fam, lista] of Object.entries(MEDIDAS.MENU)) {
    for (const un of lista) {
      assert.ok(unidadeConhecida(un), `${un} está no menu e não na tabela`);
      assert.equal(familia(un), fam, `${un} está no menu de ${fam}`);
    }
  }
});
ok("[MEA-22] medida fora do menu ainda converte, só não é sugerida", () => {
  // uma receita pode escrever "copo de requeijão" e o site entende
  assert.equal(converter(1, "copo de requeijão", "ml"), 250);
  assert.equal(converter(2, "col. sobremesa", "ml"), 20);
  assert.ok(!MEDIDAS.MENU.volume.includes("copo de requeijão"));
});
ok("[MEA-07] as métricas existem e são a base de cada família", () => {
  for (const un of MEDIDAS.METRICAS) {
    assert.ok(unidadeConhecida(un), un);
    assert.equal(metrica(un), true, un);
  }
  assert.equal(metrica("copo"), false);
  assert.equal(metrica("lata"), false);
});

console.log("\nCONVERSÃO DENTRO DA MESMA FAMÍLIA");
ok("[MEA-03][MEA-10] volume: copo, xícara, colher e ml", () => {
  assert.equal(converter(1, "copo", "ml"), 180);
  assert.equal(converter(1, "xícara", "ml"), 240);
  assert.equal(converter(1, "col. sopa", "ml"), 15);
  assert.equal(converter(3, "col. sopa", "col. chá"), 9);
});
ok("[MEA-04] peso tem uma unidade só: grama", () => {
  // kg saiu da tabela: é forma de escrita, não unidade
  assert.equal(unidadeConhecida("g"), true);
  assert.equal(unidadeConhecida("kg"), false);
  assert.equal(converter(1, "kg", "g"), null);
  assert.equal(converter(1000, "g", "kg"), null);
});
ok("[MEA-10] ida e volta não perde valor", () => {
  for (const [de, para] of [["copo", "ml"], ["ml", "xícara"], ["col. sopa", "col. chá"]]) {
    const volta = converter(converter(2, de, para), para, de);
    assert.ok(Math.abs(volta - 2) < 1e-9, `${de} -> ${para} -> ${de} deu ${volta}`);
  }
});
ok("[MEA-09] mesma unidade devolve o mesmo valor", () => assert.equal(converter(7, "g", "g"), 7));
ok("[MEA-09] unidade sem família não converte", () => {
  assert.equal(converter(1, "lata", "ml"), null);
  assert.equal(converter(1, "dente", "g"), null);
});

console.log("\nCONVERSÃO ENTRE FAMÍLIAS (precisa de densidade)");
ok("[MEA-11] sem densidade, volume não vira peso", () => assert.equal(converter(1, "copo", "g"), null));
ok("[MEA-11] com densidade, converte nos dois sentidos", () => {
  assert.equal(converter(1, "copo", "g", 1), 180);       // 180 ml x 1 g/ml
  assert.equal(converter(180, "g", "ml", 1), 180);
  assert.equal(converter(1, "copo", "g", 0.5), 90);
});
ok("[MEA-12] densidade vem do catálogo, não da receita", () => {
  assert.equal(densidadeDe({ qtd: 2, un: "copo", densidade: 0.8 }), 0.8);
  assert.equal(densidadeDe({ qtd: 2, un: "copo" }), null);
  // a receita não tem mais como opinar sobre densidade
  assert.equal(densidadeDe({ qtd: 2, un: "copo", nota: { qtd: 360, un: "g" } }), null);
});

console.log("\nO QUE NÃO DEVE SER OFERECIDO");
ok("[MEA-23] conversão inexata é recusada (4 col. sopa não é ¼ copo)", () => {
  assert.equal(conversaoUtil(4, "col. sopa", "copo"), false);
  assert.ok(!equivalentes(4, "col. sopa").includes("copo"));
});
ok("[MEA-23] conversão exata é aceita (3 col. sopa = ¼ copo)", () => {
  assert.equal(conversaoUtil(3, "col. sopa", "copo"), true);
  assert.equal(converter(3, "col. sopa", "copo"), 0.25);
});
ok("[MEA-24] peso puro não tem alternativa nenhuma", () => {
  // Antes o menu oferecia kg; agora 1.500 g já se escreve "1,5 kg" sozinho
  assert.deepEqual(equivalentes(300, "g"), []);
  assert.deepEqual(equivalentes(1500, "g"), []);
  assert.equal(conversaoUtil(1500, "g", "kg"), false, "kg não é destino de conversão");
});
ok("[MEA-23] abaixo de 1 L não se oferece L", () => {
  assert.equal(conversaoUtil(360, "ml", "L"), false);
  assert.equal(conversaoUtil(2000, "ml", "L"), true);
});
ok("[MEA-23] valor minúsculo não vira fração de copo", () => {
  assert.ok(!equivalentes(1, "col. chá").includes("copo"));
});
ok("[MEA-24] a unidade atual não aparece como alternativa", () => {
  assert.ok(!equivalentes(1, "copo").includes("copo"));
});

console.log("\nEXATIDÃO DE TUDO QUE O SITE OFERECE");
ok("[MEA-23] nenhuma alternativa exibida erra mais de 4%", () => {
  let pior = 0, caso = "";
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.qtd == null) continue;
      const dens = densidadeDe(ing);
      for (const alt of escalarIngrediente(ing, 1, {}).alternativas.filter(a => !a.original)) {
        const bruto = converter(ing.qtd, ing.un, alt.un, dens);
        const erro = Math.abs(arredondar(bruto, alt.un) - bruto) / bruto;
        if (erro > pior) { pior = erro; caso = `${r.slug}/${ing.item}: ${ing.qtd} ${ing.un} -> ${alt.texto}`; }
      }
    }
  }
  assert.ok(pior <= 0.04, `erro de ${(pior * 100).toFixed(1)}% em ${caso}`);
});
ok("[MEA-23] em todas as porções possíveis, ainda vale (varredura completa)", () => {
  for (const r of receitas) {
    for (let p = r.porcoes.min; p <= r.porcoes.max; p += (r.porcoes.passo ?? 1)) {
      const mult = p / r.porcoes.padrao;
      for (const ing of r.ingredientes) {
        if (ing.qtd == null) continue;
        const dens = densidadeDe(ing);
        // A opção "como na receita" não é conversão: seu desvio é o arredondamento
        // de escala, que é intencional. Só as conversões precisam fechar exato.
        for (const alt of escalarIngrediente(ing, mult, {}).alternativas.filter(a => !a.original)) {
          const bruto = converter(ing.qtd * mult, ing.un, alt.un, dens);
          const erro = Math.abs(arredondar(bruto, alt.un) - bruto) / bruto;
          assert.ok(erro <= 0.04, `${r.slug} @${p} · ${ing.item} -> ${alt.un}: ${(erro * 100).toFixed(1)}%`);
        }
      }
    }
  }
});
ok('[MEA-26] a opção "como na receita" mostra exatamente o valor já exibido', () => {
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.qtd == null) continue;
      const d = escalarIngrediente(ing, 1.75, {});
      const original = d.alternativas.find(a => a.original);
      if (original) assert.equal(original.texto, d.qtd, `${r.slug} · ${ing.item}`);
    }
  }
});
ok("[MEA-25] toda unidade das alternativas é conhecida e da família certa", () => {
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.qtd == null) continue;
      const temDens = Boolean(densidadeDe(ing));
      for (const alt of escalarIngrediente(ing, 1, {}).alternativas) {
        assert.ok(U.unidadeConhecida(alt.un), alt.un);
        if (!temDens) assert.equal(familia(alt.un), familia(ing.un), `${ing.item} -> ${alt.un}`);
      }
    }
  }
});

console.log("\nPREFERÊNCIAS APLICADAS AO INGREDIENTE");
const oleo = { qtd: 1, un: "copo", item: "óleo", densidade: 0.92, liquido: true };
const farinha = { qtd: 2.5, un: "copo", item: "farinha", densidade: 2 / 3 };
const carne = { qtd: 300, un: "g", item: "carne" };
const caldo = { qtd: 1, un: "copo", item: "caldo de legumes" };   // sem densidade no catálogo

ok("[MEA-34] preferência de volume converte copo em ml", () => {
  assert.equal(escalarIngrediente(oleo, 1, { prefs: { volume: "ml", peso: "receita" } }).qtd, "180 ml");
});
ok("[MEA-34] preferência da própria família tem prioridade", () => {
  // volume=ml e peso=g: a farinha é escrita em copo (volume) -> ganha ml
  assert.equal(escalarIngrediente(farinha, 1, { prefs: { volume: "ml", peso: "g" } }).qtd, "450 ml");
});
ok("[MEA-34] sem preferência de volume, a de peso atravessa via densidade", () => {
  assert.equal(escalarIngrediente(farinha, 1, { prefs: { volume: "receita", peso: "g" } }).qtd, "300 g");
});
ok("[MEA-37] sem densidade, a outra família não atravessa", () => {
  assert.equal(escalarIngrediente(caldo, 1, { prefs: { volume: "receita", peso: "g" } }).qtd, "1 copo");
});
ok("[MEA-37] preferência impossível cai na unidade da receita", () => {
  // 300 g em kg daria 0,3 kg -> abaixo do mínimo, mantém g
  assert.equal(escalarIngrediente(carne, 1, { prefs: { peso: "kg", volume: "receita" } }).qtd, "300 g");
});
ok('[MEA-26][MEA-36] "como na receita" não muda nada', () => {
  assert.equal(escalarIngrediente(farinha, 1, { prefs: { volume: "receita", peso: "receita" } }).qtd, "2 ½ copos");
});
ok("[MEA-34] escolha manual vence a preferência", () => {
  const d = escalarIngrediente(farinha, 1, { prefs: { volume: "ml", peso: "receita" }, unidadeForcada: "g" });
  assert.equal(d.qtd, "300 g");
  assert.equal(d.convertido, true);
});
ok("[MEA-37] escolha manual impossível é ignorada", () => {
  assert.equal(escalarIngrediente(carne, 1, { unidadeForcada: "kg" }).qtd, "300 g");
});
ok("[MEA-33] convertido mostra a medida original entre parênteses", () => {
  assert.equal(escalarIngrediente(farinha, 1, { unidadeForcada: "g" }).nota, "2 ½ copos");
});
ok("[MEA-33] nota redundante desaparece", () => {
  // exibindo em ml, a nota "180 ml" seria repetição
  assert.equal(escalarIngrediente(oleo, 1, { unidadeForcada: "ml" }).nota, "1 copo");
  assert.equal(escalarIngrediente(oleo, 1, {}).nota, "180 ml");
});
ok("[MEA-30] a equivalência não vem da receita, e sim do ingrediente", () => {
  // mesma medida, ingredientes diferentes: a nota muda porque a densidade muda
  const acucar = { qtd: 2, un: "copo", item: "açúcar", densidade: 1 };
  const cacau = { qtd: 2, un: "copo", item: "chocolate em pó", densidade: 0.5 };
  assert.equal(escalarIngrediente(acucar, 1).nota, "360 g");
  assert.equal(escalarIngrediente(cacau, 1).nota, "180 g");
});
ok("[MEA-30] líquido tem equivalência em ml; sólido, em gramas", () => {
  assert.equal(escalarIngrediente(oleo, 1).nota, "180 ml", "óleo se mede, não se pesa");
  assert.equal(escalarIngrediente(farinha, 1).nota, "300 g", "farinha se pesa");
});
ok("[MEA-30] sem densidade nem peso por unidade, não se inventa nota", () => {
  assert.equal(escalarIngrediente({ qtd: 2, un: "copo", item: "x" }, 1).nota, null);
  assert.equal(escalarIngrediente({ qtd: 2, un: "maço", item: "salsinha" }, 1).nota, null);
});
ok("[MEA-31] contável e embalagem se pesam pelo peso por unidade", () => {
  const cenoura = { qtd: 3, un: "un.", item: "cenouras", pesoPorUnidade: { "un.": 100 } };
  const lata = { qtd: 1, un: "lata", item: "leite condensado", densidade: 1.28, liquido: true, pesoPorUnidade: { "lata": 395 } };
  assert.equal(escalarIngrediente(cenoura, 1).nota, "300 g");
  // líquido, mas o que se sabe de uma lata é quanto ela pesa
  assert.equal(escalarIngrediente(lata, 1).nota, "395 g");
});
ok("[MEA-32] equivalência pequena demais não aparece", () => {
  const sal = { qtd: 1, un: "pitada", item: "sal", pesoPorUnidade: { "pitada": 0.4 } };
  const louro = { qtd: 3, un: "folha", item: "louro", pesoPorUnidade: { "folha": 0.2 } };
  assert.equal(escalarIngrediente(sal, 1).nota, null, "0,4 g não é informação");
  assert.equal(escalarIngrediente(louro, 1).nota, null);
});
ok("[MEA-29] medida já métrica não ganha parênteses", () => {
  assert.equal(escalarIngrediente(carne, 1).nota, null);
  assert.equal(escalarIngrediente({ qtd: 500, un: "ml", item: "leite", densidade: 1.03, liquido: true }, 1).nota, null);
});
ok("[MEA-16] a equivalência é arredondada mais fino que a receita", () => {
  // 2 col. sopa de manteiga = 30 ml x 0,91 = 27,3 g. O passo da receita
  // arredondaria para 25 g, e aí a equivalência estaria mentindo.
  const manteiga = { qtd: 2, un: "col. sopa", item: "manteiga", densidade: 0.91 };
  assert.equal(escalarIngrediente(manteiga, 1).nota, "27 g");
  assert.equal(arredondar(27.3, "g"), 25, "o passo da receita é grosso de propósito");
  assert.equal(arredondarEquivalencia(27.3, "g"), 27);
});
ok("[MEA-40] preferência combina com escala de porções", () => {
  assert.equal(escalarIngrediente(farinha, 2, { prefs: { volume: "receita", peso: "g" } }).qtd, "600 g");
});

/* ------------------------------------------------------------- na página */

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
window.localStorage.clear();

await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const clicarEl = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const irPara = slug => {
  window.location.hash = `#/receita/${slug}`;
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
};
const liDe = nome => $$("#lista-ingredientes li").find(l => l.textContent.includes(nome));

console.log("\nTROCA DE MEDIDA NA PÁGINA");
irPara("bolo-de-cenoura");
ok("[MEA-27] medidas convertíveis são botões; as outras, texto", () => {
  assert.ok(liDe("óleo").querySelector("button.qty.conv"), "óleo devia ser clicável");
  assert.ok(!liDe("ovos").querySelector("button.qty"), "ovos não deve ser clicável");
  assert.ok(!liDe("sal").querySelector("button.qty"), "pitada não deve ser clicável");
});
ok("[MEA-28] há dica explicando que dá para clicar", () => {
  assert.ok($(".ing-dica").textContent.toLowerCase().includes("clique"));
});
ok("[MEA-28] clicar abre o menu e marca aria-expanded", () => {
  const b = liDe("óleo").querySelector(".qty.conv");
  clicarEl(b);
  assert.equal(b.getAttribute("aria-expanded"), "true");
  assert.ok(liDe("óleo").querySelector(".conv-menu"));
});
ok("[MEA-26] o menu lista a unidade da receita e as equivalentes", () => {
  const opcoes = [...liDe("óleo").querySelectorAll(".conv-menu button")].map(b => b.textContent.trim());
  assert.ok(opcoes.some(o => o.includes("1 copo")), opcoes.join(" / "));
  assert.ok(opcoes.some(o => o.includes("180 ml")), opcoes.join(" / "));
  assert.ok(opcoes.some(o => o.includes("como na receita")));
});
ok("[MEA-28] a opção atual está marcada com aria-checked", () => {
  const marcadas = [...liDe("óleo").querySelectorAll('.conv-menu [aria-checked="true"]')];
  assert.equal(marcadas.length, 1);
  assert.ok(marcadas[0].textContent.includes("1 copo"));
});
ok("[MEA-28] escolher ml troca o texto e sinaliza a troca", () => {
  const opcao = [...liDe("óleo").querySelectorAll(".conv-menu button")].find(b => b.dataset.un === "ml");
  clicarEl(opcao);
  const b = liDe("óleo").querySelector(".qty.conv");
  assert.equal(b.textContent.trim(), "180 ml");
  assert.ok(b.classList.contains("trocada"));
});
ok("[MEA-28] o menu fecha depois de escolher", () => assert.equal($$(".conv-menu").length, 0));
ok("[MEA-33] a medida original aparece entre parênteses", () => {
  assert.ok(liDe("óleo").querySelector(".nota").textContent.includes("copo"));
});
ok("[MEA-41] a troca sobrevive à mudança de porções", () => {
  clicarEl($('.pbtn[data-passo="1"]'));   // 12 -> 18 fatias
  assert.equal(liDe("óleo").querySelector(".qty.conv").textContent.trim(), "270 ml");
  clicarEl($('.pbtn[data-passo="-1"]'));
  assert.equal(liDe("óleo").querySelector(".qty.conv").textContent.trim(), "180 ml");
});
ok("[MEA-26] voltar para a unidade da receita limpa a marca", () => {
  clicarEl(liDe("óleo").querySelector(".qty.conv"));
  const volta = [...liDe("óleo").querySelectorAll(".conv-menu button")].find(b => b.dataset.un === "copo");
  clicarEl(volta);
  const b = liDe("óleo").querySelector(".qty.conv");
  assert.equal(b.textContent.trim(), "1 copo");
  assert.ok(!b.classList.contains("trocada"));
});
ok("[MEA-28] clicar de novo no mesmo botão fecha o menu", () => {
  const b = liDe("óleo").querySelector(".qty.conv");
  clicarEl(b);
  assert.ok(liDe("óleo").querySelector(".conv-menu"));
  clicarEl(liDe("óleo").querySelector(".qty.conv"));
  assert.equal($$(".conv-menu").length, 0);
});
ok("[MEA-28] abrir outro menu fecha o anterior", () => {
  clicarEl(liDe("óleo").querySelector(".qty.conv"));
  clicarEl(liDe("farinha").querySelector(".qty.conv"));
  assert.equal($$(".conv-menu").length, 1);
  assert.equal(liDe("óleo").querySelector(".qty.conv").getAttribute("aria-expanded"), "false");
});
ok("[MEA-28] Esc fecha o menu", () => {
  $("#lista-ingredientes").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal($$(".conv-menu").length, 0);
});
ok("[MEA-28] clique fora fecha o menu", () => {
  clicarEl(liDe("óleo").querySelector(".qty.conv"));
  clicarEl($("main h1"));
  assert.equal($$(".conv-menu").length, 0);
});
ok("[MEA-25] farinha oferece gramas porque a receita informa o peso", () => {
  clicarEl(liDe("farinha").querySelector(".qty.conv"));
  const opcoes = [...liDe("farinha").querySelectorAll(".conv-menu button")].map(b => b.dataset.un);
  assert.ok(opcoes.includes("g"), opcoes.join(","));
  $("#lista-ingredientes").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
});
ok("[MEA-21][MEA-27] feijão em grama não é clicável, e sai escrito em kg", () => {
  irPara("feijoada");
  const li = liDe("feijão preto");
  assert.equal(li.querySelector(".qty.conv"), null, "peso puro não tem para onde converter");
  assert.equal(li.querySelector(".qty").textContent.trim(), "1 kg");
});
ok("[MEA-38] trocar de receita limpa as trocas manuais", () => {
  irPara("bolo-de-cenoura");
  clicarEl(liDe("óleo").querySelector(".qty.conv"));
  clicarEl([...liDe("óleo").querySelectorAll(".conv-menu button")].find(b => b.dataset.un === "ml"));
  assert.ok(liDe("óleo").querySelector(".qty.conv").classList.contains("trocada"));
  irPara("feijoada");
  irPara("bolo-de-cenoura");
  assert.ok(!liDe("óleo").querySelector(".qty.conv").classList.contains("trocada"));
});

console.log("\nPAINEL DE PREFERÊNCIAS");
const marcar = (grupo, valor) => {
  const input = $(`#prefs input[name="${grupo}"][value="${valor}"]`);
  assert.ok(input, `opção ${grupo}=${valor} não existe`);
  input.checked = true;
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
};

ok("[PRF-26] o painel tem os quatro grupos", () => {
  assert.ok($("#prefs"));
  assert.ok($('#prefs input[name="peso"]'));
  assert.ok($('#prefs input[name="volume"]'));
  assert.ok($('#prefs input[name="diario.kcal"]'));
  assert.ok($('#prefs .pref-macro[data-campo="proteina"]'));
  assert.equal($("#prefs .pref-form").querySelectorAll("fieldset").length, 4);
});
ok("[PRF-26] abre sem erro pelo botão da barra lateral", () => {
  clicarEl($("#abrir-prefs"));   // jsdom pode não ter showModal; o código tem plano B
  assert.ok($("#prefs").hasAttribute("open") || typeof $("#prefs").showModal === "function");
});
ok('[MEA-36] começa em "como na receita"', () => {
  assert.equal($('#prefs input[name="peso"]:checked').value, "receita");
  assert.equal($('#prefs input[name="volume"]:checked').value, "receita");
});
ok("[PRF-27] escolher volume em ml reflete na lista na hora", () => {
  irPara("bolo-de-cenoura");
  marcar("volume", "ml");
  assert.equal(liDe("óleo").querySelector(".qty.conv").textContent.trim(), "180 ml");
  assert.equal(liDe("farinha").querySelector(".qty.conv").textContent.trim(), "450 ml");
});
ok("[PRF-27] colheres também seguem a preferência", () => {
  assert.equal(liDe("fermento").querySelector(".qty.conv").textContent.trim(), "15 ml");
});
ok("[MEA-35][PRF-27] o que não converte fica intacto", () => {
  assert.equal(liDe("ovos").querySelector(".qty").textContent.trim(), "3");
  assert.ok(liDe("sal").textContent.includes("pitada"));
});
ok("[MEA-34] preferência de peso puxa o que pode ser pesado para gramas", () => {
  marcar("volume", "receita");
  marcar("peso", "g");
  assert.equal(liDe("farinha").querySelector(".qty.conv").textContent.trim(), "300 g");
  // O óleo passou a ter densidade no catálogo, então também é pesável
  assert.equal(liDe("óleo").querySelector(".qty.conv").textContent.trim(), "170 g");
});
ok("[MEA-35] sem densidade no catálogo, a preferência de peso não alcança", () => {
  // O granulado é medido em gramas; já um contável como o ovo não tem como virar peso
  assert.equal(liDe("ovos").querySelector(".qty")?.textContent.trim(), "3");
  assert.ok(!liDe("ovos").querySelector(".qty.conv"), "ovo não é convertível");
});
ok("[PRF-27] preferência é gravada no navegador", () => {
  const salvo = JSON.parse(window.localStorage.getItem("receitas:preferencias"));
  assert.equal(salvo.peso, "g");
  assert.equal(salvo.volume, "receita");
  // os grupos novos viajam junto, com os padrões quando não foram tocados
  assert.deepEqual(salvo.diario, { kcal: 2000, fibra: 25, sodio: 2400 });
  assert.deepEqual(salvo.macros, { proteina: 15, carboidrato: 60, gordura: 25 });
});
ok("[MEA-38] preferência sobrevive à troca de receita", () => {
  irPara("feijoada");
  irPara("bolo-de-cenoura");
  assert.equal(liDe("farinha").querySelector(".qty.conv").textContent.trim(), "300 g");
});
ok("[MEA-34] escolha manual continua vencendo a preferência", () => {
  clicarEl(liDe("farinha").querySelector(".qty.conv"));
  clicarEl([...liDe("farinha").querySelectorAll(".conv-menu button")].find(b => b.dataset.un === "copo"));
  assert.equal(liDe("farinha").querySelector(".qty.conv").textContent.trim(), "2 ½ copos");
});
ok('[PRF-24] "voltar ao padrão" limpa tudo', () => {
  clicarEl($("#prefs .pref-limpar"));
  assert.equal($('#prefs input[name="peso"]:checked').value, "receita");
  assert.equal($('#prefs input[name="volume"]:checked').value, "receita");
  assert.equal(liDe("óleo").querySelector(".qty.conv").textContent.trim(), "1 copo");
});

console.log("\nPREFERÊNCIA GRAVADA É LIDA NA PRÓXIMA VISITA");
ok("[PRF-27] valor salvo é aplicado ao carregar", async () => {
  const dom2 = new JSDOM(html, { url: "http://localhost:8000/#/receita/bolo-de-cenoura", pretendToBeVisual: true });
  dom2.window.scrollTo = () => {};
  dom2.window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  dom2.window.localStorage.setItem("receitas:preferencias", JSON.stringify({ peso: "receita", volume: "ml" }));
  for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
    try { globalThis[k] = dom2.window[k]; } catch {}
  }
  await import(`${RAIZ}/src/js/app.js?v=2`);
  await new Promise(r => setTimeout(r, 30));
  const li = [...dom2.window.document.querySelectorAll("#lista-ingredientes li")].find(l => l.textContent.includes("óleo"));
  assert.equal(li.querySelector(".qty.conv").textContent.trim(), "180 ml");
  assert.equal(dom2.window.document.querySelector('#prefs input[name="volume"]:checked').value, "ml");
});
ok("[MEA-36][PRF-27] valor inválido salvo cai no padrão", () => {
  const dom3 = new JSDOM(html, { url: "http://localhost:8000/", pretendToBeVisual: true });
  dom3.window.localStorage.setItem("receitas:preferencias", '{"peso":"toneladas","volume":42}');
  for (const k of ["window", "document", "location", "localStorage"]) {
    try { globalThis[k] = dom3.window[k]; } catch {}
  }
  // carregar() é puro: basta reimportar o módulo apontando para o novo localStorage
  return import(`${RAIZ}/src/js/settings.js?v=3`).then(({ carregar }) => {
    assert.deepEqual(carregar(), { peso: "receita", volume: "receita" });
  });
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
