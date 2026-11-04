import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual } from "../middlewares/auth";
import { notFound, paginacao, parseId } from "../utils/http";

/** RF03 — cadastro de clientes (HU02), sempre dentro da empresa do usuário */
export const clientesRoutes = Router();

const soDigitos = (v: string) => v.replace(/\D/g, "");

const clienteSchema = z.object({
  nome: z.string().min(2).max(120),
  cpf: z
    .string()
    .transform(soDigitos)
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos")
    .optional()
    .nullable(),
  telefone: z.string().transform(soDigitos).refine((v) => v.length >= 10 && v.length <= 11, "Telefone inválido"),
  email: z.string().email().optional().nullable(),
  endereco: z.string().max(255).optional().nullable(),
});

clientesRoutes.get("/", async (req, res) => {
  const { empresaId } = usuarioAtual(req);
  const { skip, take, pagina, porPagina } = paginacao(req.query);
  const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
  const digitos = soDigitos(busca);
  const where = {
    empresaId,
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca } },
            ...(digitos ? [{ cpf: { contains: digitos } }, { telefone: { contains: digitos } }] : []),
          ],
        }
      : {}),
  };
  const [total, dados] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({ where, skip, take, orderBy: { nome: "asc" } }),
  ]);
  res.json({ total, pagina, porPagina, dados });
});

clientesRoutes.get("/:id", async (req, res) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
    include: {
      equipamentos: true,
      ordens: {
        select: { id: true, numero: true, status: true, createdAt: true, equipamentoId: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!cliente) throw notFound("Cliente");
  res.json(cliente);
});

clientesRoutes.post("/", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  const dados = clienteSchema.parse(req.body);
  res.status(201).json(await prisma.cliente.create({ data: { ...dados, empresaId: usuarioAtual(req).empresaId } }));
});

clientesRoutes.patch("/:id", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  const dados = clienteSchema.partial().parse(req.body);
  res.json(
    await prisma.cliente.update({
      where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
      data: dados,
    }),
  );
});
