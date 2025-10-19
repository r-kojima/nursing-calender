-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'DELETED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleCalendarEmail" TEXT,
ADD COLUMN     "googleCalendarLastSync" TIMESTAMP(3),
ADD COLUMN     "googleCalendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "googleTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Shift_syncStatus_idx" ON "Shift"("syncStatus");

-- CreateIndex
CREATE INDEX "Shift_memberId_syncStatus_idx" ON "Shift"("memberId", "syncStatus");
