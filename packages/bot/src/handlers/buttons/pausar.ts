import { ButtonInteraction, GuildMember } from "discord.js";
import { prisma } from "@ponto/database";
import { PontoStatus, PontoEventType } from "@ponto/shared";
import { upsertMember, findOpenSession } from "../../services/ponto.js";

export async function handlePausar(
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
  if (open.status === PontoStatus.PAUSADO) {
    await interaction.reply({
      ephemeral: true,
      content: "Seu ponto já está pausado.",
    });
    return;
  }

  await prisma.pontoEvent.create({
    data: { sessionId: open.id, type: PontoEventType.PAUSA },
  });
  await prisma.pontoSession.update({
    where: { id: open.id },
    data: { status: PontoStatus.PAUSADO },
  });

  await interaction.reply({ ephemeral: true, content: "⏸️ Ponto pausado." });
}
