/* Os filtros da lista de receitas.
 *
 * Três perguntas, cada uma um jeito diferente de decidir o que cozinhar:
 *
 *   categoria      "quero um doce"
 *   custo/porção   "quero algo até R$ 3 por pessoa"
 *   disponível     "quero o que dá para comprar no mercado de hoje"
 *
 * O ESTADO VIVE NA URL, como as porções da receita. Três razões, na ordem em que
 * pesaram: sobrevive ao redesenho (trocar de mercado destrói e recria a área, e um
 * `let` na tela iria embora com ela); é compartilhável — "olha os doces baratos"; e
 * não é preferência: ninguém quer que o filtro de terça ainda esteja lá na sexta.
 *
 * Escrever é com `replaceState`. Marcar uma caixinha não é um passo do botão "voltar",
 * e `replaceState` também não dispara `hashchange` — o roteador não se mete.
 */

import { receitas, agrupadas } from "../data/index.js";
import { substituirHash } from "./router.js";
import { esc } from "./dom.js";
import { custoDaReceita } from "./pricing.js";
import { produtosDe } from "../data/produtos.js";
import { aplicarEscolhas } from "../data/resolve.js";
import { carregarEscolhas } from "./choices.js";

/** Sem teto: o filtro de custo desligado. Não é "R$ 0", é "não me limite". */
export const SEM_TETO = null;

/* O passo do controle de custo. Meio real: com dez centavos a barra pede pontaria,
   e com um real inteiro ela pula por cima de metade do catálogo. */
export const PASSO = 0.5;

/** Id de grupo para a URL: "Pratos principais" -> "pratos-principais". */
export const idDoGrupo = nome =>
  nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");

/** Os grupos do catálogo, na ordem em que aparecem na lista. */
export const gruposDoCatalogo = () => agrupadas().map(g => g.grupo);

/**
 * Os filtros pedidos na URL, saneados.
 *
 * Grupo que não existe é descartado em silêncio, como o resto do saneamento do site:
 * o endereço é digitável, e um parâmetro velho não deve esvaziar a lista.
 */
export function lerFiltros(params) {
  const validos = gruposDoCatalogo().map(idDoGrupo);

  const grupos = (params.get("grupo") ?? "")
    .split(",")
    .map(g => g.trim())
    .filter(g => validos.includes(g));

  const teto = Number(params.get("ate"));

  return {
    grupos: [...new Set(grupos)],
    teto: Number.isFinite(teto) && teto > 0 ? teto : SEM_TETO,
    soDaqui: params.get("aqui") === "1"
  };
}

/** True quando nenhum filtro está ligado — a lista inteira. */
export const semFiltro = f => !f.grupos.length && f.teto === SEM_TETO && !f.soDaqui;

/* Quantos filtros estão ligados. As categorias contam como UM: marcar três é uma
   decisão só, e "3 filtros" para "doces, bebidas ou acompanhamentos" leria como
   três peneiras em série — o oposto do que elas fazem. */
export const quantosFiltros = f =>
  (f.grupos.length ? 1 : 0) + (f.teto === SEM_TETO ? 0 : 1) + (f.soDaqui ? 1 : 0);

/** Os filtros como parâmetros de URL. O que está desligado não aparece. */
export function paramsDosFiltros(f) {
  const p = new URLSearchParams();
  if (f.grupos.length) p.set("grupo", f.grupos.join(","));
  if (f.teto !== SEM_TETO) p.set("ate", String(f.teto));
  if (f.soDaqui) p.set("aqui", "1");
  return p;
}

/** Grava os filtros na URL, sem criar passo no histórico nem redesenhar a área. */
export function escreverNaUrl(filtros) {
  const consulta = paramsDosFiltros(filtros).toString();
  substituirHash(`#/comprar${consulta ? `?${consulta}` : ""}`);
}

/* ------------------------------------------------------------------- medidas */

const medidas = new Map();

