import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { getAccessibleGuilds, isAdminOfGuild } from "./discord";

export type GuardResult =
  | { ok: true; session: Awaited<ReturnType<typeof getServerSession>> }
  | { ok: false; response: NextResponse };

// Sessão do servidor (server component ou route handler).
export async function getSession() {
  return getServerSession(authOptions);
}

// Lista de servidores que o usuário pode administrar no site (interseção).
export async function getAccessibleGuildList() {
  const session = await getSession();
  if (!session?.accessToken) return null;
  return getAccessibleGuilds(session.accessToken);
}

// Guarda toda API route que recebe um guildId: confirma que a sessão atual é
// admin daquele servidor ANTES de ler/escrever qualquer dado (seção 7.6).
export async function assertGuildAccess(
  guildId: string | undefined | null,
): Promise<GuardResult> {
  const session = await getSession();
  if (!session?.accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  if (!guildId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "guildId_required" }, { status: 400 }),
    };
  }
  const allowed = await isAdminOfGuild(session.accessToken, guildId);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, session };
}
