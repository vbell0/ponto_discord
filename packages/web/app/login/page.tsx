"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Ponto RP — Acesso</h1>
      <p className="max-w-sm text-center text-sm text-zinc-400">
        Faça login com sua conta do Discord para gerenciar os servidores onde
        você é administrador e o bot está instalado.
      </p>
      <button
        onClick={() => signIn("discord", { callbackUrl: "/servidores" })}
        className="rounded-md bg-[#5865F2] px-6 py-3 font-medium text-white transition hover:bg-[#4752c4]"
      >
        Entrar com Discord
      </button>
    </main>
  );
}
