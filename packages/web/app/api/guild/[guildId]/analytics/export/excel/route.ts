import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { PontoStatus } from "@ponto/shared";
import { assertGuildAccess } from "@/lib/session";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

function sinceFromPeriod(period: string): Date {
  const days = period === "30" ? 30 : 7;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "Ponto RP";
  wb.created = new Date();

  // Aba 1: Sessões detalhadas
  const ws1 = wb.addWorksheet("Sessões");
  ws1.columns = [
    { header: "Membro", key: "member", width: 30 },
    { header: "Início", key: "startedAt", width: 22 },
    { header: "Fim", key: "endedAt", width: 22 },
    { header: "Segundos", key: "totalSeconds", width: 12 },
    { header: "Horas (decimal)", key: "hours", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Motivo", key: "closedReason", width: 16 },
  ];
  for (const s of sessions) {
    ws1.addRow({
      member: s.member.displayName,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : "",
      totalSeconds: s.totalSeconds ?? "",
      hours: s.totalSeconds ? Number((s.totalSeconds / 3600).toFixed(2)) : "",
      status: s.status,
      closedReason: s.closedReason ?? "",
    });
  }

  // Aba 2: Resumo por membro (total de horas)
  const byMember = new Map<string, { name: string; totalSeconds: number }>();
  for (const s of sessions) {
    const cur = byMember.get(s.memberId) ?? { name: s.member.displayName, totalSeconds: 0 };
    cur.totalSeconds += s.totalSeconds ?? 0;
    byMember.set(s.memberId, cur);
  }
  const ws2 = wb.addWorksheet("Resumo por Membro");
  ws2.columns = [
    { header: "Membro", key: "member", width: 30 },
    { header: "Total Segundos", key: "totalSeconds", width: 16 },
    { header: "Total Horas", key: "totalHours", width: 14 },
  ];
  for (const [, v] of byMember) {
    ws2.addRow({
      member: v.name,
      totalSeconds: v.totalSeconds,
      totalHours: Number((v.totalSeconds / 3600).toFixed(2)),
    });
  }

  // Aba 3: Horas por dia
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (!s.endedAt || s.totalSeconds == null) continue;
    const dk = s.endedAt.toISOString().slice(0, 10);
    byDay.set(dk, (byDay.get(dk) ?? 0) + s.totalSeconds);
  }
  const ws3 = wb.addWorksheet("Horas por Dia");
  ws3.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Segundos", key: "seconds", width: 14 },
    { header: "Horas", key: "hours", width: 12 },
  ];
  for (const [date, seconds] of [...byDay.entries()].sort()) {
    ws3.addRow({ date, seconds, hours: Number((seconds / 3600).toFixed(2)) });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `ponto_${params.guildId}_${period}d.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}