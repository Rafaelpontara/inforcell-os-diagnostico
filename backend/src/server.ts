import { env } from "./config/env";
import { criarApp } from "./app";
import { prisma } from "./lib/prisma";

const app = criarApp();

const server = app.listen(env.PORT, () => {
  console.log(`Inforcell OS API rodando em http://localhost:${env.PORT}/api`);
  if (!env.ANTHROPIC_API_KEY) console.warn("Aviso: ANTHROPIC_API_KEY não definida — o diagnóstico com IA ficará indisponível.");
});

async function encerrar() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
