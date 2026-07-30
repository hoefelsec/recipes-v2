/* Preferências do leitor, guardadas no próprio navegador.
 *
 * Cinco grupos:
 *   peso · volume   unidade preferida para exibir medidas
 *   mercado         onde ela vai comprar — muda preço, total e o que se oferece
 *   diario          consumo diário de referência (kcal, fibra, sódio)
 *   macros          como a pessoa quer distribuir as calorias entre os macros
 *
 * Os padrões de `diario` e `macros` são os valores de rotulagem brasileira
 * (ANVISA) para dieta de 2 000 kcal — ponto de partida, não recomendação.
 */

import { abrirDialogo, ligarFechamento } from "./dom.js";
import { ROTULOS, metaEmGramas, pctDeGramas } from "./nutrition.js";
import { existe as mercadoExiste } from "../data/mercados.js";

const CHAVE = "receitas:preferencias";

/* Nenhum mercado escolhido. Não é "erro" nem "ainda não decidi": é uma escolha
   legítima — comparar preços entre todos os mercados, que é o que o site fazia
   antes de haver mercado nenhum. */
export const TODOS_OS_MERCADOS = "todos";

export const PADRAO = {
  peso: "receita",
  volume: "receita",
  mercado: TODOS_OS_MERCADOS,
  diario: { kcal: 2000, fibra: 25, sodio: 2400 },
  macros: { proteina: 15, carboidrato: 60, gordura: 25 }
};

/* Opções oferecidas no painel. "receita" = do jeito que foi escrita. */
export const OPCOES = {
  peso: [
    { valor: "receita", rotulo: "Como na receita" },
    { valor: "g", rotulo: "Gramas (acima de 1 kg, escrito em kg)" }
  ],
  volume: [
    { valor: "receita", rotulo: "Como na receita" },
    { valor: "ml", rotulo: "Mililitros (ml)" },
    { valor: "L", rotulo: "Litros (L)" },
    { valor: "copo", rotulo: "Copos (180 ml)" },
    { valor: "xícara", rotulo: "Xícaras (240 ml)" },
    { valor: "col. sopa", rotulo: "Colheres de sopa (15 ml)" }
  ]
};

/** Limites dos campos numéricos. Fora deles, o valor é trazido de volta. */
export const CAMPOS_DIARIOS = [
  { campo: "kcal", rotulo: "Calorias", un: "kcal", min: 800, max: 6000, passo: 50 },
  { campo: "fibra", rotulo: "Fibras", un: "g", min: 5, max: 100, passo: 1 },
  { campo: "sodio", rotulo: "Sódio", un: "mg", min: 500, max: 6000, passo: 100 }
];

/* A distribuição é guardada em PORCENTAGEM, não em gramas: assim, mudar as
   calorias do dia preserva a distribuição em vez de mudar o seu significado.
   Uma casa decimal porque o leitor também digita a meta em gramas — com número
   inteiro, 1% de 2 000 kcal seriam saltos de 5 g na proteína, e digitar "76 g"
   devolveria 75 g na cara de quem digitou. */
export const CAMPOS_MACROS = [
  { campo: "proteina", rotulo: "Proteínas" },
  { campo: "carboidrato", rotulo: "Carboidratos" },
  { campo: "gordura", rotulo: "Gorduras" }
];

export const CASAS_MACRO = 1;

/* ------------------------------------------------------------- saneamento */

const valido = (grupo, valor) => OPCOES[grupo].some(o => o.valor === valor);

const numero = (valor, { min, max, decimais = 0 }, padrao) => {
  // Ausente é diferente de zero: `Number(null)` e `Number("")` dão 0, e cair no
  // mínimo por causa disso trocaria "não informei" por "quero o menor possível"
  if (valor === null || valor === undefined || valor === "") return padrao;

  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;

  const escala = 10 ** decimais;
  return Math.min(max, Math.max(min, Math.round(n * escala) / escala));
};

