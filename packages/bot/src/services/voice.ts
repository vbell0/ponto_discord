import { Client, VoiceState, GuildMember } from "discord.js";
import cron from "node-cron";
import { prisma } from "@ponto/database";
import { ClosedReason, PontoStatus } from "@ponto/shared";
import type { VoiceWatch } from "@prisma/client";
import {
  upsertMember,
  findOpenSession,
  closeSession,
  formatDuration,
} from "./ponto.js";

// Referência ao client (para DM/notificação e checagem best-effort de voz).
let discordClient: Client | null = null;

// Timers em memória por sessionId (perdem-se em restart — por isso há o cron).
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function isAllowedVoice(
  allowed: string[],
  channelId: string | null,
): boolean {
  if (!channelId) return false;
  if (allowed.length === 0) return true; // lista vazia = qualquer canal de voz
  return allowed.includes(channelId);
}

// --- API interna ---

export function initVoiceService(client: Client): void {
  discordClient = client;
  // Cron de segurança: varre VoiceWatch vencidos a cada 15s para cobrir
  // restarts do bot (os timers em memória somem no reinício).
  cron.schedule("*/15 * * * * *", () => {
    void runSafetySweep();
  });
  // Varre logo na subida, fechando o que venceu enquanto o bot estava offline.
  void runSafetySweep();
}

export async function runSafetySweep(): Promise<void> {
  try {
    const overdue = await prisma.voiceWatch.findMany({
      where: { resolved: false, deadline: { lte: new Date() } },
    });
    for (const w of overdue) {
      await processAutoClose(w.sessionId);
    }
  } catch (err) {
    console.error("[bot] Erro no safety sweep de VoiceWatch:", err);
  }
}

// --- Handler do evento voiceStateUpdate ---

export async function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const guildId = oldState.guild?.id ?? newState.guild?.id;
  if (!guildId) return;

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return;

  const member = (newState.member ?? oldState.member) as GuildMember | null;
  if (!member) return;
  const displayName = member.displayName ?? member.user.username;

  const oldChannel = oldState.channelId;
  const newChannel = newState.channelId;

  const leftAllowed =
    !!oldChannel &&
    (!newChannel || !isAllowedVoice(guild.allowedVoiceChannelIds, newChannel));
  const joinedAllowed =
    !!newChannel && isAllowedVoice(guild.allowedVoiceChannelIds, newChannel);

  const dbMember = await upsertMember(guildId, member.id, displayName);
  const open = await findOpenSession(dbMember.id);

  // Voltou a um canal permitido: cancela watch ativo (ponto continua).
  if (joinedAllowed) {
    await cancelWatch(open?.id);
    return;
  }

  // Saiu de um canal permitido com ponto em aberto: cria/atualiza o watch.
  if (leftAllowed && open) {
    await createOrRefreshWatch(
      guildId,
      dbMember.id,
      open.id,
      guild.autoCloseSeconds,
    );
  }
}

// --- Lógica de watch/timer ---

async function createOrRefreshWatch(
  guildId: string,
  memberId: string,
  sessionId: string,
  autoCloseSeconds: number,
): Promise<void> {
  const deadline = new Date(Date.now() + autoCloseSeconds * 1000);
  const existing = await prisma.voiceWatch.findFirst({
    where: { sessionId, resolved: false },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.voiceWatch.update({
      where: { id: existing.id },
      data: { deadline },
    });
  } else {
    await prisma.voiceWatch.create({
      data: { guildId, memberId, sessionId, deadline },
    });
  }
  scheduleAutoClose(sessionId, deadline);
}

async function cancelWatch(sessionId?: string): Promise<void> {
  if (!sessionId) return;
  const existing = await prisma.voiceWatch.findFirst({
    where: { sessionId, resolved: false },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await prisma.voiceWatch.update({
      where: { id: existing.id },
      data: { resolved: true },
    });
  }
  const t = timers.get(sessionId);
  if (t) {
    clearTimeout(t);
    timers.delete(sessionId);
  }
}

function scheduleAutoClose(sessionId: string, deadline: Date): void {
  const existing = timers.get(sessionId);
  if (existing) clearTimeout(existing);
  const ms = Math.max(0, deadline.getTime() - Date.now());
  const t = setTimeout(() => {
    timers.delete(sessionId);
    void processAutoClose(sessionId);
  }, ms);
  timers.set(sessionId, t);
}

export async function processAutoClose(sessionId: string): Promise<void> {
  const watch = await prisma.voiceWatch.findFirst({
    where: { sessionId, resolved: false },
    orderBy: { createdAt: "desc" },
  });
  if (!watch) return;

  // Best-effort: se o membro já voltou a um canal permitido, não fecha.
  if (discordClient && (await memberBackInVoice(watch))) {
    await prisma.voiceWatch.update({
      where: { id: watch.id },
      data: { resolved: true },
    });
    return;
  }

  await prisma.voiceWatch.update({
    where: { id: watch.id },
    data: { resolved: true },
  });

  const session = await prisma.pontoSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.status === PontoStatus.FECHADO) return;

  const result = await closeSession(sessionId, ClosedReason.SAIU_DA_VOZ);
  if (result) {
    await notifyAutoClose(watch.guildId, watch.memberId, result.totalSeconds);
  }
}

async function memberBackInVoice(watch: VoiceWatch): Promise<boolean> {
  try {
    const guildCfg = await prisma.guild.findUnique({
      where: { id: watch.guildId },
    });
    if (!guildCfg) return false;
    const member = await prisma.member.findUnique({
      where: { id: watch.memberId },
    });
    if (!member) return false;

    const g = await discordClient!.guilds.fetch(watch.guildId);
    const gm = await g.members.fetch(member.discordId);
    const cid = gm.voice?.channelId ?? null;
    if (!cid) return false;
    if (guildCfg.allowedVoiceChannelIds.length === 0) return true;
    return guildCfg.allowedVoiceChannelIds.includes(cid);
  } catch {
    return false;
  }
}

async function notifyAutoClose(
  guildId: string,
  memberId: string,
  totalSeconds: number,
): Promise<void> {
  try {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || !discordClient) return;
    await discordClient.users.send(member.discordId, {
      content:
        `⚠️ Seu ponto em **${guildId}** foi fechado automaticamente porque você ` +
        `saiu do canal de voz por mais de 1 minuto.\n` +
        `Tempo registrado: ${formatDuration(totalSeconds)}.`,
    });
  } catch (err) {
    console.warn(
      `[bot] Não foi possível DM o membro ${memberId} sobre auto-close:`,
      err,
    );
  }
}
