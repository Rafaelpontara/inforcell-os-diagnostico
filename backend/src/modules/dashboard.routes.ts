import { Router } from "express";
import { StatusOS } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { usuarioAtual } from "../middlewares/auth";

/** HU08 — painel de acompanhamento das Ordens de Serviço */
export const dashboardRoutes = Router();

const ABERTAS: StatusOS[] = ["RECEBIDO", "EM_DIAGNOSTICO", "AGUARDANDO_APROVACAO", "EM_REPARO", "EM_TESTES"];

dashboardRoutes.get("/", async (req, res) => {
  const u = usuarioAtual(req);
  const escopo = u.perfil === "TECNICO" ? { tecnicoId: u.id } : {};
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [porStatus, atrasadas, abertas30, finalizadas30, porTecnico] = await Promise.all([
    prisma.ordemServico.groupBy({ by: ["status"], where: escopo, _count: { _all: true } }),
    prisma.ordemServico.count({ where: { ...escopo, status: { in: ABERTAS }, previsaoEntrega: { lt: new Date() } } }),
    prisma.ordemServico.count({ where: { ...escopo, createdAt: { gte: trintaDias } } }),
    prisma.ordemServico.count({ where: { ...escopo, finalizadaEm: { gte: trintaDias } } }),
    u.perfil === "TECNICO"
      ? Promise.resolve([])
      : prisma.ordemServico.groupBy({
          by: ["tecnicoId"],
          where: { status: { in: ABERTAS } },
          _count: { _all: true },
        }),
  ]);

  const tecnicos = await prisma.usuario.findMany({
    where: { id: { in: porTecnico.map((t) => t.tecnicoId).filter((x): x is number => x !== null) } },
    select: { id: true, nome: true },
  });

  const contagem = Object.fromEntries(Object.values(StatusOS).map((s) => [s, 0])) as Record<StatusOS, number>;
  for (const g of porStatus) contagem[g.status] = g._count._all;

  res.json({
    porStatus: contagem,
    emAberto: ABERTAS.reduce((s, st) => s + contagem[st], 0),
    atrasadas,
    ultimos30Dias: { abertas: abertas30, finalizadas: finalizadas30 },
    abertasPorTecnico: porTecnico.map((t) => ({
      tecnicoId: t.tecnicoId,
      nome: t.tecnicoId ? tecnicos.find((x) => x.id === t.tecnicoId)?.nome ?? "—" : "Sem técnico",
      quantidade: t._count._all,
    })),
  });
});
