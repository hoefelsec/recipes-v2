/* Pedaços de interface usados em mais de uma tela. */

import { esc } from "./dom.js";
import { textoCusto } from "./pricing.js";
import { mercados, mercado as porId } from "../data/mercados.js";
import { TODOS_OS_MERCADOS } from "./settings.js";

/**
 * Seletor − valor + genérico.
 * `dados` vira atributos data-* nos botões, para o delegador de eventos saber
 * a que linha o clique pertence.
 */
export function stepperHTML({ valor, unidade = "", min, max, passo = 1, rotulo, dados = {}, classe = "" }) {
  const attrs = Object.entries(dados)
    .map(([k, v]) => `data-${k}="${esc(String(v))}"`)
    .join(" ");

  const botao = (delta, texto, rotuloBotao, desativado) => `
    <button type="button" class="pbtn" data-delta="${delta}" ${attrs}
            aria-label="${esc(rotuloBotao)}" ${desativado ? "disabled" : ""}>${texto}</button>`;

  return `
    <div class="porcoes ${classe}" role="group" aria-label="${esc(rotulo)}">
      ${botao(-passo, "−", `Diminuir ${rotulo.toLowerCase()}`, valor <= min)}
      <output class="pval" aria-live="polite">${esc(String(valor))}${unidade ? ` <span>${esc(unidade)}</span>` : ""}</output>
      ${botao(passo, "+", `Aumentar ${rotulo.toLowerCase()}`, valor >= max)}
    </div>`;
}

/** Imagem com degradê de reserva, igual à do topo da receita. */
export function fotoHTML(receita, { classe = "", tamanho = 600 } = {}) {
  const src = (receita.imagem?.src || "").replace(/w=\d+/, `w=${tamanho}`);
  return `<img class="${classe}" src="${esc(src)}" alt="${esc(receita.imagem?.alt || receita.nome)}"
               loading="lazy" onerror="this.onerror=null;this.classList.add('sem-foto');this.removeAttribute('src')">`;
}

/** "8 pessoas" / "1 pessoa" */
export function textoPorcoes(receita, porcoes) {
  const un = porcoes === 1 && receita.porcoes.unidadeSingular
    ? receita.porcoes.unidadeSingular
    : receita.porcoes.unidade;
  return `${porcoes} ${un}`;
}

export const unidadePorcao = (receita, porcoes) =>
  porcoes === 1 && receita.porcoes.unidadeSingular
    ? receita.porcoes.unidadeSingular
    : receita.porcoes.unidade;

/**
 * O par de preços de uma receita: o total e o por porção.
 *
 * As duas telas que mostram receitas — vitrine e carrinho — precisam da mesma
 * frase, e ela tem uma sutileza: quando algum ingrediente não entrou na conta, o
 * número é um piso, não o preço. Dizer "a partir de" custa três palavras e evita
 * afirmar o que não se sabe.
 */
export function precoDaReceita({ total, porPorcao, completa, deFora = [] }, unidade) {
  const titulo = completa
    ? "Estimativa pelos produtos escolhidos"
    : `Fora da conta: ${deFora.map(x => `${x.nome} (${x.motivo})`).join(", ")}`;

  return `
    <p class="receita-preco" title="${esc(titulo)}">
      ${completa ? "" : `<span class="receita-preco-piso">a partir de</span> `}
      <b>${esc(textoCusto(total))}</b>
      <span class="receita-preco-porcao">${esc(textoCusto(porPorcao))} por ${esc(unidade)}</span>
    </p>`;
}

/**
 * O seletor de mercado, no cabeçalho do site.
 *
 * `<select>` nativo e não uma lista customizada: o teclado, o toque e o leitor de
 * tela já sabem lidar com ele, e a lista tem três itens — não há o que ganhar
 * reescrevendo isso. O logo do mercado ativo aparece ao lado, que é o que o campo
 * `logo` existe para fazer.
 *
 * "Todos os mercados" é uma escolha, não um estado vazio: é comparar preços em vez
 * de fazer uma compra, e era o único jeito de o site funcionar até agora.
 *
 * Uma linha só, e o rótulo só para leitor de tela: no cabeçalho o espaço é
 * horizontal, e a nota explicativa que existia embaixo ("bom para comparar") virou
 * o `title` do campo — ela ajudava a primeira vez e atrapalhava todas as outras.
 */
export function seletorDeMercado(ativo) {
  const m = ativo ? porId(ativo) : null;

  const dica = m
    ? `Preços e produtos do ${m.nome}`
    : "O mais barato entre todos os mercados — bom para comparar";

  return `
    <div class="mercado-seletor" title="${esc(dica)}">
      <label class="sr-only" for="mercado-ativo">Comprar em</label>

      ${m ? `<img class="mercado-logo" src="${esc(m.logo)}" alt=""
                  onerror="this.remove()">` : ""}

      <select id="mercado-ativo" data-mercado>
        <option value="${TODOS_OS_MERCADOS}"${!ativo ? " selected" : ""}>Todos os mercados</option>
        ${mercados().map(x => `
          <option value="${esc(x.id)}"${x.id === ativo ? " selected" : ""}>${esc(x.nome)}</option>`).join("")}
      </select>
    </div>`;
}
