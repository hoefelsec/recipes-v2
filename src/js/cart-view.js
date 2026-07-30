/* Do carrinho até a folha de compras, em três passos.
 *
 *   1. Revisar receitas   porções, preparos, excluir — e, abrindo uma receita,
 *                         trocar o produto de cada ingrediente
 *   2. Revisar a compra    o que vai na sacola, com preço e sobra; marcar o que
 *                         já se tem em casa
 *   3. Imprimir            a folha, uma linha por item  (#/lista)
 *
 * Por que passos: são três perguntas diferentes, e misturá-las numa tela só era o
 * que deixava o carrinho cansativo. "Quanto vou fazer?" é sobre as receitas; "o
 * que vou levar?" é sobre produtos e embalagens; "o que marco no mercado?" é
 * sobre papel. Cada passo responde uma.
 *
 * O passo vive na URL (`#/carrinho?passo=2`) e se troca por link, não por
 * JavaScript: assim o botão "voltar" do navegador anda pelo assistente de graça,
 * e um link pode apontar para o meio dele. O preço é redesenhar a área a cada
 * passo, o que aqui não custa nada.
 */

import { esc, controleDeVida } from "./dom.js";
import * as carrinho from "./cart.js";
import { stepperHTML, fotoHTML, unidadePorcao, precoDaReceita } from "./ui.js";
import { mercadoAtivo } from "./settings.js";
import { totaisDaCompra, textoPrecisa } from "./purchase.js";
import { escalarIngrediente, fator } from "./scaling.js";
import { maisBarato, custoDoIngrediente, textoCusto, textoPrecoUnitario } from "./pricing.js";
import { ligarJanelaDeProdutos } from "./product-picker.js";
import { produtosDe } from "../data/produtos.js";
import { temEmCasa } from "../data/ingredientes.js";
import { aplicarEscolhas } from "../data/resolve.js";
import {
  ESCOPO_CARRINHO, carregarEscolhas, escolher as gravarEscolha,
  carregarTenho, marcarTenho
} from "./choices.js";
import { comparativoDeMercado } from "./market-compare.js";

export const PASSOS = [
  { numero: 1, rotulo: "Receitas", titulo: "Revise as receitas", url: "#/carrinho" },
  { numero: 2, rotulo: "Mercado", titulo: "Escolha o mercado", url: "#/carrinho?passo=2" },
  { numero: 3, rotulo: "Compra", titulo: "Revise a compra", url: "#/carrinho?passo=3" },
  { numero: 4, rotulo: "Imprimir", titulo: "Folha de compras", url: "#/lista" }
];

/** O passo pedido na URL, dentro dos limites do carrinho (1 a 3). O 4º é outra rota. */
export const passoValido = valor => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
};

const dataAttrs = dados =>
  Object.entries(dados).map(([k, v]) => `data-${k}="${esc(String(v))}"`).join(" ");

/* ------------------------------------------------------------- cabeçalho */

function trilha(passo) {
  return `
    <ol class="passos" aria-label="Etapas">
      ${PASSOS.map(p => {
        const estado = p.numero === passo ? "atual" : (p.numero < passo ? "feito" : "adiante");
        const dentro = `
          <span class="passo-num" aria-hidden="true">${p.numero}</span>
          <span class="passo-rotulo">${esc(p.rotulo)}</span>`;

        // O passo atual não é link para si mesmo; os outros são, e o "voltar" anda
        return `
          <li class="passo-${estado}"${p.numero === passo ? ' aria-current="step"' : ""}>
            ${p.numero === passo ? dentro : `<a href="${p.url}">${dentro}</a>`}
          </li>`;
      }).join("")}
    </ol>`;
}

/**
 * A cor de uma linha diante do mercado ativo.
 *
 *   amarelo   você escolheu um produto que este mercado não vende
 *   vermelho  este mercado não vende nada que sirva
 *   nada      dá para comprar aqui
 *
 * A diferença entre os dois avisos é o que se faz com eles: o amarelo é uma troca
 * ("escolha outro produto"), o vermelho é um impedimento ("aqui não tem"). Um
 * "sem preço" genérico obrigava a abrir a janela para descobrir qual dos dois era.
 */
export function estadoNoMercado(ing, produtos, custo, mercado) {
  /* "A gosto" não tem quantidade para precificar, e isso não é defeito nenhum — é a
     receita dizendo que quem cozinha decide. Sem esta linha, a pimenta da feijoada
     aparecia em vermelho no painel, como se faltasse produto. */
  if (ing.escala === false || ing.qtd == null) return { classe: "", motivo: "" };

  if (mercado && ing.produto?.foraDoMercado) {
    return { classe: "alerta", motivo: "o produto escolhido não é vendido neste mercado" };
  }
  if (!produtos.length) {
    return {
      classe: "errada",
      motivo: mercado ? "nenhum produto vendido neste mercado" : "nenhum produto no catálogo serve"
    };
  }
  if (!custo) return { classe: "errada", motivo: "sem como precificar" };
  return { classe: "", motivo: "" };
}

