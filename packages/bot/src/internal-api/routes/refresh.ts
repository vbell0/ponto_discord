import { Request, Response } from "express";
import { Client } from "discord.js";
import { publishPanelForGuild, publishAllPanels } from "../../services/panel.js";

// POST /internal/refresh  { guildId? }
// Republica/edita os embeds (painel, top10, abertos) a partir da config do banco.
// Chamado pelo site quando o admin muda canal/nome/cor (seção 6). Se guildId for
// omitido, republica para todas as guilds visíveis.
export function refreshHandler(client: Client) {
  return async (req: Request, res: Response) => {
    const guildId = req.body?.guildId as string | undefined;
    try {
      if (guildId) {
        await publishPanelForGuild(client, guildId);
      } else {
        await publishAllPanels(client);
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[bot] Erro em /internal/refresh:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  };
}
