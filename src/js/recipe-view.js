/* Monta a página de uma receita.
   Ordem fixa das seções: foto, porções, tempo, ingredientes, utensílios, modo de preparo.

   Duas coisas mudam sem recarregar a página:
   o número de porções e a unidade de cada medida (clique na quantidade). */

import { esc, IMAGEM_RESERVA, abrirDialogo, ligarFechamento, controleDeVida } from "./dom.js";
import { escalarIngrediente, fator, normalizarPorcoes } from "./scaling.js";
import { adicionar } from "./cart.js";
import { avisar } from "./toast.js";
import {
  estimarNutrientes, detalhesNutricionais, formatarNutriente, ORDEM, ROTULOS, BASE_DIARIA_KCAL
} from "./nutrition.js";
/* A meta vem das preferências com uma casa decimal — precisa da mesma
   formatação do painel, senão sai "15.2%" com ponto no meio do português. */
import { formatarPct, mercadoAtivo } from "./settings.js";
import {
  custoDoIngrediente, custoDaReceita, maisBarato, textoCusto, textoPrecoUnitario
} from "./pricing.js";
import { produtosDe, produto } from "../data/produtos.js";
import { mercado as mercadoPorId } from "../data/mercados.js";
import { temEmCasa } from "../data/ingredientes.js";
import { aplicarEscolhas } from "../data/resolve.js";
import { ligarJanelaDeProdutos } from "./product-picker.js";
import { carregarEscolhas, escolher as gravarEscolha } from "./choices.js";

/* ----------------------------------------------------------------- pedaços */

function foto(r) {
  const credito = r.imagem?.credito
    ? `<p class="credito">Foto: <a href="${esc(r.imagem.credito.url)}" target="_blank" rel="noopener noreferrer">${esc(r.imagem.credito.autor)}</a></p>`
    : "";

  return `
    <div class="hero">
      <img src="${esc(r.imagem?.src || "")}"
           alt="${esc(r.imagem?.alt || r.nome)}"
           width="1600" height="900"
           onerror="this.onerror=null;this.src='${IMAGEM_RESERVA}'">
      ${credito}
      <div class="hero-txt">
        <span class="eyebrow">${esc(r.grupo)}</span>
        <h1>${esc(r.nome)}</h1>
        <p class="resumo">${esc(r.resumo)}</p>
      </div>
    </div>`;
}

/** Rótulo das porções no singular ou plural: "1 fatia" / "12 fatias". */
export function textoPorcoes(r, porcoes) {
  const unidade = porcoes === 1 && r.porcoes.unidadeSingular
    ? r.porcoes.unidadeSingular
    : r.porcoes.unidade;
  return `${porcoes} ${unidade}`;
}

export const unidadePorcao = (r, n) =>
  n === 1 && r.porcoes.unidadeSingular ? r.porcoes.unidadeSingular : r.porcoes.unidade;

function seletorPorcoes(r, porcoes) {
  const { min, max } = r.porcoes;

  return `
    <div class="porcoes" role="group" aria-label="Número de porções">
      <button type="button" class="pbtn" data-passo="-1"
              aria-label="Diminuir porções" ${porcoes <= min ? "disabled" : ""}><i class="fa-solid fa-minus" aria-hidden="true"></i></button>

      <output class="pval" id="porcoes-valor" aria-live="polite">
        ${esc(String(porcoes))} <span>${esc(unidadePorcao(r, porcoes))}</span>
      </output>

      <button type="button" class="pbtn" data-passo="1"
              aria-label="Aumentar porções" ${porcoes >= max ? "disabled" : ""}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
    </div>`;
}

function dados(r, porcoes) {
  return `
    <dl class="meta">
      <div class="meta-porcoes">
        <dt>Porções</dt>
        <dd>${seletorPorcoes(r, porcoes)}</dd>
      </div>
      <div>
        <dt>Tempo de preparo</dt>
        <dd>${esc(r.tempo.valor)} <span>${esc(r.tempo.unidade)}</span></dd>
      </div>
      <div>
        <dt>Dificuldade</dt>
        <dd>${esc(r.dificuldade)}</dd>
      </div>
      <div>
        <dt>Rendimento</dt>
        <dd><span>${esc(r.rendimento)}</span></dd>
      </div>
      <div class="meta-add">
        <dt class="sr-only">Carrinho</dt>
        <dd>
          <button type="button" class="btn-add" id="add-carrinho">Adicionar ao carrinho</button>
        </dd>
      </div>
    </dl>`;
}

