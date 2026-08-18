import { redirect } from "next/navigation";
import Link from "next/link";
import { getAccessibleGuildList } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function ServidoresPage() {
  const guilds = await getAccessibleGuildList();
  if (!guilds) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Seus servidores</h1>
        <SignOutButton />
      </div>

      {guilds.length === 0 ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6 text-center">
          <p className="text-zinc-300">
            Você não é administrador de nenhum servidor onde o bot está
            instalado.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Adicione o bot a um servidor e garanta que você tenha permissão de
            Administrador nele.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {guilds.map((g) => (
            <li key={g.id}>
              <Link
                href={`/guild/${g.id}`}
                className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 transition hover:border-[#5865F2]"
              >
                {g.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.iconUrl}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-600 text-sm font-bold">
                    {g.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium">{g.orgName}</p>
                  <p className="text-sm text-zinc-400">{g.name}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
