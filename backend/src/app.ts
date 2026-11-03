import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { autenticar } from "./middlewares/auth";
import { errorHandler } from "./middlewares/errorHandler";
import { authRoutes } from "./modules/auth.routes";
import { usuariosRoutes } from "./modules/usuarios.routes";
import { clientesRoutes } from "./modules/clientes.routes";
import { equipamentosRoutes } from "./modules/equipamentos.routes";
import { ordensRoutes } from "./modules/ordens.routes";
import { diagnosticosRoutes } from "./modules/diagnosticos.routes";
import { conhecimentoRoutes } from "./modules/conhecimento.routes";
import { dashboardRoutes } from "./modules/dashboard.routes";

export function criarApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false })); // CSP desativada para o comprovante HTML imprimível
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", servico: "inforcell-os-backend", ia: Boolean(env.ANTHROPIC_API_KEY) });
  });

  // Rotas públicas
  app.use("/api/auth", authRoutes);

  // Daqui em diante exige login (RNF02)
  const api = express.Router();
  api.use(autenticar);
  api.use("/usuarios", usuariosRoutes);
  api.use("/clientes", clientesRoutes);
  api.use("/equipamentos", equipamentosRoutes);
  api.use("/ordens", ordensRoutes);
  api.use("/conhecimento", conhecimentoRoutes);
  api.use("/dashboard", dashboardRoutes);
  api.use("/", diagnosticosRoutes); // /ordens/:osId/diagnosticos e /diagnosticos/:id
  app.use("/api", api);

  app.use("/api", (_req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
  app.use(errorHandler);
  return app;
}