/* ------------------------------------------------------------ ingredientes */

/** Só a lista de ingredientes — é o que muda ao mexer em porções ou unidades. */
export function listaIngredientes(r, porcoes, prefs, trocas = new Map()) {
  const mult = fator(r, porcoes);
  const mercado = mercadoAtivo(prefs);

  return r.ingredientes.map((ing, i) => {
    const d = escalarIngrediente(ing, mult, { prefs, unidadeForcada: trocas.get(i) });

    if (d.subtitulo) return `<li class="sub">${esc(d.subtitulo)}</li>`;

    // Quantidade convertível vira botão; o resto continua texto simples
    const quantidade = d.alternativas.length
      ? `<button type="button" class="qty conv${d.convertido ? " trocada" : ""}"
                 data-i="${i}" aria-expanded="false" aria-haspopup="true"
                 title="Trocar a medida">${esc(d.qtd)}</button>`
      : `<span class="qty">${esc(d.qtd)}</span>`;

    /* A cor diante do mercado ativo: amarelo se a escolha não é vendida ali,
       vermelho se nada daquele ingrediente é. Sem mercado, nem uma nem outra. */
    const estado = estadoDoIngrediente(ing, mercado);

    // Nome primeiro, quantidade e preço depois, alinhados à direita
    return `<li data-i="${i}"${estado ? ` class="${estado}"` : ""}>${
      nomeDoIngrediente(ing, d, i, mercado)}${quantidade}${preco(ing, mult, mercado)}</li>`;
  }).join("");
}

/**
 * O nome na linha, e o botão que abre a escolha de produto.
 *
 * Com produto escolhido, o nome passa a ser o do produto — é o que se vai
 * comprar — e o preparo da receita ("dessalgada", "picadas") desce para o
 * parêntese, junto da equivalência. Nada se perde de vista.
 */
function nomeDoIngrediente(ing, d, i, mercado) {
  const escolhido = ing.produto;
  const singular = d.item === ing.itemSingular;
  const preparo = singular ? ing.detalheSingular : ing.detalhe;

  const partes = escolhido ? [preparo, d.nota] : [d.nota];
  const nota = partes.filter(Boolean).join(" · ");

  const dentro = escolhido
    ? `${esc(escolhido.nome)}${escolhido.marca ? ` <em class="ing-marca">${esc(escolhido.marca)}</em>` : ""}`
    : esc(d.item);

  const conteudo = `${dentro}${nota ? ` <span class="nota">(${esc(nota)})</span>` : ""}`;

  /* Sem produto que se compre no mercado ativo não há o que escolher: aí o nome não
     é clicável, e a linha inteira já está em vermelho dizendo por quê. */
  if (!produtosDe(ing.id, mercado).length) return `<span class="ing-nome">${conteudo}</span>`;

  return `<button type="button" class="ing-nome escolher-produto" data-i="${i}"
                  aria-haspopup="dialog"
                  title="${escolhido ? "Trocar o produto" : "Escolher o produto"}">${conteudo}</button>`;
}

/* Célula vazia, não célula ausente: sem ela a coluna da quantidade escorrega
   para a direita só nesta linha. */
const CELULA_VAZIA = `<span class="ing-preco"></span>`;

/**
 * Quanto custa esta linha, pelo produto mais barato do catálogo.
 *
 * Quatro desfechos, e nenhum deles é chutar um número:
 *   sem quantidade ("a gosto")  vazio — a quantidade já diz que não se sabe
 *   já se tem em casa           vazio — não entra na conta
 *   sem como precificar         "???", com o motivo no title e para leitor de tela
 *   com preço                   o valor, e no title o produto e o preço por kg/L
 */
