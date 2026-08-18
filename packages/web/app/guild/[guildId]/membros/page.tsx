"use client";

import { useState, useEffect } from "react";
import { formatDuration } from "@/lib/format";

type MemberRow = {
  id: string;
  discordId: string;
  displayName: string;
  totalSeconds: number;
  openSessionId: string | null;
  openStatus: string | null;
};

type SessionRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  totalSeconds: number | null;
  closedReason: string | null;
};

export default function MembrosPage({ params }: { params: { guildId: string } }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeMember, setActiveMember] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMembers() {
      const res = await fetch(`/api/guild/${params.guildId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
      setLoading(false);
    }
    fetchMembers();
  }, [params.guildId]);

  async function fetchSessions(memberId: string) {
    const res = await fetch(
      `/api/guild/${params.guildId}/analytics?period=30&memberId=${memberId}`,
    );
    if (res.ok) {
      const data = await res.json();
      // The analytics endpoint returns sessions differently; we'll use a direct route instead.
    }
  }

  async function fetchMemberSessions(memberId: string) {
    const res = await fetch(
      `/api/guild/${params.guildId}/membros/${memberId}/sessions`,
    );
    if (res.ok) {
      const data = await res.json();
      setSessions((prev) => ({ ...prev, [memberId]: data.sessions }));
    }
  }

  async function handleForceClose(sessionId: string, memberId: string) {
    if (!confirm("Forçar fechamento deste ponto? O motivo será ADMIN.")) return;
    setActionLoading(sessionId);
    const res = await fetch(
      `/api/guild/${params.guildId}/sessions/${sessionId}/fechar`,
      { method: "POST" },
    );
    const json = await res.json();
    setActionLoading(null);
    if (json.ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, openSessionId: null, openStatus: null } : m,
        ),
      );
    } else {
      alert("Falha ao forçar fechamento: " + (json.error ?? "erro"));
    }
  }

  async function handleCancelSession(sessionId: string, memberId: string) {
    if (!confirm("Cancelar (apagar) esta sessão? Ação irreversível.")) return;
    setActionLoading(sessionId);
    const res = await fetch(
      `/api/guild/${params.guildId}/sessions/${sessionId}/cancelar`,
      { method: "POST" },
    );
    const json = await res.json();
    setActionLoading(null);
    if (json.ok) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, openSessionId: null, openStatus: null } : m,
        ),
      );
    } else {
      alert("Falha ao cancelar: " + (json.error ?? "erro"));
    }
  }

  if (loading)
    return <div className="flex h-64 items-center justify-center text-zinc-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Membros</h2>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-4 py-2 text-left text-zinc-400">Membro</th>
              <th className="px-4 py-2 text-left text-zinc-400">Horas totais</th>
              <th className="px-4 py-2 text-left text-zinc-400">Ponto aberto</th>
              <th className="px-4 py-2 text-left text-zinc-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-t border-zinc-800 hover:bg-zinc-900/30"
              >
                <td className="px-4 py-2 font-medium">{m.displayName}</td>
                <td className="px-4 py-2">
                  {formatDuration(m.totalSeconds)}
                </td>
                <td className="px-4 py-2">
                  {m.openSessionId ? (
                    <span
                      className={
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs " +
                        (m.openStatus === "PAUSADO"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-green-500/20 text-green-400")
                      }
                    >
                      {m.openStatus === "PAUSADO" ? "⏸ Pausado" : "🟢 Aberto"}
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {m.openSessionId && (
                      <>
                        <button
                          onClick={() => handleForceClose(m.openSessionId!, m.id)}
                          disabled={!!actionLoading}
                          className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Forçar fechar
                        </button>
                        <button
                          onClick={() => handleCancelSession(m.openSessionId!, m.id)}
                          disabled={!!actionLoading}
                          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setActiveMember(m.id);
                        fetchMemberSessions(m.id);
                      }}
                      className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                    >
                      Histórico
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeMember && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">Histórico de sessões</h3>
            <button
              onClick={() => setActiveMember(null)}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              Fechar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-zinc-400">Início</th>
                  <th className="px-4 py-2 text-left text-zinc-400">Fim</th>
                  <th className="px-4 py-2 text-left text-zinc-400">Duração</th>
                  <th className="px-4 py-2 text-left text-zinc-400">Status</th>
                  <th className="px-4 py-2 text-left text-zinc-400">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {sessions[activeMember]?.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-800">
                    <td className="px-4 py-2">
                      {new Date(s.startedAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2">
                      {s.endedAt
                        ? new Date(s.endedAt).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {s.totalSeconds != null
                        ? formatDuration(s.totalSeconds)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">{s.status}</td>
                    <td className="px-4 py-2">{s.closedReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}