/* ------------------------------------------------------ passo 1: receitas */

/**
 * O estado de cada ingrediente da receita, uma vez.
 *
 * A linha fechada resume e o painel aberto detalha — os dois leem daqui, para não
 * haver como o resumo dizer "1 a resolver" e o painel mostrar outra coisa.
 */
function estadosDaReceita(receita, porcoes, escolhas, mercado) {
  const mult = fator(receita, porcoes);
  const comEscolhas = aplicarEscolhas(receita, escolhas[receita.slug] ?? {}, mercado);

  return comEscolhas.ingredientes.map((ing, i) => {
    if (ing.subtitulo) return { ing, i, mult, subtitulo: true };
    if (temEmCasa(ing)) return { ing, i, mult, emCasa: true, estado: { classe: "tenho", motivo: "" } };

    const c = custoDoIngrediente(ing, ing.qtd == null ? null : ing.qtd * mult, mercado);
    const produtos = produtosDe(ing.id, mercado);

    return { ing, i, mult, c, produtos, estado: estadoNoMercado(ing, produtos, c, mercado) };
  });
}

/** Quantas linhas de alerta e de erro a receita tem, para a linha fechada. */
const contarAvisos = estados => ({
  alerta: estados.filter(e => e.estado?.classe === "alerta").length,
  errada: estados.filter(e => e.estado?.classe === "errada").length
});

/** Uma linha de ingrediente dentro da receita aberta. */
function linhaIngrediente({ ing, mult, i, subtitulo, emCasa, c, produtos, estado }, slug) {
  if (subtitulo) return "";

  const d = escalarIngrediente(ing, mult, {});

  /* Verde, como no passo 2: já está em casa e não entra na compra. Sal e água são
     o caso permanente disso — não se marca a caixa, assume-se. */
  if (emCasa) {
    return `
      <li class="rev-ing tenho">
        <span class="rev-ing-nome">${esc(ing.nome)}</span>
        <span class="rev-ing-qtd">${esc(d.qtd)}</span>
        <span class="rev-ing-prod vazio">já em casa</span>
        <span class="rev-ing-preco"></span>
      </li>`;
  }

  const alvo = produtos.length
    ? `<button type="button" class="rev-ing-prod escolher" data-slug="${esc(slug)}" data-i="${i}"
               aria-haspopup="dialog"
               title="${esc(["Trocar o produto", estado.motivo].filter(Boolean).join(" — "))}">
         ${/* Sem preço, mas com escolha, o nome é o da escolha: ela continua de pé,
              e trocar "Manteiga Président" por "escolher produto" esconderia
              justamente o que o amarelo está avisando. */""}
         ${c ? esc(c.produto.nome) : (ing.produto ? esc(ing.produto.nome) : "escolher produto")}
         ${estado.motivo ? `<span class="sr-only">(${esc(estado.motivo)})</span>` : ""}
       </button>`
    : `<span class="rev-ing-prod vazio">sem produto</span>`;

  return `
    <li class="rev-ing${estado.classe ? ` ${estado.classe}` : ""}">
      <span class="rev-ing-nome">${esc(ing.nome)}</span>
      <span class="rev-ing-qtd">${esc(d.qtd)}</span>
      ${alvo}
      <span class="rev-ing-preco">${c ? esc(textoCusto(c.valor)) : "???"}</span>
    </li>`;
}

/**
 * Os ingredientes com as escolhas do leitor aplicadas.
 *
 * O carrinho guarda receitas cruas — é o que a compra precisa —, então é aqui que
 * as escolhas entram. Sem isto, trocar o produto não aparecia na linha: o painel
 * seguia mostrando o palpite do site.
 */
function ingredientesDaReceita(receita, estados) {
  return `
    <ul class="rev-ings">
      ${estados.map(e => linhaIngrediente(e, receita.slug)).join("")}
    </ul>
    <p class="rev-ings-nota">
      Clique no produto para trocá-lo. A escolha vale para esta receita; no passo
      seguinte você decide o que vai na sacola.
    </p>`;
}

/**
 * O resumo dos avisos na linha FECHADA da receita.
 *
 * Sem isto, a única forma de saber que havia algo a resolver era abrir cada receita
 * uma por uma — e o motivo para abrir era justamente o que só se via depois de
 * abrir. A contagem aparece do lado de fora; o detalhe continua dentro.
 */
