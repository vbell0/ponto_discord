import {
  Client,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { prisma } from "@ponto/database";
import { PONTO_BUTTONS } from "@ponto/shared";
import { parseColor, sendOrEditEmbed } from "./discord.js";

// Embed do painel — título/cor vêm da identidade whitelabel (Guild).
export function buildPanelEmbed(guild: {
  orgName: string;
  embedColor: string;
}): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${guild.orgName} — Ponto`)
    .setDescription(
      "Use os botões abaixo para bater, pausar, retomar e fechar o seu ponto.\n" +
        "Você precisa estar em um canal de voz permitido para bater o ponto.",
    )
    .setColor(parseColor(guild.embedColor))
    .setTimestamp();
}

// 4 botões com customIds fixos (reidratados no ready — sobrevivem a restart).
export function buildPanelButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PONTO_BUTTONS.BATER)
      .setLabel("Bater Ponto")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PONTO_BUTTONS.PAUSAR)
      .setLabel("Pausar")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PONTO_BUTTONS.RETOMAR)
      .setLabel("Retomar")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PONTO_BUTTONS.FECHAR)
      .setLabel("Fechar Ponto")
      .setStyle(ButtonStyle.Danger),
  );
}

// Publica (ou edita, se já existir) o painel de ponto de uma guild.
// Lê canal/cor/nome do banco — sem nenhum comando.
export async function publishPanelForGuild(
  client: Client,
  guildId: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild || !guild.painelChannelId) return; // sem canal configurado ainda

  const embed = buildPanelEmbed(guild);
  const row = buildPanelButtons();

  await sendOrEditEmbed(
    client,
    guild.painelChannelId,
    guild.painelMessageId,
    embed,
    (msgId) =>
      prisma.guild.update({ where: { id: guildId }, data: { painelMessageId: msgId } }),
    [row],
  );
}

// Publica o painel de todas as guilds visíveis (usado no ready e no refresh).
export async function publishAllPanels(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      await publishPanelForGuild(client, guild.id);
    } catch (err) {
      console.error(`[bot] Falha ao publicar painel para ${guild.id}:`, err);
    }
  }
}
