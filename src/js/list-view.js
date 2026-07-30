/* Passo 3: as folhas de compra, uma por mercado, prontas para imprimir (ou
   salvar em PDF pelo diálogo de impressão do navegador).

   Cada ingrediente foi atribuído a um mercado no passo 2. Aqui isso vira uma
   folha por mercado — na impressão, cada uma começa numa página, no mesmo PDF —,
   com uma linha por item: caixa para marcar, produto e quantidade da embalagem.

   O que a pessoa marcou como "já tenho em casa" sai numa seção à parte, para
   conferir; o que ainda não foi colocado em mercado nenhum é avisado no topo. */

import { esc } from "./dom.js";
import * as carrinho from "./cart.js";
import { textoPrecisa } from "./purchase.js";
import { carregarEscolhas } from "./choices.js";
import { textoCusto, textoEmbalagem } from "./pricing.js";
import { comparativoDeMercado } from "./market-compare.js";

const hoje = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function vazioHTML() {
  return `
    <div class="area">
      <header class="area-head">
        <p class="eyebrow-escuro">Lista de compras</p>
        <h1>Nada para comprar ainda</h1>
        <p class="area-sub">Adicione receitas ao carrinho e a lista se monta sozinha.</p>
      </header>
      <p><a class="btn-primario" href="#/comprar">Ver receitas</a></p>
    </div>`;
}

/**
 * Uma linha da folha: caixa, produto e a quantidade da compra.
 *
 * A quantidade é a da embalagem — quantas e de que tamanho —, não a que a receita
 * consome: na gôndola o que resolve é "2 × 500 g".
 */
function folhaLinha(linha, cell) {
  const p = cell.produto;
  const marca = p?.marca ? ` <em class="folha-marca">${esc(p.marca)}</em>` : "";
  const quanto = p
    ? (cell.embalagens === 1 ? textoEmbalagem(p) : `${cell.embalagens} × ${textoEmbalagem(p)}`)
    : textoPrecisa(linha.precisa);

  return `
    <li>
      <span class="marca" aria-hidden="true"></span>
      <span class="folha-nome">${p ? esc(p.nome) : esc(linha.ing.nome)}${marca}</span>
      <span class="folha-qtd">${esc(quanto)}</span>
    </li>`;
}

/** A folha de um mercado: cabeçalho, itens e total. Começa em nova página ao imprimir. */
function folhaMercado(m, itens, total) {
  return `
    <section class="folha-mercado">
      <header class="folha-mercado-head">
        <img class="mc-logo" src="${esc(m.logo)}" alt="" onerror="this.remove()">
        <div>
          <p class="eyebrow-escuro">${esc(hoje())}</p>
          <h2>${esc(m.nome)}</h2>
        </div>
        <span class="folha-mercado-total">${esc(textoCusto(total))}</span>
      </header>
      <ul class="folha">${itens.map(({ linha, cell }) => folhaLinha(linha, cell)).join("")}</ul>
      <p class="folha-mercado-rodape">
        ${itens.length} ${itens.length === 1 ? "item" : "itens"} · total estimado ${esc(textoCusto(total))}
      </p>
    </section>`;
}

function folhaHTML(itens) {
  const comp = comparativoDeMercado(itens, carregarEscolhas());
  const comItens = comp.mercados.filter(m => comp.porMercado.get(m.id).length);
  const tenho = comp.linhas.filter(l => l.tenho);
  const pendentes = comp.pendentes;
  const totalGeral = comItens.reduce((s, m) => s + comp.totaisMercado.get(m.id), 0);

  const secoes = comItens
    .map(m => folhaMercado(m, comp.porMercado.get(m.id), comp.totaisMercado.get(m.id)))
    .join("");

  return `
    <div class="area lista-area">
      <header class="area-head lista-head">
        <p class="eyebrow-escuro">Lista de compras · passo 3 de 3</p>
        <h1>Suas listas por mercado</h1>
        <p class="area-sub lista-data">${esc(hoje())} ·
          ${comItens.length} ${comItens.length === 1 ? "mercado" : "mercados"} ·
          ${esc(textoCusto(totalGeral))}</p>
      </header>

      ${pendentes.length ? `
        <p class="lista-nota lista-pendentes">
          <strong>${pendentes.length}
          ${pendentes.length === 1 ? "ingrediente ainda não foi colocado" : "ingredientes ainda não foram colocados"}
          numa lista de mercado</strong> — volte ao mercado para resolvê-los antes de comprar.
        </p>` : ""}

      ${secoes || `<p class="area-sub">Nenhum item foi colocado numa lista de mercado ainda.</p>`}

      ${tenho.length ? `
        <section class="folha-mercado folha-tenho">
          <header class="folha-mercado-head"><div><h2>Você já tem em casa</h2></div></header>
          <ul class="folha">${tenho.map(l => `
            <li>
              <span class="marca" aria-hidden="true"></span>
              <span class="folha-nome">${esc(l.escolhidoNome || l.ing.nome)}</span>
              <span class="folha-qtd">${esc(textoPrecisa(l.precisa))}</span>
            </li>`).join("")}</ul>
        </section>` : ""}

      <p class="lista-nota">
        A quantidade é a da embalagem, não a que a receita usa — no mercado o que resolve
        é o pacote. Uma folha por mercado: na impressão, cada uma começa numa página, no
        mesmo PDF. Preços fictícios, para teste.
      </p>

      <div class="lista-acoes">
        <a class="btn-texto" href="#/carrinho?passo=2">Voltar ao mercado</a>
        <button type="button" class="btn-primario" id="btn-imprimir">Imprimir / salvar em PDF</button>
      </div>
    </div>`;
}

export function renderizarLista(alvo, { imprimir = false } = {}) {
  const imprimirAgora = () => { if (typeof window.print === "function") window.print(); };

  function desenhar() {
    const itens = carrinho.lerComReceitas();
    alvo.innerHTML = itens.length ? folhaHTML(itens) : vazioHTML();
    alvo.querySelector("#btn-imprimir")?.addEventListener("click", imprimirAgora);
  }

  desenhar();

  // Se o carrinho mudar (outra aba, por exemplo), a folha acompanha
  const cancelar = carrinho.inscrever(desenhar);

  // Chegando pelo botão do passo 2, abre o diálogo de impressão direto
  if (imprimir && !carrinho.vazio()) setTimeout(imprimirAgora, 120);

  return { destruir: cancelar };
}
