/* Passo 3: a folha de compras, pronta para imprimir (ou salvar em PDF pelo
   diálogo de impressão do navegador).

   Aqui a tela É a folha, e a folha é para a mão de quem está no mercado: uma
   linha por item, com caixa para marcar, o nome do produto e a quantidade. Nada
   mais. Os números que ajudam a decidir — quanto se usa, quanto sobra, quanto
   custa cada linha — pertencem ao passo 2, onde ainda se está decidindo.

   O que a pessoa marcou como "já tenho em casa" não entra na lista de comprar:
   sai numa seção à parte, para ela poder conferir que marcou o que quis. */

import { esc } from "./dom.js";
import * as carrinho from "./cart.js";
import { resumo } from "./shopping-list.js";
import { totaisDaCompra, textoPrecisa } from "./purchase.js";
import { carregarEscolhas, carregarTenho } from "./choices.js";
import { textoCusto, textoEmbalagem } from "./pricing.js";
import { mercadoAtivo } from "./settings.js";
import { mercado as porId } from "../data/mercados.js";

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
 * Uma linha da folha: caixa, produto, quantidade.
 *
 * A quantidade é a da compra — quantas embalagens, e de que tamanho —, não a que
 * a receita consome. Na gôndola o que resolve é "2 × 500 g".
 */
function linha(l) {
  const p = l.produto;
  const marca = p?.marca ? ` <em class="folha-marca">${esc(p.marca)}</em>` : "";

  /* A embalagem como está no rótulo, não a medida que a conta usa: um litro de
     leite não é "1,03 kg" na prateleira. Uma embalagem só dispensa o "1 ×". */
  const quanto = l.embalagens == null || !p
    ? textoPrecisa(l.precisa)
    : (l.embalagens === 1 ? textoEmbalagem(p) : `${l.embalagens} × ${textoEmbalagem(p)}`);

  return `
    <li>
      <span class="marca" aria-hidden="true"></span>
      <span class="folha-nome">${p ? esc(p.nome) : esc(l.ing.nome)}${marca}</span>
      <span class="folha-qtd">${esc(quanto)}</span>
    </li>`;
}

function folhaHTML(itens) {
  const t = totaisDaCompra(itens, carregarEscolhas(), { tenho: carregarTenho(), mercado: mercadoAtivo() });
  const { receitas, pratos } = resumo(itens);

  const comprar = t.linhas.filter(l => !l.tenho);
  const emCasa = t.linhas.filter(l => l.tenho);

  /* Item que o mercado escolhido não vende continua na folha: você ainda precisa
     dele. O que muda é que não há produto nem embalagem para escrever, então sai o
     nome do ingrediente e a quantidade da receita — e a nota avisa que esses vão
     ter de sair de outro lugar. */
  const semProduto = comprar.filter(l => !l.produto || l.produto.foraDoMercado).length;

  return `
    <div class="area lista-area">
      <header class="area-head lista-head">
        <p class="eyebrow-escuro">Lista de compras · passo 3 de 3</p>
        <h1>Compras</h1>
        <p class="area-sub lista-data">${esc(hoje())}${
          t.mercado ? ` · ${esc(porId(t.mercado)?.nome ?? "")}` : ""} ·
          ${comprar.length} ${comprar.length === 1 ? "item" : "itens"}
          para ${pratos} ${pratos === 1 ? "preparo" : "preparos"} ·
          ${esc(textoCusto(t.compra))}</p>
      </header>

      <section class="lista-resumo" aria-labelledby="tit-resumo">
        <h2 id="tit-resumo">Receitas</h2>
        <ul>
          ${receitas.map(r => `
            <li>
              <span>${esc(r.nome)}</span>
              <span class="lista-resumo-qtd">${esc(String(r.porcoes))} ${esc(r.unidade)}${r.qtd > 1 ? ` · ${r.qtd}×` : ""}</span>
            </li>`).join("")}
        </ul>
      </section>

      <section class="lista-itens" aria-labelledby="tit-itens">
        <h2 id="tit-itens">Para comprar</h2>
        <ul class="folha">${comprar.map(linha).join("")}</ul>
      </section>

      ${emCasa.length ? `
        <section class="lista-itens lista-tenho" aria-labelledby="tit-tenho">
          <h2 id="tit-tenho">Você marcou que já tem</h2>
          <ul class="folha">${emCasa.map(linha).join("")}</ul>
        </section>` : ""}

      <p class="lista-nota">
        A quantidade é a da embalagem, não a que a receita usa — no mercado o que
        resolve é o pacote. Preços fictícios, para teste. Sal e água ficam de fora:
        assume-se que já estão em casa.
        ${t.mercado && semProduto ? `<strong>${semProduto}
          ${semProduto === 1 ? "item não é vendido" : "itens não são vendidos"}
          no ${esc(porId(t.mercado)?.nome ?? "")}</strong> — está na folha com a
          quantidade que a receita pede, para você resolver onde der.` : ""}
      </p>

      <div class="lista-acoes">
        <a class="btn-texto" href="#/carrinho?passo=3">Voltar à revisão</a>
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

  // Se o carrinho mudar (outra aba, por exemplo), a folha acompanha —
  // sem reabrir o diálogo de impressão
  const cancelar = carrinho.inscrever(desenhar);

  // Chegando pelo botão do passo 2, abre o diálogo de impressão direto
  if (imprimir && !carrinho.vazio()) setTimeout(imprimirAgora, 120);

  return { destruir: cancelar };
}
