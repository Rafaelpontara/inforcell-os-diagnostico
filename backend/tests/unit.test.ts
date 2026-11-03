import { describe, expect, it } from "vitest";
import { perfilPodeMover, transicaoPermitida } from "../src/services/statusOS";
import { montarMensagens, sanitizarTexto } from "../src/services/ia.service";
import { pontuar } from "../src/services/conhecimento.service";

describe("fluxo de status da OS", () => {
  it("segue a sequência do Documento Técnico", () => {
    expect(transicaoPermitida("RECEBIDO", "EM_DIAGNOSTICO")).toBe(true);
    expect(transicaoPermitida("EM_DIAGNOSTICO", "AGUARDANDO_APROVACAO")).toBe(true);
    expect(transicaoPermitida("EM_TESTES", "EM_REPARO")).toBe(true); // falhou no teste, volta ao reparo
    expect(transicaoPermitida("FINALIZADO", "ENTREGUE")).toBe(true);
  });
  it("bloqueia saltos e retrocessos indevidos", () => {
    expect(transicaoPermitida("RECEBIDO", "FINALIZADO")).toBe(false);
    expect(transicaoPermitida("ENTREGUE", "EM_REPARO")).toBe(false);
    expect(transicaoPermitida("EM_REPARO", "CANCELADO")).toBe(false);
  });
  it("respeita o perfil de quem move", () => {
    expect(perfilPodeMover("ATENDENTE", "ENTREGUE")).toBe(true);
    expect(perfilPodeMover("TECNICO", "ENTREGUE")).toBe(false);
    expect(perfilPodeMover("ATENDENTE", "EM_DIAGNOSTICO")).toBe(false);
  });
});

describe("privacidade dos dados enviados à IA (RNF04)", () => {
  it("remove CPF, e-mail e telefone", () => {
    const t = sanitizarTexto("cliente 123.456.789-09, maria@gmail.com, tel (99) 98123-4567");
    expect(t).not.toMatch(/123\.456|maria@|98123/);
  });
  it("mantém valores de medição", () => {
    expect(sanitizarTexto("medi 3,85 V e 120 mA no PP_VDD_MAIN")).toBe("medi 3,85 V e 120 mA no PP_VDD_MAIN");
  });
  it("alterna papéis e termina com o técnico", () => {
    const ctx = {
      equipamento: { tipo: "CELULAR", marca: "Apple", modelo: "iPhone 11" },
      defeitoRelatado: "não liga",
      sintoma: "sem consumo",
      historicoEquipamento: [],
      baseConhecimento: [],
    };
    const m = montarMensagens(ctx, [
      { autor: "IA", texto: "Teste 1" },
      { autor: "TECNICO", texto: "resultado A" },
      { autor: "TECNICO", texto: "resultado B" },
    ]);
    expect(m.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
    expect(String(m[2].content)).toContain("resultado B");
  });
});

describe("busca na base de conhecimento", () => {
  it("prioriza artigos do mesmo modelo e sintoma", () => {
    const busca = { sintoma: "não liga sem consumo", marca: "Apple", modelo: "iPhone 11" };
    const a = pontuar({ titulo: "iPhone 11 não liga", sintoma: "não liga", tags: "consumo", marca: "Apple", modelo: "iPhone 11" }, busca);
    const b = pontuar({ titulo: "Tela quebrada", sintoma: "tela", tags: null, marca: null, modelo: null }, busca);
    expect(a).toBeGreaterThan(b);
    expect(b).toBe(0);
  });
});
