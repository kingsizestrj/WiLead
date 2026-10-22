-- CreateTable
CREATE TABLE "LocationSource" (
    "id" TEXT NOT NULL,
    "hotspotServer" TEXT NOT NULL,
    "interfaceName" TEXT NOT NULL DEFAULT '',
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationSource_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AccessFailure" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessFailure_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "LocationSource_hotspotServer_interfaceName_key" ON "LocationSource"("hotspotServer", "interfaceName");
-- CreateIndex
CREATE INDEX "AccessFailure_createdAt_idx" ON "AccessFailure"("createdAt");
-- AddForeignKey
ALTER TABLE "LocationSource" ADD CONSTRAINT "LocationSource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AccessFailure" ADD CONSTRAINT "AccessFailure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing locations become sources (hotspot server without interface)
INSERT INTO "LocationSource" ("id", "hotspotServer", "interfaceName", "locationId")
SELECT 'src_' || "id", "hotspotServer", '', "id" FROM "Location";

-- DropIndex
DROP INDEX "Location_hotspotServer_key";
-- AlterTable
ALTER TABLE "Location" DROP COLUMN "hotspotServer";
