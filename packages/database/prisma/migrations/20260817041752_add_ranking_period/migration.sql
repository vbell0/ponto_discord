-- CreateEnum
CREATE TYPE "RankingPeriod" AS ENUM ('SEMANA', 'MES');

-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "rankingPeriod" "RankingPeriod" NOT NULL DEFAULT 'SEMANA';
