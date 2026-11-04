/** HU01 — Login e configuração da URL da API. */
import { consultarSaude, entrar } from "../api.js";
import { definirUrlApi, urlApi, urlPadrao } from "../config.js";
import { aoEnviar, caixaAviso, caixaErro, caixaOk, campo, h } from "../dom.js";
import { irPara } from "../nav.js";

export function telaLogin(el: HTMLElement, destino: string): void {
  const form = h(
    "form",
    { class: "form" },
    campo({ rotulo: "E-mail", nome: "email", tipo: "email", obrigatorio: true, atributos: { autocomplete: "username", autofocus: true } }),
    campo({ rotulo: "Senha", nome: "senha", tipo: "password", obrigatorio: true, atributos: { autocomplete: "current-password" } }),
    h("button", { class: "btn btn--primary btn--block", type: "submit" }, "Entrar"),
  );
  aoEnviar(
    form,
    async (d) => {
      await entrar(d.email, d.senha);
      irPara(destino);
    },
    "Entrando…",
  );

  el.replaceChildren(
    h(
      "div",
      { class: "login" },
      h("p", { class: "eyebrow" }, "// inforcell os"),
      h("h1", { class: "tela__titulo", tabindex: "-1" }, "Acessar o sistema"),
      form,
      h("p", { class: "login__alternar" }, "Ainda não tem conta? ", h("a", { href: "#/cadastro" }, "Cadastrar assistência")),
      configuracaoApi(),
      h("p", { class: "login__voltar" }, h("a", { href: "index.html" }, "← Voltar à página inicial")),
    ),
  );
}

function configuracaoApi(): HTMLElement {
  const resultado = h("div", { "aria-live": "polite" });
  const form = h(
    "form",
    { class: "form" },
    campo({
      rotulo: "URL base da API",
      nome: "url",
      tipo: "url",
      valor: urlApi(),
      ajuda: `Fica salva neste navegador. Deixe em branco para usar o padrão (${urlPadrao()}).`,
    }),
    h("button", { class: "btn btn--outline btn--sm", type: "submit" }, "Salvar e testar"),
  );
  aoEnviar(
    form,
    async (d) => {
      const url = definirUrlApi(d.url);
      form.querySelector<HTMLInputElement>('input[name="url"]')!.value = url;
      await testar(url, resultado);
    },
    "Testando…",
  );
  form.appendChild(resultado);

  return h("details", { class: "login__config" }, h("summary", {}, "Configurar conexão com a API"), form);
}

async function testar(url: string, area: HTMLElement): Promise<void> {
  area.replaceChildren();
  const saude = await consultarSaude();
  if (!saude) area.replaceChildren(caixaErro(new Error(`A API não respondeu em ${url}.`)));
  else if (saude.ia) area.replaceChildren(caixaOk("API conectada, com o assistente de IA ativo."));
  else area.replaceChildren(caixaAviso("API conectada, mas o assistente de IA não está configurado no servidor."));
}
