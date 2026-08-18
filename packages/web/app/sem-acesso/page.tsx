import Link from "next/link";

export default function SemAcessoPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Acesso negado</h1>
      <p className="max-w-sm text-sm text-zinc-400">
        Você não tem permissão de administrador neste servidor, ou o bot não
        está instalado nele.
      </p>
      <Link
        href="/servidores"
        className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
      >
        Voltar aos servidores
      </Link>
    </main>
  );
}
