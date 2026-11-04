import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { autenticar, gerarToken, usuarioAtual } from "../middlewares/auth";
import { AppError } from "../utils/http";

export const authRoutes = Router();

/** Limita tentativas por IP nas rotas públicas: dificulta adivinhar senhas e criar contas em massa. */
const limitar = (limit: number, minutos: number) =>
  rateLimit({
    windowMs: minutos * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    message: { erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
  });

const empresaPublica = { id: true, nome: true, telefone: true } as const;

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

/** HU01 — Acessar o sistema */
authRoutes.post("/login", limitar(20, 15), async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
    include: { empresa: { select: empresaPublica } },
  });
  const ok = usuario && usuario.ativo && (await bcrypt.compare(senha, usuario.senhaHash));
  if (!ok) throw new AppError(401, "E-mail ou senha inválidos.");
  const token = gerarToken({ id: usuario.id, empresaId: usuario.empresaId, nome: usuario.nome, perfil: usuario.perfil });
  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    empresa: usuario.empresa,
  });
});

const cadastroSchema = z.object({
  nomeEmpresa: z.string().trim().min(2, "Informe o nome da assistência").max(120),
  telefoneEmpresa: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 11), "Telefone inválido")
    .transform((v) => v || null)
    .optional()
    .nullable(),
  nome: z.string().trim().min(2, "Informe o nome do responsável").max(120),
  email: z.string().email("E-mail inválido").max(160),
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72, "A senha deve ter no máximo 72 caracteres"),
});

/** Cadastro público: cria uma nova empresa e o administrador dela, já autenticado. */
authRoutes.post("/cadastro", limitar(10, 60), async (req, res) => {
  const d = cadastroSchema.parse(req.body);
  const senhaHash = await bcrypt.hash(d.senha, 10);
  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome: d.nome,
        email: d.email.toLowerCase(),
        senhaHash,
        perfil: "ADMIN",
        empresa: { create: { nome: d.nomeEmpresa, telefone: d.telefoneEmpresa ?? null } },
      },
      include: { empresa: { select: empresaPublica } },
    });
    const token = gerarToken({ id: usuario.id, empresaId: usuario.empresaId, nome: usuario.nome, perfil: usuario.perfil });
    res.status(201).json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      empresa: usuario.empresa,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError(409, "Este e-mail já está em uso.");
    }
    throw e;
  }
});

authRoutes.get("/me", autenticar, async (req, res) => {
  const u = usuarioAtual(req);
  const usuario = await prisma.usuario.findFirst({
    where: { id: u.id, empresaId: u.empresaId, ativo: true },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true, empresa: { select: empresaPublica } },
  });
  if (!usuario) throw new AppError(401, "Usuário não encontrado.");
  res.json(usuario);
});

const trocaSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres"),
});

authRoutes.patch("/me/senha", autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = trocaSenhaSchema.parse(req.body);
  const u = usuarioAtual(req);
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) throw new AppError(400, "Senha atual incorreta.");
  await prisma.usuario.update({ where: { id: u.id }, data: { senhaHash: await bcrypt.hash(novaSenha, 10) } });
  res.status(204).end();
});
