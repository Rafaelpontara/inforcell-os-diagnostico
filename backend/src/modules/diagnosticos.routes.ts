import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { autorizar, usuarioAtual, UsuarioToken } from "../middlewares/auth";
import { AppError, notFound, parseId } from "../utils/http";
import { buscarOS, garantirAcesso, medicaoSchema } from "./ordens.routes";
import { consultarIA, ContextoDiagnostico, resumoParaHistorico, RespostaIA, TurnoConversa } from "../services/ia.service";
import { buscarArtigosRelevantes } from "../services/conhecimento.service";

/**
 * RF09–RF17 — Diagnóstico assistido por IA (HU05, HU06).
 *
 * Fluxo: o técnico abre uma sessão informando o sintoma; a IA devolve causas possíveis e o
 * primeiro teste; o técnico informa o resultado (texto + medição opcional); a IA interpreta e
 * indica o próximo teste, até o técnico concluir o diagnóstico.
 */
export const diagnosticosRoutes = Router();
const soTecnico = autorizar("TECNICO", "ADMIN");

async function contextoDaOS(osId: number, sintoma: string): Promise<ContextoDiagnostico> {
  const os = await prisma.ordemServico.findUniqueOrThrow({ where: { id: osId }, include: { equipamento: true } });
  const eq = os.equipamento;
  const anteriores = await prisma.sessaoDiagnostico.findMany({
    where: { os: { equipamentoId: eq.id }, status: "CONCLUIDA", diagnosticoFinal: { not: null } },
    orderBy: { concluidaEm: "desc" },
    take: 5,
    select: { sintoma: true, diagnosticoFinal: true, concluidaEm: true },
  });
  return {
    equipamento: { tipo: eq.tipo, marca: eq.marca, modelo: eq.modelo },
    defeitoRelatado: os.defeitoRelatado,
    sintoma,
    historicoEquipamento: anteriores.map(
      (s) => `${s.concluidaEm?.toISOString().slice(0, 10)}: sintoma "${s.sintoma}" → ${s.diagnosticoFinal}`,
    ),
    baseConhecimento: await buscarArtigosRelevantes(os.empresaId, eq.tipo, eq.marca, eq.modelo, `${sintoma} ${os.defeitoRelatado}`),
  };
}

async function carregarSessao(id: number, u: UsuarioToken) {
  const sessao = await prisma.sessaoDiagnostico.findFirst({
    where: { id, os: { empresaId: u.empresaId } },
    include: { os: { select: { id: true, tecnicoId: true, status: true } } },
  });
  if (!sessao) throw notFound("Sessão de diagnóstico");
  garantirAcesso(sessao.os, u);
  return sessao;
}

async function turnosDaSessao(sessaoId: number): Promise<TurnoConversa[]> {
  const msgs = await prisma.mensagemDiagnostico.findMany({ where: { sessaoId }, orderBy: { id: "asc" } });
  return msgs.map((m) => ({ autor: m.autor, texto: m.conteudo }));
}

/** Persiste a resposta da IA e atualiza causas e avaliação da última medição. */
async function salvarRespostaIA(sessaoId: number, r: RespostaIA, medicaoId?: number) {
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.mensagemDiagnostico.create({
      data: { sessaoId, autor: "IA", conteudo: resumoParaHistorico(r), dadosEstruturados: r as unknown as Prisma.InputJsonValue },
    }),
  ];
  if (r.causasPossiveis.length) {
    ops.push(
      prisma.sessaoDiagnostico.update({
        where: { id: sessaoId },
        data: { causasPossiveis: r.causasPossiveis as unknown as Prisma.InputJsonValue },
      }),
    );
  }
  if (medicaoId && r.avaliacaoUltimaMedicao) {
    ops.push(prisma.medicao.update({ where: { id: medicaoId }, data: { avaliacao: r.avaliacaoUltimaMedicao } }));
  }
  const [mensagem] = await prisma.$transaction(ops);
  return mensagem;
}

