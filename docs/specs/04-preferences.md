# PRF — Preferences

`src/js/settings.js`. Five things the reader may set, one storage key, and a panel that never
corrects them silently. PRF-11's "has the reader personalised anything?" check lives in
`src/js/nutrition.js`, beside the references it compares against.

## The model

- **PRF-01** The preference object must have exactly the keys `peso`, `volume`, `mercado`,
  `diario`, `macros`, with the defaults `peso: "receita"`, `volume: "receita"`,
  `mercado: "todos"`, `diario: { kcal: 2000, fibra: 25, sodio: 2400 }`,
  `macros: { proteina: 15, carboidrato: 60, gordura: 25 }` — the Brazilian labelling reference
  for a 2 000 kcal diet, whose macro percentages sum to 100.
  Tests: "padrão vem da rotulagem brasileira", "objeto vazio devolve tudo no padrão"
- **PRF-02** The display-unit options must be exactly `peso: ["receita", "g"]` and
  `volume: ["receita", "ml", "L", "copo", "xícara", "col. sopa"]`; any other value must fall
  back to `"receita"`.
  Tests: "as unidades continuam saneadas junto", "valor válido é preservado"
- **PRF-03** Each **daily** field must declare its own limits — `kcal` 800–6000 (UI step 50),
  `fibra` 5–100 (step 1), `sodio` 500–6000 (step 100) — with `min < max`, a default inside them, a
  label and a unit. A macro field declares only its name and label; its 0–100 range is PRF-04's and
  lives in the sanitiser, not in the field descriptor.
  Tests: "valor acima do máximo é cortado", "valor abaixo do mínimo é elevado", "todo campo declarado tem limites coerentes", "os campos de consumo diário existem, com limites"
- **PRF-04** Each macro target must be a percentage between 0 and 100 with `CASAS_MACRO = 1`
  decimal place. The decimal is not cosmetic: at 2 000 kcal an integer percentage would make
  protein grams jump in steps of 5 g.
  Tests: "a porcentagem do macro guarda uma casa decimal", "macro fica entre 0 e 100", "todo campo declarado tem limites coerentes"

## Sanitisation

- **PRF-05** `null`, `undefined` and `""` must fall back to the field's default — "not
  informed" must never be coerced to `0` and then clamped up to the minimum.
  Tests: "texto e vazio caem no padrão do campo"
- **PRF-06** Text, `NaN` and `Infinity` must fall back to the field's default.
  Tests: "texto e vazio caem no padrão do campo"
- **PRF-07** A numeric value must be rounded to the field's decimal places and then clamped
  into range, in that order. The UI `passo` is a step for the control only and must not be
  applied on sanitisation: `1850.7` becomes `1851`, not `1850` or `1900`.
  Tests: "número quebrado é arredondado", "a porcentagem do macro guarda uma casa decimal"
- **PRF-08** Sanitisation must run field by field, always returning the full set of keys, and
  must never mutate its input.
  Tests: "objeto vazio devolve tudo no padrão", "valor válido é preservado"
- **PRF-09** A stored market that no longer exists in the catalogue must fall back to
  `"todos"`: stored data never outranks current data.
- **PRF-10** The macro sum must be computed, rounded to one decimal, and never imposed: a
  missing macro counts as 0, and the reader's numbers are left as typed.
  Tests: "soma de macros é calculada, não imposta"
- **PRF-11** The system must recognise when the reader has personalised any reference — a daily
  value or a macro target — and must not count unit-display preferences as personalisation.
  Tests: "reconhece quando o leitor personalizou algo"

## Grams and percent

- **PRF-12** The distribution must be stored as a **percentage**, so changing the daily calories
  preserves the distribution and moves only the grams.
  Tests: "mudar as calorias do dia move as gramas, não a porcentagem", "mudar as calorias do dia recalcula as gramas de todos os macros"
- **PRF-13** Grams→percent must be the exact inverse of percent→grams, and a round trip must
  return the same gram figure.
  Tests: "gramas e porcentagem são o mesmo número em duas roupas", "a mesma gramagem vale outra porcentagem em outra dieta", "porcentagem sem casa decimal seria imprecisa em gramas", "um valor em gramas que não é % redondo sobrevive"