function resumoDeAvisos({ alerta, errada }) {
  if (!alerta && !errada) return "";

  const partes = [
    errada ? `<span class="cart-chave vermelha">${errada}
      ${errada === 1 ? "ingrediente não é vendido" : "ingredientes não são vendidos"}
      neste mercado</span>` : "",
    alerta ? `<span class="cart-chave amarela">${alerta}
      ${alerta === 1 ? "escolha não é vendida" : "escolhas não são vendidas"} aqui</span>` : ""
  ].filter(Boolean);

  return `<p class="cart-avisos">${partes.join("")}</p>`;
}

function linhaReceita({ receita, porcoes, qtd }, custo, aberta, escolhas, mercado) {
  const url = `#/receita/${encodeURIComponent(receita.slug)}?porcoes=${porcoes}`;
  const dados = { slug: receita.slug, porcoes };

  const estados = estadosDaReceita(receita, porcoes, escolhas, mercado);
  const contagem = contarAvisos(estados);

  /* A linha inteira ganha a cor do aviso mais grave que ela tem. Vermelho manda:
     "escolha outro produto" é menor do que "aqui não tem". */
  const classe = contagem.errada ? " errada" : (contagem.alerta ? " alerta" : "");

  return `
    <li class="cart-linha${classe}" data-slug="${esc(receita.slug)}" data-porcoes="${porcoes}">
      <a class="cart-foto" href="${url}" tabindex="-1" aria-hidden="true">
        ${fotoHTML(receita, { tamanho: 300 })}
      </a>

      <div class="cart-info">
        <p class="cart-grupo">${esc(receita.grupo)}</p>
        <h3 class="cart-nome"><a href="${url}">${esc(receita.nome)}</a></h3>
        <p class="cart-detalhe">${esc(receita.tempo.valor)} ${esc(receita.tempo.unidade)} · ${esc(receita.dificuldade)}</p>
        ${custo && custo.total > 0
          ? precoDaReceita({ ...custo, total: custo.linha }, unidadePorcao(receita, 1))
          : ""}
        ${resumoDeAvisos(contagem)}
      </div>

      <div class="cart-controle cart-porcoes">
        <p class="cart-rotulo">Porções</p>
        ${stepperHTML({
          valor: porcoes,
          unidade: unidadePorcao(receita, porcoes),
          min: receita.porcoes.min,
          max: receita.porcoes.max,
          passo: receita.porcoes.passo ?? 1,
          rotulo: "Porções",
          dados: { ...dados, campo: "porcoes" }
        })}
      </div>

      <div class="cart-controle cart-preparos">
        <p class="cart-rotulo">Preparos</p>
        ${stepperHTML({
          valor: qtd,
          min: 1,
          max: 20,
          rotulo: "Preparos",
          dados: { ...dados, campo: "qtd" },
          classe: "estreito"
        })}
      </div>

      <button type="button" class="cart-remover" ${dataAttrs(dados)}>Excluir</button>

      <div class="cart-abrir">
        <button type="button" class="rev-toggle" ${dataAttrs(dados)} aria-expanded="${aberta}">
          ${aberta ? "Esconder ingredientes" : "Ver ingredientes"}
          ${!aberta && (contagem.errada || contagem.alerta)
            ? `<span class="sr-only">— ${contagem.errada + contagem.alerta} a resolver</span>`
            : ""}
        </button>
      </div>

      ${aberta ? `<div class="rev-painel">${ingredientesDaReceita(receita, estados)}</div>` : ""}
    </li>`;
}

/* -------------------------------------------------------- passo 2: compra */

/* Se esta linha da receita caiu nesta linha da compra. O par receita+pedido, e não
   só o pedido: o mesmo ingrediente pode estar em duas linhas, uma por produto,
   quando as receitas escolheram diferente. */
const mesmoPedido = (l, slug, ingId) =>
  (l.requisicoes ?? []).some(r => r.slug === slug && r.ingId === ingId);

const semEscolha = l => l.origem === "automatico" && produtosDe(l.ing.id).length > 1;

/**
 * Genéricos primeiro.
 *
 * "Genérico" é a linha em que o site escolheu sozinho havendo mais de um produto:
 * é onde falta decisão, e é o que se vem revisar. Depois vem o resto, e por
 * último o que já se tem em casa — está resolvido, sai da frente.
 */
export function ordenarCompra(linhas) {
  const peso = l => (l.tenho ? 2 : (semEscolha(l) ? 0 : 1));

  return [...linhas].sort((a, b) =>
    peso(a) - peso(b) || a.ing.nome.localeCompare(b.ing.nome, "pt-BR"));
}

