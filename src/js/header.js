/* O cabeçalho: a única navegação do site.
 *
 * Não há menu lateral. A lista de compras (`#/comprar`) JÁ é o índice de receitas —
 * cada cartão abre a sua — e um segundo índice ao lado dela seria a mesma lista
 * escrita duas vezes, com duas maneiras de ficar fora de sincronia.
 *
 * O que sobrou aqui é o que um cabeçalho faz: dizer onde você está, para onde pode
 * ir, e guardar os dois controles que valem em qualquer tela (mercado e
 * preferências). A busca ficou junto porque, sem lista lateral, ela é o atalho para
 * uma receita específica de qualquer lugar do site.
 */

import { receitas } from "../data/index.js";
import { $, normalizar } from "./dom.js";

/** Destaca a seção atual. A folha impressa é o fim do carrinho, não outra seção. */
export function marcarArea(area) {
  for (const link of document.querySelectorAll(".area-link")) {
    /* Só há dois itens de menu: Receitas e Carrinho. A folha de compras (#/lista) é
       o fim do fluxo do carrinho, então acende "Carrinho"; a página da receita
       acende "Receitas", de onde se veio e para onde se volta. */
    const desta = link.dataset.area === area
      || (area === "receita" && link.dataset.area === "comprar")
      || (area === "lista" && link.dataset.area === "carrinho");

    if (desta) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.body.dataset.area = area;
}

/**
 * As receitas que casam com o termo, por nome, grupo, descrição ou ingrediente.
 *
 * Vive aqui e não na vitrine porque quem digita é o cabeçalho; a vitrine só pergunta
 * "o que mostro?". Termo vazio devolve tudo — e não uma lista vazia, que é o que um
 * filtro ingênuo faria.
 */
export function filtrar(termoBruto = "") {
  const termo = normalizar(termoBruto.trim());
  if (!termo) return receitas;

  return receitas.filter(r =>
    normalizar(r.nome).includes(termo) ||
    normalizar(r.grupo).includes(termo) ||
    normalizar(r.descricaoCurta).includes(termo) ||
    r.ingredientes.some(i => normalizar(i.item || "").includes(termo))
  );
}

/** O que está escrito na busca agora. */
export const termoDaBusca = () => $("#busca")?.value ?? "";

/**
 * Liga a busca.
 *
 * `aoBuscar` é chamado a cada tecla, e quem responde é a vitrine. Estando numa
 * receita, digitar leva para a vitrine primeiro: buscar é pedir uma lista, e a
 * receita aberta não tem onde mostrá-la.
 */
export function iniciarCabecalho({ aoBuscar, irParaLista }) {
  $("#busca").addEventListener("input", e => {
    if (document.body.dataset.area === "receita" && e.target.value.trim()) {
      irParaLista();
      // A área nova redesenha e o campo continua com o texto: só o foco volta
      $("#busca").focus();
    }
    aoBuscar(e.target.value);
  });
}