/** Descarta o que não faz sentido, campo por campo. */
export function sanear(bruto = {}) {
  const prefs = {
    peso: valido("peso", bruto.peso) ? bruto.peso : PADRAO.peso,
    volume: valido("volume", bruto.volume) ? bruto.volume : PADRAO.volume,
    /* Mercado que saiu do cadastro volta a "todos" em vez de sumir com os preços:
       a mesma regra do resto do saneamento — o dado guardado nunca manda mais que
       o dado atual. */
    mercado: mercadoExiste(bruto.mercado) ? bruto.mercado : PADRAO.mercado,
    diario: {},
    macros: {}
  };

  for (const def of CAMPOS_DIARIOS) {
    prefs.diario[def.campo] = numero(bruto.diario?.[def.campo], def, PADRAO.diario[def.campo]);
  }

  for (const def of CAMPOS_MACROS) {
    prefs.macros[def.campo] = numero(
      bruto.macros?.[def.campo], { min: 0, max: 100, decimais: CASAS_MACRO }, PADRAO.macros[def.campo]
    );
  }

  return prefs;
}

/**
 * Soma das metas de macro. Deve dar 100, mas não se força a mão do leitor.
 * Arredondada para uma casa: somar decimais dá 99,9 quando o certo é 100.
 */
export const somaMacros = prefs => {
  const bruta = CAMPOS_MACROS.reduce((s, d) => s + (prefs.macros?.[d.campo] ?? 0), 0);
  const escala = 10 ** CASAS_MACRO;
  return Math.round(bruta * escala) / escala;
};

/** Número curto para a tela: "15%" em vez de "15,0%". */
export const formatarPct = valor =>
  valor.toLocaleString("pt-BR", { maximumFractionDigits: CASAS_MACRO });

export function carregar() {
  try {
    return sanear(JSON.parse(localStorage.getItem(CHAVE) || "{}"));
  } catch {
    return sanear({});   // navegador sem localStorage, ou JSON corrompido
  }
}

export function salvar(prefs) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(prefs));
  } catch {
    /* modo privado em alguns navegadores bloqueia a escrita — segue sem salvar */
  }
}

/* ----------------------------------------------------------- mercado ativo */

/**
 * O mercado ativo, ou `null` para "todos".
 *
 * `null` e não a string "todos" porque é isso que o resto do código quer receber:
 * toda função de preço trata `mercado = null` como "sem filtro", e assim ninguém
 * precisa conhecer a palavra que a preferência usa para dizer isso.
 */
export function mercadoAtivo() {
  /* A escolha de mercado passou a acontecer SÓ na página de montagem da lista, item
     a item (cada ingrediente vai para o mercado onde será comprado). Nas demais telas
     — receita, vitrine, carrinho — o site assume que nenhum mercado foi escolhido e
     compara o mais barato entre todos. Daí `null` sempre. */
  return null;
}

/** Troca o mercado ativo e devolve as preferências novas. `null` = todos. */
export function definirMercado(id) {
  const prefs = carregar();
  prefs.mercado = mercadoExiste(id) ? id : TODOS_OS_MERCADOS;
  salvar(prefs);
  return prefs;
}

/* ------------------------------------------------------------------ painel */

function grupoUnidade(grupo, titulo, ajuda, prefs) {
  return `
    <fieldset class="pref-grupo">
      <legend>${titulo}</legend>
      <p class="pref-ajuda">${ajuda}</p>
      ${OPCOES[grupo].map(o => `
        <label class="pref-opcao">
          <input type="radio" name="${grupo}" value="${o.valor}" ${prefs[grupo] === o.valor ? "checked" : ""}>
          <span>${o.rotulo}</span>
        </label>`).join("")}
    </fieldset>`;
}

