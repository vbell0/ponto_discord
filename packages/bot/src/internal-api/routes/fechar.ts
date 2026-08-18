import { Request, Response } from "express";
import { prisma } from "@ponto/database";
import { Client } from "discord.js";
import { closeSession } from "../../services/ponto.js";
import { ClosedReason } from "@ponto/shared";

// POST /internal/ponto/:id/fechar  { actorId? }
// Força o fechamento de uma sessão (reason ADMIN). Chamado pelo site (/membros)
// após o site validar que o admin tem escopo sobre a guild. Registra AuditLog.
export function fecharHandler(_client: Client) {
  return async (req: Request, res: Response) => {
    const sessionId = req.params.id;
    if (!sessionId) {
      res.status(400).json({ ok: false, error: "sessionId_required" });
      return;
    }
    const actorId = (req.body?.actorId as string) ?? "admin";
    try {
      const session = await prisma.pontoSession.findUnique({
        where: { id: sessionId },
        include: { member: true },
      });
      if (!session) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
      }
      const result = await closeSession(sessionId, ClosedReason.ADMIN);
      if (!result) {
        res.status(200).json({ ok: false, error: "already_closed" });
        return;
      }
      await prisma.auditLog
        .create({
          data: {
            guildId: session.member.guildId,
            actorId,
            action: "FORCE_CLOSE",
            metadata: { sessionId, totalSeconds: result.totalSeconds },
          },
        })
        .catch(() => {});
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[bot] Erro em /internal/ponto/:id/fechar:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  };
}
