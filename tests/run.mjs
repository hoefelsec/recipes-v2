/* Roda todas as suítes e resume o resultado.
   Cada suíte corre em um processo próprio: elas trocam o DOM global e o
   localStorage, então precisam de ambientes separados para não se atrapalharem. */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));

const suites = readdirSync(AQUI)
  .filter(f => f.endsWith(".test.mjs"))
  .sort();

const verboso = process.argv.includes("--verbose");

function rodar(arquivo) {
  return new Promise(resolve => {
    const proc = spawn(process.execPath, [join(AQUI, arquivo)], {
      stdio: verboso ? "inherit" : ["ignore", "pipe", "pipe"]
    });

    let saida = "";
    proc.stdout?.on("data", d => { saida += d; });
    proc.stderr?.on("data", d => { saida += d; });

    proc.on("close", codigo => {
      const passou = (saida.match(/✓/g) || []).length;
      const falhou = (saida.match(/✗/g) || []).length;
      resolve({ arquivo, codigo, passou, falhou, saida });
    });
  });
}

const resultados = [];
for (const s of suites) resultados.push(await rodar(s));

if (!verboso) {
  for (const r of resultados) {
    const marca = r.codigo === 0 ? "\x1b[32mok  \x1b[0m" : "\x1b[31mfalha\x1b[0m";
    console.log(`${marca} ${r.arquivo.padEnd(22)} ${String(r.passou).padStart(3)} verificações`);
    if (r.codigo === 0) continue;

    // Nenhuma verificação executada = a suíte nem chegou a rodar (import quebrado,
    // dependência ausente). Filtrar por "✗" esconderia justamente esse caso.
    if (r.passou + r.falhou === 0) {
      console.log("      a suíte não executou — saída completa:\n");
      console.log(r.saida.trimEnd().split("\n").map(l => "      " + l).join("\n") + "\n");
    } else {
      console.log(
        r.saida.split("\n")
          .filter(l => l.includes("✗") || l.trim().startsWith("The ") || l.includes("Expected"))
          .join("\n")
      );
    }
  }
}

/* A cobertura de especificação roda depois das suítes, e no mesmo processo: ela só lê
   arquivos. Um ID citado que não existe em spec nenhuma reprova junto com os testes —
   é mentira no repositório. Requisito sem teste, não: buraco é fato, não crime. */
const cobertura = await rodar("spec-coverage.mjs");
if (cobertura.codigo !== 0 || verboso) console.log(cobertura.saida.trimEnd());
else console.log(cobertura.saida.split("\n").filter(l => l.includes("requisitos com teste")).join("\n"));

const total = resultados.reduce((s, r) => s + r.passou, 0);
const falhas = resultados.reduce((s, r) => s + r.falhou, 0);
const quebrou = resultados.some(r => r.codigo !== 0) || cobertura.codigo !== 0;

const naoRodaram = resultados.filter(r => r.passou + r.falhou === 0).length;

if (!quebrou) {
  console.log(`\n\x1b[32m${total} verificações, todas passaram.\x1b[0m\n`);
} else if (naoRodaram) {
  console.log(
    `\n\x1b[31m${naoRodaram} de ${resultados.length} suítes não executaram.\x1b[0m` +
    ` Faltou \`npm install\`?\n`
  );
} else {
  console.log(`\n\x1b[31m${falhas} falha(s)\x1b[0m de ${total + falhas} verificações\n`);
}

process.exit(quebrou ? 1 : 0);
