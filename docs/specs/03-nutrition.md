# NUT — Nutrients

`src/js/nutrition.js`. Everything here is an estimate over raw ingredients, and the screen
must say so.

## Grams, the common measure

- **NUT-01** The catalogue must declare nutrients per `NUTRIENTES_POR = 100` grams (100 ml for
  liquids), over exactly the fields
  `CAMPOS_NUTRIENTES = ["kcal", "proteina", "carboidrato", "gordura", "fibra", "sodio"]`, so
  the only per-line work is deriving grams.
  Tests: "escala pelos gramas sobre a base de 100 g", "cada entrada do catálogo tem nome e forma de nutrientes válida"
- **NUT-02** Grams must be derived by three routes and no others: a weight unit converts
  directly; a volume unit converts through the ingredient's `densidade`; anything else uses
  `pesoPorUnidade[unidade]`.
  Tests: "unidade de peso vai direto", "unidade de volume usa a densidade do ingrediente", "unidade contável usa peso por unidade"
- **NUT-03** When grams cannot be derived — no density for a volume, no weight per unit for a
  countable, no quantity, no unit — the result must be `null`, never `0`.
  Tests: "contável sem peso por unidade devolve null", "volume sem densidade devolve null", "\"a gosto\" não tem peso"
- **NUT-04** Each nutrient must scale linearly as `valor * gramas / 100`.
  Tests: "escala pelos gramas sobre a base de 100 g"
- **NUT-05** An ingredient with no nutrition object must yield `null`; a *field* missing inside
  an existing object must count as `0`, never `NaN`. The two absences mean different things.
  Tests: "ingrediente sem dado nutricional devolve null", "campo ausente no catálogo conta como zero, não como NaN"

## The recipe estimate

- **NUT-06** A line whose catalogue nutrition is `null` must be skipped **silently**: `null` is
  an editorial decision (the bay leaf leaves the pot, the paper cup is not food), not a gap,
  and it must not make the recipe incomplete.
  Tests: "louro e forminha ficam fora sem virar lacuna", "o que não é comida não tem nutrientes"
- **NUT-07** A line with no quantity must be excluded **and reported**, with the reason
  `"quantidade a gosto"`.
  Tests: "o que é a gosto é relatado, não somado em silêncio"
- **NUT-08** A line that cannot be weighed must be excluded and reported with the reason
  `` `não dá para pesar ${un}` ``.
- **NUT-09** Exclusions must be reported as `{ nome, motivo }` in ingredient order, and
  `completa` must be `deFora.length === 0` — completeness counts *reported* exclusions only.
  Tests: "o que é a gosto é relatado, não somado em silêncio", "o que ficou de fora é declarado", "o que ficou de fora também aparece na janela"
- **NUT-10** Every recipe must produce finite, non-negative figures for all six nutrients, with
  at least one counted line and a positive total weight.
  Tests: "todas as receitas produzem números finitos e positivos"
- **NUT-11** The per-portion figure must be the total divided by `porcoes.padrao`, and the
  displayed total must equal per-portion × portions.
  Tests: "o total é o valor por porção vezes o número de porções"
- **NUT-12** The per-portion figure must not change when the reader changes the servings —
  scaling multiplies ingredients and portions by the same factor, and the division cancels.
  Tests: "o valor por porção não muda ao mexer no seletor de porções"
- **NUT-13** The calories of a portion must agree with `4·proteína + 4·carboidrato + 9·gordura`
  within 6% for every recipe — an independent cross-check against a data-entry slip.
  Tests: "as calorias conferem com 4/4/9 dos macros (aferição independente)"
- **NUT-14** Per-portion energies must stay inside plausibility fences: a brigadeiro between 40
  and 140 kcal, a slice of carrot cake between 200 and 700, and nothing above 3000 — a unit
  error is caught here rather than on screen.
  Tests: "valores por porção são plausíveis"

## Daily values

- **NUT-15** The reference daily values must be the Brazilian labelling ones for a 2 000 kcal
  diet: `kcal: 2000`, `fibra: 25 g`, `sodio: 2400 mg`, with `BASE_DIARIA_KCAL = 2000`.
  Tests: "a referência é a da rotulagem brasileira"
- **NUT-16** The reference caloric distribution must be
  `METAS_MACROS = { proteina: 15, carboidrato: 60, gordura: 25 }`, and the energy factors
  `KCAL_POR_GRAMA = { proteina: 4, carboidrato: 4, gordura: 9 }`.
  Tests: "energia de cada macro é gramas × 4/4/9", "padrão vem da rotulagem brasileira", "metas de macro seguem as preferências"
- **NUT-17** The reader's preferences must override the reference values field by field, while
  the **unit** always comes from the reference, never from the reader.
  Tests: "valores diários seguem as preferências", "sem preferências, valem os de referência", "percentual diário usa o número do leitor"
- **NUT-18** A macro's daily reference in grams must be *derived* from the daily calories and
  the chosen distribution — `(kcalDia × pct / 100) / kcalPorGrama` — never entered separately.
  Tests: "macro tem referência diária derivada dos macros escolhidos", "mudar as calorias do dia move as gramas, não a porcentagem"
