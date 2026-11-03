import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/http";

/**
 * Serviço de Inteligência Artificial — diagnóstico guiado (Seção 9 do Documento Técnico).
 *
 * Toda chamada à IA passa por aqui. O front-end nunca fala com a API da Anthropic diretamente
 * (a chave fica só no servidor) e nenhum dado pessoal do cliente é enviado (RNF04).
 */

// ---------- Formato da resposta estruturada da IA ----------

export const respostaIASchema = z.object({
  mensagem: z.string(),
  causasPossiveis: z
    .array(
      z.object({
        causa: z.string(),
        probabilidade: z.enum(["alta", "media", "baixa"]),
        justificativa: z.string().optional().default(""),
      }),
    )
    .default([]),
  proximaEtapa: z
    .object({
      titulo: z.string(),
      procedimento: z.string(),
      instrumento: z.string().optional().default(""),
      pontoMedicao: z.string().optional().default(""),
      resultadoEsperado: z.string().optional().default(""),
    })
    .nullable()
    .default(null),
  interpretacaoUltimoResultado: z.string().nullable().default(null),
  avaliacaoUltimaMedicao: z
    .enum(["DENTRO_DO_ESPERADO", "ABAIXO_DO_ESPERADO", "ACIMA_DO_ESPERADO", "INDEFINIDO"])
    .nullable()
    .default(null),
  diagnosticoConcluido: z.boolean().default(false),
  diagnosticoSugerido: z.string().nullable().default(null),
  alertasSeguranca: z.array(z.string()).default([]),
});

export type RespostaIA = z.infer<typeof respostaIASchema>;

export interface ContextoDiagnostico {
  equipamento: { tipo: string; marca: string; modelo: string };
  defeitoRelatado: string;
  sintoma: string;
  historicoEquipamento: string[]; // diagnósticos anteriores do mesmo aparelho
  baseConhecimento: { titulo: string; conteudo: string }[];
}

export interface TurnoConversa {
  autor: "TECNICO" | "IA";
  texto: string;
}

/** Função que efetivamente consulta o modelo. Pode ser substituída nos testes. */
export type ClienteIA = (system: string, mensagens: Anthropic.MessageParam[]) => Promise<unknown>;

// ---------- Privacidade (RNF04 / LGPD) ----------

/** Remove CPF, e-mail e telefone que o técnico possa ter digitado por engano. */
export function sanitizarTexto(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-mail removido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF removido]")
    .replace(/(\(?\b\d{2}\)?\s?)?9?\d{4}-?\d{4}\b/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[telefone removido]" : m));
}

// ---------- Prompt ----------

export const SYSTEM_PROMPT = `Você é o assistente de diagnóstico da Inforcell, uma assistência técnica de celulares e computadores em Balsas/MA.
Seu papel é conduzir um técnico de eletrônica por um diagnóstico estruturado, um teste de cada vez, até a causa provável do defeito.

Regras:
- Responda sempre em português do Brasil, de forma objetiva e técnica.
- Na primeira resposta, liste de 3 a 5 causas possíveis ordenadas da mais para a menos provável e proponha o PRIMEIRO teste.
- Proponha apenas UM teste por vez. Comece pelos testes mais simples, baratos e não destrutivos (inspeção visual, carregador, cabo, bateria, consumo na fonte) antes de testes de placa.
- Para cada teste, diga o instrumento (multímetro, fonte de bancada, câmera térmica, etc.), o ponto ou linha a medir e o resultado esperado com valores de referência quando souber.
- Quando o técnico informar um resultado, interprete-o, avalie a última medição (dentro, abaixo ou acima do esperado) e reordene as causas possíveis.
- Se não tiver certeza de um valor de referência para um modelo específico, diga isso claramente em vez de inventar.
- Inclua alertas de segurança quando houver risco (bateria estufada, alta tensão em fontes, ESD, curto).
- Marque diagnosticoConcluido=true somente quando os testes já apontarem uma causa com boa confiança, e descreva-a em diagnosticoSugerido.
- Você apoia a decisão do técnico; a decisão final é dele.
- Use sempre a ferramenta registrar_orientacao para responder.`;

const FERRAMENTA: Anthropic.Tool = {
  name: "registrar_orientacao",
  description: "Registra a orientação de diagnóstico para o técnico em formato estruturado.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string", description: "Texto curto para o técnico, explicando a orientação." },
      causasPossiveis: {
        type: "array",
        items: {
          type: "object",
          properties: {
            causa: { type: "string" },
            probabilidade: { type: "string", enum: ["alta", "media", "baixa"] },
            justificativa: { type: "string" },
          },
          required: ["causa", "probabilidade"],
        },
      },
      proximaEtapa: {
        type: ["object", "null"],
        properties: {
          titulo: { type: "string" },
          procedimento: { type: "string" },
          instrumento: { type: "string" },
          pontoMedicao: { type: "string" },
          resultadoEsperado: { type: "string" },
        },
        required: ["titulo", "procedimento"],
      },
      interpretacaoUltimoResultado: { type: ["string", "null"] },
      avaliacaoUltimaMedicao: {
        type: ["string", "null"],
        enum: ["DENTRO_DO_ESPERADO", "ABAIXO_DO_ESPERADO", "ACIMA_DO_ESPERADO", "INDEFINIDO", null],
      },
      diagnosticoConcluido: { type: "boolean" },
      diagnosticoSugerido: { type: ["string", "null"] },
      alertasSeguranca: { type: "array", items: { type: "string" } },
    },
    required: ["mensagem", "causasPossiveis", "proximaEtapa", "diagnosticoConcluido"],
  },
};

