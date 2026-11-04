/**
 * Teste de ponta a ponta da API contra um banco MySQL real, com a IA simulada.
 * Requer banco migrado e com seed (npm run db:deploy && npm run db:seed) e TESTAR_BANCO=1 (npm run test:api).
 * Sem banco configurado, apenas os testes que não usam o banco são executados.
 */
import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/app";
import { definirClienteIA } from "../src/services/ia.service";

const app = criarApp();
const temBanco = process.env.TESTAR_BANCO === "1";

describe("API sem banco", () => {
  it("health check responde", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("ok");
  });
  it("rotas protegidas exigem token (RNF02)", async () => {
    expect((await request(app).get("/api/ordens")).status).toBe(401);
    expect((await request(app).get("/api/ordens").set("Authorization", "Bearer invalido")).status).toBe(401);
  });
});

describe.skipIf(!temBanco)("fluxo completo de uma OS com diagnóstico guiado", () => {
  const tokens: Record<string, string> = {};
  let chamadasIA = 0;

  beforeAll(async () => {
    for (const p of ["admin", "atendente", "tecnico"]) {
      const r = await request(app).post("/api/auth/login").send({ email: `${p}@inforcell.local`, senha: "inforcell123" });
      expect(r.status).toBe(200);
      tokens[p] = r.body.token;
    }
    // IA simulada: 1ª resposta propõe teste; 2ª conclui
    definirClienteIA(async (_system, mensagens) => {
      chamadasIA++;
      const ultima = String(mensagens[mensagens.length - 1].content);
      if (chamadasIA === 1) {
        expect(ultima).not.toContain("99988887777"); // telefone do cliente não vai para a IA
        return {
          mensagem: "Vamos começar pelo consumo na fonte de bancada.",
          causasPossiveis: [
            { causa: "Bateria descarregada/defeituosa", probabilidade: "alta" },
            { causa: "Curto na linha principal", probabilidade: "media" },
            { causa: "Falha no botão Power", probabilidade: "baixa" },
          ],
          proximaEtapa: {
            titulo: "Consumo na fonte",
            procedimento: "Ligue a placa na fonte a 4,0 V e observe a corrente ao pressionar Power.",
            instrumento: "Fonte de bancada",
            resultadoEsperado: "Pico de 50–300 mA",
          },
          diagnosticoConcluido: false,
        };
      }
      expect(ultima).toContain("[Medição]");
      return {
        mensagem: "Consumo alto e imediato indica curto na linha principal.",
        causasPossiveis: [{ causa: "Curto na linha principal", probabilidade: "alta" }],
        proximaEtapa: null,
        interpretacaoUltimoResultado: "1,2 A sem pressionar Power está muito acima do esperado.",
        avaliacaoUltimaMedicao: "ACIMA_DO_ESPERADO",
        diagnosticoConcluido: true,
        diagnosticoSugerido: "Curto em capacitor da linha VDD_MAIN.",
      };
    });
  });

  const auth = (p: string) => ({ Authorization: `Bearer ${tokens[p]}` });

  it("percorre atendimento → diagnóstico com IA → reparo → entrega", async () => {
    const sufixo = Date.now().toString().slice(-8);

    // HU02 — cadastro
    const cli = await request(app).post("/api/clientes").set(auth("atendente")).send({ nome: "Cliente Teste", telefone: "(99) 98888-7777" });
    expect(cli.status).toBe(201);
    const eq = await request(app)
      .post("/api/equipamentos")
      .set(auth("atendente"))
      .send({ clienteId: cli.body.id, tipo: "CELULAR", marca: "Apple", modelo: "iPhone 11", imei: `35${sufixo}12345` });
    expect(eq.status).toBe(201);

    // técnico não pode cadastrar cliente (RNF03)
    expect((await request(app).post("/api/clientes").set(auth("tecnico")).send({ nome: "X", telefone: "99999999999" })).status).toBe(403);

    // HU03 — abre OS
    const os = await request(app)
      .post("/api/ordens")
      .set(auth("atendente"))
      .send({ clienteId: cli.body.id, equipamentoId: eq.body.id, defeitoRelatado: "Não liga. Contato 99988887777" });
    expect(os.status).toBe(201);
    expect(os.body.status).toBe("RECEBIDO");
    const osId = os.body.id;

    // transição inválida é bloqueada
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("atendente")).send({ status: "FINALIZADO" })).status).toBe(409);

    // HU05 — técnico inicia diagnóstico (assume a OS e ela vai para EM_DIAGNOSTICO)
    const d = await request(app).post(`/api/ordens/${osId}/diagnosticos`).set(auth("tecnico")).send({ sintoma: "Sem imagem e sem vibração" });
    expect(d.status).toBe(201);
    expect(d.body.orientacao.causasPossiveis).toHaveLength(3);
    const sessaoId = d.body.sessao.id;

    // HU06 — informa medição
    const m = await request(app)
      .post(`/api/diagnosticos/${sessaoId}/mensagens`)
      .set(auth("tecnico"))
      .send({
        texto: "Consumo subiu sozinho",
        medicao: { pontoMedicao: "Fonte de bancada", grandeza: "corrente", valor: 1.2, unidade: "A", resultadoEsperado: "50–300 mA" },
      });
    expect(m.status).toBe(201);
    expect(m.body.orientacao.diagnosticoConcluido).toBe(true);

    // conclui e salva na base de conhecimento
    const c = await request(app)
      .post(`/api/diagnosticos/${sessaoId}/concluir`)
      .set(auth("tecnico"))
      .send({ diagnosticoFinal: "Curto em capacitor da linha VDD_MAIN", salvarNaBase: true });
    expect(c.status).toBe(200);
    expect(c.body.artigo.tags).toBe("caso-resolvido");

    const det = await request(app).get(`/api/ordens/${osId}`).set(auth("tecnico"));
    expect(det.body.status).toBe("EM_DIAGNOSTICO");
    expect(det.body.medicoes[0].avaliacao).toBe("ACIMA_DO_ESPERADO");

    // orçamento obrigatório antes da aprovação
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("tecnico")).send({ status: "AGUARDANDO_APROVACAO" })).status).toBe(409);
    await request(app).patch(`/api/ordens/${osId}`).set(auth("tecnico")).send({ valorOrcamento: 250 });
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("tecnico")).send({ status: "AGUARDANDO_APROVACAO" })).status).toBe(200);
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("atendente")).send({ status: "EM_REPARO", observacao: "Cliente aprovou por telefone" })).status).toBe(200);

    // HU07 — reparo
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("tecnico")).send({ status: "EM_TESTES" })).status).toBe(409);
    expect((await request(app).post(`/api/ordens/${osId}/reparos`).set(auth("tecnico")).send({ descricao: "Troca do capacitor em curto", valorFinal: 250 })).status).toBe(201);
    for (const status of ["EM_TESTES", "FINALIZADO"]) {
      expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("tecnico")).send({ status })).status).toBe(200);
    }
    // técnico não pode registrar entrega
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("tecnico")).send({ status: "ENTREGUE" })).status).toBe(403);
    expect((await request(app).patch(`/api/ordens/${osId}/status`).set(auth("atendente")).send({ status: "ENTREGUE" })).status).toBe(200);

    // RF20 / RF19 / RF21 / HU08
    const comp = await request(app).get(`/api/ordens/${osId}/comprovante`).set(auth("atendente"));
    expect(comp.status).toBe(200);
    expect(comp.text).toContain(`OS-${String(os.body.numero).padStart(4, "0")}`);
    const hist = await request(app).get(`/api/equipamentos/${eq.body.id}/historico`).set(auth("tecnico"));
    expect(hist.body.ordens[0].reparos).toHaveLength(1);
    const busca = await request(app).get(`/api/ordens?busca=${eq.body.imei}`).set(auth("admin"));
    expect(busca.body.dados.map((o: { id: number }) => o.id)).toContain(osId);
    const painel = await request(app).get("/api/dashboard").set(auth("admin"));
    expect(painel.body.porStatus.ENTREGUE).toBeGreaterThanOrEqual(1);

    const linhaTempo = (await request(app).get(`/api/ordens/${osId}`).set(auth("admin"))).body.historico.map((h: { para: string }) => h.para);
    expect(linhaTempo).toEqual(["RECEBIDO", "EM_DIAGNOSTICO", "AGUARDANDO_APROVACAO", "EM_REPARO", "EM_TESTES", "FINALIZADO", "ENTREGUE"]);
  });
});
