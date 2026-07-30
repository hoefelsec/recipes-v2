# Caderno de Receitas

Um caderno de receitas de casa que também sabe fazer a **lista de compras** — com
quantidades recalculadas para o número de pessoas, o preço estimado de cada prato e
uma folha de mercado no fim, pronta para imprimir.

Não é um app de receitas com um botão de lista pregado do lado. As três coisas são a
mesma: a receita diz **quanto**, o catálogo diz **o que é** e a prateleira diz
**quanto custa e em que embalagem vem**. Escolher farinha Dona Benta em vez de a
granel muda o preço do bolo, o total da compra e o que está escrito na folha.

Site estático: HTML, CSS e JavaScript (módulos ES) puros. Sem framework, sem build,
sem servidor. Tudo o que o leitor escolhe fica no navegador dele.

---

## Para que serve

**Cozinhar a partir de uma receita que se ajusta.** Cada receita tem um intervalo de
porções. Mudando o número no seletor, todas as quantidades são recalculadas na hora,
com arredondamento de cozinha: `2 ½ copos`, não `2,4938 copos`. Tempo de fogo não é
escalado — não é uma relação linear, e há um aviso dizendo isso quando a receita sai
do padrão.

**Ler a medida do jeito que se mede.** Clicar numa quantidade abre as equivalências
já calculadas — copo para ml, colher para copo, volume para gramas quando o
ingrediente tem densidade. Em **Preferências** dá para fixar a unidade preferida de
peso e de volume para todas as receitas.

**Saber quanto custa antes de decidir.** Cada linha de ingrediente mostra o que
aquela quantidade custa, e a receita mostra o total e o custo por porção. Clicando no
ingrediente, a janela de produtos lista as opções com preço da embalagem e preço por
kg/L/unidade — as duas réguas, porque uma serve para comparar e a outra para saber o
que sai da carteira.

**Comprar num mercado específico.** Escolhendo o mercado no cabeçalho do site, todo
número passa a ser o dali e a lista de produtos passa a oferecer só o
que se compra lá. A receita avisa em **amarelo** o produto que você escolheu e aquele
mercado não vende, e em **vermelho** o ingrediente que ele não tem de jeito nenhum.
Sem mercado escolhido, o site compara o mais barato entre todos — que é o que ele
fazia antes de existir mercado.

**Estimar nutrientes por porção.** Macros, calorias, fibra e sódio, com a cobertura
declarada: quando falta dado de algum ingrediente, o cartão diz de quantos
ingredientes a conta é feita em vez de somar o que tem e chamar de total.

**Montar a compra da semana.** As receitas viram uma vitrine, entram no carrinho com
as porções escolhidas, e dali sai um assistente de três passos que termina numa folha
de mercado com uma linha por item.

## Casos de uso

| Situação | O que o site faz |
| --- | --- |
| "Vou fazer feijoada para 20, não para 8" | Recalcula tudo, avisa que o tempo de fogo não dobra e mostra a `notaEscala` da receita |
| "Quanto sai esse bolo?" | Total e custo por fatia, pelo produto mais barato que serve — ou pelo que você escolher |
| "Compensa o pacote de 5 kg?" | Na janela de produtos, o preço por kg lado a lado com o preço da embalagem |
| "O que preciso comprar para essas três receitas?" | Soma por ingrediente, converte para medida de mercado e conta **embalagens inteiras** |
| "Já tenho farinha em casa" | Marca a caixa: sai da folha e do total da compra, e continua contando no custo das refeições |
| "Uma receita pede manteiga sem sal e a outra qualquer" | Compra um pote de sem sal, que serve as duas — e se você escolher produtos diferentes, leva os dois |
| "Quero conferir a lista no mercado" | Folha impressa: caixa para marcar, nome do produto, quantidade da embalagem |
| "Quanto de proteína tem uma porção?" | Cartão de nutrientes, com %VD sobre a sua meta diária |
| "Quanto sai essa lista no Zaffari?" | Escolhe o mercado e todos os números viram os dele |
| "O que falta nesse mercado?" | Vermelho no que ele não vende, amarelo na escolha que ele não tem |

## O que o site tem

**Receita**

- Sempre as mesmas seções, na mesma ordem: foto, porções, tempo, ingredientes,
  utensílios, modo de preparo
