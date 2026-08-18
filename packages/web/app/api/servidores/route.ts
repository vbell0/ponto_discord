import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAccessibleGuilds } from "@/lib/discord";

export const dynamic = "force-dynamic";

// Lista os servidores que o usuário pode administrar no site (interseção
// admin × bot). Revalida a sessão no servidor (não confia no client).
export async function GET() {
  const session = await getSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guilds = await getAccessibleGuilds(session.accessToken);
  return NextResponse.json({ guilds });
}
