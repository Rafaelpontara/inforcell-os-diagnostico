import { Router } from "express";
import { z } from "zod";
import { TipoEquipamento } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual } from "../middlewares/auth";
import { notFound, paginacao, parseId } from "../utils/http";

/** Seção 17 — Base de conhecimento técnico, própria de cada empresa */
export const conhecimentoRoutes = Router();

const artigoSchema = z.object({
  titulo: z.string().min(3).max(160),
  tipoEquipamento: z.nativeEnum(TipoEquipamento).optional().nullable(),
  marca: z.string().max(60).optional().nullable(),
  modelo: z.string().max(80).optional().nullable(),
  sintoma: z.string().min(3).max(255),
  conteudo: z.string().min(10),
  tags: z.string().max(255).optional().nullable(),
});

conhecimentoRoutes.get("/", async (req, res) => {
  const { skip, take, pagina, porPagina } = paginacao(req.query);
  const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : "";
  const tipo = req.query.tipo as TipoEquipamento | undefined;
  const where = {
    empresaId: usuarioAtual(req).empresaId,
    ...(tipo && tipo in TipoEquipamento ? { tipoEquipamento: tipo } : {}),
    ...(busca
      ? {
          OR: [
            { titulo: { contains: busca } },
            { sintoma: { contains: busca } },
            { modelo: { contains: busca } },
            { tags: { contains: busca } },
          ],
        }
      : {}),
  };
  const [total, dados] = await Promise.all([
    prisma.artigoConhecimento.count({ where }),
    prisma.artigoConhecimento.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }),
  ]);
  res.json({ total, pagina, porPagina, dados });
});

conhecimentoRoutes.get("/:id", async (req, res) => {
  const a = await prisma.artigoConhecimento.findFirst({
    where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
  });
  if (!a) throw notFound("Artigo");
  res.json(a);
});

conhecimentoRoutes.post("/", autorizar("ADMIN", "TECNICO"), async (req, res) => {
  const dados = artigoSchema.parse(req.body);
  res.status(201).json(await prisma.artigoConhecimento.create({ data: { ...dados, empresaId: usuarioAtual(req).empresaId } }));
});

conhecimentoRoutes.patch("/:id", autorizar("ADMIN", "TECNICO"), async (req, res) => {
  const dados = artigoSchema.partial().parse(req.body);
  res.json(
    await prisma.artigoConhecimento.update({
      where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId },
      data: dados,
    }),
  );
});

conhecimentoRoutes.delete("/:id", autorizar("ADMIN"), async (req, res) => {
  await prisma.artigoConhecimento.delete({ where: { id: parseId(req.params.id), empresaId: usuarioAtual(req).empresaId } });
  res.status(204).end();
});
