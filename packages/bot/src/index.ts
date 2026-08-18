import { createClient } from "./client.js";
import { config, hasDiscordToken } from "./config.js";
import { registerReady } from "./events/ready.js";
import { registerGuildCreate } from "./events/guildCreate.js";
import { registerInteractionCreate } from "./events/interactionCreate.js";
import { registerVoiceStateUpdate } from "./events/voiceStateUpdate.js";
import { startScheduler } from "./services/scheduler.js";
import { startInternalApi } from "./internal-api/server.js";

async function main(): Promise<void> {
  // 1) Cliente Discord + registro de handlers/eventos.
  const client = createClient();
  registerReady(client);
  registerGuildCreate(client);
  registerInteractionCreate(client);
  registerVoiceStateUpdate(client);

  // 2) Crons dos canais automáticos (top10, abertos, poll de config).
  startScheduler(client);

  // 3) API interna sobe independente do login do Discord (testável sem token).
  startInternalApi(client);

  // 3) Login no gateway (só se houver token configurado).
  if (hasDiscordToken) {
    await client.login(config.discordToken);
  } else {
    console.warn(
      "[bot] DISCORD_TOKEN não definido — não conectando ao gateway. " +
        "A internal-api continua disponível para testes locais.",
    );
  }
}

main().catch((err) => {
  console.error("[bot] Erro fatal:", err);
  process.exit(1);
});
