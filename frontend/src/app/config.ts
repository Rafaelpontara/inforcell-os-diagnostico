/**
 * Configuração da URL base da API.
 * Ordem de prioridade:
 *  1. valor salvo neste navegador pela tela de login;
 *  2. <meta name="inforcell-api"> do app.html (padrão de cada publicação);
 *  3. API local de desenvolvimento.
 */
const CHAVE_URL = "inforcell.apiUrl";
const URL_LOCAL = "http://localhost:3333/api";

export function urlPadrao(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="inforcell-api"]');
  return meta?.content.trim() || URL_LOCAL;
}

export function urlApi(): string {
  try {
    return localStorage.getItem(CHAVE_URL) || urlPadrao();
  } catch {
    return urlPadrao(); // armazenamento bloqueado pelo navegador
  }
}

/** Valida e guarda a URL. Texto vazio volta ao padrão. Lança erro se a URL for inválida. */
export function definirUrlApi(valor: string): string {
  const limpo = valor.trim().replace(/\/+$/, "");
  if (limpo) {
    let protocolo = "";
    try {
      protocolo = new URL(limpo).protocol;
    } catch {
      /* tratado abaixo */
    }
    if (protocolo !== "http:" && protocolo !== "https:") {
      throw new Error("Informe uma URL completa, como http://localhost:3333/api.");
    }
  }
  try {
    if (limpo) localStorage.setItem(CHAVE_URL, limpo);
    else localStorage.removeItem(CHAVE_URL);
  } catch {
    throw new Error("Este navegador bloqueou o armazenamento local; não foi possível salvar a URL.");
  }
  return urlApi();
}