function preco(ing, mult, mercado) {
  if (ing.escala === false || ing.qtd == null || temEmCasa(ing)) return CELULA_VAZIA;

  const c = custoDoIngrediente(ing, ing.qtd * mult, mercado);

  if (!c) {
    const motivo = motivoDoPreco(ing, mercado);

    return `<span class="ing-preco sem-preco" title="${esc(motivo)}">
              <span aria-hidden="true">???</span>
              <span class="sr-only">Preço desconhecido: ${esc(motivo)}</span>
            </span>`;
  }

  const marca = c.produto.marca ? ` (${c.produto.marca})` : "";
  const titulo = `${c.produto.nome}${marca} — ${textoPrecoUnitario(c.produto)}`;

  return `<span class="ing-preco" title="${esc(titulo)}">${esc(textoCusto(c.valor))}</span>`;
}

/**
 * Por que esta linha não tem preço, em uma frase.
 *
 * Quatro motivos diferentes, e a frase é o que separa um do outro para quem passa
 * o mouse ou usa leitor de tela — a cor da linha diz o mesmo de relance.
 */
function motivoDoPreco(ing, mercado) {
  if (mercado && ing.produto?.foraDoMercado) {
    return `${ing.produto.nome} não é vendido neste mercado`;
  }
  if (!produtosDe(ing.id, mercado).length) {
    return mercado
      ? `Nenhum produto de ${ing.nome} é vendido neste mercado`
      : `Nenhum produto de ${ing.nome} no catálogo`;
  }
  return `Nenhum produto de ${ing.nome} é vendido em medida que se converta para ${ing.un}`;
}

/**
 * A nota abaixo da lista: de onde vêm estes preços.
 *
 * Com mercado ativo ela diz o nome dele, porque senão a linha em amarelo não tem
 * como ser entendida — "não vendido aqui" precisa que "aqui" esteja escrito em
 * algum lugar desta página, e o seletor fica na área de compras.
 */
function notaDePreco(mercado) {
  const onde = mercado
    ? `Preços do <b>${esc(mercadoPorId(mercado)?.nome ?? "")}</b>, para a quantidade acima. Em
       <b class="nota-amarela">amarelo</b>, o produto escolhido não é vendido lá; em
       <b class="nota-vermelha">vermelho</b>, nenhum produto daquele ingrediente é.`
    : `Preços do produto mais barato do catálogo, para a quantidade acima —
       <b>???</b> quando não há produto que sirva.`;

  return `${onde} Sal e água ficam de fora: assume-se que já estão em casa. São
    valores de teste, não pesquisa de mercado.`;
}

/**
 * A classe de estado da linha: amarelo, vermelho, ou nada.
 *
 * Amarelo antes de vermelho, e os dois só existem com mercado ativo: sem mercado
 * não há "não vendido aqui", e o vermelho de catálogo vazio já era coberto pelo
 * "???" na coluna do preço.
 */
function estadoDoIngrediente(ing, mercado) {
  if (!mercado || ing.subtitulo || ing.escala === false || ing.qtd == null || temEmCasa(ing)) return "";
  if (ing.produto?.foraDoMercado) return "ing-aviso";
  if (!produtosDe(ing.id, mercado).length) return "ing-errada";
  return "";
}

/**
 * Total da receita e custo por porção, no número de porções escolhido.
 *
 * O rótulo da segunda linha usa a unidade de porção da receita — "por fatia",
 * "por pessoa" — porque "por porção" é mais frio e menos exato do que precisa ser.
 */
function custoTotal(r, porcoes, mercado) {
  const c = custoDaReceita(r, porcoes, mercado);
  if (!c.contados) return "";   // nada precificável: caixa vazia não informa

  const fora = c.deFora.length
    ? `<p class="custo-fora">Fora da conta:
         ${c.deFora.map(x => `${esc(x.nome)} (${esc(x.motivo)})`).join(", ")}.</p>`
    : "";

  return `
    <dl class="custo">
      <div>
        <dt>${c.completa ? "Custo estimado" : "Custo do que dá para calcular"}</dt>
        <dd>${esc(textoCusto(c.total))}</dd>
      </div>
      <div>
        <dt>Por ${esc(unidadePorcao(r, 1))}</dt>
        <dd>${esc(textoCusto(c.porPorcao))}</dd>
      </div>
    </dl>
    ${fora}`;
}

