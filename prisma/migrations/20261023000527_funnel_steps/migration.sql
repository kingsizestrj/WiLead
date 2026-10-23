-- CreateEnum
CREATE TYPE "FunnelStepType" AS ENUM ('OPT_IN', 'RETURNED', 'BLOCK_CLICK', 'CHATWOOT_LABEL');

-- CreateTable
CREATE TABLE "FunnelStep" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FunnelStepType" NOT NULL,
    "param" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "FunnelStep_pkey" PRIMARY KEY ("id")
);