export function montarContextoInicial(ctx: ContextoDiagnostico): string {
  const partes = [
    `Equipamento: ${ctx.equipamento.tipo} — ${ctx.equipamento.marca} ${ctx.equipamento.modelo}`,
    `Defeito relatado pelo cliente: ${sanitizarTexto(ctx.defeitoRelatado)}`,
    `Sintoma observado pelo técnico: ${sanitizarTexto(ctx.sintoma)}`,
  ];
  if (ctx.historicoEquipamento.length) {
    partes.push("Diagnósticos anteriores deste mesmo aparelho:\n- " + ctx.historicoEquipamento.map(sanitizarTexto).join("\n- "));
  }
  if (ctx.baseConhecimento.length) {
    partes.push(
      "Trechos da base de conhecimento da Inforcell que podem ajudar:\n" +
        ctx.baseConhecimento.map((a) => `### ${a.titulo}\n${a.conteudo}`).join("\n\n"),
    );
  }
  partes.push("Inicie o diagnóstico guiado.");
  return partes.join("\n\n");
}

/** Monta a conversa no formato da API (alternando user/assistant). */
export function montarMensagens(ctx: ContextoDiagnostico, turnos: TurnoConversa[]): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [{ role: "user", content: montarContextoInicial(ctx) }];
  for (const t of turnos) {
    const role = t.autor === "TECNICO" ? "user" : "assistant";
    const texto = t.autor === "TECNICO" ? sanitizarTexto(t.texto) : t.texto;
    const ultima = msgs[msgs.length - 1];
    if (ultima.role === role) ultima.content = `${ultima.content}\n\n${texto}`;
    else msgs.push({ role, content: texto });
  }
  // a conversa precisa terminar com o técnico
  if (msgs[msgs.length - 1].role === "assistant") {
    msgs.push({ role: "user", content: "Continue a partir da última orientação." });
  }
  return msgs;
}

/** Texto salvo como mensagem da IA (também usado para reconstruir o histórico). */
export function resumoParaHistorico(r: RespostaIA): string {
  const linhas = [r.mensagem];
  if (r.interpretacaoUltimoResultado) linhas.push(`Interpretação: ${r.interpretacaoUltimoResultado}`);
  if (r.causasPossiveis.length) {
    linhas.push("Causas possíveis: " + r.causasPossiveis.map((c) => `${c.causa} (${c.probabilidade})`).join("; "));
  }
  if (r.proximaEtapa) {
    const e = r.proximaEtapa;
    linhas.push(
      `Próxima etapa — ${e.titulo}: ${e.procedimento}` +
        (e.instrumento ? ` | Instrumento: ${e.instrumento}` : "") +
        (e.pontoMedicao ? ` | Ponto: ${e.pontoMedicao}` : "") +
        (e.resultadoEsperado ? ` | Esperado: ${e.resultadoEsperado}` : ""),
    );
  }
  if (r.diagnosticoConcluido && r.diagnosticoSugerido) linhas.push(`Diagnóstico sugerido: ${r.diagnosticoSugerido}`);
  if (r.alertasSeguranca.length) linhas.push("Atenção: " + r.alertasSeguranca.join(" "));
  return linhas.join("\n");
}

// ---------- Cliente real (API da Anthropic) ----------

let anthropic: Anthropic | null = null;

const clienteAnthropic: ClienteIA = async (system, mensagens) => {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, "Serviço de IA não configurado. Defina ANTHROPIC_API_KEY no arquivo .env.");
  }
  anthropic ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 2 });
  try {
    const resp = await anthropic.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 2048,
      system,
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
      messages: mensagens,
    });
    const bloco = resp.content.find((b) => b.type === "tool_use");
    if (!bloco || bloco.type !== "tool_use") throw new AppError(502, "A IA não retornou uma orientação estruturada.");
    return bloco.input;
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Anthropic.APIError) {
      console.error("[IA] erro da API:", e.status, e.message);
      throw new AppError(502, "Falha ao consultar o serviço de IA. Tente novamente em instantes.");
    }
    throw e;
  }
};

let clienteAtual: ClienteIA = clienteAnthropic;

/** Permite injetar um cliente falso (testes ou modo demonstração). */
export function definirClienteIA(c: ClienteIA | null) {
  clienteAtual = c ?? clienteAnthropic;
}

export async function consultarIA(ctx: ContextoDiagnostico, turnos: TurnoConversa[]): Promise<RespostaIA> {
  const bruto = await clienteAtual(SYSTEM_PROMPT, montarMensagens(ctx, turnos));
  const r = respostaIASchema.safeParse(bruto);
  if (!r.success) {
    console.error("[IA] resposta fora do formato:", r.error.issues);
    throw new AppError(502, "A resposta da IA veio em formato inesperado. Tente novamente.");
  }
  return r.data;
}