function menuConversao(alternativas) {
  return `
    <div class="conv-menu" role="menu" aria-label="Trocar a medida">
      ${alternativas.map(a => `
        <button type="button" role="menuitemradio" data-un="${esc(a.un)}"
                aria-checked="${a.atual}" ${a.atual ? 'class="atual"' : ""}>
          <span>${esc(a.texto)}</span>
          ${a.original ? '<em>como na receita</em>' : ""}
        </button>`).join("")}
    </div>`;
}

/** Aviso mostrado apenas quando a receita está fora do padrão. */
function avisoEscala(r, porcoes) {
  if (porcoes === r.porcoes.padrao) return "";

  const extra = r.notaEscala ? ` ${esc(r.notaEscala)}` : "";
  return `<p class="escala-aviso">Quantidades recalculadas para ${esc(textoPorcoes(r, porcoes))}.
          Tempos de fogo e forno mudam pouco — confie no ponto, não no relógio.${extra}</p>`;
}

function ingredientes(r, porcoes, prefs) {
  return `
    <section class="card" aria-labelledby="tit-ingredientes">
      <h2 id="tit-ingredientes">Ingredientes</h2>
      <p class="ing-dica">
        Clique no nome para escolher o produto, ou na medida para trocar a unidade.
      </p>
      <ul class="ing" id="lista-ingredientes">${listaIngredientes(r, porcoes, prefs)}</ul>
      <div id="custo-total">${custoTotal(r, porcoes, mercadoAtivo(prefs))}</div>
      <p class="ing-nota-preco" id="nota-preco">${notaDePreco(mercadoAtivo(prefs))}</p>
      <div id="escala-aviso">${avisoEscala(r, porcoes)}</div>
    </section>`;
}

/**
 * Estimativa de nutrientes por porção.
 *
 * Não depende do seletor de porções: escalar multiplica ingredientes e porções
 * pelo mesmo fator, e a divisão cancela.
 */
function nutrientes(r) {
  const e = estimarNutrientes(r);
  if (!e.contados) return "";   // nada calculável: melhor não mostrar caixa vazia

  const linhas = ORDEM.map(campo => {
    const { valor, un } = formatarNutriente(campo, e.porPorcao[campo]);
    return `
      <li${campo === "kcal" ? ' class="nutri-destaque"' : ""}>
        <span>${esc(ROTULOS[campo])}</span>
        <b>${esc(valor)} <em>${esc(un)}</em></b>
      </li>`;
  }).join("");

  const fora = e.deFora.length
    ? ` Não inclui ${e.deFora.map(d => esc(d.nome)).join(", ")} — ${esc(e.deFora[0].motivo)}.`
    : "";

  const comRotulo = r.ingredientes.filter(i => i.nutrientesDoRotulo?.length).length;
  const rotulos = comRotulo
    ? ` Já considera o rótulo de ${comRotulo} produto${comRotulo > 1 ? "s" : ""} escolhido${comRotulo > 1 ? "s" : ""}.`
    : "";

  return `
    <section class="card card-nutri" aria-labelledby="tit-nutrientes">
      <h2 id="tit-nutrientes">Nutrientes por porção</h2>
      <ul class="nutri">${linhas}</ul>
      <button type="button" class="nutri-mais" id="ver-nutrientes" aria-haspopup="dialog">
        Ver de onde vêm as calorias
      </button>
      <p class="nutri-nota">
        Estimativa sobre os ingredientes crus, a partir de tabelas de referência —
        não é informação nutricional do prato pronto.${fora}${rotulos}
      </p>
    </section>`;
}

/**
 * Quais ingredientes estão usando o rótulo de um produto escolhido.
 *
 * Vale dizer, porque muda o número na tela sem que a receita tenha mudado — e o
 * rótulo pode declarar menos que a tabela, caso em que o resto continua vindo
 * dela. Silenciar isso seria apresentar dois números de origens diferentes com a
 * mesma cara.
 */
function notaDeRotulos(r) {
  const comRotulo = r.ingredientes.filter(i => i.nutrientesDoRotulo?.length);
  if (!comRotulo.length) return "";

  const lista = comRotulo
    .map(i => `${esc(i.produto.nome)}${i.nutrientesDoRotulo.length < ORDEM.length ? " (rótulo parcial)" : ""}`)
    .join(", ");

  return `<p class="nutri-dl-nota">Com o rótulo do produto escolhido: ${lista}.
          Onde o rótulo cala, o valor continua vindo da tabela de referência.</p>`;
}

