-- CreateEnum
CREATE TYPE "PontoStatus" AS ENUM ('ABERTO', 'PAUSADO', 'FECHADO');

-- CreateEnum
CREATE TYPE "ClosedReason" AS ENUM ('MANUAL', 'SAIU_DA_VOZ', 'ADMIN');

-- CreateEnum
CREATE TYPE "PontoEventType" AS ENUM ('INICIO', 'PAUSA', 'RETOMADA', 'FIM');

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgName" TEXT NOT NULL DEFAULT 'Ponto',
    "embedColor" TEXT NOT NULL DEFAULT '#5865F2',
    "painelChannelId" TEXT,
    "top10ChannelId" TEXT,
    "abertosChannelId" TEXT,
    "backupChannelId" TEXT,
    "allowedVoiceChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoCloseSeconds" INTEGER NOT NULL DEFAULT 60,
    "backupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "PontoStatus" NOT NULL DEFAULT 'ABERTO',
    "closedReason" "ClosedReason",
    "totalSeconds" INTEGER,

    CONSTRAINT "PontoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "PontoEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceWatch" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_discordId_guildId_key" ON "Member"("discordId", "guildId");

-- CreateIndex
CREATE INDEX "PontoSession_memberId_idx" ON "PontoSession"("memberId");

-- CreateIndex
CREATE INDEX "PontoSession_status_idx" ON "PontoSession"("status");

-- CreateIndex
CREATE INDEX "PontoEvent_sessionId_idx" ON "PontoEvent"("sessionId");

-- CreateIndex
CREATE INDEX "BackupLog_guildId_idx" ON "BackupLog"("guildId");

-- CreateIndex
CREATE INDEX "AuditLog_guildId_idx" ON "AuditLog"("guildId");

-- CreateIndex
CREATE INDEX "VoiceWatch_deadline_idx" ON "VoiceWatch"("deadline");

-- CreateIndex
CREATE INDEX "VoiceWatch_sessionId_idx" ON "VoiceWatch"("sessionId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoSession" ADD CONSTRAINT "PontoSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoEvent" ADD CONSTRAINT "PontoEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PontoSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
