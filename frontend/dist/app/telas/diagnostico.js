/** HU05/HU06 — Sessão do assistente de diagnóstico com IA. */
import { api, consultarSaude, ErroApi, pode } from "../api.js";
import { aoEnviar, cabecalhoTela, caixaAviso, caixaErro, caixaOk, campo, dataHora, h, numeroOS, ocupado, paraNumero, preencher } from "../dom.js";
const ROTULO_PROBABILIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" };
const ROTULO_AVALIACAO = {
    DENTRO_DO_ESPERADO: "Dentro do esperado",
    ABAIXO_DO_ESPERADO: "Abaixo do esperado",
    ACIMA_DO_ESPERADO: "Acima do esperado",
    INDEFINIDO: "Sem avaliação",
};
function listaCausas(causas) {
    return h("ol", { class: "causas" }, causas.map((c) => h("li", {}, h("div", { class: "item__topo" }, h("strong", {}, c.causa), h("span", { class: `etiqueta etiqueta--${c.probabilidade}` }, ROTULO_PROBABILIDADE[c.probabilidade])), c.justificativa && h("p", { class: "item__sub" }, c.justificativa))));
}
function balaoIA(o) {
    const etapa = o.proximaEtapa;
    return [
        h("p", { class: "texto-livre" }, o.mensagem),
        o.interpretacaoUltimoResultado &&
            h("p", { class: "texto-livre" }, h("strong", {}, "Interpretação: "), o.interpretacaoUltimoResultado, o.avaliacaoUltimaMedicao && ` (${ROTULO_AVALIACAO[o.avaliacaoUltimaMedicao]})`),
        o.alertasSeguranca.length > 0 &&
            h("div", { class: "alerta alerta--aviso" }, h("strong", {}, "Segurança"), h("ul", {}, o.alertasSeguranca.map((a) => h("li", {}, a)))),
        etapa &&
            h("div", { class: "etapa" }, h("h3", {}, `Próximo teste: ${etapa.titulo}`), h("p", { class: "texto-livre" }, etapa.procedimento), h("dl", { class: "dados dados--compacto" }, etapa.instrumento && [h("dt", {}, "Instrumento"), h("dd", {}, etapa.instrumento)], etapa.pontoMedicao && [h("dt", {}, "Ponto de medição"), h("dd", {}, etapa.pontoMedicao)], etapa.resultadoEsperado && [h("dt", {}, "Esperado"), h("dd", {}, etapa.resultadoEsperado)])),
        o.diagnosticoConcluido && o.diagnosticoSugerido && h("p", { class: "texto-livre" }, h("strong", {}, "Diagnóstico sugerido: "), o.diagnosticoSugerido),
    ].filter(Boolean);
}
function tabelaMedicoes(medicoes) {
    return h("div", { class: "tabela" }, h("table", {}, h("thead", {}, h("tr", {}, ["Ponto", "Grandeza", "Valor", "Esperado", "Avaliação"].map((t) => h("th", {}, t)))), h("tbody", {}, medicoes.map((m) => h("tr", {}, h("td", {}, m.pontoMedicao), h("td", {}, m.grandeza), h("td", {}, `${Number(m.valor).toLocaleString("pt-BR")} ${m.unidade}`), h("td", {}, m.resultadoEsperado ?? "—"), h("td", {}, ROTULO_AVALIACAO[m.avaliacao]))))));
}
export async function telaDiagnostico(el, { params }) {
    if (!pode.diagnosticar()) {
        preencher(el, cabecalhoTela("Assistente de diagnóstico"), caixaAviso("O assistente é usado por técnicos e administradores."));
        return;
    }
    const id = Number(params[0]);
    /** `falha` mantém visível um erro da IA depois de recarregar a conversa. */
    const carregar = async (falha, aviso) => {
        const [s, saude] = await Promise.all([api.get(`/diagnosticos/${id}`), consultarSaude()]);
        const ultimaIA = [...s.mensagens].reverse().find((m) => m.autor === "IA")?.dadosEstruturados ?? null;
        const ultimaDoTecnico = s.mensagens[s.mensagens.length - 1]?.autor === "TECNICO";
        const ativa = s.status === "ATIVA";
        preencher(el, h("p", { class: "migalha" }, h("a", { href: `#/ordens/${s.osId}` }, `← ${numeroOS(s.os.numero)}`)), cabecalhoTela("Assistente de diagnóstico", h("span", { class: `etiqueta ${ativa ? "etiqueta--em_diagnostico" : "etiqueta--finalizado"}` }, ativa ? "Em andamento" : "Concluído")), h("p", { class: "texto-livre sintoma" }, h("strong", {}, "Sintoma: "), s.sintoma), aviso && caixaOk(aviso), !saude?.ia && ativa && caixaAviso("O assistente de IA não está disponível no servidor. Seus resultados ainda podem ser registrados."), h("div", { class: "colunas" }, h("div", { class: "colunas__principal" }, h("section", { class: "painel" }, h("h2", {}, "Conversa"), h("ol", { class: "conversa", "aria-live": "polite" }, s.mensagens.map((m) => h("li", { class: `balao balao--${m.autor === "IA" ? "ia" : "tecnico"}` }, h("p", { class: "balao__autor" }, m.autor === "IA" ? "Assistente" : s.tecnico.nome, ` · ${dataHora(m.createdAt)}`), m.autor === "IA" && m.dadosEstruturados ? balaoIA(m.dadosEstruturados) : h("p", { class: "texto-livre" }, m.conteudo)))), falha ? caixaErro(falha) : null, ativa && ultimaDoTecnico && botaoContinuar(s.id, carregar), ativa && formResultado(s.id, ultimaIA, carregar)), ativa && secaoConcluir(s.id, ultimaIA, carregar), !ativa && h("section", { class: "painel" }, h("h2", {}, "Diagnóstico final"), h("p", { class: "texto-livre" }, s.diagnosticoFinal ?? "—")), s.medicoes.length > 0 && h("section", { class: "painel" }, h("h2", {}, "Medições"), tabelaMedicoes(s.medicoes))), h("aside", { class: "colunas__lado" }, h("section", { class: "painel" }, h("h2", {}, "Causas possíveis"), s.causasPossiveis?.length ? listaCausas(s.causasPossiveis) : h("p", { class: "vazio" }, "Sem causas registradas.")))));
    };
    await carregar();
}
function botaoContinuar(id, carregar) {
    const areaErro = h("div", {});
    const botao = h("button", {
        class: "btn btn--outline btn--sm",
        type: "button",
        onClick: () => void ocupado(botao, "Consultando a IA…", areaErro, async () => {
            await api.post(`/diagnosticos/${id}/continuar`);
            await carregar();
        }),
    }, "Pedir orientação novamente");
    return h("div", { class: "continuar" }, botao, areaErro);
}
function formResultado(id, ultima, carregar) {
    const etapa = ultima?.proximaEtapa ?? null;
    const form = h("form", { class: "form" }, campo({ rotulo: "Resultado do teste", nome: "texto", obrigatorio: true, linhas: 3, atributos: { placeholder: "O que você observou ao fazer o teste?" } }), h("details", { class: "dobra" }, h("summary", {}, "Incluir medição"), h("div", { class: "form form--grade" }, campo({ rotulo: "Ponto de medição", nome: "pontoMedicao", valor: etapa?.pontoMedicao, atributos: { maxlength: 120 } }), campo({ rotulo: "Grandeza", nome: "grandeza", atributos: { maxlength: 40, placeholder: "Tensão, corrente…" } }), campo({ rotulo: "Valor", nome: "valor", atributos: { inputmode: "decimal", placeholder: "5,02" } }), campo({ rotulo: "Unidade", nome: "unidade", atributos: { maxlength: 10, placeholder: "V, mA, Ω" } }), campo({ rotulo: "Resultado esperado", nome: "resultadoEsperado", valor: etapa?.resultadoEsperado?.slice(0, 120), atributos: { maxlength: 120 } }))), h("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Enviar resultado"));
    aoEnviar(form, async (d) => {
        const corpo = { texto: d.texto };
        if (d.valor || d.grandeza || d.unidade) {
            const valor = paraNumero(d.valor);
            if (!d.valor || !Number.isFinite(valor))
                throw new Error("Informe um valor numérico para a medição, como 5,02.");
            if (!d.pontoMedicao || !d.grandeza || !d.unidade)
                throw new Error("Para registrar a medição, preencha ponto, grandeza e unidade.");
            corpo.medicao = {
                pontoMedicao: d.pontoMedicao,
                grandeza: d.grandeza,
                valor,
                unidade: d.unidade,
                resultadoEsperado: d.resultadoEsperado || null,
            };
        }
        try {
            await api.post(`/diagnosticos/${id}/mensagens`, corpo);
        }
        catch (e) {
            // Erro 5xx aqui é falha da IA: o resultado já foi gravado, então recarrega a conversa.
            if (e instanceof ErroApi && e.status >= 500) {
                await carregar(e);
                return;
            }
            throw e;
        }
        await carregar();
    }, "Consultando a IA…");
    return form;
}
function secaoConcluir(id, ultima, carregar) {
    const form = h("form", { class: "form" }, campo({
        rotulo: "Diagnóstico final",
        nome: "diagnosticoFinal",
        obrigatorio: true,
        linhas: 3,
        valor: ultima?.diagnosticoSugerido,
        atributos: { minlength: 3 },
        ajuda: "A decisão final é do técnico: revise a sugestão da IA antes de concluir.",
    }), h("label", { class: "campo-check" }, h("input", { type: "checkbox", name: "salvarNaBase" }), "Salvar este caso na base de conhecimento"), h("button", { class: "btn btn--primary btn--sm", type: "submit" }, "Concluir diagnóstico"));
    aoEnviar(form, async (d) => {
        await api.post(`/diagnosticos/${id}/concluir`, { diagnosticoFinal: d.diagnosticoFinal, salvarNaBase: d.salvarNaBase === "on" });
        await carregar(undefined, "Diagnóstico concluído e registrado na OS.");
    }, "Concluindo…");
    return h("details", { class: "painel painel--dobra", open: ultima?.diagnosticoConcluido }, h("summary", {}, "Concluir diagnóstico"), form);
}
