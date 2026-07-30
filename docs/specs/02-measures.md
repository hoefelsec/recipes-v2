# MEA — Measures, conversion and scaling

Numbers and words live in `src/data/unidades.js`; behaviour lives in `src/js/units.js`;
scaling in `src/js/scaling.js`.

## The registry

- **MEA-01** The unit registry must be composed of exactly three groups —
  `VOLUMES`, `PESOS`, `CONTAVEIS` — merged in that order, and no unit name may appear in
  more than one group.
  Tests: "nenhuma medida está em dois grupos"
- **MEA-02** `familia` must come from group membership, never from a hand-written field: no
  entry may declare `familia`, and countables must have none.
  Tests: "a família vem do grupo, não de cada linha"
- **MEA-03** Volume units must be, with these bases in ml: `ml: 1`, `L: 1000`, `copo: 180`,
  `copo americano: 200`, `copo de requeijão: 250`, `xícara: 240`, `col. sopa: 15`,
  `col. sobremesa: 10`, `col. chá: 5`, `col. café: 2`.
  Tests: "os volumes de cozinha estão cadastrados, em ml", "volume: copo, xícara, colher e ml"
- **MEA-04** Weight must have exactly one unit, `"g"` with `base: 1`. `"kg"` must not be a
  unit: `unidadeConhecida("kg")` must be false and any conversion touching it must return
  `null`. Kilograms are a way of *writing* grams (see MEA-21).
  Tests: "peso tem uma unidade só: grama"
- **MEA-05** Countable and packaging units must carry no `base`: `pitada`, `un.`, `dente`,
  `folha`, `fatia` with `passo: 1, min: 1`, and `lata`, `maço`, `pacote` with
  `passo: 0.5, min: 0.5`.
  Tests: "contáveis nunca viram fração", "latas aceitam meia"
- **MEA-06** Every registered unit must have a non-null `passo` and `min`, and must be able to
  write its own plural without producing `"NaN"`.
  Tests: "toda medida sabe arredondar e escrever o plural"
- **MEA-07** `METRICAS` must be exactly `["g", "ml", "L"]`, and `"ml"` and `"g"` must be the
  metric base of their family (`base: 1`, `decimal: true`).
  Tests: "as métricas existem e são a base de cada família"
- **MEA-08** An unregistered unit name must fall back to `GENERICA = { passo: 0.25, min: 0.25 }`
  — no family, no plural change — and every unit used in the shipped data must nevertheless be
  registered.
  Tests: "toda unidade usada nos dados é conhecida pelo módulo"

## Conversion

- **MEA-09** Converting to the same unit must return the value unchanged; converting when
  either side has no family must return `null`.
  Tests: "mesma unidade devolve o mesmo valor", "unidade sem família não converte"
- **MEA-10** Within a family the conversion must be `valor * base(de) / base(para)`, and a
  same-family round trip must return the original value within `1e-9`.
  Tests: "ida e volta não perde valor", "volume: copo, xícara, colher e ml"
- **MEA-11** Across families the conversion must require a density in g/ml: volume→weight
  multiplies the ml amount by it, weight→volume divides. Without a density the result must be
  `null` — never a guess.
  Tests: "sem densidade, volume não vira peso", "com densidade, converte nos dois sentidos"
- **MEA-12** Density must be read only from the ingredient catalogue field `densidade`, and
  only when it is a `number`; the recipe file must never be a source of density.
  Tests: "densidade vem do catálogo, não da receita"

## Rounding and text

- **MEA-13** Rounding must snap to a kitchen multiple — `Math.round(valor / passo) * passo` —
  then clamp to at least `min`, so nothing ever rounds away to zero.
  Tests: "medidas caseiras: passo de ¼", "nada some ao reduzir muito (respeita o mínimo)"
- **MEA-14** `"g"` and `"ml"` must use the size-dependent step
  `v => (v >= 200 ? 25 : v >= 100 ? 10 : v >= 20 ? 5 : 1)`.
  Tests: "gramas grandes: passo de 25 quando o número não é redondo", "gramas pequenas: passo de 1"
- **MEA-15** A value the author already wrote roundly must survive untouched: `"g"` and `"ml"`
  declare `preservar: v => (v >= 20 ? v % 5 === 0 : Number.isInteger(v))`, which bypasses both
  step and minimum.
  Tests: "número já redondo é preservado (múltiplo de 5)"
- **MEA-16** A metric equivalence must be rounded finer than a recipe amount, with
  `passoEquivalencia: v => (v < 100 ? 1 : v < 1000 ? 5 : 25)` for `"g"` and `"ml"`, no minimum
  clamp and no `preservar` shortcut.
  Tests: "a equivalência é arredondada mais fino que a receita"
