/*
  Warnings:

  - You are about to drop the column `apiUrl` on the `Router` table. All the data in the column will be lost.
  - Added the required column `host` to the `Router` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "chatwootContactId" INTEGER;

-- AlterTable
ALTER TABLE "Router" DROP COLUMN "apiUrl",
ADD COLUMN     "host" TEXT NOT NULL,
ADD COLUMN     "port" INTEGER NOT NULL DEFAULT 8728,
ADD COLUMN     "useTls" BOOLEAN NOT NULL DEFAULT false;
