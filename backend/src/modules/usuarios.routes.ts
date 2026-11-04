import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Perfil, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual } from "../middlewares/auth";
import { AppError, parseId } from "../utils/http";

/** RF01, RF02 — gestão dos usuários da empresa (somente administrador) */
export const usuariosRoutes = Router();

const publico = { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true } as const;

const criarSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(160),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72, "A senha deve ter no máximo 72 caracteres"),
  perfil: z.nativeEnum(Perfil),
});

const atualizarSchema = criarSchema.partial().extend({ ativo: z.boolean().optional() });

/** O e-mail identifica o login em todo o sistema, então não pode repetir nem entre empresas. */
function emailDuplicado(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return new AppError(409, "Este e-mail já está em uso.");
  }
  return e;
}

// Técnicos podem ser listados por atendentes para atribuir OS (RF07)
usuariosRoutes.get("/tecnicos", autorizar("ADMIN", "ATENDENTE"), async (req, res) => {
  res.json(
    await prisma.usuario.findMany({
      where: { empresaId: usuarioAtual(req).empresaId, perfil: "TECNICO", ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  );
});

usuariosRoutes.use(autorizar("ADMIN"));

usuariosRoutes.get("/", async (req, res) => {
  res.json(await prisma.usuario.findMany({ where: { empresaId: usuarioAtual(req).empresaId }, select: publico, orderBy: { nome: "asc" } }));
});

usuariosRoutes.post("/", async (req, res) => {
  const { senha, ...dados } = criarSchema.parse(req.body);
  const senhaHash = await bcrypt.hash(senha, 10);
  try {
    const usuario = await prisma.usuario.create({
      data: { ...dados, email: dados.email.toLowerCase(), senhaHash, empresaId: usuarioAtual(req).empresaId },
      select: publico,
    });
    res.status(201).json(usuario);
  } catch (e) {
    throw emailDuplicado(e);
  }
});

usuariosRoutes.patch("/:id", async (req, res) => {
  const u = usuarioAtual(req);
  const id = parseId(req.params.id);
  const { senha, ...dados } = atualizarSchema.parse(req.body);
  // Evita que a empresa fique sem administrador por engano.
  if (id === u.id && (dados.ativo === false || (dados.perfil && dados.perfil !== "ADMIN"))) {
    throw new AppError(400, "Você não pode desativar nem rebaixar a própria conta.");
  }
  try {
    const usuario = await prisma.usuario.update({
      where: { id, empresaId: u.empresaId },
      data: {
        ...dados,
        ...(dados.email ? { email: dados.email.toLowerCase() } : {}),
        ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}),
      },
      select: publico,
    });
    res.json(usuario);
  } catch (e) {
    throw emailDuplicado(e);
  }
});
