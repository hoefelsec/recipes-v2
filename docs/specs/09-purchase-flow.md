# BUY — Cart, purchase and the three steps

`src/js/cart.js` (state), `src/js/shopping-list.js` (aggregation),
`src/js/purchase.js` (packages and totals), `src/js/cart-view.js` (steps 1 and 2),
`src/js/list-view.js` (step 3).

## The cart

- **BUY-01** A cart line must be identified by the pair recipe + servings, and by nothing else:
  the same recipe at 8 and at 16 servings is two lines.
  Tests: "porções diferentes viram linhas separadas", "receitas diferentes viram linhas separadas", "mostra uma linha por combinação receita+porções"
- **BUY-02** Adding a recipe that already exists at those servings must increase that line's
  count rather than append a second line.
  Tests: "mesma receita e mesmas porções agrupam numa linha", "adicionar de novo agrupa"
- **BUY-03** Servings must be normalised (MEA-42) on the way in, before identity is computed.
  Tests: "porções são normalizadas ao entrar"
- **BUY-04** A line count must be capped at `QTD_MAX = 20` and floored at 1; setting it to zero
  or below must remove the line.
  Tests: "quantidade tem teto", "quantidade zero remove a linha", "mudar quantidade", "mudar quantidade na tela"
- **BUY-05** Changing a line's servings must move the line, and must merge it into an existing
  line when the two collide.
  Tests: "mudar porções move a linha", "mudar porções para um valor já existente junta as linhas", "mudar porções na tela", "mudar porções até colidir junta as linhas na tela"
- **BUY-06** Removal must delete only the line matching both recipe and servings; clearing must
  empty the cart.
  Tests: "remover apaga só a linha certa", "remover uma linha", "excluir tira a linha", "limpar zera tudo", "limpar carrinho mostra o estado vazio"
- **BUY-07** An unknown recipe must be rejected without changing anything.
  Tests: "receita inexistente é ignorada"
- **BUY-08** Every mutation must persist the cart under `"receitas:carrinho"` as
  `[{ slug, porcoes, qtd }]`, and a blocked or corrupt store must be survived in silence.
  Tests: "grava no navegador"
- **BUY-09** On load the stored cart must be sanitised: a non-array becomes empty; lines whose
  recipe no longer exists are dropped; servings are re-normalised; counts are clamped; and
  duplicates that collapse onto the same identity are merged.
  Tests: "lixo salvo é descartado ao carregar"
- **BUY-10** Every mutation must notify subscribers, and both the cart screen and the sheet must
  redraw from that notification rather than from whoever caused the change.
  Tests: "avisa quem estiver inscrito", "o carrinho sobrevive à navegação entre áreas"
- **BUY-11** The header badge must show the total number of preparations and hide itself at zero.
  Tests: "carrinho começa vazio", "o badge do cabeçalho acompanha o carrinho"

## Aggregating the list

- **BUY-12** Each cart line must contribute `porcoes / padrao × qtd` of the recipe.
  Tests: "uma receita no padrão bate com o arquivo de dados", "quantidade multiplica a receita inteira", "porções e quantidade se multiplicam"
- **BUY-13** Quantities of the same ingredient must be summed in the family's base unit — grams
  or millilitres — never in the unit each recipe happened to write.
  Tests: "kg e g de receitas diferentes somam na mesma linha", "copo e colher do mesmo ingrediente somam (açúcar)", "somar as receitas separadas dá o mesmo que somar juntas", "mesma receita em porções diferentes soma numa linha", "nenhuma linha erra mais de 4% do total real"
- **BUY-14** Grouping must fold a generic request into the most specific one (ING-12), label the
  line with the specific name, and must not merge siblings.
  Tests: "pedido genérico e pedido específico viram uma linha só", "irmãos não se juntam", "junta pela chave, não pelo texto do nome"
- **BUY-15** A unit with no family must sum only with an identical unit, in its own line: eggs
  with eggs, cans with cans.
  Tests: "unidades sem família só somam entre iguais"
