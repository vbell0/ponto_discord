import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminOfGuild } from "@/lib/discord";
import { prisma } from "@ponto/database";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

const TABS = [
  { href: (id: string) => `/guild/${id}/analytics`, label: "Analytics" },
  { href: (id: string) => `/guild/${id}/membros`, label: "Membros" },
  { href: (id: string) => `/guild/${id}/configuracoes`, label: "Configurações" },
  { href: (id: string) => `/guild/${id}/backups`, label: "Backups" },
];

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { guildId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect("/login");

  const admin = await isAdminOfGuild(session.accessToken, params.guildId);
  if (!admin) redirect("/sem-acesso");

  const guild = await prisma.guild.findUnique({
    where: { id: params.guildId },
  });
  if (!guild) redirect("/sem-acesso");

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <Link
              href="/servidores"
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              ← Servidores
            </Link>
            <h1
              className="text-lg font-semibold"
              style={{ color: guild.embedColor }}
            >
              {guild.orgName}
            </h1>
          </div>
          <SignOutButton />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-2 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={t.href(params.guildId)}
              className="rounded-t-md px-3 py-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
