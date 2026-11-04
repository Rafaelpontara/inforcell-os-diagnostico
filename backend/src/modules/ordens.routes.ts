import { Router } from "express";
import { z } from "zod";
import { AvaliacaoMedicao, OrdemServico, Prisma, StatusOS } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual, UsuarioToken } from "../middlewares/auth";
import { AppError, forbidden, notFound, paginacao, parseId } from "../utils/http";
import { perfilPodeMover, transicaoPermitida, TRANSICOES } from "../services/statusOS";
import { renderComprovante } from "../services/comprovante";

/** RF05–RF08, RF14, RF18, RF20, RF21 — Ordens de Serviço */
export const ordensRoutes = Router();

/** Técnico só acessa OS atribuídas a ele ou ainda sem técnico. */
export function garantirAcesso(os: Pick<OrdemServico, "tecnicoId">, u: UsuarioToken) {
  if (u.perfil === "TECNICO" && os.tecnicoId !== null && os.tecnicoId !== u.id) {
    throw forbidden("Esta OS está atribuída a outro técnico.");
  }
}

/** OS de outra empresa responde como inexistente, sem revelar que o registro existe. */
export async function buscarOS(id: number, u: UsuarioToken) {
  const os = await prisma.ordemServico.findFirst({ where: { id, empresaId: u.empresaId } });
  if (!os) throw notFound("Ordem de Serviço");
  garantirAcesso(os, u);
  return os;
}

