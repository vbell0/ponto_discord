import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { assertGuildAccess } from "@/lib/session";
import { botRefresh } from "@/lib/botApi";
import { RankingPeriod } from "@ponto/shared";

export const dynamic = "force-dynamic";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(
  _req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const guild = await prisma.guild.findUnique({
    where: { id: params.guildId },
  });
  if (!guild) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ guild });
}

export async function PUT(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.orgName === "string") data.orgName = body.orgName.slice(0, 60);
  if (typeof body.embedColor === "string" && HEX.test(body.embedColor))
    data.embedColor = body.embedColor;

  const ch = (key: string) => body[key];
  if (typeof ch("painelChannelId") === "string" || ch("painelChannelId") === null)
    data.painelChannelId = ch("painelChannelId") || null;
  if (typeof ch("top10ChannelId") === "string" || ch("top10ChannelId") === null)
    data.top10ChannelId = ch("top10ChannelId") || null;
  if (typeof ch("abertosChannelId") === "string" || ch("abertosChannelId") === null)
    data.abertosChannelId = ch("abertosChannelId") || null;
  if (typeof ch("backupChannelId") === "string" || ch("backupChannelId") === null)
    data.backupChannelId = ch("backupChannelId") || null;

  if (Array.isArray(body.allowedVoiceChannelIds))
    data.allowedVoiceChannelIds = body.allowedVoiceChannelIds.filter(
      (x: unknown) => typeof x === "string",
    );
  if (Number.isInteger(body.autoCloseSeconds))
    data.autoCloseSeconds = Math.min(3600, Math.max(1, body.autoCloseSeconds));
  if (
    body.rankingPeriod === RankingPeriod.SEMANA ||
    body.rankingPeriod === RankingPeriod.MES
  )
    data.rankingPeriod = body.rankingPeriod;

  const guild = await prisma.guild.update({
    where: { id: params.guildId },
    data,
  });

  // Efeito imediato no Discord: republica os embeds com a nova config.
  await botRefresh(params.guildId).catch(() => {});

  return NextResponse.json({ guild });
}
