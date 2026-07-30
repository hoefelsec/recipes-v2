# CHO — Choosing a product

`src/js/choices.js` (state) and `src/js/product-picker.js` (the dialog). The reader may replace
the site's automatic pick with a specific package, per recipe or for the whole purchase.

## Storage and scope

- **CHO-01** Choices must be stored under `"receitas:produtos"` as a two-level map
  `{ [slug]: { [ingId]: produtoId } }` — the choice is **per recipe**, so the same ingredient may
  resolve to different products in different recipes.
  Tests: "a escolha é por receita, não por ingrediente", "a escolha sobrevive a recarregar a página"
- **CHO-02** The cart's own scope must be the pseudo-slug `":carrinho"` inside the same map, with
  the same sanitisation. The leading colon guarantees no recipe slug can collide with it.
  Tests: "o escopo do carrinho não colide com slug de receita"
- **CHO-03** The recents list must be stored under `"receitas:recentes"`, the remembered sort
  order under `"receitas:ordem-produtos"`, and the "already have it" set under
  `"receitas:tenho"`.
  Tests: "trocar a ordenação reordena sem fechar a janela"
- **CHO-04** An unusable or corrupt store must be survived in silence: reading falls back to
  empty, writing is swallowed, and the session continues unsaved.

## Sanitisation

- **CHO-05** On load, a choice must be discarded when: the root or a per-slug value is not an
  object; the ingredient no longer exists; the product no longer exists; or the product does not
  serve that ingredient. A slug left with no surviving entry must disappear from the map.
  Tests: "escolha válida sobrevive", "produto que saiu do catálogo é descartado", "ingrediente que saiu do catálogo é descartado", "produto de OUTRO ingrediente é descartado", "lixo no lugar do objeto não derruba nada", "receita que ficou sem nenhuma escolha sai do mapa"
- **CHO-06** "Serves" must be the subtree rule: a subtype's product is kept for a request for
  the parent; a sibling's product is discarded.
  Tests: "produto de subtipo serve ao pai, mas não ao irmão"
- **CHO-07** The same test must be applied on **write**: a product that does not serve must not
  be recorded, and must instead clear whatever was there.
  Tests: "produto do ingrediente errado não é gravado"
- **CHO-08** Choosing `null` must mean "back to automatic": the entry is deleted, and it must
  **not** count as using a product — returning to automatic is not a use.
  Tests: "escolher null volta ao automático", "voltar ao automático não conta como uso", "voltar ao automático desfaz tudo"

## Recents and order

- **CHO-09** The recents list must be global, not per recipe — "I used this recently" is a fact
  about the cook's pantry — most recent first, without repetition, capped at `MAX_RECENTES = 40`,
  and must ignore products that no longer exist.
  Tests: "os recém-usados guardam a ordem, sem repetir", "a lista de recentes tem teto"
- **CHO-10** There must be exactly four sort orders — `recentes` ("Usados há pouco"), `nome`,
  `embalagem` ("Preço da embalagem"), `unitario` ("Preço por medida") — with `recentes` as the
  default.
  Tests: "o padrão é \"usados há pouco\""
- **CHO-11** The chosen order must be remembered, and any unknown stored value must fall back to
  the default.
  Tests: "ordenação escolhida é lembrada, e valor inválido cai no padrão"
- **CHO-12** The orders must mean: `nome` alphabetical pt-BR; `embalagem` by ascending package
  price; `unitario` by ascending shelf price; `recentes` by recency, tie-broken by shelf price —
  so with no history the list opens in exactly the order the site would pick by itself.
  Tests: "por nome, em português", "por preço da embalagem: o pacote menor primeiro", "por preço de medida: o quilo mais barato primeiro", "com histórico, o usado há pouco vem primeiro", "sem histórico, a lista abre na ordem do automático (mais barato por medida)", "ordem desconhecida não quebra: cai no padrão"
- **CHO-13** The two price orders must be allowed to disagree — the small pack is cheaper at the
  till and dearer per kilo — because that disagreement is the reason both exist.
  Tests: "as duas ordenações de preço discordam, e é esse o ponto"
- **CHO-14** Whatever the order, a product already going into the bag for another recipe must
  come first: it is a warning, not a ranking.
  Tests: "a janela destaca o produto que já vai na sacola por outra receita"

## The dialog

- **CHO-15** The ingredient's name must be a button that opens the dialog only when the
  ingredient actually has a serving product; otherwise it must be plain text.
  Tests: "o nome do ingrediente é um botão quando há produto", "ingrediente sem produto no catálogo não é clicável", "o que se assume ter em casa não pede escolha"
- **CHO-16** The dialog must be titled with the ingredient's catalogue name.
  Tests: "a janela abre com o nome do ingrediente no título"
