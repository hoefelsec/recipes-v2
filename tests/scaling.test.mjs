/* Testes do ajuste de porções: primeiro a matemática pura,
   depois o comportamento na página (botões, URL, limites). */

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

/* ---------------------------------------------------- matemática pura */

const { arredondar, formatar, pluralizar, escalarIngrediente, normalizarPorcoes, fator, unidadeConhecida, quantidadeEmTexto } =
  await import(`${RAIZ}/src/js/scaling.js`);

console.log("\nFORMATAÇÃO DE NÚMEROS");
ok("[MEA-18] inteiros ficam inteiros", () => {
  assert.equal(formatar(3), "3");
  assert.equal(formatar(137), "137");
});
ok("[MEA-18] frações viram símbolo", () => {
  assert.equal(formatar(0.25), "¼");
  assert.equal(formatar(0.5), "½");
  assert.equal(formatar(2.5), "2 ½");
  assert.equal(formatar(1.75), "1 ¾");
  assert.equal(formatar(1 / 3), "⅓");
});
ok("[MEA-18] decimal sem fração usa vírgula (pt-BR)", () => assert.equal(formatar(1.4), "1,4"));

console.log("\nARREDONDAMENTO POR UNIDADE");
ok("[MEA-14] gramas grandes: passo de 25 quando o número não é redondo", () => {
  assert.equal(arredondar(437, "g"), 425);   // 437 não é múltiplo de 5 -> passo 25
  assert.equal(arredondar(300, "g"), 300);
});
ok("[MEA-15] número já redondo é preservado (múltiplo de 5)", () => {
  assert.equal(arredondar(360, "g"), 360);
  assert.equal(arredondar(375, "g"), 375);
  assert.equal(arredondar(187.5, "g"), 190);
});
ok("[MEA-17] peso e volume saem em decimal, não em fração", () => {
  assert.equal(formatar(1250, "g"), "1.250");
  assert.equal(formatar(2.5, "copo"), "2 ½");
});
ok("[MEA-21] grama passa a ser escrito em kg acima de mil", () => {
  // kg não é unidade: é como o grama se escreve quando o número cresce
  assert.equal(quantidadeEmTexto(999, "g"), "999 g");
  assert.equal(quantidadeEmTexto(1000, "g"), "1 kg");
  assert.equal(quantidadeEmTexto(1250, "g"), "1,25 kg");
  assert.equal(quantidadeEmTexto(5000, "g"), "5 kg");
});
ok("[MEA-14] gramas pequenas: passo de 1", () => assert.equal(arredondar(7.3, "g"), 7));
ok("[MEA-05] contáveis nunca viram fração", () => {
  assert.equal(arredondar(1.5, "un."), 2);
  assert.equal(arredondar(4.4, "dente"), 4);
  assert.equal(arredondar(2.6, "folha"), 3);
});
ok("[MEA-13] medidas caseiras: passo de ¼", () => {
  assert.equal(arredondar(1.3, "col. sopa"), 1.25);
  assert.equal(arredondar(3.1, "copo"), 3);
});
ok("[MEA-05] latas aceitam meia", () => assert.equal(arredondar(0.5, "lata"), 0.5));
ok("[MEA-13] nada some ao reduzir muito (respeita o mínimo)", () => {
  assert.ok(arredondar(0.01, "g") >= 1);
  assert.ok(arredondar(0.01, "un.") >= 1);
  assert.ok(arredondar(0.01, "col. sopa") >= 0.25);
});

console.log("\nPLURAL");
ok("[MEA-19] singular em 1 e em fração", () => {
  assert.equal(pluralizar("lata", 1), "lata");
  assert.equal(pluralizar("lata", 0.5), "lata");
  assert.equal(pluralizar("copo", 1), "copo");
});
ok("[MEA-19] plural acima de 1", () => {
  assert.equal(pluralizar("lata", 2), "latas");
  assert.equal(pluralizar("dente", 6), "dentes");
});
ok("[MEA-19] unidades invariáveis não ganham s", () => {
  assert.equal(pluralizar("g", 500), "g");
  assert.equal(pluralizar("col. sopa", 4), "col. sopa");
});

