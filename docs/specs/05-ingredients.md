# ING — The ingredient catalogue

`src/data/ingredientes.js` holds a tree; `src/data/resolve.js` joins a recipe line to it.
The catalogue says what a thing *is*. The recipe says what is done to it. The product says
which package it comes in.

## Ids and the tree

- **ING-01** An id must be the `/`-joined path from the root: `manteiga`,
  `manteiga/sem-sal`, `chocolate-em-po/50`. The id is the lineage.
  Tests: "o id conta a linhagem", "três níveis funcionam igual a dois"
- **ING-02** Every flattened record must carry `id`, `pai`, `filhos`, `nivel`, `nome`, `comoO`,
  and the set of fields it declared itself.
  Tests: "o id conta a linhagem"
- **ING-03** The inheritable fields must be exactly `densidade`, `liquido`, `pesoPorUnidade`,
  `comestivel`, `emCasa`, `nutrientes`, `plural`; the borrowable fields exactly `densidade`,
  `liquido`, `pesoPorUnidade`, `nutrientes`. `nome`, `comoO` and `tipos` must never be
  inherited or borrowed.
  Tests: "o subtipo herda do pai o que não declara", "subtipo herda o que o pai declara sobre estado e casa", "o pai toma nutrientes do subtipo mais comum", "todo nó tem nome próprio, e o do subtipo diz o que é"
- **ING-04** Flattening must run in exactly three passes, in this order: each node's own
  declarations; **bottom-up borrowing**, where a parent takes from the child named by `comoO`
  what it did not declare; then **top-down inheritance**, where a child fills from its parent
  what is still undefined. The order is load-bearing — reversed, a parent would borrow from a
  child that had itself inherited from the parent.
  Tests: "o pai toma nutrientes do subtipo mais comum", "o subtipo herda do pai o que não declara"
- **ING-05** `comoO` must name a direct child key only, and a `comoO` pointing at a
  non-existent child must borrow nothing rather than fail.
  Tests: "o pai toma nutrientes do subtipo mais comum"
- **ING-06** Every node that has children must declare `comoO`, so a recipe asking for the
  generic ingredient always has numbers.
  Tests: "todo pai com subtipos diz de qual deles vêm os números"
- **ING-07** After inheritance the fields the screens read without checking must be normalised:
  `comestivel` defaults to true, `emCasa` and `liquido` default to false, `pesoPorUnidade` and
  `nutrientes` default to `null`.
  Tests: "subtipo herda o que o pai declara sobre estado e casa"
- **ING-08** Every catalogue `nome` must be non-empty, start lowercase, and differ from its
  parent's name — a subtype's name must say what makes it that subtype.
  Tests: "cada entrada do catálogo tem nome e forma de nutrientes válida", "todo nó tem nome próprio, e o do subtipo diz o que é"
- **ING-09** The semantic fields must mean: `plural` only for countables (absent means
  invariable); `densidade` in g/ml; `liquido: true` for what is *measured* by volume,
  independent of density; `pesoPorUnidade` as `{ unidade: gramas }`; `comestivel: false` for
  what is bought but not eaten; `emCasa: true` for what is assumed already at home and is
  therefore excluded from cost and from the shopping list.
  Tests: "o que se assume ter em casa está marcado", "o que não é comida não tem nutrientes"

## Subtree semantics

- **ING-10** "Serves" must mean subtree membership: a node serves itself, a descendant serves
  its ancestor, an ancestor does not serve a descendant, a sibling never serves a sibling, and a
  textual prefix is not a subtype — `"ab"` is not under `"a"`, because the separator is required.
  Tests: "três níveis funcionam igual a dois"
- **ING-11** `descendentes(id)` must return the node first, then its whole subtree depth-first,
  and `[]` for an unknown id. `linhagem(id)` must return the names from root to node.
  Tests: "três níveis funcionam igual a dois", "o id conta a linhagem"
