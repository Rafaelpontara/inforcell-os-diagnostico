/** Cliente HTTP da API Inforcell OS, sessão JWT e tipos das respostas. */
import { urlApi } from "./config.js";
// ---------- Sessão ----------
const CHAVE_SESSAO = "inforcell.sessao";
/** A sessão fica em sessionStorage: some ao fechar a aba, o que é mais seguro em balcão compartilhado. */
let sessao = (() => {
    try {
        return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "null");
    }
    catch {
        return null;
    }
})();
function gravarSessao(nova) {
    sessao = nova;
    try {
        if (nova)
            sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(nova));
        else
            sessionStorage.removeItem(CHAVE_SESSAO);
    }
    catch {
        /* sem armazenamento, a sessão vale só até recarregar a página */
    }
}
export const usuarioAtual = () => sessao?.usuario ?? null;
let aoExpirar = () => undefined;
/** Define o que fazer quando a API recusa o token (sessão expirada ou inválida). */
export function definirAoExpirar(fn) {
    aoExpirar = fn;
}
// ---------- Erros ----------
export class ErroApi extends Error {
    constructor(status, // 0 = sem resposta da API
    mensagem, detalhes = []) {
        super(mensagem);
        this.status = status;
        this.detalhes = detalhes;
    }
}
/** A API devolve { erro, detalhes }, em que detalhes pode listar os campos inválidos. */
function erroDaResposta(status, corpo) {
    const c = (corpo ?? {});
    const mensagem = typeof c.erro === "string" ? c.erro : `A API respondeu com o erro ${status}.`;
    const detalhes = Array.isArray(c.detalhes)
        ? c.detalhes
            .filter((d) => typeof d === "object" && d !== null && "mensagem" in d)
            .map((d) => (d.campo ? `${d.campo}: ${d.mensagem}` : d.mensagem))
        : [];
    return new ErroApi(status, mensagem, detalhes);
}
// ---------- Requisições ----------
async function enviar(metodo, caminho, corpo) {
    const cabecalhos = {};
    if (corpo !== undefined)
        cabecalhos["Content-Type"] = "application/json";
    if (sessao)
        cabecalhos.Authorization = `Bearer ${sessao.token}`;
    let resposta;
    try {
        resposta = await fetch(`${urlApi()}${caminho}`, {
            method: metodo,
            headers: cabecalhos,
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
        });
    }
    catch {
        throw new ErroApi(0, `Não foi possível conectar à API em ${urlApi()}. Confira se ela está rodando e se esta origem está liberada em CORS_ORIGIN.`);
    }
    if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        // Sem sessão, o 401 é apenas login recusado e a tela de login mostra a mensagem.
        if (resposta.status === 401 && sessao) {
            gravarSessao(null);
            aoExpirar();
        }
        throw erroDaResposta(resposta.status, dados);
    }
    return resposta;
}
async function json(metodo, caminho, corpo) {
    const resposta = await enviar(metodo, caminho, corpo);
    return (resposta.status === 204 ? undefined : await resposta.json());
}
export const api = {
    get: (caminho) => json("GET", caminho),
    post: (caminho, corpo) => json("POST", caminho, corpo ?? {}),
    patch: (caminho, corpo) => json("PATCH", caminho, corpo),
    /** Para respostas em HTML, como o comprovante da OS. */
    texto: async (caminho) => (await enviar("GET", caminho)).text(),
};
export async function entrar(email, senha) {
    gravarSessao(null);
    const r = await api.post("/auth/login", { email, senha });
    gravarSessao(r);
    return r.usuario;
}
export function sair() {
    gravarSessao(null);
}
/** Confere o token salvo. Se a API estiver fora do ar, mantém a sessão e a tela mostra o erro. */
export async function validarSessao() {
    if (!sessao)
        return;
    try {
        const usuario = await api.get("/auth/me");
        if (sessao)
            gravarSessao({ token: sessao.token, usuario });
    }
    catch {
        /* 401 já encerrou a sessão em enviar(); outros erros aparecem na tela seguinte */
    }
}
/** Consulta /health sem autenticação; devolve null se a API não responder. */
export async function consultarSaude() {
    try {
        const r = await fetch(`${urlApi()}/health`);
        return r.ok ? (await r.json()) : null;
    }
    catch {
        return null;
    }
}
// ---------- Permissões (espelham os perfis da API) ----------
const perfilEh = (...perfis) => {
    const u = usuarioAtual();
    return u !== null && perfis.includes(u.perfil);
};
export const pode = {
    cadastrar: () => perfilEh("ADMIN", "ATENDENTE"),
    abrirOS: () => perfilEh("ADMIN", "ATENDENTE"),
    atribuirTecnico: () => perfilEh("ADMIN", "ATENDENTE"),
    comprovante: () => perfilEh("ADMIN", "ATENDENTE"),
    diagnosticar: () => perfilEh("ADMIN", "TECNICO"),
    registrarReparo: () => perfilEh("ADMIN", "TECNICO"),
};