// ---------- Iniciar diagnóstico (HU05) ----------
diagnosticosRoutes.post("/ordens/:osId/diagnosticos", soTecnico, async (req, res) => {
  const u = usuarioAtual(req);
  const { sintoma } = z.object({ sintoma: z.string().min(3) }).parse(req.body);
  const os = await buscarOS(parseId(req.params.osId), u);
  if (["FINALIZADO", "ENTREGUE", "CANCELADO"].includes(os.status)) {
    throw new AppError(409, "Não é possível iniciar diagnóstico em uma OS encerrada.");
  }

  // Consulta a IA antes de gravar para não deixar sessões vazias em caso de falha.
  const ctx = await contextoDaOS(os.id, sintoma);
  const resposta = await consultarIA(ctx, []);

  const sessao = await prisma.$transaction(async (tx) => {
    // técnico que inicia o diagnóstico assume a OS e ela avança para EM_DIAGNOSTICO
    if (os.tecnicoId === null && u.perfil === "TECNICO") {
      await tx.ordemServico.update({ where: { id: os.id }, data: { tecnicoId: u.id } });
    }
    if (os.status === "RECEBIDO") {
      await tx.ordemServico.update({
        where: { id: os.id },
        data: {
          status: "EM_DIAGNOSTICO",
          historico: { create: { usuarioId: u.id, de: "RECEBIDO", para: "EM_DIAGNOSTICO", observacao: "Diagnóstico iniciado" } },
        },
      });
    }
    return tx.sessaoDiagnostico.create({
      data: {
        osId: os.id,
        tecnicoId: u.id,
        sintoma,
        causasPossiveis: resposta.causasPossiveis as unknown as Prisma.InputJsonValue,
        mensagens: {
          create: {
            autor: "IA",
            conteudo: resumoParaHistorico(resposta),
            dadosEstruturados: resposta as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });
  });

  res.status(201).json({ sessao, orientacao: resposta });
});

// ---------- Consultar sessão ----------
diagnosticosRoutes.get("/diagnosticos/:id", soTecnico, async (req, res) => {
  const u = usuarioAtual(req);
  const s = await carregarSessao(parseId(req.params.id), u);
  const completa = await prisma.sessaoDiagnostico.findUnique({
    where: { id: s.id },
    include: {
      mensagens: { orderBy: { id: "asc" } },
      medicoes: { orderBy: { id: "asc" } },
      tecnico: { select: { id: true, nome: true } },
      os: { select: { numero: true } },
    },
  });
  res.json(completa);
});

// ---------- Informar resultado e receber o próximo passo (HU06) ----------
const respostaTecnicoSchema = z.object({
  texto: z.string().min(1),
  medicao: medicaoSchema.optional(),
});

diagnosticosRoutes.post("/diagnosticos/:id/mensagens", soTecnico, async (req, res) => {
  const u = usuarioAtual(req);
  const sessao = await carregarSessao(parseId(req.params.id), u);
  if (sessao.status !== "ATIVA") throw new AppError(409, "Esta sessão de diagnóstico já foi concluída.");
  const { texto, medicao } = respostaTecnicoSchema.parse(req.body);

  // Resultado do técnico é gravado primeiro: é dado real e não pode se perder se a IA falhar.
  const conteudo = medicao
    ? `${texto}\n[Medição] ${medicao.grandeza} em ${medicao.pontoMedicao}: ${medicao.valor} ${medicao.unidade}` +
      (medicao.resultadoEsperado ? ` (esperado: ${medicao.resultadoEsperado})` : "")
    : texto;
  const [msgTecnico, medicaoCriada] = await prisma.$transaction(async (tx) => [
    await tx.mensagemDiagnostico.create({ data: { sessaoId: sessao.id, autor: "TECNICO", conteudo } }),
    medicao ? await tx.medicao.create({ data: { ...medicao, osId: sessao.osId, sessaoId: sessao.id } }) : null,
  ]);

  try {
    const resposta = await consultarIA(await contextoDaOS(sessao.osId, sessao.sintoma), await turnosDaSessao(sessao.id));
    const msgIA = await salvarRespostaIA(sessao.id, resposta, medicaoCriada?.id);
    res.status(201).json({ mensagemTecnico: msgTecnico, medicao: medicaoCriada, mensagemIA: msgIA, orientacao: resposta });
  } catch (e) {
    if (e instanceof AppError && e.status >= 500) {
      throw new AppError(e.status, `${e.message} Seu resultado foi registrado; use "continuar" para pedir a orientação novamente.`);
    }
    throw e;
  }
});

/** Pede nova orientação sem enviar mensagem (útil após falha temporária da IA). */
diagnosticosRoutes.post("/diagnosticos/:id/continuar", soTecnico, async (req, res) => {
  const u = usuarioAtual(req);
  const sessao = await carregarSessao(parseId(req.params.id), u);
  if (sessao.status !== "ATIVA") throw new AppError(409, "Esta sessão de diagnóstico já foi concluída.");
  const resposta = await consultarIA(await contextoDaOS(sessao.osId, sessao.sintoma), await turnosDaSessao(sessao.id));
  const ultimaMedicao = await prisma.medicao.findFirst({ where: { sessaoId: sessao.id }, orderBy: { id: "desc" } });
  const msgIA = await salvarRespostaIA(sessao.id, resposta, ultimaMedicao?.id);
  res.status(201).json({ mensagemIA: msgIA, orientacao: resposta });
});

// ---------- Concluir diagnóstico (RF09, RF17) ----------
const concluirSchema = z.object({
  diagnosticoFinal: z.string().min(3),
  /** Se verdadeiro, o caso resolvido vira um artigo da base de conhecimento. */
  salvarNaBase: z.boolean().default(false),
});

diagnosticosRoutes.post("/diagnosticos/:id/concluir", soTecnico, async (req, res) => {
  const u = usuarioAtual(req);
  const sessao = await carregarSessao(parseId(req.params.id), u);
  if (sessao.status !== "ATIVA") throw new AppError(409, "Esta sessão já foi concluída.");
  const { diagnosticoFinal, salvarNaBase } = concluirSchema.parse(req.body);

  const concluida = await prisma.sessaoDiagnostico.update({
    where: { id: sessao.id },
    data: { status: "CONCLUIDA", diagnosticoFinal, concluidaEm: new Date() },
    include: { os: { include: { equipamento: true } }, medicoes: true },
  });

  let artigo = null;
  if (salvarNaBase) {
    const eq = concluida.os.equipamento;
    const medicoes = concluida.medicoes
      .map((m) => `- ${m.grandeza} em ${m.pontoMedicao}: ${m.valor} ${m.unidade} (${m.avaliacao})`)
      .join("\n");
    artigo = await prisma.artigoConhecimento.create({
      data: {
        empresaId: u.empresaId,
        titulo: `${eq.marca} ${eq.modelo} — ${concluida.sintoma}`.slice(0, 160),
        tipoEquipamento: eq.tipo,
        marca: eq.marca,
        modelo: eq.modelo,
        sintoma: concluida.sintoma.slice(0, 255),
        conteudo: `Diagnóstico: ${diagnosticoFinal}${medicoes ? `\n\nMedições realizadas:\n${medicoes}` : ""}`,
        tags: "caso-resolvido",
        origemOsId: concluida.osId,
      },
    });
  }
  res.json({ sessao: { ...concluida, os: undefined }, artigo });
});
