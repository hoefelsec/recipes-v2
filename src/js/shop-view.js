/* Vitrine: as receitas apresentadas como produtos, com escolha de porções
   antes de ir para o carrinho. */

import { receitas, agrupadas } from "../data/index.js";
import { filtrar } from "./header.js";
import { aplicarEscolhas } from "../data/resolve.js";
import { esc } from "./dom.js";
import { normalizarPorcoes } from "./scaling.js";
import { adicionar } from "./cart.js";
import { custoDaReceita } from "./pricing.js";
import { carregarEscolhas } from "./choices.js";
import { stepperHTML, fotoHTML, unidadePorcao, precoDaReceita } from "./ui.js";
import { avisar } from "./toast.js";
import { mercadoAtivo } from "./settings.js";
import { rotaAtual } from "./router.js";
import { mercado as porId } from "../data/mercados.js";
import {
  lerFiltros, aplicarFiltros, painelDeFiltros, filtrosDoPainel, escreverNaUrl,
  semFiltro, quantosFiltros, esquecerMedidas, idDoGrupo, SEM_FILTROS
} from "./shop-filters.js";

/* Preço da receita como o leitor a configurou no cartão, pelos produtos que ele
   escolheu naquela receita. Muda junto com o seletor de porções. */
function precoHTML(r, porcoes, mercado) {
  const escolhas = carregarEscolhas()[r.slug] ?? {};
  const c = custoDaReceita(aplicarEscolhas(r, escolhas, mercado), porcoes, mercado);
  if (!c.contados) return "";

  return precoDaReceita(c, unidadePorcao(r, 1));
}

function cartao(r, porcoes, mercado) {
  const url = `#/receita/${encodeURIComponent(r.slug)}`;

  return `
    <article class="produto" data-slug="${esc(r.slug)}">
      <a class="produto-foto" href="${url}" tabindex="-1" aria-hidden="true">
        ${fotoHTML(r, { tamanho: 600 })}
      </a>

      <div class="produto-corpo">
        <p class="produto-grupo">${esc(r.grupo)}</p>
        <h3 class="produto-nome"><a href="${url}">${esc(r.nome)}</a></h3>
        <p class="produto-resumo">${esc(r.resumo)}</p>

        <!-- Tempo e dificuldade saíram: aqui a pergunta é "quanto e quanto custa",
             e a página da receita responde o resto. -->
        <div class="produto-acoes">
          <!-- Porções à esquerda, preço à direita, na mesma linha: um é a causa do
               outro, e mexer no seletor move o número ao lado. -->
          <div class="produto-linha">
            ${stepperHTML({
              valor: porcoes,
              unidade: unidadePorcao(r, porcoes),
              min: r.porcoes.min,
              max: r.porcoes.max,
              passo: r.porcoes.passo ?? 1,
              rotulo: "Porções",
              dados: { slug: r.slug }
            })}
            <div class="produto-preco">${precoHTML(r, porcoes, mercado)}</div>
          </div>

          <button type="button" class="btn-add" data-slug="${esc(r.slug)}">Adicionar ao carrinho</button>
        </div>
      </div>
    </article>`;
}

/**
 * A lista de compras: as receitas em cartões, e o índice do site.
 *
 * `filtro` é uma função e não um texto: quem digita é o cabeçalho, e a cada tecla ele
 * pede um redesenho. Ler no momento de desenhar é o que evita passar o mesmo texto
 * por três camadas — e ficar com uma cópia velha em uma delas.
 */