- **CHO-17** The dialog must offer the products of the requested subtree, and only those,
  restricted to the active store.
  Tests: "pedindo o pai, a janela mostra os produtos de todos os subtipos", "pedindo o subtipo, a janela do carrinho também se restringe"
- **CHO-18** The first entry must be "Deixar o site escolher", naming today's automatic pick, and
  it must be the marked one exactly when there is no stored choice.
  Tests: "a primeira opção é voltar ao automático, e começa marcada", "a escolha fica marcada quando a janela reabre"
- **CHO-19** Each option must be a `role="menuitemradio"` showing brand, package size, package
  price and shelf price, with `aria-checked` on the chosen one.
  Tests: "lista os quatro números de cada produto", "cada linha diz o produto, o quanto precisa, as embalagens e o preço"
- **CHO-20** Exactly three badges may appear, in this order: "já no carrinho", "mais barato",
  "usado por último". The cheapest badge must be driven by the caller's automatic pick, and only
  one option may carry it; the automatic entry carries no badge, because it is not a product.
  Tests: "o mais barato leva selo, e só ele"
- **CHO-21** In the recipe context the highlighted figure must be the cost of this line and the
  caption "nesta receita"; in the cart context it must be the cost of the whole packages and the
  caption must count them — at the till two products can cost the same per kilo while one makes
  you carry 5 kg.
  Tests: "no carrinho, a janela mostra embalagens em vez do custo da receita", "lista os quatro números de cada produto", "trocar o produto no carrinho muda os dois totais"
- **CHO-22** The help sentence and the closing note must differ by context: the recipe says
  choosing changes this line's price, the recipe total and the nutrients, which then come from a
  label; the cart says it changes how many packages you carry and the purchase total, and that
  the choice holds for the whole purchase because one pot goes into the bag.
  Tests: "a janela do passo 2 diz quem pede e quanto", "a nota da janela fala da compra, não do rótulo", "clicar num produto abre a janela, com o pedido somado"
- **CHO-23** When the stored choice is not in the offered list, the dialog must say so —
  "não é vendido neste mercado… ou volte para todos os mercados para mantê-lo" — rather than
  showing a list with nothing marked.
  Tests: "a janela só oferece o que o mercado vende, e diz que a escolha ficou fora"
- **CHO-24** When the list is empty, the dialog must say that no product of this ingredient is
  sold in this store.
- **CHO-25** Choosing must redraw the list and move focus to the newly marked option, because the
  list was rebuilt and took the focused button with it.
  Tests: "escolher troca o nome, o preço e o total", "escolher ali muda o preço da linha e o total da receita", "escolher no carrinho grava e marca a linha", "clicar no produto abre a janela para aquela receita", "a escolha feita na receita aparece no carrinho"
- **CHO-26** Changing the sort order must reorder in place, persist the choice, and keep the
  dialog open with focus back on the selector.
  Tests: "trocar a ordenação reordena sem fechar a janela"
- **CHO-27** The list must support arrow-key navigation with wrap-around over all options,
  including the automatic entry.
- **CHO-28** Closing must return focus to the element that opened the dialog.
  Tests: "fechar devolve o foco para o nome do ingrediente"
- **CHO-29** The dialog must be bound once, with every listener registered under an abort signal:
  the dialogs are fixed elements of the page, so each visit would otherwise leave another
  listener on them.
- **CHO-30** An open dialog must be redrawn when something outside it changes; a closed one must
  not be touched.

## Effects of a choice

- **CHO-31** A chosen product must replace the displayed name while keeping the recipe's
  preparation in a parenthetical — "Carne Seca Dianteiro (dessalgada)" — and must show the brand.
  Tests: "o preparo da receita não se perde: desce para o parêntese", "escolher troca o nome, o preço e o total"
- **CHO-32** A choice must change the line's cost, the recipe total and the per-portion figure
  together.
  Tests: "o custo da linha passa a ser o do produto escolhido", "o total e o por porção acompanham"
- **CHO-33** A choice must make the nutrients come from the label, and the screen must say so.
  Tests: "o rótulo do produto entra nos nutrientes", "os nutrientes avisam quando vêm de um rótulo"
- **CHO-34** A choice must survive a page reload.
  Tests: "a escolha sobrevive a recarregar a página"

## Known gaps

- CHO-04, CHO-24, CHO-27, CHO-29 and CHO-30 have no test; arrow-key navigation is the largest
  untested interaction in the file.
- "a lista de recentes tem teto" pushes the **same** id fifty times, so it proves de-duplication
  and not the cap of 40 (CHO-09).
- The "usado por último" badge and its three-way guard are untested (CHO-20), as are the `"???"`
  fallback and the singular/plural of the package caption (CHO-21).
- Focus landing on the marked option after a click (CHO-25) and returning to the selector after
  a sort change (CHO-26) are asserted for neither.
- "Back to defaults" clears choices, recents and the pantry set but deliberately keeps the
  remembered sort order — untested.
