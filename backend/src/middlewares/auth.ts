import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Perfil } from "@prisma/client";
import { env } from "../config/env";
import { AppError, forbidden } from "../utils/http";

export interface UsuarioToken {
  id: number;
  empresaId: number;
  nome: string;
  perfil: Perfil;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export function gerarToken(u: UsuarioToken): string {
  return jwt.sign({ nome: u.nome, perfil: u.perfil, empresaId: u.empresaId }, env.JWT_SECRET, {
    subject: String(u.id),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** RNF02 — exige token JWT válido no cabeçalho Authorization: Bearer <token> */
export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "Token de acesso não informado.");
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    // Token sem empresa (emitido antes da separação por empresa) não é aceito.
    if (!Number.isInteger(payload.empresaId) || payload.empresaId <= 0) throw new Error("Token sem empresa");
    req.usuario = { id: Number(payload.sub), empresaId: payload.empresaId, nome: payload.nome, perfil: payload.perfil };
  } catch {
    throw new AppError(401, "Token inválido ou expirado.");
  }
  next();
}

/** RNF03 — restringe a rota aos perfis informados */
export function autorizar(...perfis: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) throw new AppError(401, "Não autenticado.");
    if (!perfis.includes(req.usuario.perfil)) throw forbidden();
    next();
  };
}

export function usuarioAtual(req: Request): UsuarioToken {
  if (!req.usuario) throw new AppError(401, "Não autenticado.");
  return req.usuario;
}
