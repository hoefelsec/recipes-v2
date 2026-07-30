/* Roteamento por hash. Endereços:

     #/comprar                      lista de compras (o índice de receitas)
     #/receita/<slug>[?porcoes=N]   uma receita
     #/carrinho                     carrinho
     #/lista                        folha de compras (para imprimir)

   Endereço desconhecido — inclusive `#/` — cai na LISTA, e não numa receita: sem
   menu lateral, a lista é o índice, e chegar num prato ao acaso não é chegar em
   lugar nenhum. */

import { receitas, porSlug } from "../data/index.js";

const AREAS = ["receita", "comprar", "carrinho", "lista"];

export function rotaAtual() {
  const bruto = window.location.hash.replace(/^#\/?/, "");
  const [caminho, query = ""] = bruto.split("?");
  const partes = caminho.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);

  const area = AREAS.includes(partes[0]) ? partes[0] : "comprar";

  if (area !== "receita") return { area, slug: null, params };

  const slug = porSlug(partes[1]) ? partes[1] : receitas[0].slug;
  return { area, slug, params };
}

export const slugAtual = () => rotaAtual().slug;

/** Porções pedidas na URL, ou null. Validação fica com quem chama. */
export function porcoesAtual() {
  const valor = rotaAtual().params.get("porcoes");
  return valor === null ? null : Number(valor);
}

export const irPara = destino => { window.location.hash = destino; };

/** A rota como um texto comparável: área, receita e parâmetros. */
export const assinatura = ({ area, slug, params }) => `${area}|${slug ?? ""}|${params}`;

/* A última rota ENTREGUE a quem desenha. Chegar ao endereço em que já se está não
   deve redesenhar nada — foi assim que a folha de compras abriu a janela de impressão
   duas vezes.

   Mora aqui, e não em `app.js`, porque quem reescreve a URL sem trocar de tela
   (porções, filtros) precisa atualizar este registro. Enquanto ele ficava do outro
   lado, filtrar por "doces" e depois clicar em "Receitas" no cabeçalho voltava para
   uma assinatura que o registro velho já dizia ter entregue: a URL limpava e a tela
   continuava filtrada. */
let entregue = null;

/**
 * Troca a URL sem criar entrada no histórico nem redesenhar a tela.
 *
 * Para quem já está desenhado e só quer que o endereço reflita o estado: as porções da
 * receita, os filtros da lista. Cada clique no `+` como um passo do botão "voltar"
 * transformaria a seta em "desfazer".
 */
export function substituirHash(destino) {
  if (window.location.hash === destino) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search + destino);
  entregue = assinatura(rotaAtual());
}

export const irParaReceita = slug => irPara(`#/receita/${encodeURIComponent(slug)}`);

/**
 * Grava as porções na URL sem criar entrada no histórico — senão cada clique
 * no + viraria um passo do botão "voltar".
 * Quando o valor é o padrão da receita, o parâmetro sai da URL.
 */
export function definirPorcoesNaUrl(slug, porcoes, padrao) {
  const base = `#/receita/${encodeURIComponent(slug)}`;
  substituirHash(porcoes === padrao ? base : `${base}?porcoes=${porcoes}`);
}

/** Chama `callback(rota)` agora e a cada mudança de endereço — nunca duas vezes
    para o mesmo endereço. */
export function aoTrocarRota(callback) {
  const entregar = () => {
    const rota = rotaAtual();
    const atual = assinatura(rota);
    if (atual === entregue) return;

    entregue = atual;
    callback(rota);
  };

  window.addEventListener("hashchange", entregar);
  entregar();
}
