import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { PontoStatus } from "@ponto/shared";
import { assertGuildAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

function sinceFromPeriod(period: string): Date {
  const days = period === "30" ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

// Exporta as sessões do período em CSV (Fase 9 estende para Excel).
export async function GET(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "7";
  const memberId = url.searchParams.get("memberId") ?? undefined;

  const sessions = await prisma.pontoSession.findMany({
    where: {
      status: PontoStatus.FECHADO,
      endedAt: { gte: sinceFromPeriod(period) },
      member: memberId ? { guildId: params.guildId, id: memberId } : { guildId: params.guildId },
    },
    include: { member: true },
    orderBy: { endedAt: "asc" },
  });

  const header = [
    "membro",
    "inicio",
    "fim",
    "segundos",
    "horas",
    "status",
    "motivo",
  ];
  const rows = sessions.map((s) =>
    [
      csvCell(s.member.displayName),
      csvCell(s.startedAt.toISOString()),
      csvCell(s.endedAt ? s.endedAt.toISOString() : ""),
      csvCell(s.totalSeconds ?? ""),
      csvCell(s.totalSeconds ? (s.totalSeconds / 3600).toFixed(2) : ""),
      csvCell(s.status),
      csvCell(s.closedReason ?? ""),
    ].join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `ponto_${params.guildId}_${period}d.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