- Seletor de porções com passo próprio de cada receita, estado na URL
  (`?porcoes=20`), teclado e `aria-live`
- Troca de medida por clique, com as equivalências calculadas
- Preço por linha, total e custo por porção
- Cartão de nutrientes com janela de detalhes e %VD
- Escolha de produto por ingrediente, guardada por receita

**Compras**

- Mercado ativo no cabeçalho do site: preço, produtos oferecidos e totais viram os dele
- Aviso em amarelo (escolha não vendida ali) e em vermelho (ingrediente ausente)
- Vitrine com porções e preço por cartão
- Faixa de filtros na borda esquerda da lista: categoria, custo máximo por porção e
  "só o que dá para comprar no mercado escolhido" — com a contagem ao lado de cada
  opção e o estado na URL. No celular vira gaveta.
- Carrinho por combinação receita + porções, com número de preparos
- Assistente de três passos: revisar receitas → revisar a compra → imprimir
- Embalagens inteiras, sobra, e quatro números no rodapé (refeições, compra, sobra,
  já tenho)
- "Já tenho em casa" por item
- Folha de compras para imprimir ou salvar em PDF

**Em toda parte**

- Cabeçalho fixo, e a única navegação: marca à esquerda; busca, mercado,
  preferências, lista e carrinho à direita
- Sem menu lateral — a lista de receitas é o índice, e cada cartão abre a sua
- Busca por nome, grupo, descrição e ingrediente, ignorando acentos
- Preferências de unidade, consumo diário e distribuição de macros
- Responsivo, acessível por teclado, com foco visível e rótulos de leitor de tela
- Nada quebra sem `localStorage` — só não guarda a escolha

## Rodando localmente

Os módulos ES não funcionam abrindo o arquivo direto pelo `file://` — precisa de um
servidor local. Qualquer um serve:

```bash
npm start                  # atalho para `npx serve .`

# ou, sem Node:
python -m http.server 8000
```

Depois abra <http://localhost:8000>.

## Testes

```bash
npm install     # só uma vez: instala o jsdom
npm test        # npm run test:verbose mostra cada verificação
```

São **606 verificações em nove suítes**, que carregam a página de verdade no jsdom e
executam os módulos reais — não há mocks do próprio site. Cada suíte roda num
processo próprio, porque todas mexem no DOM global e no `localStorage`.

Cada verificação leva no nome o **ID do requisito** que ela confere — `[BUY-39]`,
`[MEA-23]` —, declarado em [`docs/specs/`](docs/specs/). O `npm test` termina com o
relatório de cobertura: quantos requisitos têm teste, quais não têm, e se algum teste
cita requisito que não existe (isso reprova a suíte).

| Suíte | Cobre |
| --- | --- |
| `site.test.mjs` | estrutura da receita, rotas, busca, escape de HTML, acessibilidade, catálogo e árvore de ingredientes, cascata do CSS |
| `products.test.mjs` | cadastro de mercados, a ligação mercado × produto, integridade da tabela de produtos, nutrientes parciais, base de comparação, mais barato, custo e preço de gôndola |
| `nutrition.test.mjs` | peso em gramas, estimativa por porção, aferição 4/4/9, distribuição calórica, %VD, cartão e janela |
| `scaling.test.mjs` | arredondamento por unidade, frações, seletor de porções, limites, estado na URL, coluna de preço e total |
| `units.test.mjs` | banco de medidas, conversões, densidade, equivalência calculada, exatidão do que é oferecido, preferências |
| `shopping.test.mjs` | carrinho (agrupar, juntar, sanear), soma da lista, telas de compras |
| `preferences.test.mjs` | saneamento do consumo diário e das metas, painel, e o caminho até a janela |
| `choices.test.mjs` | escolha de produto: saneamento, recentes, ordenação, efeito no custo e no rótulo, persistência |
| `purchase.test.mjs` | embalagem inteira, os quatro números, de quem é a escolha, linha dividida, os três passos, "já tenho", vitrine e folha |

Três testes valem menção, porque protegem contra erro silencioso:

- **conservação da massa** — a lista combinada tem de ser igual à soma das partes em
  base física, para toda a grade de porções de todas as receitas;
