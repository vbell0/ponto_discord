import { ButtonInteraction, GuildMember } from "discord.js";
import { prisma } from "@ponto/database";
import { ClosedReason } from "@ponto/shared";
import {
  upsertMember,
  findOpenSession,
  closeSession,
  formatDuration,
} from "../../services/ponto.js";

export async function handleFechar(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.isRepliable()) return;
  if (!interaction.inGuild()) {
    await interaction.reply({
      ephemeral: true,
      content: "Este botão só funciona dentro de um servidor.",
    });
    return;
  }

  const guildId = interaction.guildId;
  const member = interaction.member as GuildMember;
  const dbMember = await upsertMember(
    guildId,
    interaction.user.id,
    member.displayName ?? interaction.user.username,
  );
  const open = await findOpenSession(dbMember.id);
  if (!open) {
    await interaction.reply({
      ephemeral: true,
      content: "Você não tem ponto em andamento.",
    });
    return;
  }

  const result = await closeSession(open.id, ClosedReason.MANUAL);
  if (!result) {
    await interaction.reply({
      ephemeral: true,
      content: "Seu ponto já foi fechado.",
    });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: `🏁 Ponto fechado. Tempo total: ${formatDuration(result.totalSeconds)}.`,
  });
}
