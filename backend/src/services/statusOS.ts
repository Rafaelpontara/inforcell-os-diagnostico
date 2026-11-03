import { Perfil, StatusOS } from "@prisma/client";

/**
 * Fluxo de status da Ordem de Serviço (Seção 14 / Figura 1 do Documento Técnico).
 * Para cada status, lista os próximos status permitidos.
 */
export const TRANSICOES: Record<StatusOS, StatusOS[]> = {
  RECEBIDO: ["EM_DIAGNOSTICO", "CANCELADO"],
  EM_DIAGNOSTICO: ["AGUARDANDO_APROVACAO", "CANCELADO"],
  AGUARDANDO_APROVACAO: ["EM_REPARO", "CANCELADO"],
  EM_REPARO: ["EM_TESTES"],
  EM_TESTES: ["FINALIZADO", "EM_REPARO"],
  FINALIZADO: ["ENTREGUE"],
  CANCELADO: ["ENTREGUE"], // equipamento devolvido sem reparo
  ENTREGUE: [],
};

/** Quem pode levar a OS para cada status. */
const PERFIS_POR_DESTINO: Record<StatusOS, Perfil[]> = {
  RECEBIDO: [],
  EM_DIAGNOSTICO: ["TECNICO", "ADMIN"],
  AGUARDANDO_APROVACAO: ["TECNICO", "ADMIN"],
  EM_REPARO: ["ATENDENTE", "TECNICO", "ADMIN"], // aprovação do cliente registrada no balcão
  EM_TESTES: ["TECNICO", "ADMIN"],
  FINALIZADO: ["TECNICO", "ADMIN"],
  ENTREGUE: ["ATENDENTE", "ADMIN"],
  CANCELADO: ["ATENDENTE", "TECNICO", "ADMIN"],
};

export function transicaoPermitida(de: StatusOS, para: StatusOS): boolean {
  return TRANSICOES[de].includes(para);
}

export function perfilPodeMover(perfil: Perfil, para: StatusOS): boolean {
  return PERFIS_POR_DESTINO[para].includes(perfil);
}

export const ROTULO_STATUS: Record<StatusOS, string> = {
  RECEBIDO: "Recebido",
  EM_DIAGNOSTICO: "Em diagnóstico",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  EM_REPARO: "Em reparo",
  EM_TESTES: "Em testes",
  FINALIZADO: "Finalizado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};
