import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { assertGuildAccess } from "@/lib/session";
import { botBackupNow } from "@/lib/botApi";

export const dynamic = "force-dynamic";

// GET: lista do histórico + toggle (GET /?action=toggle)
export async function GET(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  if (url.searchParams.get("action") === "toggle") {
    const guild = await prisma.guild.findUnique({ where: { id: params.guildId } });
    if (!guild) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.guild.update({
      where: { id: params.guildId },
      data: { backupEnabled: !guild.backupEnabled },
    });
    return NextResponse.json({ backupEnabled: !guild.backupEnabled });
  }

  const logs = await prisma.backupLog.findMany({
    where: { guildId: params.guildId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt.toISOString(),
      fileName: l.fileName,
      sizeBytes: l.sizeBytes,
      success: l.success,
      errorMsg: l.errorMsg,
      discordChannelId: l.discordChannelId,
      discordMessageId: l.discordMessageId,
    })),
  });
}

// POST: gerar backup manual agora (ignora o toggle)
export async function POST(
  _req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const res = await botBackupNow(params.guildId);
  const json = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json(json, { status: res.status });
}