- **PRF-14** A percentage must be written pt-BR with no trailing zeros: `15`, `15,2` — never
  `15.2` or `15,0`.
  Tests: "formatarPct não escreve zero à direita", "meta com decimal usa vírgula, como todo número da página"

## Storage

- **PRF-15** Preferences must be persisted under the single key `"receitas:preferencias"`.
  Tests: "o que foi digitado é gravado no navegador", "as preferências sobrevivem a recarregar a página"
- **PRF-16** A missing key, unavailable `localStorage` or corrupted JSON must fall back to the
  full defaults, and a blocked write must be swallowed — the session continues unsaved rather
  than breaking.
- **PRF-17** The accessor must re-read storage on every call, and must not hand out the panel's
  in-memory copy: the active market is changed from *outside* the panel, and a stale copy once
  made a recipe page show the previous market's price.

## The panel

- **PRF-18** Each macro must have two controls bound to the same stored value — a percentage
  range and a grams number field — plus a spoken echo, with a label, `aria-describedby` and an
  `aria-label` on the grams field.
  Tests: "cada macro tem barra em % e campo em gramas", "a barra tem rótulo e o eco é lido junto"
- **PRF-19** The grams field's ceiling must be a whole day of that macro, and must be recomputed
  when the daily calories change.
  Tests: "o teto do campo em gramas é o dia inteiro naquele macro", "gramas acima do teto param no teto, sem estourar 100%", "mudar as calorias do dia recalcula as gramas de todos os macros"
- **PRF-20** Both macro controls must write the same stored percentage, and each must move the
  other immediately.
  Tests: "arrastar a barra atualiza as gramas na hora", "digitar gramas move a barra na hora"
- **PRF-21** A control being edited must not be rewritten while typing or dragging — rewriting
  moves the caret and freezes the slider — but must be corrected into range when the reader
  leaves the field.
  Tests: "valor fora dos limites volta para dentro ao sair do campo"
- **PRF-22** An empty control must be ignored while typing rather than sanitised to a value.
- **PRF-23** A macro sum other than 100% must be announced in an `aria-live="polite"` region,
  saying what a complete distribution would be, and must not correct any value.
  Tests: "a soma dos macros aparece e começa em 100%", "soma diferente de 100 é avisada, sem corrigir o valor"
- **PRF-24** "Back to defaults" must restore every field, numbers included.
  Tests: "\"voltar ao padrão\" limpa tudo", "\"voltar ao padrão\" limpa também os números"
- **PRF-25** Every change must sanitise, save, refresh the sum and notify the rest of the page —
  including a nutrient dialog that is already open.
  Tests: "preferência mudada com a janela aberta redesenha a janela", "mudar o diário muda o % mostrado", "a meta de macro reaparece como referência em gramas na barra", "a meta em porcentagem aparece na legenda da rosca"
- **PRF-26** The panel must have the four groups (weight, volume, daily intake, macros) and must
  open without error from the header.
  Tests: "o painel tem os quatro grupos", "abre sem erro pelo botão da barra lateral"
- **PRF-27** A unit preference must reach the ingredient list immediately, and must reach only
  what can actually be converted.
  Tests: "escolher volume em ml reflete na lista na hora", "colheres também seguem a preferência", "o que não converte fica intacto", "preferência é gravada no navegador", "valor salvo é aplicado ao carregar", "valor inválido salvo cai no padrão"
- **PRF-28** The panel must state that the initial figures are labelling references for a
  2 000 kcal diet and not a recommendation, and that an individual requirement is a question for
  a professional.

## Known gaps

- PRF-09, PRF-16, PRF-17, PRF-22 and PRF-28 have no test. PRF-17 is the very regression the
  code comments document.
- The `passo` values (50 / 1 / 100) are never asserted, in the constants or as a rendered
  `step` attribute (PRF-03).
- `sanear` dropping unknown top-level keys is untested (PRF-08); unknown keys inside `macros`
  in fact pass through into the targets.
- `tests/preferences.test.mjs` passes an `async` function to the synchronous `ok` helper in
  "as preferências sobrevivem a recarregar a página", so a failed assertion inside it would be
  an unhandled rejection instead of a counted failure.
