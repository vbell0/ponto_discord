import cron from "node-cron";
import { Client } from "discord.js";
import { prisma } from "@ponto/database";
import { config } from "../config.js";
import {
  publishTop10ForGuild,
  publishAbertosForGuild,
  publishAllEmbedsForGuild,
} from "./channels.js";
import { runBackupAll } from "./backup.js";

// Guarda o updatedAt já processado de cada guild, para o poll de config
// só republicar quando algo realmente mudou.
const lastSeenUpdatedAt = new Map<string, number>();

async function forEachVisibleGuild(
  client: Client,
  fn: (guildId: string) => Promise<void>,
): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      await fn(guild.id);
    } catch (err) {
      console.error(`[bot] Erro ao processar guild ${guild.id}:`, err);
    }
  }
}

// Agenda os crons dos canais automáticos (seção 4).
export function startScheduler(client: Client): void {
  // #top-10-horas: a cada 5 minutos.
  cron.schedule("*/5 * * * *", () => {
    void forEachVisibleGuild(client, (id) => publishTop10ForGuild(client, id));
  });

  // #pontos-abertos: a cada 30 segundos.
  cron.schedule("*/30 * * * * *", () => {
    void forEachVisibleGuild(client, (id) => publishAbertosForGuild(client, id));
  });

  // Poll de config (60s): se a Guild mudou (updatedAt), republica os embeds.
  // Rede de segurança caso a chamada interna /internal/refresh falhe.
  cron.schedule("* * * * *", () => {
    void pollConfigChanges(client);
  });

  // Backup automático (1 em 1h, respeitando Guild.backupEnabled).
  cron.schedule(config.backupCron, () => {
    void runBackupAll(client);
  });
}

async function pollConfigChanges(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const g = await prisma.guild.findUnique({ where: { id: guild.id } });
      if (!g) continue;
      const ts = g.updatedAt.getTime();
      const seen = lastSeenUpdatedAt.get(guild.id);
      if (seen === undefined || ts > seen) {
        await publishAllEmbedsForGuild(client, guild.id);
        lastSeenUpdatedAt.set(guild.id, ts);
      }
    } catch (err) {
      console.error(`[bot] Erro no poll de config para ${guild.id}:`, err);
    }
  }
}
