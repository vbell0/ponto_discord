import express, {
  Express,
  Request,
  Response,
  NextFunction,
} from "express";
import { Client } from "discord.js";
import { config } from "../config.js";
import { refreshHandler } from "./routes/refresh.js";
import { backupHandler } from "./routes/backup.js";
import { fecharHandler } from "./routes/fechar.js";

// Middleware: toda a API interna exige o INTERNAL_API_SECRET (compartilhado com o
// site). Nunca exposta publicamente — só-rota interna do Docker Compose.
function requireInternalSecret(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const provided = req.header("x-internal-api-secret") ?? "";
  if (!config.internalApiSecret || provided !== config.internalApiSecret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

export function createInternalApi(client: Client): Express {
  const app = express();
  app.use(express.json());
  app.use(requireInternalSecret);

  app.get("/internal/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "ponto-bot-internal-api" });
  });

  // Fase 2: republica/edita o painel a partir da config do banco.
  app.post("/internal/refresh", refreshHandler(client));

  // Fase 5: disparo manual de backup (ignora o toggle).
  app.post("/internal/backup", backupHandler(client));

  // Fase 7: forçar fechamento de um ponto pelo admin (site → bot).
  app.post("/internal/ponto/:id/fechar", fecharHandler(client));

  // Fases seguintes: ...

  return app;
}

export function startInternalApi(client: Client): void {
  const app = createInternalApi(client);
  app.listen(config.internalApiPort, () => {
    console.log(
      `[bot] internal-api ouvindo em :${config.internalApiPort} (requer INTERNAL_API_SECRET)`,
    );
  });
}
