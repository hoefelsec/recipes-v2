/* Liga as especificações aos testes, nos dois sentidos.
 *
 * Lê `docs/specs/*.md` e as suítes, e responde três perguntas:
 *
 *   1. Algum teste cita um ID que não existe?      -> FALHA. É mentira no repositório.
 *   2. Algum requisito não tem teste nenhum?        -> relatório. Buraco é fato, não crime.
 *   3. Algum teste não pertence a requisito nenhum? -> relatório. Ou falta linha na spec,
 *                                                     ou o teste é acessório.
 *
 * Só a primeira quebra a suíte. As outras duas são para olhar, não para travar o commit —
 * um portão que reprova por falta de cobertura vira um portão que se contorna escrevendo
 * requisito de mentira.
 *
 * Uso: `node tests/spec-coverage.mjs` (ou dentro de `tests/run.mjs`).
 * Com `--corrigir`, prefixa os nomes dos testes com os IDs que as specs declaram.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPECS = `${RAIZ}/docs/specs`;

/* Um requisito por linha `- **ABC-01** ...`, e as citações de teste em `Tests: "a", "b"`,
   que podem continuar na linha seguinte. */
const REQUISITO = /^\s*-\s+\*\*([A-Z]{3}-\d{2,3})\*\*/;
const CITACAO = /^\s*Tests:\s*(.+)$/;

