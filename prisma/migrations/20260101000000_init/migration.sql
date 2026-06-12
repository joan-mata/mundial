-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER', 'SEMI', 'THIRD', 'FINAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "KnockoutMethod" AS ENUM ('EXTRA_TIME', 'PENALTIES');

-- CreateEnum
CREATE TYPE "ExtraBetType" AS ENUM ('WORLD_CUP_WINNER', 'TOP_SCORER', 'BEST_GOALKEEPER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('RESULT_SET', 'RESULT_CLEARED', 'EXTENSION_GRANTED', 'EXTENSION_REVOKED', 'RECALCULATE_ALL', 'USER_CREATED', 'USER_DEACTIVATED', 'EXTRA_BET_RESOLVED', 'FAVORITE_RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "telegramToken" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "favoriteTeam" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "flag" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "stage" "Stage" NOT NULL,
    "group" TEXT,
    "venueCity" TEXT NOT NULL DEFAULT '',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "etHomeScore" INTEGER,
    "etAwayScore" INTEGER,
    "knockoutMethod" "KnockoutMethod",
    "knockoutWinnerId" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "externalId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "knockoutWinnerId" TEXT,
    "knockoutMethod" "KnockoutMethod",
    "etHomeScore" INTEGER,
    "etAwayScore" INTEGER,
    "basePoints" INTEGER,
    "knockoutPoints" INTEGER,
    "points" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionExtension" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "newDeadline" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PredictionExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExtraBetType" NOT NULL,
    "value" TEXT NOT NULL,
    "points" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExtraBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "adminId" TEXT NOT NULL,
    "matchId" TEXT,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalId_key" ON "Match"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_matchId_key" ON "Prediction"("userId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionExtension_matchId_userId_key" ON "PredictionExtension"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraBet_userId_type_key" ON "ExtraBet"("userId", "type");

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionExtension" ADD CONSTRAINT "PredictionExtension_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionExtension" ADD CONSTRAINT "PredictionExtension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraBet" ADD CONSTRAINT "ExtraBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