function grupoDiario(prefs) {
  return `
    <fieldset class="pref-grupo">
      <legend>Consumo diário</legend>
      <p class="pref-ajuda">Serve de base para o “% do diário” nos detalhes da receita.</p>
      ${CAMPOS_DIARIOS.map(d => `
        <label class="pref-num">
          <span>${d.rotulo}</span>
          <input type="number" name="diario.${d.campo}" value="${prefs.diario[d.campo]}"
                 min="${d.min}" max="${d.max}" step="${d.passo}" inputmode="numeric">
          <em>${d.un}</em>
        </label>`).join("")}
    </fieldset>`;
}

/**
 * Cada macro tem dois controles ligados ao mesmo valor: a barra deslizante em
 * porcentagem e o campo em gramas. Mexer em um atualiza o outro na hora.
 */
function grupoMacros(prefs) {
  return `
    <fieldset class="pref-grupo">
      <legend>Distribuição dos macros</legend>
      <p class="pref-ajuda">
        Arraste a porcentagem das calorias ou digite a meta em gramas — os dois
        andam juntos.
      </p>

      ${CAMPOS_MACROS.map(d => {
        const pct = prefs.macros[d.campo];
        const gramas = metaEmGramas(d.campo, prefs);
        const maxGramas = Math.round(metaEmGramas(d.campo, { ...prefs, macros: { [d.campo]: 100 } }));

        return `
          <div class="pref-macro" data-campo="${d.campo}">
            <label class="pm-nome" for="macro-pct-${d.campo}">${d.rotulo}</label>

            <input class="pm-faixa" type="range" id="macro-pct-${d.campo}"
                   data-campo="${d.campo}" data-tipo="pct"
                   min="0" max="100" step="1" value="${pct}"
                   aria-describedby="macro-eco-${d.campo}">

            <output class="pm-pct" id="macro-eco-${d.campo}">${formatarPct(pct)}%</output>

            <span class="pm-gramas">
              <input type="number" data-campo="${d.campo}" data-tipo="gramas"
                     value="${Math.round(gramas)}" min="0" max="${maxGramas}" step="1"
                     inputmode="numeric" aria-label="${d.rotulo} em gramas por dia">
              <em>g</em>
            </span>
          </div>`;
      }).join("")}

      <p class="pref-soma" id="pref-soma" aria-live="polite"></p>
    </fieldset>`;
}

/**
 * Monta o painel e liga os eventos.
 * `aoMudar(prefs)` é chamado a cada alteração.
 */
