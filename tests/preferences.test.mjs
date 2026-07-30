/* Testes das preferências de consumo diário e distribuição dos macros. */

import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

/* Raiz do projeto, a partir deste arquivo — assim os testes rodam de qualquer lugar */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const falhas = [];
/* Para os testes que precisam de `await`: o `ok` normal não espera a promessa, então
   uma asserção que falhasse lá dentro viraria rejeição não tratada em vez de falha
   contada — o teste passaria sem ter verificado nada. */
const okAsync = async (nome, fn) => {
  try { await fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const ok = (nome, fn) => {
  try { fn(); console.log("  \x1b[32m✓\x1b[0m", nome); }
  catch (e) { falhas.push(nome); console.log("  \x1b[31m✗\x1b[0m", nome, "\n     ", e.message.split("\n").slice(0, 3).join(" | ")); }
};

const { sanear, somaMacros, formatarPct, PADRAO, CASAS_MACRO, CAMPOS_DIARIOS, CAMPOS_MACROS } =
  await import(`${RAIZ}/src/js/settings.js`);
const { valoresDiarios, metasMacros, percentualDiario, distribuicaoCalorica, detalhesNutricionais, referenciasPersonalizadas, metaEmGramas, pctDeGramas, KCAL_POR_GRAMA } =
  await import(`${RAIZ}/src/js/nutrition.js`);
const { porSlug } = await import(`${RAIZ}/src/data/index.js`);

/* ------------------------------------------------------------- saneamento */

console.log("\nSANEAMENTO DOS VALORES");
ok("[NUT-16][PRF-01] padrão vem da rotulagem brasileira", () => {
  assert.deepEqual(PADRAO.diario, { kcal: 2000, fibra: 25, sodio: 2400 });
  assert.deepEqual(PADRAO.macros, { proteina: 15, carboidrato: 60, gordura: 25 });
  assert.equal(somaMacros(PADRAO), 100, "o padrão devia somar 100%");
});
ok("[PRF-01][PRF-08] objeto vazio devolve tudo no padrão", () => {
  assert.deepEqual(sanear({}), PADRAO);
  assert.deepEqual(sanear(), PADRAO);
});
ok("[MEA-42][PRF-03] valor acima do máximo é cortado", () => {
  const p = sanear({ diario: { kcal: 99999, fibra: 500, sodio: 99999 } });
  assert.equal(p.diario.kcal, 6000);
  assert.equal(p.diario.fibra, 100);
  assert.equal(p.diario.sodio, 6000);
});
ok("[MEA-42][PRF-03] valor abaixo do mínimo é elevado", () => {
  const p = sanear({ diario: { kcal: 10, fibra: 0, sodio: -50 } });
  assert.equal(p.diario.kcal, 800);
  assert.equal(p.diario.fibra, 5);
  assert.equal(p.diario.sodio, 500);
});
ok("[PRF-05][PRF-06] texto e vazio caem no padrão do campo", () => {
  const p = sanear({ diario: { kcal: "abc", fibra: null, sodio: undefined } });
  assert.deepEqual(p.diario, PADRAO.diario);
});
ok("[PRF-07] número quebrado é arredondado", () => {
  assert.equal(sanear({ diario: { kcal: 1850.7 } }).diario.kcal, 1851);
});
ok("[PRF-04][PRF-07] a porcentagem do macro guarda uma casa decimal", () => {
  // Inteiro faria a meta em gramas saltar de 5 em 5 na proteína, e quem
  // digitasse "76 g" veria "75 g" de volta
  assert.equal(CASAS_MACRO, 1);
  assert.equal(sanear({ macros: { proteina: 15.2 } }).macros.proteina, 15.2);
  assert.equal(sanear({ macros: { proteina: 15.24 } }).macros.proteina, 15.2);
  assert.equal(sanear({ macros: { proteina: 15.26 } }).macros.proteina, 15.3);
});
ok("[PRF-04] macro fica entre 0 e 100", () => {
  const p = sanear({ macros: { proteina: -10, carboidrato: 250, gordura: 30 } });
  assert.equal(p.macros.proteina, 0);
  assert.equal(p.macros.carboidrato, 100);
  assert.equal(p.macros.gordura, 30);
});
ok("[PRF-02][PRF-08] valor válido é preservado", () => {
  const p = sanear({ peso: "g", diario: { kcal: 1800, fibra: 30, sodio: 1500 }, macros: { proteina: 30, carboidrato: 40, gordura: 30 } });
  assert.equal(p.peso, "g");
  assert.deepEqual(p.diario, { kcal: 1800, fibra: 30, sodio: 1500 });
  assert.deepEqual(p.macros, { proteina: 30, carboidrato: 40, gordura: 30 });
});
ok("[PRF-02] as unidades continuam saneadas junto", () => {
  assert.equal(sanear({ peso: "toneladas" }).peso, "receita");
  assert.equal(sanear({ peso: "kg" }).peso, "receita", "kg deixou de ser unidade");
  assert.equal(sanear({ volume: 42 }).volume, "receita");
});
ok("[PRF-10] soma de macros é calculada, não imposta", () => {
  // Deixar somar 90% é escolha do leitor: o painel avisa, não corrige
  const p = sanear({ macros: { proteina: 30, carboidrato: 30, gordura: 30 } });
  assert.equal(somaMacros(p), 90);
  assert.deepEqual(p.macros, { proteina: 30, carboidrato: 30, gordura: 30 });
});
ok("[PRF-03][PRF-04] todo campo declarado tem limites coerentes", () => {
  for (const d of CAMPOS_DIARIOS) {
    assert.ok(d.min < d.max, `${d.campo}: min >= max`);
    assert.ok(PADRAO.diario[d.campo] >= d.min && PADRAO.diario[d.campo] <= d.max, `${d.campo}: padrão fora dos limites`);
    assert.ok(d.rotulo && d.un, `${d.campo}: sem rótulo ou unidade`);
  }
  assert.deepEqual(CAMPOS_MACROS.map(d => d.campo), ["proteina", "carboidrato", "gordura"]);
});

/* ------------------------------------------------- efeito sobre os cálculos */

console.log("\nEFEITO NOS CÁLCULOS");
ok("[NUT-17] valores diários seguem as preferências", () => {
  const prefs = sanear({ diario: { kcal: 1600, fibra: 30, sodio: 1500 } });
  const v = valoresDiarios(prefs);
  assert.equal(v.kcal.valor, 1600);
  assert.equal(v.fibra.valor, 30);
  assert.equal(v.sodio.valor, 1500);
  assert.equal(v.sodio.un, "mg", "a unidade não vem do leitor");
});
ok("[NUT-17] sem preferências, valem os de referência", () => {
  assert.equal(valoresDiarios(undefined).kcal.valor, 2000);
  assert.equal(valoresDiarios({}).fibra.valor, 25);
});
ok("[NUT-17] percentual diário usa o número do leitor", () => {
  const prefs = sanear({ diario: { sodio: 1500 } });
  assert.equal(percentualDiario("sodio", 1500, prefs), 100);
  assert.equal(percentualDiario("sodio", 1500), 62.5);   // 1500 de 2400
});
ok("[NUT-16] metas de macro seguem as preferências", () => {
  const prefs = sanear({ macros: { proteina: 30, carboidrato: 40, gordura: 30 } });
  assert.deepEqual(metasMacros(prefs), { proteina: 30, carboidrato: 40, gordura: 30 });
  assert.deepEqual(metasMacros(), { proteina: 15, carboidrato: 60, gordura: 25 });
});
ok("[PRF-13] gramas e porcentagem são o mesmo número em duas roupas", () => {
  const prefs = sanear({});
  for (const campo of Object.keys(KCAL_POR_GRAMA)) {
    for (const g of [5, 40, 76, 111, 150]) {
      const pct = pctDeGramas(campo, g, prefs);
      const volta = metaEmGramas(campo, sanear({ ...prefs, macros: { ...prefs.macros, [campo]: pct } }));
      assert.ok(Math.abs(volta - g) < 0.6, `${campo} ${g} g virou ${volta} g`);
    }
  }
});
ok("[NUT-18][PRF-12] mudar as calorias do dia move as gramas, não a porcentagem", () => {
  // É por isso que o guardado é a porcentagem: ela é a escolha, gramas é efeito
  const a = sanear({ diario: { kcal: 2000 }, macros: { proteina: 15 } });
  const b = sanear({ diario: { kcal: 1000 }, macros: { proteina: 15 } });
  assert.equal(a.macros.proteina, b.macros.proteina);
  assert.equal(metaEmGramas("proteina", a), 75);
  assert.equal(metaEmGramas("proteina", b), 37.5);
});
ok("[PRF-13] a mesma gramagem vale outra porcentagem em outra dieta", () => {
  assert.equal(pctDeGramas("proteina", 75, sanear({ diario: { kcal: 2000 } })), 15);
  assert.equal(pctDeGramas("proteina", 75, sanear({ diario: { kcal: 1000 } })), 30);
});
ok("[PRF-13] porcentagem sem casa decimal seria imprecisa em gramas", () => {
  const prefs = sanear({});
  const pct = pctDeGramas("proteina", 76, prefs);
  const inteiro = metaEmGramas("proteina", sanear({ macros: { proteina: Math.round(pct) } }));
  assert.equal(inteiro, 75, "com inteiro, 76 g voltaria como 75 g");
  assert.equal(metaEmGramas("proteina", sanear({ macros: { proteina: pct } })), 76);
});
ok("[PRF-14] formatarPct não escreve zero à direita", () => {
  assert.equal(formatarPct(15), "15");
  assert.equal(formatarPct(15.2), "15,2");
});
ok("[NUT-25] a distribuição traz meta e diferença em pontos percentuais", () => {
  const prefs = sanear({ macros: { proteina: 20, carboidrato: 50, gordura: 30 } });
  const d = distribuicaoCalorica({ proteina: 25, carboidrato: 50, gordura: 100 / 9 }, prefs);
  const p = d.itens.find(i => i.campo === "proteina");
  assert.equal(p.meta, 20);
  assert.equal(p.diferenca, p.pctArredondado - 20);
  assert.equal(d.metas.gordura, 30);
});
ok("[NUT-25] mudar a meta não muda a distribuição real", () => {
  const porPorcao = { proteina: 25, carboidrato: 50, gordura: 10 };
  const a = distribuicaoCalorica(porPorcao, sanear({ macros: { proteina: 10 } }));
  const b = distribuicaoCalorica(porPorcao, sanear({ macros: { proteina: 40 } }));
  assert.deepEqual(a.itens.map(i => i.pctArredondado), b.itens.map(i => i.pctArredondado));
  assert.notEqual(a.itens[0].meta, b.itens[0].meta);
});
ok("[PRF-11] reconhece quando o leitor personalizou algo", () => {
  assert.equal(referenciasPersonalizadas(sanear({})), false);
  assert.equal(referenciasPersonalizadas(sanear({ diario: { kcal: 1800 } })), true);
  assert.equal(referenciasPersonalizadas(sanear({ macros: { proteina: 30 } })), true);
  // mexer só na unidade de medida não conta como personalizar referência
  assert.equal(referenciasPersonalizadas(sanear({ peso: "g" })), false);
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
window.localStorage.clear();
await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const clicarEl = el => { assert.ok(el, "elemento não encontrado"); el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); };

const mexer = input => {
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
};

const digitar = (nome, valor) => {
  const input = $(`#prefs input[name="${nome}"]`);
  assert.ok(input, `campo ${nome} não existe`);
  input.value = String(valor);
  mexer(input);
};

/* Os dois controles de cada macro. Não têm `name`: os dois escreveriam no
   mesmo campo, então o que os identifica é o par campo + tipo. */
const faixa = campo => $(`#prefs .pref-macro[data-campo="${campo}"] [data-tipo="pct"]`);
const gramas = campo => $(`#prefs .pref-macro[data-campo="${campo}"] [data-tipo="gramas"]`);
const eco = campo => $(`#prefs .pref-macro[data-campo="${campo}"] .pm-pct`);

const arrastar = (campo, pct) => { const el = faixa(campo); el.value = String(pct); mexer(el); };
const digitarGramas = (campo, g) => { const el = gramas(campo); el.value = String(g); mexer(el); };
const abrirDetalhes = () => clicarEl($("#ver-nutrientes"));
const fecharDetalhes = () => clicarEl($("#nutri-detalhes .pref-ok"));

console.log("\nPAINEL DE PREFERÊNCIAS");
ok("[PRF-03] os campos de consumo diário existem, com limites", () => {
  for (const d of CAMPOS_DIARIOS) {
    const input = $(`#prefs input[name="diario.${d.campo}"]`);
    assert.ok(input, d.campo);
    assert.equal(input.type, "number");
    assert.equal(Number(input.min), d.min);
    assert.equal(Number(input.max), d.max);
    assert.equal(Number(input.value), PADRAO.diario[d.campo]);
  }
});
ok("[PRF-18] cada macro tem barra em % e campo em gramas", () => {
  for (const d of CAMPOS_MACROS) {
    assert.equal(faixa(d.campo)?.type, "range", `${d.campo}: sem barra`);
    assert.equal(Number(faixa(d.campo).min), 0);
    assert.equal(Number(faixa(d.campo).max), 100);
    assert.equal(gramas(d.campo)?.type, "number", `${d.campo}: sem campo em gramas`);
    assert.equal(Number(faixa(d.campo).value), PADRAO.macros[d.campo]);
    // 15% de 2000 kcal a 4 kcal/g = 75 g de proteína
    assert.equal(Number(gramas(d.campo).value), Math.round(metaEmGramas(d.campo, PADRAO)));
  }
  assert.equal(Number(gramas("proteina").value), 75);
});
ok("[PRF-19] o teto do campo em gramas é o dia inteiro naquele macro", () => {
  assert.equal(Number(gramas("proteina").max), 500);   // 2000 kcal / 4
  assert.equal(Number(gramas("gordura").max), 222);    // 2000 kcal / 9
});
ok("[PRF-18] a barra tem rótulo e o eco é lido junto", () => {
  for (const d of CAMPOS_MACROS) {
    const el = faixa(d.campo);
    assert.equal($(`#prefs label[for="${el.id}"]`)?.textContent, d.rotulo);
    assert.equal(el.getAttribute("aria-describedby"), eco(d.campo).id);
    assert.ok(gramas(d.campo).getAttribute("aria-label")?.includes(d.rotulo));
  }
});
ok("[PRF-23] a soma dos macros aparece e começa em 100%", () => {
  assert.match($("#pref-soma").textContent, /100%/);
  assert.equal($("#pref-soma").classList.contains("fora"), false);
});

ok("[PRF-20] arrastar a barra atualiza as gramas na hora", () => {
  arrastar("proteina", 30);
  assert.equal(Number(gramas("proteina").value), 150, "30% de 2000 kcal = 150 g");
  assert.equal(eco("proteina").textContent, "30%");
});
ok("[PRF-20] digitar gramas move a barra na hora", () => {
  digitarGramas("proteina", 100);
  assert.equal(Number(faixa("proteina").value), 20, "100 g = 400 kcal = 20% de 2000");
  assert.equal(eco("proteina").textContent, "20%");
});
ok("[PRF-13] um valor em gramas que não é % redondo sobrevive", () => {
  digitarGramas("proteina", 76);
  assert.equal(Number(gramas("proteina").value), 76, "não devia voltar como 75");
  assert.equal(eco("proteina").textContent, "15,2%");
});
ok("[PRF-12][PRF-19] mudar as calorias do dia recalcula as gramas de todos os macros", () => {
  arrastar("proteina", 15);
  assert.equal(Number(gramas("proteina").value), 75);
  digitar("diario.kcal", 1000);
  assert.equal(Number(gramas("proteina").value), 38, "metade das calorias, metade das gramas");
  assert.equal(Number(faixa("proteina").value), 15, "a escolha em % não mudou");
  assert.equal(Number(gramas("proteina").max), 250);
  digitar("diario.kcal", 2000);
});
ok("[PRF-19] gramas acima do teto param no teto, sem estourar 100%", () => {
  digitarGramas("gordura", 9999);
  assert.equal(Number(faixa("gordura").value), 100);
  assert.equal(Number(gramas("gordura").value), 222);
});
ok("[PRF-23] soma diferente de 100 é avisada, sem corrigir o valor", () => {
  arrastar("gordura", 25);
  arrastar("proteina", 40);
  assert.match($("#pref-soma").textContent, /125%/);
  assert.ok($("#pref-soma").classList.contains("fora"));
  assert.equal(Number(faixa("proteina").value), 40, "o valor escolhido fica");
});
ok("[PRF-21] valor fora dos limites volta para dentro ao sair do campo", () => {
  digitar("diario.kcal", 99999);
  assert.equal(Number($('#prefs input[name="diario.kcal"]').value), 6000);
});
ok("[PRF-15] o que foi digitado é gravado no navegador", () => {
  digitar("diario.fibra", 30);
  const salvo = JSON.parse(window.localStorage.getItem("receitas:preferencias"));
  assert.equal(salvo.diario.fibra, 30);
  assert.equal(salvo.diario.kcal, 6000);
  assert.equal(salvo.macros.proteina, 40);
});
ok('[PRF-24] "voltar ao padrão" limpa também os números', () => {
  clicarEl($("#prefs .pref-limpar"));
  assert.deepEqual(JSON.parse(window.localStorage.getItem("receitas:preferencias")).diario, PADRAO.diario);
  assert.equal(Number($('#prefs input[name="diario.kcal"]').value), 2000);
  assert.match($("#pref-soma").textContent, /100%/);
});

console.log("\nDA PREFERÊNCIA ATÉ A JANELA DE DETALHES");
const notasDaJanela = () => $$("#nutri-detalhes .nutri-dl-nota").map(n => n.textContent).join(" ");

ok("[NUT-21] no padrão, a janela cita a referência da rotulagem", () => {
  abrirDetalhes();
  const nota = notasDaJanela();
  assert.match(nota, /ANVISA/);
  assert.match(nota, /2\.000 kcal/);
  fecharDetalhes();
});
ok("[PRF-25] mudar o diário muda o % mostrado", () => {
  abrirDetalhes();
  const antes = $$("#nutri-detalhes .nb-pct").map(b => b.textContent);
  fecharDetalhes();

  digitar("diario.sodio", 1200);          // metade do padrão: o % do sódio dobra
  abrirDetalhes();
  const depois = $$("#nutri-detalhes .nb-pct").map(b => b.textContent);
  assert.notDeepEqual(depois, antes);

  const linhaSodio = $$("#nutri-detalhes .nutri-barras li").find(l => l.textContent.includes("Sódio"));
  assert.match(linhaSodio.querySelector(".nb-detalhe").textContent, /de 1200 mg/);
  fecharDetalhes();
});
ok("[NUT-21] com valores próprios, a janela para de citar a rotulagem", () => {
  abrirDetalhes();
  const nota = notasDaJanela();
  assert.match(nota, /você definiu/i);
  assert.ok(!nota.includes("ANVISA"));
  fecharDetalhes();
});
ok("[PRF-25] a meta de macro reaparece como referência em gramas na barra", () => {
  digitar("diario.kcal", 2000);
  arrastar("proteina", 30);
  arrastar("carboidrato", 40);
  arrastar("gordura", 30);

  abrirDetalhes();
  const proteina = $$("#nutri-detalhes .nutri-barras li").find(l => l.textContent.includes("Proteínas"));
  // 30% de 2000 kcal = 600 kcal = 150 g
  assert.match(proteina.querySelector(".nb-detalhe").textContent, /de 150 g/);
  fecharDetalhes();
});
ok("[PRF-25] a meta em porcentagem aparece na legenda da rosca", () => {
  abrirDetalhes();
  const legenda = $$("#nutri-detalhes .rosca-legenda li").map(l => l.textContent.replace(/\s+/g, " "));
  assert.match(legenda[0], /meta 30%/);
  assert.match(legenda[1], /meta 40%/);
  fecharDetalhes();
});
ok("[PRF-14] meta com decimal usa vírgula, como todo número da página", () => {
  digitarGramas("proteina", 76);          // 15,2% de 2000 kcal
  abrirDetalhes();
  const legenda = $$("#nutri-detalhes .rosca-legenda li").map(l => l.textContent.replace(/\s+/g, " "));
  assert.match(legenda[0], /meta 15,2%/);
  assert.ok(!legenda[0].includes("15.2"), "ponto decimal escapou para a tela");
  fecharDetalhes();
  arrastar("proteina", 30);
});
ok("[NUT-25] mudar a meta muda a referência das barras, não a rosca", () => {
  abrirDetalhes();
  const antesRosca = $$("#nutri-detalhes .rl-pct").map(b => b.textContent);
  const antesBarra = $$("#nutri-detalhes .nb-pct").map(b => b.textContent);
  fecharDetalhes();

  arrastar("proteina", 10);
  abrirDetalhes();
  assert.deepEqual($$("#nutri-detalhes .rl-pct").map(b => b.textContent), antesRosca,
    "a distribuição da receita não depende da meta");
  assert.notDeepEqual($$("#nutri-detalhes .nb-pct").map(b => b.textContent), antesBarra,
    "a barra de proteína devia ter mudado de escala");
  fecharDetalhes();
});
ok("[PRF-25] preferência mudada com a janela aberta redesenha a janela", () => {
  abrirDetalhes();
  const antes = $("#nutri-detalhes").textContent;
  digitar("diario.kcal", 1200);
  const depois = $("#nutri-detalhes").textContent;
  assert.notEqual(depois, antes, "a janela devia ter acompanhado");
  assert.match($("#nutri-detalhes").textContent, /de 1200 kcal/);
  fecharDetalhes();
});
await okAsync("[PRF-15] as preferências sobrevivem a recarregar a página", async () => {
  /* O teste escreve o que vai conferir. Antes ele confiava no que os testes anteriores
     tinham deixado no painel — e, como era um `async` entregue ao `ok` síncrono, ninguém
     esperava a promessa: a asserção falhava como rejeição não tratada e a suíte seguia
     verde. Agora é `okAsync`, e os valores são destes três `digitar`. */
  digitar("diario.kcal", 1200);
  arrastar("proteina", 30);

  const salvo = window.localStorage.getItem("receitas:preferencias");
  const d2 = new JSDOM(html, { url: "http://localhost:8000/#/receita/feijoada", pretendToBeVisual: true });
  d2.window.scrollTo = () => {};
  d2.window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  d2.window.localStorage.setItem("receitas:preferencias", salvo);
  for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
    try { globalThis[k] = d2.window[k]; } catch {}
  }
  await import(`${RAIZ}/src/js/app.js?v=prefs`);
  await new Promise(r => setTimeout(r, 40));
  assert.equal(Number(d2.window.document.querySelector('#prefs input[name="diario.kcal"]').value), 1200);
  assert.equal(Number(d2.window.document.querySelector('#prefs .pref-macro[data-campo="proteina"] [data-tipo="pct"]').value), 30);
  assert.equal(Number(d2.window.document.querySelector('#prefs .pref-macro[data-campo="proteina"] [data-tipo="gramas"]').value), 90,
    "30% de 1200 kcal = 90 g");
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
