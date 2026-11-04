/** RF01/RF02 — Usuários da empresa, geridos pelo administrador. */
import { api, MembroEquipe, Perfil, pode, usuarioAtual } from "../api.js";
import { aoEnviar, cabecalhoTela, caixaAviso, caixaOk, campo, h, ocupado, preencher } from "../dom.js";

const ROTULO_PERFIL: Record<Perfil, string> = { ADMIN: "Administrador", ATENDENTE: "Atendente", TECNICO: "Técnico" };

export async function telaEquipe(el: HTMLElement): Promise<void> {
  if (!pode.gerirEquipe()) {
    preencher(el, cabecalhoTela("Equipe"), caixaAviso("Somente o administrador pode gerir a equipe."));
    return;
  }

  const carregar = async (aviso?: string): Promise<void> => {
    const membros = await api.get<MembroEquipe[]>("/usuarios");
    const areaErro = h("div", {});

    const form = h(
      "form",
      { class: "form form--grade" },
      campo({ rotulo: "Nome", nome: "nome", obrigatorio: true, atributos: { minlength: 2, maxlength: 120, autocomplete: "off" } }),
      campo({ rotulo: "E-mail", nome: "email", tipo: "email", obrigatorio: true, atributos: { maxlength: 160, autocomplete: "off" } }),
      campo({
        rotulo: "Perfil",
        nome: "perfil",
        obrigatorio: true,
        valor: "TECNICO",
        opcoes: [
          { valor: "TECNICO", rotulo: "Técnico" },
          { valor: "ATENDENTE", rotulo: "Atendente" },
          { valor: "ADMIN", rotulo: "Administrador" },
        ],
      }),
      campo({ rotulo: "Senha inicial", nome: "senha", tipo: "password", obrigatorio: true, ajuda: "Mínimo de 8 caracteres.", atributos: { minlength: 8, maxlength: 72, autocomplete: "new-password" } }),
      h("div", { class: "form__acoes" }, h("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Adicionar à equipe")),
    );
    aoEnviar(form, async (d) => {
      await api.post("/usuarios", { nome: d.nome, email: d.email, perfil: d.perfil, senha: d.senha });
      await carregar(`${d.nome} foi adicionado(a) à equipe.`);
    });

    const botaoAtivo = (m: MembroEquipe): HTMLElement | string => {
      if (m.id === usuarioAtual()?.id) return "Você";
      const botao = h(
        "button",
        {
          class: "btn btn--outline btn--sm",
          type: "button",
          onClick: () =>
            void ocupado(botao, "Salvando…", areaErro, async () => {
              await api.patch(`/usuarios/${m.id}`, { ativo: !m.ativo });
              await carregar(`${m.nome} foi ${m.ativo ? "desativado(a)" : "reativado(a)"}.`);
            }),
        },
        m.ativo ? "Desativar" : "Reativar",
      );
      return botao;
    };

    preencher(
      el,
      cabecalhoTela("Equipe"),
      aviso && caixaOk(aviso),
      areaErro,
      h("details", { class: "painel painel--dobra", open: membros.length === 1 }, h("summary", {}, "Adicionar pessoa"), form),
      h(
        "div",
        { class: "tabela" },
        h(
          "table",
          {},
          h("thead", {}, h("tr", {}, ["Nome", "E-mail", "Perfil", "Situação", ""].map((t) => h("th", {}, t)))),
          h(
            "tbody",
            {},
            membros.map((m) =>
              h(
                "tr",
                {},
                h("td", {}, m.nome),
                h("td", {}, m.email),
                h("td", {}, ROTULO_PERFIL[m.perfil]),
                h("td", {}, m.ativo ? "Ativo" : "Inativo"),
                h("td", {}, botaoAtivo(m)),
              ),
            ),
          ),
        ),
      ),
    );
  };

  await carregar();
}
