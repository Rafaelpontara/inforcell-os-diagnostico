/** Inforcell OS — roteador e estrutura das telas internas (app.html). */
import { definirAoExpirar, sair, usuarioAtual, validarSessao } from "./api.js";
import { caixaErro, caixaOk, h } from "./dom.js";
import { consumirAviso, definirAviso, irPara, registrarRenderizador } from "./nav.js";
import { telaCliente, telaClientes } from "./telas/clientes.js";
import { telaDiagnostico } from "./telas/diagnostico.js";
import { telaLogin } from "./telas/login.js";
import { telaNovaOrdem, telaOrdem, telaOrdens } from "./telas/ordens.js";
const ROTAS = [
    [/^\/ordens$/, telaOrdens],
    [/^\/ordens\/nova$/, telaNovaOrdem],
    [/^\/ordens\/(\d+)$/, telaOrdem],
    [/^\/clientes$/, telaClientes],
    [/^\/clientes\/(\d+)$/, telaCliente],
    [/^\/diagnosticos\/(\d+)$/, telaDiagnostico],
];
const INICIO = "#/ordens";
const ROTULO_PERFIL = { ADMIN: "Administrador", ATENDENTE: "Atendente", TECNICO: "Técnico" };
let destinoAposLogin = INICIO;
function cabecalho(caminho) {
    const u = usuarioAtual();
    const link = (href, texto, prefixo) => h("a", { class: "app-nav__link", href, "aria-current": caminho.startsWith(prefixo) ? "page" : undefined }, texto);
    return h("div", { class: "container app-topo" }, h("a", { class: "logo", href: u ? INICIO : "index.html", "aria-label": "Inforcell OS, início" }, h("span", { class: "logo__icon", "aria-hidden": "true" }), h("span", { class: "logo__text" }, "INFORCELL", h("span", { class: "accent" }, " OS"))), u &&
        h("nav", { class: "app-nav", "aria-label": "Navegação principal" }, link("#/ordens", "Ordens de Serviço", "/ordens"), link("#/clientes", "Clientes", "/clientes")), u &&
        h("div", { class: "app-usuario" }, h("span", {}, u.nome, " ", h("span", { class: "tag" }, ROTULO_PERFIL[u.perfil])), h("button", {
            class: "btn btn--outline btn--sm",
            type: "button",
            onClick: () => {
                sair();
                destinoAposLogin = INICIO;
                irPara("#/login");
            },
        }, "Sair")));
}
async function renderizar() {
    const hash = location.hash.replace(/^#/, "") || "/";
    const [caminho, query = ""] = hash.split("?");
    const topo = document.getElementById("app-cabecalho");
    const principal = document.getElementById("conteudo");
    if (!topo || !principal)
        return;
    const logado = usuarioAtual() !== null;
    if (!logado && caminho !== "/login") {
        destinoAposLogin = caminho === "/" ? INICIO : `#${hash}`;
        irPara("#/login");
        return;
    }
    if (logado && (caminho === "/login" || caminho === "/")) {
        irPara(INICIO);
        return;
    }
    topo.replaceChildren(cabecalho(caminho));
    // Cada navegação usa um elemento novo: resposta de uma tela antiga não altera a atual.
    const el = h("div", {}, h("p", { class: "carregando", role: "status" }, "Carregando…"));
    const aviso = consumirAviso();
    principal.replaceChildren(el);
    if (aviso) {
        const caixa = aviso.tipo === "ok" ? caixaOk(aviso.texto) : caixaErro(new Error(aviso.texto));
        principal.prepend(caixa);
        // O aviso da navegação anterior sai na próxima ação feita na mesma tela.
        el.addEventListener("submit", () => caixa.remove(), { once: true, capture: true });
    }
    if (caminho === "/login") {
        telaLogin(el, destinoAposLogin);
        return;
    }
    const contexto = { consulta: new URLSearchParams(query) };
    const rota = ROTAS.find(([padrao]) => padrao.test(caminho));
    if (!rota) {
        el.replaceChildren(h("h1", { class: "tela__titulo" }, "Página não encontrada"), h("p", {}, h("a", { href: INICIO }, "Ir para as Ordens de Serviço")));
        return;
    }
    try {
        const params = (rota[0].exec(caminho) ?? []).slice(1);
        await rota[1](el, { ...contexto, params });
        el.querySelector("h1")?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
    }
    catch (e) {
        el.replaceChildren(caixaErro(e), h("button", { class: "btn btn--outline btn--sm", type: "button", onClick: () => void renderizar() }, "Tentar novamente"));
    }
}
async function iniciar() {
    registrarRenderizador(() => void renderizar());
    definirAoExpirar(() => {
        definirAviso({ tipo: "erro", texto: "Sua sessão expirou. Entre novamente." });
        irPara("#/login");
    });
    window.addEventListener("hashchange", () => void renderizar());
    const hashInicial = location.hash;
    await validarSessao();
    // Se a sessão expirou, o redirecionamento já dispara o hashchange (e mostra o aviso uma vez só).
    if (location.hash === hashInicial)
        await renderizar();
}
void iniciar();
