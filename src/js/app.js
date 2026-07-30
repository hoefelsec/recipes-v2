/* Ponto de entrada: decide qual área mostrar e mantém menu, preferências e
   carrinho em sincronia. */

import { porSlug } from "../data/index.js";
import { $, abrirDialogo, ligarFechamento } from "./dom.js";
import { aoTrocarRota, porcoesAtual, definirPorcoesNaUrl } from "./router.js";
import { iniciarCabecalho, marcarArea, termoDaBusca } from "./header.js";
import { iniciarPreferencias, mercadoAtivo, definirMercado } from "./settings.js";
import { seletorDeMercado } from "./ui.js";
import { renderizarReceita } from "./recipe-view.js";
import { renderizarVitrine } from "./shop-view.js";
import { renderizarCarrinho } from "./cart-view.js";
import { renderizarLista } from "./list-view.js";
import * as carrinho from "./cart.js";

const conteudo = $("#conteudo");
let primeiraCarga = true;
let slugAnterior = null;
let pagina = null;      // controles devolvidos por renderizarReceita

const lerPrefs = iniciarPreferencias(() => pagina?.atualizarPrefs?.());

iniciarCabecalho({
  aoBuscar: () => { if (document.body.dataset.area === "comprar") redesenharArea(); },
  irParaLista: () => { window.location.hash = "#/comprar"; }
});
iniciarSeletorDeMercado();
iniciarAtalhosDaCasca();
atualizarBadge();
carrinho.inscrever(atualizarBadge);

/**
 * Os atalhos do menu lateral e da barra de abas.
 *
 * "Configurações" (em vários lugares) delega ao botão real de preferências, que é
 * único — quem monta o painel é `settings.js`, ligado a `#abrir-prefs`. "Mercados"
 * leva o foco ao seletor da barra superior, e "Ajuda" abre a janela de apresentação.
 */
function iniciarAtalhosDaCasca() {
  const prefs = $("#abrir-prefs");
  for (const el of document.querySelectorAll("[data-abrir-prefs]")) {
    el.addEventListener("click", () => prefs?.click());
  }

  for (const el of document.querySelectorAll("[data-focar-mercado]")) {
    el.addEventListener("click", () => $("#mercado-topo select")?.focus());
  }

  const ajuda = document.getElementById("ajuda");
  if (ajuda) {
    ligarFechamento(ajuda);
    for (const el of document.querySelectorAll("[data-abrir-ajuda]")) {
      el.addEventListener("click", () => abrirDialogo(ajuda));
    }
  }
}

/**
 * O seletor de mercado no cabeçalho.
 *
 * Vive fora das áreas porque o cabeçalho vive fora delas: uma tela só, montada uma
 * vez, em vez de uma cópia por área que se redesenha junto. Trocar de mercado muda
 * preço, oferta e total em qualquer lugar do site, então redesenha a área atual —
 * seja ela a receita ou uma das três telas de compra.
 */
function iniciarSeletorDeMercado() {
  const caixa = $("#mercado-topo");

  const desenhar = () => { caixa.innerHTML = seletorDeMercado(mercadoAtivo()); };

  caixa.addEventListener("change", e => {
    if (!e.target.closest("[data-mercado]")) return;

    definirMercado(e.target.value);
    desenhar();
    redesenharArea();
    caixa.querySelector("[data-mercado]")?.focus();
  });

  desenhar();
}

function atualizarBadge() {
  const n = carrinho.total();
  for (const badge of document.querySelectorAll(".cart-badge")) {
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }
}

/* --------------------------------------------------------------- receita */

function mostrarReceita(slug) {
  const receita = porSlug(slug);
  if (!receita) return;

  // Trocar de receita zera as porções; ajustar as porções mantém a receita
  const pedido = porcoesAtual();
  const inicial = slug === slugAnterior || primeiraCarga
    ? (pedido ?? receita.porcoes.padrao)
    : receita.porcoes.padrao;

  pagina = renderizarReceita(receita, conteudo, {
    porcoes: inicial,
    lerPrefs,
    aoMudarPorcoes: n => definirPorcoesNaUrl(slug, n, receita.porcoes.padrao)
  });

  definirPorcoesNaUrl(slug, pagina.porcoes, receita.porcoes.padrao);
  slugAnterior = slug;
}

/* ----------------------------------------------------------------- rotas */

let redesenharArea = () => {};

// Rota repetida não chega até aqui: o roteador só entrega endereço novo
aoTrocarRota(({ area, slug, params }) => {
  /* Guardado para o seletor de mercado poder repetir o desenho da área atual sem
     conhecer nenhuma delas — e sem passar pelo roteador, que recusa a mesma rota. */
  redesenharArea = () => {
    pagina?.destruir?.();
    pagina = null;

    if (area === "receita") {
      mostrarReceita(slug);
      return;
    }

    if (area === "comprar") pagina = renderizarVitrine(conteudo, { filtro: termoDaBusca });
    else if (area === "carrinho") pagina = renderizarCarrinho(conteudo, { passo: params.get("passo") });
    else pagina = renderizarLista(conteudo, { imprimir: false });
  };

  pagina?.destruir?.();
  pagina = null;

  marcarArea(area);

  if (area === "receita") {
    mostrarReceita(slug);
  } else {
    if (area === "comprar") {
      pagina = renderizarVitrine(conteudo, { filtro: termoDaBusca });
      tituloDaArea("Receitas");
    } else if (area === "carrinho") {
      pagina = renderizarCarrinho(conteudo, { passo: params.get("passo") });
      tituloDaArea("Carrinho");
    } else {
      pagina = renderizarLista(conteudo, { imprimir: params.get("imprimir") === "1" });
      tituloDaArea("Lista de compras");
    }
  }

  if (primeiraCarga) {
    primeiraCarga = false;   // não rola nem rouba o foco no primeiro carregamento
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
  conteudo.focus({ preventScroll: true });
});

/* O nome da área vai só para o título da aba: o cabeçalho agora mostra a marca, e
   a área já se anuncia no `<h1>` da própria tela. Escrever nos dois era manter duas
   frases à mão para dizer a mesma coisa. */
function tituloDaArea(nome) {
  document.title = `${nome} · Chef`;
  document.body.dataset.slug = "";
}