- **BUY-16** An "a gosto" line must never be summed: it appears as the literal text "a gosto",
  and must disappear entirely when the same ingredient also appears with a quantity.
  Tests: "\"a gosto\" não é somado", "nem como \"a gosto\""
- **BUY-17** Subtitles and `emCasa` ingredients must not reach the list, in any unit and in any
  form.
  Tests: "subtítulos não entram na lista", "sal não vai para a lista de compras", "água também não, em qualquer medida", "o resto da lista não muda por causa disso"
- **BUY-18** The list must be written in the unit of the **shelf**, not of the recipe: butter
  measured in spoons is bought in grams, oil measured in millilitres stays in millilitres, and a
  total from 1000 upward is promoted to the larger unit.
  Tests: "a lista usa a unidade da prateleira, não a da receita", "volume com densidade conhecida sai em peso", "promove para kg quando passa de 1000", "preferência do leitor vale na lista"
- **BUY-19** The list must drop the recipe's preparation wording — "cebola", not "cebolas
  picadas" — and use the singular when the sum is one.
  Tests: "singular quando a soma dá 1"
- **BUY-20** Lines must be sorted by name pt-BR, each stating which recipes it came from, and an
  empty cart must produce an empty list.
  Tests: "ordem alfabética", "cada linha diz de que receitas veio", "carrinho vazio dá lista vazia"

## The purchase model

- **BUY-21** The purchase must record one requisition per recipe line and ingredient row, rather
  than a pre-summed total, so a group can later split by product.
  Tests: "receitas que discordam viram duas linhas, não um erro"
- **BUY-22** Packages must be counted whole, rounding up, with a `1e-9` slack so an exact fit
  never becomes an extra package.
  Tests: "precisar de menos que um pacote ainda custa um pacote", "precisar de mais que um pacote arredonda para cima", "quantidade exata não vira uma embalagem a mais", "uma pitada de fermento custa o pote", "contável também: 25 forminhas custam o pacote de 100", "a compra só sobe quando um pacote a mais é preciso"
- **BUY-23** The declared net content must be what gets divided, not the container: 790 g of
  condensed milk is two cans of 395 g.
  Tests: "a lata declara o conteúdo, e é ele que se divide"
- **BUY-24** Each line must carry the cost of what is used, the cost of the whole packages, and
  the leftover in the line's own unit.
  Tests: "precisar de menos que um pacote ainda custa um pacote", "contável também: 25 forminhas custam o pacote de 100", "precisar de mais que um pacote arredonda para cima"
- **BUY-25** When there is no arithmetic to do — no product, no positive amount, no price in the
  active store, or a package that does not convert — the line must carry nulls and no counts.
  Counting packages of an unsold product would print "1 × R$ 0,00".
  Tests: "escolha que o mercado não vende pinta a linha de amarelo", "na compra, as mesmas duas cores e a legenda das duas"
- **BUY-26** A line's key must be the ingredient id, or `ingrediente#produto` when the line split
  because recipes disagreed. That key identifies the line on screen and in the pantry set.
  Tests: "receitas que discordam viram duas linhas, não um erro", "receitas que discordam viram duas linhas na tela, sem vermelho", "marcar uma das duas não marca a outra", "a marcação sobrevive, e desmarcar devolve o valor"
- **BUY-27** The line must be named and priced by the **most specific** request in the group.
  Tests: "pedido específico limita o automático ao subtipo", "cada linha diz o produto, o quanto precisa, as embalagens e o preço"
- **BUY-28** A choice made in the cart scope must win over the recipes' and must re-join a split
  line into one.
  Tests: "a escolha feita no carrinho vence a das receitas", "dividido, a escolha do carrinho junta de novo", "a folha respeita o produto escolhido no carrinho"
- **BUY-29** With no choice at all, the line must take the cheapest product that serves it,
  restricted to the subtree that was actually requested.
  Tests: "sem escolha nenhuma, o mais barato", "pedido específico limita o automático ao subtipo"
- **BUY-30** A recipe's choice must count only if it serves that recipe's own request; otherwise
  the requisition falls back to automatic.
  Tests: "a escolha da receita atravessa para a compra", "escolha que não serve ao pedido é ignorada"