/**
 * O que a lista precisa saber de uma receita para filtrá-la. Medido uma vez por
 * receita e por mercado — a contagem de cada opção do painel mede o catálogo inteiro
 * uma vez por caixinha, e sem isto seria o mesmo trabalho dez vezes.
 *
 * `porPorcao` não depende do número de porções: escalar multiplica ingredientes e
 * porções pelo mesmo fator, e a divisão cancela. O padrão da receita serve para todas.
 *
 * `completa: false` é o preço que é só um piso, porque falta linha na conta. O filtro
 * compara pelo piso, que é o número que o cartão mostra — comparar por um valor que
 * ninguém vê seria pior do que comparar por um valor incompleto.
 */
export function medirReceita(r, mercado = null) {
  const chave = `${r.slug}|${mercado ?? ""}`;
  if (medidas.has(chave)) return medidas.get(chave);

  const escolhas = carregarEscolhas()[r.slug] ?? {};
  const c = custoDaReceita(aplicarEscolhas(r, escolhas, mercado), r.porcoes.padrao, mercado);

  /* "Dá para comprar aqui" é não ter nenhum ingrediente em VERMELHO — nenhum produto
     do mercado ativo serve para ele. O amarelo não conta: a escolha não está lá, mas
     outro produto está, e trocar resolve. Excluir por amarelo esconderia receitas que
     o mercado vende. */
  const faltando = mercado
    ? r.ingredientes.filter(i =>
        !i.subtitulo && i.id && i.escala !== false && i.qtd != null &&
        produtosDe(i.id, mercado).length === 0).length
    : 0;

  const m = {
    porPorcao: c.porPorcao,
    completa: c.completa,
    contados: c.contados,
    faltando,
    daqui: faltando === 0
  };
  medidas.set(chave, m);
  return m;
}

/** Esquece as medidas. Trocar de produto num ingrediente muda o custo da receita. */
export const esquecerMedidas = () => medidas.clear();

/* ------------------------------------------------------------------ aplicação */

/** Aplica os filtros. Devolve as receitas que passam, na ordem em que entraram. */
export function aplicarFiltros(lista, filtros, mercado = null) {
  return lista.filter(r => {
    if (filtros.grupos.length && !filtros.grupos.includes(idDoGrupo(r.grupo))) return false;

    const m = medirReceita(r, mercado);

    if (filtros.soDaqui && !m.daqui) return false;

    if (filtros.teto !== SEM_TETO) {
      // Sem preço nenhum não passa por um filtro de preço: não há o que comparar
      if (!m.contados || m.porPorcao == null) return false;
      if (m.porPorcao > filtros.teto) return false;
    }

    return true;
  });
}

/**
 * O teto do controle de custo: o maior custo por porção do CATÁLOGO, arredondado
 * para cima no passo. Do catálogo, e não do que está na tela — uma barra cujo
 * máximo muda a cada tecla digitada na busca não é uma barra, é um susto.
 */
export function tetoMaximo(mercado = null) {
  const valores = receitas
    .map(r => medirReceita(r, mercado).porPorcao)
    .filter(v => v != null && Number.isFinite(v));

  if (!valores.length) return 10;
  return Math.max(PASSO, Math.ceil(Math.max(...valores) / PASSO) * PASSO);
}

/* --------------------------------------------------------------------- painel */

const moeda = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * O painel de filtros.
 *
 * `base` é a lista já passada pela busca: as contagens dizem quantas receitas cada
 * opção deixaria na tela AGORA. A relação de categorias, porém, sai do catálogo
 * inteiro — caixinha que desaparece é caixinha que não dá para desmarcar.
 *
 * Cada contagem soma os OUTROS filtros, não o seu próprio: marcar "Doces" não deve
 * fazer "Pratos principais" virar zero, porque aí não haveria como voltar.
 */
