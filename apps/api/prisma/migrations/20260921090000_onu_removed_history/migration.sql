-- Onu.onuId em Alarm/Event passa de ON DELETE CASCADE pra SET NULL: a
-- remocao controlada (ver OltBootstrapService, reconciliacao do walk) sempre
-- desvincula onuId ANTES de apagar a linha de Onu (movendo o alarme/evento
-- pra removedOnuId), entao esse SET NULL so entra em acao como rede de
-- seguranca se algo apagar a Onu direto sem passar por esse fluxo.
ALTER TABLE "Alarm" DROP CONSTRAINT "Alarm_onuId_fkey";
ALTER TABLE "Event" DROP CONSTRAINT "Event_onuId_fkey";

-- AlterTable
ALTER TABLE "Alarm" ADD COLUMN     "removedOnuId" TEXT;
ALTER TABLE "Event" ADD COLUMN     "removedOnuId" TEXT;

-- CreateTable
-- Snapshot de uma Onu que sumiu de um walk de reconciliacao - serial e
-- posicao podem ser reaproveitados depois por outro cliente/ONU, entao isso
-- e o unico jeito de saber "quem esteve aqui antes" sem reinterpretar a
-- linha atual da Onu.
CREATE TABLE "OnuRemoved" (
    "id" TEXT NOT NULL,
    "oltId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "alias" TEXT,
    "slotNo" INTEGER NOT NULL,
    "portNo" INTEGER NOT NULL,
    "logicalPortNo" INTEGER NOT NULL,
    "status" "OnuStatus" NOT NULL,
    "onuCreatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnuRemoved_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnuRemoved_oltId_idx" ON "OnuRemoved"("oltId");

-- CreateIndex
CREATE INDEX "OnuRemoved_serialNumber_idx" ON "OnuRemoved"("serialNumber");

-- AddForeignKey
ALTER TABLE "OnuRemoved" ADD CONSTRAINT "OnuRemoved_oltId_fkey" FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_removedOnuId_fkey" FOREIGN KEY ("removedOnuId") REFERENCES "OnuRemoved"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_onuId_fkey" FOREIGN KEY ("onuId") REFERENCES "Onu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_removedOnuId_fkey" FOREIGN KEY ("removedOnuId") REFERENCES "OnuRemoved"("id") ON DELETE SET NULL ON UPDATE CASCADE;
