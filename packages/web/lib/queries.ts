import { prisma } from "@ponto/database";
import { PontoStatus } from "@ponto/shared";

export type AnalyticsData = {
  summary: { totalSessions: number; totalSeconds: number; activeMembers: number };
  perDay: { date: string; totalSeconds: number }[];
  ranking: { memberId: string; displayName: string; totalSeconds: number }[];
  heatmap: number[][]; // [weekday 0=Dom..6=Sáb][hour 0..23]
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Aggrega pontos fechados no período (e opcionalmente de um membro) em:
// resumo, horas por dia (linha), ranking por membro (barra) e heatmap
// dia-da-semana × hora (inicícios de sessão).
export async function getAnalytics(
  guildId: string,
  since: Date,
  memberId?: string,
): Promise<AnalyticsData> {
  const sessions = await prisma.pontoSession.findMany({
    where: {
      status: PontoStatus.FECHADO,
      endedAt: { gte: since },
      member: memberId ? { guildId, id: memberId } : { guildId },
    },
    include: { member: true },
    orderBy: { endedAt: "asc" },
  });

  const perDayMap = new Map<string, number>();
  const rankingMap = new Map<string, { displayName: string; totalSeconds: number }>();
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );

  for (const s of sessions) {
    if (s.totalSeconds == null || !s.endedAt) continue;
    const dk = dayKey(s.endedAt);
    perDayMap.set(dk, (perDayMap.get(dk) ?? 0) + s.totalSeconds);

    const cur = rankingMap.get(s.memberId) ?? {
      displayName: s.member.displayName,
      totalSeconds: 0,
    };
    cur.totalSeconds += s.totalSeconds;
    rankingMap.set(s.memberId, cur);

    const start = s.startedAt;
    heatmap[start.getDay()][start.getHours()] += 1;
  }

  const perDay = [...perDayMap.entries()]
    .map(([date, totalSeconds]) => ({ date, totalSeconds }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ranking = [...rankingMap.entries()]
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 10);

  const totalSeconds = sessions.reduce((a, s) => a + (s.totalSeconds ?? 0), 0);
  const activeMembers = new Set(sessions.map((s) => s.memberId)).size;

  return {
    summary: {
      totalSessions: sessions.length,
      totalSeconds,
      activeMembers,
    },
    perDay,
    ranking,
    heatmap,
  };
}

export type MemberRow = {
  id: string;
  discordId: string;
  displayName: string;
  totalSeconds: number;
  openSessionId: string | null;
  openStatus: PontoStatus | null;
};

// Lista de membros com horas totais (sessões fechadas) e, se houver, a sessão
// aberta (para o botão "forçar fechar").
export async function getMembers(guildId: string): Promise<MemberRow[]> {
  const members = await prisma.member.findMany({ where: { guildId } });

  const closed = await prisma.pontoSession.groupBy({
    by: ["memberId"],
    where: { status: PontoStatus.FECHADO, member: { guildId } },
    _sum: { totalSeconds: true },
  });
  const totalByMember = new Map(
    closed.map((c) => [c.memberId, c._sum.totalSeconds ?? 0]),
  );

  const open = await prisma.pontoSession.findMany({
    where: {
      status: { in: [PontoStatus.ABERTO, PontoStatus.PAUSADO] },
      member: { guildId },
    },
    select: { id: true, memberId: true, status: true },
  });
  const openByMember = new Map<string, { id: string; status: PontoStatus }>();
  for (const o of open) {
    openByMember.set(o.memberId, { id: o.id, status: o.status });
  }

  return members.map((m) => {
    const op = openByMember.get(m.id);
    return {
      id: m.id,
      discordId: m.discordId,
      displayName: m.displayName,
      totalSeconds: totalByMember.get(m.id) ?? 0,
      openSessionId: op?.id ?? null,
      openStatus: op?.status ?? null,
    };
  });
}

export type SessionRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: PontoStatus;
  totalSeconds: number | null;
  closedReason: string | null;
};

// Histórico de sessões de um membro (para o painel de detalhe).
export async function getMemberSessions(
  guildId: string,
  memberId: string,
): Promise<SessionRow[]> {
  const sessions = await prisma.pontoSession.findMany({
    where: { memberId, member: { guildId } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    status: s.status,
    totalSeconds: s.totalSeconds,
    closedReason: s.closedReason,
  }));
}

export type BackupRow = {
  id: string;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  success: boolean;
  errorMsg: string | null;
  discordChannelId: string | null;
  discordMessageId: string | null;
};

export async function getBackupLogs(guildId: string): Promise<BackupRow[]> {
  const logs = await prisma.backupLog.findMany({
    where: { guildId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return logs.map((l) => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    fileName: l.fileName,
    sizeBytes: l.sizeBytes,
    success: l.success,
    errorMsg: l.errorMsg,
    discordChannelId: l.discordChannelId,
    discordMessageId: l.discordMessageId,
  }));
}

export async function getGuildConfig(guildId: string) {
  return prisma.guild.findUnique({ where: { id: guildId } });
}
