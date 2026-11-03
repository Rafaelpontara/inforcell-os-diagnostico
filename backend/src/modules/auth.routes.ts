import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autenticar, gerarToken, usuarioAtual } from "../middlewares/auth";
import { AppError } from "../utils/http";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

/** HU01 — Acessar o sistema */
authRoutes.post("/login", async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);
  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
  const ok = usuario && usuario.ativo && (await bcrypt.compare(senha, usuario.senhaHash));
  if (!ok) throw new AppError(401, "E-mail ou senha inválidos.");
  const token = gerarToken({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil });
  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  });
});

authRoutes.get("/me", autenticar, async (req, res) => {
  const u = usuarioAtual(req);
  const usuario = await prisma.usuario.findUnique({
    where: { id: u.id },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true },
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
