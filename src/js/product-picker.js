/* A janela de escolha de produto, usada pela receita e pelo carrinho.
 *
 * As duas telas fazem a mesma pergunta — "qual produto?" — mudando só o escopo
 * da resposta: na receita, o produto daquele prato; no carrinho, o produto que
 * vai para a sacola e serve todas as receitas. Um só módulo, então, e nenhum dos
 * dois lados reescreve a janela.
 *
 * O controlador cuida de desenhar, reordenar, marcar, focar e devolver o foco.
 * Quem chama diz o contexto e o que fazer com a escolha.
 */

import { esc, abrirDialogo, ligarFechamento } from "./dom.js";
import { opcoesDeProduto, textoCusto, formatarPreco, textoPrecoUnitario, textoEmbalagem } from "./pricing.js";
import { embalagensPara } from "./purchase.js";
import { produto } from "../data/produtos.js";
import { ORDENS, carregarRecentes, carregarOrdem, salvarOrdem } from "./choices.js";

function opcaoDeProduto(o, escolhidoId, automaticoId, { ing, compra } = {}) {
  const p = o.produto;
  const marcado = o.id === escolhidoId;

  const selos = [
    o.emUso ? `<span class="prod-selo emuso">já no carrinho</span>` : "",
    o.id === automaticoId ? `<span class="prod-selo">mais barato</span>` : "",
    o.recencia === 0 && !marcado && !o.emUso ? `<span class="prod-selo recente">usado por último</span>` : ""
  ].join("");

  /* No carrinho o número que decide não é o do consumo, é o do caixa: dois
     produtos podem custar o mesmo por quilo e um deles obrigar a levar 5 kg. */
  const pacotes = compra ? embalagensPara(p, ing, compra) : null;
  const destaque = pacotes ? textoCusto(pacotes.custoCompra) : (o.custo == null ? "???" : textoCusto(o.custo));
  const legenda = pacotes
    ? `${pacotes.embalagens} ${pacotes.embalagens === 1 ? "embalagem" : "embalagens"}`
    : "nesta receita";

  return `
    <li>
      <button type="button" class="prod${marcado ? " marcada" : ""}"
              role="menuitemradio" aria-checked="${marcado}" data-produto="${esc(o.id)}">
        <span class="prod-nome">${esc(p.nome)}${selos}</span>
        <span class="prod-linha">${esc(destaque)}</span>
        <span class="prod-dados">
          ${p.marca ? `${esc(p.marca)} · ` : ""}${esc(textoEmbalagem(p))} ·
          ${esc(formatarPreco(p.preco))} · ${esc(textoPrecoUnitario(p))}
        </span>
        <span class="prod-legenda">${esc(legenda)}</span>
      </button>
    </li>`;
}

/**
 * A janela de escolha.
 *
 * Quatro números por produto, e cada um responde a uma pergunta diferente: o
 * preço da embalagem é o que sai da carteira; o preço por kg/L/un. é o que
 * permite comparar tamanhos; o custo nesta receita é o que muda na conta da
 * página. O tamanho da embalagem amarra os três.
 */
export function janelaProdutos(ing, opcoes, {
  escolhidoId, automaticoId, ordem, qtdTexto, compra = null, contexto = "", mercado = null
}) {
  /* Com mercado ativo, a escolha guardada pode não estar na lista: ela existe, mas
     não se compra aqui. Dizer isso é melhor que mostrar a lista sem nada marcado e
     deixar a pessoa procurando o que escolheu. */
  const escolhaDeFora = Boolean(escolhidoId) && !opcoes.some(o => o.id === escolhidoId);
  return `
    <div class="pref-form">
      <header class="pref-head">
        <h2>${esc(ing.nome)}</h2>
        <button type="button" class="pref-fechar" aria-label="Fechar">✕</button>
      </header>

      <p class="pref-ajuda">${compra
        ? `A compra soma ${esc(qtdTexto)}. Escolher um produto muda quantas
           embalagens você leva e o total da compra.`
        : `A receita pede ${esc(qtdTexto)}. Escolher um produto muda o preço desta
           linha, o total da receita e os nutrientes, que passam a vir do rótulo.`}
      </p>

      ${contexto}

      ${escolhaDeFora ? `
        <p class="prod-fora">
          O produto que você escolheu não é vendido neste mercado. Escolha outro,
          ou volte para <strong>todos os mercados</strong> para mantê-lo.
        </p>` : ""}

      ${!opcoes.length ? `
        <p class="prod-fora prod-vazia">
          Nenhum produto de ${esc(ing.nome)} é vendido neste mercado.
        </p>` : ""}

      <label class="prod-ordem">
        <span>Ordenar por</span>
        <select id="prod-ordem">
          ${ORDENS.map(o => `
            <option value="${esc(o.valor)}" ${o.valor === ordem ? "selected" : ""}>${esc(o.rotulo)}</option>`).join("")}
        </select>
      </label>

      <ul class="prod-lista" role="menu" aria-label="Produtos de ${esc(ing.nome)}">
        <li>
          <button type="button" class="prod prod-auto${escolhidoId ? "" : " marcada"}"
                  role="menuitemradio" aria-checked="${!escolhidoId}" data-produto="">
            <span class="prod-nome">Deixar o site escolher</span>
            <span class="prod-dados">Sempre o mais barato por medida — hoje, ${esc(automaticoNome(automaticoId, mercado))}</span>
          </button>
        </li>
        ${opcoes.map(o => opcaoDeProduto(o, escolhidoId, automaticoId, { ing, compra })).join("")}
      </ul>

      <p class="pref-nota">${compra
        ? `Marcas e preços são fictícios, para teste. A escolha aqui vale para a
           compra inteira: é um produto por ingrediente, porque é um pote que vai
           para a sacola.`
        : `Marcas e preços são fictícios, para teste. O rótulo de um produto pode
           declarar menos que a tabela de referência; onde ele cala, o valor
           continua vindo da tabela.`}
      </p>

      <footer class="pref-foot">
        <button type="button" class="pref-ok">Pronto</button>
      </footer>
    </div>`;
}