/* ---------------------------------------------- janela de detalhes */

function barra(pct, cor) {
  const largura = Math.min(100, Math.max(0, pct));
  return `<span class="nb-barra"><i style="width:${largura.toFixed(1)}%;background:${cor}"></i></span>`;
}

const CORES = {
  proteina: "var(--terracotta)",
  carboidrato: "var(--olive)",
  gordura: "var(--amber)"
};

/**
 * Rosca da distribuição calórica.
 *
 * Um círculo só, com um arco por macro: `stroke-dasharray` recorta o
 * comprimento da fatia e `stroke-dashoffset` a empurra para o lugar. Sem
 * biblioteca e sem `path` calculado à mão.
 */
function rosca(itens) {
  const r = 26;
  const volta = 2 * Math.PI * r;
  let acumulado = 0;

  const arcos = itens.map(m => {
    const fatia = (m.pct / 100) * volta;
    const arco = `
      <circle class="rosca-fatia" cx="32" cy="32" r="${r}"
              stroke="${CORES[m.campo]}"
              stroke-dasharray="${fatia.toFixed(2)} ${(volta - fatia).toFixed(2)}"
              stroke-dashoffset="${(-acumulado).toFixed(2)}"></circle>`;
    acumulado += fatia;
    return arco;
  }).join("");

  const resumo = itens.map(m => `${ROTULOS[m.campo]} ${m.pctArredondado}%`).join(", ");

  return `
    <svg class="rosca" viewBox="0 0 64 64" role="img" aria-label="Distribuição das calorias: ${esc(resumo)}">
      <circle class="rosca-fundo" cx="32" cy="32" r="${r}"></circle>
      ${arcos}
    </svg>`;
}

function legendaRosca(itens) {
  return `
    <ul class="rosca-legenda">
      ${itens.map(m => `
        <li>
          <span class="rl-cor" style="background:${CORES[m.campo]}"></span>
          <span class="rl-nome">${esc(ROTULOS[m.campo])}</span>
          <b class="rl-pct">${m.pctArredondado}%</b>
          <em class="rl-meta">meta ${formatarPct(m.meta)}%</em>
        </li>`).join("")}
    </ul>`;
}

function detalhesHTML(r, prefs) {
  const d = detalhesNutricionais(r, prefs);
  const porcao = `1 de ${r.porcoes.padrao} ${esc(r.porcoes.unidade)}`;

  const barras = d.impacto.map(x => {
    const f = formatarNutriente(x.campo, x.valor);
    const ref = x.referencia.derivada
      ? `${Math.round(x.referencia.valor)} ${x.referencia.un}`
      : `${x.referencia.valor} ${x.referencia.un}`;
    const cor = CORES[x.campo] ?? "var(--terracotta-dk)";

    return `
      <li>
        <span class="nb-rotulo">${esc(ROTULOS[x.campo])}</span>
        ${barra(x.pct, cor)}
        <b class="nb-pct">${Math.round(x.pct)}%</b>
        <span class="nb-detalhe">${f.valor} ${f.un} de ${esc(ref)}</span>
      </li>`;
  }).join("");

  const baseDiaria = d.personalizado
    ? `Comparado com o consumo diário que você definiu em Preferências.`
    : `Referência de rotulagem para dieta de ${BASE_DIARIA_KCAL.toLocaleString("pt-BR")} kcal
       em adultos (ANVISA). Você pode trocar por seus números em Preferências.`;

  const fora = d.deFora.length
    ? `<p class="nutri-dl-nota">Fora da conta: ${d.deFora.map(x => `${esc(x.nome)} (${esc(x.motivo)})`).join(", ")}.</p>`
    : "";

  const rotulos = notaDeRotulos(r);

  return `
    <div class="pref-form">
      <header class="pref-head">
        <h2>Nutrientes por porção</h2>
        <button type="button" class="pref-fechar" aria-label="Fechar detalhes"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <p class="nutri-dl-sub">${esc(r.nome)} · ${porcao} · ${Math.round(d.porPorcao.kcal)} kcal</p>

      <section class="nutri-bloco">
        <h3>Quanto isso pesa no seu dia</h3>

        <div class="nutri-painel">
          <ul class="nutri-barras">${barras}</ul>

          <aside class="nutri-rosca" aria-labelledby="tit-rosca">
            <p class="rosca-titulo" id="tit-rosca">Calorias da receita</p>
            ${rosca(d.distribuicao.itens)}
            ${legendaRosca(d.distribuicao.itens)}
          </aside>
        </div>

        <p class="nutri-dl-nota">
          ${baseDiaria}
          Não é uma necessidade individual — a sua depende de idade, peso e atividade.
        </p>
        <p class="nutri-dl-nota">
          A rosca mostra de onde vêm as calorias <em>desta receita</em>, a 4 kcal por grama
          de proteína e carboidrato e 9 kcal por grama de gordura — por isso as fatias
          somam 100%. As metas de proteína, carboidrato e gordura saem do seu consumo
          diário de calorias com a distribuição que você escolheu.
        </p>
      </section>

      ${fora}
      ${rotulos}

      <footer class="pref-foot">
        <span class="nutri-dl-aviso">Estimativa sobre ingredientes crus.</span>
        <button type="button" class="pref-ok">Fechar</button>
      </footer>
    </div>`;
}

