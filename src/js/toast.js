/* Aviso passageiro: "adicionado ao carrinho", e o que mais precisar dizer sem
   interromper.

   Por que não confirmar no próprio botão: renomear "Adicionar ao carrinho" para
   "Adicionado" faz o controle contar a história do último clique em vez de dizer o
   que ele faz. Quem chega no meio dos 1,6 s lê um botão que não existe, e quem quer
   adicionar duas vezes fica sem saber se pode. O botão volta a ser sempre o mesmo
   botão; quem conta o que aconteceu é o aviso.

   Ele vive no `<body>`, e não na área: a área se redesenha a cada clique, e o aviso
   tem de sobreviver ao redesenho. */

import { esc } from "./dom.js";

/** Quanto tempo o aviso fica. Curto o bastante para não atrapalhar, longo o
    bastante para uma frase de mercado ser lida sem pressa. */
const DURACAO = 3200;

/* `role="status"` já implica `aria-live="polite"`: o leitor de tela anuncia sem
   cortar o que estiver falando. É o mesmo papel que a região `sr-only` fazia
   antes — agora quem vê e quem ouve recebem a mesma informação, do mesmo lugar. */
function pilha() {
  let el = document.getElementById("avisos");
  if (el) return el;

  el = document.createElement("div");
  el.id = "avisos";
  el.className = "avisos";
  el.setAttribute("role", "status");
  document.body.appendChild(el);
  return el;
}

/**
 * Mostra um aviso.
 *
 * `acao` é opcional: um link para onde o aviso levaria — "ver carrinho" depois de
 * adicionar. Sem ele, o aviso é só texto.
 */
export function avisar(texto, acao = null) {
  const el = document.createElement("p");
  el.className = "aviso";
  el.innerHTML = `<span>${esc(texto)}</span>${
    acao ? `<a href="${esc(acao.url)}">${esc(acao.texto)}</a>` : ""}`;

  pilha().appendChild(el);

  /* Sair também é animado, e o elemento só some depois. Remover na hora deixaria
     os avisos abaixo saltando para cima. */
  const sair = () => {
    el.classList.add("saindo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);   // se a animação não rodar
  };

  setTimeout(sair, DURACAO);

  // Clicar no aviso o dispensa: ele nunca fica no caminho por teimosia
  el.addEventListener("click", e => {
    if (!e.target.closest("a")) sair();
  });

  return el;
}
