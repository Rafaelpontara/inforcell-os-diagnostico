/**
 * Configuração da URL base da API.
 * Ordem de prioridade:
 *  1. valor salvo neste navegador pela tela de login;
 *  2. <meta name="inforcell-api"> do app.html, com uma URL completa;
 *  3. com "auto" na meta: a API local, no servidor de desenvolvimento (porta 5173),
 *     ou o próprio endereço do site, quando a API entrega as telas.
 */
const CHAVE_URL = "inforcell.apiUrl";
const URL_LOCAL = "http://localhost:3333/api";
export function urlPadrao() {
    const meta = document.querySelector('meta[name="inforcell-api"]')?.content.trim();
    if (meta && meta !== "auto")
        return meta;
    return location.port === "5173" ? URL_LOCAL : `${location.origin}/api`;
}
export function urlApi() {
    try {
        return localStorage.getItem(CHAVE_URL) || urlPadrao();
    }
    catch {
        return urlPadrao(); // armazenamento bloqueado pelo navegador
    }
}
/** Valida e guarda a URL. Texto vazio volta ao padrão. Lança erro se a URL for inválida. */
export function definirUrlApi(valor) {
    const limpo = valor.trim().replace(/\/+$/, "");
    if (limpo) {
        let protocolo = "";
        try {
            protocolo = new URL(limpo).protocol;
        }
        catch {
            /* tratado abaixo */
        }
        if (protocolo !== "http:" && protocolo !== "https:") {
            throw new Error("Informe uma URL completa, como http://localhost:3333/api.");
        }
    }
    try {
        if (limpo)
            localStorage.setItem(CHAVE_URL, limpo);
        else
            localStorage.removeItem(CHAVE_URL);
    }
    catch {
        throw new Error("Este navegador bloqueou o armazenamento local; não foi possível salvar a URL.");
    }
    return urlApi();
}