function utensilios(r) {
  return `
    <section class="card" aria-labelledby="tit-utensilios">
      <h2 id="tit-utensilios">Utensílios</h2>
      <ul class="ut">${r.utensilios.map(u => `<li>${esc(u)}</li>`).join("")}</ul>
    </section>`;
}

function preparo(r) {
  const passos = r.preparo.map(p => `
    <li>
      <h3>${esc(p.titulo)}</h3>
      <p>${esc(p.texto)}</p>
      ${p.dica ? `<div class="tip">${p.dica}</div>` : ""}
    </li>`).join("");

  const detalhe = r.tempo.detalhe ? ` · ${esc(r.tempo.detalhe)}` : "";

  return `
    <section aria-labelledby="tit-preparo">
      <h2 class="section" id="tit-preparo">Modo de preparo</h2>
      <p class="section-note">${r.preparo.length} etapas${detalhe}</p>
      <ol class="steps">${passos}</ol>
    </section>`;
}

/* ---------------------------------------------------------------- render */

/**
 * Renderiza a receita e liga o seletor de porções e a troca de medidas.
 *
 * `aoMudarPorcoes` é chamado a cada ajuste (usado para gravar na URL).
 * `lerPrefs` devolve as preferências atuais — chamado a cada render, para que
 * mudar a preferência no painel se reflita sem recarregar.
 */
