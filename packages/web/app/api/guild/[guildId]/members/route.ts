import { NextResponse } from "next/server";
import { assertGuildAccess } from "@/lib/session";
import { getMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Lista de membros (usado pelo filtro de analytics e pela página /membros).
export async function GET(
  _req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const members = await getMembers(params.guildId);
  return NextResponse.json({ members });
}
