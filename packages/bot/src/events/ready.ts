import { Client, Events } from "discord.js";
import { publishAllEmbedsForGuild } from "../services/channels.js";

export function registerReady(client: Client): void {
  client.once(Events.ClientReady, async (c) => {
    console.log(`[bot] Pronto! Logado como ${c.user.tag} (${c.user.id})`);
    console.log(`[bot] Servidores visíveis: ${c.guilds.cache.size}`);
    console.log("[bot] Publicando painéis/embeds automáticos...");
    for (const guild of client.guilds.cache.values()) {
      try {
        await publishAllEmbedsForGuild(client, guild.id);
      } catch (err) {
        console.error(`[bot] Falha ao publicar embeds para ${guild.id}:`, err);
      }
    }
    console.log("[bot] Embeds publicados.");
  });
}
