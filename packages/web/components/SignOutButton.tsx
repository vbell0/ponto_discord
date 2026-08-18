"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700"
    >
      Sair
    </button>
  );
}
