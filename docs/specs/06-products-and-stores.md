# PRD — Products, stores and the price relation

Three files, three subjects: `src/data/produtos.js` (what a package is),
`src/data/mercados.js` (who sells), `src/data/precos.js` (for how much).
Brands and prices are fictitious test data.

## The product record

- **PRD-01** Every product must declare exactly one `ing`, and it must be the **most specific**
  catalogue node that fits — a product is of "açúcar refinado", not of "açúcar".
  Tests: "todo produto aponta para um ingrediente que existe"
- **PRD-02** Every product must have a `nome`; `marca` is optional and is absent exactly for
  loose goods sold by weight.
  Tests: "todo produto tem nome"
- **PRD-03** Every product must declare a positive `qtd` and a registered `un`.
  Tests: "a quantidade da embalagem é positiva", "a unidade da embalagem é conhecida"
- **PRD-04** `conteudo` must declare net content, and may be present **only** when `un` is not a
  measure — a can is one `lata` of 395 g. When `un` is already a measure, `conteudo` must be absent.
  The converse is not required: a countable with no meaningful net content (eggs, paper cups)
  declares none.
  Tests: "conteúdo líquido só onde a unidade não é medida"
- **PRD-05** A product record must not carry a `preco` field. Price is a fact about the pair
  store + product; a `preco` here would be a second place saying what something costs, and the
  easier one to forget to update.
  Tests: "o registro cru não carrega preço"
- **PRD-06** `nutrientes` on a product must be optional, may be partial (a label that declares
  only protein, carbohydrate and fat is valid), and every declared field must be a known,
  non-negative nutrient with `kcal <= 900`.
  Tests: "produto sem nutrientes é aceito", "rótulo parcial é aceito (só proteína, carboidrato e gordura)", "todo campo de nutriente informado é conhecido e não negativo"

## The store record

- **PRD-07** A store must declare exactly `nome` and `logo` — no address, no opening hours, no
  card flags: the store exists here to scope prices, not to be visited.
  Tests: "todo mercado tem nome e logo"
- **PRD-08** `logo` must match `public/images/mercados/<algo>.svg`, and the file must exist in
  the repository.
  Tests: "todo mercado tem nome e logo", "o arquivo do logo existe de verdade"
- **PRD-09** Reading a store by id must return the record with the id merged in, and `null` for
  an unknown id.
  Tests: "`mercado()` traz o id junto, e null para quem não existe"
- **PRD-10** The store list offered to the reader must be sorted by name with the pt-BR
  collator.
  Tests: "a lista de mercados sai em ordem de nome"

## The price relation

- **PRD-11** Price must live in its own table, nested store → product → number; neither the
  product file nor the store file may mention the other.
- **PRD-12** The relation must be 0..1 for each pair: at most one price per store and product,
  and zero is allowed.
  Tests: "a ligação é 0-1: um preço por par"
- **PRD-13** An absent entry must mean "this store does not sell this" — never "sells it for
  free". Reading such a pair must yield `null`.
  Tests: "`preco()` devolve null para o que o mercado não vende"
- **PRD-14** Every price must be a positive finite number.
  Tests: "todo preço é um número positivo"
- **PRD-15** Every store id and every product id appearing in the price table must exist in its
  own catalogue.
  Tests: "todo mercado da tabela de preços existe", "todo produto da tabela de preços existe"
- **PRD-16** Every product must be sold in at least one store: a product nobody sells is dirty
  catalogue, not a state to render.
  Tests: "todo produto é vendido em ao menos um mercado"
- **PRD-17** The prices of a product must be readable sorted cheapest-first, with the store
  attached, and the cheapest must be the first of that list.
  Tests: "`precosDe()` sai do mais barato ao mais caro", "`maisBarato()` é o primeiro da lista, com o mercado junto"
- **PRD-18** When listing every price of a product, the reader must skip a store id that is not
  registered and any value that is not a positive number — the data is checked, not trusted.
- **PRD-19** The test data must keep at least ten products priced differently across stores, so
  comparing stores is a real exercise and not a coincidence.
  Tests: "mais de um mercado vende o mesmo produto por preços diferentes"

## Store scoping on reads

- **PRD-20** A product read must return the catalogue fields plus three derived ones: `preco`,
  `mercado` and `foraDoMercado`.
  Tests: "o produto lido já vem com o melhor preço e o mercado dele"
- **PRD-21** The three derived outcomes must mean: a number — priceable; `null` with
  `foraDoMercado: true` — the active store does not sell it but somebody does (a warning);
  `null` with `foraDoMercado: false` — nobody sells it (a defect, forbidden by PRD-16).
  Tests: "produto que o mercado não vende: preço null e `foraDoMercado`"
- **PRD-22** With an active store, the price must be **that store's** price, and `mercado` must
  be `null` exactly when there is no price.
  Tests: "com mercado, o preço é o daquele mercado"
- **PRD-23** With no active store, the price must be the cheapest across all stores, with the
  store that offers it named, and nothing is ever out-of-store — comparing instead of buying.
  Tests: "sem mercado, o preço é o mais barato entre todos", "o produto lido já vem com o melhor preço e o mercado dele"
- **PRD-24** Reading the products of an ingredient must descend the subtree: asking for the
  parent yields every subtype's products; asking for a subtype yields only its own; a sibling's
  never leak. An exact, non-descending read must also be available.
  Tests: "mais barato compara todos os produtos do ingrediente", "pedindo o pai, o mais barato pode vir de qualquer subtipo"
- **PRD-25** With an active store, that list must be filtered to what the store stocks and
  priced at that store.
  Tests: "`produtosDe` com mercado só devolve o que se compra ali"
- **PRD-26** An empty list is ambiguous by design — "the catalogue has none" or "not sold here"
  — and the caller must distinguish the two by comparing with the unfiltered list (see PRC-14).
- **PRD-27** The test data must keep both warning scenarios reachable: every store must leave at
  least one used ingredient with no product at all (the red case), and there must be at least three
  products, across the stores, sold elsewhere but not here while a substitute exists (the yellow
  case). Today each store has at least two of the latter.
  Tests: "cada mercado deixa algum ingrediente sem nenhum produto", "há um caso de amarelo montado de propósito"

## Known gaps

- PRD-11, PRD-18 and PRD-26 have no test; PRD-18's two sanitisation branches are unreachable
  while PRD-14 and PRD-15 hold, which is precisely why they are worth keeping.
- PRD-18 covers only the "all prices of a product" reader. The single-pair reader every
  store-scoped read goes through returns the stored value as it is, so a bad entry would reach
  the screen with an active store and be filtered without one.
- PRD-27's yellow guarantee is asserted over all stores at once, not per store.
- The exact-read variant of PRD-24 (`produtosExatosDe`) is entirely untested.
- Reading an unknown product id (must be `null`), the store-id tie-break inside PRD-17's
  ordering, and the "stores of a product" / "catalogue of a store" readers are untested.
- `MOEDA = "BRL"` is exported and never read: the formatter hard-codes the currency.