export function renderizarReceita(base, alvo, { porcoes, aoMudarPorcoes, lerPrefs } = {}) {
  let atual = normalizarPorcoes(base, porcoes ?? base.porcoes.padrao);
  const trocas = new Map();   // índice do ingrediente -> unidade escolhida

  /* Os diálogos (#prefs, #nutri-detalhes, #produtos) são elementos fixos da
     página, não desta view. Sem desligar os ouvintes ao sair, cada visita à
     receita deixaria mais um — e o clique numa opção seria atendido também pelos
     ouvintes das visitas anteriores, que ainda apontam para a receita antiga. */
  const vida = controleDeVida();
  const ate = { signal: vida.signal };
  const prefs = () => lerPrefs?.() ?? {};
  let redesenharDetalhes = () => {};

  /* A receita renderizada é a do site com as escolhas do leitor por cima. `base`
     nunca muda: ela é dado do projeto, e a escolha vive no navegador dele. */
  let escolhas = carregarEscolhas()[base.slug] ?? {};
  let r = aplicarEscolhas(base, escolhas, mercadoAtivo(prefs()));

  alvo.innerHTML = `
    <article>
      ${foto(r)}
      ${dados(r, atual)}
      <div class="wrap">
        <div class="col-left">
          ${ingredientes(r, atual, prefs())}
          <div id="cartao-nutri">${nutrientes(r)}</div>
          ${utensilios(r)}
        </div>
        <div>${preparo(r)}</div>
      </div>
      <p class="sr-only" id="conv-anuncio" aria-live="polite"></p>
    </article>`;

  document.title = `${r.nome} · Chef`;
  document.body.dataset.slug = base.slug;
  document.body.dataset.porcoes = String(atual);

  const lista = alvo.querySelector("#lista-ingredientes");

  function redesenharLista() {
    fecharMenu();
    lista.innerHTML = listaIngredientes(r, atual, prefs(), trocas);
    // O total tem de acompanhar: sai das mesmas linhas que acabaram de mudar
    alvo.querySelector("#custo-total").innerHTML = custoTotal(r, atual, mercadoAtivo(prefs()));
    alvo.querySelector("#nota-preco").innerHTML = notaDePreco(mercadoAtivo(prefs()));
  }

  /* Trocar de produto move mais coisas que trocar de porção: o nome na linha, o
     preço, o total e os nutrientes, que passam a vir do rótulo. */
  function redesenharTudo() {
    redesenharLista();
    alvo.querySelector("#cartao-nutri").innerHTML = nutrientes(r);
    redesenharDetalhes();
  }

  /* ---------------------------------------------------------- porções */

  function aplicarPorcoes(novo) {
    const anterior = atual;
    atual = normalizarPorcoes(r, novo);
    if (atual === anterior) return;

    alvo.querySelector("#porcoes-valor").innerHTML =
      `${esc(String(atual))} <span>${esc(unidadePorcao(r, atual))}</span>`;
    redesenharLista();
    alvo.querySelector("#escala-aviso").innerHTML = avisoEscala(r, atual);

    for (const b of alvo.querySelectorAll(".pbtn")) {
      const destino = atual + Number(b.dataset.passo) * r.porcoes.passo;
      b.disabled = destino < r.porcoes.min || destino > r.porcoes.max;
    }

    document.body.dataset.porcoes = String(atual);
    aoMudarPorcoes?.(atual);
  }

  const grupoPorcoes = alvo.querySelector(".porcoes");

  grupoPorcoes.addEventListener("click", e => {
    const botao = e.target.closest(".pbtn");
    if (botao && !botao.disabled) aplicarPorcoes(atual + Number(botao.dataset.passo) * r.porcoes.passo);
  });

  grupoPorcoes.addEventListener("keydown", e => {
    const delta = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    aplicarPorcoes(atual + delta * r.porcoes.passo);
  });

  /* ------------------------------------------------------- carrinho */

  const botaoAdd = alvo.querySelector("#add-carrinho");
  botaoAdd.addEventListener("click", () => {
    adicionar(r.slug, atual);

    /* Mesmo acordo da vitrine: o botão diz o que faz, e o aviso conta o que
       aconteceu. Ver `src/js/toast.js`. */
    avisar(`${r.nome} · ${atual} ${unidadePorcao(r, atual)} no carrinho`,
      { url: "#/carrinho", texto: "Ver carrinho" });
  });

  /* --------------------------------------------- detalhes dos nutrientes */

  /* O ouvinte fica no invólucro, não no cartão: o cartão é substituído a cada
     troca de produto, e um ouvinte nele morreria junto. */
  const involucroNutri = alvo.querySelector("#cartao-nutri");
  const dialogoNutri = document.getElementById("nutri-detalhes");

  involucroNutri.addEventListener("click", e => {
    if (e.target.closest("a") || !e.target.closest(".card-nutri")) return;
    dialogoNutri.innerHTML = detalhesHTML(r, prefs());
    abrirDialogo(dialogoNutri);
  }, ate);

  ligarFechamento(dialogoNutri, ".pref-fechar, .pref-ok", ate);

  // Mudar preferências ou produto com a janela aberta redesenha o conteúdo dela
  redesenharDetalhes = () => {
    if (dialogoNutri.open || dialogoNutri.hasAttribute("open")) {
      dialogoNutri.innerHTML = detalhesHTML(r, prefs());
    }
  };

  /* ------------------------------------------------- escolha de produto */

  const picker = ligarJanelaDeProdutos(document.getElementById("produtos"), { sinal: vida.signal });

  function abrirProdutos(i) {
    const ing = r.ingredientes[i];
    const mult = fator(r, atual);
    const d = escalarIngrediente(ing, mult, { prefs: prefs(), unidadeForcada: trocas.get(i) });

    picker.abrir({
      ing,
      pedido: { qtd: ing.qtd == null ? null : ing.qtd * mult, un: ing.un },
      pedidoTexto: `${d.qtd} ${ing.nome}`,
      automaticoId: maisBarato(ing.id, ing, mercadoAtivo(prefs()))?.id ?? null,
      escolhidoId: () => escolhas[ing.id] ?? null,
      mercado: mercadoAtivo(prefs()),
      escolher: produtoId => {
        const gravado = gravarEscolha(base.slug, ing.id, produtoId);
        escolhas = gravado.escolhas[base.slug] ?? {};
        r = aplicarEscolhas(base, escolhas, mercadoAtivo(prefs()));
        redesenharTudo();

        alvo.querySelector("#conv-anuncio").textContent =
          `${ing.nome}: ${produtoId ? produto(produtoId).nome : "o site escolhe o mais barato"}.`;
      },
      // O botão que abriu foi redesenhado no meio: procura-se pelo índice
      aoFechar: () => lista.querySelector(`li[data-i="${i}"] .escolher-produto`)?.focus()
    });
  }

  /* ------------------------------------------------- troca de medidas */

  function fecharMenu(devolverFoco = false) {
    const aberto = lista.querySelector(".conv-menu");
    if (!aberto) return;

    const gatilho = aberto.closest("li")?.querySelector(".qty.conv");
    aberto.remove();
    gatilho?.setAttribute("aria-expanded", "false");
    if (devolverFoco) gatilho?.focus();
  }

  function abrirMenu(botao) {
    const jaAberto = botao.getAttribute("aria-expanded") === "true";
    fecharMenu();
    if (jaAberto) return;

    const i = Number(botao.dataset.i);
    const dados = escalarIngrediente(r.ingredientes[i], fator(r, atual), {
      prefs: prefs(), unidadeForcada: trocas.get(i)
    });

    botao.closest("li").insertAdjacentHTML("beforeend", menuConversao(dados.alternativas));
    botao.setAttribute("aria-expanded", "true");
    botao.closest("li").querySelector(".conv-menu button")?.focus();
  }

  function escolher(i, un) {
    // Guarda a escolha mesmo quando é a unidade da receita: com uma preferência
    // ativa, "como na receita" precisa ser uma decisão que vence a preferência.
    trocas.set(i, un);

    redesenharLista();

    const d = escalarIngrediente(r.ingredientes[i], fator(r, atual), { prefs: prefs(), unidadeForcada: trocas.get(i) });
    alvo.querySelector("#conv-anuncio").textContent = `${d.item}: ${d.qtd}`;
    lista.querySelector(`li[data-i="${i}"] .qty.conv`)?.focus();
  }

  lista.addEventListener("click", e => {
    const opcao = e.target.closest(".conv-menu button");
    if (opcao) {
      escolher(Number(opcao.closest("li").dataset.i), opcao.dataset.un);
      return;
    }

    const gatilho = e.target.closest(".qty.conv");
    if (gatilho) { abrirMenu(gatilho); return; }

    const nome = e.target.closest(".escolher-produto");
    if (nome) abrirProdutos(Number(nome.dataset.i));
  });

  lista.addEventListener("keydown", e => {
    if (e.key === "Escape") { fecharMenu(true); return; }

    const menu = lista.querySelector(".conv-menu");
    if (!menu || !menu.contains(e.target)) return;

    const delta = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();

    const itens = [...menu.querySelectorAll("button")];
    const proximo = itens[(itens.indexOf(e.target) + delta + itens.length) % itens.length];
    proximo?.focus();
  });

  // Clique fora fecha o menu
  const cliqueFora = e => { if (!e.target.closest(".conv-menu, .qty.conv")) fecharMenu(); };
  document.addEventListener("click", cliqueFora, ate);

  return {
    porcoes: atual,
    /** Chamado quando as preferências mudam: redesenha sem perder as trocas manuais. */
    atualizarPrefs: () => { redesenharLista(); redesenharDetalhes(); },
    destruir: () => vida.abort()
  };
}
