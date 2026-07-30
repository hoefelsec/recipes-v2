# Specs

This folder is the source of truth for **what the site does**. `docs/decisions.md` is the
source of truth for **why**. When the two disagree, the spec wins on behaviour and the
decisions file wins on rationale — and one of them needs fixing.

## Files

| File | Prefix | Covers |
| --- | --- | --- |
| [01-recipe.md](01-recipe.md) | `REC` | The recipe data contract and the recipe page |
| [02-measures.md](02-measures.md) | `MEA` | Units, conversion, rounding, text, scaling, portions |
| [03-nutrition.md](03-nutrition.md) | `NUT` | Nutrient estimate, daily values, distribution |
| [04-preferences.md](04-preferences.md) | `PRF` | Reader preferences and their panel |
| [05-ingredients.md](05-ingredients.md) | `ING` | The ingredient tree, inheritance, resolution, integrity |
| [06-products-and-stores.md](06-products-and-stores.md) | `PRD` | Products, stores, the price relation, store scoping |
| [07-pricing.md](07-pricing.md) | `PRC` | Unit price, cost of a request, recipe cost, money text |
| [08-product-choice.md](08-product-choice.md) | `CHO` | Choosing a product, its storage, the picker dialog |
| [09-purchase-flow.md](09-purchase-flow.md) | `BUY` | Cart, shopping list, purchase model, the three steps, the sheet |
| [10-recipe-list.md](10-recipe-list.md) | `LIS` | The recipe list, its search and its filter panel |
| [11-shell.md](11-shell.md) | `SHL` | Routing, header, accessibility, CSS discipline |

## How a requirement is written

    - **MEA-07** The system must round `"g"` and `"ml"` in steps of
      `v => (v >= 200 ? 25 : v >= 100 ? 10 : v >= 20 ? 5 : 1)`.
      Tests: "gramas grandes: passo de 25 quando o número não é redondo", "gramas pequenas: passo de 1"

Three parts, all load-bearing:

1. **A stable id.** Ids are never reused and never renumbered. A requirement that dies is
   marked `WITHDRAWN` in place, with one line saying why. Renumbering would silently
   re-point every test that cites the old number.
2. **One testable sentence**, with the constants quoted from the code. A requirement whose
   numbers live only in the code is a comment, not a spec.
3. **`Tests:`** — the verbatim names of the checks that verify it, or nothing at all.

## Traceability

`node tests/spec-coverage.mjs` reads this folder and the test suites and reports:

- **dangling ids** — a test citing `[XXX-nn]` that no spec declares. This **fails** the suite.
- **uncovered requirements** — a requirement with no `Tests:` clause.
- **unclaimed tests** — a check that no requirement cites.

The last two are printed as counts, not failures: a gap is a fact to look at, not a reason
to block a commit. The first is a lie in the repository, so it breaks the build.

Test names carry their ids as a prefix, which is why the citation must match exactly:

    ok("[MEA-07] gramas grandes: passo de 25 quando o número não é redondo", () => { … });

The coverage report is also run as part of `node tests/run.mjs`.

## Adding a feature, spec first

1. Write the requirement here, with the next free id in that file and no `Tests:` clause.
2. Write the test, prefixed with the id.
3. Write the code.
4. Add the test name to the `Tests:` clause.
5. If the requirement needed a judgement call, add the reasoning to `docs/decisions.md`.

## Reading conventions

- **"must"** is a requirement. **"may"** is permission. **"must not"** is a prohibition.
- Portuguese identifiers, filenames, storage keys and on-screen strings are quoted as they
  appear in the code, because that is what they are.
- Money is BRL, formatted pt-BR. Measures are metric. The site is Brazilian.
- Where a rule exists to prevent a specific past defect, the defect is named. Those lines
  are regression fences, not decoration.
