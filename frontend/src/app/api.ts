/** Cliente HTTP da API Inforcell OS, sessão JWT e tipos das respostas. */
import { urlApi } from "./config.js";

// ---------- Tipos ----------

export type Perfil = "ADMIN" | "ATENDENTE" | "TECNICO";
export type TipoEquipamento = "CELULAR" | "TABLET" | "NOTEBOOK" | "DESKTOP" | "OUTRO";
export type StatusOS =
  | "RECEBIDO"
  | "EM_DIAGNOSTICO"
  | "AGUARDANDO_APROVACAO"
  | "EM_REPARO"
  | "EM_TESTES"
  | "FINALIZADO"
  | "ENTREGUE"
  | "CANCELADO";
export type Avaliacao = "DENTRO_DO_ESPERADO" | "ABAIXO_DO_ESPERADO" | "ACIMA_DO_ESPERADO" | "INDEFINIDO";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface Empresa {
  id: number;
  nome: string;
  telefone: string | null;
}

export interface MembroEquipe extends Usuario {
  ativo: boolean;
}

export interface Painel {
  porStatus: Record<StatusOS, number>;
  emAberto: number;
  atrasadas: number;
  ultimos30Dias: { abertas: number; finalizadas: number };
  abertasPorTecnico: { tecnicoId: number | null; nome: string; quantidade: number }[];
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  dados: T[];
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  cpf: string | null;
  email: string | null;
  endereco: string | null;
}

export interface Equipamento {
  id: number;
  clienteId: number;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string | null;
  imei: string | null;
  cor: string | null;
  observacoes: string | null;
}

export interface ClienteDetalhe extends Cliente {
  equipamentos: Equipamento[];
  ordens: { id: number; numero: number; status: StatusOS; createdAt: string; equipamentoId: number }[];
}

export interface OrdemResumo {
  id: number;
  numero: number; // sequência própria de cada empresa
  status: StatusOS;
  defeitoRelatado: string;
  previsaoEntrega: string | null;
  createdAt: string;
  cliente: { id: number; nome: string; telefone: string };
  equipamento: { id: number; tipo: TipoEquipamento; marca: string; modelo: string; imei: string | null };
  tecnico: { id: number; nome: string } | null;
}

export interface SessaoResumo {
  id: number;
  sintoma: string;
  status: "ATIVA" | "CONCLUIDA";
  diagnosticoFinal: string | null;
  createdAt: string;
}

export interface OrdemDetalhe extends OrdemResumo {
  acessorios: string | null;
  valorOrcamento: string | number | null; // Decimal chega como texto no JSON
  observacoes: string | null;
  finalizadaEm: string | null;
  entregueEm: string | null;
  atendente: { id: number; nome: string };
  historico: {
    id: number;
    de: StatusOS | null;
    para: StatusOS;
    observacao: string | null;
    createdAt: string;
    usuario: { id: number; nome: string };
  }[];
  sessoes: SessaoResumo[];
  reparos: {
    id: number;
    descricao: string;
    pecasUtilizadas: string | null;
    valorFinal: string | number | null;
    createdAt: string;
    tecnico: { id: number; nome: string };
  }[];
  proximosStatus: StatusOS[];
}

export interface CausaPossivel {
  causa: string;
  probabilidade: "alta" | "media" | "baixa";
  justificativa?: string;
}

export interface Orientacao {
  mensagem: string;
  causasPossiveis: CausaPossivel[];
  proximaEtapa: {
    titulo: string;
    procedimento: string;
    instrumento?: string;
    pontoMedicao?: string;
    resultadoEsperado?: string;
  } | null;
  interpretacaoUltimoResultado: string | null;
  avaliacaoUltimaMedicao: Avaliacao | null;
  diagnosticoConcluido: boolean;
  diagnosticoSugerido: string | null;
  alertasSeguranca: string[];
}

export interface Medicao {
  id: number;
  pontoMedicao: string;
  grandeza: string;
  valor: string | number;
  unidade: string;
  resultadoEsperado: string | null;
  avaliacao: Avaliacao;
}

export interface SessaoDiagnostico extends SessaoResumo {
  osId: number;
  os: { numero: number };
  causasPossiveis: CausaPossivel[] | null;
  concluidaEm: string | null;
  tecnico: { id: number; nome: string };
  mensagens: {
    id: number;
    autor: "TECNICO" | "IA";
    conteudo: string;
    dadosEstruturados: Orientacao | null;
    createdAt: string;
  }[];
  medicoes: Medicao[];
}

// ---------- Sessão ----------

const CHAVE_SESSAO = "inforcell.sessao";

interface Sessao {
  token: string;
  usuario: Usuario;
  empresa: Empresa;
}

/** A sessão fica em sessionStorage: some ao fechar a aba, o que é mais seguro em balcão compartilhado. */
let sessao: Sessao | null = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "null") as Sessao | null;
  } catch {
    return null;
  }
})();

