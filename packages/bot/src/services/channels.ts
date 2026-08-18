import { Client, EmbedBuilder } from "discord.js";
import { prisma } from "@ponto/database";
import { PontoStatus, PontoEventType, RankingPeriod } from "@ponto/shared";
import { formatDuration } from "./ponto.js";
import { parseColor, sendOrEditEmbed } from "./discord.js";
import { publishPanelForGuild } from "./panel.js";

// ---- Top 10 horas ----

function periodStart(period: RankingPeriod): Date {
  const now = new Date();
  const d = new Date(now);
  // Janela móvel simples: SEMANA = 7 dias, MES = 30 dias.
  d.setDate(now.getDate() - (period === RankingPeriod.MES ? 30 : 7));
  return d;
}

export async function getTop10(
  guildId: string,
  since: Date,
): Promise<{ displayName: string; totalSeconds: number }[]> {
  const rows = await prisma.pontoSession.groupBy({
    by: ["memberId"],
    where: {
      status: PontoStatus.FECHADO,
      endedAt: { gte: since },
      member: { guildId },
    },
    _sum: { totalSeconds: true },
    orderBy: { _sum: { totalSeconds: "desc" } },
    take: 10,
  });
  const memberIds = rows.map((r) => r.memberId);
  const members = await prisma.member.findMany({
    where: { id: { in: memberIds } },
  });
  const nameById = new Map(members.map((m) => [m.id, m.displayName]));
  return rows
    .map((r) => ({
      displayName: nameById.get(r.memberId) ?? "?",
      totalSeconds: r._sum.totalSeconds ?? 0,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export async function publishTop10ForGuild(
  client: Client,
  guildId: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild || !guild.top10ChannelId) return;

  const top = await getTop10(guildId, periodStart(guild.rankingPeriod));
  const periodLabel =
    guild.rankingPeriod === RankingPeriod.MES ? "mês" : "semana";

  const embed = new EmbedBuilder()
    .setTitle(`${guild.orgName} — Top 10 horas (${periodLabel})`)
    .setColor(parseColor(guild.embedColor))
    .setTimestamp();

  embed.setDescription(
    top.length === 0
      ? "Ainda não há pontos fechados no período."
      : top
          .map(
            (t, i) =>
              `**${i + 1}.** ${t.displayName} — ${formatDuration(t.totalSeconds)}`,
          )
          .join("\n"),
  );

  await sendOrEditEmbed(
    client,
    guild.top10ChannelId,
    guild.top10MessageId,
    embed,
    (msgId) =>
      prisma.guild.update({
        where: { id: guildId },
        data: { top10MessageId: msgId },
      }),
  );
}

// ---- Pontos abertos ----

type OpenSessionLike = {
  status: PontoStatus;
  startedAt: Date;
  events: { type: PontoEventType; createdAt: Date }[];
};

function currentElapsed(session: OpenSessionLike, now: Date): number {
  const reversed = [...session.events].reverse();
  let t0: number;
  if (session.status === PontoStatus.PAUSADO) {
    const last = reversed.find((e) => e.type === PontoEventType.PAUSA);
    t0 = last ? last.createdAt.getTime() : session.startedAt.getTime();
  } else {
    const last = reversed.find(
      (e) =>
        e.type === PontoEventType.INICIO || e.type === PontoEventType.RETOMADA,
    );
    t0 = last ? last.createdAt.getTime() : session.startedAt.getTime();
  }
  return Math.max(0, Math.floor((now.getTime() - t0) / 1000));
}

export async function getOpenSessions(
  guildId: string,
  now: Date = new Date(),
): Promise<{ displayName: string; status: PontoStatus; elapsedSeconds: number }[]> {
  const open = await prisma.pontoSession.findMany({
    where: {
      status: { in: [PontoStatus.ABERTO, PontoStatus.PAUSADO] },
      member: { guildId },
    },
    include: { member: true, events: { orderBy: { createdAt: "asc" } } },
  });
  return open.map((s) => ({
    displayName: s.member.displayName,
    status: s.status,
    elapsedSeconds: currentElapsed(s, now),
  }));
}

export async function publishAbertosForGuild(
  client: Client,
  guildId: string,
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild || !guild.abertosChannelId) return;

  const open = await getOpenSessions(guildId);
  const lines = open.map((s) => {
    const label =
      s.status === PontoStatus.PAUSADO ? "⏸ Pausado" : "🟢 Aberto";
    return `${s.displayName} — ${label} (${formatDuration(s.elapsedSeconds)})`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${guild.orgName} — Pontos Abertos`)
    .setColor(parseColor(guild.embedColor))
    .setTimestamp();

  embed.setDescription(
    lines.length === 0
      ? "Ninguém com ponto aberto no momento."
      : lines.join("\n"),
  );

  await sendOrEditEmbed(
    client,
    guild.abertosChannelId,
    guild.abertosMessageId,
    embed,
    (msgId) =>
      prisma.guild.update({
        where: { id: guildId },
        data: { abertosMessageId: msgId },
      }),
  );
}

// Publica/edita os 3 embeds de uma guild (painel + top10 + abertos).
export async function publishAllEmbedsForGuild(
  client: Client,
  guildId: string,
): Promise<void> {
  await publishPanelForGuild(client, guildId);
  await publishTop10ForGuild(client, guildId);
  await publishAbertosForGuild(client, guildId);
}
