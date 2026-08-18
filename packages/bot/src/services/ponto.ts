import { prisma } from "@ponto/database";
import { PontoStatus, PontoEventType, ClosedReason } from "@ponto/shared";
import type { PontoSession, PontoEvent } from "@prisma/client";

// Garante que existe um Member (discordId + guildId) e atualiza o displayName.
export async function upsertMember(
  guildId: string,
  discordId: string,
  displayName: string,
) {
  return prisma.member.upsert({
    where: { discordId_guildId: { discordId, guildId } },
    create: { discordId, guildId, displayName },
    update: { displayName },
  });
}

// Sessão em andamento (ABERTO ou PAUSADO) mais recente do membro. (Regra 5.4)
export async function findOpenSession(
  memberId: string,
): Promise<PontoSession | null> {
  return prisma.pontoSession.findFirst({
    where: {
      memberId,
      status: { in: [PontoStatus.ABERTO, PontoStatus.PAUSADO] },
    },
    orderBy: { startedAt: "desc" },
  });
}

// Fecha uma sessão aberta: grava PontoEvent(FIM), calcula totalSeconds líquido
// e marca status/fim. Compartilhado entre o botão "Fechar" e o auto-close (Fase 3).
export async function closeSession(
  sessionId: string,
  reason: ClosedReason,
): Promise<{ totalSeconds: number; memberId: string } | null> {
  const session = await prisma.pontoSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.status === PontoStatus.FECHADO) return null;

  const now = new Date();
  await prisma.pontoEvent.create({
    data: { sessionId, type: PontoEventType.FIM },
  });
  const events = await prisma.pontoEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  const totalSeconds = computeTotalSeconds(events, now);

  await prisma.pontoSession.update({
    where: { id: sessionId },
    data: {
      status: PontoStatus.FECHADO,
      closedReason: reason,
      endedAt: now,
      totalSeconds,
    },
  });

  return { totalSeconds, memberId: session.memberId };
}

// Tempo líquido (descontando pausas): soma os intervalos entre
// INICIO/RETOMADA e a próxima PAUSA/FIM. (Regra 5.3)
export function computeTotalSeconds(
  events: PontoEvent[],
  endedAt: Date,
): number {
  let totalMs = 0;
  let openStart: number | null = null;

  const sorted = [...events].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  for (const ev of sorted) {
    if (
      ev.type === PontoEventType.INICIO ||
      ev.type === PontoEventType.RETOMADA
    ) {
      openStart = ev.createdAt.getTime();
    } else if (
      (ev.type === PontoEventType.PAUSA || ev.type === PontoEventType.FIM) &&
      openStart !== null
    ) {
      const end =
        ev.type === PontoEventType.FIM
          ? endedAt.getTime()
          : ev.createdAt.getTime();
      totalMs += end - openStart;
      openStart = null;
    }
  }

  return Math.floor(totalMs / 1000);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