- **ING-12** When both a generic and a specific request appear together, they must be grouped
  under the **most specific** one: the deepest requested id in the subtree wins, ties are broken
  in favour of the one the parent names as `comoO`, and siblings never merge.
  Tests: "pedido genérico e pedido específico viram uma linha só", "irmãos não se juntam", "junta pela chave, não pelo texto do nome", "com junção de linhagem, o carrinho manda — e diz por quê", "quem pediu o pai recebe o produto do grupo"

## Integrity

- **ING-13** Every ingredient key used by a recipe must exist in the catalogue, and every
  broken reference must be collected into an exported list of problems that is empty for the
  shipped data.
  Tests: "toda chave usada nas receitas existe no catálogo"
- **ING-14** An unknown key must never crash a page: it must log, be recorded, and render as a
  visible placeholder `[?] <chave>`.
  Tests: "chave desconhecida não derruba a página"
- **ING-15** No catalogue entry may be an orphan. The only admissible reasons for an unused id
  are: it is `emCasa`; it is a grouping node whose descendant is requested; or it is a subtype
  whose parent or sibling is requested.
  Tests: "nenhum ingrediente do catálogo está órfão"
- **ING-16** Every ingredient used in a recipe must have at least one product that serves it.
  `agua` is the documented exception: it is `emCasa`, is requested by no recipe, and has no
  product — which is why its name renders as text rather than a button.
  Tests: "todo ingrediente usado em receita tem ao menos um produto", "ingrediente sem produto no catálogo não é clicável"

## Resolution

- **ING-17** A recipe line must be joined to the catalogue by its `ing` key, producing an
  object whose provenance is explicit: `id`, `qtd`, `un`, `escala`, `texto` from the line;
  `item`, `itemSingular`, `detalhe`, `detalheSingular` from line × catalogue; `nome`,
  `nomePlural`, `densidade`, `liquido`, `pesoPorUnidade`, `comestivel`, `emCasa`, `nutrientes`
  from the catalogue.
  Tests: "o preparo da receita não se perde: desce para o parêntese", "onde o rótulo cala, o valor continua vindo da tabela"
- **ING-18** A chosen product must be attached only when it serves the requested ingredient;
  otherwise the resolved ingredient must be returned unchanged, by identity.
  Tests: "produto de subtipo serve a quem pediu o pai", "produto do irmão também é ignorado", "escolha de produto de outro ingrediente é ignorada na aplicação"
- **ING-19** The attached product must be read through the store-scoped reader, so it already
  carries `preco`, `mercado` and `foraDoMercado`: a choice the active store does not sell
  survives, and the screen warns.
  Tests: "produto que o mercado não vende: preço null e `foraDoMercado`", "escolha que o mercado não vende pinta a linha de amarelo"
- **ING-20** Applying an empty choice map must return the recipe object itself, unchanged and
  uncopied.
  Tests: "aplicar mapa vazio devolve a própria receita, sem cópia"
- **ING-21** Applying choices must mutate nothing: the loaded recipe, its ingredient objects and
  their nutrients must be untouched, because the choice belongs to the reader's browser and not
  to the site's data.
  Tests: "a receita original não é tocada"

## Known gaps

- The **necessity** of the three-pass order (ING-04) has no regression test: nothing fails if
  the passes are swapped.
- `nivel`, the declared/borrowed sets (ING-02), the inheritance of `pesoPorUnidade`,
  `comestivel`, `emCasa`, `plural` (ING-03), the `comoO`-tie-break of ING-12, and the `null`
  normalisation of ING-07 are untested.
- The full field list of a resolved ingredient (ING-17) is untested, as is the *reduced* field
  set of the unknown-key placeholder — which lacks `escala`, `texto`, `emCasa` and the rest,
  and would therefore behave differently from a real ingredient if it ever reached a sum.
- ING-09's distinction between `liquido` and `densidade` — oil and sugar are both ≈1 g/ml but
  only oil is measured in ml — is documented, not tested.