/**
 * Duas cores, um sentido cada.
 *
 *   verde     já está em casa — não entra na compra de hoje
 *   vermelho  tem algo errado nesta linha
 *   nada      vai para a sacola
 *
 * As duas dizem respeito à COMPRA, não à decisão: "isto eu não preciso levar" e
 * "isto não dá para levar assim". De quem partiu a escolha do produto é outro
 * assunto, e não é o que se quer ver de relance ao correr a lista.
 *
 * O terceiro estado não tem cor de propósito: é o caso comum, e colorir o comum é
 * não colorir nada.
 *
 * `motivo` acompanha a cor em texto, porque cor sozinha não é informação para
 * quem não a vê — vai no `title` e numa linha só de leitor de tela. No verde esse
 * papel é do riscado, que se vê sem enxergar cor.
 */
function estadoDaCompra(l, mercado) {
  /* "Já tenho" vem antes de qualquer aviso: a linha não vai para a sacola, e um
     defeito no que não se leva não é problema de hoje. */
  if (l.tenho) return { classe: "tenho", motivo: "você marcou que já tem em casa" };

  /* Amarelo antes de vermelho: escolher outro produto resolve, e é uma troca, não
     um impedimento. */
  if (mercado && l.produto?.foraDoMercado) {
    return { classe: "alerta", motivo: "o produto escolhido não é vendido neste mercado" };
  }
  if (!l.produto) {
    return {
      classe: "errada",
      motivo: mercado ? "nenhum produto vendido neste mercado" : "nenhum produto no catálogo serve"
    };
  }
  if (l.embalagens == null) return { classe: "errada", motivo: "não dá para converter a embalagem" };
  return { classe: "", motivo: "" };
}

function linhaCompra(l, mercado) {
  const p = l.produto;
  const estado = estadoDaCompra(l, mercado);

  const nome = p
    ? `${esc(p.nome)}${p.marca ? ` <em class="ing-marca">${esc(p.marca)}</em>` : ""}`
    : `${esc(l.ing.nome)} <em class="ing-marca">${
        mercado ? "não vendido aqui" : "sem produto"}</em>`;

  /* Numa linha dividida, dizer quantos produtos daquele ingrediente vão na sacola:
     duas linhas com o mesmo ingrediente no rodapé pareceriam engano. */
  const contexto = [
    l.ing.nome,
    ...l.receitas,
    l.divididaCom.length ? `1 de ${l.divididaCom.length} produtos` : ""
  ].filter(Boolean).join(" · ");

  const conteudo = `
    <span class="compra-nome">${nome}
      ${estado.motivo ? `<span class="sr-only">(${esc(estado.motivo)})</span>` : ""}
      <small>${esc(contexto)}</small>
    </span>
    <span class="compra-precisa">${esc(textoPrecisa(l.precisa))}<small>precisa</small></span>
    <span class="compra-emb">${l.embalagens == null ? "—" : esc(String(l.embalagens))}<small>${
      l.embalagens === 1 ? "embalagem" : "embalagens"}</small></span>
    <span class="compra-preco">${l.custoCompra == null ? "???" : esc(textoCusto(l.custoCompra))}<small>${
      l.sobra > 0 ? `sobra ${esc(textoPrecisa({ qtd: l.sobra, un: l.precisa.un }))}` : "sem sobra"}</small></span>`;

  const titulo = [
    "Ver quem pede e trocar o produto",
    // Sem preço, o preço por medida não diz nada — e o motivo já vem em seguida
    p && p.preco != null ? textoPrecoUnitario(p) : "",
    estado.motivo
  ].filter(Boolean).join(" — ");

  const escolha = p
    ? `<button type="button" class="compra-item" data-chave="${esc(l.chave)}"
               aria-haspopup="dialog" title="${esc(titulo)}">${conteudo}</button>`
    : `<span class="compra-item" title="${esc(estado.motivo)}">${conteudo}</span>`;

  return `
    <li class="compra-linha${estado.classe ? ` ${estado.classe}` : ""}">
      <label class="compra-tenho" title="Já tenho em casa">
        <input type="checkbox" data-tenho="${esc(l.chave)}" ${l.tenho ? "checked" : ""}>
        <span class="sr-only">Já tenho ${esc(l.ing.nome)} em casa</span>
      </label>
      ${escolha}
    </li>`;
}

