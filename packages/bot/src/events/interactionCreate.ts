import { Client, Events, Interaction } from "discord.js";
import { handleButtonInteraction } from "../handlers/buttons/index.js";

// Única interaction do bot são os botões do painel de ponto (sem slash commands,
// sem leitura de mensagem — ver plano, seção 6).
export function registerInteractionCreate(client: Client): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      }
      // Fases futuras podem tratar modais/select menus aqui.
    } catch (err) {
      console.error("[bot] Erro em InteractionCreate:", err);
    }
  });
}