export function lerSpecs() {
  const requisitos = new Map();   // id -> { arquivo, testes: [] }

  for (const arquivo of readdirSync(SPECS).filter(f => /^\d\d-.+\.md$/.test(f)).sort()) {
    const linhas = readFileSync(`${SPECS}/${arquivo}`, "utf8").split("\n");
    let atual = null;

    for (const linha of linhas) {
      const req = linha.match(REQUISITO);
      if (req) {
        atual = req[1];
        if (requisitos.has(atual)) {
          throw new Error(`ID repetido: ${atual} (${arquivo} e ${requisitos.get(atual).arquivo})`);
        }
        requisitos.set(atual, { arquivo, testes: [] });
        continue;
      }

      const cit = linha.match(CITACAO);
      if (cit && atual) {
        for (const [, nome] of cit[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
          requisitos.get(atual).testes.push(nome.replace(/\\"/g, '"'));
        }
      }

      // Linha em branco fecha o requisito: `Tests:` tem de vir junto dele
      if (!linha.trim()) atual = null;
    }
  }

  return requisitos;
}

/* Nome de teste como aparece na suíte, com os IDs que ele já cita separados do texto. */
const NOME_DE_TESTE = /\bok(?:Async)?\(\s*(["'])((?:[^\\]|\\.)*?)\1/g;
const PREFIXO = /^((?:\[[A-Z]{3}-\d{2,3}\])+)\s*/;

export function lerTestes() {
  const testes = [];   // { arquivo, ids: [], texto, bruto }

  for (const arquivo of readdirSync(`${RAIZ}/tests`).filter(f => f.endsWith(".test.mjs")).sort()) {
    const fonte = readFileSync(`${RAIZ}/tests/${arquivo}`, "utf8");

    for (const [, , bruto] of fonte.matchAll(NOME_DE_TESTE)) {
      const nome = bruto.replace(/\\(['"])/g, "$1");
      const marca = nome.match(PREFIXO);
      testes.push({
        arquivo,
        ids: marca ? marca[1].match(/[A-Z]{3}-\d{2,3}/g) : [],
        texto: nome.replace(PREFIXO, ""),
        bruto
      });
    }
  }

  return testes;
}

/** Escreve os IDs nos nomes dos testes, a partir do que as specs citam. */
function corrigir(requisitos, testes) {
  const porTexto = new Map();   // texto do teste -> Set de ids
  for (const [id, { testes: citados }] of requisitos) {
    for (const nome of citados) {
      if (!porTexto.has(nome)) porTexto.set(nome, new Set());
      porTexto.get(nome).add(id);
    }
  }

  let tocados = 0;
  const semTeste = new Set(porTexto.keys());

  for (const arquivo of readdirSync(`${RAIZ}/tests`).filter(f => f.endsWith(".test.mjs")).sort()) {
    const caminho = `${RAIZ}/tests/${arquivo}`;
    let fonte = readFileSync(caminho, "utf8");
    let mudou = false;

    fonte = fonte.replace(NOME_DE_TESTE, (todo, aspa, bruto) => {
      const nome = bruto.replace(/\\(['"])/g, "$1");
      const texto = nome.replace(PREFIXO, "");
      const ids = porTexto.get(texto);
      if (!ids) return todo;

      semTeste.delete(texto);
      const prefixo = [...ids].sort().map(id => `[${id}]`).join("");
      const novo = `${prefixo} ${texto}`;
      if (novo === nome) return todo;

      mudou = true;
      tocados++;
      const escapado = novo.replace(new RegExp(aspa, "g"), `\\${aspa}`);
      return todo.replace(bruto, escapado);
    });

    if (mudou) writeFileSync(caminho, fonte);
  }

  console.log(`\n${tocados} nome(s) de teste atualizado(s).`);
  if (semTeste.size) {
    console.log(`\n\x1b[31mCitações que não casam com teste nenhum (${semTeste.size}):\x1b[0m`);
    for (const nome of semTeste) console.log(`  "${nome}"`);
  }
  return semTeste.size === 0;
}

function relatorio() {
  const requisitos = lerSpecs();
  const testes = lerTestes();

  if (process.argv.includes("--corrigir")) {
    return corrigir(requisitos, testes) ? 0 : 1;
  }

  const citados = new Map();   // id -> nº de testes que o citam
  for (const t of testes) for (const id of t.ids) citados.set(id, (citados.get(id) ?? 0) + 1);

  const soltos = [...citados.keys()].filter(id => !requisitos.has(id)).sort();
  const semTeste = [...requisitos].filter(([id, r]) => !r.testes.length && !citados.has(id));
  const naoReclamados = testes.filter(t => !t.ids.length);

  const total = requisitos.size;
  const cobertos = total - semTeste.length;
  const pct = total ? Math.round((cobertos / total) * 100) : 0;

  console.log(`\n\x1b[1mCobertura de especificação\x1b[0m`);
  console.log(`  ${cobertos} de ${total} requisitos com teste (${pct}%)`);
  console.log(`  ${testes.length} verificações nomeadas, ${testes.length - naoReclamados.length} ligadas a requisito`);

  if (semTeste.length) {
    console.log(`\n  Requisitos sem teste (${semTeste.length}):`);
    const porArquivo = new Map();
    for (const [id, r] of semTeste) {
      if (!porArquivo.has(r.arquivo)) porArquivo.set(r.arquivo, []);
      porArquivo.get(r.arquivo).push(id);
    }
    for (const [arquivo, ids] of porArquivo) console.log(`    ${arquivo}: ${ids.join(", ")}`);
  }

  if (naoReclamados.length) {
    console.log(`\n  Verificações sem requisito (${naoReclamados.length}):`);
    const porArquivo = new Map();
    for (const t of naoReclamados) porArquivo.set(t.arquivo, (porArquivo.get(t.arquivo) ?? 0) + 1);
    for (const [arquivo, n] of porArquivo) console.log(`    ${arquivo}: ${n}`);
  }

  if (soltos.length) {
    console.log(`\n\x1b[31m  ID citado que não existe em spec nenhuma (${soltos.length}):\x1b[0m`);
    for (const id of soltos) console.log(`    ${id}`);
    console.log(`\n\x1b[31mfalha\x1b[0m: um teste cita requisito inexistente.\n`);
    return 1;
  }

  console.log(`\n\x1b[32mNenhum ID solto.\x1b[0m\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("spec-coverage.mjs")) {
  process.exit(relatorio());
}
