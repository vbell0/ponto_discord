import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertGuildAccess } from "@/lib/session";
import { botForceClose } from "@/lib/botApi";

export const dynamic = "force-dynamic";

// Força o fechamento de um ponto (motivo ADMIN) via internal-api do bot.
export async function POST(
  _req: Request,
  { params }: { params: { guildId: string; sessionId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const session = await getServerSession(authOptions);
  const actorId = session?.user?.id ?? "admin";

  const res = await botForceClose(params.sessionId, actorId);
  const json = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json(json, { status: res.status });
}