export function iniciarPreferencias(aoMudar) {
  let prefs = carregar();

  const dialogo = document.getElementById("prefs");
  const abrir = document.getElementById("abrir-prefs");

  dialogo.innerHTML = `
    <div class="pref-form">
      <header class="pref-head">
        <h2>Preferências</h2>
        <button type="button" class="pref-fechar" aria-label="Fechar preferências"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>

      ${grupoUnidade("peso", "Peso", "Como mostrar farinha, carne, açúcar…", prefs)}
      ${grupoUnidade("volume", "Volume", "Como mostrar leite, óleo, água…", prefs)}
      ${grupoDiario(prefs)}
      ${grupoMacros(prefs)}

      <p class="pref-nota">
        Os valores iniciais são os da rotulagem brasileira (ANVISA) para 2.000 kcal.
        Não são recomendação: a sua necessidade depende de idade, peso, saúde e
        atividade — quem sabe dizer é um profissional.
      </p>

      <footer class="pref-foot">
        <button type="button" class="pref-limpar">Voltar ao padrão</button>
        <button type="button" class="pref-ok">Pronto</button>
      </footer>
    </div>`;

  const campoSoma = dialogo.querySelector("#pref-soma");

  function mostrarSoma() {
    const soma = somaMacros(prefs);
    campoSoma.textContent = soma === 100
      ? "Soma: 100%"
      : `Soma: ${formatarPct(soma)}% — para uma distribuição completa, deveria dar 100%.`;
    campoSoma.classList.toggle("fora", soma !== 100);
  }

  /**
   * Redesenha os controles a partir das preferências.
   * `emEdicao` é o campo que a pessoa está mexendo agora: reescrever o valor
   * dele no meio da digitação move o cursor, e no meio do arraste trava a barra.
   */
  function refletirNaTela(emEdicao = null) {
    for (const input of dialogo.querySelectorAll("input[type=radio]")) {
      input.checked = prefs[input.name] === input.value;
    }

    for (const input of dialogo.querySelectorAll("input[type=number][name]")) {
      if (input === emEdicao) continue;
      const [grupo, campo] = input.name.split(".");
      input.value = prefs[grupo][campo];
    }

    for (const linha of dialogo.querySelectorAll(".pref-macro")) {
      const campo = linha.dataset.campo;
      const pct = prefs.macros[campo];

      const faixa = linha.querySelector('[data-tipo="pct"]');
      const gramas = linha.querySelector('[data-tipo="gramas"]');

      if (faixa !== emEdicao) faixa.value = pct;
      linha.querySelector(".pm-pct").textContent = `${formatarPct(pct)}%`;

      if (gramas !== emEdicao) gramas.value = Math.round(metaEmGramas(campo, prefs));
      // O teto em gramas depende das calorias do dia, que também podem mudar
      gramas.max = Math.round(metaEmGramas(campo, { ...prefs, macros: { [campo]: 100 } }));
    }

    mostrarSoma();
  }

  function aplicar(novas) {
    prefs = sanear(novas);
    salvar(prefs);
    mostrarSoma();
    aoMudar(prefs);
  }

  function aplicarCampo(alvo) {
    if (alvo.type === "radio") {
      aplicar({ ...prefs, [alvo.name]: alvo.value });
      return;
    }

    // Controles de macro: os dois escrevem no mesmo lugar, a porcentagem
    const campo = alvo.dataset?.campo;
    if (campo) {
      if (alvo.value === "") return;

      const pct = alvo.dataset.tipo === "gramas"
        ? pctDeGramas(campo, Number(alvo.value), prefs)
        : Number(alvo.value);

      aplicar({ ...prefs, macros: { ...prefs.macros, [campo]: pct } });
      return;
    }

    if (alvo.type === "number" && alvo.value !== "") {
      const [grupo, campo2] = alvo.name.split(".");
      aplicar({ ...prefs, [grupo]: { ...prefs[grupo], [campo2]: alvo.value } });
    }
  }

  /* Enquanto se arrasta ou digita: aplica e espelha no controle irmão, sem
     tocar no que está sob o cursor. */
  dialogo.addEventListener("input", e => {
    const alvo = e.target;
    if (alvo.type === "number" || alvo.type === "range") {
      aplicarCampo(alvo);
      refletirNaTela(alvo);
    }
  });

  /* `change` é o evento canônico do radio — e é o que tecnologia assistiva e
     mudança programática disparam. No número, é a hora de devolver o valor
     saneado para dentro dos limites, aí sim reescrevendo o campo. */
  dialogo.addEventListener("change", e => {
    aplicarCampo(e.target);
    if (e.target.type === "number") refletirNaTela();
    else refletirNaTela(e.target);
  });

  dialogo.querySelector(".pref-limpar").addEventListener("click", () => {
    aplicar(structuredClone(PADRAO));
    refletirNaTela();
  });

  abrir.addEventListener("click", () => abrirDialogo(dialogo));
  ligarFechamento(dialogo);

  mostrarSoma();

  /* Relê do armazenamento a cada chamada, e não devolve o objeto guardado aqui: o
     mercado ativo é trocado de FORA deste painel (pelo seletor da área de compras),
     e uma cópia em memória ficaria para trás — foi o que aconteceu na primeira
     versão, com a receita mostrando o preço do mercado anterior. O painel continua
     mandando na sua própria cópia enquanto está aberto. */
  return () => {
    prefs = carregar();
    return prefs;
  };
}

export { ROTULOS };
