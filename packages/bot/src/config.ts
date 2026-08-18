import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Carrega o .env da raiz do monorepo (src -> bot -> packages -> root = 3 níveis).
loadEnv({ path: resolve(__dirname, "../../../.env") });

export const config = {
  discordToken: process.env.DISCORD_TOKEN ?? "",
  discordClientId: process.env.DISCORD_CLIENT_ID ?? "",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
  internalApiPort: Number(process.env.INTERNAL_API_PORT ?? 4000),
  internalApiUrl: process.env.INTERNAL_API_URL ?? "http://bot:4000",
  databaseUrl: process.env.DATABASE_URL ?? "",
  backupCron: process.env.BACKUP_CRON ?? "0 * * * *",
};

export const hasDiscordToken = config.discordToken.length > 0;
