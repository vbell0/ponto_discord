import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { assertGuildAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

// Histórico de sessões de um membro (para o painel de detalhe em /membros).
export async function GET(
  _req: Request,
  { params }: { params: { guildId: string; memberId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const sessions = await prisma.pontoSession.findMany({
    where: { memberId: params.memberId, member: { guildId: params.guildId } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
      status: s.status,
      totalSeconds: s.totalSeconds,
      closedReason: s.closedReason,
    })),
  });
}