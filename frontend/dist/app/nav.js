/** Navegação por hash e aviso exibido uma vez na próxima tela. */
let renderizar = () => undefined;
let aviso = null;
export function registrarRenderizador(fn) {
    renderizar = fn;
}
export function irPara(hash) {
    if (location.hash === hash)
        renderizar();
    else
        location.hash = hash;
}
export function definirAviso(novo) {
    aviso = novo;
}
export function consumirAviso() {
    const atual = aviso;
    aviso = null;
    return atual;
}
/** Monta o hash de uma lista mantendo os filtros na URL (o botão Voltar preserva a busca). */
export function hashComFiltros(base, filtros) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
        if (v !== undefined && v !== "")
            q.set(k, String(v));
    }
    const texto = q.toString();
    return texto ? `${base}?${texto}` : base;
}
