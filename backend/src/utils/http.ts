/** Erro de aplicação com status HTTP, tratado pelo errorHandler. */
export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, `${what} não encontrado(a).`);
export const forbidden = (msg = "Você não tem permissão para esta ação.") => new AppError(403, msg);

/** Converte o parâmetro :id em número inteiro positivo. */
export function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Identificador inválido.");
  return id;
}

/** Paginação simples via ?pagina=1&porPagina=20 */
export function paginacao(query: Record<string, unknown>) {
  const pagina = Math.max(1, Number(query.pagina) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(query.porPagina) || 20));
  return { skip: (pagina - 1) * porPagina, take: porPagina, pagina, porPagina };
}