- **BUY-31** When two recipes chose different products for the same ingredient, the purchase must
  **show both lines**, each with its own requisitions and each announcing that it is one of N
  products — not flag an error and not silently pick one.
  Tests: "receitas que discordam viram duas linhas, não um erro", "receitas que discordam viram duas linhas na tela, sem vermelho", "a folha impressa leva os dois"
- **BUY-32** Requisitions with no choice of their own must ride along with the cheapest chosen
  product rather than opening a third package.
  Tests: "quem não escolheu acompanha o mais barato dos escolhidos"
- **BUY-33** A line's origin must be exactly one of `"automatico"`, `"receita"`, `"carrinho"`.
  Tests: "as três origens de uma linha"
- **BUY-34** The effective choice must be computed per recipe, not per ingredient, because a
  split line gives the same ingredient two products — and each recipe's cost must be priced with
  the products actually going into the bag.
  Tests: "quem pediu o pai recebe o produto do grupo", "dividido, cada receita é precificada pelo SEU pote", "cada linha é precificada pelo produto que vai na sacola", "total é uma preparação; linha é vezes a quantidade", "a soma das linhas fecha com o total de refeições"
- **BUY-35** Rows never considered: subtitles and `emCasa` ingredients produce no purchase line
  and are not reported as left out.
  Tests: "o que já se tem em casa não entra na compra", "a seção da compra aparece com uma linha por ingrediente"
- **BUY-36** Rows left out must be reported with one of these reasons:
  `"quantidade a gosto"`, `` `não dá para medir ${un}` ``, `"medidas que não se somam"`,
  `"sem produto no catálogo"`, `"embalagem que não se converte"`.
  Tests: "o que não dá para precificar é relatado", "receita com ingrediente a gosto se declara incompleta"

## The four numbers

- **BUY-37** **Refeições** must be the sum of what the recipes consume, over every line that has
  arithmetic — **including** lines the reader marked as already at home.
  Tests: "as refeições batem com a soma das receitas", "a soma das linhas do passo 1 é o total de refeições do passo 2"
- **BUY-38** **Compra** must be the sum of whole packages over the lines actually being bought.
  Tests: "o total da compra é maior que o das refeições", "trocar o produto no carrinho muda os dois totais"
- **BUY-39** **Sobra** must be summed per purchased line as package cost minus consumption —
  **not** as compra minus refeições — so it can never go negative once something is marked as
  already at home.
  Tests: "a compra é maior que as refeições, e a diferença é a sobra", "comprar mais dilui a sobra", "com tudo em casa, a sobra é zero e não negativa", "marcar 'já tenho' não muda de assunto nem estraga a sobra"
- **BUY-40** **Já tenho** must be what the whole packages of the marked lines would have cost.
  Tests: "marcar que já tenho abate da compra e não das refeições", "a marcação sobrevive, e desmarcar devolve o valor"
- **BUY-41** Marking "já tenho" must reduce the purchase and must not touch the meals: the recipe
  still eats the ingredient.
  Tests: "marcar que já tenho abate da compra e não das refeições"
- **BUY-42** All four numbers must be shown at all times, zeros included — no box is ever
  swapped out or hidden according to its value. An earlier version swapped "sobra" for "já
  tenho", which hid a negative leftover.
  Tests: "os quatro números aparecem, inclusive zerados"
- **BUY-43** An empty cart must invent no totals.
  Tests: "carrinho vazio não inventa totais"
- **BUY-44** The pantry set must be persisted under `"receitas:tenho"` as line keys, validated on
  load against existing ingredients and products.
  Tests: "a marcação sobrevive, e desmarcar devolve o valor"

## The three steps

- **BUY-45** The flow must be three steps — "Revise as receitas" (`#/carrinho`), "Revise a
  compra" (`#/carrinho?passo=2`), "Folha de compras" (`#/lista`) — with a breadcrumb marking
  where the reader is, linking the others, and never linking the current step to itself.
  Tests: "a trilha marca onde se está e liga os outros passos", "passo 1 mostra receitas; passo 2, a compra"