- **MEA-17** Units marked `decimal: true` (`"ml"`, `"L"`, `"g"`) must be written as pt-BR
  decimals with at most two fraction digits, never as fractions.
  Tests: "peso e volume saem em decimal, não em fração"
- **MEA-18** Every other unit must be written as an integer when the remainder is `< 0.02`, as
  integer + vulgar fraction when the remainder is within `0.02` of `¼ ⅓ ½ ⅔ ¾`, and otherwise
  as a pt-BR decimal — comma separator, never a point.
  Tests: "inteiros ficam inteiros", "frações viram símbolo", "decimal sem fração usa vírgula (pt-BR)"
- **MEA-19** The plural must be used only above 1: a value `<= 1` (including a fraction) takes
  the singular, and a unit with no `plural` field is invariable.
  Tests: "singular em 1 e em fração", "plural acima de 1", "unidades invariáveis não ganham s"
- **MEA-20** The unit word must be omitted entirely when the unit is marked `oculta` — only
  `"un."` is — so a countable reads "3", not "3 un.".
  Tests: "unidade \"un.\" fica oculta no texto"
- **MEA-21** Grams must be *displayed* in kilograms from `1000` upward, dividing by `1000` and
  writing at most two decimals. There must be no `ml`→`L` promotion.
  Tests: "grama passa a ser escrito em kg acima de mil", "feijão em grama não é clicável, e sai escrito em kg"

## Which conversions are offered

- **MEA-22** The conversion menu must offer only `MENU.volume = ["ml", "L", "copo", "xícara",
  "col. sopa", "col. chá"]` and `MENU.peso = ["g"]`, all of which must exist and belong to the
  declared family. A unit outside the menu must still convert — it is simply not suggested.
  Tests: "o menu de conversão só oferece medidas que existem", "medida fora do menu ainda converte, só não é sugerida"
- **MEA-23** A conversion must be refused when its rounding error would exceed
  `ERRO_MAXIMO = 0.04` (4%), when the raw result is `null` or `<= 0`, or when it falls below
  the target's `minConversao` (falling back to its `min`) — so `1 L` is never offered for
  360 ml, and a teaspoon is never offered as a fraction of a cup.
  Tests: "conversão inexata é recusada (4 col. sopa não é ¼ copo)", "conversão exata é aceita (3 col. sopa = ¼ copo)", "abaixo de 1 L não se oferece L", "valor minúsculo não vira fração de copo", "nenhuma alternativa exibida erra mais de 4%", "em todas as porções possíveis, ainda vale (varredura completa)"
