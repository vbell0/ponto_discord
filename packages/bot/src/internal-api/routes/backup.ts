import { Request, Response } from "express";
import { Client } from "discord.js";
import { runBackupForGuild } from "../../services/backup.js";

// POST /internal/backup { guildId }
// Disparo manual vindo do site. Ignora o toggle backupEnabled (force: true).
// O resultado fica registrado em BackupLog (sucesso/erro) — a resposta só
// confirma que o fluxo foi executado.
export function backupHandler(client: Client) {
  return async (req: Request, res: Response) => {
    const guildId = req.body?.guildId as string | undefined;
    if (!guildId) {
      res.status(400).json({ ok: false, error: "guildId_required" });
      return;
    }
    try {
      await runBackupForGuild(client, guildId, { force: true });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[bot] Erro em /internal/backup:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  };
}
