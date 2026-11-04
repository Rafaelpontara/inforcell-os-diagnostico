/**
 * Utilitários de interface.
 * Tudo é montado com nós de texto, nunca com innerHTML: dados vindos da API (nome de
 * cliente, resposta da IA etc.) não têm como virar HTML na página.
 */
import { ErroApi } from "./api.js";
export function h(tag, props = {}, ...filhos) {
    const el = document.createElement(tag);
    for (const [chave, valor] of Object.entries(props)) {
        if (valor === undefined || valor === null || valor === false)
            continue;
        if (chave.startsWith("on") && typeof valor === "function") {
            el.addEventListener(chave.slice(2).toLowerCase(), valor);
        }
        else if (chave === "class") {
            el.className = String(valor);
        }
        else if (chave === "value") {
            el.value = String(valor);
        }
        else if (valor === true) {
            el.setAttribute(chave, "");
        }
        else {
            el.setAttribute(chave, String(valor));
        }
    }
    anexar(el, filhos);
    return el;
}
/** Troca o conteúdo do elemento, ignorando filhos vazios (null, false etc.). */
export function preencher(el, ...filhos) {
    el.replaceChildren();
    anexar(el, filhos);
}
function anexar(el, filhos) {
    for (const f of filhos) {
        if (Array.isArray(f))
            anexar(el, f);
        else if (f instanceof Node)
            el.appendChild(f);
        else if (f !== null && f !== undefined && f !== false)
            el.appendChild(document.createTextNode(String(f)));
    }
}
// ---------- Alertas ----------
export function caixaErro(erro) {
    const mensagem = erro instanceof Error ? erro.message : "Ocorreu um erro inesperado.";
    const detalhes = erro instanceof ErroApi ? erro.detalhes : [];
    return h("div", { class: "alerta alerta--erro", role: "alert" }, h("p", {}, mensagem), detalhes.length > 0 && h("ul", {}, detalhes.map((d) => h("li", {}, d))));
}
export const caixaAviso = (texto) => h("div", { class: "alerta alerta--aviso", role: "status" }, texto);
export const caixaOk = (texto) => h("div", { class: "alerta alerta--ok", role: "status" }, texto);
export function campo(o) {
    const comuns = { name: o.nome, required: o.obrigatorio, ...o.atributos };
    const valor = o.valor ?? "";
    let controle;
    if (o.opcoes) {
        const select = h("select", comuns, o.opcoes.map((x) => h("option", { value: x.valor }, x.rotulo)));
        select.value = String(valor);
        controle = select;
    }
    else if (o.linhas) {
        controle = h("textarea", { ...comuns, rows: o.linhas }, String(valor));
    }
    else {
        controle = h("input", { ...comuns, type: o.tipo ?? "text", value: valor });
    }
    return h("label", { class: "campo" }, h("span", { class: "campo__rotulo" }, o.rotulo, o.obrigatorio && h("span", { class: "campo__obrig", "aria-hidden": "true" }, " *")), controle, o.ajuda && h("span", { class: "campo__ajuda" }, o.ajuda));
}
/**
 * Trata o envio do formulário: bloqueia os botões para evitar envio duplo, mostra o estado
 * de espera e exibe os erros da API dentro do próprio formulário, sem perder o que foi digitado.
 */
export function aoEnviar(form, acao, textoOcupado = "Salvando…") {
    const areaErro = h("div", {});
    form.appendChild(areaErro);
    form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const dados = {};
        new FormData(form).forEach((v, k) => {
            if (typeof v === "string")
                dados[k] = v.trim();
        });
        const botao = form.querySelector('button[type="submit"]');
        void ocupado(botao, textoOcupado, areaErro, () => acao(dados));
    });
}
/** Executa uma ação com o botão bloqueado; em caso de erro, mostra-o em `areaErro`. */
export async function ocupado(botao, textoOcupado, areaErro, acao) {
    const textoOriginal = botao?.textContent ?? "";
    if (botao) {
        botao.disabled = true;
        botao.textContent = textoOcupado;
    }
    areaErro.replaceChildren();
    try {
        await acao();
    }
    catch (e) {
        areaErro.replaceChildren(caixaErro(e));
    }
    finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    }
}
/** Texto vazio vira null, para limpar o campo opcional na API. */
export const ouNulo = (v) => (v ? v : null);
/** Aceita "1.234,56", "150,5" e "150.5". */
export function paraNumero(v) {
    return Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
}
/** Data do formulário (AAAA-MM-DD) ao meio-dia local, para não mudar de dia ao converter para UTC. */
export const dataParaIso = (v) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);
export function isoParaData(iso) {
    if (!iso)
        return "";
    const d = new Date(iso);
    const doisDigitos = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}
// ---------- Formatação ----------
export const numeroOS = (id) => `OS-${String(id).padStart(4, "0")}`;
export const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export const data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
export const moeda = (v) => v === null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const ROTULO_STATUS = {
    RECEBIDO: "Recebido",
    EM_DIAGNOSTICO: "Em diagnóstico",
    AGUARDANDO_APROVACAO: "Aguardando aprovação",
    EM_REPARO: "Em reparo",
    EM_TESTES: "Em testes",
    FINALIZADO: "Finalizado",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado",
};
export const tagStatus = (status) => h("span", { class: `etiqueta etiqueta--${status.toLowerCase()}` }, ROTULO_STATUS[status]);
// ---------- Componentes ----------
export function cabecalhoTela(titulo, ...acoes) {
    return h("header", { class: "tela__topo" }, h("h1", { class: "tela__titulo", tabindex: "-1" }, titulo), acoes.length > 0 && h("div", { class: "tela__acoes" }, acoes));
}
export function paginador(total, pagina, porPagina, irPara) {
    const paginas = Math.ceil(total / porPagina);
    if (paginas <= 1)
        return null;
    return h("nav", { class: "paginador", "aria-label": "Paginação" }, pagina > 1 && h("a", { class: "btn btn--outline btn--sm", href: irPara(pagina - 1) }, "Anterior"), h("span", {}, `Página ${pagina} de ${paginas}`), pagina < paginas && h("a", { class: "btn btn--outline btn--sm", href: irPara(pagina + 1) }, "Próxima"));
}