const automaticoNome = (id, mercado = null) => {
  const p = produto(id, mercado);
  return p ? `${p.nome}${p.marca ? ` (${p.marca})` : ""}` : "nenhum";
};


/* --------------------------------------------------------------- controlador */

/**
 * Liga a janela a um diálogo e devolve `{ abrir }`.
 *
 * `sinal` é o `AbortSignal` de quem chamou: os diálogos são elementos fixos da
 * página, e sem isso cada visita à tela deixaria mais um ouvinte neles.
 *
 * O contexto de `abrir` traz:
 *   ing           ingrediente resolvido (nome, densidade, pesoPorUnidade)
 *   pedido        { qtd, un } do que se precisa — define o custo de cada opção
 *   pedidoTexto   como isso se lê na frase de ajuda
 *   automaticoId  o que o site escolheria sozinho
 *   escolhidoId   função: o produto escolhido agora
 *   escolher      função(produtoId|null): grava e redesenha a tela de fora
 *   compra        true no carrinho: mostra também quantas embalagens dá
 *   emUso         função: ids de produto já escolhidos em outra receita do carrinho
 *   contexto      função: HTML acima da lista (quais receitas pedem, e quanto)
 *   mercado       id do mercado ativo, ou null: com ele, a lista só oferece o que
 *                 aquele mercado vende — escolher o que não se pode comprar ali
 *                 seria oferecer um problema
 *   aoFechar      função opcional, para devolver o foco
 */
export function ligarJanelaDeProdutos(dialogo, { sinal } = {}) {
  const ate = sinal ? { signal: sinal } : {};
  let ctx = null;
  let ordem = carregarOrdem();

  function desenhar() {
    if (!ctx) return;

    dialogo.innerHTML = janelaProdutos(
      ctx.ing,
      opcoesDeProduto(ctx.ing, {
        ordem,
        recentes: carregarRecentes(),
        qtd: ctx.pedido?.qtd,
        un: ctx.pedido?.un,
        emUso: ctx.emUso?.() ?? new Set(),
        mercado: ctx.mercado ?? null
      }),
      {
        escolhidoId: ctx.escolhidoId(),
        automaticoId: ctx.automaticoId,
        ordem,
        qtdTexto: ctx.pedidoTexto,
        compra: ctx.compra ? ctx.pedido : null,
        contexto: ctx.contexto?.() ?? "",
        mercado: ctx.mercado ?? null
      }
    );
  }

  dialogo.addEventListener("click", e => {
    const opcao = e.target.closest(".prod");
    if (!opcao || !ctx) return;

    ctx.escolher(opcao.dataset.produto || null);
    desenhar();
    // A lista foi refeita e levou o botão com o foco: devolve-o à opção marcada
    dialogo.querySelector(".prod.marcada")?.focus();
  }, ate);

  dialogo.addEventListener("change", e => {
    if (e.target.id !== "prod-ordem") return;
    ordem = e.target.value;
    salvarOrdem(ordem);
    desenhar();
    dialogo.querySelector("#prod-ordem")?.focus();
  }, ate);

  /* Seta cima/baixo anda pela lista, como no menu de troca de medida. */
  dialogo.addEventListener("keydown", e => {
    const delta = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!delta || !e.target.closest(".prod-lista")) return;
    e.preventDefault();

    const itens = [...dialogo.querySelectorAll(".prod")];
    itens[(itens.indexOf(e.target.closest(".prod")) + delta + itens.length) % itens.length]?.focus();
  }, ate);

  ligarFechamento(dialogo, ".pref-fechar, .pref-ok", ate);

  const aoFechar = () => {
    const fechar = ctx?.aoFechar;
    ctx = null;
    fechar?.();
  };
  dialogo.addEventListener("close", aoFechar, ate);
  dialogo.addEventListener("click", e => {
    // Sem <dialog> nativo não há evento `close`: o clique nos fechadores responde
    if (!dialogo.open && e.target.closest(".pref-fechar, .pref-ok")) aoFechar();
  }, ate);

  return {
    abrir(contexto) {
      ctx = contexto;
      desenhar();
      abrirDialogo(dialogo);
      dialogo.querySelector(".prod.marcada")?.focus();
    },
    /** Redesenha se estiver aberta — usado quando a tela de fora muda. */
    atualizar: () => { if (dialogo.open || dialogo.hasAttribute("open")) desenhar(); }
  };
}
