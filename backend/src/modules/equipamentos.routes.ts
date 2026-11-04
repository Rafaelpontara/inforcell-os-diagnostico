import { Router } from "express";
import { z } from "zod";
import { TipoEquipamento } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual } from "../middlewares/auth";
import { notFound, parseId } from "../utils/http";

/** RF04, RF19 — equipamentos e seu histórico, sempre dentro da empresa do usuário */
export const equipamentosRoutes = Router();

const equipamentoSchema = z.object({
  clienteId: z.number().int().positive(),
  tipo: z.nativeEnum(TipoEquipamento),
  marca: z.string().min(1).max(60),
  modelo: z.string().min(1).max(80),
  numeroSerie: z.string().max(80).optional().nullable(),
  imei: z
    .string()
    .regex(/^\d{14,16}$/, "IMEI deve ter de 14 a 16 dígitos")
    .optional()
    .nullable(),
  cor: z.string().max(40).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

equipamentosRoutes.get("/", async (req, res) => {
  const clienteId = req.query.clienteId ? parseId(req.query.clienteId) : undefined;
  res.json(
    await prisma.equipamento.findMany({
      where: { empresaId: usuarioAtual(req).empresaId, clienteId },
      include: { cliente: { select: { id: true, nome: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
});

equipamentosRoutes.get("/:id", async (req, res) => {
  const eq = await prisma.equipamento.findFirst({
    where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
    include: { cliente: { select: { id: true, nome: true, telefone: true } } },
  });
  if (!eq) throw notFound("Equipamento");
  res.json(eq);
});

/** HU04/HU06 — histórico completo do equipamento: OS, diagnósticos, medições e reparos */
equipamentosRoutes.get("/:id/historico", async (req, res) => {
  const { empresaId } = usuarioAtual(req);
  const id = parseId(req.params.id);
  const eq = await prisma.equipamento.findFirst({ where: { id, empresaId } });
  if (!eq) throw notFound("Equipamento");
  const ordens = await prisma.ordemServico.findMany({
    where: { equipamentoId: id, empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      tecnico: { select: { id: true, nome: true } },
      sessoes: { select: { id: true, sintoma: true, diagnosticoFinal: true, status: true, createdAt: true } },
      medicoes: true,
      reparos: true,
    },
  });
  res.json({ equipamento: eq, ordens });
});

equipamentosRoutes.post("/", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  const { empresaId } = usuarioAtual(req);
  const dados = equipamentoSchema.parse(req.body);
  const cliente = await prisma.cliente.findFirst({ where: { id: dados.clienteId, empresaId }, select: { id: true } });
  if (!cliente) throw notFound("Cliente");
  res.status(201).json(await prisma.equipamento.create({ data: { ...dados, empresaId } }));
});

equipamentosRoutes.patch("/:id", autorizar("ADMIN", "ATENDENTE", "TECNICO"), async (req, res) => {
  const dados = equipamentoSchema.omit({ clienteId: true }).partial().parse(req.body);
  res.json(
    await prisma.equipamento.update({
      where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
      data: dados,
    }),
  );
});
