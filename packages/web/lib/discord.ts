import { prisma } from "@ponto/database";

const DISCORD_API = "https://discord.com/api";
// Bit ADMINISTRATOR (0x8) — quem tem este bit é admin independente de cargos.
const ADMINISTRATOR = 0x8n;

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
};

export type AccessibleGuild = {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  orgName: string;
  embedColor: string;
  isOwner: boolean;
};

// Busca a lista de servidores do usuário na API do Discord.
export async function fetchUserGuilds(
  accessToken: string,
): Promise<DiscordGuild[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord /users/@me/guilds retornou ${res.status}`);
  }
  return (await res.json()) as DiscordGuild[];
}

// Verdadeiro se o usuário é Dono OU tem o bit ADMINISTRATOR no servidor.
export function isGuildAdmin(g: DiscordGuild): boolean {
  if (g.owner) return true;
  try {
    return (BigInt(g.permissions) & ADMINISTRATOR) !== 0n;
  } catch {
    return false;
  }
}

function iconUrlFor(g: { id: string; icon: string | null }): string | null {
  if (!g.icon) return null;
  return `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`;
}

// Interseção: servidores onde o usuário é admin × servidores onde o bot está
// (tabela Guild, populada no guildCreate do bot). Só esses aparecem no site.
export async function getAccessibleGuilds(
  accessToken: string,
): Promise<AccessibleGuild[]> {
  const userGuilds = await fetchUserGuilds(accessToken);
  const adminGuilds = userGuilds.filter(isGuildAdmin);
  if (adminGuilds.length === 0) return [];

  const dbGuilds = await prisma.guild.findMany({
    where: { id: { in: adminGuilds.map((g) => g.id) } },
    select: { id: true, name: true, orgName: true, embedColor: true },
  });
  const byId = new Map(dbGuilds.map((g) => [g.id, g]));

  return adminGuilds
    .filter((g) => byId.has(g.id))
    .map((g) => ({
      id: g.id,
      name: byId.get(g.id)!.name,
      icon: g.icon,
      iconUrl: iconUrlFor(g),
      orgName: byId.get(g.id)!.orgName,
      embedColor: byId.get(g.id)!.embedColor,
      isOwner: g.owner,
    }));
}

// Checagem pontual: o usuário (via token) é admin deste guildId específico?
export async function isAdminOfGuild(
  accessToken: string,
  guildId: string,
): Promise<boolean> {
  const adminGuilds = (await fetchUserGuilds(accessToken)).filter(isGuildAdmin);
  return adminGuilds.some((g) => g.id === guildId);
}

export type DiscordChannel = {
  id: string;
  name: string;
  type: number; // 0 = texto, 2 = voz
};

// Lista os canais do servidor (precisa do token de um membro admin).
// Usado nos seletores de configuração (canais de texto e de voz permitidos).
export async function fetchGuildChannels(
  accessToken: string,
  guildId: string,
): Promise<DiscordChannel[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Discord /guilds/${guildId}/channels retornou ${res.status}`);
  }
  const raw = (await res.json()) as { id: string; name: string; type: number }[];
  return raw
    .filter((c) => c.type === 0 || c.type === 2)
    .map((c) => ({ id: c.id, name: c.name, type: c.type }));
}
