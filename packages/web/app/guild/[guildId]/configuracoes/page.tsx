"use client";

import { useState, useEffect } from "react";

export default function ConfigPage({ params }: { params: { guildId: string } }) {
  const [guild, setGuild] = useState<any>(null);
  const [channels, setChannels] = useState<{ id: string; name: string; type: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [g, c] = await Promise.all([
        fetch(`/api/guild/${params.guildId}/config`).then((r) => r.json()),
        fetch(`/api/guild/${params.guildId}/channels`).then((r) => r.json()),
      ]);
      if (g.guild) setGuild(g.guild);
      if (c.channels) setChannels(c.channels);
      setLoading(false);
    }
    fetchData();
  }, [params.guildId]);

  function handleChange(key: string, value: any) {
    setGuild((prev: typeof guild) => (prev ? { ...prev, [key]: value } : null));
  }

  async function handleSave() {
    if (!guild) return;
    setSaving(true);
    const res = await fetch(`/api/guild/${params.guildId}/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(guild),
    });
    setSaving(false);
    if (!res.ok) alert("Falha ao salvar");
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-zinc-500">Carregando...</div>;
  if (!guild) return <div className="text-red-400">Não encontrado</div>;

  const textChannels = channels.filter((c) => c.type === 0);
  const voiceChannels = channels.filter((c) => c.type === 2);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Configurações</h2>

      {/* Identidade whitelabel */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-4">
        <h3 className="font-medium">Identidade (whitelabel)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome da organização</label>
            <input
              value={guild.orgName}
              onChange={(e) => handleChange("orgName", e.target.value)}
              className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#5865F2]"
              placeholder="Ex: Departamento de Polícia"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Cor do embed</label>
            <input
              type="color"
              value={guild.embedColor}
              onChange={(e) => handleChange("embedColor", e.target.value)}
              className="w-12 h-10 rounded border-0 bg-transparent"
            />
            <p className="mt-1 text-xs text-zinc-500">Hex: {guild.embedColor}</p>
          </div>
        </div>
      </div>

      {/* Canais (texto) */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-4">
        <h3 className="font-medium">Canais de texto (embeds automáticos)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "painelChannelId", label: "Canal do painel (#ponto)" },
            { key: "top10ChannelId", label: "Canal do ranking (#top-10-horas)" },
            { key: "abertosChannelId", label: "Canal de pontos abertos (#pontos-abertos)" },
            { key: "backupChannelId", label: "Canal de backups (#backups)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm text-zinc-400 mb-1">{label}</label>
              <select
                value={guild[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value || null)}
                className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#5865F2]"
              >
                <option value="">— Nenhum —</option>
                {textChannels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Canais de voz permitidos */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-4">
        <h3 className="font-medium">Canais de voz permitidos para bater ponto</h3>
        <p className="text-sm text-zinc-500">
          Se vazio, qualquer canal de voz do servidor é aceito.
        </p>
        <div className="flex flex-wrap gap-2">
          {voiceChannels.map((c) => (
            <label
              key={c.id}
              className="rounded border px-3 py-1.5 text-sm cursor-pointer transition"
              style={{
                borderColor: guild.allowedVoiceChannelIds?.includes(c.id)
                  ? "#5865F2"
                  : "#3f3f46",
                backgroundColor: guild.allowedVoiceChannelIds?.includes(c.id)
                  ? "rgba(88,101,242,0.1)"
                  : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={guild.allowedVoiceChannelIds?.includes(c.id) ?? false}
                onChange={(e) =>
                  handleChange(
                    "allowedVoiceChannelIds",
                    e.target.checked
                      ? [...(guild.allowedVoiceChannelIds ?? []), c.id]
                      : (guild.allowedVoiceChannelIds ?? []).filter((x: string) => x !== c.id),
                  )
                }
                className="mr-1"
              />
              #{c.name}
            </label>
          ))}
        </div>
      </div>

      {/* Tolerância / ranking */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-4">
        <h3 className="font-medium">Comportamento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Tempo de tolerância ao sair da call (segundos)
            </label>
            <input
              type="number"
              min={1}
              max={3600}
              value={guild.autoCloseSeconds}
              onChange={(e) => handleChange("autoCloseSeconds", Number(e.target.value))}
              className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#5865F2]"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Quanto tempo esperar antes de fechar o ponto automaticamente ao sair
              da call.
            </p>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Período do ranking Top 10</label>
            <select
              value={guild.rankingPeriod}
              onChange={(e) => handleChange("rankingPeriod", e.target.value)}
              className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#5865F2]"
            >
              <option value="SEMANA">Semana (7 dias)</option>
              <option value="MES">Mês (30 dias)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-3">
        <h3 className="font-medium">Ações imediatas</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-[#5865F2] px-4 py-2 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            onClick={async () => {
              const res = await fetch(
                `/api/guild/${params.guildId}/backups`,
                { method: "POST" },
              );
              const json = await res.json();
              alert(json.ok ? "Backup gerado" : "Falha: " + json.error);
            }}
            className="rounded border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-700"
          >
            Gerar backup agora
          </button>
        </div>
      </div>
    </div>
  );
}