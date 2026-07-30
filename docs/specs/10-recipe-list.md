# LIS — The recipe list and its filters

`src/js/shop-view.js` and `src/js/shop-filters.js`. `#/comprar` is the index of the site: there
is no sidebar of recipe names, because every card opens its own recipe.

## The list

- **LIS-01** The list must be the home of the site: `#/`, an unknown address and `#/comprar` must
  all land here (SHL-03).
  Tests: "`#/` abre a lista, e não uma receita ao acaso", "endereço desconhecido cai na lista"
- **LIS-02** The list must show one card per recipe, grouped into sections by `grupo` in the order
  of REC-16, each card with a photo, the name linked to the recipe, and the short summary.
  Tests: "vitrine mostra um cartão por receita", "cada cartão tem foto, nome e link para a receita", "cada cartão da lista abre a sua receita"
- **LIS-03** A card must not show cooking time or difficulty: the list answers "how much and how
  much does it cost", and the recipe page answers the rest.
  Tests: "o cartão não fala de tempo nem de dificuldade"
- **LIS-04** A card must put the servings stepper on the left and the price on the right of one
  row, with the add button below, across the card — the price is the consequence of the servings,
  and seeing the number move beside the stepper explains the card without a label.
  Tests: "porções à esquerda, preço à direita, na mesma linha"
- **LIS-05** The stepper must change the servings before adding, and the price must follow it.
  Tests: "o seletor do cartão muda as porções antes de adicionar", "adicionar usa as porções escolhidas no cartão", "mexer nas porções do cartão move o total, não o por porção"
- **LIS-06** Each card must show the recipe's total and its per-portion cost, priced with the
  product chosen in that recipe.
  Tests: "cada cartão mostra o total e o por porção", "o cartão usa o produto escolhido naquela receita"
- **LIS-07** A price that is only a floor must be labelled "a partir de" (PRC-25).
  Tests: "mercado incompleto declara o total como piso"
- **LIS-08** Neither the price nor the stepper may overflow the card: both items of that row must
  be allowed to shrink, and `white-space: nowrap` must not be used to avoid the wrap — that
  guarantees the overflow instead of preventing it.
  Tests: "nada de largura mínima automática nas linhas apertadas"
- **LIS-09** The add button must not rename itself after a click. It says what it does; what
  happened is told by a toast, which carries a link to the cart and clears itself.
  Tests: "o botão não muda de nome; quem confirma é o aviso"
- **LIS-10** The toast stack must live on `<body>` with `role="status"`, so it survives the redraw
  the click causes and so sighted and screen-reader readers get the same information from the same
  place.
- **LIS-11** A toast must last 3200 ms, animate out, and be dismissible by clicking anywhere on it
  other than its link.

## Search

- **LIS-12** The search must match `nome`, `grupo`, `descricaoCurta` and the ingredient names,
  ignoring accents and case. Note that `descricaoCurta` ("Café da tarde") is **not** the `resumo`
  the card displays — see the gaps below.
  Tests: "a busca vive no cabeçalho e filtra a lista", "busca ignora acento e caixa (FEIJAO)", "busca por ingrediente (cenoura)", "estado vazio quando nada casa", "limpar a busca restaura a lista", "campo de busca tem label"
- **LIS-13** The search must live in the header and reach the list as a function, read at draw
  time, so no stale copy of the term can survive between the keystroke and the redraw.
  Tests: "a busca do cabeçalho continua acessível em todas as áreas", "a busca vive no cabeçalho e filtra a lista"
- **LIS-14** Typing while a recipe is open must navigate to the list first — searching is asking
  for a list — and the typed text must remain in the field.
  Tests: "digitar numa receita leva para a lista"

## Filters

- **LIS-15** There must be exactly three filters, each answering a different way of deciding what
  to cook: category (`?grupo=doces,bebidas`), maximum cost per portion (`?ate=3`), and
  availability in the active store (`?aqui=1`).
  Tests: "o painel tem as três peneiras"
- **LIS-16** There must be one checkbox per catalogue group, taken from the whole catalogue and
  not from what is currently on screen: a checkbox that disappears is a checkbox that cannot be
  unticked.
  Tests: "uma caixinha por categoria do catálogo"
- **LIS-17** Categories must add, not intersect: ticking Doces and Bebidas asks for both.
  Tests: "duas categorias somam, não intersectam", "marcar uma categoria filtra os cartões"
- **LIS-18** Each option must show how many recipes it would leave on screen, counting the
  **other** active filters and not its own — counting itself would show zero beside a ticked box,
  exactly when clicking it is the way out.
  Tests: "a contagem de cada categoria bate com o que ela deixaria na tela", "a contagem de uma categoria marcada ignora ela mesma"
- **LIS-19** The cost slider's ceiling must be the highest cost per portion in the **catalogue**,
  not in what is on screen: a bar whose maximum changes with every keystroke is not a bar.
  Tests: "o painel diz o teto em reais"
- **LIS-20** The slider at its maximum must mean no filter, and must remove the parameter from the
  URL — dragging to the end is the gesture of giving up. Storing today's ceiling would make a new,
  more expensive recipe be born filtered out.
  Tests: "a barra no máximo é filtro nenhum"
- **LIS-21** The cost filter must compare against the per-portion figure the card shows, and a
  recipe with no price at all must not pass a price filter — there is nothing to compare.
  Tests: "a barra corta pelo custo por porção"
