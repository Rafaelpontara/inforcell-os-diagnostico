/** Navegação por hash e aviso exibido uma vez na próxima tela. */

export interface Aviso {
  tipo: "ok" | "erro";
  texto: string;
}

let renderizar: () => void = () => undefined;
let aviso: Aviso | null = null;

export function registrarRenderizador(fn: () => void): void {
  renderizar = fn;
}

export function irPara(hash: string): void {
  if (location.hash === hash) renderizar();
  else location.hash = hash;
}

export function definirAviso(novo: Aviso): void {
  aviso = novo;
}

export function consumirAviso(): Aviso | null {
  const atual = aviso;
  aviso = null;
  return atual;
}

/** Monta o hash de uma lista mantendo os filtros na URL (o botão Voltar preserva a busca). */
export function hashComFiltros(base: string, filtros: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const texto = q.toString();
  return texto ? `${base}?${texto}` : base;
}
