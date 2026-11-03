/**
 * Dados iniciais para desenvolvimento e apresentação.
 * Executar: npm run db:seed
 * Todos os usuários de teste usam a senha: inforcell123
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("inforcell123", 10);

  const usuarios = [
    { nome: "Administrador", email: "admin@inforcell.local", perfil: "ADMIN" as const },
    { nome: "Atendente", email: "atendente@inforcell.local", perfil: "ATENDENTE" as const },
    { nome: "Técnico", email: "tecnico@inforcell.local", perfil: "TECNICO" as const },
  ];
  const criados: Record<string, number> = {};
  for (const u of usuarios) {
    const r = await prisma.usuario.upsert({ where: { email: u.email }, update: {}, create: { ...u, senhaHash } });
    criados[u.perfil] = r.id;
  }

  if ((await prisma.cliente.count()) === 0) {
    const maria = await prisma.cliente.create({
      data: { nome: "Maria Silva (exemplo)", telefone: "99900000001" },
    });
    const joao = await prisma.cliente.create({ data: { nome: "João Souza (exemplo)", telefone: "99900000002" } });

    const iphone = await prisma.equipamento.create({
      data: { clienteId: maria.id, tipo: "CELULAR", marca: "Apple", modelo: "iPhone 11" },
    });
    const note = await prisma.equipamento.create({
      data: { clienteId: joao.id, tipo: "NOTEBOOK", marca: "Dell", modelo: "Inspiron 15 3000" },
    });

    await prisma.ordemServico.create({
      data: {
        clienteId: maria.id,
        equipamentoId: iphone.id,
        atendenteId: criados.ATENDENTE,
        defeitoRelatado: "Aparelho não liga após cair na água.",
        historico: { create: { usuarioId: criados.ATENDENTE, para: "RECEBIDO", observacao: "Abertura da OS" } },
      },
    });
    await prisma.ordemServico.create({
      data: {
        clienteId: joao.id,
        equipamentoId: note.id,
        atendenteId: criados.ATENDENTE,
        tecnicoId: criados.TECNICO,
        defeitoRelatado: "Notebook não carrega a bateria; só funciona na tomada.",
        historico: { create: { usuarioId: criados.ATENDENTE, para: "RECEBIDO", observacao: "Abertura da OS" } },
      },
    });
  }

  if ((await prisma.artigoConhecimento.count()) === 0) {
    await prisma.artigoConhecimento.createMany({
      data: [
        {
          titulo: "Celular não liga — roteiro inicial com fonte de bancada",
          tipoEquipamento: "CELULAR",
          sintoma: "não liga, sem imagem, sem vibração",
          conteudo:
            "1) Inspeção visual (oxidação, conector de bateria). 2) Testar com bateria conhecida ou fonte de bancada (3,8–4,2 V). " +
            "3) Observar consumo ao conectar: consumo alto imediato indica curto na linha principal; consumo zero ao pressionar Power indica " +
            "falha no botão, no flex ou no circuito de partida. 4) Em caso de curto, localizar com injeção de tensão baixa e câmera térmica.",
          tags: "nao liga, consumo, fonte de bancada, curto",
        },
        {
          titulo: "Notebook não carrega bateria",
          tipoEquipamento: "NOTEBOOK",
          sintoma: "não carrega bateria, só funciona na tomada",
          conteudo:
            "1) Conferir carregador original (tensão e identificação do pino central em Dell/HP). 2) Testar outra bateria. " +
            "3) Verificar no BIOS se a bateria é reconhecida. 4) Medir tensão no conector da bateria e no circuito do carregador (charger IC).",
          tags: "carregamento, bateria, dell, pino central",
        },
      ],
    });
  }

  console.log("Seed concluído. Usuários: admin@, atendente@ e tecnico@inforcell.local — senha inforcell123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
