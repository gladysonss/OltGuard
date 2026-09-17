-- AlterTable
ALTER TABLE "Olt" ADD COLUMN     "lastPolledAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "reachable" BOOLEAN NOT NULL DEFAULT true;

