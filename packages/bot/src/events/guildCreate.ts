import { Client, Events, Guild } from "discord.js";
import { prisma } from "@ponto/database";
import {
  DEFAULT_ORG_NAME,
  DEFAULT_EMBED_COLOR,
  DEFAULT_AUTO_CLOSE_SECONDS,
  DEFAULT_BACKUP_ENABLED,
} from "@ponto/shared";

// Quando o bot é adicionado a um servidor, registramos a Guild no banco.
// Não sobrescreve campos que o admin já configurou no site (apenas atualiza o nome).
export function registerGuildCreate(client: Client): void {
  client.on(Events.GuildCreate, async (guild: Guild) => {
    try {
      await prisma.guild.upsert({
        where: { id: guild.id },
        create: {
          id: guild.id,
          name: guild.name,
          orgName: DEFAULT_ORG_NAME,
          embedColor: DEFAULT_EMBED_COLOR,
          autoCloseSeconds: DEFAULT_AUTO_CLOSE_SECONDS,
          backupEnabled: DEFAULT_BACKUP_ENABLED,
        },
        update: {
          name: guild.name,
        },
      });
      console.log(`[bot] Guild registrada/atualizada: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`[bot] Erro ao upsert de Guild ${guild.id}:`, err);
    }
  });
}