console.log("\nESCALA DE INGREDIENTES");
ok('[REC-09] "a gosto" não escala', () => {
  const r = escalarIngrediente({ escala: false, texto: "a gosto", item: "sal" }, 3);
  assert.equal(r.qtd, "a gosto");
});
ok("[REC-08] subtítulo passa intacto", () => {
  assert.deepEqual(escalarIngrediente({ subtitulo: "Cobertura" }, 2), { subtitulo: "Cobertura" });
});
ok('[MEA-20] unidade "un." fica oculta no texto', () => {
  const r = escalarIngrediente({ qtd: 3, un: "un.", item: "ovos" }, 1);
  assert.equal(r.qtd, "3");
});
ok("[REC-12] item vai para o singular quando cabe", () => {
  const ing = { qtd: 2, un: "un.", item: "cebolas picadas", itemSingular: "cebola picada" };
  assert.equal(escalarIngrediente(ing, 1).item, "cebolas picadas");
  assert.equal(escalarIngrediente(ing, 0.5).item, "cebola picada");
});
ok("[MEA-33] a nota entre parênteses também escala", () => {
  const ing = { qtd: 1, un: "copo", item: "óleo", densidade: 0.92, liquido: true };
  assert.equal(escalarIngrediente(ing, 2).nota, "360 ml");
  assert.equal(escalarIngrediente(ing, 1).nota, "180 ml");
});
ok("[REC-13] a receita não escreve mais a nota; um campo `nota` é ignorado", () => {
  // Antes a equivalência vinha à mão do arquivo da receita. Se sobrar alguma,
  // não deve voltar a ser usada pelas costas.
  const ing = { qtd: 1, un: "lata", item: "x", nota: { qtd: 999, un: "g" } };
  assert.equal(escalarIngrediente(ing, 1).nota, null);
  assert.equal(escalarIngrediente({ ...ing, nota: "peneirado" }, 4).nota, null);
});

console.log("\nLIMITES DE PORÇÕES");
const receitaFake = { porcoes: { padrao: 8, min: 4, max: 24, passo: 2 } };
ok("[MEA-42][PRF-03] valor abaixo do mínimo é elevado", () => assert.equal(normalizarPorcoes(receitaFake, 1), 4));
ok("[MEA-42][PRF-03] valor acima do máximo é cortado", () => assert.equal(normalizarPorcoes(receitaFake, 999), 24));
ok("[MEA-42] valor fora do passo encaixa na grade", () => assert.equal(normalizarPorcoes(receitaFake, 9), 10));
ok("[MEA-42] texto inválido volta ao padrão", () => assert.equal(normalizarPorcoes(receitaFake, "abc"), 8));
ok("[MEA-39] fator confere", () => assert.equal(fator(receitaFake, 16), 2));

/* ------------------------------------------------------- na página real */

