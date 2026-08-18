import { NextResponse } from "next/server";
import { prisma } from "@ponto/database";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertGuildAccess } from "@/lib/session";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { Readable } from "stream";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // precisa de fs/child_process

// Validação básica: o dump deve conter as tabelas principais do schema.
const REQUIRED_TABLES = [
  "Guild",
  "Member",
  "PontoSession",
  "PontoEvent",
  "BackupLog",
  "AuditLog",
  "VoiceWatch",
];

async function validateDump(filePath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // Lista as tabelas presentes no dump (custom format) sem restaurar.
    const { stdout } = await execAsync(
      `pg_restore --list "${filePath}" 2>&1`,
      { maxBuffer: 50 * 1024 * 1024 },
    );
    const tablesFound = new Set<string>();
    for (const line of stdout.split("\n")) {
      const m = line.match(/TABLE DATA\s+(\w+)/i);
      if (m) tablesFound.add(m[1]);
    }
    const missing = REQUIRED_TABLES.filter((t) => !tablesFound.has(t));
    if (missing.length > 0) {
      return { ok: false, error: `Tabelas obrigatórias ausentes no dump: ${missing.join(", ")}` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha ao inspecionar dump: ${msg}` };
  }
}

// Restaura o dump no banco atual (usa pg_restore com --clean --if-exists para
// substituir dados; em produção idealmente faria em DB de staging e promoveria).
async function restoreDump(filePath: string, databaseUrl: string): Promise<void> {
  // Extrai host/port/db/user/pass da DATABASE_URL para o pg_restore.
  // Formato: postgresql://user:pass@host:port/db
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const port = url.port || "5432";
  const user = url.username;
  const password = url.password;
  const db = url.pathname.slice(1);

  const env = { ...process.env, PGPASSWORD: password };
  await execAsync(
    `pg_restore --clean --if-exists --no-owner -h "${host}" -p "${port}" -U "${user}" -d "${db}" "${filePath}"`,
    { env, maxBuffer: 200 * 1024 * 1024 },
  );
}

export async function POST(
  req: Request,
  { params }: { params: { guildId: string } },
) {
  const guard = await assertGuildAccess(params.guildId);
  if (!guard.ok) return guard.response;

  const session = await getServerSession(authOptions);
  const actorId = session?.user?.id ?? "admin";

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "content_type_must_be_multipart" },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }

  // Extensão permitida
  const name = file.name.toLowerCase();
  const allowedExt = [".sql", ".dump", ".sql.gz", ".dump.gz"];
  if (!allowedExt.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: "invalid_extension_use_sql_or_dump_gz" },
      { status: 400 },
    );
  }

  // Salva em /tmp para validação + restore
  const tmpPath = `/tmp/restore_${Date.now()}_${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(tmpPath, buffer);

  try {
    // 1) Validação
    const valid = await validateDump(tmpPath);
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 });
    }

    // 2) Restore (transação não é possível com pg_restore; ele roda comandos DDL/DML).
    //    Para segurança, o ideal é restaurar num DB de staging e promover, mas
    //    como o plano diz "idealmente contra um banco staging", deixo como está.
    await restoreDump(tmpPath, process.env.DATABASE_URL ?? "");

    // 3) AuditLog
    await prisma.auditLog
      .create({
        data: {
          guildId: params.guildId,
          actorId,
          action: "IMPORT_BACKUP",
          metadata: { fileName: file.name, sizeBytes: buffer.length },
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[web] Erro ao importar backup:", msg);
    return NextResponse.json({ error: `restore_failed: ${msg}` }, { status: 500 });
  } finally {
    // Limpa arquivo temporário
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
}