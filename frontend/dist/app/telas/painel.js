/** HU08 — Painel da empresa: situação das Ordens de Serviço. */
import { api, empresaAtual, pode } from "../api.js";
import { cabecalhoTela, h, preencher, ROTULO_STATUS, tagStatus } from "../dom.js";
const indicador = (rotulo, valor, destaque = false) => h("div", { class: `indicador${destaque && valor > 0 ? " indicador--alerta" : ""}` }, h("span", { class: "indicador__valor" }, valor), h("span", { class: "indicador__rotulo" }, rotulo));
export async function telaPainel(el) {
    const [p, clientes] = await Promise.all([api.get("/dashboard"), api.get("/clientes?porPagina=1")]);
    const semClientes = clientes.total === 0;
    preencher(el, cabecalhoTela(empresaAtual()?.nome ?? "Painel", pode.abrirOS() && h("a", { class: "btn btn--primary btn--sm", href: "#/ordens/nova" }, "Nova OS")), semClientes && pode.cadastrar() && primeirosPassos(), h("div", { class: "indicadores" }, indicador("OS em aberto", p.emAberto), indicador("Atrasadas", p.atrasadas, true), indicador("Abertas em 30 dias", p.ultimos30Dias.abertas), indicador("Finalizadas em 30 dias", p.ultimos30Dias.finalizadas)), h("div", { class: "colunas colunas--iguais" }, h("section", { class: "painel" }, h("h2", {}, "OS por status"), h("ul", { class: "lista-status" }, Object.keys(ROTULO_STATUS).map((s) => h("li", {}, h("a", { class: "lista-status__link", href: `#/ordens?status=${s}` }, tagStatus(s), h("strong", {}, p.porStatus[s] ?? 0)))))), p.abertasPorTecnico.length > 0 &&
        h("section", { class: "painel" }, h("h2", {}, "OS abertas por técnico"), h("ul", { class: "lista-status" }, p.abertasPorTecnico.map((t) => h("li", { class: "lista-status__link" }, h("span", {}, t.nome), h("strong", {}, t.quantidade)))))));
}
function primeirosPassos() {
    return h("section", { class: "painel" }, h("h2", {}, "Primeiros passos"), h("ol", { class: "passos" }, pode.gerirEquipe() && h("li", {}, h("a", { href: "#/equipe" }, "Adicione sua equipe"), " (atendentes e técnicos)."), h("li", {}, h("a", { href: "#/clientes" }, "Cadastre um cliente"), " e o equipamento dele."), h("li", {}, h("a", { href: "#/ordens/nova" }, "Abra a primeira Ordem de Serviço"), ".")));
}
