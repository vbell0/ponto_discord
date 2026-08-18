import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@ponto/database";
import { assertGuildAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

// Cancela (remove) uma sessão manualmente — vira AuditLog.
export async function POST(
  _req: Request,
  { params }: { params: { guildId: string; sessionId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const session = await prisma.pontoSession.findUnique({
    where: { id: params.sessionId },
    include: { member: true },
  });
  if (!session || session.member.guildId !== params.guildId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // PontoEvent tem FK RESTRICT → apaga os eventos antes da sessão.
  await prisma.pontoEvent.deleteMany({
    where: { sessionId: params.sessionId },
  });
  await prisma.pontoSession.delete({ where: { id: params.sessionId } });

  const actor = await getServerSession(authOptions);
  await prisma.auditLog
    .create({
      data: {
        guildId: params.guildId,
        actorId: actor?.user?.id ?? "admin",
        action: "CANCEL_SESSION",
        metadata: { sessionId: params.sessionId },
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
