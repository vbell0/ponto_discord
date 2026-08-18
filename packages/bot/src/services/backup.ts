import { Client, TextChannel } from "discord.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { prisma } from "@ponto/database";
import { DISCORD_ATTACHMENT_LIMIT_BYTES } from "@ponto/shared";
import { config } from "../config.js";

const execAsync = promisify(exec);

function safeGuildId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

function backupDumpPath(guildId: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `/tmp/guild_${safeGuildId(guildId)}_${ts}.dump`;
}

// Roda pg_dump (custom format) e gzip do resultado. Lança em caso de falha.
// Recebe os caminhos já calculados para que o caller possa limpá-los no finally
// mesmo se o pg_dump falhar (o redirecionamento cria o .dump mesmo assim).
async function generateDump(
  dumpPath: string,
  gzPath: string,
): Promise<{ filePath: string; sizeBytes: number }> {
  // Duas etapas separadas: falha no pg_dump deve propagar (não mascarar pelo pipe).
  await execAsync(
    `pg_dump -Fc --no-owner "${config.databaseUrl}" > "${dumpPath}"`,
    { shell: "/bin/sh", maxBuffer: 200 * 1024 * 1024 },
  );
  await execAsync(`gzip "${dumpPath}"`, { shell: "/bin/sh" });

  const stat = await fs.promises.stat(gzPath);
  return { filePath: gzPath, sizeBytes: stat.size };
}

async function postSizeWarning(
  client: Client,
  channelId: string,
  sizeBytes: number,
): Promise<void> {
  const channel = await client.channels.fetch(channelId);
  if (channel?.isTextBased()) {
    const textChannel = channel as TextChannel;
    await textChannel.send({
      content:
        `⚠️ O backup automático não pôde ser enviado: o dump ficou grande demais ` +
        `(${sizeBytes} bytes; limite do Discord é ${DISCORD_ATTACHMENT_LIMIT_BYTES}). ` +
        `Gere backups mais frequentes ou revise o volume de dados.`,
    });
  }
}

// Executa o backup de UMA guild. Se `force` for true (disparo manual do site),
// ignora o toggle backupEnabled. Destino único: anexo no canal #backups.
export async function runBackupForGuild(
  client: Client,
  guildId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return;

  // Toggle: se desligado e não for disparo manual, pula silenciosamente.
  if (!opts.force && !guild.backupEnabled) return;
  if (!guild.backupChannelId) {
    console.warn(
      `[bot] Guild ${guildId} tem backup ${opts.force ? "solicitado" : "ligado"} mas sem backupChannelId; ignorando.`,
    );
    return;
  }

  const dumpPath = backupDumpPath(guildId);
  const gzPath = `${dumpPath}.gz`;
  let filePath: string | null = null;
  try {
    const { filePath: fp, sizeBytes } = await generateDump(dumpPath, gzPath);
    filePath = fp;

    // Acima do limite do Discord: não envia, só registra e avisa.
    if (sizeBytes > DISCORD_ATTACHMENT_LIMIT_BYTES) {
      await postSizeWarning(client, guild.backupChannelId, sizeBytes);
      await prisma.backupLog.create({
        data: {
          guildId,
          fileName: path.basename(filePath),
          sizeBytes,
          success: false,
          errorMsg: `dump excede ${DISCORD_ATTACHMENT_LIMIT_BYTES} bytes`,
          discordChannelId: guild.backupChannelId,
        },
      });
      return;
    }

    const channel = await client.channels.fetch(guild.backupChannelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error("canal de backup inválido ou inacessível");
    }
    const textChannel = channel as TextChannel;
    const msg = await textChannel.send({
      content: `Backup — ${new Date().toISOString()}`,
      files: [{ attachment: filePath, name: path.basename(filePath) }],
    });

    await prisma.backupLog.create({
      data: {
        guildId,
        fileName: path.basename(filePath),
        sizeBytes,
        success: true,
        discordMessageId: msg.id,
        discordChannelId: guild.backupChannelId,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[bot] Falha no backup da guild ${guildId}:`, errorMsg);
    await prisma.backupLog
      .create({
        data: {
          guildId,
          fileName: filePath ? path.basename(filePath) : "n/a",
          sizeBytes: filePath
            ? (await fs.promises.stat(filePath).catch(() => ({ size: 0 }))).size
            : 0,
          success: false,
          errorMsg,
          discordChannelId: guild.backupChannelId ?? null,
        },
      })
      .catch(() => {});
  } finally {
    // Sempre apaga os arquivos temporários do disco (dump e dump.gz),
    // mesmo se o pg_dump falhou e sobrou um .dump vazio.
    await fs.promises.unlink(gzPath).catch(() => {});
    await fs.promises.unlink(dumpPath).catch(() => {});
  }
}

// Cron horário: varre as guilds visíveis e faz backup das que têm o toggle ligado.
export async function runBackupAll(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      await runBackupForGuild(client, guild.id, { force: false });
    } catch (err) {
      console.error(`[bot] Erro no backup da guild ${guild.id}:`, err);
    }
  }
}