- **LIS-22** A recipe whose price is only a floor must be compared by that floor, and the panel
  must say so — but only while such a recipe is on screen.
- **LIS-23** "Available here" must mean **no red ingredient**: yellow must not exclude, because
  another product in the store serves and swapping fixes it. Excluding on yellow would hide
  recipes the store can supply.
  Tests: "marcar a disponibilidade esconde as receitas que o mercado não completa", "amarelo não elimina: quem tem produto no mercado continua na lista", "a contagem da disponibilidade bate com as receitas inteiras no mercado"
- **LIS-24** The availability filter must exist only with an active store; without one the panel
  must say why instead of showing a control that does nothing.
  Tests: "com mercado ativo aparece a peneira de disponibilidade", "sem mercado, o parâmetro de disponibilidade não peneira nada"
- **LIS-25** The panel must say how many recipes the active store cannot complete, or that it
  supplies everything on screen.
  Tests: "o painel conta quantas receitas o mercado deixa de fora"
- **LIS-26** Filter state must live in the URL, not in a variable and not in `localStorage`: it
  must survive the full redraw a store change causes, be shareable, and be gone tomorrow — a
  filter is not a preference.
  Tests: "os filtros da URL valem no primeiro desenho", "trocar de mercado preserva os filtros"
- **LIS-27** Writing filters to the URL must use `replaceState`: ticking a box is not a step of
  the Back button.
  Tests: "voltar para a área pelo cabeçalho zera os filtros"
- **LIS-28** An invalid category in the URL must be ignored in silence — the address is typeable,
  and a stale parameter must not empty the list.
  Tests: "categoria que não existe é ignorada em silêncio"
- **LIS-29** A "Limpar" button must appear only while something is filtered, and must clear
  everything.
  Tests: "o botão limpar devolve a lista inteira"
- **LIS-30** The heading must say how many recipes are showing and which sieves are on — the
  search, the filters, or both.
  Tests: "a contagem de cada categoria bate com o que ela deixaria na tela"
- **LIS-31** When the screen empties, the message must name **which** sieve emptied it, and offer
  the way out in place: "nenhuma receita encontrada" after ticking a box sends the reader to look
  in the wrong place.
  Tests: "filtro apertado demais explica que a peneira é o filtro, não a busca", "estado vazio quando nada casa"
- **LIS-32** Every filter change must redraw the whole area: the counts, the heading and the grid
  all depend on the same result, and recalculating is shorter and safer than stitching three
  partial updates.
  Tests: "marcar uma categoria filtra os cartões", "duas categorias somam, não intersectam"
- **LIS-33** The measurement of each recipe must be memoised per recipe and per store, and
  forgotten when the list is redrawn, because a product chosen inside a recipe changes its cost.

## The panel's place on screen

- **LIS-34** On the desktop the panel must be a rail fixed to the left edge, below the header, the
  full height of the window, with its own scroll, no card frame of its own, and its first heading
  aligned with the page's first heading.
  Tests: "no computador a faixa de filtros encosta na borda esquerda"
- **LIS-35** The space for the rail must be opened by `body[data-area="comprar"] main` with
  `padding-left`, not by a margin on the centred column — a fixed left margin would kill the
  centring — and keyed off the area attribute, so the recipe page, the cart and the sheet do not
  inherit an empty gutter.
  Tests: "a faixa só existe na lista, e o atributo da área diz quando"
- **LIS-36** Below 1080 px the rail must return to the flow between the heading and the cards and
  become a drawer, because at 1000 px a 236 px column beside the cards leaves the grid one and a
  half cards wide.
  Tests: "em tela média a faixa volta ao fluxo e vira gaveta"
- **LIS-37** The drawer must be a button plus an attribute, never a `<details>`: on the desktop the
  panel is always open with no button, and a closed `<details>` cannot be opened by CSS — the
  browser hides its content internally, out of reach of the stylesheet.
  Tests: "a gaveta abre e fecha por atributo, não por details"
- **LIS-38** The drawer's button must count the filters that are on, counting all the categories
  as one: ticking three is a single decision, and "3 filtros" would read as three sieves in
  series.
  Tests: "o botão da gaveta conta os filtros ligados"
- **LIS-39** The drawer must start open when a filter is already on: the screen is showing fewer
  recipes than exist, and hiding the reason is a trap.
- **LIS-40** The DOM order must be the mobile order — heading, filters, recipes — because on the
  desktop the panel leaves the flow and needs no CSS reordering, and a screen reader then hears
  the page in the order it is read.
- **LIS-41** The rail must not be printed, and the padding that made room for it must be reset in
  print.
  Tests: "no computador a faixa de filtros encosta na borda esquerda"

## Known gaps

- The search reads `descricaoCurta` while the card shows `resumo` (LIS-02, LIS-12): a reader who
  searches for words visible on the card may find nothing. Either the search should read both, or
  the card should show what the search reads.
- LIS-10, LIS-11, LIS-22, LIS-33, LIS-39 and LIS-40 have no test.
- The wording of the counts and of the cost caption (LIS-18, LIS-19) is asserted only for the
  ceiling in reais, not for the sentences.
- The clear button inside the empty state and the one in the panel are covered by the same test;
  the panel's own button has no separate check.