export function painelDeFiltros(base, filtros, mercado = null, nomeDoMercado = "") {
  const teto = tetoMaximo(mercado);
  const valorDaBarra = filtros.teto === SEM_TETO ? teto : Math.min(filtros.teto, teto);
  const contarCom = extra => aplicarFiltros(base, { ...filtros, ...extra }, mercado).length;
  const foraDoMercado = mercado ? base.filter(r => !medirReceita(r, mercado).daqui).length : 0;
  /* A ressalva sobre o piso só aparece quando existe piso na tela. Explicar uma
     imprecisão que não está acontecendo é encher o painel de letra miúda. */
  const temPiso = base.some(r => !medirReceita(r, mercado).completa);

  return `
    <form class="filtros" aria-labelledby="filtros-titulo" data-filtros>
      <div class="filtros-topo">
        <h2 id="filtros-titulo">Filtrar</h2>
        <button type="button" class="btn-texto filtros-limpar" data-limpar
                ${semFiltro(filtros) ? "hidden" : ""}>Limpar</button>
      </div>

      <fieldset class="filtro-grupo">
        <legend>Categoria</legend>
        ${gruposDoCatalogo().map(g => {
          const id = idDoGrupo(g);
          return `
            <label class="filtro-opcao">
              <input type="checkbox" data-filtro="grupo" value="${esc(id)}"
                     ${filtros.grupos.includes(id) ? "checked" : ""}>
              <span>${esc(g)}</span>
              <em>${contarCom({ grupos: [id] })}</em>
            </label>`;
        }).join("")}
      </fieldset>

      <fieldset class="filtro-grupo">
        <legend>Custo por porção</legend>
        <input class="filtro-barra" type="range" data-filtro="ate"
               min="${PASSO}" max="${teto}" step="${PASSO}" value="${valorDaBarra}"
               aria-label="Custo máximo por porção">
        <p class="filtro-valor">${filtros.teto === SEM_TETO
          ? `Qualquer preço — até ${esc(moeda(teto))} por porção`
          : `Até <strong>${esc(moeda(filtros.teto))}</strong> por porção`}</p>
        ${temPiso ? `
          <p class="filtro-nota">Receita com preço incompleto entra pelo piso —
            o “a partir de” do cartão.</p>` : ""}
      </fieldset>

      ${mercado ? `
        <fieldset class="filtro-grupo">
          <legend>Disponibilidade</legend>
          <label class="filtro-opcao">
            <input type="checkbox" data-filtro="aqui" ${filtros.soDaqui ? "checked" : ""}>
            <span>Só o que dá para comprar no ${esc(nomeDoMercado)}</span>
            <em>${contarCom({ soDaqui: true })}</em>
          </label>
          <p class="filtro-nota">${foraDoMercado
            ? `${foraDoMercado} ${foraDoMercado === 1
                ? "receita pede um ingrediente que este mercado"
                : "receitas pedem ingredientes que este mercado"} não vende.`
            : "Este mercado vende tudo o que estas receitas pedem."}</p>
        </fieldset>`
      : `
        <p class="filtro-nota filtro-sem-mercado">Escolha um mercado no cabeçalho
          para filtrar pelo que dá para comprar lá.</p>`}
    </form>`;
}

/**
 * Lê o painel e devolve os filtros que ele representa.
 *
 * A barra no máximo é "sem teto", e não "até o mais caro do catálogo": arrastar até o
 * fim é o gesto de desistir do filtro, e deixar o parâmetro na URL faria uma receita
 * nova e mais cara nascer filtrada.
 */
export function filtrosDoPainel(form, mercado = null) {
  const barra = form.querySelector('[data-filtro="ate"]');
  const valor = Number(barra?.value);
  const teto = tetoMaximo(mercado);

  return {
    grupos: [...form.querySelectorAll('[data-filtro="grupo"]:checked')].map(c => c.value),
    teto: !barra || !Number.isFinite(valor) || valor >= teto ? SEM_TETO : valor,
    soDaqui: form.querySelector('[data-filtro="aqui"]')?.checked === true
  };
}

/** Os filtros zerados. */
export const SEM_FILTROS = { grupos: [], teto: SEM_TETO, soDaqui: false };