function compraHTML(t) {
  const linhas = ordenarCompra(t.linhas);
  const faltando = linhas.filter(l => !l.tenho && semEscolha(l)).length;

  /* A legenda das cores. Cada uma só é citada quando está na tela: explicar um
     sinal que não apareceu é ensinar a procurá-lo. */
  const emCasa = linhas.filter(l => l.tenho).length;
  const alerta = linhas.filter(l => estadoDaCompra(l, t.mercado).classe === "alerta").length;
  const errada = linhas.filter(l => estadoDaCompra(l, t.mercado).classe === "errada").length;
  const legenda = [
    emCasa ? `<span class="compra-chave verde">${emCasa}
      ${emCasa === 1 ? "item já está" : "itens já estão"} em casa</span>` : "",
    alerta ? `<span class="compra-chave amarela">${alerta}
      ${alerta === 1 ? "escolha não é vendida" : "escolhas não são vendidas"} aqui</span>` : "",
    errada ? `<span class="compra-chave vermelha">${errada}
      ${errada === 1 ? "linha precisa" : "linhas precisam"} de atenção</span>` : ""
  ].filter(Boolean).join("");

  const fora = t.deFora.length
    ? `<p class="compra-fora">Fora da conta:
         ${[...new Map(t.deFora.map(x => [x.nome, x])).values()]
           .map(x => `${esc(x.nome)} (${esc(x.motivo)})`).join(", ")}.</p>`
    : "";

  return `
    <p class="compra-dica">
      ${faltando
        ? `${faltando} ${faltando === 1 ? "item está" : "itens estão"} com o produto que o site
           escolheu — vêm primeiro na lista. Clique para ver quem pede e trocar.`
        : "Clique em um item para ver quais receitas o pedem e trocar o produto."}
      Marque a caixa do que você já tem em casa.
    </p>

    ${legenda ? `<p class="compra-legenda">${legenda}</p>` : ""}

    <ul class="compra-lista">${linhas.map(l => linhaCompra(l, t.mercado)).join("")}</ul>

    <!-- Os quatro sempre, inclusive zerados. Trocar uma caixa por outra conforme o
         número faz a tela mudar de assunto quando se marca uma caixinha, e obriga
         a reaprender onde as coisas estão — o zero informa mais que o sumiço. -->
    <dl class="compra-total">
      <div>
        <dt>Refeições</dt>
        <dd>${esc(textoCusto(t.refeicoes))}</dd>
        <p>o que as receitas consomem</p>
      </div>
      <div class="compra-total-forte">
        <dt>Compra</dt>
        <dd>${esc(textoCusto(t.compra))}</dd>
        <p>embalagens inteiras, no caixa</p>
      </div>
      <div>
        <dt>Sobra</dt>
        <dd>${esc(textoCusto(t.sobra))}</dd>
        <p>fica no armário para a próxima</p>
      </div>
      <div>
        <dt>Já tenho</dt>
        <dd>${esc(textoCusto(t.economizado))}</dd>
        <p>não entra na compra de hoje</p>
      </div>
    </dl>

    ${fora}
    <p class="compra-nota">
      Preços fictícios, para teste. Sal e água ficam de fora: assume-se que já
      estão em casa.
    </p>`;
}

/* ----------------------------------------------- passo 2: escolher mercado */

/** O cabeçalho de uma coluna de mercado: logo, nome, selo e botão de escolher. */
function colunaMercado(m, ativo, melhor) {
  const eAtivo = m.id === ativo;
  return `
    <th scope="col" class="mc-col${eAtivo ? " ativo" : ""}${m.id === melhor ? " melhor" : ""}">
      <span class="mc-col-topo">
        <img class="mc-logo" src="${esc(m.logo)}" alt="" onerror="this.remove()">
        <b>${esc(m.nome)}</b>
      </span>
      ${m.id === melhor ? `<span class="mc-selo">melhor opção</span>` : ""}
      <button type="button" class="mc-escolher${eAtivo ? " atual" : ""}" data-escolher-mercado="${esc(m.id)}">
        ${eAtivo ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Escolhido' : "Escolher"}
      </button>
    </th>`;
}

/** Uma célula da tabela: o custo, ou o aviso amarelo/vermelho. */
function celulaMercado(c, melhor) {
  const classe = `mc-cel${c.estado ? ` ${c.estado}` : ""}${melhor ? " melhor" : ""}`;

  if (c.valor != null) {
    const emb = c.embalagens != null
      ? `<small>${c.embalagens} ${c.embalagens === 1 ? "emb." : "embs."}</small>` : "";
    const aviso = c.estado === "alerta"
      ? `<i class="fa-solid fa-triangle-exclamation mc-icone" title="${esc(c.motivo)}" aria-hidden="true"></i> ` : "";
    const titulo = c.produto ? `${c.produto.nome}${c.produto.marca ? ` (${c.produto.marca})` : ""}` : "";
    return `<td class="${classe}" title="${esc([titulo, c.motivo].filter(Boolean).join(" — "))}">
              ${aviso}<b>${esc(textoCusto(c.valor))}</b>${emb}
            </td>`;
  }

  const icone = c.estado === "errada" ? "fa-ban" : "fa-triangle-exclamation";
  return `<td class="${classe}" title="${esc(c.motivo ?? "")}">
            <span class="mc-sem"><i class="fa-solid ${icone}" aria-hidden="true"></i></span>
          </td>`;
}