export function renderizarVitrine(alvo, { filtro = () => "" } = {}) {
  // Porções escolhidas em cada cartão, antes de adicionar
  const escolhas = new Map(receitas.map(r => [r.slug, r.porcoes.padrao]));
  const mercado = mercadoAtivo();
  const nomeDoMercado = mercado ? porId(mercado).nome : "";

  /* Os produtos escolhidos podem ter mudado numa receita desde a última visita, e o
     custo por porção depende deles. */
  esquecerMedidas();

  /* Os filtros vêm da URL, e não de um `let` inicializado vazio: trocar de mercado
     recria esta tela do zero, e o que o leitor filtrou tem de continuar valendo. */
  let filtros = lerFiltros(rotaAtual().params);

  /* No celular o painel é uma gaveta. Aberta de saída quando já há filtro ligado: a
     tela mostra menos receitas do que existem, e esconder o motivo disso é uma pegadinha. */
  let gavetaAberta = !semFiltro(filtros);

  /* Uma função só, e não HTML solto: trocar de mercado ou digitar na busca manda o
     `app.js` redesenhar a área, e é este `desenhar` que ele acaba chamando de novo. */
  function desenhar() {
    const termo = filtro();
    const base = filtrar(termo);
    const achadas = aplicarFiltros(base, filtros, mercado);

    const corpo = achadas.length
      ? agrupadas(achadas).map(({ grupo, itens }) => `
          <section class="vitrine-secao" aria-labelledby="vit-${esc(idDoGrupo(grupo))}">
            <h2 id="vit-${esc(idDoGrupo(grupo))}" class="vitrine-titulo">${esc(grupo)}</h2>
            <div class="vitrine">
              ${itens.map(r => cartao(r, escolhas.get(r.slug), mercado)).join("")}
            </div>
          </section>`).join("")
      : `<p class="vitrine-vazia">${vazioHTML(termo, base.length)}</p>`;

    /* A ORDEM AQUI É A DO CELULAR: título, filtros, receitas. No computador o painel
       vira uma faixa fixa na borda esquerda da tela e sai do fluxo — nenhum `order`
       de CSS precisa reordenar nada, e o leitor de tela ouve na ordem em que se lê. */
    alvo.innerHTML = `
      <div class="area">
        <header class="area-head">
          <p class="eyebrow-escuro">Receitas</p>
          <h1>Monte a lista da semana</h1>
          <p class="area-sub">${subtituloHTML(termo, achadas.length)}</p>
        </header>

        <!-- Botão e classe, e não um details: no computador o painel fica sempre
             aberto e sem botão, e um details fechado não abre por CSS — o navegador
             esconde o conteúdo por dentro, fora do alcance da folha de estilo. -->
        <aside class="filtros-caixa"${gavetaAberta ? " data-aberta" : ""}>
          <button type="button" class="filtros-abrir" data-abrir
                  aria-expanded="${gavetaAberta}" aria-controls="painel-filtros">
            Filtros${semFiltro(filtros) ? "" : ` <em>${quantosFiltros(filtros)}</em>`}
          </button>
          <div class="filtros-painel" id="painel-filtros">
            ${painelDeFiltros(base, filtros, mercado, nomeDoMercado)}
          </div>
        </aside>

        <div class="area-lista">${corpo}</div>
      </div>`;
  }

  /* Quantas receitas a tela está mostrando, e por que não são todas. Duas peneiras
     independentes — busca e filtros —, e a frase nomeia as que estão ligadas. */
  function subtituloHTML(termo, quantas) {
    const busca = termo.trim();
    if (!busca && semFiltro(filtros)) {
      return `Escolha as porções de cada receita e adicione ao carrinho. No fim, a
              lista de compras sai com tudo somado.`;
    }

    const conta = `${quantas} ${quantas === 1 ? "receita" : "receitas"}`;
    const porques = [
      busca ? `a busca por “${esc(busca)}”` : "",
      semFiltro(filtros) ? "" : `${quantosFiltros(filtros)} ${quantosFiltros(filtros) === 1 ? "filtro" : "filtros"}`
    ].filter(Boolean);

    return `${conta} — ${porques.join(" e ")}.`;
  }

  /* A frase do vazio diz QUAL das duas peneiras esvaziou a tela. "Nenhuma receita
     encontrada" depois de mexer numa caixinha manda procurar no lugar errado. */
  function vazioHTML(termo, quantasNaBusca) {
    const busca = termo.trim();

    if (quantasNaBusca === 0) {
      return `Nenhuma receita encontrada para <strong>“${esc(busca)}”</strong>.`;
    }

    return `${quantasNaBusca === 1 ? "A receita" : `As ${quantasNaBusca} receitas`}
      ${busca ? `de “${esc(busca)}”` : "do caderno"} ${quantasNaBusca === 1 ? "não passa" : "não passam"}
      pelos filtros. <button type="button" class="btn-texto" data-limpar>Limpar os filtros</button>`;
  }

  desenhar();

  function atualizarCartao(slug) {
    const r = receitas.find(x => x.slug === slug);
    const cartaoEl = alvo.querySelector(`.produto[data-slug="${slug}"]`);
    const porcoes = escolhas.get(slug);

    cartaoEl.querySelector(".pval").innerHTML =
      `${esc(String(porcoes))} <span>${esc(unidadePorcao(r, porcoes))}</span>`;

    // O preço acompanha: é o custo da receita nas porções escolhidas
    cartaoEl.querySelector(".produto-preco").innerHTML = precoHTML(r, porcoes, mercado);

    for (const b of cartaoEl.querySelectorAll(".pbtn")) {
      const destino = porcoes + Number(b.dataset.delta);
      b.disabled = destino < r.porcoes.min || destino > r.porcoes.max;
    }
  }

  /* Um redesenho inteiro por clique, e não um remendo em cada cartão: as contagens do
     painel, o texto do topo e a grade dependem todos do mesmo resultado, e recalcular
     tudo é mais curto — e mais confiável — do que costurar três atualizações. */
  function aplicar(novos) {
    filtros = novos;
    escreverNaUrl(filtros);
    desenhar();
  }

  const aoMudarFiltro = e => {
    const form = e.target.closest("[data-filtros]");
    if (!form) return;
    aplicar(filtrosDoPainel(form, mercado));
  };

  alvo.addEventListener("change", aoMudarFiltro);
  alvo.addEventListener("input", aoMudarFiltro);   // a barra de custo responde ao arrasto

  const aoClicar = e => {
    const abrir = e.target.closest("[data-abrir]");
    if (abrir) {
      gavetaAberta = !gavetaAberta;
      const caixa = abrir.closest(".filtros-caixa");
      caixa.toggleAttribute("data-aberta", gavetaAberta);
      abrir.setAttribute("aria-expanded", String(gavetaAberta));
      return;
    }

    if (e.target.closest("[data-limpar]")) {
      aplicar({ ...SEM_FILTROS });
      return;
    }

    const passo = e.target.closest(".pbtn");
    if (passo && !passo.disabled) {
      const slug = passo.dataset.slug;
      const r = receitas.find(x => x.slug === slug);
      escolhas.set(slug, normalizarPorcoes(r, escolhas.get(slug) + Number(passo.dataset.delta)));
      atualizarCartao(slug);
      return;
    }

    const add = e.target.closest(".btn-add");
    if (!add) return;

    const slug = add.dataset.slug;
    const r = receitas.find(x => x.slug === slug);
    const porcoes = escolhas.get(slug);
    adicionar(slug, porcoes);

    /* O botão não muda de nome. Ele diz o que faz, não o que acabou de acontecer —
       quem conta isso é o aviso, que sai do caminho sozinho. */
    avisar(`${r.nome} · ${porcoes} ${unidadePorcao(r, porcoes)} no carrinho`,
      { url: "#/carrinho", texto: "Ver carrinho" });
  };

  alvo.addEventListener("click", aoClicar);

  // Sem isto o ouvinte continuaria ligado depois de sair da vitrine e
  // responderia a cliques de outra área
  return {
    destruir: () => {
      alvo.removeEventListener("click", aoClicar);
      alvo.removeEventListener("change", aoMudarFiltro);
      alvo.removeEventListener("input", aoMudarFiltro);
    }
  };
}