- **exatidão das conversões** — nenhuma equivalência oferecida pode desviar mais de
  4% do valor real;
- **varredura do CSS** — seletor de elemento solto com propriedade de posicionamento,
  `:nth-of-type` pendurado numa classe, `min-width` automático em linha apertada, e
  classe usada como componente **e** como modificador.

> **Mudança visual pede olho no navegador.** O jsdom aplica a cascata do CSS mas não
> calcula layout, e oito defeitos de tela já passaram por essa brecha. Estão todos
> listados em [`docs/decisions.md`](docs/decisions.md#testes).

### Especificações

O que o site faz está escrito em [`docs/specs/`](docs/specs/README.md) — um arquivo por
área, 405 requisitos numerados, cada um com os testes que o verificam. O que o site faz
mora ali; **por que** ele faz assim continua em
[`docs/decisions.md`](docs/decisions.md).

```bash
node tests/spec-coverage.mjs              # relatório completo
node tests/spec-coverage.mjs --corrigir   # escreve os IDs nos nomes dos testes
```

Feature nova começa pela spec: requisito primeiro, teste depois, código por último.

---

# Especificação dos dados

O contrato de cada tabela, resumido. A especificação de comportamento — 405 requisitos
numerados, com os testes de cada um — está em [`docs/specs/`](docs/specs/README.md).

Quatro tabelas e uma ligação, com uma seta em cada ponta:

```
receita --(ing)--> ingrediente <--(ing)-- produto <--( preço )--> mercado
   |                    |                    |          |            |
 quanto,             o que é:            a embalagem:  quanto     nome e
 e como              densidade,          marca,        custa      logo
 nesta receita       nutrientes          quanto vem    ali
```

**O preço não pertence ao produto.** "R$ 8,00" não é uma propriedade do feijão São
João: é o que acontece quando ele encontra um mercado. O mesmo pacote custa uma coisa
no Zaffari e outra no da esquina, e enquanto o preço morava dentro do produto não
havia como dizer as duas — por isso ele é uma tabela de ligação (`precos.js`), e não
um campo.

A receita **não descreve** o ingrediente: aponta para a chave dele. Assim "açúcar"
existe uma vez, com um dado só, mesmo aparecendo em cinco receitas — e informação
nova (nutrientes, densidade, alergênicos) entra num lugar e vale para todas.

`src/data/index.js` resolve tudo uma vez, na carga: quem consome `receitas` recebe os
ingredientes já completos e não sabe que existem duas fontes. Chave errada não derruba
a página — o item aparece como `[?] chave`, o erro vai para o console e entra em
`problemas`, que os testes conferem estar vazio.

Hoje: **3 receitas, 36 ingredientes** (25 raízes, 5 com subtipos), **31 produtos**,
**3 mercados** e **61 preços**.

---

## Receita

Um arquivo por receita em `src/data/`, importado e listado em `src/data/index.js`.

```js
export const bolo = {
  slug: "bolo-de-cenoura",
  nome: "Bolo de Cenoura com Cobertura",
  grupo: "Doces",
  descricaoCurta: "Café da tarde",
  resumo: "Massa úmida de liquidificador e cobertura que endurece por cima.",
  imagem: { src: "https://…", alt: "Fatia de bolo…", credito: "Unsplash" },
  porcoes: { padrao: 12, min: 6, max: 24, passo: 6, unidade: "fatias", unidadeSingular: "fatia" },
  tempo: { valor: "1", unidade: "h 10 min", detalhe: "25 min de preparo + 45 min de forno" },
  dificuldade: "Fácil",
  rendimento: "Forma de furo central 24 cm",
  ingredientes: [ /* ver abaixo */ ],
  utensilios: ["Liquidificador", "Forma de furo central"],
  preparo: [{ titulo: "Bata a massa", texto: "…", dica: "O ponto é…" }]
};
```

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `slug` | sim | Identificador na URL. Minúsculas, sem acento, com hífen. |
| `nome` | sim | Título exibido. |
| `grupo` | sim | Categoria no menu. Grupos novos entram automaticamente; para controlar a ordem, inclua o nome em `GRUPOS`, em `index.js`. |
| `descricaoCurta` | sim | Linha auxiliar no menu. |
| `resumo` | sim | Uma ou duas frases sobre a foto. |
| `imagem` | sim | `{ src, alt, credito }`. O `alt` **é obrigatório**; se a URL falhar, entra um degradê no lugar. |
| `porcoes` | sim | Ver abaixo. |
| `tempo` | sim | `{ valor, unidade, detalhe }`. O `detalhe` aparece acima das etapas. |
| `dificuldade` | sim | `Fácil`, `Médio` ou `Difícil`. |
| `rendimento` | sim | Texto livre — ex.: `Forma de 24 cm`. |
| `notaEscala` | não | Aviso extra quando a receita sai do padrão — ex.: usar duas formas. |
| `ingredientes` | sim | Lista de linhas. Ver abaixo. |
| `utensilios` | sim | Lista de textos. |
| `preparo` | sim | Lista de `{ titulo, texto, dica }`. A `dica` é opcional e aceita `<b>`. |

### `porcoes`

```js
porcoes: { padrao: 8, min: 4, max: 24, passo: 2, unidade: "p." }
porcoes: { padrao: 12, min: 6, max: 24, passo: 6, unidade: "fatias", unidadeSingular: "fatia" }
```

| Campo | Descrição |
| --- | --- |
| `padrao` | O número em que a receita foi **escrita**. É a base de toda multiplicação, e precisa cair na grade do `passo` a partir do `min`. |
| `min` · `max` | Limites do seletor. |
| `passo` | De quanto em quanto o seletor anda. Faz mais sentido oferecer 25/30/35 brigadeiros do que 25/26/27. |
| `unidade` | Como se conta a porção. **Abreviada quando cabe**: `p.` para pessoas, `un.` para unidades — o site já escreve `un.` nas quantidades e nas embalagens, então porção por extenso era a exceção. |
| `unidadeSingular` | Só onde a palavra muda: `fatia`/`fatias` tem, `p.` não. |

### Linha de ingrediente

```js
{ ing: "farinha-de-trigo", qtd: 2.5, un: "copo" }
{ ing: "cebola", qtd: 2, un: "un.", detalhe: { um: "picada", muitos: "picadas" } }
{ ing: "sal", escala: false, texto: "a gosto" }
{ subtitulo: "Cobertura" }
```

| Campo | Descrição |
| --- | --- |
| `ing` | A chave no catálogo. Pode ser um pai (`manteiga`) ou um subtipo (`manteiga/sem-sal`) — a receita escolhe o quanto quer ser específica. |
| `qtd` · `un` | Número e unidade, **separados**: só assim dá para multiplicar. `un` tem de existir no banco de medidas. |
| `detalhe` | O preparo **nesta** receita: `"em cubos"`, `"dessalgada"`. Aceita `{ um, muitos }` quando o adjetivo concorda. |
| `escala: false` + `texto` | Para o que não escala: `{ ing: "sal", escala: false, texto: "a gosto" }`. |
| `subtitulo` | Separador visual, não é ingrediente. |

O nome exibido é o do catálogo mais o `detalhe`: `cebolas` + `picadas`. Na lista de
compras entra só o nome do catálogo — compra-se `cebola`, não `cebolas picadas`.
`un: "un."` não é impressa: sai `3 ovos`, não `3 un. ovos`.

---

## Ingrediente

`src/data/ingredientes.js`. É **uma árvore**: um ingrediente pode ter subtipos, e os
subtipos podem ter subtipos.

```js
"manteiga": {
  nome: "manteiga",
  densidade: 0.91,
  comoO: "com-sal",          // de qual subtipo vêm os números do pai
  tipos: {
    "com-sal": { nome: "manteiga com sal", nutrientes: { /* … */ sodio: 580 } },
    "sem-sal": { nome: "manteiga sem sal", nutrientes: { /* … */ sodio: 11 } }
  }
}
```

A chave é o **caminho, com barra**: `manteiga/sem-sal`. O id conta a linhagem, e
nenhuma chave antiga com hífen colide com ele.

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `nome` | sim | Singular, minúscula, canônico. É o que vai para a lista de compras. |
| `plural` | não | Só para contáveis (`ovo` → `ovos`). Ausente = nome invariável. |
| `densidade` | não | g/ml. Sem ela, volume não vira peso: não há preço por grama nem nutriente para quem só se mede em copos. |
| `liquido` | não | `true` para o que se mede por volume. Densidade não distingue: óleo e açúcar têm quase o mesmo 1 g/ml, mas óleo se mede em ml e açúcar se pesa. |
| `pesoPorUnidade` | não | Gramas de UMA unidade contável: `{ "un.": 50 }` para o ovo, `{ "dente": 4 }` para o alho. |
| `comestivel` | não | `false` para o que entra na lista mas não no prato (forminhas). |
| `emCasa` | não | `true` para o que se assume já ter: sal e água. Fora da conta de custo e da lista de compras. |
| `nutrientes` | não | Por **100 g ou 100 ml**, em base crua. Campos: `kcal`, `proteina`, `carboidrato`, `gordura`, `fibra`, `sodio`. `null` num campo é uma decisão, não uma lacuna. |
| `comoO` | **quando há `tipos`** | De qual subtipo vêm densidade e nutrientes do pai. |
| `tipos` | não | Os subtipos, pela última parte da chave. |

### Herança

O índice plano é montado uma vez, em três passagens, e **a ordem importa**:

1. o que cada nó declara de si;
2. **de baixo para cima**, o pai toma do subtipo `comoO` o que não declarou;
3. **de cima para baixo**, o subtipo herda do pai o que ainda falta.

Herdam-se `densidade`, `liquido`, `pesoPorUnidade`, `comestivel`, `emCasa`,
`nutrientes` e `plural`. Do filho `comoO` para o pai sobem só `densidade`, `liquido`,
`pesoPorUnidade` e `nutrientes` — nome e `emCasa` não.

`comoO` é obrigatório em todo nó com subtipos, e um teste cobra: "tomate" precisa de
densidade e nutrientes para quando a receita não especifica, e **uma média de tipos
seria pior** do que dizer, explícito, que os números são os do tipo mais comum.

### Quando criar subtipos

Quando existe **escolha**, não para fazer taxonomia. `manteiga` tem subtipos porque
com sal e sem sal mudam a receita e o preço; `farinha-de-trigo` e `feijao-preto` não
têm, porque no catálogo não há variedade. Um pai sem irmãos é só cerimônia.

As cinco hierarquias de hoje: `acucar/{refinado,cristal,mascavo}`,
`chocolate-em-po/{32,50}`, `manteiga/{com-sal,sem-sal}`, `oleo/{soja,girassol}` e
`leite/{integral,desnatado}`.

Ingrediente que nenhuma receita usa é catálogo sujo — **há teste contra isso**. A
única exceção registrada é `agua`.

---

## Produto

`src/data/produtos.js`. O ingrediente é o conceito (`feijão preto`); o produto é a
embalagem concreta. Um ingrediente tem vários produtos, e é isso que permite comparar
marcas e preços.

**Não há campo `preco`.** Ele é da ligação com o mercado — ver [Preço](#preço).

```js
"feijao-sao-joao-1kg": {
  ing: "feijao-preto", nome: "Feijão Preto São João", marca: "São João",
  qtd: 1000, un: "g",
  nutrientes: { proteina: 21, carboidrato: 61, gordura: 1.5 }
},
"leite-condensado-moca-lata": {
  ing: "leite-condensado", nome: "Leite Condensado Moça", marca: "Nestlé",
  qtd: 1, un: "lata", conteudo: { qtd: 395, un: "g" }
}
```

| Campo | Obrigatório | Papel |
| --- | --- | --- |
| `ing` | sim | Chave no catálogo. Aponta sempre para a **folha** que o produto é: um chocolate de 50% é `chocolate-em-po/50`, nunca o pai. |
| `nome` | sim | Como aparece na embalagem. |
| `marca` | não | Ausente em produto a granel. |
| `qtd` · `un` | sim | O que vem na embalagem. `un` tem de existir no banco de medidas. |
| `conteudo` | não | Conteúdo líquido, quando `un` não é medida: a lata é `1 lata`, e os 395 g ficam aqui. |
| `nutrientes` | não | **Opcional e parcial**: rótulo que só informa proteína, carboidrato e gordura entra assim mesmo, e cada campo presente substitui o do catálogo. |

**Consulta por subárvore.** `produtosDe("manteiga")` devolve os produtos de toda a
subárvore; `produtosDe("manteiga/sem-sal")` só os de sem sal. É isso que faz a janela
de produtos responder ao quanto a receita foi específica.

**A leitura devolve três campos que não estão no arquivo.** `produto(id, mercado)` e
`produtosDe(ing, mercado)` juntam o preço:

| Campo derivado | O que é |
| --- | --- |
| `preco` | Com `mercado`, o preço **daquele** mercado. Sem, o **mais barato** entre todos. `null` quando não há preço. |
| `mercado` | O id do mercado de onde o preço veio. Preço sem lugar não é informação. |
| `foraDoMercado` | `true` quando o mercado ativo não vende este produto — mas alguém vende. É o que a tela pinta de **amarelo**. |

Três desfechos, e a diferença entre os dois últimos é o que separa um aviso de um
defeito: um número, `null + foraDoMercado` ("aqui não vende") e `null` puro
("ninguém vende", que não deveria acontecer — há teste).

`produtosDe(ing, mercado)` devolve só o que se compra ali, e é isso que faz a janela
de escolha não oferecer o que não se pode levar.

> Os 31 produtos são **dados fictícios** para teste: marcas não representam produtos
> reais. Todos os ingredientes em uso têm ao menos um produto; sete têm dois ou mais,
> para exercitar a comparação.

---

## Mercado

`src/data/mercados.js`. Onde se compra.

```js
zaffari: { nome: "Zaffari", logo: "public/images/mercados/zaffari.svg" }
```

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `nome` | sim | Como o mercado se chama. É o que vai para a tela. |
| `logo` | sim | Caminho do arquivo, a partir da raiz do site. O nome do arquivo é o **id** do mercado, e um teste confere que ele existe no disco. |

Só dois campos. Endereço, horário e bandeira de cartão são coisas que um caderno de
receitas não precisa saber, e campo que ninguém lê é campo que envelhece errado.

Os logos ficam em `public/images/mercados/` — ver o
[LEIA-ME de lá](public/images/mercados/LEIA-ME.md). Os três de hoje são marcas de
lugar desenhadas aqui, **não** as identidades visuais reais dessas redes.

---

## Preço

`src/data/precos.js`. A tabela do meio: **um preço por par mercado × produto.**

```js
export const PRECOS = {
  zaffari: {
    "feijao-sao-joao-1kg": 8.0,
    "farinha-dona-benta-1kg": 6.5
  },
  nacional: {
    "feijao-sao-joao-1kg": 8.4      // o mesmo pacote, outro preço
  }
};
```

Aninhado por mercado, lê-se como uma **lista de preços** — que é como se copia de uma
nota fiscal ou de um site de mercado.

| Regra | |
| --- | --- |
| Cardinalidade | **0-1**: um mercado tem no máximo um preço para cada produto, e pode não ter nenhum. |
| Produto ausente | Significa "este mercado não vende isso". `preco()` devolve `null` — não vender **não** é vender de graça. |
| Produto sem preço nenhum | **Não é permitido**, e há teste. Produto que ninguém vende é catálogo sujo, do mesmo jeito que ingrediente que nenhuma receita usa. |
| Valor | Número em reais, positivo. |
| Mercado desconhecido | Ignorado na leitura, como todo o resto do saneamento do site. |

Leitura:

| Função | Devolve |
| --- | --- |
| `preco(mercadoId, produtoId)` | O número, ou `null`. |
| `precosDe(produtoId)` | `[{ mercado, preco }]`, do mais barato ao mais caro. |
| `maisBarato(produtoId)` | `{ mercado, preco }` ou `null`. É a regra que o site usa hoje. |
| `mercadosDe(produtoId)` | Os ids dos mercados que vendem. |
| `catalogoDe(mercadoId)` | O que aquele mercado vende. |

> Todos os 61 preços são **fictícios**, para teste. Não representam valores de mercado
> nem o que qualquer uma dessas redes cobra.

---

## Mercado ativo

Não é uma tabela: é uma **preferência do leitor**, guardada em
`receitas:preferencias` junto da unidade de peso e volume. O seletor fica no
**cabeçalho do site**, e vale em qualquer tela — inclusive na página da receita, que
é onde os avisos de amarelo e vermelho aparecem.

| Valor | O que acontece |
| --- | --- |
| `"todos"` (padrão) | Cada produto é precificado pelo mais barato entre os mercados. Serve para comparar. |
| id de um mercado | Preço, totais e listas de produto passam a ser os dele. |

`mercadoAtivo()` devolve **`null`** para "todos", e não a palavra: toda função de
preço trata `mercado = null` como "sem filtro", e assim ninguém mais precisa conhecer
a palavra que a preferência usa.

O mercado atravessa o código como **argumento**, nunca como estado escondido:
`custoDaReceita(receita, porcoes, mercado)`,
`produtosDe(ing, mercado)`,
`totaisDaCompra(itens, escolhas, { mercado })`.
É o que deixa um teste escolher o mercado sem tocar em `localStorage`.

### As duas cores do mercado

| | Quando | O que fazer |
| --- | --- | --- |
| **amarelo** | você escolheu um produto que este mercado não vende | escolher outro — a linha mostra `???` e o total vira um piso |
| **vermelho** | este mercado não vende nada que sirva ao ingrediente | não tem aqui: outro mercado, ou "todos" |

Valem na página da receita, no passo 2 do carrinho e — desde que a linha da receita
possa estar **fechada** — também no passo 1, com a cor no fundo da linha e a contagem
em texto ("3 ingredientes não são vendidos neste mercado"). Sem isso, a única forma de
descobrir que havia algo a resolver era abrir cada receita, e o motivo para abrir era
justamente o que só se via depois de abrir.

**Escolha fora do mercado não é substituída em silêncio**: trocar de produto por conta própria seria
fazer a compra no lugar de quem vai comprar.

---

## Banco de medidas

`src/data/unidades.js` diz **quanto vale** cada medida de cozinha.
`src/js/units.js` é o que se **faz** com ela: arredondar, escrever, converter.

| Grupo | Medidas | Base |
| --- | --- | --- |
| `VOLUMES` | `ml` · `L` · `copo` 180 · `copo americano` 200 · `copo de requeijão` 250 · `xícara` 240 · `col. sopa` 15 · `col. sobremesa` 10 · `col. chá` 5 · `col. café` 2 | ml |
| `PESOS` | `g` | g |
| `CONTAVEIS` | `un.` · `dente` · `folha` · `fatia` · `pitada` · `lata` · `maço` · `pacote` | — não convertem |

Nenhuma linha declara a própria família: ela vem do **grupo** em que está, o que torna
impossível cadastrar um volume dizendo que é peso.

- **`kg` não é unidade**, é como o grama se escreve quando passa de mil: `1000 g`
  guardado sai `1 kg` na tela.
- **A tabela é maior que o menu.** `MENU` é um recorte de seis opções de volume; as
  demais valem se uma receita usá-las, só não são sugeridas no clique.
- Medida de casa é **convenção, não padrão** — é por isso que o site sempre mostra
  quantos ml a medida vale.

---

# Estrutura

```
.
├── index.html              casca da página: <head>, cabeçalho, <main> vazio
├── package.json            só para os testes; o site não depende de nada
├── docs/
│   ├── specs/              o que o site faz: um arquivo por área, requisitos com ID
│   └── decisions.md        por que ele faz assim
├── tests/                  nove suítes em jsdom + o relatório de cobertura
├── public/                 arquivos servidos como estão
│   └── images/mercados/    logos, um por mercado
├── src/
│   ├── css/                tokens · base · header · recipe · settings · shop
│   │                       · responsive · print
│   ├── data/
│   │   ├── index.js        registro das receitas, ordem dos grupos, resolução
│   │   ├── unidades.js     banco de medidas
│   │   ├── ingredientes.js catálogo em árvore
│   │   ├── produtos.js     produtos de prateleira (sem preço)
│   │   ├── mercados.js     onde se compra: nome e logo
│   │   ├── precos.js       a ligação mercado × produto, com o preço
│   │   │                   (o mercado ATIVO é preferência, não dado: settings.js)
│   │   ├── resolve.js      junta a linha da receita com o catálogo
│   │   └── *.js            uma receita por arquivo
│   └── js/
│       ├── app.js · router.js · header.js           casca e navegação
│       ├── recipe-view.js · shop-view.js            telas
│       ├── cart-view.js · list-view.js              o assistente e a folha
│       ├── cart.js · choices.js · settings.js       estado (localStorage)
│       ├── scaling.js · units.js                    medida e arredondamento
│       ├── pricing.js · purchase.js                 preço e compra
│       ├── shopping-list.js · nutrition.js          somas e estimativa
│       ├── product-picker.js · ui.js · toast.js     interface reaproveitada
│       └── dom.js                                   utilitários
└── concepts/               os dois estudos visuais iniciais (referência)
```

## Rotas

| Endereço | Tela |
| --- | --- |
| `#/comprar` | A lista de receitas, e o índice do site. **`#/` e endereço desconhecido caem aqui.** |
| `#/comprar?grupo=doces,bebidas&ate=3&aqui=1` | A lista filtrada: categorias, custo máximo por porção e disponibilidade no mercado ativo. Compartilhável; parâmetro inválido é ignorado. |
| `#/receita/<slug>` | A receita. `?porcoes=N` opcional, compartilhável. |
| `#/carrinho` | Passo 1: revisar receitas. |
| `#/carrinho?passo=2` | Passo 2: revisar a compra. |
| `#/lista` | Passo 3: a folha. `?imprimir=1` abre o diálogo de impressão. |

O passo do assistente vive na URL e se troca por **link**: o botão voltar do
navegador anda pelo fluxo de graça.

As porções da receita e os filtros da lista também vivem na URL, mas escritos com
`replaceState`: eles descrevem a tela em que se está, e cada clique numa caixinha como
um passo do histórico transformaria a seta "voltar" em "desfazer". Os filtros ficam
fora do `localStorage` de propósito — não são preferência, e ninguém quer que o filtro
de terça ainda esteja lá na sexta.

## O que fica guardado no navegador

| Chave | Conteúdo |
| --- | --- |
| `receitas:carrinho` | `[{ slug, porcoes, qtd }]` — a linha é a combinação receita + porções |
| `receitas:preferencias` | unidade de peso e volume, **mercado ativo**, consumo diário, distribuição de macros |
| `receitas:produtos` | produto escolhido, por receita e no escopo `":carrinho"` |
| `receitas:recentes` | últimos produtos usados, lista global |
| `receitas:ordem-produtos` | ordenação preferida na janela de produtos |
| `receitas:tenho` | o que se marcou como já disponível em casa |

Tudo é saneado na leitura: chave de ingrediente que não existe, produto que não serve
ao pedido, número fora do limite — nada disso chega à tela.

## Adicionando uma receita

1. Crie `src/data/nome-da-receita.js` copiando um arquivo existente como modelo.
2. Preencha os campos da tabela de [Receita](#receita).
3. Para cada ingrediente novo: a entrada em `ingredientes.js`, ao menos um produto em
   `produtos.js` e ao menos um preço em `precos.js`. Produto sem preço em mercado
   nenhum faz o teste falhar.
4. Importe e adicione à lista em `src/data/index.js`.
5. `npm test`. Os testes cobram integridade referencial, ingrediente órfão, produto
   sem preço, `comoO` em nó com subtipos, medida registrada, logo no disco e nutriente
   plausível.

## Publicando

Site estático servido da raiz: funciona direto no GitHub Pages (Settings → Pages →
branch, pasta `/root`), Netlify ou Cloudflare Pages, sem etapa de build.

---

## Especificações e decisões

Duas leituras, com papéis distintos:

- [`docs/specs/`](docs/specs/README.md) — **o que** o site faz. Um arquivo por área,
  requisitos com ID estável, os testes de cada um, e a lista honesta do que ainda não
  tem teste. É contra este texto que se escreve código novo.
- [`docs/decisions.md`](docs/decisions.md) — **por que** ele faz assim. Guarda o
  raciocínio por trás do que está aqui: por que o catálogo é uma árvore e não uma lista, por que a compra tem quatro
números em vez de um, por que a linha se divide quando as receitas discordam, por que
`null` em vez de um número inventado — e os oito defeitos de tela que o jsdom deixou
passar, cada um com o teste que nasceu dele.