function mercadoHTML(comp, ativo) {
  const { mercados, linhas, matriz, totais, melhor } = comp;

  const corpo = linhas.map(l => {
    const contexto = [textoPrecisa(l.precisa), l.escolhidoNome].filter(Boolean).join(" · ");
    const celulas = mercados
      .map(m => celulaMercado(matriz.get(l.chave).get(m.id), m.id === melhor))
      .join("");
    return `
      <tr>
        <th scope="row" class="mc-ing">
          ${esc(l.ing.nome)}
          <small>${esc(contexto)}</small>
        </th>
        ${celulas}
      </tr>`;
  }).join("");

  const totalRow = mercados.map(m => {
    const t = totais.get(m.id);
    return `<td class="mc-cel${m.id === melhor ? " melhor" : ""}">
      ${t.faltas ? `<span class="mc-piso">faltam ${t.faltas}</span>` : ""}
      <b>${esc(textoCusto(t.valor))}</b>
    </td>`;
  }).join("");

  return `
    <p class="compra-dica">
      Cada preço é o mais barato para a quantidade que a compra precisa, em
      embalagens inteiras. Onde você escolheu um produto, é o preço dele.
      Escolha um mercado para seguir para a compra.
    </p>

    <div class="mc-wrap">
      <table class="mercado-tabela">
        <thead>
          <tr>
            <th scope="col" class="mc-canto">Ingrediente</th>
            ${mercados.map(m => colunaMercado(m, ativo, melhor)).join("")}
          </tr>
        </thead>
        <tbody>${corpo}</tbody>
        <tfoot>
          <tr class="mc-total">
            <th scope="row">Total estimado</th>
            ${totalRow}
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="compra-nota">
      <i class="fa-solid fa-triangle-exclamation nota-amarela" aria-hidden="true"></i>
      amarelo: o produto escolhido não é vendido ali — o preço é do mais barato que serve.
      <i class="fa-solid fa-ban nota-vermelha" aria-hidden="true"></i>
      vermelho: o mercado não vende nenhum produto para o ingrediente, e o total vira um piso.
      Preços fictícios, para teste.
    </p>`;
}

/** O bloco no alto da janela do passo 2: quem pede este ingrediente, e quanto. */
function contextoDoIngrediente(l, itens, escolhas) {
  const pedidos = [];

  for (const { receita, porcoes, qtd } of itens) {
    const mult = (porcoes / receita.porcoes.padrao) * qtd;

    for (const ing of receita.ingredientes) {
      if (ing.subtitulo || !mesmoPedido(l, receita.slug, ing.id)) continue;
      const d = escalarIngrediente(ing, mult, {});
      pedidos.push({ receita: receita.nome, qtd: d.qtd, item: ing.nome });
    }
  }

  if (!pedidos.length) return "";

  return `
    <section class="prod-quem">
      <h3>Quem pede</h3>
      <ul>
        ${pedidos.map(p => `
          <li>
            <span>${esc(p.receita)}</span>
            <em>${esc(p.item)}</em>
            <b>${esc(p.qtd)}</b>
          </li>`).join("")}
      </ul>
      <p class="prod-quem-total">Somado: <b>${esc(textoPrecisa(l.precisa))}</b></p>
    </section>`;
}

/* --------------------------------------------------------------- vazio */

function vazioHTML() {
  return `
    <div class="area">
      <header class="area-head">
        <p class="eyebrow-escuro">Carrinho</p>
        <h1>Seu carrinho está vazio</h1>
        <p class="area-sub">Escolha receitas na vitrine para montar a lista de compras.</p>
      </header>
      <p><a class="btn-primario" href="#/comprar">Ver receitas</a></p>
    </div>`;
}

/* --------------------------------------------------------------- render */

