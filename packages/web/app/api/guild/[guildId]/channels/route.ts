import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertGuildAccess } from "@/lib/session";
import { fetchGuildChannels } from "@/lib/discord";

export const dynamic = "force-dynamic";

// Lista os canais do servidor (texto + voz) para os seletores de configuração.
export async function GET(
  _req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const session = await getServerSession(authOptions);
  if (!session?.accessToken)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const channels = await fetchGuildChannels(
      session.accessToken,
      params.guildId,
    );
    return NextResponse.json({ channels });
  } catch (err) {
    console.error("[web] Erro ao buscar canais do Discord:", err);
    return NextResponse.json(
      { error: "discord_error" },
      { status: 502 },
    );
  }
}
