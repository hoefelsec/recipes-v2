/* Utilitários pequenos de DOM e texto. */

export const $ = sel => document.querySelector(sel);

/** Escapa texto antes de injetar no HTML. */
export function esc(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normaliza para busca: minúsculas e sem acentos. */
export function normalizar(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Um `AbortController` do mesmo "reino" do documento.
 *
 * `addEventListener` recusa um sinal vindo de outro contexto de execução, e no
 * jsdom o `AbortController` global é o do Node, não o da janela simulada. Pegar
 * o da janela faz o mesmo código servir no navegador e nos testes.
 */
export const controleDeVida = () =>
  new (document.defaultView?.AbortController ?? AbortController)();

/* ----------------------------------------------------------------- diálogos */

/* `<dialog>` nativo dá foco, Esc e fundo escuro de graça. Onde não existe, o
   plano B é o atributo `open` — e aí o fechar também precisa ser manual, senão
   a janela abre e não sai mais. */

export const dialogoNativo = dlg => typeof dlg?.showModal === "function";

export function abrirDialogo(dlg) {
  if (!dlg) return;
  // `showModal()` num diálogo já aberto lança InvalidStateError
  if (dlg.open || dlg.hasAttribute("open")) return;

  if (dialogoNativo(dlg)) dlg.showModal();
  else dlg.setAttribute("open", "");
}

export function fecharDialogo(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

/**
 * Liga o fechamento de um diálogo: botões de fechar, clique no fundo e Esc.
 * Sem `<dialog>` nativo, `<form method="dialog">` não fecha nada — daí o
 * preventDefault, que evita a página recarregar no lugar.
 *
 * `opcoes` vai direto para o `addEventListener` — é por onde entra o `signal`
 * que desliga tudo quando a página sai do ar. Os diálogos são elementos fixos do
 * index.html: sem isso, cada visita à receita deixaria mais um ouvinte neles.
 */
export function ligarFechamento(dlg, seletorBotoes = ".pref-fechar, .pref-ok", opcoes = {}) {
  if (!dlg) return;

  dlg.addEventListener("click", e => {
    if (e.target === dlg) { fecharDialogo(dlg); return; }         // fundo escuro
    if (e.target.closest(seletorBotoes)) {
      if (!dialogoNativo(dlg)) e.preventDefault();
      fecharDialogo(dlg);
    }
  }, opcoes);

  if (!dialogoNativo(dlg)) {
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && dlg.hasAttribute("open")) fecharDialogo(dlg);
    }, opcoes);
  }
}

/** Imagem de reserva, usada se a foto da receita não carregar. */
export const IMAGEM_RESERVA =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#D9A57F"/><stop offset="1" stop-color="#A34F31"/>
       </linearGradient></defs>
       <rect width="1200" height="600" fill="url(#g)"/>
     </svg>`
  );
