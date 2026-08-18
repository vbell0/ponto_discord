"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LineHours, BarRanking, Heatmap } from "@/components/Charts";

type AnalyticsData = {
  summary: { totalSessions: number; totalSeconds: number; activeMembers: number };
  perDay: { date: string; totalSeconds: number }[];
  ranking: { memberId: string; displayName: string; totalSeconds: number }[];
  heatmap: number[][];
};

export default function AnalyticsPage({ params }: { params: { guildId: string } }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [memberId, setMemberId] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const url = new URL(`/api/guild/${params.guildId}/analytics`, window.location.origin);
      url.searchParams.set("period", period);
      if (memberId) url.searchParams.set("memberId", memberId);
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      setLoading(false);
    }
    fetchData();
  }, [params.guildId, period, memberId]);

  function formatHours(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-zinc-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-400">Período</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-[#5865F2]"
          >
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/api/guild/${params.guildId}/analytics/export?period=${period}${memberId ? `&memberId=${memberId}` : ""}`}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            Exportar CSV
          </Link>
          <Link
            href={`/api/guild/${params.guildId}/analytics/export/excel?period=${period}${memberId ? `&memberId=${memberId}` : ""}`}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            Exportar Excel
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <p className="text-sm text-zinc-400">Sessões</p>
          <p className="text-3xl font-semibold">{data?.summary.totalSessions ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <p className="text-sm text-zinc-400">Horas totais</p>
          <p className="text-3xl font-semibold">{formatHours(data?.summary.totalSeconds ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <p className="text-sm text-zinc-400">Membros ativos</p>
          <p className="text-3xl font-semibold">{data?.summary.activeMembers ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
        <h3 className="mb-3 font-medium">Horas por dia (linha)</h3>
        <LineHours data={data?.perDay ?? []} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h3 className="mb-3 font-medium">Top 10 (barra)</h3>
          <BarRanking data={data?.ranking ?? []} />
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h3 className="mb-3 font-medium">Heatmap inícios (dia × hora)</h3>
          <Heatmap data={data?.heatmap ?? []} />
        </div>
      </div>

      {memberId && data && (
        <p className="text-sm text-zinc-400">
          Filtrado por membro (ID: {memberId})
        </p>
      )}
    </div>
  );
}