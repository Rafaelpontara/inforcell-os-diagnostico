/** Cadastro público: cada assistência cria a própria conta e passa a ter um painel separado. */
import { cadastrarEmpresa } from "../api.js";
import { aoEnviar, campo, h, ouNulo } from "../dom.js";
import { definirAviso, irPara } from "../nav.js";
export function telaCadastro(el, destino) {
    const form = h("form", { class: "form" }, h("h2", { class: "form__secao" }, "Sua assistência"), campo({ rotulo: "Nome da assistência", nome: "nomeEmpresa", obrigatorio: true, atributos: { minlength: 2, maxlength: 120, autocomplete: "organization", autofocus: true } }), campo({ rotulo: "Telefone", nome: "telefoneEmpresa", tipo: "tel", ajuda: "Opcional. Aparece no comprovante da OS.", atributos: { autocomplete: "tel" } }), h("h2", { class: "form__secao" }, "Sua conta de administrador"), campo({ rotulo: "Seu nome", nome: "nome", obrigatorio: true, atributos: { minlength: 2, maxlength: 120, autocomplete: "name" } }), campo({ rotulo: "E-mail", nome: "email", tipo: "email", obrigatorio: true, atributos: { maxlength: 160, autocomplete: "username" } }), campo({ rotulo: "Senha", nome: "senha", tipo: "password", obrigatorio: true, ajuda: "Mínimo de 8 caracteres.", atributos: { minlength: 8, maxlength: 72, autocomplete: "new-password" } }), campo({ rotulo: "Confirme a senha", nome: "confirmacao", tipo: "password", obrigatorio: true, atributos: { minlength: 8, maxlength: 72, autocomplete: "new-password" } }), h("button", { class: "btn btn--primary btn--block", type: "submit" }, "Criar conta"));
    aoEnviar(form, async (d) => {
        if (d.senha !== d.confirmacao)
            throw new Error("As senhas não são iguais.");
        await cadastrarEmpresa({ nomeEmpresa: d.nomeEmpresa, telefoneEmpresa: ouNulo(d.telefoneEmpresa), nome: d.nome, email: d.email, senha: d.senha });
        definirAviso({ tipo: "ok", texto: `Conta criada. Bem-vindo(a) ao painel da ${d.nomeEmpresa}!` });
        irPara(destino);
    }, "Criando conta…");
    el.replaceChildren(h("div", { class: "login" }, h("p", { class: "eyebrow" }, "// inforcell os"), h("h1", { class: "tela__titulo", tabindex: "-1" }, "Cadastrar assistência"), h("p", { class: "login__texto" }, "Crie o painel da sua assistência. Os clientes e as Ordens de Serviço ficam visíveis só para a sua equipe."), form, h("p", { class: "login__alternar" }, "Já tem conta? ", h("a", { href: "#/login" }, "Entrar"))));
}
