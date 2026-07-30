# PRC — Pricing

`src/js/pricing.js`. One rule governs the whole file: **a number that cannot be computed is
`null`, and `null` is never printed as zero and never quietly replaced.**

## The package and the shelf

- **PRC-01** A package's measure must be its own `qtd`/`un` when that unit is a measure;
  otherwise its declared net content multiplied by the number of units; otherwise the package
  counted as a countable ("1 lata", "100 un.").
  Tests: "lata usa o conteúdo líquido para virar preço por grama", "unidade sem equivalência casa só com ela mesma"
- **PRC-02** The shelf price must follow the **package**, not the calculation base: volume per
  litre, weight per kilo, countables per their own unit. "R$ 13,22/L" reads; "R$ 0,0144/g" does
  not, and "R$ 24,83/kg de ovo" reads worse.
  Tests: "preço de gôndola segue a embalagem, não a base de cálculo"
- **PRC-03** With no price, the shelf price must be `null` with its unit intact — never
  `0 / 1000`. "R$ 0,00/kg" is the most convincing lie this file could tell.
- **PRC-04** The package label must be written as the shelf writes it, with the net content in
  parentheses — `1 lata (395 g)` — because a litre of milk is not "1,03 kg" on the shelf.
- **PRC-05** With no price in the active store, the shelf-price text must say
  `"sem preço neste mercado"`.

## The common base

- **PRC-06** A quantity must be translated to a comparable base in this order: grams if
  reachable, then millilitres for a volume, otherwise left as written. Grams come first because
  grams serve any ingredient.
- **PRC-07** The unit price must be the package price divided by the package measured in that
  base.
  Tests: "peso vira preço por grama", "volume vira preço por ml", "contável vira preço por unidade", "lata usa o conteúdo líquido para virar preço por grama"
- **PRC-08** Given the ingredient, all products of one ingredient must land on the same base, so
  a dozen eggs and a loose egg become comparable; without the ingredient, the base is the
  package's own.
  Tests: "a dúzia de ovos e o ovo solto viram comparáveis", "sem o ingrediente, a base é a da embalagem"
- **PRC-09** A larger package may be cheaper per unit, and the comparison must find it.
  Tests: "embalagem maior pode sair mais barata por quilo"
- **PRC-10** A `null` price must propagate through the unit price without arithmetic.

## The cost of a request

- **PRC-11** A request with no quantity or no unit must have no cost.
  Tests: "quantidade ausente não tem custo"
- **PRC-12** A request written in a unit that translates to nothing must match only the identical
  package unit: the recipe asks for "1 lata" and the can answers, and a can asked for in grams
  must cost the same as the same can asked for as a can.
  Tests: "unidade sem equivalência casa só com ela mesma", "a lata custa o mesmo pedida como lata ou como peso"
- **PRC-13** Otherwise the cost must be the unit price times the requested amount, translated
  into the same base — within a family, or across families through density, or from countables
  through weight per unit.
  Tests: "mesma unidade da embalagem", "converte dentro da família", "cruza volume e peso quando há densidade", "contável vira peso pelo pesoPorUnidade", "calcula quando as medidas se convertem", "a quantidade pedida pode ser outra que a do arquivo"
- **PRC-14** When the bases do not meet, the cost must be `null` — never an invented number.
  Tests: "sem densidade, volume não vira peso: devolve null", "devolve null em vez de inventar número"

## Choosing the cheapest

- **PRC-15** The cheapest product of an ingredient must be sought among the products that serve
  it in the active store, comparing only those that reach a base — comparing R$/g with R$/un. is
  not comparing — on the base most of them share.
  Tests: "mais barato compara todos os produtos do ingrediente", "pedindo o pai, o mais barato pode vir de qualquer subtipo"
- **PRC-16** An ingredient with no product must have no cheapest.
  Tests: "ingrediente sem produto não tem mais barato"

## The cost of an ingredient line

- **PRC-17** A line must have no cost, **by decision**, when it has no quantity or when the
  ingredient is `emCasa`: a pinch of salt costs R$ 0,0013 and pricing it informs nobody. The
  ingredient itself is not thereby denied — only its cost.
  Tests: "\"a gosto\" não tem custo", "o que se assume ter em casa não entra na conta", "sal não recebe preço: assume-se que já está em casa"
- **PRC-18** The chosen product must be used when there is one; otherwise the cheapest.
  Tests: "o custo da linha passa a ser o do produto escolhido", "o preço é do produto mais barato, e o title diz qual", "trocar a medida não muda o preço"
- **PRC-19** When the chosen product has no price in the active store, the line must have no
  cost and must **not** be silently substituted: swapping on the reader's behalf would be doing
  their shopping for them without telling them.
  Tests: "escolha que o mercado não vende pinta a linha de amarelo"
