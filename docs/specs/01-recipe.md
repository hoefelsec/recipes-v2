# REC — The recipe

The data contract of a recipe file, and the page that renders it.
Data: `src/data/<slug>.js`. Registry: `src/data/index.js`. Page: `src/js/recipe-view.js`.

## The recipe object

- **REC-01** A recipe must be the default export of `src/data/<slug>.js`, a plain object with
  the required fields `slug`, `nome`, `grupo`, `porcoes`, `ingredientes`, `utensilios`,
  `preparo`, and the optional fields `descricaoCurta`, `resumo`, `imagem`, `tempo`,
  `dificuldade`, `rendimento`, `notaEscala`.
- **REC-02** `porcoes` must be `{ padrao, min, max, passo, unidade }`, optionally
  `unidadeSingular`. `padrao` is the divisor of every per-portion figure; `unidade` is
  displayed next to the number.
  Tests: "todas têm min < padrão < max e passo compatível"
- **REC-03** Every recipe must satisfy `min <= padrao <= max`,
  `(padrao - min) % (passo ?? 1) === 0`, and a non-empty `porcoes.unidade`.
  Tests: "todas têm min < padrão < max e passo compatível"
- **REC-04** `imagem` must be `{ src, alt, credito: { autor, url } }`; `alt` is mandatory.
  Tests: "toda imagem tem alt"
- **REC-05** `preparo` must be an ordered array of `{ titulo, texto, dica? }`; `dica` may
  contain HTML written by the author.
- **REC-06** `tempo` must be `{ valor, unidade, detalhe }`, where `valor` is a **string** —
  it is a label ("3", "1 h 20"), not an amount to compute with.

## The ingredient line

- **REC-07** An entry of `ingredientes` must be exactly one of two shapes: a separator
  `{ subtitulo }`, or an ingredient line `{ ing, qtd?, un?, detalhe?, escala?, texto?,
  itemSingular? }` where `ing` is a catalogue id.
- **REC-08** A `{ subtitulo }` entry must carry no ingredient and no quantity, must be
  skipped by every integrity check and every sum, and must pass through scaling unchanged as
  `{ subtitulo }`.
  Tests: "subtítulo passa intacto", "subtítulos não entram na lista"
- **REC-09** The system must treat `escala: false` and `qtd == null` identically everywhere —
  the guard is always the disjunction `ing.escala === false || ing.qtd == null`. Such a line
  does not scale, is not converted, is excluded from cost, from nutrients and from the
  purchase, and displays `texto` (defaulting to `""`) in place of a quantity.
  Tests: "\"a gosto\" não escala", "\"a gosto\" continua \"a gosto\"", "\"a gosto\" fica com a célula vazia, não sem célula", "\"a gosto\" não tem peso", "\"a gosto\" não tem custo", "\"a gosto\" não é somado", "\"a gosto\" não entra na folha"
- **REC-10** `detalhe` must accept either a string (an invariant preparation: `"dessalgada"`,
  `"em cubos"`) or `{ um, muitos }` for a preparation that agrees in number.
  Tests: "o preparo da receita não se perde: desce para o parêntese"
- **REC-11** The preparation must live in the recipe, never in the catalogue: no catalogue
  `nome` may contain `"picad"`, `"amassad"`, `"em cubos"`, `"em rodelas"`, `"dessalgad"` or
  `"ralad"`.
  Tests: "o preparo fica na receita, não no catálogo"
- **REC-12** Each line must produce `item` (plural name + plural detail) and `itemSingular`
  (singular name + singular detail); the singular is displayed only when the scaled value is
  `<= 1`, the line was not unit-converted, and `itemSingular` exists.
  Tests: "item vai para o singular quando cabe"
- **REC-13** A recipe file must not write the metric equivalence by hand: a `nota` field must
  be ignored, and the equivalence must be derived from the ingredient (see MEA-24).
  Tests: "a receita não escreve mais a nota; um campo `nota` é ignorado", "nenhum arquivo de receita escreve a equivalência à mão"

## The registry

- **REC-14** `src/data/index.js` must resolve every recipe exactly once, at module load, and
  export the resolved list as `receitas`; consumers must never see raw lines.
- **REC-15** `porSlug(slug)` must return the recipe with that slug, or `undefined`.
  Tests: "o escopo do carrinho não colide com slug de receita"
- **REC-16** `agrupadas(lista)` must order groups by
  `GRUPOS = ["Pratos principais", "Doces", "Acompanhamentos", "Bebidas"]`, place any group
  absent from that list after all listed ones sorted with `localeCompare(a, b, "pt-BR")`, and
  keep registry order inside a group.
- **REC-17** A resolved recipe must carry both `ingredientes` (resolved) and `linhas` (the
  untouched authored array).

## The page

