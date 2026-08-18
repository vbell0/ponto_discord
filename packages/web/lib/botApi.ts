// Cliente da internal-api do bot (protegida por INTERNAL_API_SECRET).
// Só deve ser usado em contexto de servidor (route handlers / server components).
const BASE = process.env.INTERNAL_API_URL ?? "http://bot:4000";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-api-secret": SECRET,
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  return res;
}

// Republica/edita os embeds (painel/top10/abertos) a partir da config do banco.
export async function botRefresh(guildId?: string) {
  return postJson("/internal/refresh", guildId ? { guildId } : {});
}

// Disparo manual de backup (ignora o toggle backupEnabled).
export async function botBackupNow(guildId: string) {
  return postJson("/internal/backup", { guildId });
}

// Força o fechamento de uma sessão (motivo ADMIN), vindo do site.
export async function botForceClose(sessionId: string, actorId?: string) {
  return postJson(`/internal/ponto/${sessionId}/fechar`, { actorId });
}