- **PRC-20** Today, every recipe line with a quantity and not `emCasa` must in fact have a price.
  This is the state of the catalogue, not a rule of the site.
  Tests: "hoje toda linha com quantidade e preço tem preço"

## The cost of a recipe

- **PRC-21** The recipe cost must price each line at `qtd * porcoes / padrao`, and the total
  must be the plain sum of the counted lines — not another computation.
  Tests: "o custo da receita inteira fecha com a soma das linhas", "o total escala com as porções", "total e por porção, no padrão", "o total é a soma exata das linhas mostradas"
- **PRC-22** Subtitles and `emCasa` ingredients must be skipped **without** being reported: a
  decision is not a missing datum, and a pinch of salt must not make a recipe's total a floor.
  Tests: "o que se assume ter em casa não conta como lacuna"
- **PRC-23** A line with no quantity must be reported as `"quantidade a gosto"`; a line with no
  price must be reported with the reason from PRC-25.
  Tests: "o que não dá para precificar é relatado, não somado", "o que ficou fora da conta é dito, não escondido"
- **PRC-24** The per-portion cost must be the displayed total divided by the servings, so the two
  numbers on screen always agree, and it must **not** change with the servings selector.
  Tests: "o custo por porção NÃO muda com o seletor", "mudar as porções move o total e não o por porção", "o rótulo por porção acompanha a receita", "o por porção não muda com as porções", "o total da receita aparece, com o custo por porção"
- **PRC-25** `completa === false` must be the single signal that a total is a floor; the screen
  renders it as "a partir de", and a complete total is called an estimated cost.
  Tests: "mercado incompleto declara o total como piso", "conta completa se chama de custo estimado", "receita incompleta diz \"a partir de\"", "o separador não aparece antes do \"a partir de\""
- **PRC-26** A recipe with nothing priceable must report zero counted, a zero total and
  `completa: false` — it must not claim a total it does not have.
  Tests: "receita sem nada precificável não finge total", "sem produto nenhum, não há custo"
- **PRC-27** The whole total must depend on the active store, threaded as an argument and never
  as hidden state — which is what lets a test choose a store without touching `localStorage`.
  Tests: "o custo da receita muda de mercado para mercado", "na receita, o mercado ativo pinta a linha e nomeia os preços", "a página avisa de onde vêm os preços"
- **PRC-28** The reason a price is missing must distinguish four cases, in this precedence: no
  active store — `"sem produto que sirva"`; the chosen product is not sold here —
  `"o produto escolhido não é vendido aqui"` (yellow); nothing at all is sold here —
  `"nenhum produto vendido aqui"` (red); otherwise `"sem produto que sirva"`. A single generic
  message made "you chose something they don't have" indistinguishable from "they have none of
  this".
  Tests: "mercado incompleto declara o total como piso"

## Money on screen

- **PRC-29** Money must be formatted pt-BR as BRL: `R$` and a comma.
  Tests: "preço sai em reais, com vírgula"
- **PRC-30** An amount above zero but below half a cent must be written `"< R$ 0,01"`, and zero
  must be written `R$ 0,00` — zero is zero, not "less than a cent".
  Tests: "menos de meio centavo não vira R$ 0,00"

## Picker options

- **PRC-31** Each option offered for an ingredient must carry three prices — the package price
  (what leaves the wallet), the shelf price (what compares sizes) and the line cost (what
  changes if the choice changes) — plus its recency and whether it is already in the bag.
  Tests: "cada opção traz os quatro números da janela"
- **PRC-32** The requested amount must be a parameter, separate from the recipe's: the recipe
  asks "2 copos", the summed purchase asks "450 g".
  Tests: "o pedido decide o que a janela oferece"
- **PRC-33** The offered list must be restricted to the requested subtree and, with an active
  store, to what that store sells.
  Tests: "o pedido decide o que a janela oferece", "pedindo o pai, a janela mostra os produtos de todos os subtipos"

## Known gaps and known bugs

- PRC-11 also guards a missing price, before either branch: the identical-unit path divides, and
  `null / qtd * qtd` is `0` in JavaScript, so a can the active store did not sell used to cost
  `R$ 0,00` in the picker instead of nothing.
  Tests: "sem preço no mercado, a lata não custa zero"
- PRC-31's orderings must treat a missing price as the most expensive, not as zero: `null - 5`
  is `-5`, so an unsold product used to head the list ordered by package price.
  Tests: "sem preço não é de graça na ordenação por embalagem"
- The money formatters throw on `null`: null-safety lives at the callers, not at the boundary.
- PRC-03, PRC-04, PRC-05, PRC-06, PRC-10 have no test; nor do the exclusion of off-base products
  and the most-frequent-base selection inside PRC-15, nor the four individual strings of PRC-28.