- **BUY-46** The step must live in the URL and be changed by links, so the browser's Back button
  walks the flow; a non-numeric or out-of-range value must resolve to a valid step.
  Tests: "o passo vive na URL, e o padrão é o primeiro", "o passo 1 leva ao passo 2, e não a uma compra"
- **BUY-47** Step 1 must show one row per cart line with photo, name, price, a servings stepper
  and a preparations stepper, and an "Excluir" button. The preparations stepper must be the only
  way to ask for a second batch — there is no "duplicate" button, because changing the count
  already says it.
  Tests: "cada linha do carrinho mostra o total e o por porção", "o seletor de preparos é o único caminho para uma segunda leva", "mostra porções e quantidade de cada linha"
- **BUY-48** A row's ingredients must stay collapsed until asked for, and expanding must restore
  focus to the toggle that was clicked.
  Tests: "os ingredientes só aparecem quando se pede", "cada ingrediente mostra quantidade, produto e preço"
- **BUY-49** The collapsed row and the open panel must be drawn from a single computation of each
  ingredient's state, so the summary and the detail cannot disagree.
  Tests: "o resumo fechado e o painel aberto contam a mesma coisa"
- **BUY-50** A collapsed row must already show what there is to resolve: a red chip counting
  ingredients the store does not sell, then a yellow chip counting choices it does not sell.
  Before this, the reader had to expand a recipe to learn there was a problem.
  Tests: "a linha FECHADA da receita já mostra o que há a resolver"
- **BUY-51** The row itself must take the colour of its most severe warning — red over yellow,
  never both.
  Tests: "vermelho manda sobre amarelo na linha da receita"

## The colour vocabulary

- **BUY-52** There must be exactly four states: green `tenho` (already at home, struck through),
  yellow `alerta` (the chosen product is not sold here — a swap fixes it), red `errada` (nothing
  serves, or the package does not convert), and no colour at all for the ordinary case.
  Tests: "o que se assume ter em casa é o verde do painel", "escolha que o mercado não vende pinta a linha de amarelo", "ingrediente sem nenhum produto no mercado pinta de vermelho"
- **BUY-53** An "a gosto" line must take **no** colour: the absence of a price there is a
  decision, not a defect.
  Tests: "\"a gosto\" não é defeito"
- **BUY-54** In step 2 "já tenho" must be decided before any warning: a defect in something you
  are not buying is not today's problem.
  Tests: "o item marcado cai para o fim da lista e fica riscado"
- **BUY-55** A green row in step 1 — an `emCasa` ingredient — must ask for nothing: no product
  button, no price, and the words "já em casa". A green line in step 2 is a different green: the
  reader marked it, so it keeps its button and its price and takes only the wash and the strike,
  because unticking the box must remain possible.
  Tests: "o que se assume ter em casa não pede escolha", "o item marcado cai para o fim da lista e fica riscado"
- **BUY-56** A chosen product's name must survive the loss of its price — the line shows the name
  and `"???"`, never "escolher produto" and never `R$ 0,00`.
  Tests: "escolha que o mercado não vende pinta a linha de amarelo", "na compra, as mesmas duas cores e a legenda das duas"
- **BUY-57** Every colour must be accompanied by its reason in the `title` and in a screen-reader
  span: colour alone is not information.
- **BUY-58** The legend must explain only the colours actually on screen, in the order green,
  yellow, red, and must disappear entirely when there is nothing to explain.
  Tests: "a legenda só cita a cor que está na tela", "na compra, as mesmas duas cores e a legenda das duas", "voltar para todos os mercados desfaz os avisos"

## Step 2

- **BUY-59** Lines where the site chose for the reader **and there was a choice to make** — an
  automatic origin with more than one product serving the ingredient — must come first, then the
  resolved ones, then the ones marked as already at home; within each band, alphabetically. An
  ingredient with a single product is not a pending decision.
  Tests: "itens sem escolha específica aparecem primeiro", "o item marcado cai para o fim da lista e fica riscado"
