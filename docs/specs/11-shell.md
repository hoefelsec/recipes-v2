# SHL — Shell: routing, header, accessibility, CSS discipline

`src/js/router.js`, `src/js/header.js`, `src/js/app.js`, `index.html`, and the CSS rules the
suite enforces.

## Routing

- **SHL-01** There must be exactly four areas — `receita`, `comprar`, `carrinho`, `lista` —
  addressed as `#/receita/<slug>`, `#/comprar`, `#/carrinho`, `#/lista`.
- **SHL-02** The hash must be sanitised: leading `#/` stripped, path split from query at the
  first `?`, empty segments dropped, each segment percent-decoded.
- **SHL-03** Any unrecognised first segment — including the empty hash and `#/` — must fall back
  to `comprar`. Landing on a random dish is not landing anywhere; the list is where one
  navigates from.
  Tests: "`#/` abre a lista, e não uma receita ao acaso", "hash inválido cai na lista"
- **SHL-04** An unknown recipe slug must fall back to the first recipe rather than a blank page.
  Tests: "receita inexistente cai na primeira"
- **SHL-05** The known parameters must be `porcoes` (recipe), `passo` (cart), `imprimir` (sheet)
  and the three filter parameters of LIS-15. Validation belongs to whoever reads them, not to the
  router.
  Tests: "URL guarda as porções", "porções inválidas na URL são corrigidas na própria URL", "voltar ao padrão limpa o parâmetro da URL"
- **SHL-06** Arriving at the address one is already at must redraw nothing — that is how the
  sheet once opened the print dialog twice.
- **SHL-07** The record of the last delivered route must live in the router, beside the function
  that rewrites the URL without navigating. While it lived in the app, filtering and then
  clicking "Receitas" hit a signature the stale record claimed to have delivered, and the click
  was refused as "already here": clean URL, filtered screen.
  Tests: "voltar para a área pelo cabeçalho zera os filtros", "voltar para a receita ainda funciona"
- **SHL-08** State that describes the current screen — servings, filters — must be written with
  `replaceState`, which creates no history step and fires no `hashchange`; navigation between
  screens must be by link.
  Tests: "voltar ao padrão limpa o parâmetro da URL", "o passo vive na URL, e o padrão é o primeiro"
- **SHL-09** Each area must return a `destruir()` that detaches its listeners on the way out.
  Without it the list's handler would answer clicks in the cart, and each visit would add another
  — making one click count twice.
- **SHL-10** A store change must redraw the current area without going through the router, which
  correctly refuses the same route.
  Tests: "trocar de mercado é lembrado e muda os números"
- **SHL-11** Changing area must scroll to the top and move focus into the content — except on the
  first load, which must neither scroll nor steal focus.

## The header

- **SHL-12** There must be exactly one header, and it must be the only navigation: the brand on
  the left, then search, store, preferences and the two area links on the right. There is no
  sidebar — the recipe list is the index, and a second index beside it would be the same list
  written twice.
  Tests: "o cabeçalho é um só, com marca à esquerda e ações à direita", "não há menu lateral: a lista de receitas é o índice"
- **SHL-13** The header's children must be, in order, the brand, the group of things one types
  into (search, store) and the group of things one points at (preferences, areas). The cut falls
  there because on a phone only the first group drops to a second row.
  Tests: "o cabeçalho é um só, com marca à esquerda e ações à direita"
- **SHL-14** There must be exactly two area links, to the list and to the cart, and nothing else.
  Tests: "navegação tem duas portas: a lista e o carrinho"
- **SHL-15** The current area must be marked with `aria-current="page"`; the sheet must count as
  the cart, and a recipe must count as the list — that is where the reader came from and where
  the link returns.
  Tests: "a seção atual fica marcada", "a lista conta como seção do carrinho", "na receita, a seção da lista continua marcada"
- **SHL-16** The search field and the preferences button must be reachable from every area,
  including a recipe page.
  Tests: "a busca do cabeçalho continua acessível em todas as áreas"
- **SHL-17** The store selector must live in the header, be built once, and be remembered across
  visits; changing it must change prices, offers and totals everywhere on the site.
  Tests: "o seletor de mercado está no cabeçalho das compras", "trocar de mercado é lembrado e muda os números", "voltar para todos os mercados desfaz os avisos"
- **SHL-18** "Todos os mercados" must mean no filter — compare rather than buy — and must be the
  first option.
  Tests: "sem mercado, o preço é o mais barato entre todos"
- **SHL-19** The store selector's arrow must be drawn by the site, not by the browser: in a pill,
  the native arrow touches the curve of the border and no padding reaches it, because it is
  painted outside the content box.
  Tests: "a seta do seletor de mercado é desenhada por nós"
- **SHL-20** The cart badge must follow the cart from wherever it changed.
  Tests: "o badge do cabeçalho acompanha o carrinho"
- **SHL-21** The brand must be what pushes everything else to the right, with `margin-right:
  auto` — not a spacer element and not a fixed width.
  Tests: "no cabeçalho, quem empurra é a marca"
- **SHL-22** The search must grow into the free space of the bar, up to a ceiling, from 861 px
  upward — and must not grow below that, where the same row carries the store, the gear and two
  icons: there the field must yield. A growing field with a minimum pushed its neighbours 74 px
  off the left of a 430 px screen.
  Tests: "a busca ocupa a folga do cabeçalho — mas só onde há folga"
