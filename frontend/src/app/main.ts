/** Inforcell OS — roteador e estrutura das telas internas (app.html). */
import { definirAoExpirar, empresaAtual, pode, sair, usuarioAtual, validarSessao } from "./api.js";
import { caixaErro, caixaOk, h } from "./dom.js";
import { consumirAviso, definirAviso, irPara, registrarRenderizador } from "./nav.js";
import { telaCadastro } from "./telas/cadastro.js";
import { telaCliente, telaClientes } from "./telas/clientes.js";
import { telaDiagnostico } from "./telas/diagnostico.js";
import { telaEquipe } from "./telas/equipe.js";
import { telaLogin } from "./telas/login.js";
import { telaNovaOrdem, telaOrdem, telaOrdens } from "./telas/ordens.js";
import { telaPainel } from "./telas/painel.js";

export interface ContextoTela {
  params: string[];
  consulta: URLSearchParams;
}

type Tela = (el: HTMLElement, contexto: ContextoTela) => Promise<void>;

const ROTAS: [RegExp, Tela][] = [
  [/^\/painel$/, telaPainel],
  [/^\/equipe$/, telaEquipe],
  [/^\/ordens$/, telaOrdens],
  [/^\/ordens\/nova$/, telaNovaOrdem],
  [/^\/ordens\/(\d+)$/, telaOrdem],
  [/^\/clientes$/, telaClientes],
  [/^\/clientes\/(\d+)$/, telaCliente],
  [/^\/diagnosticos\/(\d+)$/, telaDiagnostico],
];

const INICIO = "#/painel";
const ROTAS_PUBLICAS = ["/login", "/cadastro"];
const ROTULO_PERFIL = { ADMIN: "Administrador", ATENDENTE: "Atendente", TECNICO: "Técnico" };

let destinoAposLogin = INICIO;

function cabecalho(caminho: string): HTMLElement {
  const u = usuarioAtual();
  const link = (href: string, texto: string, prefixo: string): HTMLElement =>
    h("a", { class: "app-nav__link", href, "aria-current": caminho.startsWith(prefixo) ? "page" : undefined }, texto);
  return h(
    "div",
    { class: "container app-topo" },
    h(
      "a",
      { class: "logo", href: u ? INICIO : "index.html", "aria-label": "Inforcell OS, início" },
      h("span", { class: "logo__icon", "aria-hidden": "true" }),
      h("span", { class: "logo__text" }, "INFORCELL", h("span", { class: "accent" }, " OS")),
    ),
    u &&
      h(
        "nav",
        { class: "app-nav", "aria-label": "Navegação principal" },
        link("#/painel", "Painel", "/painel"),
        link("#/ordens", "Ordens de Serviço", "/ordens"),
        link("#/clientes", "Clientes", "/clientes"),
        pode.gerirEquipe() && link("#/equipe", "Equipe", "/equipe"),
      ),
    u &&
      h(
        "div",
        { class: "app-usuario" },
        h("span", { class: "app-usuario__empresa" }, empresaAtual()?.nome),
        h("span", {}, u.nome, " ", h("span", { class: "tag" }, ROTULO_PERFIL[u.perfil])),
        h(
          "button",
          {
            class: "btn btn--outline btn--sm",
            type: "button",
            onClick: () => {
              sair();
              destinoAposLogin = INICIO;
              irPara("#/login");
            },
          },
          "Sair",
        ),
      ),
  );
}

async function renderizar(): Promise<void> {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [caminho, query = ""] = hash.split("?");
  const topo = document.getElementById("app-cabecalho");
  const principal = document.getElementById("conteudo");
  if (!topo || !principal) return;

  const logado = usuarioAtual() !== null;
  const publica = ROTAS_PUBLICAS.includes(caminho);
  if (!logado && !publica) {
    destinoAposLogin = caminho === "/" ? INICIO : `#${hash}`;
    irPara("#/login");
    return;
  }
  if (logado && (publica || caminho === "/")) {
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
  if (caminho === "/cadastro") {
    telaCadastro(el, INICIO);
    return;
  }

  const contexto = { consulta: new URLSearchParams(query) };
  const rota = ROTAS.find(([padrao]) => padrao.test(caminho));
  if (!rota) {
    el.replaceChildren(h("h1", { class: "tela__titulo" }, "Página não encontrada"), h("p", {}, h("a", { href: INICIO }, "Ir para o painel")));
    return;
  }

  try {
    const params = (rota[0].exec(caminho) ?? []).slice(1);
    await rota[1](el, { ...contexto, params });
    el.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    el.replaceChildren(
      caixaErro(e),
      h("button", { class: "btn btn--outline btn--sm", type: "button", onClick: () => void renderizar() }, "Tentar novamente"),
    );
  }
}

async function iniciar(): Promise<void> {
  registrarRenderizador(() => void renderizar());
  definirAoExpirar(() => {
    definirAviso({ tipo: "erro", texto: "Sua sessão expirou. Entre novamente." });
    irPara("#/login");
  });
  window.addEventListener("hashchange", () => void renderizar());
  const hashInicial = location.hash;
  await validarSessao();
  // Se a sessão expirou, o redirecionamento já dispara o hashchange (e mostra o aviso uma vez só).
  if (location.hash === hashInicial) await renderizar();
}

void iniciar();