- **NUT-19** A percentage of the daily value must be `valor / referência × 100`, and a nutrient
  with no reference at all must yield `null` and be dropped from the list rather than shown as
  zero.
  Tests: "valor igual à referência dá 100%", "passar da referência passa de 100%", "caloria tem referência diária", "nutriente sem referência nenhuma devolve null"
- **NUT-20** The daily-impact list must follow the fixed order
  `ORDEM = ["kcal", "proteina", "carboidrato", "gordura", "fibra", "sodio"]`, and a derived
  reference must be tagged as derived.
  Tests: "os detalhes trazem os seis nutrientes como % do dia", "os valores conferem com a conta feita à mão"
- **NUT-21** The screen must cite the labelling basis and say it is not an individual
  requirement while the references are untouched, and must stop citing it once the reader has
  set their own.
  Tests: "declara a base do valor diário e que não é individual", "no padrão, a janela cita a referência da rotulagem", "com valores próprios, a janela para de citar a rotulagem"

## Caloric distribution

- **NUT-22** The distribution must be computed against the macro-derived energy only — a
  distribution of the portion, not a comparison with the table — so the exact percentages sum
  to 100.
  Tests: "as porcentagens exibidas somam exatamente 100", "as fatias da rosca somam 100", "as barras medem o dia, então não somam 100"
- **NUT-23** Displayed percentages must be rounded by largest remainder, so the screen never
  shows 99% or 101%, and the exact value must remain available beside the rounded one.
  Tests: "arredondamento ingênuo daria 99% ou 101%, e aqui não dá"
- **NUT-24** A portion with no macro energy must yield zero percentages, not `NaN`.
  Tests: "receita sem macros não estoura"
- **NUT-25** The gap to the reader's target must be expressed in percentage points, computed
  from the rounded percentage; changing a target must move only the target and the gap, never
  the recipe's real distribution.
  Tests: "a distribuição traz meta e diferença em pontos percentuais", "mudar a meta não muda a distribuição real", "mudar a meta muda a referência das barras, não a rosca"

## Display

- **NUT-26** Calories must be written as an integer with `"kcal"`; sodium as an integer with
  `"mg"`; every other nutrient in grams, with one decimal below 10 g and none from 10 g up,
  pt-BR formatted.
  Tests: "caloria em inteiro, macro com decimal quando pequeno, sódio em mg"
- **NUT-27** The card must show the six nutrients with calories first and in relief, state that
  the figures are an estimate over raw ingredients, and declare what was left out.
  Tests: "o cartão aparece com os seis nutrientes", "as calorias vêm primeiro e em destaque", "o cartão diz que é estimativa e sobre ingredientes crus", "o que ficou de fora é declarado"
- **NUT-28** The card must sit between the ingredients and the utensils.
  Tests: "o cartão fica entre os ingredientes e os utensílios"
- **NUT-29** The detail dialog must exist closed, open from the card or its button, announce
  itself as opening a dialog, and close by its button or by the backdrop.
  Tests: "a janela existe e começa fechada", "o botão do cartão abre a janela", "o botão anuncia que abre um diálogo", "clicar no cartão também abre", "fecha pelo botão", "fecha clicando no fundo escuro"
- **NUT-30** The dialog must show six daily bars — each naming the reference it is a fraction
  of, none drawn wider than 100% — and a donut of the caloric distribution that closes the
  circle, chains its slices, states its 4/4/9 basis and is readable by a screen reader.
  Tests: "mostra a receita e a porção de referência", "seis barras, uma por nutriente, com valor e referência", "cada barra diz de que referência é a fração", "nenhuma barra passa de 100% de largura", "a rosca fecha o círculo e as fatias se encadeiam", "a rosca é legível por leitor de tela", "explica a base 4/4/9 da rosca", "a legenda mostra a meta ao lado do que a receita entrega"
- **NUT-31** The dialog must always reflect the recipe currently open.
  Tests: "a janela reflete a receita aberta"

## Product labels

- **NUT-32** A chosen product's label must override the catalogue **field by field**, keeping
  the catalogue value wherever the label is silent, and the overridden field names must be
  recorded so the screen can say the numbers come from a label.
  Tests: "o rótulo do produto entra nos nutrientes", "onde o rótulo cala, o valor continua vindo da tabela", "os nutrientes avisam quando vêm de um rótulo", "rótulo parcial é aceito (só proteína, carboidrato e gordura)"
- **NUT-33** A label must never fill a catalogue `null`: the `null` is a decision, and the
  ingredient stays out of the count with or without a product.
  Tests: "null no catálogo é decisão, e o rótulo não a desfaz"

## Known gaps

- NUT-08's reason string is unreachable with the shipped data, so the branch is untested.
- An **empty** nutrition object (`{}`) is truthy and therefore yields all-zero nutrients rather
  than `null` (NUT-05).
- A macro target of exactly `0%` makes its gram reference `null`, which drops the nutrient from
  the daily list — fewer than six bars (NUT-18, NUT-19). Untested.
- With no macro energy the *rounded* percentages sum to 0, not 100 (NUT-24).
- Subtitle rows are skipped by the estimate with no test.
