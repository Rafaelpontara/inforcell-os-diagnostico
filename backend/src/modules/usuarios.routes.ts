import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Perfil } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar } from "../middlewares/auth";
import { parseId } from "../utils/http";

/** RF01, RF02 — gestão de usuários (somente administrador) */
export const usuariosRoutes = Router();

const publico = { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true } as const;

const criarSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(160),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  perfil: z.nativeEnum(Perfil),
});

const atualizarSchema = criarSchema.partial().extend({ ativo: z.boolean().optional() });

// Técnicos podem ser listados por atendentes para atribuir OS (RF07)
usuariosRoutes.get("/tecnicos", autorizar("ADMIN", "ATENDENTE"), async (_req, res) => {
  res.json(
    await prisma.usuario.findMany({
      where: { perfil: "TECNICO", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  );
});

usuariosRoutes.use(autorizar("ADMIN"));

usuariosRoutes.get("/", async (_req, res) => {
  res.json(await prisma.usuario.findMany({ select: publico, orderBy: { nome: "asc" } }));
});

usuariosRoutes.post("/", async (req, res) => {
  const { senha, ...dados } = criarSchema.parse(req.body);
  const usuario = await prisma.usuario.create({
    data: { ...dados, email: dados.email.toLowerCase(), senhaHash: await bcrypt.hash(senha, 10) },
    select: publico,
  });
  res.status(201).json(usuario);
});

usuariosRoutes.patch("/:id", async (req, res) => {
  const { senha, ...dados } = atualizarSchema.parse(req.body);
  const usuario = await prisma.usuario.update({
    where: { id: parseId(req.params.id) },
    data: {
      ...dados,
      ...(dados.email ? { email: dados.email.toLowerCase() } : {}),
      ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}),
    },
    select: publico,
  });
  res.json(usuario);
});
