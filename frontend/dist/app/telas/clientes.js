/** HU02 — Clientes e seus equipamentos. */
import { api, pode } from "../api.js";
import { aoEnviar, cabecalhoTela, caixaOk, campo, data, h, numeroOS, ouNulo, paginador, preencher, tagStatus } from "../dom.js";
import { definirAviso, hashComFiltros, irPara } from "../nav.js";
const TIPOS = [
    { valor: "CELULAR", rotulo: "Celular" },
    { valor: "TABLET", rotulo: "Tablet" },
    { valor: "NOTEBOOK", rotulo: "Notebook" },
    { valor: "DESKTOP", rotulo: "Desktop" },
    { valor: "OUTRO", rotulo: "Outro" },
];
// ---------- Formulários reutilizados na criação e na edição ----------
function dadosCliente(d) {
    return { nome: d.nome, telefone: d.telefone, cpf: ouNulo(d.cpf), email: ouNulo(d.email), endereco: ouNulo(d.endereco) };
}
function formCliente(atual, salvar) {
    const form = h("form", { class: "form form--grade" }, campo({ rotulo: "Nome", nome: "nome", valor: atual?.nome, obrigatorio: true, atributos: { minlength: 2, maxlength: 120 } }), campo({ rotulo: "Telefone", nome: "telefone", tipo: "tel", valor: atual?.telefone, obrigatorio: true, ajuda: "Com DDD: 10 ou 11 dígitos." }), campo({ rotulo: "CPF", nome: "cpf", valor: atual?.cpf, ajuda: "Opcional: 11 dígitos." }), campo({ rotulo: "E-mail", nome: "email", tipo: "email", valor: atual?.email }), campo({ rotulo: "Endereço", nome: "endereco", valor: atual?.endereco, atributos: { maxlength: 255 } }), h("div", { class: "form__acoes" }, h("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Salvar cliente")));
    aoEnviar(form, salvar);
    return form;
}
function dadosEquipamento(d) {
    return {
        tipo: d.tipo,
        marca: d.marca,
        modelo: d.modelo,
        imei: ouNulo(d.imei),
        numeroSerie: ouNulo(d.numeroSerie),
        cor: ouNulo(d.cor),
        observacoes: ouNulo(d.observacoes),
    };
}
function formEquipamento(atual, salvar) {
    const form = h("form", { class: "form form--grade" }, campo({ rotulo: "Tipo", nome: "tipo", valor: atual?.tipo ?? "CELULAR", obrigatorio: true, opcoes: TIPOS }), campo({ rotulo: "Marca", nome: "marca", valor: atual?.marca, obrigatorio: true, atributos: { maxlength: 60 } }), campo({ rotulo: "Modelo", nome: "modelo", valor: atual?.modelo, obrigatorio: true, atributos: { maxlength: 80 } }), campo({
        rotulo: "IMEI",
        nome: "imei",
        valor: atual?.imei,
        ajuda: "De 14 a 16 dígitos, sem espaços.",
        atributos: { inputmode: "numeric", pattern: "\\d{14,16}", title: "De 14 a 16 dígitos, sem espaços" },
    }), campo({ rotulo: "Nº de série", nome: "numeroSerie", valor: atual?.numeroSerie, atributos: { maxlength: 80 } }), campo({ rotulo: "Cor", nome: "cor", valor: atual?.cor, atributos: { maxlength: 40 } }), campo({ rotulo: "Observações", nome: "observacoes", valor: atual?.observacoes, linhas: 2 }), h("div", { class: "form__acoes" }, h("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Salvar equipamento")));
    aoEnviar(form, salvar);
    return form;
}
// ---------- Lista ----------
export async function telaClientes(el, { consulta }) {
    const busca = consulta.get("busca") ?? "";
    const pagina = Number(consulta.get("pagina")) || 1;
    const q = new URLSearchParams({ pagina: String(pagina) });
    if (busca)
        q.set("busca", busca);
    const r = await api.get(`/clientes?${q}`);
    const filtro = h("form", { class: "filtros", role: "search" }, campo({ rotulo: "Buscar por nome, CPF ou telefone", nome: "busca", tipo: "search", valor: busca }), h("button", { class: "btn btn--outline btn--sm", type: "submit" }, "Buscar"));
    aoEnviar(filtro, async (d) => irPara(hashComFiltros("#/clientes", { busca: d.busca })));
    const novo = formCliente(null, async (d) => {
        const criado = await api.post("/clientes", dadosCliente(d));
        definirAviso({ tipo: "ok", texto: `Cliente ${criado.nome} cadastrado. Agora inclua o equipamento.` });
        irPara(`#/clientes/${criado.id}`);
    });
    preencher(el, cabecalhoTela("Clientes"), pode.cadastrar() && h("details", { class: "painel painel--dobra" }, h("summary", {}, "Novo cliente"), novo), filtro, r.dados.length === 0
        ? h("p", { class: "vazio" }, busca ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente cadastrado.")
        : h("div", { class: "tabela" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Nome"), h("th", {}, "Telefone"), h("th", {}, "CPF"), h("th", {}, "E-mail"))), h("tbody", {}, r.dados.map((c) => h("tr", {}, h("td", {}, h("a", { href: `#/clientes/${c.id}` }, c.nome)), h("td", {}, c.telefone), h("td", {}, c.cpf ?? "—"), h("td", {}, c.email ?? "—")))))), paginador(r.total, r.pagina, r.porPagina, (p) => hashComFiltros("#/clientes", { busca, pagina: p })));
}
// ---------- Detalhe ----------
export async function telaCliente(el, { params }) {
    const id = Number(params[0]);
    const carregar = async (aviso) => {
        const c = await api.get(`/clientes/${id}`);
        const nomeEquipamento = (equipamentoId) => {
            const eq = c.equipamentos.find((e) => e.id === equipamentoId);
            return eq ? `${eq.marca} ${eq.modelo}` : "—";
        };
        preencher(el, cabecalhoTela(c.nome, pode.abrirOS() && h("a", { class: "btn btn--primary btn--sm", href: `#/ordens/nova?clienteId=${c.id}` }, "Abrir OS")), aviso && caixaOk(aviso), h("section", { class: "painel" }, h("h2", {}, "Dados do cliente"), pode.cadastrar()
            ? formCliente(c, async (d) => {
                await api.patch(`/clientes/${c.id}`, dadosCliente(d));
                await carregar("Cliente atualizado.");
            })
            : h("dl", { class: "dados" }, h("dt", {}, "Telefone"), h("dd", {}, c.telefone), h("dt", {}, "CPF"), h("dd", {}, c.cpf ?? "—"), h("dt", {}, "E-mail"), h("dd", {}, c.email ?? "—"), h("dt", {}, "Endereço"), h("dd", {}, c.endereco ?? "—"))), h("section", { class: "painel" }, h("h2", {}, "Equipamentos"), c.equipamentos.length === 0 && h("p", { class: "vazio" }, "Nenhum equipamento cadastrado para este cliente."), h("ul", { class: "lista-itens" }, c.equipamentos.map((eq) => h("li", { class: "item" }, h("div", { class: "item__topo" }, h("div", {}, h("strong", {}, `${eq.marca} ${eq.modelo}`), h("p", { class: "item__sub" }, [TIPOS.find((t) => t.valor === eq.tipo)?.rotulo, eq.imei && `IMEI ${eq.imei}`, eq.numeroSerie && `Série ${eq.numeroSerie}`, eq.cor]
            .filter(Boolean)
            .join(" · "))), pode.abrirOS() &&
            h("a", { class: "btn btn--outline btn--sm", href: `#/ordens/nova?clienteId=${c.id}&equipamentoId=${eq.id}` }, "Abrir OS")), h("details", { class: "dobra" }, h("summary", {}, "Editar equipamento"), formEquipamento(eq, async (d) => {
            await api.patch(`/equipamentos/${eq.id}`, dadosEquipamento(d));
            await carregar("Equipamento atualizado.");
        }))))), pode.cadastrar() &&
            h("details", { class: "dobra", open: c.equipamentos.length === 0 }, h("summary", {}, "Adicionar equipamento"), formEquipamento(null, async (d) => {
                await api.post("/equipamentos", { ...dadosEquipamento(d), clienteId: c.id });
                await carregar("Equipamento adicionado.");
            }))), h("section", { class: "painel" }, h("h2", {}, "Ordens de Serviço"), c.ordens.length === 0
            ? h("p", { class: "vazio" }, "Nenhuma OS aberta para este cliente.")
            : h("ul", { class: "lista-itens" }, c.ordens.map((o) => h("li", { class: "item item__topo" }, h("div", {}, h("a", { href: `#/ordens/${o.id}` }, numeroOS(o.numero)), h("p", { class: "item__sub" }, `${nomeEquipamento(o.equipamentoId)} · entrada em ${data(o.createdAt)}`)), tagStatus(o.status))))));
    };
    await carregar();
}
