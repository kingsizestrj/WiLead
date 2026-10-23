-- CreateEnum
CREATE TYPE "ApVendor" AS ENUM ('UNIFI', 'INTELBRAS', 'GREATEK', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentKind" AS ENUM ('ROUTER_UNREACHABLE', 'HOTSPOT_DOWN', 'AP_DOWN', 'POINT_SILENT');

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "unifiPassword" TEXT,
ADD COLUMN     "unifiSite" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "unifiUrl" TEXT,
ADD COLUMN     "unifiUser" TEXT;

-- CreateTable
CREATE TABLE "AccessPoint" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "vendor" "ApVendor" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthSample" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hotspotUp" BOOLEAN,
    "hosts" INTEGER,
    "active" INTEGER,
    "leases" INTEGER,
    "rxBytes" BIGINT,
    "txBytes" BIGINT,

    CONSTRAINT "HealthSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApSample" (
    "id" TEXT NOT NULL,
    "apId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "up" BOOLEAN NOT NULL,
    "latencyMs" DOUBLE PRECISION,
    "clients" INTEGER,
    "uptimeSec" INTEGER,
    "firmware" TEXT,

    CONSTRAINT "ApSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "kind" "IncidentKind" NOT NULL,
    "locationId" TEXT NOT NULL,
    "apId" TEXT,
    "detail" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthSample_locationId_at_idx" ON "HealthSample"("locationId", "at");

-- CreateIndex
CREATE INDEX "ApSample_apId_at_idx" ON "ApSample"("apId", "at");

-- CreateIndex
CREATE INDEX "Incident_endedAt_idx" ON "Incident"("endedAt");

-- AddForeignKey
ALTER TABLE "AccessPoint" ADD CONSTRAINT "AccessPoint_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthSample" ADD CONSTRAINT "HealthSample_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApSample" ADD CONSTRAINT "ApSample_apId_fkey" FOREIGN KEY ("apId") REFERENCES "AccessPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_apId_fkey" FOREIGN KEY ("apId") REFERENCES "AccessPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