const html = readFileSync(`${RAIZ}/index.html`, "utf8");
const dom = new JSDOM(html, { url: "http://localhost:8000/", pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
/* `localStorage` entra na lista porque o mercado ativo mora nas preferências: sem
   ele, `definirMercado` escrevia no vazio e a receita nunca via mercado nenhum. */
for (const k of ["window", "document", "location", "HTMLElement", "Node", "Event", "getComputedStyle", "history", "localStorage"]) {
  try { globalThis[k] = window[k]; } catch {}
}
window.localStorage.clear();

const { receitas, porSlug } = await import(`${RAIZ}/src/data/index.js`);
const SETTINGS = await import(`${RAIZ}/src/js/settings.js`);

/* A unidade de porção vem dos dados, não escrita à mão: ela é texto de
   apresentação e já mudou uma vez ("pessoas" -> "p."). Fixar a palavra aqui só
   fazia dezenove testes falharem por uma decisão de tela. */
const un = slug => porSlug(slug).porcoes.unidade;
const unSing = slug => porSlug(slug).porcoes.unidadeSingular ?? un(slug);
const valorPorcoes = (n, slug) => new RegExp(`${n}\\s+${un(slug).replace(/\./g, "\\.")}`);
await import(`${RAIZ}/src/js/app.js`);
await new Promise(r => setTimeout(r, 40));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const irPara = (slug, porcoes) => {
  window.location.hash = `#/receita/${slug}` + (porcoes ? `?porcoes=${porcoes}` : "");
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
};
const clicar = passo => {
  const b = $(`.pbtn[data-passo="${passo}"]`);
  b.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  return b;
};
const qtdDe = nome => {
  const li = $$("#lista-ingredientes li:not(.sub)").find(l => l.textContent.includes(nome));
  assert.ok(li, `ingrediente não encontrado: ${nome}`);
  return li.querySelector(".qty").textContent.trim();
};

/* Procura pelo começo do nome, não por "inclui": "sal" acha "manteiga sem sal"
   e "carne-seca dessalgada" antes de achar o sal. */
const linhaDe = nome => {
  const li = $$("#lista-ingredientes li:not(.sub)")
    .find(l => l.querySelector(".ing-nome")?.textContent.trim().startsWith(nome));
  assert.ok(li, `ingrediente não encontrado: ${nome}`);
  return li;
};
/* `\s` casa com o espaço fino do pt-BR, então o texto normalizado sai com
   espaço comum — é assim que as expectativas abaixo são escritas. */
const precoDe = nome =>
  linhaDe(nome).querySelector(".ing-preco")?.textContent.replace(/\s+/g, " ").trim() ?? null;

console.log("\nSELETOR NA PÁGINA");
irPara("feijoada");
ok("[REC-28] mostra o padrão da receita ao abrir", () => {
  assert.match($("#porcoes-valor").textContent, valorPorcoes(8, "feijoada"));
});
ok("[REC-25][SHL-30][SHL-31] botões existem, com rótulo acessível e aria-live no valor", () => {
  assert.equal($$(".pbtn").length, 2);
  assert.ok($('.pbtn[data-passo="1"]').getAttribute("aria-label"));
  assert.equal($("#porcoes-valor").getAttribute("aria-live"), "polite");
  assert.equal($(".porcoes").getAttribute("role"), "group");
});
ok("[REC-28] clicar em + soma um passo (2 porções)", () => {
  clicar(1);
  assert.match($("#porcoes-valor").textContent, valorPorcoes(10, "feijoada"));
});
ok("[MEA-40][REC-28] ingredientes recalculam junto", () => {
  // 8 -> 10 pessoas = fator 1,25 · feijão 1 kg -> 1,25 kg · bacon 150 g -> 190 g
  assert.equal(qtdDe("feijão preto"), "1,25 kg");
  assert.equal(qtdDe("bacon"), "190 g");
});
ok('[REC-09] "a gosto" continua "a gosto"', () => assert.equal(qtdDe("pimenta-do-reino"), "a gosto"));
ok("[REC-28] subtítulos sobrevivem ao recálculo", () => {
  assert.equal($$("#lista-ingredientes li.sub").length, 2);
});
ok("[MEA-43][REC-29] aviso de escala aparece fora do padrão", () => {
  assert.ok($("#escala-aviso").textContent.includes(`10 ${un("feijoada")}`));
});
ok("[SHL-05] URL guarda as porções", () => {
  assert.ok(window.location.hash.includes("porcoes=10"), window.location.hash);
});
ok("[SHL-05][SHL-08] voltar ao padrão limpa o parâmetro da URL", () => {
  clicar(-1);
  assert.match($("#porcoes-valor").textContent, valorPorcoes(8, "feijoada"));
  assert.equal(window.location.hash, "#/receita/feijoada");
  assert.equal($("#escala-aviso").textContent.trim(), "");
});

console.log("\nLIMITES NA PÁGINA");
ok("[REC-25][SHL-31] botão − desativa no mínimo", () => {
  irPara("feijoada", 4);
  assert.equal($('.pbtn[data-passo="-1"]').disabled, true);
  assert.equal($('.pbtn[data-passo="1"]').disabled, false);
});
ok("[REC-25][SHL-31] botão + desativa no máximo", () => {
  irPara("feijoada", 24);
  assert.equal($('.pbtn[data-passo="1"]').disabled, true);
});
ok("[REC-25] clique no botão desativado não faz nada", () => {
  irPara("feijoada", 24);
  clicar(1);
  assert.match($("#porcoes-valor").textContent, valorPorcoes(24, "feijoada"));
});
ok("[SHL-05] porções inválidas na URL são corrigidas na própria URL", () => {
  irPara("feijoada", 999);
  assert.match($("#porcoes-valor").textContent, valorPorcoes(24, "feijoada"));
  assert.ok(window.location.hash.includes("porcoes=24"), window.location.hash);
});
ok("[MEA-42] passo próprio de cada receita (bolo: 6 fatias)", () => {
  irPara("bolo-de-cenoura");
  assert.match($("#porcoes-valor").textContent, /12\s+fatias/);
  clicar(1);
  assert.match($("#porcoes-valor").textContent, /18\s+fatias/);
});

console.log("\nTECLADO");
ok("[REC-26] setas ajustam o valor", () => {
  irPara("brigadeiro");
  const grupo = $(".porcoes");
  grupo.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  assert.match($("#porcoes-valor").textContent, valorPorcoes(30, "brigadeiro"));
  grupo.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert.match($("#porcoes-valor").textContent, valorPorcoes(25, "brigadeiro"));
});

console.log("\nCOERÊNCIA ENTRE RECEITAS");
ok("[REC-02][REC-03] todas têm min < padrão < max e passo compatível", () => {
  for (const r of receitas) {
    const p = r.porcoes;
    assert.ok(p.min <= p.padrao && p.padrao <= p.max, `${r.slug}: intervalo inválido`);
    assert.equal((p.padrao - p.min) % (p.passo ?? 1), 0, `${r.slug}: padrão fora da grade do passo`);
    assert.ok(p.unidade, `${r.slug}: sem unidade de porção`);
  }
});
ok("[MEA-39] no padrão, nada é alterado em relação ao arquivo de dados", () => {
  for (const r of receitas) {
    for (const ing of r.ingredientes.filter(i => i.qtd != null)) {
      const saida = escalarIngrediente(ing, 1);
      const esperado = quantidadeEmTexto(ing.qtd, ing.un);
      assert.equal(saida.qtd, esperado, `${r.slug} · ${ing.item}`);
    }
  }
});
ok("[MEA-08] toda unidade usada nos dados é conhecida pelo módulo", () => {
  for (const r of receitas) {
    for (const ing of r.ingredientes) {
      if (ing.un) assert.ok(unidadeConhecida(ing.un), `unidade não registrada no banco de medidas: "${ing.un}" (${r.slug})`);
    }
  }
});
ok("[REC-13] nenhum arquivo de receita escreve a equivalência à mão", () => {
  // A nota é calculada; deixá-la nos dados abriria caminho para dois números
  // dizendo coisas diferentes sobre a mesma medida.
  for (const arquivo of ["feijoada", "brigadeiro", "bolo-de-cenoura"]) {
    const fonte = readFileSync(`${RAIZ}/src/data/${arquivo}.js`, "utf8");
    assert.ok(!/\bnota\s*:/.test(fonte), `${arquivo}.js ainda tem um campo nota`);
  }
});
ok("[MEA-41] escalar e voltar recupera o valor original (ida e volta)", () => {
  for (const r of receitas) {
    irPara(r.slug);
    const antes = $("#lista-ingredientes").innerHTML;
    clicar(1); clicar(-1);
    assert.equal($("#lista-ingredientes").innerHTML, antes, r.slug);
  }
});
ok("[REC-28] trocar de receita zera as porções da anterior", () => {
  irPara("feijoada", 24);
  irPara("brigadeiro");
  assert.match($("#porcoes-valor").textContent, valorPorcoes(25, "brigadeiro"));
  assert.equal(window.location.hash, "#/receita/brigadeiro");
});

console.log("\nPREÇO POR INGREDIENTE NA PÁGINA");
irPara("feijoada");
ok("[REC-22] cada linha com quantidade mostra um preço", () => {
  const comQtd = $$("#lista-ingredientes li:not(.sub)").filter(l => !l.textContent.includes("a gosto"));
  assert.equal(comQtd.length, 10);
  for (const li of comQtd) {
    const preco = li.querySelector(".ing-preco");
    assert.ok(preco, `sem preço: ${li.textContent.trim()}`);
    assert.match(preco.textContent, /R\$|\?\?\?/);
  }
});
ok('[REC-09] "a gosto" fica com a célula vazia, não sem célula', () => {
  // sem a célula, a coluna da quantidade escorregaria para a direita nesta linha
  const sal = linhaDe("sal");
  assert.match(sal.textContent, /a gosto/);
  assert.ok(sal.querySelector(".ing-preco"), "a célula tem de existir");
  assert.equal(sal.querySelector(".ing-preco").textContent.trim(), "");
});
ok("[REC-22] toda linha tem as três colunas na mesma ordem", () => {
  for (const li of $$("#lista-ingredientes li:not(.sub)")) {
    const classes = [...li.children].map(c => c.className.split(" ")[0]);
    assert.deepEqual(classes, ["ing-nome", "qty", "ing-preco"], li.textContent.trim());
  }
});
ok("[PRC-18] o preço é do produto mais barato, e o title diz qual", () => {
  const preco = linhaDe("feijão preto").querySelector(".ing-preco");
  assert.match(preco.textContent, /8,00/, "1 kg pelo São João, a R$ 8,00/kg");
  assert.match(preco.getAttribute("title"), /São João/);
  assert.match(preco.getAttribute("title"), /kg/, "o unitário se lê por quilo");
});
ok("[REC-28] mudar as porções muda o preço na mesma proporção", () => {
  irPara("feijoada", 8);
  const oito = precoDe("feijão preto");
  irPara("feijoada", 16);
  assert.equal(precoDe("feijão preto"), "R$ 16,00", `dobro de ${oito}`);
  irPara("feijoada", 4);
  assert.equal(precoDe("feijão preto"), "R$ 4,00");
  irPara("feijoada", 8);
  assert.equal(precoDe("feijão preto"), oito);
});
ok("[PRC-18] trocar a medida não muda o preço", () => {
  irPara("bolo-de-cenoura");
  const antes = precoDe("farinha de trigo");
  const botao = linhaDe("farinha").querySelector(".qty.conv");
  botao.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const opcao = $$(".conv-menu button").find(b => b.textContent.trim().startsWith("300 g"));
  assert.ok(opcao, "a opção em gramas devia existir");
  opcao.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(precoDe("farinha de trigo"), antes, "é a mesma farinha, escrita de outro jeito");
});
ok("[PRC-17] sal não recebe preço: assume-se que já está em casa", () => {
  irPara("brigadeiro");
  const sal = linhaDe("sal");
  assert.match(sal.textContent, /pitada/, "tem quantidade, ao contrário do sal da feijoada");
  assert.equal(precoDe("sal"), "", "célula vazia, não ??? — não é desconhecido, é irrelevante");
  assert.equal(sal.querySelector(".ing-preco.sem-preco"), null);
});
ok("[PRC-24] o total da receita aparece, com o custo por porção", () => {
  irPara("feijoada", 8);
  const linhas = $$("#custo-total .custo > div").map(d => [
    d.querySelector("dt").textContent.trim(),
    d.querySelector("dd").textContent.trim()
  ]);
  assert.equal(linhas.length, 2);
  assert.match(linhas[0][1], /64,13/);
  assert.match(linhas[1][0], new RegExp(`^Por ${unSing("feijoada")}$`), "o rótulo usa a unidade de porção da receita");
  assert.match(linhas[1][1], /8,02/);
});
ok("[PRC-27] na receita, o mercado ativo pinta a linha e nomeia os preços", () => {
  /* A página da receita não tem seletor — ele fica na área de compras —, então a
     nota abaixo da lista precisa dizer de qual mercado são estes preços. Sem isso,
     "não vendido aqui" não tem "aqui". */
  const nota = () => $("#nota-preco").textContent.replace(/\s+/g, " ");

  SETTINGS.definirMercado("asun");
  irPara("brigadeiro");
  irPara("bolo-de-cenoura");

  assert.match(nota(), /Preços do Asun/);
  assert.ok($$("#lista-ingredientes li.ing-errada").length > 0, "o Asun não vende cenoura");

  SETTINGS.definirMercado(null);
  irPara("brigadeiro");
  irPara("bolo-de-cenoura");

  assert.match(nota(), /mais barato do catálogo/);
  assert.equal($$("#lista-ingredientes li.ing-errada").length, 0);
});
ok("[PRC-24] o rótulo por porção acompanha a receita", () => {
  irPara("bolo-de-cenoura");
  assert.match($("#custo-total .custo > div:last-child dt").textContent, new RegExp(`^Por ${unSing("bolo-de-cenoura")}$`));
  irPara("brigadeiro");
  assert.match($("#custo-total .custo > div:last-child dt").textContent, new RegExp(`^Por ${unSing("brigadeiro")}$`));
});
ok("[PRC-24] mudar as porções move o total e não o por porção", () => {
  irPara("bolo-de-cenoura", 12);
  const total = () => $("#custo-total .custo > div:first-child dd").textContent.replace(/\s+/g, " ").trim();
  const porFatia = () => $("#custo-total .custo > div:last-child dd").textContent.replace(/\s+/g, " ").trim();

  assert.equal(total(), "R$ 15,75");
  const unitario = porFatia();

  clicar(1);   // 18 fatias
  assert.equal(total(), "R$ 23,62", "1,5x");
  assert.equal(porFatia(), unitario, "o custo por fatia é o mesmo bolo");
});
ok("[PRC-23] o que ficou fora da conta é dito, não escondido", () => {
  irPara("feijoada");
  const fora = $("#custo-total .custo-fora");
  assert.ok(fora, "a feijoada tem pimenta a gosto: devia avisar");
  assert.match(fora.textContent, /pimenta-do-reino/);
  assert.match(fora.textContent, /a gosto/);
  assert.ok(!fora.textContent.includes("sal"), "sal é decisão, não pendência");

  assert.match($("#custo-total .custo > div:first-child dt").textContent, /dá para calcular/,
    "com lacuna, o rótulo não promete um total fechado");
});
ok("[PRC-25] conta completa se chama de custo estimado", () => {
  irPara("brigadeiro");
  assert.equal($("#custo-total .custo-fora"), null);
  assert.match($("#custo-total .custo > div:first-child dt").textContent, /^Custo estimado$/);
});
ok("[PRC-21] o total é a soma exata das linhas mostradas", () => {
  irPara("bolo-de-cenoura", 18);
  const soma = $$("#lista-ingredientes .ing-preco")
    .map(e => e.textContent.trim())
    .filter(t => t.startsWith("R$"))
    .reduce((s, t) => s + Number(t.replace(/[^\d,]/g, "").replace(",", ".")), 0);
  const total = Number($("#custo-total .custo > div:first-child dd").textContent.replace(/[^\d,]/g, "").replace(",", "."));
  // cada linha é arredondada para o centavo, então a soma pode diferir por alguns
  assert.ok(Math.abs(total - soma) <= 0.05, `total ${total} vs soma das linhas ${soma}`);
});
ok("[PRC-27] a página avisa de onde vêm os preços", () => {
  const nota = $(".ing-nota-preco").textContent.replace(/\s+/g, " ");
  assert.match(nota, /mais barato/);
  assert.match(nota, /\?\?\?/, "o leitor precisa saber o que ??? quer dizer");
  assert.match(nota, /teste/, "preço fictício tem de ser declarado");
  assert.match(nota, /[Ss]al e água/, "o leitor precisa saber por que essas linhas estão vazias");
});

console.log(falhas.length ? `\n\x1b[31m${falhas.length} falha(s):\x1b[0m ${falhas.join(", ")}\n` : "\n\x1b[32mTodos os testes passaram.\x1b[0m\n");
process.exit(falhas.length ? 1 : 0);
