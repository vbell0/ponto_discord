"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDuration } from "@/lib/format";

type BackupLog = {
  id: string;
  createdAt: string;
  fileName: string;
  sizeBytes: number;
  success: boolean;
  errorMsg: string | null;
  discordChannelId: string | null;
  discordMessageId: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function ImportBackup({
  guildId,
  onRefresh,
}: {
  guildId: string;
  onRefresh: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/guild/${guildId}/backups/import`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      setFile(null);
      onRefresh();
      alert("Backup importado com sucesso. A página vai recarregar.");
    } else {
      setError(json.error ?? "Erro desconhecido");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept=".sql,.dump,.gz"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-sm text-zinc-300 file:mr-4 file:rounded file:border-0 file:bg-[#5865F2] file:px-3 file:py-1 file:text-white"
      />
      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="rounded bg-[#5865F2] px-4 py-2 font-medium text-white hover:bg-[#4752c4] disabled:opacity-50 w-fit"
      >
        {loading ? "Importando..." : "Importar backup"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default function BackupsPage({ params }: { params: { guildId: string } }) {
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/guild/${params.guildId}/backups`);
    if (res.ok) {
      const data = await res.json();
      setBackupEnabled(data.backupEnabled ?? false);
      setLogs(data.logs ?? []);
    }
    setLoading(false);
  }, [params.guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleBackup() {
    const res = await fetch(
      `/api/guild/${params.guildId}/backups?action=toggle`,
      { method: "GET" },
    );
    if (res.ok) {
      const data = await res.json();
      setBackupEnabled(data.backupEnabled);
    }
  }

  async function generateNow() {
    const res = await fetch(`/api/guild/${params.guildId}/backups`, {
      method: "POST",
    });
    const json = await res.json();
    if (json.ok) {
      // Refresh logs after manual backup
      await fetchData();
    } else {
      alert("Falha ao gerar backup: " + (json.error ?? "erro"));
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-zinc-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Backups</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={backupEnabled}
            onChange={toggleBackup}
            className="rounded border-zinc-600"
          />
          Backup automático (1 em 1h)
          {backupEnabled ? (
            <span className="text-green-400">Ligado</span>
          ) : (
            <span className="text-zinc-500">Desligado</span>
          )}
        </label>
      </div>

      <button
        onClick={generateNow}
        className="rounded border border-zinc-600 px-4 py-2 text-zinc-300 hover:bg-zinc-700"
      >
        Gerar backup agora
      </button>

      {/* Importação de backup (Fase 8) */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4 space-y-3">
        <h3 className="font-medium">Importar backup (.sql / .dump / .gz)</h3>
        <p className="text-sm text-zinc-500">
          Baixe o arquivo do canal #backups do Discord e faça upload aqui.
          <strong className="text-red-400"> Atenção: restaura TODOS os dados do banco</strong> (sobrescreve
          sessões, membros, configurações, logs).
        </p>
        <ImportBackup guildId={params.guildId} onRefresh={fetchData} />
      </div>

      <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50">
            <tr>
              <th className="px-4 py-2 text-left text-zinc-400">Data</th>
              <th className="px-4 py-2 text-left text-zinc-400">Arquivo</th>
              <th className="px-4 py-2 text-left text-zinc-400">Tamanho</th>
              <th className="px-4 py-2 text-left text-zinc-400">Status</th>
              <th className="px-4 py-2 text-left text-zinc-400">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-zinc-500" colSpan={5}>
                  Nenhum backup registrado
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-t border-zinc-800">
                  <td className="px-4 py-2">
                    {new Date(l.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 font-mono">{l.fileName}</td>
                  <td className="px-4 py-2">{formatBytes(l.sizeBytes)}</td>
                  <td className="px-4 py-2">
                    {l.success ? (
                      <span className="text-green-400">✓ Sucesso</span>
                    ) : (
                      <span className="text-red-400">✗ Falhou</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {l.discordChannelId && l.discordMessageId && (
                      <a
                        href={`https://discord.com/channels/${params.guildId}/${l.discordChannelId}/${l.discordMessageId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#5865F2] hover:underline"
                      >
                        Ver no Discord
                      </a>
                    )}
                    {l.errorMsg && (
                      <span className="text-xs text-red-400 ml-2">{l.errorMsg}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Os arquivos de backup são enviados **apenas como anexo no canal #backups
        do Discord** (limite 25 MB). O servidor não guarda cópias locais. Para
        restaurar, baixe o arquivo do Discord e faça upload abaixo.
      </p>
    </div>
  );
}