- **REC-18** The article must be, in this order: `.hero` as its `firstElementChild`, `dl.meta`,
  then `.wrap` with `.col-left` (Ingredientes card, `#cartao-nutri`, Utensílios card) and the
  Modo de preparo column, then `<p class="sr-only" id="conv-anuncio" aria-live="polite">`.
  Tests: "foto do resultado final no topo", "as 5 seções obrigatórias existem"
- **REC-19** The page must contain exactly one `main h1`, the recipe name.
  Tests: "hierarquia de títulos: um só h1"
- **REC-20** The hero image must declare `width="1600" height="900"`, an `alt` of more than 10
  characters, and `onerror="this.onerror=null;this.src='<IMAGEM_RESERVA>'"` so a dead URL
  becomes a gradient and never a broken-image icon.
  Tests: "imagem tem fallback declarado (onerror)", "toda imagem tem alt"
- **REC-21** `dl.meta` must have exactly five `> div` children: Porções (`.meta-porcoes`),
  Tempo de preparo, Dificuldade, Rendimento, and `.meta-add` with
  `<button id="add-carrinho">`.
  Tests: "faixa de dados: 4 campos + botão de carrinho"
- **REC-22** In every `main .ing li:not(.sub)` the first child must be `.ing-nome` and the
  second `.qty` — the name before the amount, because the reader scans for the thing first.
  Tests: "na lista de ingredientes, o nome vem antes da quantidade", "toda linha tem as três colunas na mesma ordem", "cada linha com quantidade mostra um preço"
- **REC-23** Every `main section[aria-labelledby]` must point at an id that exists on the page.
  Tests: "seções com aria-labelledby apontando para id existente"
- **REC-24** For every recipe, the screen counts must equal the data: `main h1` is `nome`,
  `.steps > li` counts `preparo`, `.ut li` counts `utensilios`, `.ing li:not(.sub)` counts
  ingredient lines, `.ing li.sub` counts subtitles, and `.meta` states `porcoes.padrao` and
  `porcoes.unidade`.
  Tests: "contagens conferem com o arquivo de dados"
- **REC-25** The servings control must be `<div class="porcoes" role="group"
  aria-label="Número de porções">` with two `.pbtn` buttons carrying `data-passo="-1"` and
  `data-passo="1"` and an `<output class="pval" id="porcoes-valor" aria-live="polite">`; each
  button is `disabled` at its limit, and a click on a disabled button does nothing.
  Tests: "botões existem, com rótulo acessível e aria-live no valor", "botão − desativa no mínimo", "botão + desativa no máximo", "clique no botão desativado não faz nada"
- **REC-26** The stepper must also respond to the keyboard: `ArrowUp`/`ArrowRight` add one
  step, `ArrowDown`/`ArrowLeft` subtract one, both with `preventDefault()`.
  Tests: "setas ajustam o valor"
- **REC-27** A servings change must be a no-op when the normalised result equals the current
  value — no redraw, no URL write, no callback.
- **REC-28** An effective servings change must update the value output, the ingredient list,
  `#custo-total`, `#nota-preco`, the scale warning, the `disabled` state of every `.pbtn`, and
  `document.body.dataset.porcoes`.
  Tests: "mostra o padrão da receita ao abrir", "clicar em + soma um passo (2 porções)", "ingredientes recalculam junto", "subtítulos sobrevivem ao recálculo", "mudar as porções muda o preço na mesma proporção", "trocar de receita zera as porções da anterior"
- **REC-29** The scale warning `<p class="escala-aviso">` must appear only when the current
  servings differ from `porcoes.padrao`, and must say that stove and oven times change little
  — "confie no ponto, não no relógio" — because time does not scale linearly.
  Tests: "aviso de escala aparece fora do padrão"
- **REC-30** `#add-carrinho` must add the recipe at the servings currently displayed and
  confirm with a toast, not by renaming itself (see LIS-09).
  Tests: "a página da receita também adiciona ao carrinho", "adiciona com as porções ajustadas na página"
- **REC-31** Unit swaps and product choices must be announced in `#conv-anuncio`
  (`.sr-only`, `aria-live="polite"`), and the servings `<output>` is itself `aria-live`.
- **REC-32** Every listener the recipe page attaches outside its own subtree (`#produtos`,
  `#nutri-detalhes`, `document`) must be registered with `{ signal }` and torn down by
  `destruir()`; otherwise a second visit would serve clicks with the previous recipe's
  listeners.

## Known gaps

- REC-05 (`dica` HTML), REC-06 (`tempo` shape), REC-14, REC-16, REC-17, REC-27, REC-31 and
  REC-32 have no test.
- `unidadePorcao` / `textoPorcoes` (REC-02's singular rule) are implemented twice, verbatim,
  in `src/js/ui.js` and `src/js/recipe-view.js`.
- The recipe page's stepper uses `data-passo` (±1, multiplied by `porcoes.passo` on click)
  while the list card's uses `data-delta` (±`passo` directly): one visual control, two
  attribute contracts.
