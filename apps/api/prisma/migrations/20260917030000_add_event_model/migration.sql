-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "onuId" TEXT,
    "source" "AlarmSource" NOT NULL,
    "slotNo" INTEGER NOT NULL,
    "portNo" INTEGER,
    "logicalPortNo" INTEGER,
    "trapOid" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "severity" "AlarmSeverity" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_oltId_occurredAt_idx" ON "Event"("oltId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