export function renderizarCarrinho(alvo, { passo = 1 } = {}) {
  const vida = controleDeVida();
  const atual = passoValido(passo);
  let compra = null;             // último cálculo, para a janela consultar
  let itensAtuais = [];
  let mercadoDesenhado = null;   // o mercado do desenho atual, para a janela usar
  const abertas = new Set();     // receitas expandidas no passo 1

  function desenhar() {
    const itens = carrinho.lerComReceitas();
    const mercado = mercadoAtivo();
    itensAtuais = itens;
    mercadoDesenhado = mercado;

    if (!itens.length) {
      compra = null;
      alvo.innerHTML = vazioHTML();
      return;
    }

    const escolhas = carregarEscolhas();
    compra = totaisDaCompra(itens, escolhas, { tenho: carregarTenho(), mercado });

    const pratos = itens.reduce((s, i) => s + i.qtd, 0);
    const info = PASSOS.find(p => p.numero === atual);

    let corpo;
    if (atual === 1) {
      corpo = `<p class="area-sub">${itens.length} ${itens.length === 1 ? "receita" : "receitas"},
           ${pratos} ${pratos === 1 ? "preparo" : "preparos"}. A mesma receita com porções
           diferentes fica em linhas separadas.</p>
         <ul class="cart-lista">${itens
           .map((it, i) => linhaReceita(it, compra.porItem[i], abertas.has(it.chave), escolhas, mercado))
           .join("")}</ul>`;
    } else if (atual === 2) {
      const comp = comparativoDeMercado(itens, escolhas);
      corpo = comp.linhas.length
        ? mercadoHTML(comp, mercado)
        : `<p class="area-sub">Nada para comparar entre os mercados.</p>`;
    } else {
      corpo = compra.contados ? compraHTML(compra) : `<p class="area-sub">Nada para comprar.</p>`;
    }

    const rodape = atual === 1
      ? `<button type="button" class="btn-texto" id="limpar-carrinho">Limpar carrinho</button>
         <a class="btn-primario" href="#/carrinho?passo=2">Escolher mercado</a>`
      : atual === 2
        ? `<a class="btn-texto" href="#/carrinho">Voltar às receitas</a>
           <a class="btn-primario" href="#/carrinho?passo=3">Continuar para a compra</a>`
        : `<a class="btn-texto" href="#/carrinho?passo=2">Voltar ao mercado</a>
           <a class="btn-primario" id="ir-imprimir" href="#/lista?imprimir=1">Imprimir a lista</a>`;

    alvo.innerHTML = `
      <div class="area">
        <header class="area-head">
          <p class="eyebrow-escuro">Lista de compras · passo ${atual} de 4</p>
          <h1>${esc(info.titulo)}</h1>
          ${trilha(atual)}
        </header>

        ${corpo}

        <div class="cart-rodape">${rodape}</div>
      </div>`;

    picker.atualizar();
  }

  /* --------------------------------------------------- janela de produtos */

  const picker = ligarJanelaDeProdutos(document.getElementById("produtos"), { sinal: vida.signal });

  /**
   * Ids de produto já escolhidos para outra receita do mesmo carrinho.
   *
   * A janela põe estes no alto: reaproveitar o pote que já vai na sacola é quase
   * sempre o que se quer, e dois potes do mesmo ingrediente é dinheiro parado.
   */
  function produtosEmUso(exceto) {
    const escolhas = carregarEscolhas();
    const usados = new Set();

    for (const { receita } of itensAtuais) {
      if (receita.slug === exceto) continue;
      for (const id of Object.values(escolhas[receita.slug] ?? {})) usados.add(id);
    }
    for (const id of Object.values(escolhas[ESCOPO_CARRINHO] ?? {})) usados.add(id);

    return usados;
  }

  /** Passo 1: escolha para uma receita. */
  function abrirDaReceita(slug, i) {
    const item = itensAtuais.find(it => it.receita.slug === slug);
    if (!item) return;

    const comEscolhas = aplicarEscolhas(item.receita, carregarEscolhas()[slug] ?? {});
    const ing = comEscolhas.ingredientes[i];
    if (!ing) return;

    const mult = fator(item.receita, item.porcoes);
    const d = escalarIngrediente(ing, mult, {});

    picker.abrir({
      ing,
      pedido: { qtd: ing.qtd == null ? null : ing.qtd * mult, un: ing.un },
      pedidoTexto: `${d.qtd} ${ing.nome} em ${item.receita.nome}`,
      mercado: mercadoDesenhado,
      automaticoId: maisBarato(ing.id, ing, mercadoDesenhado)?.id ?? null,
      escolhidoId: () => carregarEscolhas()[slug]?.[ing.id] ?? null,
      emUso: () => produtosEmUso(slug),
      escolher: produtoId => {
        gravarEscolha(slug, ing.id, produtoId);
        desenhar();
      },
      aoFechar: () => alvo.querySelector(`.escolher[data-slug="${slug}"][data-i="${i}"]`)?.focus()
    });
  }

  /** Passo 2: escolha para esta linha da compra, com o bloco de quem pede. */
  function abrirDaCompra(chave) {
    const l = compra?.linhas.find(x => x.chave === chave);
    if (!l) return;

    picker.abrir({
      ing: l.ing,
      pedido: l.precisa,
      pedidoTexto: `${textoPrecisa(l.precisa)} de ${l.ing.nome}`,
      mercado: mercadoDesenhado,
      automaticoId: maisBarato(l.ing.id, l.ing, mercadoDesenhado)?.id ?? null,
      /* O que está marcado é o produto que a linha REALMENTE usa, venha ele do
         carrinho, da receita ou da divisão. Antes só o escopo do carrinho contava,
         e a janela abria sem nada marcado justamente quando havia uma escolha para
         revisar — inclusive a que este mercado não vende. */
      escolhidoId: () => (l.origem === "automatico" ? null : l.produto?.id ?? null),
      compra: true,
      emUso: () => produtosEmUso(null),
      contexto: () => contextoDoIngrediente(l, itensAtuais, carregarEscolhas()),
      escolher: produtoId => {
        /* Numa linha que se dividiu, a escolha vale só para as receitas DESTA
           linha: mexer nas outras desfaria a divisão que elas pediram. Numa linha
           inteira, vale para a compra — e para as receitas, porque o pote é um só
           e deixá-las discordando do carrinho seria guardar uma contradição. */
        if (!l.divididaCom.length) gravarEscolha(ESCOPO_CARRINHO, l.ing.id, produtoId);

        /* Voltar ao automático não apaga a escolha das receitas: ela é delas, e
           soltar a rédea do carrinho é justamente devolvê-las ao comando. A
           exceção é a linha dividida — ali é o único jeito de dizer "tanto faz",
           e sem isso a divisão não teria como se desfazer. */
        if (produtoId || l.divididaCom.length) {
          for (const { slug, ingId } of l.requisicoes) gravarEscolha(slug, ingId, produtoId);
        }

        desenhar();
      },
      aoFechar: () => alvo.querySelector(`.compra-item[data-chave="${chave}"]`)?.focus()
    });
  }

  /* ------------------------------------------------------------- eventos */

  /**
   * Escolhe um mercado na tabela e segue para a compra.
   *
   * Passa pelo seletor do cabeçalho (dispara `change`) em vez de gravar direto: é
   * ele que o `app.js` escuta para trocar o mercado ativo e redesenhar tudo em
   * sincronia — o preço da receita, os totais, o próprio seletor. Depois troca o
   * passo para a compra.
   */
  function escolherMercado(id) {
    const sel = document.querySelector("#mercado-topo select");
    if (sel && sel.value !== id) {
      sel.value = id;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (window.location.hash !== "#/carrinho?passo=3") window.location.hash = "#/carrinho?passo=3";
  }

  const aoClicar = e => {
    const escMerc = e.target.closest("[data-escolher-mercado]");
    if (escMerc) { escolherMercado(escMerc.dataset.escolherMercado); return; }

    const stepper = e.target.closest(".pbtn");
    if (stepper && !stepper.disabled) {
      const { slug, porcoes, campo, delta } = stepper.dataset;
      const p = Number(porcoes);
      const d = Number(delta);

      // Não é preciso redesenhar aqui: a inscrição no carrinho faz isso
      if (campo === "porcoes") carrinho.definirPorcoes(slug, p, p + d);
      else {
        const linha = carrinho.ler().find(i => i.slug === slug && i.porcoes === p);
        carrinho.definirQtd(slug, p, (linha?.qtd ?? 1) + d);
      }
      return;
    }

    const remover = e.target.closest(".cart-remover");
    if (remover) {
      carrinho.remover(remover.dataset.slug, Number(remover.dataset.porcoes));
      return;
    }

    const abrir = e.target.closest(".rev-toggle");
    if (abrir) {
      const chave = carrinho.chaveDe(abrir.dataset.slug, Number(abrir.dataset.porcoes));
      if (abertas.has(chave)) abertas.delete(chave);
      else abertas.add(chave);

      desenhar();
      alvo.querySelector(`.rev-toggle[data-slug="${abrir.dataset.slug}"][data-porcoes="${abrir.dataset.porcoes}"]`)?.focus();
      return;
    }

    const daReceita = e.target.closest(".escolher");
    if (daReceita) { abrirDaReceita(daReceita.dataset.slug, Number(daReceita.dataset.i)); return; }

    const daCompra = e.target.closest(".compra-item");
    if (daCompra?.dataset.chave) { abrirDaCompra(daCompra.dataset.chave); return; }

    if (e.target.closest("#limpar-carrinho")) carrinho.limpar();
  };

  const aoMudar = e => {
    const caixa = e.target.closest("[data-tenho]");
    if (!caixa) return;

    const id = caixa.dataset.tenho;
    marcarTenho(id, caixa.checked);
    desenhar();
    alvo.querySelector(`[data-tenho="${id}"]`)?.focus();
  };

  desenhar();

  alvo.addEventListener("click", aoClicar, { signal: vida.signal });
  alvo.addEventListener("change", aoMudar, { signal: vida.signal });

  // A tela acompanha o carrinho, venha a mudança de onde vier
  const cancelar = carrinho.inscrever(desenhar);

  return {
    destruir: () => {
      vida.abort();   // solta também os ouvintes do diálogo de produtos
      cancelar();
    }
  };
}