- **MEA-24** The unit an amount is written in must not be offered as a conversion of itself, and
  pure weight must offer no alternative at all, because `MENU.peso` has one entry and `"kg"` is not
  a unit. (A line already showing a converted unit does list that unit, marked as current — that is
  MEA-26's way back, not a violation of this rule.)
  Tests: "a unidade atual não aparece como alternativa", "peso puro não tem alternativa nenhuma"
- **MEA-25** Candidates must be the unit's own family, plus the other family only when the
  ingredient has a density; every offered alternative must be a registered unit of an allowed
  family.
  Tests: "toda unidade das alternativas é conhecida e da família certa", "farinha oferece gramas porque a receita informa o peso"
- **MEA-26** When any alternative survives, the recipe's own unit must also be offered, so
  "como na receita" is always a way back; its text must be byte-identical to what the line
  already displays.
  Tests: "o menu lista a unidade da receita e as equivalentes", "a opção \"como na receita\" mostra exatamente o valor já exibido", "voltar para a unidade da receita limpa a marca", "\"como na receita\" não muda nada"
- **MEA-27** When no alternative survives, the measure must not be clickable at all — no empty
  menu.
  Tests: "medidas convertíveis são botões; as outras, texto", "feijão em grama não é clicável, e sai escrito em kg"
- **MEA-28** The measure menu must be a `role="menu"` with `role="menuitemradio"` items and
  `aria-checked` on exactly one; opening must set `aria-expanded="true"`, `Escape` and an
  outside click must close it, and closing must return focus to the trigger.
  Tests: "clicar abre o menu e marca aria-expanded", "a opção atual está marcada com aria-checked", "escolher ml troca o texto e sinaliza a troca", "o menu fecha depois de escolher", "clicar de novo no mesmo botão fecha o menu", "abrir outro menu fecha o anterior", "Esc fecha o menu", "clique fora fecha o menu", "há dica explicando que dá para clicar"

## The metric equivalence in parentheses

- **MEA-29** An ingredient already measured metrically (`g`, `ml`, `L`) must get no
  parenthetical equivalence.
  Tests: "medida já métrica não ganha parênteses"
- **MEA-30** A volume measure of a liquid must be expressed in ml from the measure table — the
  table is exact, though the result still passes through MEA-16's rounding; a volume measure of a
  non-liquid must be expressed in grams via its density, and must be omitted when there is no
  density.
  Tests: "líquido tem equivalência em ml; sólido, em gramas", "a equivalência não vem da receita, e sim do ingrediente", "sem densidade nem peso por unidade, não se inventa nota"
- **MEA-31** A countable or packaging measure must be weighed by
  `pesoPorUnidade[unidade]`, and this path must win over density even for a liquid — a can
  declares 395 g regardless of what the syrup weighs per ml.
  Tests: "contável e embalagem se pesam pelo peso por unidade"
- **MEA-32** An equivalence below `MINIMO_UTIL = 5` (in its own unit) must be suppressed: "0,6 g
  of bay leaf" informs nobody.
  Tests: "equivalência pequena demais não aparece"
- **MEA-33** The equivalence must scale with the servings, and must be replaced by the
  original recipe measure whenever the line itself was converted — the parenthesis always
  shows the other way of saying the amount, never a repetition of it.
  Tests: "a nota entre parênteses também escala", "convertido mostra a medida original entre parênteses", "nota redundante desaparece", "a medida original aparece entre parênteses"

## Which unit is displayed

- **MEA-34** The display unit must be decided in this order: the reader's manual choice for
  that line; the saved preference for the unit's own family; the saved preference for the other
  family, only when a density exists; the recipe's own unit.
  Tests: "escolha manual vence a preferência", "preferência da própria família tem prioridade", "sem preferência de volume, a de peso atravessa via densidade", "preferência de peso puxa o que pode ser pesado para gramas", "escolha manual continua vencendo a preferência", "preferência de volume converte copo em ml"
- **MEA-35** A unit with no family must be returned immediately, so preferences never touch
  countables.
  Tests: "o que não converte fica intacto", "sem densidade no catálogo, a preferência de peso não alcança"
- **MEA-36** The sentinel `"receita"`, and any falsy preference, must mean "no preference".
  Tests: "\"como na receita\" não muda nada", "começa em \"como na receita\"", "valor inválido salvo cai no padrão"
- **MEA-37** A preference or manual choice that fails the usefulness test (MEA-23) must be
  ignored in silence, falling back to the recipe's unit.
  Tests: "preferência impossível cai na unidade da receita", "escolha manual impossível é ignorada", "sem densidade, a outra família não atravessa"
- **MEA-38** A manual choice must be forgotten when the reader moves to another recipe; a
  preference must not.
  Tests: "trocar de receita limpa as trocas manuais", "preferência sobrevive à troca de receita"

## Scaling

- **MEA-39** The multiplier must be `porcoes / receita.porcoes.padrao`, and at the default
  servings the output must be byte-identical to the authored data — no drift at multiplier 1.
  Tests: "fator confere", "no padrão, nada é alterado em relação ao arquivo de dados"
- **MEA-40** A scaled line must be computed as `qtd * mult`, converted to the display unit, then
  rounded; when the conversion yields `null`, the raw value must take its place **before** the
  rounding, so an unconvertible line is still rounded like any other.
  Tests: "ingredientes recalculam junto", "preferência combina com escala de porções"
- **MEA-41** Scaling must be reversible: stepping up then back down must restore the exact
  previous text.
  Tests: "escalar e voltar recupera o valor original (ida e volta)", "a troca sobrevive à mudança de porções"
- **MEA-42** A requested servings count must be normalised by snapping to the grid anchored at
  `min` with spacing `passo` (defaulting to 1), then clamping into `[min, max]`; a non-finite
  request must fall back to `padrao`.
  Tests: "valor fora do passo encaixa na grade", "valor abaixo do mínimo é elevado", "valor acima do máximo é cortado", "texto inválido volta ao padrão", "passo próprio de cada receita (bolo: 6 fatias)"
- **MEA-43** Cooking and baking times must not be scaled, and the page must say so when the
  servings leave the default (REC-29).

## Known gaps

- `"L"` is an offered volume preference but no test exercises rounding, formatting or display
  in litres (MEA-17).
- The `5` and `25` bands of `passoEquivalencia` (MEA-16) and the `minConversao` values `0.5`
  and `1` of the spoons (MEA-23) are untested.
- `emGramas` — the bridge every weight-based figure depends on — has no direct test; it is
  covered only through prices and nutrients.
- `MENU` order and "the recipe's unit comes first in the list" (MEA-26) are untested.
- MEA-43 has no test at all: the cited scale warning proves the sentence is on screen, not that
  `receita.tempo` was left alone. Nothing reads `tempo` in the scaling path, which is why it holds.
- `equivalenciaMetrica` reads `ing.densidade` for truthiness while everything else goes
  through `densidadeDe` (`typeof === "number"`): a density of `0` would behave differently on
  the two paths. Neither path is exercised with `0`.