- **BUY-60** Each line must state the product, what is needed, how many packages, the price, and
  the leftover; a split line must announce that it is one of N products.
  Tests: "cada linha diz o produto, o quanto precisa, as embalagens e o preço", "receitas que discordam viram duas linhas na tela, sem vermelho"
- **BUY-61** Clicking a line must open the picker showing **who asks and how much**, matching
  requisitions by the pair recipe + ingredient, because the same ingredient may sit in two lines.
  Tests: "clicar num produto abre a janela, com o pedido somado", "a janela do passo 2 diz quem pede e quanto"
- **BUY-62** Choosing in step 2 must bind the cart scope for a whole line, but must not bind it
  for a split line — that would undo the split the recipes asked for. Returning to automatic must
  clear the cart scope and leave the recipes' own choices intact.
  Tests: "escolher no carrinho grava e marca a linha", "voltar ao automático limpa a escolha do carrinho, não a das receitas"
- **BUY-63** Products already going into the bag for another recipe must float to the top of the
  dialog (CHO-14).
  Tests: "a janela destaca o produto que já vai na sacola por outra receita"
- **BUY-64** Changing servings in step 1 must change the meals immediately, and the purchase only
  when a package boundary is crossed.
  Tests: "mudar as porções no passo 1 muda as refeições, e a compra só na virada"
- **BUY-65** An empty cart must show an invitation, not an empty table; a cart with nothing
  priceable must say there is nothing to buy.
  Tests: "carrinho vazio não mostra a seção da compra", "limpar carrinho mostra o estado vazio"

## Step 3, the sheet

- **BUY-66** Each sheet line must have exactly three parts: a tick box, the product name with its
  brand, and a quantity — and nothing else.
  Tests: "a folha tem uma linha por item: caixa, produto, quantidade", "cada linha tem caixa, produto e quantidade — e nada mais", "cada item tem quadradinho para marcar"
- **BUY-67** The quantity on the sheet must be the **package**, not the consumption: `2 × 1 kg`,
  and a single package drops the "1 ×". A line with no product or no conversion falls back to what
  the recipe asks.
  Tests: "com carrinho, a folha lista o que comprar", "a folha explica que a quantidade é a da embalagem"
- **BUY-68** The sheet must deliberately omit what belongs to step 2 — what the recipe consumes,
  the leftover, the per-line prices and the four totals — and must show only the single cash
  total, in the header.
  Tests: "a folha não repete o que pertence ao passo 2", "a folha traz o total da compra no cabeçalho"
- **BUY-69** Items marked as already at home must leave the buying list and appear in their own
  section, which disappears when empty.
  Tests: "o que se tem em casa sai da lista de comprar"
- **BUY-70** The sheet must summarise which recipes it came from, with servings and batch count.
  Tests: "mostra o resumo das receitas"
- **BUY-71** An "a gosto" ingredient must never reach the sheet.
  Tests: "\"a gosto\" não entra na folha"
- **BUY-72** An item the active store does not sell must stay on the sheet, with the quantity the
  recipe asks and a note saying how many such items there are — "para você resolver onde der".
- **BUY-73** The sheet must offer printing and a way back to step 2, and must print automatically
  when reached with `?imprimir=1` — but must not reopen the dialog on a later redraw.
  Tests: "tem botão de imprimir e link de volta ao passo 2", "o botão chama a impressão", "chegando com ?imprimir=1, abre a impressão sozinho", "lista vazia avisa em vez de imprimir"

## Known gaps

- BUY-57, BUY-72 and the "nothing to buy" half of BUY-65 have no test.
- "itens sem escolha específica aparecem primeiro" (BUY-59) looks for a class the code never
  emits and guards its second assertion behind an `if`, so the generic-before-resolved ordering
  is effectively unverified.
- The line-key format of BUY-01, the caps on the merge paths of BUY-02 and BUY-05, and the
  silent-failure paths of BUY-08 are untested.
- The reasons `"medidas que não se somam"` and `"embalagem que não se converte"` (BUY-36), and the
  individual guard clauses of BUY-25, are untested.
- The 4% exactness flag each aggregated list line carries is asserted only for its type, never
  for its threshold (BUY-13).
