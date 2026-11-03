import { Router } from "express";
import { z } from "zod";
import { TipoEquipamento } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar } from "../middlewares/auth";
import { notFound, parseId } from "../utils/http";

/** RF04, RF19 — equipamentos e seu histórico */
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
      where: { clienteId },
      include: { cliente: { select: { id: true, nome: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  );
});

equipamentosRoutes.get("/:id", async (req, res) => {
  const eq = await prisma.equipamento.findUnique({
    where: { id: parseId(req.params.id) },
    include: { cliente: { select: { id: true, nome: true, telefone: true } } },
  });
  if (!eq) throw notFound("Equipamento");
  res.json(eq);
});

/** HU04/HU06 — histórico completo do equipamento: OS, diagnósticos, medições e reparos */
equipamentosRoutes.get("/:id/historico", async (req, res) => {
  const id = parseId(req.params.id);
  const eq = await prisma.equipamento.findUnique({ where: { id } });
  if (!eq) throw notFound("Equipamento");
  const ordens = await prisma.ordemServico.findMany({
    where: { equipamentoId: id },
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
  const dados = equipamentoSchema.parse(req.body);
  res.status(201).json(await prisma.equipamento.create({ data: dados }));
});

equipamentosRoutes.patch("/:id", autorizar("ADMIN", "ATENDENTE", "TECNICO"), async (req, res) => {
  const dados = equipamentoSchema.omit({ clienteId: true }).partial().parse(req.body);
  res.json(await prisma.equipamento.update({ where: { id: parseId(req.params.id) }, data: dados }));
});
