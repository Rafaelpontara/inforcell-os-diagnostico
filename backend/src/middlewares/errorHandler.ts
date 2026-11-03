import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/http";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: "Dados inválidos.",
      detalhes: err.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ erro: "Registro duplicado.", detalhes: err.meta?.target });
    }
    if (err.code === "P2025") return res.status(404).json({ erro: "Registro não encontrado." });
    if (err.code === "P2003") return res.status(400).json({ erro: "Referência inválida (registro relacionado não existe)." });
  }
  if (err instanceof SyntaxError && "body" in (err as object)) {
    return res.status(400).json({ erro: "JSON malformado." });
  }
  console.error(err);
  return res.status(500).json({ erro: "Erro interno do servidor." });
}