function gravarSessao(nova: Sessao | null): void {
  sessao = nova;
  try {
    if (nova) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(nova));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* sem armazenamento, a sessão vale só até recarregar a página */
  }
}

export const usuarioAtual = (): Usuario | null => sessao?.usuario ?? null;
export const empresaAtual = (): Empresa | null => sessao?.empresa ?? null;

let aoExpirar: () => void = () => undefined;
/** Define o que fazer quando a API recusa o token (sessão expirada ou inválida). */
export function definirAoExpirar(fn: () => void): void {
  aoExpirar = fn;
}

// ---------- Erros ----------

export class ErroApi extends Error {
  constructor(
    public readonly status: number, // 0 = sem resposta da API
    mensagem: string,
    public readonly detalhes: string[] = [],
  ) {
    super(mensagem);
  }
}

/** A API devolve { erro, detalhes }, em que detalhes pode listar os campos inválidos. */
function erroDaResposta(status: number, corpo: unknown): ErroApi {
  const c = (corpo ?? {}) as { erro?: unknown; detalhes?: unknown };
  const mensagem = typeof c.erro === "string" ? c.erro : `A API respondeu com o erro ${status}.`;
  const detalhes = Array.isArray(c.detalhes)
    ? c.detalhes
        .filter((d): d is { campo: string; mensagem: string } => typeof d === "object" && d !== null && "mensagem" in d)
        .map((d) => (d.campo ? `${d.campo}: ${d.mensagem}` : d.mensagem))
    : [];
  return new ErroApi(status, mensagem, detalhes);
}

// ---------- Requisições ----------

async function enviar(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (sessao) cabecalhos.Authorization = `Bearer ${sessao.token}`;

  let resposta: Response;
  try {
    resposta = await fetch(`${urlApi()}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(
      0,
      `Não foi possível conectar à API em ${urlApi()}. Confira se ela está rodando e se esta origem está liberada em CORS_ORIGIN.`,
    );
  }

  if (!resposta.ok) {
    const dados: unknown = await resposta.json().catch(() => null);
    // Sem sessão, o 401 é apenas login recusado e a tela de login mostra a mensagem.
    if (resposta.status === 401 && sessao) {
      gravarSessao(null);
      aoExpirar();
    }
    throw erroDaResposta(resposta.status, dados);
  }
  return resposta;
}

async function json<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await enviar(metodo, caminho, corpo);
  return (resposta.status === 204 ? undefined : await resposta.json()) as T;
}

export const api = {
  get: <T>(caminho: string) => json<T>("GET", caminho),
  post: <T>(caminho: string, corpo?: unknown) => json<T>("POST", caminho, corpo ?? {}),
  patch: <T>(caminho: string, corpo: unknown) => json<T>("PATCH", caminho, corpo),
  /** Para respostas em HTML, como o comprovante da OS. */
  texto: async (caminho: string): Promise<string> => (await enviar("GET", caminho)).text(),
};

export async function entrar(email: string, senha: string): Promise<Usuario> {
  gravarSessao(null);
  const r = await api.post<Sessao>("/auth/login", { email, senha });
  gravarSessao({ token: r.token, usuario: r.usuario, empresa: r.empresa });
  return r.usuario;
}

export interface DadosCadastro {
  nomeEmpresa: string;
  telefoneEmpresa: string | null;
  nome: string;
  email: string;
  senha: string;
}

/** Cria a empresa e o administrador dela, e já deixa a sessão aberta. */
export async function cadastrarEmpresa(dados: DadosCadastro): Promise<void> {
  gravarSessao(null);
  const r = await api.post<Sessao>("/auth/cadastro", dados);
  gravarSessao({ token: r.token, usuario: r.usuario, empresa: r.empresa });
}

export function sair(): void {
  gravarSessao(null);
}

/** Confere o token salvo. Se a API estiver fora do ar, mantém a sessão e a tela mostra o erro. */
export async function validarSessao(): Promise<void> {
  if (!sessao) return;
  try {
    const { empresa, id, nome, email, perfil } = await api.get<Usuario & { empresa: Empresa }>("/auth/me");
    if (sessao) gravarSessao({ token: sessao.token, usuario: { id, nome, email, perfil }, empresa });
  } catch {
    /* 401 já encerrou a sessão em enviar(); outros erros aparecem na tela seguinte */
  }
}

export interface Saude {
  status: string;
  ia: boolean;
}

/** Consulta /health sem autenticação; devolve null se a API não responder. */
export async function consultarSaude(): Promise<Saude | null> {
  try {
    const r = await fetch(`${urlApi()}/health`);
    return r.ok ? ((await r.json()) as Saude) : null;
  } catch {
    return null;
  }
}

// ---------- Permissões (espelham os perfis da API) ----------

const perfilEh = (...perfis: Perfil[]): boolean => {
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
  gerirEquipe: () => perfilEh("ADMIN"),
};
