import { ButtonInteraction } from "discord.js";
import { PONTO_BUTTONS, PontoButtonCustomId } from "@ponto/shared";
import { handleBater } from "./bater.js";
import { handlePausar } from "./pausar.js";
import { handleRetomar } from "./retomar.js";
import { handleFechar } from "./fechar.js";

type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

// Roteamento dos botões do painel de ponto por customId fixo.
const handlers: Record<PontoButtonCustomId, ButtonHandler> = {
  [PONTO_BUTTONS.BATER]: handleBater,
  [PONTO_BUTTONS.PAUSAR]: handlePausar,
  [PONTO_BUTTONS.RETOMAR]: handleRetomar,
  [PONTO_BUTTONS.FECHAR]: handleFechar,
};

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  const handler = handlers[interaction.customId as PontoButtonCustomId];
  if (!handler) {
    console.warn(`[bot] customId de botão sem handler: ${interaction.customId}`);
    if (interaction.isRepliable()) {
      await interaction.reply({ ephemeral: true, content: "Ação desconhecida." });
    }
    return;
  }
  await handler(interaction);
}
