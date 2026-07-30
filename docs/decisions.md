# Decisões

Este arquivo guarda o **porquê**. O **o quê** está em [`specs/`](specs/README.md), um
arquivo por área, com requisitos numerados; o [README](../README.md) apresenta o site e o
formato dos dados. Aqui ficam as decisões que exigiriam uma explicação longa no meio de um
requisito — e que, sem registro, alguém desfaz sem saber o que estava resolvendo.

Quando spec e decisão discordam, a spec manda no comportamento e a decisão manda no
motivo: uma das duas está errada, e vale descobrir qual.

Cada seção nasceu de um problema concreto. Onde há um número (custo que subiu, defeito
que escapou), ele é o número real que apareceu na tela.

---

- [Especificações: por que existem e como se ligam aos testes](#especificações)
- [Testes: o que o jsdom não vê](#testes)
- [O catálogo de ingredientes: árvore, herança, linhagem](#o-catálogo-de-ingredientes)
- [O cabeçalho](#o-cabeçalho) · [Onde o preço mora](#onde-o-preço-mora) · [O mercado ativo](#o-mercado-ativo) · [as réguas, e o que não dá para precificar](#preço)
- [Nutrientes: estimativa honesta](#nutrientes)
- [Preferências: dois controles para o mesmo valor](#preferências)
- [Banco de medidas](#banco-de-medidas) · [Troca de medidas](#troca-de-medidas)
- [A compra: quatro números que não são o mesmo número](#a-compra-quatro-números-que-não-são-o-mesmo-número)
- [Área de compras: vitrine, três passos, folha](#área-de-compras)
- [Notas de implementação](#notas-de-implementação)


## Especificações

### Por que escrever o que já está no código

O código diz o que acontece; não diz o que **deveria** acontecer. A diferença aparece na
hora de mexer: sem um texto que declare a regra, cada mudança é uma negociação com o
código existente, e não há como saber se um comportamento estranho é intenção antiga ou
defeito novo. Foi assim que dois números errados ficaram meses na tela — a lata que o
mercado não vende custando `R$ 0,00`, e o produto sem preço abrindo a lista ordenada por
preço como se fosse o mais barato. Nenhum dos dois contrariava o código. Os dois
contrariavam a regra que ninguém tinha escrito.

São 405 requisitos, um arquivo por área. Cada um tem **ID estável**, uma frase testável
com as constantes do código, e a lista dos testes que o verificam.

### O ID no nome do teste

A ligação entre spec e teste é o nome do teste, prefixado com o ID:

```js
ok("[BUY-39] com tudo em casa, a sobra é zero e não negativa", () => { … });
```

Escolhido assim porque é a ligação mais barata que sobrevive a refatoração: não depende de
caminho de arquivo, nem de número de linha, nem de um arquivo de mapeamento que envelhece
em silêncio. `node tests/spec-coverage.mjs --corrigir` escreve os prefixos a partir do que
as specs citam, então a fonte da verdade continua sendo um lugar só.

`tests/spec-coverage.mjs` responde três perguntas, e trata cada uma como merece:

| Achado | O que é | Consequência |
| --- | --- | --- |
| ID citado que não existe | mentira no repositório | **reprova** |
| requisito sem teste | buraco conhecido | relatório |
| teste sem requisito | ou falta linha na spec, ou o teste é acessório | relatório |

Só o primeiro quebra a suíte. Um portão que reprova por falta de cobertura vira um portão
que se contorna escrevendo requisito de mentira — e aí o número sobe enquanto o site piora.
Os outros dois viram números na saída do `npm test`, para serem olhados.

Hoje: **361 de 405 com teste (89%)**, e cada arquivo de spec termina com a lista honesta do
que falta. Alguns dos 44 não têm teste por escolha — "conferir no navegador" não é
automatizável, e é justamente o requisito que existe para lembrar disso.

### O que o inventário encontrou

Escrever as regras uma a uma achou coisa que 604 testes verdes não achavam:

- **`null` virando zero.** O caminho "unidade que só casa com ela mesma" dividia sem
  conferir o preço: `null / p.qtd * qtd` é `0` em JavaScript. A janela de produtos
  precifica produtos fora do mercado direto por ali, e mostrava `R$ 0,00`.
- **`null` virando grátis.** Na ordenação por preço de embalagem, `null - 5` é `-5`: o
  produto que aquele mercado não vende encabeçava a lista dos mais baratos.
- **Um teste que não testava.** `"as preferências sobrevivem a recarregar a página"`
  entregava uma função `async` ao `ok` síncrono. Ninguém esperava a promessa: a asserção
  falhava como rejeição não tratada e a suíte seguia verde. Convertido para `okAsync`, ele
  falhou de imediato — e o que ele conferia eram valores que os testes anteriores tinham
  deixado no painel, não os seus próprios.

Nenhum dos três aparece lendo o código com atenção. Todos aparecem tentando escrever, em
uma frase, o que a função promete.

## Testes

### O jsdom não faz layout

Os testes aplicam a cascata do CSS, mas não calculam posição nem tamanho. Isso já
deixou passar oito defeitos de tela. Sete são da mesma família — um seletor que pega
elemento diferente do que quem o escreveu tinha em mente:

| Regra | O que pegou por acidente |
| --- | --- |
| `nav { flex: 1 }` | o menu de seções, que esticou e empurrou a busca |
| `aside { position: fixed }` | a rosca de nutrientes, que virou painel fixo no canto |
| `* { margin: 0 }` | o `margin: auto` que centraliza `<dialog>` modal |
| `.lista-nome em { display: block }` | a marca do produto, que pulou para uma linha só dela |
| `.receita-preco span::before` | o "a partir de", que ganhou um "·" antes de si |
| `.cart-controle:nth-of-type(2)` | o stepper de porções, que foi para a área do de preparos |
| `.aviso { display: flex }` | a linha do carrinho, que virou um aviso passageiro |

O sétimo é de outra natureza, e nenhuma varredura de seletor o pegaria: o botão
**"Excluir"** ficava ~10 px acima dos steppers ao lado. Os vizinhos são bloco de
rótulo + stepper e ele é só botão; centralizados na mesma fileira da grade, o que
se alinhava eram os blocos, não os botões. A margem devolve a metade que falta, e
as duas medidas do rótulo viraram variáveis para que mudar o rótulo não desalinhe
o botão em silêncio.

Cada um virou teste, e há três testes genéricos varrendo o CSS: um procura seletor de
elemento solto com `position`, `inset`, `flex` ou `display: flex/grid` (`main` fica de
fora — a especificação permite um só por documento); outro procura `:nth-of-type`
pendurado numa classe; o terceiro procura **classe que é componente e modificador ao
mesmo tempo**.

Esse terceiro nasceu do oitavo defeito, e ele não é seletor de elemento solto: é a
mesma palavra fazendo dois trabalhos. `.aviso` era o componente do aviso passageiro
(fundo escuro, `display: flex`, sombra, animação de entrada) e passou a ser também o
estado amarelo de uma linha de tabela. `.compra-linha.aviso` ganhava o fundo certo por
especificidade — e herdava layout, sombra e `color: #fff` do outro, que apagou o "12"
do seletor de porções sobre o creme. Levei três telas até perceber que o "12" nem
estava lá.

O estado virou `.alerta`, e a regra ficou escrita: **estado é adjetivo, componente é
substantivo, e a mesma palavra não pode ser os dois.**

Esse último merece nota, porque não é seletor de elemento solto e engana de outro
jeito: **`:nth-of-type` conta por tag, não por classe.** `.cart-controle:nth-of-type(1)`
parece dizer "o primeiro `.cart-controle`" e diz "o primeiro `<div>` da linha, se
ele por acaso for `.cart-controle`" — e o primeiro `<div>` era `.cart-info`. Resultado
no celular: a regra do `(1)` não pegava ninguém e a do `(2)` pegava o stepper de
porções, que ia para a área reservada ao de preparos. Para "o primeiro com esta
classe", só há classe.

Ainda assim, **mudança visual pede olho no navegador** — os testes não substituem
isso.

## O catálogo de ingredientes

### O catálogo é uma árvore

Um ingrediente pode ter subtipos, e os subtipos podem ter subtipos:

```
tomate
  └ tomate italiano
      └ tomate san marzano
```

A chave é o caminho, com barra: `manteiga/sem-sal`. O id conta a linhagem, e
nenhuma chave antiga com hífen colide com ele.

```js
"manteiga": {
  nome: "manteiga",
  densidade: 0.91,
  comoO: "com-sal",          // de qual subtipo vêm os números do pai
  tipos: {
    "com-sal": { nome: "manteiga com sal", nutrientes: { …, sodio: 580 } },
    "sem-sal": { nome: "manteiga sem sal", nutrientes: { …, sodio: 11 } }
  }
}
```

**A receita escolhe o quanto quer ser específica.** O bolo pede `manteiga` e aceita
qualquer uma; o brigadeiro pede `manteiga/sem-sal`. Quem responde por essa diferença
é a janela de produtos: pedindo o pai, ela oferece os produtos de toda a subárvore;
pedindo o subtipo, só os dele. Um produto aponta sempre para a folha que ele é.

Isso conserta um defeito que estava à vista: "sem sal" era um `detalhe` de texto na
receita, e o site oferecia — e precificava — manteiga com sal para um brigadeiro que
pede sem. Agora a errada nem aparece na lista, e o custo do brigadeiro subiu de
R$ 15,85 para R$ 16,06, que é o preço de verdade.

### Herança, e de onde o pai tira os números

O índice plano é montado uma vez, em três passagens, e a ordem importa:

1. o que cada nó declara de si;
2. **de baixo para cima**, o pai toma do subtipo `comoO` o que não declarou;
3. **de cima para baixo**, o subtipo herda do pai o que ainda falta.

Sem a ordem, dava para o pai herdar do filho que herdou do pai — e o número
apareceria do nada.

O `comoO` é obrigatório em todo nó com subtipos, e um teste cobra: "tomate" precisa
de densidade e nutrientes para quando a receita não especifica, e **uma média de
tipos seria pior** do que dizer, explícito, que os números são os do tipo mais
comum. Assim a manteiga declara a densidade uma vez, no pai, e os dois subtipos a
herdam; o açúcar cristal declara a sua, porque é mais graúda e o copo pesa menos.

### Somar linhagem: um pote atende as duas receitas

O bolo pede `chocolate-em-po` e o brigadeiro `chocolate-em-po/50`. Comprar o de 50%
atende os dois, então na lista e no carrinho é **uma linha só**, sob o pedido mais
específico. Irmãos não se juntam: cristal não resolve quem pediu refinado.

Três consequências que precisaram de código:

- **`grupoDeLinhagem`** decide a chave. Empatando a profundidade — "açúcar",
  "refinado" e "cristal" pedidos juntos — o pedido genérico cai no tipo `comoO`, que
  é a mesma escolha que o site faria sozinho.
- **A junção se desfaz quando as escolhas divergem.** Se o bolo escolheu o de 32%
  e o brigadeiro o de 50%, os dois potes vão para a lista, cada um com o que a sua
  receita pede. A validade da escolha é medida contra o pedido *daquela* receita,
  não contra o do grupo: o de 32% serve quem pediu "chocolate em pó" e não serve
  quem pediu "50%".
- **`escolhasEfetivas` é por receita.** Quem pediu "manteiga" e caiu no grupo de
  "manteiga sem sal" precisa ser precificado pelo pote que vai para casa — e, com a
  linha dividida, duas receitas do mesmo ingrediente têm potes diferentes. Um mapa
  por ingrediente não conseguiria dizer isso.

### O que mudou no catálogo existente

Cinco casos em que a variedade já estava nos dados, dita de outro jeito:

| Antes | Agora |
| --- | --- |
| `manteiga` + `detalhe: "sem sal"` | `manteiga/com-sal`, `manteiga/sem-sal` |
| `acucar` + `detalhe: "refinado"` | `acucar/refinado`, `/cristal`, `/mascavo` |
| `chocolate-em-po` e `chocolate-em-po-50`, ingredientes soltos | `chocolate-em-po/32` e `/50` |
| `oleo-de-girassol` | `oleo/girassol`, `oleo/soja` |
| `leite` | `leite/integral`, `leite/desnatado` |

Dois produtos novos (óleo de soja, leite desnatado) entraram para que esses pais
tenham de fato variedade — sem irmão, um pai é só cerimônia. Onde não há variedade
nos dados (`feijao-preto`, `farinha-de-trigo`) **não** se criou hierarquia: a árvore
é para quando existe escolha, não para taxonomia por taxonomia.

Nenhum tomate foi cadastrado: `tomate → italiano → san marzano` é o exemplo que
descreve a forma da árvore, e um ingrediente que nenhuma receita usa é catálogo sujo
— há teste contra isso.

### A junção

`src/data/index.js` resolve tudo uma vez, na carga, via `resolverReceita`. Quem
consome `receitas` recebe os ingredientes já completos e não sabe que existem duas
fontes — por isso a normalização não mexeu em nenhuma tela.

Chave errada não derruba a página: o item aparece como `[?] chave`, o erro vai para
o console e entra em `problemas`, que os testes conferem estar vazio. Há também um
teste de ingrediente órfão, para o catálogo não acumular entradas sem uso.

## Onde o preço mora

O preço era um campo do produto: `qtd: 1000, un: "g", preco: 8.0`. Simples, e errado
por um motivo que só aparece quando se cadastra o segundo mercado — **o mesmo pacote
custa duas coisas.** "R$ 8,00" não é uma propriedade do feijão São João. É o que
acontece quando o feijão São João encontra um mercado, e um campo só não tem onde
guardar dois encontros.

Então o preço virou a tabela do meio:

```
produto  <--( preço )-->  mercado
```

`0-1` em cada direção: um mercado tem no máximo um preço para cada produto, e pode não
ter nenhum. Produto ausente da tabela de um mercado significa "não vende isso" —
`null`, e não zero, porque não vender não é vender de graça.

### Por que arquivo separado, e não dentro do mercado

O objeto do mercado poderia carregar a própria lista de preços, e a ligação existiria
igual. Três razões para `precos.js` ser um arquivo próprio:

- **é o dado que mais muda.** Mercado e produto são estáveis; preço muda toda semana.
  É bom que a mudança de rotina toque um arquivo só, e que o `diff` dela não venha
  misturado com "mudei o logo do Nacional".
- **nenhuma das pontas cresce quando a outra cresce.** O produto fica limpo de
  qualquer mercado e o mercado limpo de qualquer produto. Cadastrar o quarto mercado
  não toca em `produtos.js`; cadastrar o 32º produto não toca em `mercados.js`.
- **aninhado por mercado, lê-se como uma lista de preços** — que é exatamente como se
  copia de uma nota fiscal ou de um site de mercado. A forma do dado imita a forma da
  fonte, o que reduz erro de transcrição.

A escolha oposta — preços dentro do mercado — daria a mesma cardinalidade e um arquivo
menos. Vale reconsiderar se um dia o mercado ganhar muitos campos próprios e a lista
de preços virar a menor parte dele.

### A regra provisória: o mais barato entre todos

Não há como escolher o mercado ainda. Enquanto não houver, `produto(id)` devolve
`preco` = o menor entre os mercados que vendem, e `mercado` = de qual mercado ele é.

É a extensão do que o site já fazia. Ele já escolhia o produto mais barato do
ingrediente; agora escolhe o par (produto, mercado) mais barato. Uma dimensão a mais
na mesma pergunta, e **nenhum número da tela mudou** ao migrar: cada produto recebeu
seu preço antigo como o menor, e os outros mercados entraram por igual ou mais.

Os dois campos andam juntos de propósito. Um preço sem lugar não é informação, e é o
`mercado` que a tela vai precisar no dia em que houver como escolher.

**O que isso deixa para a interface resolver**, e que a camada de dados não pode
decidir sozinha:

- a janela de produtos mostra `R$ 6,50` sem dizer "no Zaffari". Está incompleto, e é o
  primeiro lugar a mexer.
- o custo de uma receita pode misturar mercados: farinha mais barata num, manteiga em
  outro. Para *comparar* está certo; para *ir ao mercado* não existe essa cesta. Ou a
  tela mostra por mercado, ou a compra passa a escolher um mercado por vez — a decisão
  é de produto, não de dado.
- `mercadosDe(produto)` e `catalogoDe(mercado)` já existem para as duas telas que isso
  pede. Não foram escritas por precaução: são o que os testes usam para provar a
  ligação nos dois sentidos.

### Uma restrição que o cadastro passou a ter

**Produto sem preço em mercado nenhum não é permitido**, e há teste. É a mesma regra
que já valia para ingrediente que nenhuma receita usa: catálogo sujo é catálogo que
ninguém confia. A alternativa — deixar o produto existir e aparecer como `???` — é
honesta na tela e inútil no cadastro, porque ninguém revisa o que não incomoda.

O preço do produto, por outro lado, **pode** ser `null` no meio do caminho: é o que a
leitura devolve se a tabela estiver incompleta, e o site já sabe mostrar `???` em vez
de inventar um número.

## O cabeçalho

Antes havia dois topos e uma coluna: a barra do celular (marca + nome da receita +
carrinho), o topo do menu lateral (a marca outra vez) e o próprio menu, com a lista de
receitas, a busca, os ícones de seção e as preferências no pé.

Agora é **uma faixa fixa**, em qualquer largura, e é a única navegação:

```
Caderno de Receitas        [buscar…] [mercado ▾] [⚙] [lista] [carrinho]
```

### O menu lateral saiu porque era o mesmo índice duas vezes

A lista de compras já lista todas as receitas em cartões, e cada cartão abre a sua.
Um índice lateral ao lado dela era a mesma lista escrita duas vezes, com duas maneiras
de ficar fora de sincronia — e ocupava 288 px em toda tela, inclusive nas de compra,
onde ninguém vai para escolher receita.

Com ele foram a gaveta do celular, o overlay, o botão ☰ e o `Escape` que fechava tudo:
quatro peças que existiam só para esconder e mostrar a coluna.

**`#/` passou a abrir a lista**, e não a primeira receita. Sem índice lateral, chegar
num prato ao acaso não é chegar em lugar nenhum — e a lista é de onde se navega.
Endereço desconhecido cai lá também, pelo mesmo motivo.

**A receita não é uma seção à parte.** O ícone da lista fica marcado enquanto se lê
uma receita, porque foi de lá que se veio e é para lá que ele volta. Marcar nada
deixaria o cabeçalho sem dizer onde a pessoa está.

### A busca subiu para o cabeçalho

Ela filtrava a lista lateral. Sem lista, ou subia ou morria — e ela é o atalho para
uma receita específica sem passar por rolagem, o que num caderno com trinta receitas
vale mais do que a lista valia.

Digitar **numa receita** leva para a lista antes de filtrar: buscar é pedir uma lista,
e a receita aberta não tem onde mostrá-la. O texto digitado continua no campo — a área
troca, o campo é do cabeçalho e não sabe disso.

`filtrar()` mora em `header.js`, não na vitrine: quem digita é o cabeçalho, e a vitrine
só pergunta "o que mostro?". E o filtro chega lá como **função**, não como texto: a
vitrine lê no momento de desenhar, em vez de receber uma cópia que pode envelhecer
entre a tecla e o redesenho.

### A altura é declarada, não automática

`--cabecalho-h` vive em `tokens.css` porque **três** elementos concordam com ela: o
próprio cabeçalho, o topo do menu lateral (`inset: var(--cabecalho-h) auto 0 0`) e o
`<main>` (`margin-top`). Os dois últimos são posicionados a partir dela, e altura que
ninguém sabe é altura que os três discordam — o conteúdo passa por baixo, ou sobra
uma faixa em branco.

No celular são duas fileiras, e o valor é **redeclarado** no mesmo bloco de media
query. Um teste cobra as quatro coisas: a altura existe em `tokens.css`, é redeclarada
no celular, e é usada pelo cabeçalho, pelo menu e pelo `<main>`.

### Em 430 px, quem quebra a linha é o filho

Numa fileira só, o cabeçalho transbordava **106 px** no celular. Encolher o `<select>`
até caber deixava "Todos os mercad…" — e o nome do mercado é a única coisa que aquele
campo tem para dizer.

Duas fileiras, então: identidade em cima, controles embaixo. A primeira tentativa foi
`flex-basis: 100%` no seletor de mercado, e não quebrou nada: o mercado é **neto** do
cabeçalho, e mora dentro de `.cabecalho-acoes`. Quem tem de quebrar é o filho.

Descer o grupo **inteiro** também estava errado, e por um motivo que só apareceu quando
a busca passou a crescer. Os quatro controles numa fileira de 402 px, e o mínimo
automático de um `<select>` é o texto da sua opção mais longa: "Todos os mercados"
ocupava 164 px e não cedia um pixel. A busca, que cede, encolheu até **26 px** — uma
pílula vazia ao lado de um seletor folgado.

Então o corte passou a cair **entre o que se digita e o que se aponta**: dois grupos no
HTML, `.cabecalho-acoes` (busca e mercado) e `.cabecalho-atalhos` (preferências e as
duas seções). No celular só o primeiro desce, com `order: 2`, e os dois campos repartem
a fileira em partes iguais.

Para repartir, três autorizações: `flex: 1` em **`#mercado-topo`**, a caixa onde o JS
monta o seletor — o filho flex é ela, e `flex` no `.mercado-seletor` de dentro não movia
nada; `min-width: 0` no `<select>`, que desarma o mínimo automático; e o logotipo do
mercado escondido, porque 75 px de enfeite ao lado de um campo de 112 px é o enfeite
comendo a informação.

### A busca cresce onde há folga

No computador ela era um campo de 190 px numa barra de 1900, com o vazio no meio. Agora
`flex: 1` com teto de 420 px — e `flex: 1` também em `.cabecalho-acoes`, porque um filho
flex divide o espaço livre do **pai**, e um pai do tamanho do conteúdo não tem espaço
livre nenhum para dividir.

Isso vale só de 861 px para cima. No celular a mesma fileira leva o mercado, e lá o
campo tem de ceder: `flex: 1` com mínimo de 140 px empurrava os vizinhos 74 px para fora
da tela, pela esquerda. A medida base é a do celular; crescer é a exceção declarada.

### A seta do seletor é desenhada por nós

Numa pílula, a seta nativa do `<select>` encosta na curva da borda, e nenhum `padding`
a alcança: ela é pintada fora da caixa de conteúdo. `appearance: none` devolve o
controle, um chevron em SVG embutido entra como `background-image`, e aí a folga da
direita é declarada — 34 px, igual em todo navegador.

### O seletor de mercado saiu das três áreas

Ele era montado dentro do cabeçalho de `#/comprar`, `#/carrinho` e `#/lista` — três
cópias, cada uma com o seu ouvinte de `change`, e nenhuma delas visível na página da
receita, que é justamente onde o amarelo e o vermelho aparecem.

Agora é um só, montado uma vez em `app.js`. Trocar de mercado chama `redesenharArea()`,
uma função que o roteador guarda a cada troca de rota e que sabe repetir o desenho da
área atual sem que o `app.js` precise conhecer nenhuma delas. Não passa pelo roteador
de propósito: ele recusa a mesma rota, e recusar é justamente o que ele deve fazer.

O nome da receita saiu do topo junto com a barra antiga. O `<h1>` do hero diz o mesmo,
dois centímetros abaixo, e havia duas frases mantidas à mão para dizer isso.

## O mercado ativo

### Argumento, não estado escondido

O mercado atravessa `pricing.js`, `resolve.js` e `purchase.js` como **parâmetro**:
`custoDaReceita(receita, porcoes, mercado)`, `produtosDe(ing, mercado)`,
`totaisDaCompra(itens, escolhas, { mercado })`.

A alternativa tentadora era um módulo com o mercado ativo dentro, lido por quem
precisasse. Menos assinatura para mudar — e um teste que só consegue trocar de
mercado mexendo em `localStorage`, além de uma função de preço cuja resposta depende
de algo que não está nos argumentos dela. Passar custou quinze assinaturas e devolveu
`custoDaReceita(bolo, 12, "asun")`, que é uma frase inteira.

`mercadoAtivo()` devolve **`null`** para "todos os mercados", e não a string. Quem
calcula preço não precisa saber que a preferência chama isso de `"todos"`; precisa
saber se filtra ou não.

### "Todos os mercados" é uma escolha, não um estado vazio

Comparar o mais barato entre mercados é uma pergunta legítima — e era a única que o
site sabia responder antes disto. Então é o padrão, tem nome no seletor e uma nota
dizendo para que serve ("bom para comparar"), em vez de aparecer como a opção que
sobra quando você não escolheu.

### Amarelo e vermelho, e por que não são a mesma coisa

|  | O que é | O que resolve |
| --- | --- | --- |
| **amarelo** | você escolheu um produto que este mercado não vende | trocar de produto |
| **vermelho** | este mercado não vende nada que sirva | trocar de mercado |

Antes de separá-los, os dois casos davam a mesma linha sem preço, e a única forma de
saber qual era abrir a janela. A diferença não é de gravidade: é de **qual gesto
conserta**, e é isso que a cor passou a dizer de relance.

`foraDoMercado` no produto lido é o que carrega essa distinção para cima. Sem ele,
"preço nulo" seria uma resposta só para duas perguntas diferentes.

### A escolha não é substituída em silêncio

Com mercado ativo, a escolha que ele não vende **continua na linha**, com nome e
marca, e o preço vira `???`. O total da receita passa a ser um piso ("a partir de").

A alternativa — cair no mais barato daquele mercado e seguir com um número completo —
é mais confortável e faz a compra no lugar de quem vai comprar. A pessoa escolheu
manteiga Président; trocá-la por outra porque hoje ela está em outro mercado é uma
decisão dela, não do site. O amarelo é o convite para tomá-la, e é do tamanho de um
clique.

Consequência aceita: um único produto desencontrado transforma o total em piso. É o
mesmo acordo que o site já fazia com a pimenta "a gosto" da feijoada.

### O aviso na linha fechada

O passo 1 mostra as receitas fechadas, com um "ver ingredientes" que abre o painel. As
cores nasceram dentro do painel — e ficaram só lá. Para saber se valia abrir uma
receita era preciso abrir; o motivo para abrir era exatamente o que só se via depois.

Agora a linha fechada leva a cor no fundo e a contagem em texto, e a linha inteira
usa a **cor do aviso mais grave** que ela tem: vermelho manda, porque "aqui não tem" é
maior que "escolha outro produto".

Resumo e painel leem de **uma função só** (`estadosDaReceita`). Contar de um lado e
renderizar de outro era a maneira de o resumo dizer "1 a resolver" e o painel mostrar
outra coisa — e ninguém compara os dois de novo depois que passam a existir.

Enquanto fazia isso apareceu um defeito de antes: a pimenta "a gosto" da feijoada
estava **em vermelho** no painel desde o commit das duas cores. Linha sem quantidade
não tem preço, e ausência de preço estava caindo no mesmo balde de "não dá para
precificar". "A gosto" não é defeito — é a receita dizendo que quem cozinha decide.

### O que a migração encostou

- **`lerPrefs` guardava uma cópia em memória.** O painel de preferências era o único
  lugar que mudava preferência, então a cópia bastava. O seletor de mercado mudou
  isso de fora, e a receita ficou mostrando o preço do mercado anterior. Agora relê
  do armazenamento a cada chamada — o painel continua mandando na sua cópia enquanto
  está aberto, porque salva a cada mudança.

- **`null` virando zero em três lugares.** `precoUnitario`, `precoDeReferencia` e
  `embalagensPara` faziam aritmética com o preço sem olhar se ele existia:
  `null / 1000` dá `0`, e a tela mostrava **R$ 0,00** e "1 embalagem" para um produto
  que aquele mercado não vende. "De graça" é a mentira mais convincente que um
  arquivo de preço pode contar, e ela só apareceu porque `preco` passou a poder ser
  nulo.

- **A janela abria sem nada marcado.** `escolhidoId` olhava só o escopo do carrinho;
  linha cujo produto vem da receita abria como se ninguém tivesse escolhido — e era
  justamente a linha que se vinha revisar. Agora o marcado é o produto que a linha
  realmente usa, venha ele do carrinho, da receita ou da divisão.

### Os produtos que existem para os testes

Três mudanças de dado, deliberadas, e nenhuma delas altera qualquer número de "todos
os mercados":

| Mudança | Para quê |
| --- | --- |
| Zaffari deixou de vender o granulado Dori | dá um caso de **vermelho** ao mercado mais completo, que sem isso não teria nenhum. O Nacional já era o mais barato nesse produto, então o preço de "todos" não muda. |
| `manteiga-tirolez-200g`, só no Asun | dá ao Asun uma manteiga sem sal: quem escolheu a Président vê **amarelo** ("troque") em vez de vermelho ("não tem"). |
| `ovos-caipira-10un`, no Nacional e no Asun | mesma coisa para o ovo, e mais caro de propósito para não mexer no mais barato. |

Dois testes cobram que os dois casos continuem existindo: **todo mercado deixa algum
ingrediente sem produto** e **há pelo menos três pares (mercado, escolha) que geram
amarelo**. Sem eles, um ajuste de preço poderia apagar o cenário e os testes de cor
passariam a verificar o vazio.

## Preço

### As quatro operações de `pricing.js`

`src/js/pricing.js` tem quatro operações, e a distinção entre as duas primeiras
importa:

- **`emBase(qtd, un, ing)`** — traduz qualquer medida para a base em que se pode
  comparar. **Grama primeiro**, porque é a única medida que serve para qualquer
  ingrediente: com `densidade`, volume vira peso; com `pesoPorUnidade`, contável
  também. Volume sem densidade fica em ml. O que não traduz fica onde está.
- **`precoUnitario(produto, ing)`** → `{ valor, un }`, para a **máquina**
  comparar. É o que permite pôr a dúzia de ovos e o ovo a granel na mesma régua.
- **`precoDeReferencia(produto)`** → `{ valor, un }`, para a **pessoa** ler, e
  aí a régua é a da embalagem: óleo em litro, açúcar em quilo, ovo em unidade.
  `R$ 13,22/L` se lê; `R$ 0,0144/g` não, e `R$ 24,83/kg de ovo` muito menos.
- **`custo(produto, qtd, un, ing)`** → quanto custa o que a receita pede.

- **`custoDaReceita(receita, porcoes)`** → o total e o custo por porção.

`maisBarato(ing)` escolhe o mais barato por base comum — produto que não chega à
base sai da comparação, porque comparar R$/g com R$/un. não é comparar.
`custoDoIngrediente(ing, qtd)` junta tudo: acha o mais barato e calcula o custo da
quantidade pedida, que pode ser outra que a do arquivo.

### Preço na página da receita

Cada linha de ingrediente mostra o que aquela quantidade custa, pelo produto mais
barato do catálogo. Muda com o seletor de porções, e não muda ao trocar a medida —
é a mesma farinha, escrita de outro jeito.

Quatro desfechos, e nenhum deles é chutar um número:

| Situação | Na tela |
| --- | --- |
| dá para calcular | o valor, e no `title` o produto e o preço de gôndola |
| não dá | **???**, com o motivo no `title` e para leitor de tela |
| `a gosto` | vazio — a quantidade já disse que não se sabe |
| já se tem em casa | vazio — não entra na conta |

`???` e vazio dizem coisas diferentes: um é *não sei*, o outro é *não conta*.

Sobrou daí `textoCusto`, que escreve `< R$ 0,01` em vez de `R$ 0,00` abaixo de
meio centavo. Nenhum ingrediente cai nesse caso hoje, mas o próximo tempero
barato cairia, e `R$ 0,00` faria parecer de graça.

### Total e custo por porção

Fechando a lista, duas linhas: o total e o custo por porção — "Por fatia",
"Por pessoa", "Por unidade", conforme a receita. O total acompanha o seletor de
porções; o custo por porção **não muda**, pela mesma razão dos nutrientes: escalar
multiplica ingredientes e porções pelo mesmo fator, e a divisão cancela.

O que fica de fora é dito, não escondido, como na janela de nutrientes:

```
Custo do que dá para calcular    R$ 64,13
Por pessoa                        R$ 8,02
Fora da conta: pimenta-do-reino (quantidade a gosto).
```

O rótulo muda com a honestidade da conta: **"Custo estimado"** quando fechou,
**"Custo do que dá para calcular"** quando faltou linha. Somar o resto e chamar de
total seria afirmar que a conta fechou.

Sal e água não contam como lacuna: são decisão, não falta de dado — não aparecem
no "fora da conta" e não impedem o rótulo de dizer "Custo estimado".

A célula vazia é vazia, não ausente: sem ela, a coluna da quantidade escorregaria
para a direita só naquela linha.

### Escolher o produto

Clicar no **nome** do ingrediente abre a janela de produtos (a **medida** continua
abrindo a troca de unidade). Cada opção mostra quatro números, e cada um responde
a uma pergunta diferente:

| Número | Pergunta |
| --- | --- |
| tamanho da embalagem | quanto vem? |
| preço da embalagem | quanto sai da carteira? |
| preço por kg/L/un. | qual tamanho compensa? |
| custo nesta receita | o que muda na conta da página? |

Escolhido o produto, mudam de uma vez: o nome na linha, o preço da linha, o total,
o custo por porção e os nutrientes. A primeira opção da lista é sempre **"deixar o
site escolher"**, que devolve o comportamento automático (o mais barato por medida)
e diz qual seria hoje.

**A escolha é por receita.** A mesma manteiga pode ser a com sal na feijoada e a sem
sal no brigadeiro — as receitas pedem coisas diferentes, e guardar por ingrediente
perderia isso. Fica em `localStorage`, na chave `receitas:produtos`:

```js
{ "brigadeiro": { "manteiga": "manteiga-president-200g" } }
```

Os **recém-usados** são uma lista só, global (`receitas:recentes`): "usei este
produto há pouco" não é um fato sobre a receita, é um fato sobre a despensa de quem
cozinha. É a ordenação padrão da janela; sem histórico, a lista abre pelo preço de
medida — a mesma régua do automático, então a opção que o site usaria aparece
primeiro.

O saneamento descarta três coisas ao carregar: produto que saiu do catálogo,
ingrediente que saiu, e — o caso silencioso — produto que existe mas **não é daquele
ingrediente**. Sem a terceira checagem, uma escolha antiga sobreviveria a uma
remontagem da tabela apontando para outra coisa.

### O rótulo do produto nos nutrientes

Com produto escolhido, os nutrientes passam a vir do **rótulo**, campo por campo:
onde o rótulo fala, vale o que ele diz; onde cala, fica a tabela de referência. Um
rótulo brasileiro pode declarar menos que a tabela — há produto aqui que informa só
proteína, carboidrato e gordura — e um buraco seria pior do que a tabela.

`null` no catálogo é decisão, não lacuna: louro sai da panela antes de servir, e o
rótulo de um produto de louro não desfaz isso.

A página diz quando isso está em jogo, no cartão ("já considera o rótulo de 1
produto escolhido") e na janela de detalhes, que nomeia os produtos e marca quais
têm rótulo parcial. Dois números de origens diferentes com a mesma cara seriam
desonestos.

### Ouvinte em elemento fixo tem prazo

Os diálogos vivem no `index.html`, não na view. Sem desligar os ouvintes ao trocar
de receita, cada visita deixaria mais um — e o clique numa opção seria atendido
também pelos ouvintes das visitas anteriores, que ainda apontam para a receita
antiga. O sintoma foi um clique só gravando **cinco** escolhas de uma vez.

A view abre um `AbortController` e passa o `signal` a tudo que registra fora do
próprio HTML; `destruir()` aborta. Uma nota sobre o jsdom: o `AbortController`
global do Node é de outro "reino" e o `addEventListener` da janela simulada o
recusa, então `controleDeVida()` pega o da janela — mesma linha de código servindo
no navegador e no teste.

### O que ainda não dá para precificar

`custo` devolve `null` em vez de inventar número quando as medidas não se
traduzem — é daí que vem o `???`. Com o catálogo atual **toda linha com
quantidade tem preço**, inclusive contável (`3 cenouras` → 300 g → R$ 1,35) e
embalagem (`1 lata` → R$ 8,49). Um teste fixa isso, para avisar quando um
ingrediente novo entrar sem produto.

Ainda faltaria preço se aparecesse:

| Caso | Por quê |
| --- | --- |
| ingrediente sem produto nenhum | nada a comparar |
| `maço`, `fatia` sem `pesoPorUnidade` | não há como chegar a gramas |
| volume de um sólido sem `densidade` | colher de pó não vira peso |

Nada disso vale para o que é `emCasa`: ali não é que falte dado, é que a conta
não interessa.

### O que se assume ter em casa

`emCasa: true` no catálogo marca o que não se compra por causa de uma receita.
Hoje são dois: **sal** e **água**.

| Onde | O que acontece |
| --- | --- |
| coluna de preço na receita | célula vazia |
| lista de compras | a linha não existe — nem como "a gosto" |
| ingredientes da receita | aparece normalmente: continua sendo ingrediente |
| nutrientes | conta normalmente: o sódio do sal é sódio de verdade |

O motivo é diferente em cada caso, mas o efeito é o mesmo. A pitada de sal custa
R$ 0,0013 e o pacote está no armário há meses: o número não informa nada e dá ao
resto da coluna um ar de precisão que não existe. E ninguém sai para comprar água
porque a receita pede água.

Duas consequências que valem registro:

- **Água está cadastrada sem receita que a use.** É a única exceção ao teste de
  "nenhum ingrediente órfão", porque água é ingrediente de quase tudo e quase
  nunca aparece escrita na lista de ingredientes.
- **`temEmCasa()` mora em `src/data/ingredientes.js`**, não em `pricing.js` nem em
  `shopping-list.js`. Os dois consomem a mesma resposta, e a pergunta é sobre o
  ingrediente, não sobre preço nem sobre compra.

> Os preços que aparecem na tela são **fictícios**, e a página diz isso: são
> dados de teste, não pesquisa de mercado.

## Nutrientes

### Nutrientes por porção

A página da receita mostra um cartão com calorias e macros por porção, entre os
ingredientes e os utensílios. `src/js/nutrition.js` resolve tudo em gramas —
o catálogo informa por 100 g, então o trabalho é só descobrir o peso:

| Unidade da receita | Caminho |
| --- | --- |
| peso (`g`, `kg`) | direto |
| volume (`copo`, `col. sopa`) | pela `densidade` do ingrediente |
| contável (`un.`, `dente`, `lata`) | pelo `pesoPorUnidade` |

**Por porção não muda com o seletor.** Escalar multiplica os ingredientes e o
número de porções pelo mesmo fator, e a divisão cancela — então a conta é feita
sempre no padrão da receita. Há um teste que clica no seletor e confere que o
cartão não se move.

**O que não entra é declarado.** `sal a gosto` não tem quantidade, então aparece no
rodapé do cartão em vez de ser somado como zero em silêncio. Já `louro` e
`forminha de papel` têm `nutrientes: null` de propósito — a folha sai da panela, a
forminha não é comida — e por isso não contam como lacuna.

Os valores são referências aproximadas de tabelas públicas (TACO / USDA), por 100 g
em base crua, e densidade e peso por unidade são estimativas de cozinha. O cartão
diz isso na cara: é estimativa sobre ingredientes crus, **não** informação
nutricional do prato pronto. Confira antes de tratar como tal.

Uma aferição independente roda nos testes: as calorias declaradas têm de bater com
`4·proteína + 4·carboidrato + 9·gordura`. Hoje fecham dentro de 3%.

### Janela de detalhes

Clicar no cartão abre uma janela com duas leituras que respondem perguntas
diferentes, lado a lado.

**Barras: quanto isso pesa no seu dia.** Os seis nutrientes como percentual do
consumo diário — uma porção de feijoada cobre 47% das calorias, 79% da proteína e
82% da fibra do dia. As barras **não** somam 100%: cada uma é uma fração da sua
própria referência.

**Rosca: de onde vêm as calorias desta receita.** A distribuição interna —
25% proteína, 37% carboidrato, 38% gordura — a 4 kcal/g para proteína e carboidrato
e 9 kcal/g para gordura. A base é a energia *vinda dos macros*, não a caloria da
tabela, para as fatias fecharem 100%. Arredondar cada uma por conta própria daria
99% ou 101%, então os pontos que faltam vão para a maior parte fracionária. A
legenda põe a sua meta ao lado do que a receita entrega.

A rosca é um `<circle>` só, com um arco por macro: `stroke-dasharray` recorta o
comprimento da fatia e `stroke-dashoffset` a empurra para o lugar. Sem biblioteca e
sem `path` calculado à mão. Um teste confere que as fatias fecham a circunferência
e que os deslocamentos se encadeiam.

### De onde vem a meta de cada macro

Proteína, carboidrato e gordura não têm valor diário informado: ele é **derivado**
dos dois números que o leitor já deu. 2 000 kcal com 15% de proteína são 300 kcal,
que a 4 kcal/g dão 75 g — que é exatamente o valor de rotulagem. Um número a menos
para preencher, e impossível ficar incoerente com os outros.

Os valores de calorias, fibra e sódio vêm da rotulagem brasileira (ANVISA) e podem
ser trocados em **Preferências**. A janela diz de quem são os números que está
usando, e lembra que referência de adulto médio **não** é necessidade individual.

## Preferências

### Os dois controles de cada macro

Cada macro tem uma barra deslizante em **%** e um campo em **gramas**, ligados ao
mesmo valor: mexer em um atualiza o outro na hora. Quem pensa em "metade das
calorias de carboidrato" usa a barra; quem pensa em "120 g de proteína por dia"
digita o número.

O que fica guardado é a **porcentagem**, não as gramas. Porcentagem é a escolha;
gramas é consequência dela e das calorias do dia. Guardando a porcentagem, trocar
2 000 por 1 600 kcal preserva a distribuição e recalcula as gramas — guardando as
gramas, a distribuição mudaria de significado sem ninguém pedir.

Duas consequências disso:

- **A porcentagem tem uma casa decimal** (`CASAS_MACRO`). Com número inteiro, 1% de
  2 000 kcal seriam saltos de 5 g na proteína: digitar `76 g` devolveria `75 g` na
  cara de quem digitou.
- **O teto do campo em gramas acompanha as calorias**: 100% de 2 000 kcal são 500 g
  de proteína, mas só 222 g de gordura (9 kcal/g). Digitar mais que isso para no
  teto, porque acima dele a porcentagem passaria de 100.

O controle que está sob o cursor nunca é reescrito — reescrever no meio da digitação
move o cursor, e no meio do arraste trava a barra. Só o irmão é atualizado.

### Decisões de validação

- **Cada campo tem faixa** (`CAMPOS_DIARIOS` em `settings.js`): kcal 800–6 000,
  fibra 5–100 g, sódio 500–6 000 mg, macro 0–100%. Valor fora da faixa é trazido de
  volta ao sair do campo, não enquanto se digita — reescrever no meio da digitação
  move o cursor.
- **Ausente não é zero.** `Number(null)` e `Number("")` dão 0, e cair no mínimo por
  causa disso trocaria "não informei" por "quero o menor possível". Campo vazio ou
  ilegível volta para o padrão.
- **A soma dos macros não é imposta.** Se der 125%, o painel avisa e mantém o que
  foi digitado. Corrigir número alheio em silêncio é pior do que mostrar a conta.
- **Somar 100% não é exigido para a janela funcionar:** a distribuição real é
  medida da receita; a meta é só a linha de comparação.

### Como o arredondamento funciona

Ninguém pesa 133,33 g. `scaling.js` arredonda por unidade:

| Unidade | Comportamento |
| --- | --- |
| `g`, `ml` | Passo cresce com o valor (1 → 5 → 10 → 25). Decimal. |
| `L` | Passo de 0,01. Decimal. |
| `copo`, `xícara`, `col. sopa` | Passo de ¼, escrito em fração (`2 ½ copos`). |
| `un.`, `dente`, `folha` | Sempre inteiro. |
| `lata`, `maço`, `pacote` | Passo de ½. |
| `pitada` | Sempre inteiro. |

Duas regras evitam resultados esquisitos: número que já é redondo é preservado
(180 ml × 2 = **360 ml**, não 350 ml), e nenhum ingrediente pode zerar — há um
mínimo por unidade.

Peso e volume aparecem em decimal (`1,25 kg`) e medida caseira em fração
(`2 ½ copos`), que é como receita se escreve.

### O painel, e a ordem de prioridade da unidade exibida

O botão na base do menu lateral abre o painel. Duas opções, guardadas em
`localStorage` (chave `receitas:preferencias`):

- **Peso:** como na receita · g · kg
- **Volume:** como na receita · ml · L · copo · xícara · col. sopa

A ordem de prioridade para decidir a unidade exibida:

1. a unidade escolhida no clique, naquele ingrediente;
2. a preferência da família da própria unidade — `copo` obedece a de volume;
3. a preferência da **outra** família, quando há densidade — é o que faz "peso em
   gramas" mostrar a farinha em gramas mesmo escrita em copos;
4. a unidade da receita.

Preferência que produziria um número ruim é ignorada: com "peso em kg", uma carne de
300 g continua em gramas.

Escolher "como na receita" no menu é uma decisão explícita e vence a preferência —
sem isso não haveria como voltar à unidade original com uma preferência ativa.

## Banco de medidas

`src/data/unidades.js` é a tabela que diz **quanto vale** cada medida de cozinha.
`src/js/units.js` é o que se **faz** com ela: arredondar, escrever, converter. Os
números e as palavras ficam de um lado, o comportamento do outro.

Três grupos, e o grupo define a família:

| Grupo | Medidas | Base |
| --- | --- | --- |
| `VOLUMES` | `ml` · `L` · `copo` 180 · `copo americano` 200 · `copo de requeijão` 250 · `xícara` 240 · `col. sopa` 15 · `col. sobremesa` 10 · `col. chá` 5 · `col. café` 2 | ml |
| `PESOS` | `g` | g |
| `CONTAVEIS` | `un.` · `dente` · `folha` · `fatia` · `pitada` · `lata` · `maço` · `pacote` | — não convertem |

Nenhuma linha declara a própria família: ela vem do grupo em que está, o que torna
impossível cadastrar um volume dizendo que é peso. Um teste confere isso, junto com
"nenhuma medida em dois grupos" e "toda medida sabe arredondar e pluralizar".

Medida de casa é **convenção, não padrão**: "um copo" varia de armário para armário.
É justamente por isso que o site sempre mostra quantos ml a medida vale.

**A tabela é maior que o menu.** `MENU` é um recorte — seis opções de volume, porque
nove seriam pior do que seis. As demais continuam válidas se uma receita usá-las: dá
para escrever `un: "copo de requeijão"` e tudo funciona, só não é sugerido no clique.

## Troca de medidas

Toda quantidade em unidade convertível vira um botão. O clique abre um menu com as
equivalências, já calculadas, e a opção de voltar para o que a receita diz. Medida
trocada fica marcada com um ponto verde.

### kg não é unidade

Peso tem uma unidade só: o grama. `kg` é **como o grama se escreve** quando passa
de mil — `1000 g` guardado sai como `1 kg` na tela, `1250 g` sai como `1,25 kg`.

Guardar as duas como unidades diferentes seria guardar o mesmo peso duas vezes, com
uma conversão no meio para reconciliá-las. O mecanismo está em `PROMOCOES`, no
banco de medidas:

```js
export const PROMOCOES = {
  g: { limite: 1000, un: "kg", divisor: 1000, decimais: 2 }
};
```

Consequências: peso puro deixou de ter menu de troca de medida (não há para onde
ir), a preferência de peso tem só "como na receita" e "gramas", e a lista de compras
não precisa mais decidir entre g e kg — a escrita resolve.

O **litro continua sendo unidade**, porque é assim que líquido é vendido e medido:
um produto é `1 L`, não `1000 ml`. Se quiser o mesmo tratamento, é uma linha em
`PROMOCOES`.

`un.`, `dente`, `folha`, `pitada`, `lata`, `maço` e `pacote` não têm família — não
existe equivalente universal para "1 dente de alho", então essas medidas não são
clicáveis.

### Volume para peso exige densidade

Um copo de farinha e um copo de açúcar não pesam a mesma coisa, então `copo → g` só
é possível conhecendo o ingrediente. A densidade fica no catálogo, uma vez:

```js
// src/data/ingredientes.js
"farinha-de-trigo": { nome: "farinha de trigo", densidade: 0.667 }
```

Com isso a farinha pode ser exibida em gramas em qualquer receita. Sem densidade, só
há conversão dentro da mesma família.

### A equivalência entre parênteses é calculada

`2 ½ copos de farinha de trigo (300 g)` — o número entre parênteses **não** está
escrito em nenhuma receita. Antes estava, num campo `nota`, e isso era um convite ao
erro: a mesma farinha podia ter uma equivalência num arquivo e outra em outro, e
corrigir a densidade não corrigia o que estava na tela.

Agora sai da medida mais o que o catálogo sabe do ingrediente:

| Medida | De onde vem o número | Exemplo |
| --- | --- | --- |
| volume, ingrediente líquido | tabela de medidas — não precisa de densidade | `1 copo de óleo (180 ml)` |
| volume, ingrediente sólido | densidade | `2 copos de açúcar (360 g)` |
| contável ou embalagem | `pesoPorUnidade` | `3 cenouras (300 g)`, `1 lata (395 g)` |

Três decisões dentro disso:

- **Líquido se mede, sólido se pesa.** Densidade sozinha não separa os dois: óleo e
  açúcar têm quase o mesmo 1 g/ml. Quem separa é o campo `liquido` no catálogo.
- **Contável e embalagem sempre em gramas**, mesmo sendo líquido: o que se sabe de
  uma lata é quanto ela pesa, não que volume ocupa.
- **Número pequeno não aparece.** Uma pitada de sal são 0,4 g — balança de cozinha
  não lê e ninguém vai medir. Abaixo de 5 g não há parênteses.

A medida já métrica também não ganha parênteses: `300 g` não precisa de tradução.
Quando o leitor troca a medida, o parêntese inverte e passa a mostrar o que a receita
dizia — `300 g (2 ½ copos)`.

**A equivalência arredonda mais fino que a receita.** `arredondar` é generoso de
propósito: 27 g de manteiga podem virar 25 g sem prejuízo do bolo. Mas dizer que
2 colheres *são* 25 g quando são 27 é dizer algo falso — instrução admite folga,
equivalência não. Daí o `passoEquivalencia` no banco de medidas.

### Duas regras que limpam o menu

**Só conversão que fecha.** Escalar a receita é escolha da pessoa e admite
arredondamento; converter é uma promessa de equivalência. `4 col. sopa` são 60 ml,
ou seja ⅓ de copo — e como o copo só aceita frações de ¼, mostrar "¼ copo" seria
25% a menos do que a receita pede. Conversão com erro acima de 4% simplesmente não
é oferecida.

**Só número que se lê.** `kg` e `L` não aparecem abaixo de 1 — ninguém escreve
"0,36 L". É o campo `minConversao` de cada unidade.

## A compra: quatro números que não são o mesmo número

No pé do carrinho ficam quatro caixas, e a segunda é a que dói:

| | |
| --- | --- |
| **Refeições** | o que as receitas consomem — 200 g de arroz custam 200 g de arroz |
| **Compra** | o que se leva do mercado — 200 g de arroz custam um pacote de 1 kg |
| **Sobra** | o que fica no armário do que se está levando |
| **Já tenho** | o que não se leva porque já está em casa |

**Os quatro aparecem sempre, inclusive zerados.** Antes a terceira caixa trocava de
"Sobra" para "Já tenho" quando algo era marcado: a tela mudava de assunto ao clicar
numa caixinha, e obrigava a reaprender onde as coisas estavam. Um `R$ 0,00` informa
mais que o desaparecimento.

Isso descobriu uma conta errada que a troca de rótulo escondia. **A sobra é somada
linha por linha**, não como `compra - refeições`: quem está marcado como já
disponível conta em `refeicoes` (o bolo continua levando farinha) e não conta em
`compra`, então a subtração dava menos que a sobra real — e, com bastante coisa em
casa, um número negativo. Enquanto os dois rótulos se alternavam, o negativo nunca
chegava à tela.

`Math.ceil` na conta de embalagens, e é só isso. Mas as consequências aparecem na
tela: uma pitada de fermento custa R$ 0,66 de fermento e R$ 4,90 de pote; aumentar
as porções pode mover as refeições **sem mover a compra**, porque a sobra já cobria
o aumento. Mostrar só o primeiro número esconderia o desembolso; mostrar só o
segundo faria a pitada parecer uma compra.

O nome de cada linha é o do **produto**, porque é o que se procura na prateleira,
com o ingrediente e as receitas embaixo. Clicar abre a mesma janela da receita.

### O preço de cada receita, na vitrine e no carrinho

Os dois lugares que listam receitas mostram o mesmo par: o **total** e o **por
porção**. Na vitrine acompanha o seletor de porções do cartão; no carrinho, o
total é o da linha (`total × quantidade`), que é o que aquela linha contribui.

Duas coisas que a frase precisa dizer sem enfeite:

- **O por porção não muda com as porções.** Mesma razão de sempre: escalar
  multiplica ingredientes e porções pelo mesmo fator.
- **Quando falta linha, o número é um piso.** Aí a frase começa com "a partir de",
  e o `title` diz o que ficou fora. A feijoada cai nisso por causa da pimenta a
  gosto.

No carrinho os preços saem de `custoPorItem`, que precifica cada receita pelos
**produtos que vão na sacola** — não pelos da página da receita. É o que faz a
soma das linhas fechar exatamente com o total de refeições, mesmo quando uma
escolha de carrinho divergiu de uma escolha de receita. Um teste guarda a
igualdade.

### A folha impressa também

Cada linha da lista traz as duas quantidades, e elas respondem a coisas
diferentes:

```
[ ]  300 g   carne-seca
             Carne Seca Dianteiro Friboi  1 embalagem · R$ 34,90
             Feijoada Completa
```

À esquerda, o que a receita usa — é a instrução de cozinha. Ao lado do produto,
quantas embalagens fechar isso exige — é a instrução de mercado. Os dois totais
fecham a folha.

Duas contas se encontram ali, e continuam sendo duas:
`shopping-list.js` responde "quanto preciso" (somado e escrito em medida de
mercado, respeitando as preferências) e `purchase.js` responde "o que levo". A
junção é pelo `id` do ingrediente. Fundir as duas pareceria economia e custaria a
distinção.

### No carrinho, uma linha por produto

Pedidos do mesmo ingrediente se juntam numa linha só, porque você leva **um** pote
de manteiga do mercado e ele serve as duas receitas. O carrinho tem escopo próprio
para isso — `":carrinho"`, um "slug" que nenhuma receita pode ter — e cada linha
resolve o produto nesta ordem:

1. o escolhido no próprio carrinho, que vale para todos;
2. o das receitas — e se elas **discordarem**, a linha se divide;
3. nada, e vale o mais barato.

**Discordar não é defeito.** Quem escolheu manteiga com sal na feijoada e sem sal
no brigadeiro quer dois potes, e a lista tem de dizer isso. Antes o carrinho
mostrava um só, marcado como erro, e o outro simplesmente não era comprado — o que
é pior que não ter escolha: é ter a escolha ignorada em silêncio.

Cada linha dividida leva `1 de 2 produtos` no rodapé, porque duas linhas do mesmo
ingrediente sem explicação pareceriam engano.

Três consequências:

- **Chave própria por linha.** `ingrediente#produto` quando houve divisão, e só
  `ingrediente` quando não. É ela que identifica a linha na tela e no "já tenho":
  ter o chocolate de 32% em casa não é ter o de 50%.
- **A escolha na janela vale para as receitas daquela linha.** Mexer nas outras
  desfaria a divisão que elas pediram. Numa linha inteira, a escolha vai também
  para o escopo do carrinho — é a decisão de quem vai ao mercado, e é o caminho
  para juntar de novo o que se dividiu.
- **Quem não escolheu acompanha o mais barato dos escolhidos.** Uma terceira
  receita pedindo chocolate sem dizer qual não abre uma terceira embalagem: é a
  mesma régua que o site usa quando ninguém escolheu.

Uma consequência aritmética vale registro: o total de refeições do carrinho pode
não ser a soma dos totais das páginas das receitas, porque o carrinho precifica
tudo pelo produto que vai na sacola. Um teste fixa a igualdade para quando não há
junção que mude o produto.

## Área de compras

Quatro endereços: `#/comprar` (vitrine), `#/carrinho`, `#/carrinho?passo=2` e
`#/lista`.

### O cartão da vitrine

Foto, grupo, nome, resumo — e depois só duas coisas:

```
┌──────────────────────────────┐
│  −  8 p.  +         R$ 64,13 │
│                R$ 8,02 por p │
├──────────────────────────────┤
│     Adicionar ao carrinho    │
└──────────────────────────────┘
```

**Porções à esquerda, preço à direita, na mesma linha.** Um é a causa do outro, e
ver o número mexer ao lado do seletor explica o cartão sem uma palavra de rótulo —
o "PORÇÕES" que ficava acima do seletor saiu, e o `aria-label` do grupo continua
dizendo isso a quem usa leitor de tela. O botão vem abaixo, atravessado: é a saída
do cartão, não um terceiro item da linha.

**Tempo e dificuldade saíram.** A vitrine responde "quanto e quanto custa"; o resto
é assunto da página da receita, e repetir ali só engrossava o cartão.

A coluna mínima subiu de 258 para 300 px, e a unidade de porção passou a ser
abreviada. Antes disso, "R$ 8,02 por pessoa" não caberia ao lado do seletor.

**Nada de `min-width` automático nesta linha.** O mínimo automático de um item flex
é o tamanho do seu conteúdo: um número comprido empurra a linha para fora do cartão
em vez de apertar o vizinho. Foi assim que o preço vazou pela borda direita — e o
`white-space: nowrap` que eu havia posto para evitar a quebra apenas garantia o
vazamento. `min-width: 0` nos dois itens desarma isso, e um teste varre o CSS
procurando o `nowrap` de volta.

### O painel de filtros

Três peneiras, e cada uma é um jeito diferente de decidir o que cozinhar:

| Filtro | A pergunta | Na URL |
| --- | --- | --- |
| Categoria | "quero um doce" | `?grupo=doces,bebidas` |
| Custo por porção | "quero algo até R$ 3 por pessoa" | `?ate=3` |
| Disponibilidade | "quero o que dá para comprar no mercado de hoje" | `?aqui=1` |

**Categorias somam, não intersectam.** Marcar "Doces" e "Bebidas" pede as duas, não a
receita que fosse as duas ao mesmo tempo — que não existe. Por isso o botão da gaveta
conta as três categorias marcadas como **um** filtro: é uma decisão só, e "3 filtros"
leria como três peneiras em série.

**A contagem ao lado de cada opção ignora a própria opção.** Ela soma os outros filtros
e responde "quantas receitas sobrariam se eu marcasse esta?". Contar a si mesma faria
"Pratos principais" mostrar zero enquanto "Doces" estivesse marcado — e um zero ao lado
de uma caixinha é um convite a não clicar nela, justamente quando clicar é a saída.

**A barra no máximo é filtro nenhum.** Arrastar até o fim é o gesto de desistir, e o
parâmetro sai da URL. Se ficasse gravado o teto do catálogo de hoje, uma receita nova e
mais cara nasceria filtrada por um número que ninguém escolheu. O teto sai do catálogo
inteiro, não do que está na tela: uma barra cujo máximo muda a cada tecla digitada na
busca não é uma barra, é um susto.

**Receita sem preço nenhum não passa por um filtro de preço** — não há o que comparar.
E receita com preço incompleto entra pelo **piso**, o "a partir de" do cartão: comparar
por um valor que ninguém vê seria pior do que comparar por um valor incompleto. A
ressalva só aparece no painel quando existe piso na tela.

**Disponível é não ter vermelho.** Amarelo — a escolha guardada não é vendida ali — não
elimina, porque outro produto do mercado serve e trocar resolve. Excluir por amarelo
esconderia receitas que o mercado vende. A peneira só existe com um mercado ativo; sem
ele, o painel diz por quê em vez de mostrar uma caixinha que não faz nada.

**Busca e filtros são duas peneiras independentes,** e a tela nomeia as que estão
ligadas: "2 receitas — a busca por 'bolo' e 1 filtro". Quando a tela esvazia, a frase
diz **qual** delas esvaziou — "nenhuma receita encontrada" depois de mexer numa caixinha
manda procurar no lugar errado — e oferece o botão de limpar ali mesmo.

#### O estado vive na URL

Como as porções da receita, e por três motivos na ordem em que pesaram: **sobrevive ao
redesenho** (trocar de mercado destrói e recria a tela, e um `let` iria embora com ela);
é **compartilhável**; e **não é preferência** — ninguém quer que o filtro de terça ainda
esteja lá na sexta, que é o que o `localStorage` faria.

Escrever é com `replaceState`, que não dispara `hashchange`: o roteador não se mete.
Mas ele **precisa saber**. O registro de "última rota entregue" morava em `app.js`, e
quem reescrevia o endereço sem trocar de tela não o atualizava: filtrar por "doces" e
depois clicar em "Receitas" no cabeçalho batia numa assinatura que o registro velho
dizia já ter entregue, e o clique era recusado como "já estou aqui" — URL limpa, tela
filtrada. O registro passou para `router.js`, ao lado de `substituirHash()`, e agora as
duas coisas moram juntas porque são a mesma coisa.

#### Um redesenho inteiro por clique

As contagens do painel, a frase do topo e a grade dependem todas do mesmo resultado.
Recalcular tudo é mais curto — e mais confiável — do que costurar três atualizações
parciais. O custo é medir cada receita uma vez por mercado, e isso é memorizado.

#### Uma faixa encostada na borda, não uma coluna dentro da página

O painel é `position: fixed` na esquerda, da altura da tela, com rolagem própria — e
sem moldura, porque a faixa **já é** a moldura, com a sua borda direita. Uma caixa
dentro dela seria uma borda a 18 px de outra borda.

Quem abre espaço para ela é o **`<main>`**, com `padding-left`. Em `.area` não daria:
ela é centralizada por `margin: 0 auto`, e uma margem esquerda fixa mataria a
centralização. Com o padding no pai, a coluna de conteúdo continua centralizada — no
que sobra da tela — e ainda cabem três cartões.

O seletor é `body[data-area="comprar"] main`: a faixa só existe na lista, e `data-area`
é onde o site já registra em que tela está. Na receita o valor é `"receita"`, mesmo com
o ícone da lista marcado no cabeçalho, então nem ela nem o carrinho nem a folha ganham
236 px de vazio à esquerda. No papel a faixa não existe, e o padding também não.

O topo da faixa tem os mesmos 46 px de respiro de `.area`: "FILTRAR" e "RECEITAS"
começam na mesma linha, e as duas colunas parecem uma página só.

#### No celular é gaveta, e não `<details>`

Abaixo de 1080 px a faixa volta ao fluxo — `position: static` desfaz as âncoras de uma
vez — e vira uma gaveta entre o título e as receitas. A ordem no HTML é a do celular
(título, filtros, receitas): no computador o painel sai do fluxo, e nenhum `order` de
CSS precisa reordenar nada. Quem lê com leitor de tela ouve na ordem em que se lê.

No computador o painel fica sempre aberto e sem botão. Um `<details>` fechado não abre
por CSS: o navegador esconde o conteúdo por dentro, fora do alcance da folha de estilo.
Então é um botão comum e um atributo na caixa — `display` fica com quem entende de
largura de tela. A gaveta já vem aberta quando há filtro ligado: a tela mostra menos
receitas do que existem, e esconder o motivo disso é uma pegadinha.

### O botão não conta o que aconteceu

Antes, "Adicionar ao carrinho" virava "Adicionado" por 1,6 s. Um controle que
descreve o último clique em vez de dizer o que faz: quem chega no meio do prazo lê
um botão que não existe, e quem quer adicionar duas vezes fica sem saber se pode.

Agora o botão é sempre o mesmo botão, e quem conta é um **aviso** passageiro no pé
da tela, com atalho para o carrinho. Ele vive no `<body>`, não na área: a área se
redesenha a cada clique e o aviso tem de sobreviver ao redesenho. É
`role="status"`, o que já implica `aria-live="polite"` — quem vê e quem ouve
recebem a mesma informação, do mesmo lugar, em vez de uma região `sr-only`
separada dizendo outra coisa.

Clicar no aviso o dispensa; `prefers-reduced-motion` o entrega sem animação.

### Do carrinho à folha, em três passos

| Passo | Pergunta | Onde |
| --- | --- | --- |
| 1. Receitas | quanto vou fazer? | `#/carrinho` |
| 2. Compra | o que vou levar? | `#/carrinho?passo=2` |
| 3. Imprimir | o que marco no mercado? | `#/lista` |

São três perguntas diferentes, e misturá-las numa tela só era o que deixava o
carrinho cansativo. Cada passo responde uma, e nada do que pertence a um aparece
no outro: a folha impressa não repete "precisa" nem "sobra", porque no mercado
isso já foi decidido.

**O passo se troca por link, não por JavaScript.** Fica na URL, o botão "voltar"
do navegador anda pelo assistente de graça, e um link pode apontar para o meio
dele. O preço é redesenhar a área a cada passo — aqui, nada.

#### Passo 1: as receitas

**Porções**, **preparos**, **excluir**, e um "ver ingredientes" que abre a receita
ali mesmo: cada linha mostra a quantidade, o produto e o preço, e clicar no produto
abre a mesma janela da página da receita.

Duas levas da mesma receita são um número — o de preparos —, não uma segunda
linha: o carrinho junta receita e porções na mesma chave, e duas linhas idênticas
seriam a mesma coisa escrita duas vezes. Havia também um botão "duplicar", que
fazia exatamente isso; saiu, porque dois caminhos para o mesmo efeito é só uma
tela mais cheia. Para uma segunda leva com outras porções, adiciona-se a receita
de novo pela vitrine.

#### Passo 2: a compra

Uma linha por item, com quantidade, preço e sobra. **Os genéricos vêm primeiro**,
porque são o que se vem revisar; o que já se tem em casa cai para o fim, riscado.

Clicar num item abre a janela com dois blocos: **quem pede** (cada receita, com a
quantidade que pede, e o total somado) e a lista de produtos. Escolher ali resolve
a compra inteira — e também as receitas que pediam o genérico, porque o pote é um
só e deixar a receita discordando do carrinho seria guardar uma contradição.

**A caixa "já tenho em casa"** (`receitas:tenho`) tira o item da folha e do total
da compra, e **não** do total de refeições: você não paga a farinha hoje, mas o
bolo continua levando farinha. O abatido aparece na caixa "Já tenho" do rodapé, que
está sempre lá.

#### Passo 3: a folha

Uma linha por item: caixa para marcar, nome do produto, quantidade. A quantidade é
a da **embalagem como está no rótulo** — "900 ml", "1 lata (395 g)", "12 un." —, não
a medida que a conta usa internamente. Um litro de leite não é "1,03 kg" na
prateleira, mesmo que o cálculo passe por ali.

O que se marcou como "já tenho" sai da lista de comprar e aparece numa seção
separada no fim, para conferência.

### Duas cores, um sentido cada

| | Significa |
| --- | --- |
| **verde** | já está em casa — não entra na compra de hoje |
| **vermelho** | tem algo errado nesta linha |
| nada | vai para a sacola |

As duas falam da **compra**, não da decisão: "isto eu não preciso levar" e "isto
não dá para levar assim". De quem partiu a escolha do produto é outro assunto, e
não é o que se quer ver de relance ao correr uma lista de mercado.

Valem nos dois passos do carrinho: na lista da compra e no painel de ingredientes
de cada receita. No painel, verde é sal e água — o caso permanente de "já está em
casa", que não se marca porque se assume.

Antes eram etiquetas de texto — "sem escolha", "escolhido aqui", "as receitas
discordam" —, até três numa linha. Liam-se uma a uma; a cor se lê de relance.

**O terceiro estado não tem cor de propósito.** É o caso comum, e colorir o comum
é não colorir nada.

O vermelho cobre duas coisas, ambas reais: nenhum produto do catálogo serve, ou a
embalagem não se converte para a medida da necessidade. Receitas que discordam
saíram da lista de vermelhos — viraram duas linhas, o que não é defeito nenhum. **A legenda só cita a cor que está na
tela** — explicar um sinal que não apareceu é ensinar a procurá-lo.

"Já tenho" vem antes do vermelho: a linha não vai para a sacola, e um defeito no
que não se leva não é problema de hoje.

Só **fundo**, sem faixa lateral: a faixa era um segundo sinal dizendo o mesmo, e
dois sinais para um fato é ruído. **Cor sozinha não é informação para quem não a
vê** — daí o riscado no verde e o texto do motivo no `title` e numa linha só de
leitor de tela. O realce do mouse pinta por cima do fundo, então ganha um tom
derivado do próprio par, com `color-mix`: passar o mouse não pode apagar o
estado.

### O destaque de "já no carrinho"

A janela de produtos põe no alto, com selo, os produtos **já escolhidos para outra
receita do mesmo carrinho** — antes de qualquer ordenação. Não é uma ordem entre
iguais: é um aviso de que aquele pote já está indo, e dois potes do mesmo
ingrediente é dinheiro parado.

### Carrinho

Uma linha do carrinho é a combinação **receita + porções**. Adicionar a mesma
receita com as mesmas porções aumenta a quantidade daquela linha; com porções
diferentes, cria outra linha — uma feijoada para 8 e outra para 20 não são o mesmo
preparo.

Mudar as porções de uma linha até coincidir com outra existente junta as duas e
soma as quantidades; sem isso o carrinho ficaria com duas linhas idênticas.

O carrinho fica em `localStorage` (chave `receitas:carrinho`) e é saneado ao
carregar: receita que não existe mais sai, porções fora do intervalo são
ajustadas, quantidade inválida volta para 1 e linhas repetidas se juntam.

### Lista de compras

O botão do carrinho leva a `#/lista?imprimir=1`, que monta a lista e abre o
diálogo de impressão — de onde o navegador salva em PDF. Não há dependência
externa nem etapa de build; a folha impressa é controlada por `print.css`, que
esconde a interface e distribui os itens em duas colunas.

O mesmo ingrediente vindo de receitas diferentes vira **uma linha só**, ainda que
as receitas o escrevam em unidades diferentes: 1 kg de feijão numa e 300 g em
outra dão `1,3 kg`. A soma é feita na base física da família (ml ou g) e só depois
se escolhe a unidade.

Como lista de compras não é receita, aqui a régua é o mercado:

- **Peso ganha de volume** quando a densidade é conhecida. `600 g de farinha`
  resolve a compra melhor que `5 copos`.
- **kg e L** entram quando o total passa de 1000.
- O que não pode ser somado com honestidade não é somado: `a gosto` continua
  `a gosto`, e unidades sem família (dente, lata, un., pitada) só se somam entre
  iguais.

Cada linha diz de que receitas veio, e traz um quadradinho para marcar no mercado.

### Agrupamento pela chave

A lista agrupa pela **chave do ingrediente**, não pelo texto. O bolo escreve
`açúcar refinado` na massa e `açúcar` na cobertura; as duas linhas apontam para
`acucar` e viram uma só, sem precisar de apelido.

Produtos que são de fato diferentes recebem chaves diferentes — `chocolate-em-po` e
`chocolate-em-po-50` não se misturam, e isso agora é uma decisão explícita no
catálogo em vez de um acidente de como o nome foi escrito.

Quando o mesmo ingrediente aparece como `a gosto` numa receita e com quantidade em
outra, a linha `a gosto` é descartada: quem já vai comprar 300 g de sal não precisa
de uma segunda linha dizendo "sal, a gosto".

### Estado na URL

As porções escolhidas entram no endereço: `#/receita/feijoada?porcoes=16`. O link
compartilhado já abre na quantidade certa. Os cliques usam `replaceState`, então o
botão "voltar" não fica preso em cada ajuste, e o parâmetro desaparece da URL
quando o valor volta ao padrão.

Tempo de fogo e forno **não** são escalados — não é uma relação linear. Quando a
receita sai do padrão, um aviso abaixo dos ingredientes diz isso.

## Notas de implementação

- **Rotas:** `#/receita/<slug>` (com `?porcoes=N` opcional), `#/comprar`, `#/carrinho`
  e `#/lista`. O link é compartilhável e o botão voltar funciona. Navegar para o
  endereço em que já se está não redesenha nada.
- **Ciclo de vida das telas:** cada área devolve um `destruir()` que solta os ouvintes
  ao sair. Sem isso o ouvinte da vitrine responderia a cliques do carrinho, e cada
  visita somaria mais um — fazendo um clique valer duas vezes.
- **Carrinho e lista são reativos:** as duas telas se inscrevem no carrinho e se
  redesenham quando ele muda, em vez de depender de quem alterou lembrar de avisar.
- **Seletor de porções:** setas do teclado também ajustam; os botões desativam nos
  limites; o valor tem `aria-live` para o leitor de tela anunciar a mudança.
- **Menu de medidas:** abre por clique ou teclado, navega com ↑ ↓, fecha com `Esc` ou
  clique fora, devolve o foco ao botão e anuncia a troca numa região `aria-live`.
- **Preferências:** `<dialog>` nativo (`showModal`), com plano B para navegador antigo.
  `localStorage` indisponível não quebra nada — só não guarda a escolha.
- **Busca:** filtra por nome, grupo, descrição e ingredientes, ignorando acentos.
- **Mobile:** abaixo de 860 px o cabeçalho vira duas fileiras e o painel de filtros vira
  gaveta; o corpo do texto aumenta em vez de diminuir, e as áreas de toque têm no mínimo
  44 px.
- **Acessibilidade:** link "ir para o conteúdo", foco visível, `aria-current` na seção
  ativa, `fieldset`/`legend` de verdade nos filtros, `alt` em todas as fotos.
- **Impressão:** `Ctrl/Cmd + P` gera uma folha limpa, sem menu.
- **Imagens:** se a URL falhar, entra um degradê no lugar — nunca aparece ícone de
  imagem quebrada.
