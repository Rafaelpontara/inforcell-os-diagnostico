/**
 * Cadastro de empresas e isolamento de dados entre elas, contra um banco MySQL real.
 * Requer banco migrado e TESTAR_BANCO=1 (npm run test:api). Use um banco só para testes.
 */
import { beforeAll, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import { criarApp } from "../src/app";
import { env } from "../src/config/env";
import { definirClienteIA } from "../src/services/ia.service";

const app = criarApp();
const temBanco = process.env.TESTAR_BANCO === "1";
const sufixo = `${Date.now()}`;

interface Conta {
  token: string;
  empresaId: number;
  nomeEmpresa: string;
}

async function novaEmpresa(rotulo: string): Promise<Conta> {
  const nomeEmpresa = `Assistência ${rotulo} ${sufixo}`;
  const r = await request(app)
    .post("/api/auth/cadastro")
    .send({ nomeEmpresa, telefoneEmpresa: "(99) 3333-4444", nome: `Dono ${rotulo}`, email: `dono.${rotulo}.${sufixo}@teste.local`, senha: "senha-forte-1" });
  expect(r.status).toBe(201);
  expect(r.body.usuario.perfil).toBe("ADMIN");
  return { token: r.body.token, empresaId: r.body.empresa.id, nomeEmpresa };
}

const comToken = (c: Conta) => ({ Authorization: `Bearer ${c.token}` });

describe.skipIf(!temBanco)("empresas", () => {
  let a: Conta;
  let b: Conta;
  let tecnicoA: number;
  let clienteA: number;
  let equipamentoA: number;
  let osA: number;
  let sessaoA: number;
  let artigoA: number;
  let tecnicoATokenConta: Conta;

  beforeAll(async () => {
    a = await novaEmpresa("a");
    b = await novaEmpresa("b");
    definirClienteIA(async () => ({
      mensagem: "Teste.",
      causasPossiveis: [{ causa: "Causa", probabilidade: "alta" }],
      proximaEtapa: null,
      diagnosticoConcluido: false,
    }));

    const emailTecnico = `tecnico.a.${sufixo}@teste.local`;
    const tec = await request(app).post("/api/usuarios").set(comToken(a)).send({ nome: "Técnico A", email: emailTecnico, senha: "senha-forte-1", perfil: "TECNICO" });
    expect(tec.status).toBe(201);
    tecnicoA = tec.body.id;
    const login = await request(app).post("/api/auth/login").send({ email: emailTecnico, senha: "senha-forte-1" });
    tecnicoATokenConta = { token: login.body.token, empresaId: login.body.empresa.id, nomeEmpresa: login.body.empresa.nome };

    const cli = await request(app).post("/api/clientes").set(comToken(a)).send({ nome: "Cliente de A", telefone: "99911112222", cpf: "12345678901" });
    expect(cli.status).toBe(201);
    clienteA = cli.body.id;
    const eq = await request(app).post("/api/equipamentos").set(comToken(a)).send({ clienteId: clienteA, tipo: "CELULAR", marca: "Moto", modelo: "G52", imei: "35000000000001" });
    expect(eq.status).toBe(201);
    equipamentoA = eq.body.id;
    const os = await request(app).post("/api/ordens").set(comToken(a)).send({ clienteId: clienteA, equipamentoId: equipamentoA, defeitoRelatado: "Não liga", tecnicoId: tecnicoA });
    expect(os.status).toBe(201);
    osA = os.body.id;
    const sessao = await request(app).post(`/api/ordens/${osA}/diagnosticos`).set(comToken(tecnicoATokenConta)).send({ sintoma: "Sem imagem" });
    expect(sessao.status).toBe(201);
    sessaoA = sessao.body.sessao.id;
    const artigo = await request(app).post("/api/conhecimento").set(comToken(a)).send({ titulo: "Artigo de A", sintoma: "sem imagem", conteudo: "Conteúdo exclusivo da empresa A." });
    expect(artigo.status).toBe(201);
    artigoA = artigo.body.id;
  });

  describe("cadastro", () => {
    it("o login devolve a empresa e o /me também", async () => {
      const me = await request(app).get("/api/auth/me").set(comToken(a));
      expect(me.body.empresa.nome).toBe(a.nomeEmpresa);
    });
    it("recusa e-mail repetido, mesmo entre empresas", async () => {
      const r = await request(app).post("/api/auth/cadastro").send({ nomeEmpresa: "Outra", nome: "Outro", email: `DONO.A.${sufixo}@teste.local`, senha: "senha-forte-1" });
      expect(r.status).toBe(409);
      const u = await request(app).post("/api/usuarios").set(comToken(b)).send({ nome: "Copia", email: `tecnico.a.${sufixo}@teste.local`, senha: "senha-forte-1", perfil: "TECNICO" });
      expect(u.status).toBe(409);
    });
    it("valida os dados", async () => {
      const r = await request(app).post("/api/auth/cadastro").send({ nomeEmpresa: "X", nome: "Y", email: "ruim", senha: "123" });
      expect(r.status).toBe(400);
      expect(r.body.detalhes.map((d: { campo: string }) => d.campo).sort()).toEqual(["email", "nome", "nomeEmpresa", "senha"]);
    });
    it("não aceita perfil nem empresa enviados pelo formulário", async () => {
      const r = await request(app)
        .post("/api/auth/cadastro")
        .send({ nomeEmpresa: `Terceira ${sufixo}`, nome: "Dono", email: `dono.c.${sufixo}@teste.local`, senha: "senha-forte-1", perfil: "TECNICO", empresaId: a.empresaId });
      expect(r.status).toBe(201);
      expect(r.body.usuario.perfil).toBe("ADMIN");
      expect(r.body.empresa.id).not.toBe(a.empresaId);
    });
    it("recusa token sem empresa", async () => {
      const antigo = jwt.sign({ nome: "Antigo", perfil: "ADMIN" }, env.JWT_SECRET, { subject: "1" });
      expect((await request(app).get("/api/clientes").set("Authorization", `Bearer ${antigo}`)).status).toBe(401);
    });
  });

  describe("isolamento: a empresa B não alcança nada da empresa A", () => {
    it("listagens vêm vazias", async () => {
      for (const rota of ["clientes", "ordens", "conhecimento"]) {
        const r = await request(app).get(`/api/${rota}`).set(comToken(b));
        expect(r.status, rota).toBe(200);
        expect(r.body.total, rota).toBe(0);
      }
      expect((await request(app).get("/api/equipamentos").set(comToken(b))).body).toEqual([]);
      expect((await request(app).get(`/api/equipamentos?clienteId=${clienteA}`).set(comToken(b))).body).toEqual([]);
      expect((await request(app).get("/api/usuarios/tecnicos").set(comToken(b))).body).toEqual([]);
      expect((await request(app).get("/api/usuarios").set(comToken(b))).body).toHaveLength(1);
      expect((await request(app).get("/api/ordens?busca=OS-0001").set(comToken(b))).body.total).toBe(0);
      expect((await request(app).get(`/api/ordens?tecnicoId=${tecnicoA}`).set(comToken(b))).body.total).toBe(0);
    });

    it("painel não conta dados de A", async () => {
      const r = await request(app).get("/api/dashboard").set(comToken(b));
      expect(r.body.emAberto).toBe(0);
      expect(r.body.ultimos30Dias.abertas).toBe(0);
      expect(r.body.abertasPorTecnico).toEqual([]);
    });

    it("leitura por id responde 404", async () => {
      const rotas = [
        `/api/clientes/${clienteA}`,
        `/api/equipamentos/${equipamentoA}`,
        `/api/equipamentos/${equipamentoA}/historico`,
        `/api/ordens/${osA}`,
        `/api/ordens/${osA}/comprovante`,
        `/api/diagnosticos/${sessaoA}`,
        `/api/conhecimento/${artigoA}`,
      ];
      for (const rota of rotas) {
        expect((await request(app).get(rota).set(comToken(b))).status, rota).toBe(404);
      }
    });

    it("alteração por id responde 404 e nada muda", async () => {
      const h = comToken(b);
      const tentativas: [string, string, object][] = [
        ["patch", `/api/clientes/${clienteA}`, { nome: "Invadido" }],
        ["patch", `/api/equipamentos/${equipamentoA}`, { marca: "Invadido" }],
        ["patch", `/api/ordens/${osA}`, { observacoes: "Invadido" }],
        ["patch", `/api/ordens/${osA}/status`, { status: "CANCELADO" }],
        ["post", `/api/ordens/${osA}/medicoes`, { pontoMedicao: "x", grandeza: "x", valor: 1, unidade: "V" }],
        ["post", `/api/ordens/${osA}/reparos`, { descricao: "Invadido" }],
        ["post", `/api/ordens/${osA}/diagnosticos`, { sintoma: "Invadido" }],
        ["post", `/api/diagnosticos/${sessaoA}/mensagens`, { texto: "Invadido" }],
        ["post", `/api/diagnosticos/${sessaoA}/continuar`, {}],
        ["post", `/api/diagnosticos/${sessaoA}/concluir`, { diagnosticoFinal: "Invadido" }],
        ["patch", `/api/conhecimento/${artigoA}`, { titulo: "Invadido" }],
        ["delete", `/api/conhecimento/${artigoA}`, {}],
        ["patch", `/api/usuarios/${tecnicoA}`, { nome: "Invadido" }],
      ];
      for (const [metodo, rota, corpo] of tentativas) {
        const r = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[metodo](rota).set(h).send(corpo);
        expect(r.status, `${metodo} ${rota}`).toBe(404);
      }
      const os = await request(app).get(`/api/ordens/${osA}`).set(comToken(a));
      expect(os.body.status).toBe("EM_DIAGNOSTICO");
      expect(os.body.observacoes).toBeNull();
      expect(os.body.cliente.nome).toBe("Cliente de A");
      expect(os.body.reparos).toHaveLength(0);
      expect(os.body.medicoes).toHaveLength(0);
      const sessao = await request(app).get(`/api/diagnosticos/${sessaoA}`).set(comToken(a));
      expect(sessao.body.status).toBe("ATIVA");
      expect((await request(app).get(`/api/conhecimento/${artigoA}`).set(comToken(a))).body.titulo).toBe("Artigo de A");
    });

    it("não associa registros de A aos cadastros de B", async () => {
      const h = comToken(b);
      expect((await request(app).post("/api/equipamentos").set(h).send({ clienteId: clienteA, tipo: "CELULAR", marca: "M", modelo: "M" })).status).toBe(404);
      expect((await request(app).post("/api/ordens").set(h).send({ clienteId: clienteA, equipamentoId: equipamentoA, defeitoRelatado: "Teste" })).status).toBe(404);

      const cliB = await request(app).post("/api/clientes").set(h).send({ nome: "Cliente de B", telefone: "99933334444" });
      const eqB = await request(app).post("/api/equipamentos").set(h).send({ clienteId: cliB.body.id, tipo: "CELULAR", marca: "M", modelo: "M" });
      // técnico de A não pode ser usado em uma OS de B
      expect((await request(app).post("/api/ordens").set(h).send({ clienteId: cliB.body.id, equipamentoId: eqB.body.id, defeitoRelatado: "Teste", tecnicoId: tecnicoA })).status).toBe(400);
      const osB = await request(app).post("/api/ordens").set(h).send({ clienteId: cliB.body.id, equipamentoId: eqB.body.id, defeitoRelatado: "Teste" });
      expect(osB.status).toBe(201);
      expect((await request(app).patch(`/api/ordens/${osB.body.id}/atribuir`).set(h).send({ tecnicoId: tecnicoA })).status).toBe(400);
      // técnico de A também não enxerga a OS sem técnico da empresa B
      expect((await request(app).get(`/api/ordens/${osB.body.id}`).set(comToken(tecnicoATokenConta))).status).toBe(404);
    });

    it("o contexto da IA usa só a base de conhecimento da própria empresa", async () => {
      let contexto = "";
      definirClienteIA(async (_s, mensagens) => {
        contexto = String(mensagens[0].content);
        return { mensagem: "ok", causasPossiveis: [], proximaEtapa: null, diagnosticoConcluido: false };
      });
      const cli = await request(app).post("/api/clientes").set(comToken(b)).send({ nome: "Outro de B", telefone: "99955556666" });
      const eq = await request(app).post("/api/equipamentos").set(comToken(b)).send({ clienteId: cli.body.id, tipo: "CELULAR", marca: "Moto", modelo: "G52" });
      const os = await request(app).post("/api/ordens").set(comToken(b)).send({ clienteId: cli.body.id, equipamentoId: eq.body.id, defeitoRelatado: "sem imagem" });
      const r = await request(app).post(`/api/ordens/${os.body.id}/diagnosticos`).set(comToken(b)).send({ sintoma: "sem imagem" });
      expect(r.status).toBe(201);
      expect(contexto).toContain("sem imagem");
      expect(contexto).not.toContain("Conteúdo exclusivo da empresa A");

      const concluida = await request(app).post(`/api/diagnosticos/${r.body.sessao.id}/concluir`).set(comToken(b)).send({ diagnosticoFinal: "Defeito em B", salvarNaBase: true });
      expect(concluida.body.artigo.empresaId).toBe(b.empresaId);
      expect((await request(app).get(`/api/conhecimento/${concluida.body.artigo.id}`).set(comToken(a))).status).toBe(404);
    });
  });

  describe("regras dentro da empresa", () => {
    it("o mesmo CPF pode existir em empresas diferentes, mas não repetir na mesma", async () => {
      expect((await request(app).post("/api/clientes").set(comToken(b)).send({ nome: "Mesmo CPF", telefone: "99911112222", cpf: "12345678901" })).status).toBe(201);
      expect((await request(app).post("/api/clientes").set(comToken(a)).send({ nome: "Mesmo CPF", telefone: "99911112222", cpf: "12345678901" })).status).toBe(409);
    });

    it("a numeração da OS é própria de cada empresa e não repete com pedidos simultâneos", async () => {
      const c = await novaEmpresa(`num${sufixo.slice(-4)}`);
      const cli = await request(app).post("/api/clientes").set(comToken(c)).send({ nome: "Cliente C", telefone: "99977778888" });
      const eq = await request(app).post("/api/equipamentos").set(comToken(c)).send({ clienteId: cli.body.id, tipo: "CELULAR", marca: "M", modelo: "M" });
      const respostas = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app).post("/api/ordens").set(comToken(c)).send({ clienteId: cli.body.id, equipamentoId: eq.body.id, defeitoRelatado: "Simultânea" }),
        ),
      );
      expect(respostas.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(respostas.map((r) => r.body.numero).sort()).toEqual([1, 2, 3, 4, 5]);
      const busca = await request(app).get("/api/ordens?busca=OS-0003").set(comToken(c));
      expect(busca.body.dados.map((o: { numero: number }) => o.numero)).toEqual([3]);
    });

    it("o administrador não desativa nem rebaixa a própria conta", async () => {
      const me = await request(app).get("/api/auth/me").set(comToken(b));
      expect((await request(app).patch(`/api/usuarios/${me.body.id}`).set(comToken(b)).send({ ativo: false })).status).toBe(400);
      expect((await request(app).patch(`/api/usuarios/${me.body.id}`).set(comToken(b)).send({ perfil: "TECNICO" })).status).toBe(400);
    });
  });
});
