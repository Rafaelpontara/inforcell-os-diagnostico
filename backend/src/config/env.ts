import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter ao menos 16 caracteres").default("dev-secret-inforcell-trocar"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
});

export const env = schema.parse(process.env);

if (env.NODE_ENV === "production" && env.JWT_SECRET === "dev-secret-inforcell-trocar") {
  throw new Error("Defina JWT_SECRET no ambiente de produção.");
}
