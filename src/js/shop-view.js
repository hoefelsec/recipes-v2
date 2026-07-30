/* Vitrine: as receitas apresentadas como produtos, com escolha de porções
   antes de ir para o carrinho.

   A busca do cabeçalho é a única peneira: o painel de filtros (categoria, custo,
   disponibilidade) foi removido a pedido. As receitas continuam agrupadas por
   categoria, mas não há mais como filtrá-las na lateral. */

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
import { idDoGrupo } from "./shop-filters.js";

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

        <div class="produto-acoes">
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
 * A lista de receitas, e o índice do site.
 *
 * `filtro` é uma função e não um texto: quem digita é o cabeçalho, e a cada tecla ele
 * pede um redesenho. Ler no momento de desenhar é o que evita passar o mesmo texto
 * por várias camadas — e ficar com uma cópia velha em uma delas.
 */
export function renderizarVitrine(alvo, { filtro = () => "" } = {}) {
  // Porções escolhidas em cada cartão, antes de adicionar
  const escolhas = new Map(receitas.map(r => [r.slug, r.porcoes.padrao]));
  const mercado = mercadoAtivo();

  function desenhar() {
    const termo = filtro();
    const achadas = filtrar(termo);

    const corpo = achadas.length
      ? agrupadas(achadas).map(({ grupo, itens }) => `
          <section class="vitrine-secao" aria-labelledby="vit-${esc(idDoGrupo(grupo))}">
            <h2 id="vit-${esc(idDoGrupo(grupo))}" class="vitrine-titulo">${esc(grupo)}</h2>
            <div class="vitrine">
              ${itens.map(r => cartao(r, escolhas.get(r.slug), mercado)).join("")}
            </div>
          </section>`).join("")
      : `<p class="vitrine-vazia">${vazioHTML(termo)}</p>`;

    alvo.innerHTML = `
      <div class="area">
        <header class="area-head">
          <p class="eyebrow-escuro">Receitas</p>
          <h1>Monte a lista da semana</h1>
          <p class="area-sub">${subtituloHTML(termo, achadas.length)}</p>
        </header>

        <div class="area-lista">${corpo}</div>
      </div>`;
  }

  function subtituloHTML(termo, quantas) {
    const busca = termo.trim();
    if (!busca) {
      return `Escolha as porções de cada receita e adicione ao carrinho. No fim, a
              lista de compras sai com tudo somado.`;
    }
    return `${quantas} ${quantas === 1 ? "receita" : "receitas"} para “${esc(busca)}”.`;
  }

  function vazioHTML(termo) {
    return `Nenhuma receita encontrada para <strong>“${esc(termo.trim())}”</strong>.`;
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

  const aoClicar = e => {
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
    }
  };
}