- **SHL-23** Below 861 px the search and the store must drop to their own row and share it in
  equal halves, and the store logo must give way to the store's name. The automatic minimum of a
  `<select>` is the text of its longest option, so without this the search collapsed to 26 px.
  Tests: "no celular, busca e mercado descem para a própria fileira e repartem"
- **SHL-24** The header's height must be declared once as a token, and every element that
  positions itself from it — the header, `<main>`, the filter rail — must use that token. A height
  nobody knows is a height the three of them disagree about.
  Tests: "a altura do cabeçalho é declarada, e os três a usam"

## Accessibility

- **SHL-25** There must be a skip link to the content as the first focusable element, and an
  icon-only link must carry both a screen-reader name and a hover title — without the hidden text
  a screen reader announces "link" and nothing else.
  Tests: "skip link presente e aponta para o main", "os atalhos do cabeçalho têm nome para leitor de tela"
- **SHL-26** Data-derived text must be escaped before it is written as HTML.
  Tests: "texto de dados é escapado (sem injeção de HTML)"
- **SHL-27** Every external link must carry `rel` containing `noopener`.
  Tests: "nenhum link externo sem rel=noopener"
- **SHL-28** A dialog must be opened with the native `showModal()` when available and by an
  attribute otherwise; it must close on its buttons and on the backdrop, and in the fallback path
  also on `Escape`. Opening an already-open dialog must be a no-op, because `showModal()` throws
  in that state.
  Tests: "fecha pelo botão", "fecha clicando no fundo escuro"
- **SHL-29** Listeners attached to the fixed dialogs of `index.html` or to `document` must be
  registered under an abort signal and released on `destruir()`.
- **SHL-30** Announcements must go through `aria-live="polite"` regions — the servings output, the
  conversion announcement, the macro sum — and the toast must be `role="status"`.
  Tests: "botões existem, com rótulo acessível e aria-live no valor"
- **SHL-31** Every stepper must be a `role="group"` with an accessible name, buttons labelled
  "Diminuir…"/"Aumentar…", and `disabled` at the limits.
  Tests: "botões existem, com rótulo acessível e aria-live no valor", "botão − desativa no mínimo", "botão + desativa no máximo"

## CSS discipline

These rules exist because jsdom applies the cascade but performs no layout, so a selector that
matches the wrong element passes every functional test. Each one is a fence around a defect that
actually shipped.

- **SHL-32** No class may be used both as a component and as a modifier. `.aviso` was the toast
  (dark background, flex, shadow, animation) and became the yellow row state; the row inherited
  layout, shadow and `color: #fff`, which erased the number inside its stepper. A state is an
  adjective, a component is a noun, and the same word cannot be both.
  Tests: "nenhuma classe é componente e modificador ao mesmo tempo"
- **SHL-33** `:nth-of-type` must not be hung off a class. It counts by **tag** among siblings, so
  `.cart-controle:nth-of-type(1)` matched nothing and `(2)` matched the servings stepper. Position
  must be expressed by a class of its own.
  Tests: "nenhum `:nth-of-type` pendurado numa classe"
- **SHL-34** A flex item in a tight row must be allowed to shrink below its content: the automatic
  minimum of a flex item is its content's size, so a long number pushes the row out of the card
  instead of squeezing its neighbour. `white-space: nowrap` added to avoid the wrap guarantees the
  overflow.
  Tests: "nada de largura mínima automática nas linhas apertadas"
- **SHL-35** On a phone each stepper of a cart row must occupy its own grid area, addressed by its
  own class.
  Tests: "no celular, cada stepper do carrinho tem sua própria área"
- **SHL-36** A bare element selector must not carry a positioning declaration
  (`position`, `inset`, `flex`). `aside { position: fixed }` was written for the sidebar and
  then caught every future `<aside>`, the filter rail included. `main` is the exception: the
  specification allows one per document.
  Tests: "nenhum seletor de elemento solto e posicionador no CSS", "nenhum <aside> é posicionado por seletor de elemento"
- **SHL-37** A universal `margin: 0` reset must give `<dialog>` its `margin: auto` back: the
  browser centres a modal dialog with that margin, and zeroing it pins the dialog to the top
  left corner.
  Tests: "quem zera margem no universal devolve a de <dialog>"
- **SHL-38** A descendant selector must not be used where a child selector is meant: a product's
  brand inside a sheet line matched the recipe block's own rule and took its layout with it.
  Tests: "a marca do produto não rouba a regra de bloco das receitas"
- **SHL-39** A control with no label of its own must compensate for the label its neighbours have,
  with a margin built from the same tokens as that label — a grid centres the margin box, which is
  how "Excluir" came to sit 10,5 px above the steppers beside it.
  Tests: "\"Excluir\" compensa o rótulo que não tem"
- **SHL-40** Visual changes must be verified in a real browser. jsdom will not report a rail that
  overlaps the content, a field 26 px wide or an arrow touching a border.

## Known gaps

- SHL-01, SHL-02, SHL-06, SHL-09, SHL-11 and SHL-29 have no automated test. SHL-40 cannot have
  one by definition — that is the point of it.
- No test feeds a percent-encoded or multi-slash hash (SHL-02).
- The recipe area returning `slug: null` for the other three areas is untested.
