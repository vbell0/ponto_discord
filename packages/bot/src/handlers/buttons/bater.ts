import { ButtonInteraction, GuildMember } from "discord.js";
import { prisma } from "@ponto/database";
import { PontoStatus, PontoEventType } from "@ponto/shared";
import { upsertMember, findOpenSession } from "../../services/ponto.js";

export async function handleBater(
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
  const discordId = interaction.user.id;
  const displayName = member.displayName ?? interaction.user.username;

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) {
    await interaction.reply({
      ephemeral: true,
      content:
        "Servidor não encontrado no banco. Adicione o bot e configure o canal no site.",
    });
    return;
  }

  // Regra 5.1 — canal de voz obrigatório.
  const voiceChannelId = member.voice?.channelId ?? null;
  if (!voiceChannelId) {
    await interaction.reply({
      ephemeral: true,
      content:
        "Você precisa estar em um canal de voz permitido para bater ponto.",
    });
    return;
  }
  if (
    guild.allowedVoiceChannelIds.length > 0 &&
    !guild.allowedVoiceChannelIds.includes(voiceChannelId)
  ) {
    await interaction.reply({
      ephemeral: true,
      content:
        "Você precisa estar em um canal de voz permitido para bater ponto.",
    });
    return;
  }

  // Regra 5.4 — um ponto por vez.
  const dbMember = await upsertMember(guildId, discordId, displayName);
  const open = await findOpenSession(dbMember.id);
  if (open) {
    await interaction.reply({
      ephemeral: true,
      content:
        "Você já tem um ponto em andamento. Feche o ponto atual antes de bater um novo.",
    });
    return;
  }

  const session = await prisma.pontoSession.create({
    data: { memberId: dbMember.id, status: PontoStatus.ABERTO },
  });
  await prisma.pontoEvent.create({
    data: { sessionId: session.id, type: PontoEventType.INICIO },
  });

  await interaction.reply({
    ephemeral: true,
    content: "✅ Ponto batido! Sua jornada foi iniciada.",
  });
}