const criarSchema = z.object({
  clienteId: z.number().int().positive(),
  equipamentoId: z.number().int().positive(),
  defeitoRelatado: z.string().min(3),
  acessorios: z.string().max(255).optional().nullable(),
  tecnicoId: z.number().int().positive().optional().nullable(),
  previsaoEntrega: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const atualizarSchema = z.object({
  defeitoRelatado: z.string().min(3).optional(),
  acessorios: z.string().max(255).optional().nullable(),
  valorOrcamento: z.number().nonnegative().optional().nullable(),
  previsaoEntrega: z.coerce.date().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

const listaInclude = {
  cliente: { select: { id: true, nome: true, telefone: true } },
  equipamento: { select: { id: true, tipo: true, marca: true, modelo: true, imei: true } },
  tecnico: { select: { id: true, nome: true } },
} satisfies Prisma.OrdemServicoInclude;

// ---------- Listagem e busca (RF21, HU08) ----------
ordensRoutes.get("/", async (req, res) => {
  const u = usuarioAtual(req);
  const { skip, take, pagina, porPagina } = paginacao(req.query);
  const q = req.query;
  const filtros: Prisma.OrdemServicoWhereInput[] = [{ empresaId: u.empresaId }];

  if (typeof q.status === "string") {
    const lista = q.status.split(",").filter((s): s is StatusOS => s in TRANSICOES);
    if (lista.length) filtros.push({ status: { in: lista } });
  }
  if (q.tecnicoId) filtros.push({ tecnicoId: parseId(q.tecnicoId) });
  if (q.de) filtros.push({ createdAt: { gte: new Date(String(q.de)) } });
  if (q.ate) filtros.push({ createdAt: { lte: new Date(String(q.ate)) } });
  if (typeof q.busca === "string" && q.busca.trim()) {
    const b = q.busca.trim();
    const numero = Number(b.replace(/^OS-?/i, ""));
    filtros.push({
      OR: [
        ...(Number.isInteger(numero) && numero > 0 ? [{ numero }] : []),
        { cliente: { nome: { contains: b } } },
        { cliente: { telefone: { contains: b.replace(/\D/g, "") || b } } },
        { equipamento: { imei: { contains: b } } },
        { equipamento: { numeroSerie: { contains: b } } },
        { equipamento: { modelo: { contains: b } } },
      ],
    });
  }
  // HU04 — técnico vê as suas OS e a fila ainda não atribuída
  if (u.perfil === "TECNICO") filtros.push({ OR: [{ tecnicoId: u.id }, { tecnicoId: null }] });

  const where: Prisma.OrdemServicoWhereInput = { AND: filtros };
  const [total, dados] = await Promise.all([
    prisma.ordemServico.count({ where }),
    prisma.ordemServico.findMany({ where, skip, take, include: listaInclude, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ total, pagina, porPagina, dados });
});

// ---------- Detalhes (RF08) ----------
ordensRoutes.get("/:id", async (req, res) => {
  const u = usuarioAtual(req);
  const os = await prisma.ordemServico.findFirst({
    where: { id: parseId(req.params.id), empresaId: u.empresaId },
    include: {
      ...listaInclude,
      cliente: true,
      atendente: { select: { id: true, nome: true } },
      historico: { include: { usuario: { select: { id: true, nome: true } } }, orderBy: { createdAt: "asc" } },
      sessoes: { select: { id: true, sintoma: true, status: true, diagnosticoFinal: true, createdAt: true } },
      medicoes: { orderBy: { createdAt: "asc" } },
      reparos: { include: { tecnico: { select: { id: true, nome: true } } } },
    },
  });
  if (!os) throw notFound("Ordem de Serviço");
  garantirAcesso(os, u);
  res.json({ ...os, proximosStatus: TRANSICOES[os.status].filter((s) => perfilPodeMover(u.perfil, s)) });
});

// ---------- Criação (RF05, HU03) ----------
ordensRoutes.post("/", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  const u = usuarioAtual(req);
  const dados = criarSchema.parse(req.body);
  const eq = await prisma.equipamento.findFirst({ where: { id: dados.equipamentoId, empresaId: u.empresaId } });
  if (!eq) throw notFound("Equipamento");
  if (eq.clienteId !== dados.clienteId) throw new AppError(400, "O equipamento não pertence a este cliente.");
  if (dados.tecnicoId) await validarTecnico(dados.tecnicoId, u.empresaId);

  const os = await prisma.$transaction(async (tx) => {
    // O incremento trava a linha da empresa, então duas OS simultâneas não repetem o número.
    const { ultimoNumeroOS } = await tx.empresa.update({
      where: { id: u.empresaId },
      data: { ultimoNumeroOS: { increment: 1 } },
      select: { ultimoNumeroOS: true },
    });
    return tx.ordemServico.create({
      data: {
        ...dados,
        empresaId: u.empresaId,
        numero: ultimoNumeroOS,
        atendenteId: u.id,
        historico: { create: { usuarioId: u.id, de: null, para: "RECEBIDO", observacao: "Abertura da OS" } },
      },
      include: listaInclude,
    });
  });
  res.status(201).json(os);
});

ordensRoutes.patch("/:id", async (req, res) => {
  const u = usuarioAtual(req);
  const os = await buscarOS(parseId(req.params.id), u);
  if (os.status === "ENTREGUE") throw new AppError(409, "OS já entregue não pode ser alterada.");
  const dados = atualizarSchema.parse(req.body);
  res.json(await prisma.ordemServico.update({ where: { id: os.id }, data: dados, include: listaInclude }));
});

// ---------- Atribuir técnico (RF07) ----------
async function validarTecnico(id: number, empresaId: number) {
  const t = await prisma.usuario.findFirst({ where: { id, empresaId } });
  if (!t || t.perfil !== "TECNICO" || !t.ativo) throw new AppError(400, "Técnico inválido ou inativo.");
}

ordensRoutes.patch("/:id/atribuir", async (req, res) => {
  const u = usuarioAtual(req);
  const { tecnicoId } = z.object({ tecnicoId: z.number().int().positive() }).parse(req.body);
  const os = await buscarOS(parseId(req.params.id), u);
  // técnico pode apenas assumir para si uma OS livre
  if (u.perfil === "TECNICO" && tecnicoId !== u.id) throw forbidden("Técnico só pode assumir OS para si.");
  await validarTecnico(tecnicoId, u.empresaId);
  res.json(await prisma.ordemServico.update({ where: { id: os.id }, data: { tecnicoId }, include: listaInclude }));
});

// ---------- Alterar status (RF06, Seção 14) ----------
ordensRoutes.patch("/:id/status", async (req, res) => {
  const u = usuarioAtual(req);
  const { status, observacao } = z
    .object({ status: z.nativeEnum(StatusOS), observacao: z.string().max(255).optional() })
    .parse(req.body);
  const os = await buscarOS(parseId(req.params.id), u);

  if (!transicaoPermitida(os.status, status)) {
    throw new AppError(409, `Transição inválida: ${os.status} → ${status}.`, { permitidos: TRANSICOES[os.status] });
  }
  if (!perfilPodeMover(u.perfil, status)) throw forbidden(`Seu perfil não pode mover a OS para ${status}.`);
  if (status === "EM_DIAGNOSTICO" && !os.tecnicoId) {
    throw new AppError(409, "Atribua um técnico antes de iniciar o diagnóstico.");
  }
  if (status === "AGUARDANDO_APROVACAO" && os.valorOrcamento === null) {
    throw new AppError(409, "Informe o valor do orçamento antes de enviar para aprovação.");
  }
  if (status === "EM_TESTES") {
    const reparos = await prisma.reparo.count({ where: { osId: os.id } });
    if (!reparos) throw new AppError(409, "Registre o reparo realizado antes de enviar para testes.");
  }

  const atualizada = await prisma.ordemServico.update({
    where: { id: os.id },
    data: {
      status,
      ...(status === "FINALIZADO" ? { finalizadaEm: new Date() } : {}),
      ...(status === "ENTREGUE" ? { entregueEm: new Date() } : {}),
      historico: { create: { usuarioId: u.id, de: os.status, para: status, observacao } },
    },
    include: listaInclude,
  });
  res.json(atualizada);
});

// ---------- Medições avulsas (RF14) ----------
export const medicaoSchema = z.object({
  pontoMedicao: z.string().min(1).max(120),
  grandeza: z.string().min(1).max(40), // ex.: tensão, corrente, resistência
  valor: z.number(),
  unidade: z.string().min(1).max(10), // ex.: V, mA, Ω
  resultadoEsperado: z.string().max(120).optional().nullable(),
  avaliacao: z.nativeEnum(AvaliacaoMedicao).optional(),
  observacao: z.string().max(255).optional().nullable(),
});

ordensRoutes.post("/:id/medicoes", autorizar("TECNICO", "ADMIN"), async (req, res) => {
  const u = usuarioAtual(req);
  const os = await buscarOS(parseId(req.params.id), u);
  const dados = medicaoSchema.parse(req.body);
  res.status(201).json(await prisma.medicao.create({ data: { ...dados, osId: os.id } }));
});

// ---------- Reparo (RF18, HU07) ----------
const reparoSchema = z.object({
  descricao: z.string().min(3),
  pecasUtilizadas: z.string().optional().nullable(),
  valorFinal: z.number().nonnegative().optional().nullable(),
});

ordensRoutes.post("/:id/reparos", autorizar("TECNICO", "ADMIN"), async (req, res) => {
  const u = usuarioAtual(req);
  const os = await buscarOS(parseId(req.params.id), u);
  if (os.status !== "EM_REPARO" && os.status !== "EM_TESTES") {
    throw new AppError(409, "O reparo só pode ser registrado com a OS em EM_REPARO ou EM_TESTES.");
  }
  const dados = reparoSchema.parse(req.body);
  res.status(201).json(await prisma.reparo.create({ data: { ...dados, osId: os.id, tecnicoId: u.id } }));
});

// ---------- Comprovante para o cliente (RF20) ----------
ordensRoutes.get("/:id/comprovante", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  const os = await prisma.ordemServico.findFirst({
    where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
    include: {
      empresa: { select: { nome: true, telefone: true } },
      cliente: true,
      equipamento: true,
      reparos: true,
      atendente: { select: { nome: true } },
    },
  });
  if (!os) throw notFound("Ordem de Serviço");
  res.type("html").send(renderComprovante(os));
});
